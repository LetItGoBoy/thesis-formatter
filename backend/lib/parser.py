"""
.docx文档解析模块
backend/lib/parser.py

调用 ai_client 的批量识别版本（classify_paragraphs_batch），
全文 N 段从 N 次API调用降到 ceil(N/BATCH_SIZE) 次。
"""
import io
import logging
import time

from docx import Document

from .ai_client import (
    AIFatalError,
    classify_paragraphs_batch,
)

logger = logging.getLogger("thesis.parser")


class ParseError(Exception):
    pass


def extract_paragraphs(file_bytes: bytes) -> list[dict]:
    """提取所有段落，保留索引（包括空段落）"""
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = []
    for i, para in enumerate(doc.paragraphs):
        text = para.text if para.text is not None else ""
        paragraphs.append({"index": i, "text": text})
    return paragraphs


def parse_docx(file_bytes: bytes) -> list[dict]:
    """
    解析.docx并批量调用AI分类。
    返回带 block 标签的完整段落列表（包括空段落，方便前端定位）。
    """
    try:
        raw_paragraphs = extract_paragraphs(file_bytes)
    except Exception as e:
        raise ParseError(f".docx文件解析失败，可能已损坏: {e}") from e

    total = len(raw_paragraphs)
    non_empty = [p for p in raw_paragraphs if (p.get("text") or "").strip()]
    logger.info("开始解析：共 %d 段（非空 %d 段）", total, len(non_empty))

    if not non_empty:
        return [{**p, "type": "body", "confidence": 1.0, "reason": "空段落",
                 "block": "body"} for p in raw_paragraphs]

    t0 = time.monotonic()
    try:
        classified = classify_paragraphs_batch(non_empty)
    except AIFatalError as e:
        logger.error("致命错误，中止解析: %s", e)
        raise ParseError(str(e)) from e
    except Exception as e:
        logger.exception("AI批量识别失败")
        raise ParseError(f"AI批量识别失败: {e}") from e

    logger.info("AI批量识别完成，用时 %.1fs", time.monotonic() - t0)

    cmap = {c["index"]: c for c in classified}
    results = []
    for p in raw_paragraphs:
        if p["index"] in cmap:
            c = cmap[p["index"]]
            ptype = c.get("type", "body")
            results.append({
                "index": p["index"],
                "text": p["text"],
                "type": ptype,
                "confidence": c.get("confidence", 0.5),
                "reason": c.get("reason", ""),
                "block": _type_to_block(ptype),
            })
        else:
            results.append({
                "index": p["index"],
                "text": p["text"],
                "type": "body",
                "confidence": 1.0,
                "reason": "空段落",
                "block": "body",
            })
    return results


# 类型 → 大块 映射（与 config/formats/hulunbeier_univ.json 的 blocks 一致）
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
    "cover": "abstract",  # 旧版兼容：cover 归入摘要块（前端 UI 不显示这个 type）
}


def _type_to_block(ptype: str) -> str:
    return _TYPE_BLOCK_MAP.get(ptype, "body")
