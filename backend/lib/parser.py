"""
.docx 文档解析模块
backend/lib/parser.py

用 mammoth 提取原始文本 -> 切分为段落（一段不漏）
-> 预扫描定位「目录」标题，其之前的封面/声明整体跳过
-> 从目录开始整片送AI，由AI通读全文语义判断各段类型与边界。
"""
import io
import re
import logging
import time

import mammoth

from .ai_client import AIFatalError, classify_paragraphs_batch

logger = logging.getLogger("thesis.parser")


class ParseError(Exception):
    """对外抛出的用户可读解析失败"""
    pass


# 类型 -> 大块 映射（与 config/formats/hulunbeier_univ.json 的 blocks 一致）
_TYPE_BLOCK_MAP = {
    "toc_title": "toc", "toc_h1": "toc", "toc_h2": "toc", "toc_h3": "toc",
    "paper_title": "abstract", "author_line": "abstract", "instructor": "abstract",
    "abstract_title_cn": "abstract", "abstract_body_cn": "abstract", "keywords_cn": "abstract",
    "abstract_title_en": "abstract", "abstract_body_en": "abstract", "keywords_en": "abstract",
    "h1": "body", "h2": "body", "h3": "body", "body": "body",
    "numbered_item": "body", "table_caption": "body", "table": "body",
    "formula": "body", "formula_number": "body",
    "figure_caption": "body", "caption": "body",
    "conclusion_title": "conclusion", "conclusion_body": "conclusion",
    "references_title": "references", "reference_item": "references", "ref": "references",
    "cover": "abstract",
}


def _type_to_block(ptype: str) -> str:
    return _TYPE_BLOCK_MAP.get(ptype, "body")


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", text)


def find_content_start(paragraphs: list[dict]) -> int | None:
    """
    定位「目录」标题所在索引。其之前的封面、原创性声明等整体跳过。

    只保留这一条可靠的预扫描规则（封面/声明必在目录前）；目录内部的细分边界
    （摘要/正文/总结/参考文献）交给 AI 通读全文语义判断，避免关键词漏判
    （如标题页夹在目录与摘要之间、章标题无"第X章"前缀等）。

    找不到目录标题时返回 None，调用方退化为全文交AI识别（安全兜底）。
    """
    for i, p in enumerate(paragraphs):
        if _norm(p["text"]) == "目录":
            return i
    return None


def extract_paragraphs(file_bytes: bytes) -> list[dict]:
    """
    用 mammoth 抽取纯文本，按行切分为段落。
    保留所有非空段落，顺序索引（一段不漏）。
    返回: [{"index": int, "text": str}, ...]
    """
    result = mammoth.extract_raw_text(io.BytesIO(file_bytes))
    raw = result.value or ""

    paragraphs = []
    idx = 0
    for line in raw.split("\n"):
        text = line.strip()
        if not text:
            continue
        paragraphs.append({"index": idx, "text": text})
        idx += 1
    return paragraphs


def parse_docx(file_bytes: bytes) -> list[dict]:
    """
    解析 .docx 并批量识别。
    返回带 block 标签的完整段落列表。
    """
    try:
        raw_paragraphs = extract_paragraphs(file_bytes)
    except Exception as e:
        raise ParseError(f".docx文件解析失败，可能已损坏: {e}") from e

    logger.info("mammoth 提取段落：%d 段", len(raw_paragraphs))
    if not raw_paragraphs:
        return []

    # 预扫描定位目录：之前的封面/声明整体跳过，从目录开始整片送AI（block=None 不约束）
    start = find_content_start(raw_paragraphs)
    if start is None:
        logger.warning("未检测到目录标题，全文交AI识别")
        kept = raw_paragraphs
    else:
        kept = raw_paragraphs[start:]
        logger.info("预扫描：跳过目录前的封面/声明 %d 段，从目录起整片识别 %d 段",
                    start, len(kept))

    ai_input = [{"index": p["index"], "text": p["text"], "block": None} for p in kept]
    if not ai_input:
        raise ParseError("预扫描后没有可识别的段落（未找到目录之后的内容）")

    t0 = time.monotonic()
    try:
        classified = classify_paragraphs_batch(ai_input)
    except AIFatalError as e:
        logger.error("致命错误，中止: %s", e)
        raise ParseError(str(e)) from e
    except Exception as e:
        logger.exception("AI批量识别失败")
        raise ParseError(f"AI批量识别失败: {e}") from e
    logger.info("AI批量识别完成，用时 %.1fs", time.monotonic() - t0)

    cmap = {c["index"]: c for c in classified}
    results = []
    for p in ai_input:
        c = cmap.get(p["index"], {})
        ptype = c.get("type", "body")
        results.append({
            "index": p["index"],
            "text": p["text"],
            "type": ptype,
            "confidence": c.get("confidence", 0.5),
            "reason": c.get("reason", ""),
            "block": p["block"] or _type_to_block(ptype),
        })
    return results
