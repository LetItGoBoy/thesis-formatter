"""
AI模型适配层 - 支持多种大模型API
backend/lib/ai_client.py

切换模型只改环境变量 AI_PROVIDER，业务代码不动。
段落识别采用「批量识别」：N 段 -> ceil(N/BATCH_SIZE) 次 API 调用。

模型档位（首页选择 经济/标准/旗舰）：
  tier 参数透传至 classify_paragraphs_batch -> get_ai_client(tier)。
  各档位 provider + model 通过环境变量覆盖；未指定时回退到 AI_PROVIDER。
  TIER_{ECONOMY,STANDARD,FLAGSHIP}_PROVIDER / _MODEL 可在 .env 里单独配置。
"""
import os
import re
import time
import json
import logging
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger("thesis.ai")

AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", 120))
# 模型单次输出 token 上限。整片识别要为每段回写一条 JSON。
# 取 4096：批内段数受 BATCH_SIZE 限制（≤25 段 ≈ 1000 输出 token），4096 足够留余量；
# 且对 8k 上下文模型，过大的 max_tokens 会和长输入抢占窗口、反而触发截断。
AI_MAX_TOKENS = int(os.environ.get("AI_MAX_TOKENS", 4096))
# 批大小：关键是「输入 + 输出」都要放进模型上下文窗口，不能只算输出！
# 以 moonshot-v1-8k（8k 总窗口）为基准：系统提示≈800 token，每段输入≈200 token
# （PARA_TRUNC=200 字 ÷ 1.5 字/token）+ 输出≈40 token。
#   (8000 - 800) / (200 + 40) ≈ 30 段 -> 取 25 段留安全余量。
# 旧默认 120 段会让单批输入暴涨到 ~3 万 token，远超 8k，模型只能读到开头一小段，
# 命中率不足触发二分重试 -> 重试子批仍超窗 -> 递归爆炸 -> 整体解析超时。
# 上下文更大的模型（moonshot-v1-32k/128k、deepseek 等）可在 .env 调大 AI_BATCH_SIZE。
BATCH_SIZE = int(os.environ.get("AI_BATCH_SIZE", 25))
PARA_TEXT_TRUNC = int(os.environ.get("AI_PARA_TRUNC", 200))
# 并发批数上限：默认 3 以匹配 Moonshot 账号的组织并发上限，避免 429 限流。
# 账号配额更高时可在 .env 调大 AI_BATCH_CONCURRENCY。
AI_BATCH_CONCURRENCY = int(os.environ.get("AI_BATCH_CONCURRENCY", 3))
# 限流(429)重试次数与初始退避秒数
AI_RATE_LIMIT_RETRIES = int(os.environ.get("AI_RATE_LIMIT_RETRIES", 4))
AI_RATE_LIMIT_BACKOFF = float(os.environ.get("AI_RATE_LIMIT_BACKOFF", 2))

# 合法类型（与 config/formats/hulunbeier_univ.json 的 paragraph_styles 对应）
VALID_TYPES = [
    "toc_title", "toc_h1", "toc_h2", "toc_h3",
    "paper_title", "author_line", "instructor",
    "abstract_title_cn", "abstract_body_cn", "keywords_cn",
    "abstract_title_en", "abstract_body_en", "keywords_en",
    "h1", "h2", "h3", "body", "numbered_item",
    "table_caption", "table", "formula", "formula_number",
    "figure_caption", "caption",
    "conclusion_title", "conclusion_body",
    "references_title", "reference_item", "ref",
    "cover",  # 旧版兼容
]


# ============================================================
# 抽象基类 + 各模型实现
# ============================================================
class BaseAIClient(ABC):
    @abstractmethod
    def chat(self, system_prompt: str, user_message: str) -> str:
        ...


class _OpenAICompatClient(BaseAIClient):
    """所有 OpenAI 兼容协议的模型共用实现"""
    base_url: str = None
    api_key_env: str = None
    model_env: str = None
    default_model: str = None

    def __init__(self):
        from openai import OpenAI
        if not os.environ.get(self.api_key_env):
            raise AIFatalError(f"缺少环境变量 {self.api_key_env}")
        kwargs = {"api_key": os.environ[self.api_key_env], "timeout": AI_TIMEOUT}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        self.client = OpenAI(**kwargs)
        self.model = os.environ.get(self.model_env, self.default_model)

    def chat(self, system_prompt, user_message):
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
            temperature=0.1,
            max_tokens=AI_MAX_TOKENS,
            timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content


class DeepSeekClient(_OpenAICompatClient):
    base_url = "https://api.deepseek.com"
    api_key_env = "DEEPSEEK_API_KEY"
    model_env = "DEEPSEEK_MODEL"
    default_model = "deepseek-chat"


class QwenClient(_OpenAICompatClient):
    base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key_env = "QWEN_API_KEY"
    model_env = "QWEN_MODEL"
    default_model = "qwen-plus"


class ZhipuClient(_OpenAICompatClient):
    base_url = "https://open.bigmodel.cn/api/paas/v4"
    api_key_env = "ZHIPU_API_KEY"
    model_env = "ZHIPU_MODEL"
    default_model = "glm-4-flash"


class MoonshotClient(_OpenAICompatClient):
    base_url = "https://api.moonshot.cn/v1"
    api_key_env = "MOONSHOT_API_KEY"
    model_env = "MOONSHOT_MODEL"
    default_model = "moonshot-v1-8k"


class OpenAIClient(_OpenAICompatClient):
    base_url = None
    api_key_env = "OPENAI_API_KEY"
    model_env = "OPENAI_MODEL"
    default_model = "gpt-4o-mini"


class ClaudeClient(BaseAIClient):
    def __init__(self):
        import anthropic
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise AIFatalError("缺少环境变量 ANTHROPIC_API_KEY")
        self.client = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"], timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

    def chat(self, system_prompt, user_message):
        m = self.client.messages.create(
            model=self.model, max_tokens=AI_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=AI_TIMEOUT,
        )
        return m.content[0].text


# ============================================================
# 致命错误识别
# ============================================================
class AIFatalError(Exception):
    pass


def _is_fatal_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in (
        "authentication", "api key", "apikey", "unauthorized", "401",
        "not found", "404", "invalid model",
        "name or service not known", "connection refused", "ssl",
    ))


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in (
        "429", "too many requests", "rate limit", "rate_limit", "concurrency",
    ))


# ============================================================
# 模型档位（首页选择：经济/标准/旗舰）
# 各档位映射到 provider + 具体 model，可用环境变量覆盖。
# 默认全部走 Moonshot（同一个 MOONSHOT_API_KEY 即可），不破坏现有部署。
# ============================================================
MODEL_TIERS = {
    "economy": {
        "provider": os.environ.get("TIER_ECONOMY_PROVIDER", "moonshot"),
        "model": os.environ.get("TIER_ECONOMY_MODEL", "moonshot-v1-8k"),
    },
    "standard": {
        "provider": os.environ.get("TIER_STANDARD_PROVIDER", "moonshot"),
        "model": os.environ.get("TIER_STANDARD_MODEL", "moonshot-v1-128k"),
    },
    "flagship": {
        "provider": os.environ.get("TIER_FLAGSHIP_PROVIDER", "moonshot"),
        "model": os.environ.get("TIER_FLAGSHIP_MODEL", "moonshot-v1-128k"),
    },
}
DEFAULT_TIER = os.environ.get("DEFAULT_TIER", "standard")

_AI_CLIENTS = {
    "deepseek": DeepSeekClient, "qwen": QwenClient,
    "zhipu": ZhipuClient, "moonshot": MoonshotClient,
    "claude": ClaudeClient, "openai": OpenAIClient,
}


def get_ai_client(tier: str | None = None) -> BaseAIClient:
    """按档位返回对应模型客户端；tier 为空则回退到 AI_PROVIDER 环境变量。"""
    model_override = None
    if tier and tier in MODEL_TIERS:
        provider = MODEL_TIERS[tier]["provider"].lower().strip()
        model_override = MODEL_TIERS[tier]["model"]
    else:
        provider = os.environ.get("AI_PROVIDER", "deepseek").lower()
    if provider not in _AI_CLIENTS:
        raise ValueError(f"不支持的AI提供商: {provider}，可选: {list(_AI_CLIENTS.keys())}")
    client = _AI_CLIENTS[provider]()
    if model_override:
        client.model = model_override
    return client


# ============================================================
# 大块 -> 候选类型（与 config/formats/hulunbeier_univ.json 的 blocks 一致）
# 预扫描已经确定每段所属大块，AI 只在该块的候选类型里选择，避免跨块误判。
# ============================================================
BLOCK_LABELS = {
    "toc": "目录", "abstract": "摘要", "body": "正文",
    "conclusion": "总结", "references": "参考文献",
}

BLOCK_TYPES = {
    "toc": ["toc_title", "toc_h1", "toc_h2", "toc_h3"],
    "abstract": ["paper_title", "author_line", "instructor",
                 "abstract_title_cn", "abstract_body_cn", "keywords_cn",
                 "abstract_title_en", "abstract_body_en", "keywords_en"],
    "body": ["h1", "h2", "h3", "body", "numbered_item", "table_caption",
             "table", "formula", "formula_number", "figure_caption", "caption"],
    "conclusion": ["conclusion_title", "conclusion_body"],
    "references": ["references_title", "reference_item", "ref"],
}

# 单批识别失败时，按所属大块回退到该块最常见的类型（而非一律 body）
BLOCK_DEFAULT_TYPE = {
    "toc": "toc_h1", "abstract": "abstract_body_cn", "body": "body",
    "conclusion": "conclusion_body", "references": "reference_item",
}

TYPE_DESC = {
    "toc_title": '目录标题（"目录"两字）',
    "toc_h1": '目录一级条目（含章号，如"第1章 绪论 1"）',
    "toc_h2": '目录二级条目（含"1.1"）',
    "toc_h3": '目录三级条目（含"1.1.1"）',
    "paper_title": "论文题目",
    "author_line": "作者信息（姓名/学号/专业等）",
    "instructor": "指导老师",
    "abstract_title_cn": '中文摘要标题（"摘要"）',
    "abstract_body_cn": "中文摘要正文",
    "keywords_cn": '中文关键词（"关键词"开头）',
    "abstract_title_en": "Abstract 标题",
    "abstract_body_en": "英文摘要正文",
    "keywords_en": '英文关键词（"Keywords"开头）',
    "h1": '一级标题（"第X章 XXX"）',
    "h2": '二级标题（"1.1 XXX"）',
    "h3": '三级标题（"1.1.1 XXX"）',
    "body": "正文段落",
    "numbered_item": '数字编号条目（"1. xxx"/"1、xxx"）',
    "table_caption": '表说明（"表X-X xxx"）',
    "table": "表格内容",
    "formula": "公式行",
    "formula_number": '单独的公式编号"(2-1)"',
    "figure_caption": '图说明（"图X-X xxx"）',
    "caption": "通用图表题注（兼容）",
    "conclusion_title": '总结标题（"总结"）',
    "conclusion_body": "总结正文",
    "references_title": '参考文献标题（"参考文献"/"REFERENCES"）',
    "reference_item": "单条参考文献",
    "ref": "参考文献（兼容，新数据用 reference_item）",
}


def _allowed_types(block: str | None) -> list[str]:
    return BLOCK_TYPES.get(block) or [t for t in VALID_TYPES if t != "cover"]


def _default_type(block: str | None) -> str:
    return BLOCK_DEFAULT_TYPE.get(block, "body")


# ============================================================
# 规则置信度：按文本特征与所判类型的吻合度打分
# 替代大模型自报的不可信 confidence（模型常照抄示例值 0.95）。
# ============================================================
_CH_NUM = "一二三四五六七八九十百零"
_RE_CHAPTER = re.compile(rf"^第[{_CH_NUM}\d]+章")
_RE_H2 = re.compile(r"^\d+\.\d+(?!\.\d)\s*\S")        # 1.1（但非 1.1.1）
_RE_H3 = re.compile(r"^\d+\.\d+\.\d+\s*\S")           # 1.1.1
_RE_FIG = re.compile(rf"^图\s*[\d{_CH_NUM}]")
_RE_TAB = re.compile(rf"^表\s*[\d{_CH_NUM}]")
_RE_FIGTAB = re.compile(rf"^[图表]\s*[\d{_CH_NUM}]")
# 题注强模式：图/表 + 编号 + 空格 + 说明文字（「图3.1所示」这种无空格的正文引用不算）
_RE_FIG_CAP = re.compile(rf"^图\s*[\d{_CH_NUM}]+([-—.．][\d{_CH_NUM}]+)?[\s　]+\S")
_RE_TAB_CAP = re.compile(rf"^表\s*[\d{_CH_NUM}]+([-—.．][\d{_CH_NUM}]+)?[\s　]+\S")
_RE_KW_CN = re.compile(r"^关键词\s*[:：]")
_RE_KW_EN = re.compile(r"^key\s*words?\s*[:：]?", re.IGNORECASE)
_RE_NUMBERED = re.compile(r"^\d+\s*[.、]\s*\S")
_RE_REF = re.compile(r"^\[\d+\]|^\d+[.\s]")
_RE_FORMULA_NUM = re.compile(r"^\(\s*\d+\s*[-—]\s*\d+\s*\)$")
_RE_END_PUNCT = re.compile(r"[。！？!?.]$")
_RE_SENT_PUNCT = re.compile(r"[。，；！？]")
_RE_PAGENUM_END = re.compile(r"\d{1,4}$")

# 固定内容标题：去空格后直接比对（命中即高置信，否则强烈怀疑误判）
_FIXED_TITLE = {
    "toc_title": ("目录",),
    "abstract_title_cn": ("摘要",),
    "abstract_title_en": ("abstract",),
    "references_title": ("参考文献", "references"),
    "conclusion_title": ("总结", "结论"),
}


def compute_rule_confidence(text: str, ptype: str) -> float:
    """根据文本特征与类型的吻合度返回 0.10~0.98 的置信度。"""
    t = (text or "").strip()
    n = len(t)

    if ptype in _FIXED_TITLE:
        bare = re.sub(r"\s+", "", t).lower()
        return 0.97 if bare in _FIXED_TITLE[ptype] else 0.25

    score = 0.50
    if ptype == "h1":
        if _RE_CHAPTER.match(t):
            score += 0.45
        elif n <= 25 and not _RE_SENT_PUNCT.search(t):
            score += 0.15
        if _RE_SENT_PUNCT.search(t) and n > 40:
            score -= 0.50
        if _RE_FIGTAB.match(t):
            score -= 0.40
    elif ptype == "h2":
        if _RE_H2.match(t):
            score += 0.45
        if n <= 30:
            score += 0.10
        if n > 50:
            score -= 0.40
        if _RE_FIGTAB.match(t):
            score -= 0.35
    elif ptype == "h3":
        if _RE_H3.match(t):
            score += 0.45
        if n <= 30:
            score += 0.10
        if n > 50:
            score -= 0.40
    elif ptype == "figure_caption":
        if _RE_FIG.match(t):
            score += 0.45
        if n <= 40:
            score += 0.10
        if _RE_TAB.match(t):
            score -= 0.45
    elif ptype == "table_caption":
        if _RE_TAB.match(t):
            score += 0.45
        if n <= 40:
            score += 0.10
        if _RE_FIG.match(t):
            score -= 0.45
    elif ptype == "caption":
        if _RE_FIGTAB.match(t):
            score += 0.35
    elif ptype == "keywords_cn":
        score += 0.48 if _RE_KW_CN.match(t) else -0.20
        if n > 100:
            score -= 0.30
    elif ptype == "keywords_en":
        score += 0.48 if _RE_KW_EN.match(t) else -0.20
        if n > 120:
            score -= 0.30
    elif ptype == "numbered_item":
        score += 0.45 if _RE_NUMBERED.match(t) else -0.30
    elif ptype in ("reference_item", "ref"):
        if _RE_REF.match(t):
            score += 0.40
        if 20 <= n <= 300:
            score += 0.10
        if n < 10:
            score -= 0.30
    elif ptype == "formula_number":
        score += 0.48 if _RE_FORMULA_NUM.match(t) else -0.30
    elif ptype in ("toc_h1", "toc_h2", "toc_h3"):
        score += 0.30 if _RE_PAGENUM_END.search(t) else -0.35
        if ptype == "toc_h1" and _RE_CHAPTER.match(t):
            score += 0.18
        elif ptype == "toc_h2" and _RE_H2.match(t):
            score += 0.15
        elif ptype == "toc_h3" and _RE_H3.match(t):
            score += 0.15
    elif ptype in ("body", "conclusion_body", "abstract_body_cn", "abstract_body_en"):
        score = 0.55
        if _RE_END_PUNCT.search(t) and n > 30:
            score += 0.15
        if n < 8:
            score -= 0.35
        if _RE_FIGTAB.match(t):
            score -= 0.45
        if _RE_CHAPTER.match(t):
            score -= 0.45
        elif _RE_H3.match(t) or _RE_H2.match(t):
            score -= 0.25
    elif ptype == "paper_title":
        if n <= 40 and not _RE_SENT_PUNCT.search(t):
            score += 0.25
        if n > 60:
            score -= 0.30
    elif ptype in ("author_line", "instructor"):
        score = 0.60  # 难以从文本判定，给中性偏上

    return max(0.10, min(0.98, score))


# 强模式纠错：AI 常把图/表题注误判为标题/正文；这些模式极可靠，直接覆盖。
_OVERRIDE_FROM = {"h1", "h2", "h3", "body", "numbered_item", "caption",
                  "abstract_body_cn", "conclusion_body"}


def apply_pattern_override(text: str, ptype: str) -> str:
    """对极可靠的文本模式强制纠正 AI 误判，返回纠正后的类型。"""
    t = (text or "").strip()
    if len(t) > 50:
        return ptype  # 长段落不是题注
    if ptype in _OVERRIDE_FROM or ptype == "table_caption":
        if _RE_FIG_CAP.match(t):
            return "figure_caption"
    if ptype in _OVERRIDE_FROM or ptype == "figure_caption":
        if _RE_TAB_CAP.match(t):
            return "table_caption"
    return ptype


def _build_whole_doc_prompt() -> str:
    """整片识别提示词：AI 通读全文，按语义+上下文判断边界与类型。"""
    lines = [
        "你是学术论文段落格式分类助手。下面是一篇本科毕业论文从「目录」开始的全部段落"
        "（封面和原创性声明已被去除）。请先通读全文、理解整体结构，再逐段分类，输出JSON数组。",
        "",
        "论文结构顺序通常为：目录 → 摘要(中文/英文) → 正文(若干章) → 总结 → 参考文献(可能含致谢)。",
        "请结合段落的语义和上下文判断它属于哪一部分、是什么类型，不要只凭是否含某个关键词。",
        "",
        "重要判断要点：",
        "- 章标题不一定有「第X章」前缀，可能直接写「参考文献」「总结」等；若其后跟着 1.1 / 1.2 这类小节，它就是一级标题 h1。",
        "- 「摘要」之前可能重复出现论文题目页（题目 / 作者 / 学号 / 专业 / 指导教师），这些属于摘要部分"
        "（paper_title / author_line / instructor），不是目录。",
        "- 只有带页码的目录条目才是 toc_*；正文里的标题是 h1 / h2 / h3。",
        "- 英文摘要紧跟中文摘要、位于第一章/绪论之前：成段的英文叙述是 abstract_body_en（不是 h1/正文）；"
        "以 Keywords/Key words 开头的英文是 keywords_en（不是 h2）；单独一行的 Abstract 是 abstract_title_en。"
        "这些都属于摘要部分，第一章/绪论开始后才算正文。",
        "- 标题（h1/h2/h3/toc_*）都很短，通常不超过一行；成段的长句叙述绝不是标题，按其所在部分归类（摘要里就是摘要正文，正文里就是 body）。",
        "- 关键词（keywords_cn / keywords_en）只是若干个短词，总长度极短（一般不超过 60 字，绝对不超过 80 字）。"
        "  凡是成段的长句叙述，哪怕出现在摘要部分，都绝对不要识别为 keywords_cn 或 keywords_en；"
        "  应按其所在部分识别为 abstract_body_cn 或 abstract_body_en。",
        "- 以「图X-X」「图X.X」开头、后跟简短说明的独立短行是图说明 figure_caption；"
        "  以「表X-X」「表X.X」开头的是表说明 table_caption。它们绝不是标题（h1/h2/h3），也不是正文。",
        "",
        "全部可用类型（按所在部分分组）：",
    ]
    for blk in ("toc", "abstract", "body", "conclusion", "references"):
        lines.append(f"【{BLOCK_LABELS[blk]}】")
        for t in BLOCK_TYPES[blk]:
            lines.append(f"- {t}: {TYPE_DESC.get(t, t)}")
    lines += [
        "",
        "输出规则（极重要）：",
        "1. 只输出JSON数组，不要markdown标记、不要解释",
        "2. 元素数必须等于输入段落数，每段都分类，一段都不能漏",
        '3. 每元素格式：{"index": 数字, "type": "类型", "confidence": 0~1小数}',
        "4. index 必须精确等于输入方括号中的编号",
        "5. type 只能用上面列出的类型",
    ]
    return "\n".join(lines)


_WHOLE_DOC_SYSTEM_PROMPT = _build_whole_doc_prompt()


def _build_system_prompt(block: str | None) -> str:
    # 无 block 约束 -> 整片语义识别（parser 跳过封面/声明后默认走这条）
    if block is None:
        return _WHOLE_DOC_SYSTEM_PROMPT

    types = _allowed_types(block)
    label = BLOCK_LABELS.get(block, "论文")
    head = (f"你是学术论文段落格式分类助手。下面这一批段落都来自论文的【{label}】部分，"
            f"请只在【{label}】允许的类型里给每段分类，输出JSON数组。")
    lines = [head, "", f"【{label}】允许的类型（只能从这些里选，不得使用其他类型）："]
    for t in types:
        lines.append(f"- {t}: {TYPE_DESC.get(t, t)}")
    lines += [
        "",
        "输出规则（极重要）：",
        "1. 只输出JSON数组，不要markdown标记、不要解释",
        "2. 元素数必须等于输入段落数，每段都分类",
        '3. 每元素格式：{"index": 数字, "type": "类型", "confidence": 0~1小数}',
        "4. index 必须精确等于输入方括号中的编号",
        "5. type 只能是上面列出的类型，绝不允许其他值",
    ]
    return "\n".join(lines)


def _build_batch_user_message(items: list[dict]) -> str:
    lines = ["请识别以下段落的类型。只输出JSON数组：", ""]
    for it in items:
        text = (it.get("text") or "").strip().replace("\n", " ")
        if len(text) > PARA_TEXT_TRUNC:
            text = text[:PARA_TEXT_TRUNC] + "..."
        lines.append(f"[{it['index']}] {text}")
    lines += ["", "输出（index对应方括号编号）：",
              '[{"index":N,"type":"xxx","confidence":0.95}, ...]']
    return "\n".join(lines)


def _extract_json_array(text: str) -> list:
    if not text:
        raise ValueError("空响应")
    text = text.strip()
    if text.startswith("```"):
        m = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    if not text.startswith("["):
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            text = m.group(0)
    return json.loads(text)


def _chat_with_retry(client: BaseAIClient, system_prompt: str, user_msg: str) -> str:
    """调用模型。致命错误立即抛出；限流(429)按退避重试，绝不静默降级。"""
    delay = AI_RATE_LIMIT_BACKOFF
    for attempt in range(AI_RATE_LIMIT_RETRIES + 1):
        try:
            return client.chat(system_prompt, user_msg)
        except Exception as e:
            if _is_fatal_error(e):
                raise AIFatalError(f"AI服务不可用: {e}") from e
            if _is_rate_limit(e) and attempt < AI_RATE_LIMIT_RETRIES:
                logger.warning("限流(429)，%.0fs 后重试 (%d/%d)",
                               delay, attempt + 1, AI_RATE_LIMIT_RETRIES)
                time.sleep(delay)
                delay *= 2
                continue
            raise


def _coverage(arr: list, items: list[dict]) -> int:
    """arr 中命中本批 index 的条目数（衡量响应是否被截断/遗漏）。"""
    if not arr:
        return 0
    want = {it["index"] for it in items}
    got = {e.get("index") for e in arr if isinstance(e, dict)}
    return len(want & got)


def _classify_batch(client: BaseAIClient, items: list[dict], block: str | None,
                    depth: int = 0) -> list[dict]:
    user_msg = _build_batch_user_message(items)
    response = _chat_with_retry(client, _build_system_prompt(block), user_msg)

    allowed = set(_allowed_types(block))
    fallback = _default_type(block)
    text_by_idx = {it["index"]: it.get("text", "") for it in items}

    arr = None
    parse_err = None
    try:
        arr = _extract_json_array(response)
    except Exception as e:
        parse_err = e

    # 解析失败、或覆盖率过低（多半是输出被截断或输入超窗）：二分重试，
    # 而不是整批回退成 body/0.3。每个子批输入/输出都更短，更易完整放进上下文窗口。
    # depth<3 + 子批须>3 段：限制递归层数，避免单批退化成几十次串行调用而拖垮整体耗时。
    covered = _coverage(arr, items) if arr else 0
    if (arr is None or covered < len(items) * 0.8) and len(items) > 3 and depth < 3:
        mid = len(items) // 2
        logger.warning("批输出疑似截断/不全（命中 %d/%d），二分重试 depth=%d",
                       covered, len(items), depth)
        left = _classify_batch(client, items[:mid], block, depth + 1)
        right = _classify_batch(client, items[mid:], block, depth + 1)
        return left + right

    if arr is None:
        logger.warning("批响应解析失败，整批回退 %s: %s | %s",
                       fallback, parse_err, (response or "")[:200])
        return [{"index": it["index"], "type": fallback, "confidence": 0.3,
                 "reason": f"批响应解析失败: {parse_err}"} for it in items]

    seen: dict[int, dict] = {}
    for entry in arr:
        if not isinstance(entry, dict):
            continue
        idx = entry.get("index")
        if not isinstance(idx, int):
            continue
        t = entry.get("type", fallback)
        if t not in allowed:
            t = fallback
        # 强模式纠错：图/表题注被误判为标题/正文时直接覆盖
        txt = text_by_idx.get(idx, "")
        t2 = apply_pattern_override(txt, t)
        if t2 != t and t2 in allowed:
            t = t2
        # 用规则置信度替代模型自报值（后者常照抄示例 0.95，无信号）
        conf = compute_rule_confidence(txt, t)
        seen[idx] = {"index": idx, "type": t, "confidence": conf,
                     "reason": entry.get("reason", "")}

    out = []
    for it in items:
        if it["index"] in seen:
            out.append(seen[it["index"]])
        else:
            out.append({"index": it["index"], "type": fallback,
                        "confidence": 0.3, "reason": "AI未返回该段索引"})
    return out


def _split_into_batches(paragraphs: list[dict], batch_size: int) -> list[tuple[str | None, list[dict]]]:
    """按大块切成连续段，再按 batch_size 分批。每批同属一个大块。"""
    segments: list[tuple[str | None, list[dict]]] = []
    cur_block = _UNSET = object()
    seg: list[dict] = []
    for p in paragraphs:
        b = p.get("block")
        if b != cur_block:
            if seg:
                segments.append((cur_block, seg))
            cur_block, seg = b, [p]
        else:
            seg.append(p)
    if seg:
        segments.append((cur_block, seg))

    tasks: list[tuple[str | None, list[dict]]] = []
    for block, items in segments:
        for i in range(0, len(items), batch_size):
            tasks.append((block, items[i:i + batch_size]))
    return tasks


def classify_paragraphs_batch(paragraphs: list[dict], batch_size: int | None = None,
                               tier: str | None = None) -> list[dict]:
    """
    分块批量识别。
    paragraphs: [{"index": int, "text": str, "block"?: str}, ...]（仅非空段落）
        block 由 parser 预扫描得出（toc/abstract/body/conclusion/references）；
        缺省时不约束类型（退化为全类型识别）。
    tier: 模型档位（economy/standard/flagship）；None 时回退 AI_PROVIDER。
    返回: [{"index": int, "type": str, "confidence": float, "reason": str}, ...]
    """
    if not paragraphs:
        return []

    client = get_ai_client(tier)
    batch_size = batch_size or BATCH_SIZE
    tasks = _split_into_batches(paragraphs, batch_size)
    n_batches = len(tasks)
    workers = min(AI_BATCH_CONCURRENCY, n_batches) if n_batches else 1
    logger.info("批量识别：%d 段 -> %d 批（每批≤%d，并发 %d，档位 %s，按大块约束类型）",
                len(paragraphs), n_batches, batch_size, workers, tier or "(默认)")

    def _run(bi: int, block: str | None, chunk: list[dict]) -> list[dict]:
        logger.info("识别批 %d/%d [%s]（段 %d-%d）", bi + 1, n_batches,
                    BLOCK_LABELS.get(block, "全局"), chunk[0]["index"], chunk[-1]["index"])
        return _classify_batch(client, chunk, block)

    batch_results: list[list[dict] | None] = [None] * n_batches
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="ai-batch") as pool:
        futures = {pool.submit(_run, bi, block, chunk): bi
                   for bi, (block, chunk) in enumerate(tasks)}
        for fut in as_completed(futures):
            bi = futures[fut]
            block, chunk = tasks[bi]
            try:
                batch_results[bi] = fut.result()
            except AIFatalError:
                raise
            except Exception as e:
                fb = _default_type(block)
                logger.warning("批 %d/%d 失败，整批回退 %s: %s", bi + 1, n_batches, fb, e)
                batch_results[bi] = [{"index": it["index"], "type": fb,
                                      "confidence": 0.3, "reason": f"批识别失败: {e}"}
                                     for it in chunk]

    results: list[dict] = []
    for part in batch_results:
        if part:
            results.extend(part)
    return results


# 兼容可能存在的旧调用名
classify_paragraphs = classify_paragraphs_batch
