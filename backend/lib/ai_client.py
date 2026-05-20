"""
AI模型适配层 - 支持多种大模型API
backend/lib/ai_client.py

切换模型只改环境变量 AI_PROVIDER，业务代码不动。
段落识别采用「批量识别」：N 段 -> ceil(N/BATCH_SIZE) 次 API 调用。
"""
import os
import re
import json
import logging
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger("thesis.ai")

AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", 30))
BATCH_SIZE = int(os.environ.get("AI_BATCH_SIZE", 25))
PARA_TEXT_TRUNC = int(os.environ.get("AI_PARA_TRUNC", 300))
# 并发批数上限：所有批同时发会让总耗时≈单批耗时，但要限流避免触发模型 RPM 限制
AI_BATCH_CONCURRENCY = int(os.environ.get("AI_BATCH_CONCURRENCY", 11))

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
    return any(k in msg for k in (
        "authentication", "api key", "apikey", "unauthorized", "401",
        "not found", "404", "invalid model",
        "name or service not known", "connection refused", "ssl",
    ))


# ============================================================
# 批量识别
# ============================================================
BATCH_SYSTEM_PROMPT = """你是学术论文段落格式分类助手。

收到段落列表后，对每段判断它属于哪种类型，输出JSON数组。

支持的段落类型：

【目录】
- toc_title: 目录标题（"目录"）
- toc_h1: 目录一级条目（含章号）
- toc_h2: 目录二级条目（含1.1）
- toc_h3: 目录三级条目（含1.1.1）

【摘要】
- paper_title: 论文题目
- author_line: 作者信息
- instructor: 指导老师
- abstract_title_cn: 中文摘要标题（"摘要"）
- abstract_body_cn: 中文摘要正文
- keywords_cn: 中文关键词（"关键词"开头）
- abstract_title_en: Abstract 标题
- abstract_body_en: 英文摘要正文
- keywords_en: 英文关键词（"Keywords"开头）

【正文】
- h1: 一级标题（"第X章 XXX"）
- h2: 二级标题（"1.1 XXX"）
- h3: 三级标题（"1.1.1 XXX"）
- body: 正文段落
- numbered_item: 数字编号条目（"1. xxx"/"1、xxx"）
- table_caption: 表说明（"表X-X xxx"）
- table: 表格内容
- formula: 公式行
- formula_number: 单独的公式编号"(2-1)"
- figure_caption: 图说明（"图X-X xxx"）
- caption: 通用图表题注（兼容）

【总结】
- conclusion_title: 总结标题（"总结"）
- conclusion_body: 总结正文

【参考文献】
- references_title: 参考文献标题（"参考文献"/"REFERENCES"）
- reference_item: 单条参考文献
- ref: 参考文献（兼容，新数据用 reference_item）

输出规则（极重要）：
1. 只输出JSON数组，不要markdown标记、不要解释
2. 元素数必须等于输入段落数，每段都分类
3. 每元素格式：{"index": 数字, "type": "类型", "confidence": 0~1小数}
4. index 必须精确等于输入方括号中的编号
5. 不允许产出未列出的类型"""


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


def _classify_batch(client: BaseAIClient, items: list[dict]) -> list[dict]:
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
        logger.warning("批响应解析失败，整批回退 body: %s | %s", e, (response or "")[:200])
        return [{"index": it["index"], "type": "body", "confidence": 0.3,
                 "reason": f"批响应解析失败: {e}"} for it in items]

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
        try:
            conf = max(0.0, min(1.0, float(entry.get("confidence", 0.5))))
        except Exception:
            conf = 0.5
        seen[idx] = {"index": idx, "type": t, "confidence": conf,
                     "reason": entry.get("reason", "")}

    out = []
    for it in items:
        if it["index"] in seen:
            out.append(seen[it["index"]])
        else:
            out.append({"index": it["index"], "type": "body",
                        "confidence": 0.3, "reason": "AI未返回该段索引"})
    return out


def classify_paragraphs_batch(paragraphs: list[dict], batch_size: int = None) -> list[dict]:
    """
    批量识别。
    paragraphs: [{"index": int, "text": str}, ...]（仅非空段落）
    返回: [{"index": int, "type": str, "confidence": float, "reason": str}, ...]
    """
    if not paragraphs:
        return []

    client = get_ai_client()
    batch_size = batch_size or BATCH_SIZE
    total = len(paragraphs)
    chunks = [paragraphs[i:i + batch_size] for i in range(0, total, batch_size)]
    n_batches = len(chunks)
    workers = min(AI_BATCH_CONCURRENCY, n_batches)
    logger.info("批量识别：%d 段 -> %d 批（每批≤%d，并发 %d）",
                total, n_batches, batch_size, workers)

    def _run(bi: int, chunk: list[dict]) -> list[dict]:
        logger.info("识别批 %d/%d（段 %d-%d）",
                    bi + 1, n_batches, chunk[0]["index"], chunk[-1]["index"])
        return _classify_batch(client, chunk)

    batch_results: list[list[dict] | None] = [None] * n_batches
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="ai-batch") as pool:
        futures = {pool.submit(_run, bi, chunk): bi for bi, chunk in enumerate(chunks)}
        for fut in as_completed(futures):
            bi = futures[fut]
            try:
                batch_results[bi] = fut.result()
            except AIFatalError:
                raise
            except Exception as e:
                logger.warning("批 %d/%d 失败，整批回退 body: %s", bi + 1, n_batches, e)
                batch_results[bi] = [{"index": it["index"], "type": "body",
                                      "confidence": 0.3, "reason": f"批识别失败: {e}"}
                                     for it in chunks[bi]]

    results: list[dict] = []
    for part in batch_results:
        results.extend(part)
    return results
