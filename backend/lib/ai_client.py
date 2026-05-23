"""
AI模型适配层 - 支持多种大模型API
backend/lib/ai_client.py

要点：
1. 先用强规则识别页眉页码、目录、固定标题、图表题注、关键词、参考文献标题、作者/指导老师等高确定性段落。
2. AI 只处理规则无法确定的模糊段落，降低 token 消耗和误判率。
   注意：h2/h3 二级三级标题、参考文献条目 一律交给 AI——它们与"1.5倍""10.1%""1. 首先…"
   这类正文/编号易混淆，强规则误判风险高。
3. 提示词针对呼伦贝尔学院本科论文结构优化，兼容封面/声明未完全剔除的情况。
4. 批量输入加入"上一段/下一段"真实文档上下文，提升边界判断稳定性。
5. 不再依赖模型自报 confidence，统一由规则置信度后处理计算。
6. 模型档位：首页可选 经济/标准/旗舰，映射到不同 provider+model。

环境变量：
- AI_PROVIDER: deepseek/qwen/zhipu/moonshot/claude/openai，默认 deepseek（未选档位时使用）
- AI_TIMEOUT: 请求超时秒数，默认 120
- AI_MAX_TOKENS: 单次输出 token 上限，默认 4096
- AI_BATCH_SIZE: AI 模糊段落批大小，默认 25
- AI_PARA_TRUNC: 当前段落截断长度，默认 220
- AI_CONTEXT_TRUNC: 上下文段落截断长度，默认 80
- AI_BATCH_CONCURRENCY: 并发批数，默认 3
- DEFAULT_TIER: 未指定档位时的默认档位，默认 standard
- TIER_{ECONOMY,STANDARD,FLAGSHIP}_PROVIDER / _MODEL: 覆盖各档位的模型映射
"""
from __future__ import annotations

import os
import re
import time
import json
import logging
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger("thesis.ai")

AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", 120))
AI_MAX_TOKENS = int(os.environ.get("AI_MAX_TOKENS", 4096))
BATCH_SIZE = int(os.environ.get("AI_BATCH_SIZE", 25))
PARA_TEXT_TRUNC = int(os.environ.get("AI_PARA_TRUNC", 220))
CONTEXT_TEXT_TRUNC = int(os.environ.get("AI_CONTEXT_TRUNC", 80))
AI_BATCH_CONCURRENCY = int(os.environ.get("AI_BATCH_CONCURRENCY", 3))
AI_RATE_LIMIT_RETRIES = int(os.environ.get("AI_RATE_LIMIT_RETRIES", 4))
AI_RATE_LIMIT_BACKOFF = float(os.environ.get("AI_RATE_LIMIT_BACKOFF", 2))

# 合法类型（应与 config/formats/hulunbeier_univ.json 的 paragraph_styles 对应）
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
    "cover",  # 旧版兼容：建议 parser 阶段尽量剔除封面/声明
]


# ============================================================
# 抽象基类 + 各模型实现
# ============================================================
class BaseAIClient(ABC):
    @abstractmethod
    def chat(self, system_prompt: str, user_message: str) -> str:
        ...


class _OpenAICompatClient(BaseAIClient):
    """所有 OpenAI 兼容协议的模型共用实现。"""
    base_url: str | None = None
    api_key_env: str | None = None
    model_env: str | None = None
    default_model: str | None = None

    def __init__(self):
        from openai import OpenAI

        if not self.api_key_env or not os.environ.get(self.api_key_env):
            raise AIFatalError(f"缺少环境变量 {self.api_key_env}")

        kwargs = {"api_key": os.environ[self.api_key_env], "timeout": AI_TIMEOUT}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        self.client = OpenAI(**kwargs)
        self.model = os.environ.get(self.model_env, self.default_model)

    def chat(self, system_prompt: str, user_message: str) -> str:
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
            max_tokens=AI_MAX_TOKENS,
            timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content or ""


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
            api_key=os.environ["ANTHROPIC_API_KEY"],
            timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

    def chat(self, system_prompt: str, user_message: str) -> str:
        m = self.client.messages.create(
            model=self.model,
            max_tokens=AI_MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=AI_TIMEOUT,
        )
        return m.content[0].text if m.content else ""


class AIFatalError(Exception):
    pass


# ============================================================
# 模型档位（首页选择：经济/标准/旗舰）
# 各档位映射到 provider + 具体 model，可用环境变量覆盖。
# 默认全部走 Moonshot（同一个 MOONSHOT_API_KEY 即可调用 8k/32k/128k），
# 不破坏现有部署；接入 deepseek/claude 等可改 TIER_*_PROVIDER / TIER_*_MODEL。
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


def get_ai_client(tier: str | None = None) -> BaseAIClient:
    """按档位返回对应模型客户端；tier 为空则回退到 AI_PROVIDER 环境变量。"""
    clients = {
        "deepseek": DeepSeekClient,
        "qwen": QwenClient,
        "zhipu": ZhipuClient,
        "moonshot": MoonshotClient,
        "claude": ClaudeClient,
        "openai": OpenAIClient,
    }
    model_override = None
    if tier and tier in MODEL_TIERS:
        provider = MODEL_TIERS[tier]["provider"].lower().strip()
        model_override = MODEL_TIERS[tier]["model"]
    else:
        provider = os.environ.get("AI_PROVIDER", "deepseek").lower().strip()
    if provider not in clients:
        raise ValueError(f"不支持的AI提供商: {provider}，可选: {list(clients.keys())}")
    client = clients[provider]()
    if model_override:
        client.model = model_override  # 档位指定的具体型号覆盖默认
    return client


# ============================================================
# 错误识别
# ============================================================
def _is_fatal_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in (
        "authentication", "api key", "apikey", "unauthorized", "401",
        "not found", "404", "invalid model", "model_not_found",
        "name or service not known", "connection refused", "ssl",
    ))


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(k in msg for k in (
        "429", "too many requests", "rate limit", "rate_limit", "concurrency",
    ))


# ============================================================
# 大块 -> 候选类型
# ============================================================
BLOCK_LABELS = {
    "toc": "目录",
    "abstract": "摘要",
    "body": "正文",
    "conclusion": "总结",
    "references": "参考文献",
}

BLOCK_TYPES = {
    "toc": ["toc_title", "toc_h1", "toc_h2", "toc_h3"],
    "abstract": [
        "paper_title", "author_line", "instructor",
        "abstract_title_cn", "abstract_body_cn", "keywords_cn",
        "abstract_title_en", "abstract_body_en", "keywords_en",
    ],
    "body": [
        "h1", "h2", "h3", "body", "numbered_item", "table_caption",
        "table", "formula", "formula_number", "figure_caption", "caption",
    ],
    "conclusion": ["conclusion_title", "conclusion_body"],
    "references": ["references_title", "reference_item", "ref"],
}

BLOCK_DEFAULT_TYPE = {
    "toc": "toc_h1",
    "abstract": "abstract_body_cn",
    "body": "body",
    "conclusion": "conclusion_body",
    "references": "reference_item",
}

TYPE_DESC = {
    "toc_title": '目录标题（"目录"两字）',
    "toc_h1": '目录一级条目（含章号，如"第 1 章 绪论 3"）',
    "toc_h2": '目录二级条目（如"1.1 研究背景 3"）',
    "toc_h3": '目录三级条目（如"3.1.1 经济可行性分析 7"）',
    "paper_title": "论文题目",
    "author_line": "作者信息（作者/姓名/学号/专业等）",
    "instructor": "指导老师/指导教师信息",
    "abstract_title_cn": '中文摘要标题（"摘要"）',
    "abstract_body_cn": "中文摘要正文",
    "keywords_cn": '中文关键词（"关键词："开头）',
    "abstract_title_en": '英文摘要标题（"Abstract"）',
    "abstract_body_en": "英文摘要正文",
    "keywords_en": '英文关键词（"Keywords:" 或 "Key words:" 开头）',
    "h1": '一级标题（"第 X 章 XXX"，或"总结/结论/附录"等章节级标题）',
    "h2": '二级标题（"1.1 XXX"）',
    "h3": '三级标题（"1.1.1 XXX"）',
    "body": "正文段落",
    "numbered_item": '数字编号条目（"1. xxx"/"1、xxx"）',
    "table_caption": '表说明（"表 3-1 xxx"/"表3.1 xxx"）',
    "table": "表格内容",
    "formula": "公式行",
    "formula_number": '单独的公式编号，如"(2-1)"',
    "figure_caption": '图说明（"图 3-1 xxx"/"图3.1 xxx"）',
    "caption": "通用图表题注（兼容旧类型）",
    "conclusion_title": '总结/结论标题（"总结"/"总 结"/"结论"）',
    "conclusion_body": "总结正文",
    "references_title": '参考文献标题（"参考文献"/"REFERENCES"）',
    "reference_item": "单条参考文献",
    "ref": "参考文献（兼容旧类型，新数据优先用 reference_item）",
    "cover": "封面、声明、日期、签名等非正文内容（建议前处理剔除）",
}


def _allowed_types(block: str | None) -> list[str]:
    # 无 block 时允许 cover，兼容 parser 未完全剔除封面/声明的情况。
    return BLOCK_TYPES.get(block) or list(VALID_TYPES)


def _default_type(block: str | None) -> str:
    return BLOCK_DEFAULT_TYPE.get(block, "body")


# ============================================================
# 正则与文本规范化
# ============================================================
_CH_NUM = "一二三四五六七八九十百零两"

_RE_PAGE_NUMBER = re.compile(r"^\d{1,3}$")
_RE_CHAPTER = re.compile(rf"^第\s*[{_CH_NUM}\d]+\s*章\s*\S*")
_RE_H2 = re.compile(r"^\d+\.\d+(?!\.\d)\s*\S+")
_RE_H3 = re.compile(r"^\d+\.\d+\.\d+\s*\S+")
_RE_NUMBERED = re.compile(r"^\d+\s*[.、]\s*\S+")
_RE_FORMULA_NUM = re.compile(r"^\(\s*\d+\s*[-—]\s*\d+\s*\)$")

_RE_FIG = re.compile(rf"^图\s*[\d{_CH_NUM}]")
_RE_TAB = re.compile(rf"^表\s*[\d{_CH_NUM}]")
_RE_FIGTAB = re.compile(rf"^[图表]\s*[\d{_CH_NUM}]")
# 题注：图/表 + 编号 + 空白 + 说明。避免把“图3-1所示”判成题注。
_RE_FIG_CAP = re.compile(rf"^图\s*[\d{_CH_NUM}]+(?:[-—.．][\d{_CH_NUM}]+)?[\s　]+\S+")
_RE_TAB_CAP = re.compile(rf"^表\s*[\d{_CH_NUM}]+(?:[-—.．][\d{_CH_NUM}]+)?[\s　]+\S+")

_RE_KW_CN = re.compile(r"^关键词\s*[:：]")
_RE_KW_EN = re.compile(r"^key\s*words?\s*[:：]", re.IGNORECASE)
_RE_AUTHOR = re.compile(r"^(作\s*者|姓\s*名|学\s*号|专\s*业)\s*[:：]?")
_RE_INSTRUCTOR = re.compile(r"^(指导教师|指导老师|指\s*导\s*教\s*师)\s*[:：]?")
_RE_REF = re.compile(r"^(\[\d+\]|\d+[.、\s])")
_RE_DATE = re.compile(r"^\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日$")
_RE_SIGNATURE = re.compile(r"(毕业论文作者|指导教师|本人郑重声明|原创性|知识产权|特此声明)")
_RE_END_PUNCT = re.compile(r"[。！？!?.]$")
_RE_SENT_PUNCT = re.compile(r"[。，；！？]")
_RE_PAGENUM_END = re.compile(r"\d{1,4}$")
_RE_DOT_LEADER = re.compile(r"[.．·。…]{2,}")
_RE_TOC_TITLE_WITH_PAGENUM = re.compile(r"^(.+?)\s+\d{1,4}$")
_TOC_H1_FIXED_NAMES = frozenset({
    "总结", "结论", "参考文献", "references",
    "附录", "致谢", "摘要", "abstract",
})

_FIXED_TITLE = {
    "toc_title": ("目录",),
    "abstract_title_cn": ("摘要",),
    "abstract_title_en": ("abstract",),
    "references_title": ("参考文献", "references"),
    "conclusion_title": ("总结", "结论"),
}


def _clean_text(text: str) -> str:
    return (text or "").strip().replace("　", " ")


def _compact(text: str) -> str:
    return re.sub(r"\s+", "", _clean_text(text)).lower()


def _is_probable_cover_or_statement(text: str) -> bool:
    """强判断封面/声明内容。注意：建议 parser 前处理阶段直接剔除。"""
    t = _clean_text(text)
    c = _compact(t)
    if not t:
        return False
    if _RE_DATE.match(t):
        return True
    if "本科生毕业论文" in c or "呼伦贝尔学院" in c:
        return True
    if _RE_SIGNATURE.search(t):
        return True
    if c in {"题目", "姓名", "学号", "专业", "指导教师"}:
        return True
    # 封面常见短行
    if len(t) <= 40 and any(k in c for k in ("题目", "姓名", "学号", "专业", "指导教师")):
        return True
    return False


def compute_rule_confidence(text: str, ptype: str) -> float:
    """根据文本特征与类型的吻合度返回 0.10~0.98 的置信度。"""
    t = _clean_text(text)
    c = _compact(t)
    n = len(t)

    if ptype in _FIXED_TITLE:
        return 0.97 if c in _FIXED_TITLE[ptype] else 0.25

    if ptype == "cover":
        return 0.92 if _is_probable_cover_or_statement(t) else 0.35

    score = 0.50
    if ptype == "h1":
        if _RE_CHAPTER.match(t):
            score += 0.45
        elif c in {"附录", "致谢"}:
            score += 0.35
        elif n <= 25 and not _RE_SENT_PUNCT.search(t):
            score += 0.15
        if _RE_SENT_PUNCT.search(t) and n > 40:
            score -= 0.50
        if _RE_FIGTAB.match(t):
            score -= 0.40
    elif ptype == "h2":
        if _RE_H2.match(t):
            score += 0.45
        if n <= 35:
            score += 0.10
        if n > 60:
            score -= 0.40
        if _RE_FIGTAB.match(t):
            score -= 0.35
    elif ptype == "h3":
        if _RE_H3.match(t):
            score += 0.45
        if n <= 40:
            score += 0.10
        if n > 70:
            score -= 0.40
    elif ptype == "figure_caption":
        if _RE_FIG_CAP.match(t) or _RE_FIG.match(t):
            score += 0.45
        if n <= 60:
            score += 0.10
        if _RE_TAB.match(t):
            score -= 0.45
    elif ptype == "table_caption":
        if _RE_TAB_CAP.match(t) or _RE_TAB.match(t):
            score += 0.45
        if n <= 60:
            score += 0.10
        if _RE_FIG.match(t):
            score -= 0.45
    elif ptype == "caption":
        if _RE_FIGTAB.match(t):
            score += 0.30
    elif ptype == "keywords_cn":
        score += 0.48 if _RE_KW_CN.match(t) else -0.25
        if n > 100:
            score -= 0.35
    elif ptype == "keywords_en":
        score += 0.48 if _RE_KW_EN.match(t) else -0.25
        if n > 140:
            score -= 0.35
    elif ptype == "numbered_item":
        score += 0.45 if _RE_NUMBERED.match(t) else -0.30
    elif ptype in ("reference_item", "ref"):
        if _RE_REF.match(t):
            score += 0.40
        if 20 <= n <= 350:
            score += 0.10
        if n < 10:
            score -= 0.30
    elif ptype == "formula_number":
        score += 0.48 if _RE_FORMULA_NUM.match(t) else -0.30
    elif ptype in ("toc_h1", "toc_h2", "toc_h3"):
        if _RE_DOT_LEADER.search(t) or _RE_PAGENUM_END.search(t):
            score += 0.30
        else:
            score -= 0.35
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
        if n <= 60 and not _RE_SENT_PUNCT.search(t):
            score += 0.25
        if n > 80:
            score -= 0.30
    elif ptype == "author_line":
        score = 0.85 if _RE_AUTHOR.match(t) else 0.55
    elif ptype == "instructor":
        score = 0.90 if _RE_INSTRUCTOR.match(t) else 0.55

    return max(0.10, min(0.98, score))


# ============================================================
# 强规则分类与纠错
# ============================================================
_OVERRIDE_FROM = {
    "h1", "h2", "h3", "body", "numbered_item", "caption",
    "abstract_body_cn", "abstract_body_en", "conclusion_body",
}


def _is_toc_like(text: str) -> bool:
    t = _clean_text(text)
    return bool(_RE_DOT_LEADER.search(t) or _RE_PAGENUM_END.search(t))


def _is_short_heading(text: str) -> bool:
    """短行 + 无句末/句中标点：用于把 1.1 / 1.1.1 这类编号标题与
    "1.5倍行距，…""10.1%的准确率。"这类数字开头的正文长句区分开。
    正文长句更长且含 。，；！？ 标点，会被排除。"""
    t = _clean_text(text)
    if not t or len(t) > 30:
        return False
    return not _RE_SENT_PUNCT.search(t)


def direct_rule_type(text: str, block: str | None = None) -> str | None:
    """
    高确定性规则直判。返回 None 表示交给 AI。
    刻意不直判：h2/h3（与"1.5倍""10.1%"等数字开头正文混淆）、
    无 block 的参考文献条目（与"1. 首先…"编号列表混淆）—— 这些交给 AI。
    """
    t = _clean_text(text)
    c = _compact(t)
    if not t:
        return None

    allowed = set(_allowed_types(block))

    # 封面/声明：只有在无 block 约束且 cover 允许时才直判，避免打破已分块结果。
    if block is None and "cover" in allowed and _is_probable_cover_or_statement(t):
        return "cover"

    # 单独页码不属于任何正式类型。为了不破坏现有配置，交给默认回退；建议 parser 预过滤。
    if _RE_PAGE_NUMBER.fullmatch(t):
        return None

    # 固定标题
    fixed = {
        "目录": "toc_title",
        "摘要": "abstract_title_cn",
        "abstract": "abstract_title_en",
        "参考文献": "references_title",
        "references": "references_title",
        "总结": "conclusion_title",
        "结论": "conclusion_title",
        "附录": "h1",
        "致谢": "h1",
    }
    if c in fixed and fixed[c] in allowed:
        return fixed[c]

    # 摘要区高确定性规则
    if _RE_KW_CN.match(t) and "keywords_cn" in allowed:
        return "keywords_cn"
    if _RE_KW_EN.match(t) and "keywords_en" in allowed:
        return "keywords_en"
    if _RE_INSTRUCTOR.match(t) and "instructor" in allowed:
        return "instructor"
    if _RE_AUTHOR.match(t) and "author_line" in allowed:
        return "author_line"

    # 图表题注优先于标题
    if len(t) <= 80 and _RE_FIG_CAP.match(t) and "figure_caption" in allowed:
        return "figure_caption"
    if len(t) <= 80 and _RE_TAB_CAP.match(t) and "table_caption" in allowed:
        return "table_caption"

    # 公式编号
    if _RE_FORMULA_NUM.match(t) and "formula_number" in allowed:
        return "formula_number"

    # 目录条目：目录 block 内优先判 toc；无 block 时只有明显页码/点线才判 toc。
    if (block == "toc" or (block is None and _is_toc_like(t))):
        if _RE_H3.match(t) and "toc_h3" in allowed:
            return "toc_h3"
        if _RE_H2.match(t) and "toc_h2" in allowed:
            return "toc_h2"
        if _RE_CHAPTER.match(t) and "toc_h1" in allowed:
            return "toc_h1"
        # 固定节标题 + 尾部页码，如"总结 33"、"参考文献 34"——是目录条目而非正文标题。
        m_toc = _RE_TOC_TITLE_WITH_PAGENUM.match(t)
        if m_toc and _compact(m_toc.group(1)) in _TOC_H1_FIXED_NAMES and "toc_h1" in allowed:
            return "toc_h1"
        # 在目录 block 内，无页码的固定节名（如单独的"总结"、"参考文献"）也归 toc_h1。
        if block == "toc" and c in _TOC_H1_FIXED_NAMES and "toc_h1" in allowed:
            return "toc_h1"

    # 正文标题。h1 用"第X章"锚点直判；h2/h3 仅在"短行 + 无句末标点"时直判，
    # 以排除"1.5倍行距，…""10.1%的准确率。"等数字开头的正文长句。
    if block in (None, "body"):
        if _RE_CHAPTER.match(t) and "h1" in allowed:
            return "h1"
        if _is_short_heading(t):
            if _RE_H3.match(t) and "h3" in allowed:
                return "h3"
            if _RE_H2.match(t) and "h2" in allowed:
                return "h2"

    # 总结、参考文献 block 规则（只判标题，条目交 AI）
    if block == "conclusion" and c in {"总结", "结论"} and "conclusion_title" in allowed:
        return "conclusion_title"
    if block == "references":
        if c in {"参考文献", "references"} and "references_title" in allowed:
            return "references_title"
        # references block 内可直判条目（已确定在文献区，不会与正文编号混淆）
        if _RE_REF.match(t) and "reference_item" in allowed:
            return "reference_item"

    # 注意：无 block 时不直判 reference_item（与"1. 首先…"编号列表难区分），交 AI。
    return None


def apply_pattern_override(text: str, ptype: str, block: str | None = None) -> str:
    """对极可靠的文本模式强制纠正 AI 误判。"""
    t = _clean_text(text)
    allowed = set(_allowed_types(block))

    # 先尝试强规则；若命中且在 allowed 中，则覆盖。
    rule_t = direct_rule_type(t, block)
    if rule_t and rule_t in allowed:
        return rule_t

    # 长且含句末标点的段落几乎不可能是标题：纠正 AI 把正文长句误判成 h1/h2/h3。
    if ptype in ("h1", "h2", "h3") and len(t) > 40 and _RE_SENT_PUNCT.search(t):
        if "body" in allowed:
            return "body"

    # 题注兜底：AI 常把图/表题注误判为标题/正文。
    if len(t) <= 80:
        if (ptype in _OVERRIDE_FROM or ptype == "table_caption") and _RE_FIG_CAP.match(t):
            if "figure_caption" in allowed:
                return "figure_caption"
        if (ptype in _OVERRIDE_FROM or ptype == "figure_caption") and _RE_TAB_CAP.match(t):
            if "table_caption" in allowed:
                return "table_caption"

    return ptype


# ============================================================
# 提示词
# ============================================================
def _append_type_list(lines: list[str], blocks: list[str]) -> None:
    for blk in blocks:
        lines.append(f"【{BLOCK_LABELS[blk]}】")
        for t in BLOCK_TYPES[blk]:
            lines.append(f"- {t}: {TYPE_DESC.get(t, t)}")
    lines.append("【其他/兼容】")
    lines.append(f"- cover: {TYPE_DESC['cover']}")


def _build_whole_doc_prompt() -> str:
    lines = [
        "你是呼伦贝尔学院本科毕业论文段落格式分类助手。",
        "任务：根据论文段落文本、上下文顺序和编号特征，对每个段落进行格式类型分类。",
        "",
        "重要背景：",
        "1. 输入可能包含封面、日期页、原创性及知识产权声明、目录、摘要、正文、总结、参考文献、附录。",
        "2. 如果封面和声明已被前处理删除，则输入通常从“目录”开始。",
        "3. 不要只根据关键词判断，要结合段落位置、前后段落和论文结构顺序。",
        "",
        "常见结构顺序：",
        "封面 → 日期/声明 → 目录 → 中文摘要 → 关键词 → 英文摘要 → Key words → 正文若干章 → 总结/结论 → 参考文献 → 附录",
        "",
        "核心判断规则：",
        "- 目录页通常包含点线或末尾页码，例如“第 1 章 绪论 3”“1.1 研究背景 3”，应标为 toc_*。",
        "- 正文中的章标题是 h1，例如“第 1 章 绪论”“第2章 系统开发技术”。注意“第”和数字、“章”之间可能有空格。",
        "- 正文中的二级标题是 h2，例如“1.1 研究背景”；三级标题是 h3，例如“3.1.1 经济可行性分析”。",
        "  注意：以数字小数开头但其实是正文的句子（如“1.5 倍行距”“10.1% 的准确率”）不是标题，应标为 body。",
        "- “摘要”单独成行是 abstract_title_cn；其后的中文长段落是 abstract_body_cn。",
        "- “关键词：……”是 keywords_cn。关键词通常是短词组，不是长句。",
        "- “Abstract”单独成行是 abstract_title_en；其后的英文长段落是 abstract_body_en。",
        "- “Key words:”或“Keywords:”开头的是 keywords_en。",
        "- 摘要前的论文题目、作者、指导老师分别标为 paper_title、author_line、instructor。",
        "- 以“图 3-1 管理员用例图”“图3.1 xxx”开头的独立短行是 figure_caption，不是 h3。",
        "- 以“表 4-1 xxx”“表4.1 xxx”开头的独立短行是 table_caption。",
        "- “参考文献”单独成行是 references_title；其后的 [1]、[2] 或作者年份文献条目标为 reference_item。",
        "  注意：正文里“1. 首先……”“2、然后……”这类编号步骤是 numbered_item，不是 reference_item。",
        "- “总 结”“总结”“结论”单独成行是 conclusion_title；其后的总结段落标为 conclusion_body。",
        "- “附 录”“附录”如果没有专用类型，按 h1 处理。",
        "",
        "严禁误判：",
        "- 长段落不要判为标题。",
        "- 图题、表题不要判为 h1/h2/h3。",
        "- 正文里的“图3-1所示”“表4-1所示”这种句内引用不是题注。",
        "- 目录条目不要判为正文标题。",
        "- 关键词行不要吞并后面的摘要正文。",
        "",
        "全部可用类型：",
    ]
    _append_type_list(lines, ["toc", "abstract", "body", "conclusion", "references"])
    lines += [
        "",
        "输出规则（极重要）：",
        "1. 只输出 JSON 数组，不要 markdown，不要解释。",
        "2. 元素数必须等于输入段落数，每段都必须输出。",
        '3. 每个元素格式：{"index": 数字, "type": "类型"}',
        "4. index 必须等于输入方括号中的编号。",
        "5. type 只能使用上面列出的类型，不得创造新类型。",
    ]
    return "\n".join(lines)


_WHOLE_DOC_SYSTEM_PROMPT = _build_whole_doc_prompt()


def _build_system_prompt(block: str | None) -> str:
    if block is None:
        return _WHOLE_DOC_SYSTEM_PROMPT

    types = _allowed_types(block)
    label = BLOCK_LABELS.get(block, "论文")
    lines = [
        f"你是呼伦贝尔学院本科毕业论文段落格式分类助手。下面这一批段落都来自论文的【{label}】部分。",
        f"请只在【{label}】允许的类型里给每段分类，输出 JSON 数组。",
        "",
        f"【{label}】允许的类型（只能从这些里选，不得使用其他类型）：",
    ]
    for t in types:
        lines.append(f"- {t}: {TYPE_DESC.get(t, t)}")

    # 分块提示的局部规则
    if block == "toc":
        lines += [
            "",
            "目录判断补充：",
            "- 单独“目录”是 toc_title。",
            "- 以“第 X 章”开头且带页码/点线的是 toc_h1。",
            "- 以“1.1”开头且带页码/点线的是 toc_h2。",
            "- 以“1.1.1”开头且带页码/点线的是 toc_h3。",
        ]
    elif block == "abstract":
        lines += [
            "",
            "摘要判断补充：",
            "- “摘要”是 abstract_title_cn；“Abstract”是 abstract_title_en。",
            "- 关键词行是 keywords_cn/keywords_en。",
            "- 长段落是 abstract_body_cn 或 abstract_body_en，不要误判为关键词。",
        ]
    elif block == "body":
        lines += [
            "",
            "正文判断补充：",
            "- “第 1 章 绪论”这类是 h1。",
            "- “1.1 XXX”是 h2；“1.1.1 XXX”是 h3；但“1.5 倍”“10.1%”这类数字开头正文是 body。",
            "- “图 3-1 XXX”是 figure_caption；“表 3-1 XXX”是 table_caption。",
            "- “1. 首先……”“2、其次……”这类编号步骤是 numbered_item。",
            "- 普通长段落是 body。",
        ]
    elif block == "conclusion":
        lines += ["", "总结判断补充：单独“总结/总 结/结论”是 conclusion_title，其余总结段落是 conclusion_body。"]
    elif block == "references":
        lines += ["", "参考文献判断补充：单独“参考文献”是 references_title；文献条目是 reference_item。"]

    lines += [
        "",
        "输出规则（极重要）：",
        "1. 只输出 JSON 数组，不要 markdown，不要解释。",
        "2. 元素数必须等于输入段落数，每段都分类。",
        '3. 每元素格式：{"index": 数字, "type": "类型"}',
        "4. index 必须精确等于输入方括号中的编号。",
        "5. type 只能是上面列出的类型，绝不允许其他值。",
    ]
    return "\n".join(lines)


def _clip_text(text: str, limit: int) -> str:
    t = _clean_text(text).replace("\n", " ")
    t = re.sub(r"\s+", " ", t)
    if len(t) > limit:
        return t[:limit] + "..."
    return t


def _build_batch_user_message(items: list[dict]) -> str:
    """每段附带"上一段/下一段"真实文档上下文（由 _classify_batch 预挂在 _prev_ctx/_next_ctx）。"""
    lines = [
        "请识别以下段落的类型。每段包含上一段/当前段/下一段上下文。",
        "只需要给“当前段”分类；上一段和下一段仅用于判断上下文。",
        "只输出 JSON 数组：",
        "",
    ]
    for it in items:
        lines.append(f"[{it['index']}]")
        lines.append(f"上一段: {_clip_text(it.get('_prev_ctx', ''), CONTEXT_TEXT_TRUNC)}")
        lines.append(f"当前段: {_clip_text(it.get('text', '') or '', PARA_TEXT_TRUNC)}")
        lines.append(f"下一段: {_clip_text(it.get('_next_ctx', ''), CONTEXT_TEXT_TRUNC)}")
        lines.append("")

    lines += ["输出格式：", '[{"index":N,"type":"xxx"}, ...]']
    return "\n".join(lines)


# ============================================================
# AI 调用与解析
# ============================================================
def _extract_json_array(text: str) -> list:
    if not text:
        raise ValueError("空响应")
    raw = text.strip()
    if raw.startswith("```"):
        m = re.search(r"```(?:json)?\s*(.+?)```", raw, re.DOTALL | re.IGNORECASE)
        if m:
            raw = m.group(1).strip()
    if not raw.startswith("["):
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if m:
            raw = m.group(0)
    arr = json.loads(raw)
    if not isinstance(arr, list):
        raise ValueError("响应不是 JSON 数组")
    return arr


def _chat_with_retry(client: BaseAIClient, system_prompt: str, user_msg: str) -> str:
    delay = AI_RATE_LIMIT_BACKOFF
    for attempt in range(AI_RATE_LIMIT_RETRIES + 1):
        try:
            return client.chat(system_prompt, user_msg)
        except Exception as e:
            if isinstance(e, AIFatalError) or _is_fatal_error(e):
                raise AIFatalError(f"AI服务不可用: {e}") from e
            if _is_rate_limit(e) and attempt < AI_RATE_LIMIT_RETRIES:
                logger.warning("限流(429)，%.0fs 后重试 (%d/%d)",
                               delay, attempt + 1, AI_RATE_LIMIT_RETRIES)
                time.sleep(delay)
                delay *= 2
                continue
            raise


def _coverage(arr: list | None, items: list[dict]) -> int:
    if not arr:
        return 0
    want = {it["index"] for it in items}
    got = {e.get("index") for e in arr if isinstance(e, dict)}
    return len(want & got)


def _fallback_item(it: dict, block: str | None, reason: str) -> dict:
    t = _default_type(block)
    if _RE_PAGE_NUMBER.fullmatch(_clean_text(it.get("text", ""))):
        reason = reason + "；疑似单独页码，建议在 parser 阶段过滤"
    return {
        "index": it["index"],
        "type": t,
        "confidence": 0.30,
        "reason": reason,
    }


def _rule_result(it: dict, block: str | None, ptype: str) -> dict:
    return {
        "index": it["index"],
        "type": ptype,
        "confidence": compute_rule_confidence(it.get("text", ""), ptype),
        "reason": "strong_rule",
    }


def _classify_batch(client: BaseAIClient, items: list[dict], block: str | None,
                    depth: int = 0) -> list[dict]:
    """
    单批分类：强规则先判，剩余模糊段落再调用 AI。
    给模糊段落挂上"真实文档相邻段"上下文（_prev_ctx/_next_ctx），二分递归时保持不变。
    """
    if not items:
        return []

    allowed = set(_allowed_types(block))
    direct_results: dict[int, dict] = {}
    uncertain_items: list[dict] = []

    for i, it in enumerate(items):
        ptype = direct_rule_type(it.get("text", ""), block)
        if ptype and ptype in allowed:
            direct_results[it["index"]] = _rule_result(it, block, ptype)
        else:
            # 复制并挂上真实相邻段文本作为上下文；setdefault 保证二分递归时不被子序列覆盖。
            ctx_it = dict(it)
            ctx_it.setdefault("_prev_ctx", items[i - 1].get("text", "") if i > 0 else "")
            ctx_it.setdefault("_next_ctx", items[i + 1].get("text", "") if i + 1 < len(items) else "")
            uncertain_items.append(ctx_it)

    # 全部被强规则解决，不调用 AI。
    if not uncertain_items:
        return [direct_results[it["index"]] for it in items]

    user_msg = _build_batch_user_message(uncertain_items)
    response = _chat_with_retry(client, _build_system_prompt(block), user_msg)

    fallback = _default_type(block)
    text_by_idx = {it["index"]: it.get("text", "") for it in uncertain_items}

    arr = None
    parse_err = None
    try:
        arr = _extract_json_array(response)
    except Exception as e:
        parse_err = e

    covered = _coverage(arr, uncertain_items) if arr else 0
    if (arr is None or covered < len(uncertain_items) * 0.80) and len(uncertain_items) > 3 and depth < 3:
        mid = len(uncertain_items) // 2
        logger.warning("批输出疑似截断/不全（命中 %d/%d），二分重试 depth=%d",
                       covered, len(uncertain_items), depth)
        left = _classify_batch(client, uncertain_items[:mid], block, depth + 1)
        right = _classify_batch(client, uncertain_items[mid:], block, depth + 1)
        merged = {r["index"]: r for r in (left + right)}
        merged.update(direct_results)
        return [merged.get(it["index"], _fallback_item(it, block, "二分重试后仍未返回")) for it in items]

    ai_results: dict[int, dict] = {}
    if arr is None:
        logger.warning("批响应解析失败，整批回退 %s: %s | %s",
                       fallback, parse_err, (response or "")[:200])
        for it in uncertain_items:
            ai_results[it["index"]] = _fallback_item(it, block, f"批响应解析失败: {parse_err}")
    else:
        for entry in arr:
            if not isinstance(entry, dict):
                continue
            idx = entry.get("index")
            if not isinstance(idx, int) or idx not in text_by_idx:
                continue

            ptype = entry.get("type", fallback)
            if ptype not in allowed:
                ptype = fallback

            txt = text_by_idx.get(idx, "")
            ptype = apply_pattern_override(txt, ptype, block)
            if ptype not in allowed:
                ptype = fallback

            ai_results[idx] = {
                "index": idx,
                "type": ptype,
                "confidence": compute_rule_confidence(txt, ptype),
                "reason": entry.get("reason", "ai_with_rule_confidence"),
            }

        for it in uncertain_items:
            if it["index"] not in ai_results:
                ai_results[it["index"]] = _fallback_item(it, block, "AI未返回该段索引")

    merged: dict[int, dict] = {}
    merged.update(ai_results)
    merged.update(direct_results)
    return [merged.get(it["index"], _fallback_item(it, block, "未知缺失")) for it in items]


# ============================================================
# 对外批量接口
# ============================================================
def _split_into_batches(paragraphs: list[dict], batch_size: int) -> list[tuple[str | None, list[dict]]]:
    """按大块切成连续段，再按 batch_size 分批。每批同属一个大块。"""
    segments: list[tuple[str | None, list[dict]]] = []
    cur_block: object = object()
    seg: list[dict] = []

    for p in paragraphs:
        b = p.get("block")
        if b != cur_block:
            if seg:
                segments.append((cur_block if isinstance(cur_block, str) else None, seg))
            cur_block, seg = b, [p]
        else:
            seg.append(p)

    if seg:
        segments.append((cur_block if isinstance(cur_block, str) else None, seg))

    tasks: list[tuple[str | None, list[dict]]] = []
    for block, items in segments:
        for i in range(0, len(items), batch_size):
            tasks.append((block, items[i:i + batch_size]))
    return tasks


# ============================================================
# 旗舰版：全文语义识别（不走强规则，整篇投喂 AI）
# ============================================================
FLAGSHIP_CHUNK_SIZE = int(os.environ.get("AI_FLAGSHIP_CHUNK", 150))


def _build_full_doc_user_message(paragraphs: list[dict]) -> str:
    """旗舰版：将所有段落按顺序列出，让 AI 基于整体结构做语义识别。"""
    lines = [
        "请对下列论文全文段落全部分类。这是论文的所有段落，按原始顺序排列。",
        "请根据整体文档结构、段落在全文中的位置和语义，判断每个段落的类型。",
        "只输出 JSON 数组，不要解释。",
        "",
    ]
    for p in paragraphs:
        text = _clip_text(p.get("text", "") or "", PARA_TEXT_TRUNC)
        lines.append(f"[{p['index']}] {text}")
    lines += ["", "输出格式：", '[{"index":N,"type":"xxx"}, ...]']
    return "\n".join(lines)


def _classify_full_doc(client: BaseAIClient, paragraphs: list[dict]) -> list[dict]:
    """
    旗舰版全文语义识别：跳过所有强规则，把所有段落发给 AI 做整体语义分类。
    若段落数超过 FLAGSHIP_CHUNK_SIZE，按顺序分块（每块仍用全文提示词）。
    块内覆盖不足时递归二分重试。
    """
    if not paragraphs:
        return []

    allowed = set(VALID_TYPES)

    def _process_arr(arr: list, chunk: list[dict]) -> list[dict]:
        text_by_idx = {p["index"]: p.get("text", "") for p in chunk}
        results: dict[int, dict] = {}
        for entry in arr:
            if not isinstance(entry, dict):
                continue
            idx = entry.get("index")
            if not isinstance(idx, int) or idx not in text_by_idx:
                continue
            ptype = entry.get("type", "body")
            if ptype not in allowed:
                ptype = "body"
            txt = text_by_idx[idx]
            ptype = apply_pattern_override(txt, ptype, None)
            if ptype not in allowed:
                ptype = "body"
            results[idx] = {
                "index": idx,
                "type": ptype,
                "confidence": compute_rule_confidence(txt, ptype),
                "reason": "flagship_full_doc",
            }
        for p in chunk:
            if p["index"] not in results:
                results[p["index"]] = _fallback_item(p, None, "旗舰版AI未返回该段")
        return [results[p["index"]] for p in chunk]

    def _call_chunk(chunk: list[dict], depth: int = 0) -> list[dict]:
        user_msg = _build_full_doc_user_message(chunk)
        arr = None
        try:
            resp = _chat_with_retry(client, _WHOLE_DOC_SYSTEM_PROMPT, user_msg)
            arr = _extract_json_array(resp)
        except Exception as e:
            logger.warning("旗舰版识别批失败 (depth=%d): %s", depth, e)
        if arr and _coverage(arr, chunk) >= len(chunk) * 0.80:
            return _process_arr(arr, chunk)
        if len(chunk) > 3 and depth < 3:
            mid = len(chunk) // 2
            logger.warning("旗舰版覆盖不足，二分重试（%d 段，depth=%d）", len(chunk), depth)
            return _call_chunk(chunk[:mid], depth + 1) + _call_chunk(chunk[mid:], depth + 1)
        return [_fallback_item(p, None, "旗舰版识别覆盖不足") for p in chunk]

    logger.info("旗舰版全文语义识别：%d 段，块大小 %d（无强规则）", len(paragraphs), FLAGSHIP_CHUNK_SIZE)
    results: list[dict] = []
    for i in range(0, len(paragraphs), FLAGSHIP_CHUNK_SIZE):
        chunk = paragraphs[i:i + FLAGSHIP_CHUNK_SIZE]
        results.extend(_call_chunk(chunk))
    return results


def classify_paragraphs_batch(paragraphs: list[dict], batch_size: int | None = None,
                              tier: str | None = None) -> list[dict]:
    """
    分块批量识别。

    参数：
        paragraphs: [{"index": int, "text": str, "block"?: str}, ...]
            block 由 parser 预扫描得出，可为 toc/abstract/body/conclusion/references；
            缺省时不约束类型，退化为全类型识别。
        batch_size: AI 模糊段落批大小；None 时使用环境变量 AI_BATCH_SIZE。
        tier: 模型档位（economy/standard/flagship）；None 时回退 AI_PROVIDER。

    返回：
        [{"index": int, "type": str, "confidence": float, "reason": str}, ...]
    """
    if not paragraphs:
        return []

    # 旗舰版：跳过所有强规则，整篇投喂 AI 做语义识别。
    if tier == "flagship":
        client = get_ai_client(tier)
        return _classify_full_doc(client, paragraphs)

    # 先看是否全部可由强规则解决；如果是，则完全不初始化 AI client，避免没配 API key 时失败。
    all_direct = True
    for p in paragraphs:
        rt = direct_rule_type(p.get("text", ""), p.get("block"))
        if not rt or rt not in set(_allowed_types(p.get("block"))):
            all_direct = False
            break

    if all_direct:
        return [_rule_result(p, p.get("block"), direct_rule_type(p.get("text", ""), p.get("block")))
                for p in paragraphs]

    client = get_ai_client(tier)
    batch_size = batch_size or BATCH_SIZE
    tasks = _split_into_batches(paragraphs, batch_size)
    n_batches = len(tasks)
    workers = min(AI_BATCH_CONCURRENCY, n_batches) if n_batches else 1

    logger.info("批量识别：%d 段 -> %d 批（每批≤%d，并发 %d，档位 %s，强规则+AI模糊识别）",
                len(paragraphs), n_batches, batch_size, workers, tier or "(默认)")

    def _run(bi: int, block: str | None, chunk: list[dict]) -> list[dict]:
        logger.info("识别批 %d/%d [%s]（段 %d-%d）",
                    bi + 1, n_batches, BLOCK_LABELS.get(block, "全局"),
                    chunk[0]["index"], chunk[-1]["index"])
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
                batch_results[bi] = [_fallback_item(it, block, f"批识别失败: {e}") for it in chunk]

    results: list[dict] = []
    for part in batch_results:
        if part:
            results.extend(part)
    return results


# 兼容可能存在的旧调用名
classify_paragraphs = classify_paragraphs_batch
