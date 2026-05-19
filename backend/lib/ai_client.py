"""
AI模型适配层 - 支持多种大模型API
backend/lib/ai_client.py

v2: 段落识别由"逐段调用 N 次"改为"批量调用，每批 BATCH_SIZE 段"。
"""

import os
import json
import re
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("thesis.ai")

# ============================================================
# 全局配置
# ============================================================
AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", 30))
# 批量识别：每次API调用包含的段落数。moonshot-v1-8k 单批 25 段比较安全。
BATCH_SIZE = int(os.environ.get("AI_BATCH_SIZE", 25))
# 每段送入AI时最多截取的字符数（用于在batch里压缩token）
PARA_TEXT_TRUNC = int(os.environ.get("AI_PARA_TRUNC", 300))

# 所有合法类型（必须与 hulunbeier_univ.json 的 paragraph_styles 对应）
VALID_TYPES = [
    # toc
    "toc_title", "toc_h1", "toc_h2", "toc_h3",
    # abstract
    "paper_title", "author_line", "instructor",
    "abstract_title_cn", "abstract_body_cn", "keywords_cn",
    "abstract_title_en", "abstract_body_en", "keywords_en",
    # body
    "h1", "h2", "h3", "body", "numbered_item",
    "table_caption", "table", "formula", "formula_number",
    "figure_caption", "caption",
    # conclusion
    "conclusion_title", "conclusion_body",
    # references
    "references_title", "reference_item", "ref",
    # legacy（后端兼容，AI 不应主动产出）
    "cover",
]


# ============================================================
# 抽象基类
# ============================================================
class BaseAIClient(ABC):
    @abstractmethod
    def chat(self, system_prompt: str, user_message: str) -> str:
        pass


class DeepSeekClient(BaseAIClient):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com",
            timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

    def chat(self, system_prompt, user_message):
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
            temperature=0.1, timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content


class QwenClient(BaseAIClient):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["QWEN_API_KEY"],
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("QWEN_MODEL", "qwen-plus")

    def chat(self, system_prompt, user_message):
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
            temperature=0.1, timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content


class ZhipuClient(BaseAIClient):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["ZHIPU_API_KEY"],
            base_url="https://open.bigmodel.cn/api/paas/v4",
            timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("ZHIPU_MODEL", "glm-4-flash")

    def chat(self, system_prompt, user_message):
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
            temperature=0.1, timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content


class MoonshotClient(BaseAIClient):
    """月之暗面 Kimi - 默认模型 moonshot-v1-8k"""
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["MOONSHOT_API_KEY"],
            base_url="https://api.moonshot.cn/v1",
            timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("MOONSHOT_MODEL", "moonshot-v1-8k")

    def chat(self, system_prompt, user_message):
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
            temperature=0.1, timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content


class ClaudeClient(BaseAIClient):
    def __init__(self):
        import anthropic
        self.client = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"], timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

    def chat(self, system_prompt, user_message):
        m = self.client.messages.create(
            model=self.model, max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            timeout=AI_TIMEOUT,
        )
        return m.content[0].text


class OpenAIClient(BaseAIClient):
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(
            api_key=os.environ["OPENAI_API_KEY"], timeout=AI_TIMEOUT,
        )
        self.model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    def chat(self, system_prompt, user_message):
        r = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_message}],
            temperature=0.1, timeout=AI_TIMEOUT,
        )
        return r.choices[0].message.content


def get_ai_client() -> BaseAIClient:
    provider = os.environ.get("AI_PROVIDER", "deepseek").lower()
    clients = {
        "deepseek": DeepSeekClient, "qwen": QwenClient,
        "zhipu": ZhipuClient, "moonshot": MoonshotClient,
        "claude": ClaudeClient, "openai": OpenAIClient,
    }
    if provider not in clients:
        raise ValueError(f"不支持的AI提供商: {provider}，可选: {list(clients.keys())}")
    return clients[provider]()


# ============================================================
# 致命错误识别
# ============================================================
class AIFatalError(Exception):
    pass


def _is_fatal_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    fatal_keywords = (
        "authentication", "api key", "apikey", "unauthorized", "401",
        "not found", "404", "invalid model",
        "name or service not known", "connection refused", "ssl",
    )
    return any(k in msg for k in fatal_keywords)


# ============================================================
# 批量识别 prompt
# ============================================================
BATCH_SYSTEM_PROMPT = """你是学术论文段落格式分类助手。

收到段落列表后，对每段判断它属于哪种类型，输出JSON数组。

支持的段落类型：

【目录】
- toc_title: 目录标题（"目录"/"目  录"）
- toc_h1: 目录中的一级条目（含章号）
- toc_h2: 目录中的二级条目（含1.1）
- toc_h3: 目录中的三级条目（含1.1.1）

【摘要】
- paper_title: 论文题目
- author_line: 作者信息（含"姓名:"/"学号:"/班级等）
- instructor: 指导老师
- abstract_title_cn: 中文摘要标题（"摘要"）
- abstract_body_cn: 中文摘要正文
- keywords_cn: 中文关键词（以"关键词"开头）
- abstract_title_en: Abstract 标题
- abstract_body_en: 英文摘要正文
- keywords_en: 英文关键词（以"Keywords"开头）

【正文】
- h1: 一级标题（"第X章 XXX"）
- h2: 二级标题（"1.1 XXX"）
- h3: 三级标题（"1.1.1 XXX"）
- body: 正文段落
- numbered_item: 数字编号条目（"1. xxx"/"1、xxx"）
- table_caption: 表说明（"表X-X xxx"）
- table: 表格内容（极少作为段落出现，通常表格在表对象中）
- formula: 公式行
- formula_number: 单独的公式编号"(2-1)"
- figure_caption: 图说明（"图X-X xxx"）
- caption: 通用图表题注（兼容旧类型）

【总结】
- conclusion_title: 总结标题（"总结"/"总  结"）
- conclusion_body: 总结正文

【参考文献】
- references_title: 参考文献标题（"参考文献"/"REFERENCES"）
- reference_item: 单条参考文献条目
- ref: 参考文献（兼容旧类型，新数据请用 reference_item）

输出规则（极重要）：
1. 严格输出JSON数组，不要markdown标记，不要解释文字
2. 数组元素数必须等于输入段落数，每段都要分类
3. 每个元素格式：{"index": 数字, "type": "类型字符串", "confidence": 0~1的小数}
4. index 必须精确等于输入中给出的段落编号
5. 不允许产出未在上面列出的类型"""


def _build_batch_user_message(items: list[dict]) -> str:
    """items: [{'index': int, 'text': str}, ...]"""
    lines = ["请识别以下段落的类型。只输出JSON数组：", ""]
    for it in items:
        text = (it.get("text") or "").strip().replace("\n", " ")
        if len(text) > PARA_TEXT_TRUNC:
            text = text[:PARA_TEXT_TRUNC] + "..."
        lines.append(f"[{it['index']}] {text}")
    lines.append("")
    lines.append("输出格式（注意index对应上面的方括号编号）：")
    lines.append('[{"index":N,"type":"xxx","confidence":0.95}, ...]')
    return "\n".join(lines)


def _extract_json_array(text: str) -> list:
    """从模型响应中尽力提取一个JSON数组"""
    if not text:
        raise ValueError("空响应")
    text = text.strip()
    # 剥离 markdown 代码块
    if text.startswith("```"):
        m = re.search(r'```(?:json)?\s*(.+?)```', text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    # 找第一个 [ ... ] 的范围
    if not text.startswith("["):
        m = re.search(r'\[.*\]', text, re.DOTALL)
        if m:
            text = m.group(0)
    return json.loads(text)


def _classify_batch_with_client(client: BaseAIClient, items: list[dict]) -> list[dict]:
    """对一批段落（已经截好块）发起一次AI调用，返回 [{index, type, confidence, reason}]"""
    user_msg = _build_batch_user_message(items)
    try:
        response = client.chat(BATCH_SYSTEM_PROMPT, user_msg)
    except Exception as e:
        if _is_fatal_error(e):
            raise AIFatalError(f"AI服务不可用: {e}") from e
        raise

    try:
        arr = _extract_json_array(response)
    except Exception as e:
        # 整批解析失败 → 全部回退为 body 低置信
        logger.warning("批量响应解析失败，整批回退为 body: %s | 响应=%s", e, response[:200])
        return [
            {"index": it["index"], "type": "body", "confidence": 0.3,
             "reason": f"批响应解析失败: {e}"}
            for it in items
        ]

    # 索引去重 + 校验
    seen: dict[int, dict] = {}
    for entry in arr:
        if not isinstance(entry, dict):
            continue
        idx = entry.get("index")
        if not isinstance(idx, int):
            continue
        t = entry.get("type", "body")
        if t not in VALID_TYPES:
            t = "body"
        conf = entry.get("confidence", 0.5)
        try:
            conf = float(conf)
        except Exception:
            conf = 0.5
        conf = max(0.0, min(1.0, conf))
        seen[idx] = {"index": idx, "type": t, "confidence": conf,
                     "reason": entry.get("reason", "")}

    # 对缺失的段落兜底为 body 低置信
    results = []
    for it in items:
        if it["index"] in seen:
            results.append(seen[it["index"]])
        else:
            results.append({
                "index": it["index"], "type": "body",
                "confidence": 0.3, "reason": "AI未返回该段索引",
            })
    return results


def classify_paragraphs_batch(paragraphs: list[dict], batch_size: int = None) -> list[dict]:
    """
    批量识别。
    paragraphs: [{"index": int, "text": str}, ...]  (仅非空段落)
    返回: [{"index": int, "type": str, "confidence": float, "reason": str}, ...]

    一次最多发送 batch_size 段；对长论文自动分批。
    """
    if not paragraphs:
        return []

    client = get_ai_client()
    batch_size = batch_size or BATCH_SIZE

    all_results: list[dict] = []
    total = len(paragraphs)
    n_batches = (total + batch_size - 1) // batch_size
    logger.info("批量识别：%d 段 → %d 批 (每批最多 %d 段)", total, n_batches, batch_size)

    for bi in range(n_batches):
        chunk = paragraphs[bi * batch_size:(bi + 1) * batch_size]
        logger.info("正在识别批 %d/%d (段落 %d-%d)",
                    bi + 1, n_batches, chunk[0]["index"], chunk[-1]["index"])
        try:
            batch_result = _classify_batch_with_client(client, chunk)
        except AIFatalError:
            raise
        except Exception as e:
            logger.warning("批 %d/%d 失败，整批回退为 body: %s", bi + 1, n_batches, e)
            batch_result = [
                {"index": it["index"], "type": "body", "confidence": 0.3,
                 "reason": f"批识别失败: {e}"}
                for it in chunk
            ]
        all_results.extend(batch_result)

    return all_results


# ============================================================
# 旧接口兼容（保留单段识别，仅供测试和回退）
# ============================================================
def classify_paragraphs(paragraphs: list[dict]) -> list[dict]:
    """旧接口：内部直接调批量版本"""
    non_empty = [p for p in paragraphs if (p.get("text") or "").strip()]
    classified = classify_paragraphs_batch(non_empty)
    cmap = {c["index"]: c for c in classified}
    out = []
    for p in paragraphs:
        if (p.get("text") or "").strip() and p["index"] in cmap:
            out.append({**p, **cmap[p["index"]]})
        else:
            out.append({**p, "type": "body", "confidence": 1.0, "reason": "空段落"})
    return out
