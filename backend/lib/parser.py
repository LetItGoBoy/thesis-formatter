"""
.docx 文档解析模块
backend/lib/parser.py

用 mammoth 提取原始文本 -> 切分为段落（一段不漏）
-> 关键词预扫描划定大块（封面/声明在目录前，整体跳过）
-> 按大块批量AI识别类型。
"""
import io
import re
import logging
import time

import mammoth

from .ai_client import AIFatalError, classify_paragraphs_batch

logger = logging.getLogger("thesis.parser")

# 章标题：第一章 / 第1章 / 第 1 章
_CHAPTER_RE = re.compile(r"^第\s*[一二三四五六七八九十百零0-9]+\s*章")


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


def assign_blocks(paragraphs: list[dict]) -> list[str | None] | None:
    """
    关键词预扫描，按文档顺序划定大块边界。

    顺序假设（呼伦贝尔学院本科论文）：封面/声明 → 目录 → 摘要 → 正文 → 总结 → 参考文献。
    - 目录标题（"目录"）之前的所有段落（封面、原创性声明等）标记为 None：跳过，不送AI、不进结果。
    - 各区起点按顺序在前一区之后查找，避免目录里的"第X章"条目被误判为正文起点。

    返回与 paragraphs 等长的列表（block 名或 None）；
    若定位不到目录标题，返回 None 让调用方退化为不分区识别（安全兜底）。
    """
    n = len(paragraphs)
    norms = [_norm(p["text"]) for p in paragraphs]

    def find(pred, start: int):
        for i in range(start, n):
            if pred(i):
                return i
        return None

    toc_i = find(lambda i: norms[i] == "目录", 0)
    if toc_i is None:
        return None

    abs_i = find(lambda i: norms[i] in ("摘要", "内容摘要"), toc_i + 1)
    body_search_from = (abs_i if abs_i is not None else toc_i) + 1
    body_i = find(lambda i: _CHAPTER_RE.match(paragraphs[i]["text"].strip()), body_search_from)
    concl_from = next((x for x in (body_i, abs_i, toc_i) if x is not None)) + 1
    concl_i = find(lambda i: norms[i] in ("总结", "结论"), concl_from)
    ref_from = next((x for x in (concl_i, body_i, abs_i, toc_i) if x is not None)) + 1
    ref_i = find(lambda i: norms[i] == "参考文献" or norms[i].upper() == "REFERENCES", ref_from)

    bounds = [(i, b) for i, b in (
        (toc_i, "toc"), (abs_i, "abstract"), (body_i, "body"),
        (concl_i, "conclusion"), (ref_i, "references"),
    ) if i is not None]
    bounds.sort()

    blocks: list[str | None] = [None] * n
    for k, (start, b) in enumerate(bounds):
        end = bounds[k + 1][0] if k + 1 < len(bounds) else n
        for i in range(start, end):
            blocks[i] = b
    return blocks


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

    # 预扫描划块：目录之前的封面/声明整体跳过，从目录开始识别
    blocks = assign_blocks(raw_paragraphs)
    if blocks is None:
        logger.warning("未检测到目录标题，跳过分区，全文交AI识别")
        ai_input = [{"index": p["index"], "text": p["text"], "block": None}
                    for p in raw_paragraphs]
    else:
        ai_input = [{"index": p["index"], "text": p["text"], "block": b}
                    for p, b in zip(raw_paragraphs, blocks) if b is not None]
        skipped = len(raw_paragraphs) - len(ai_input)
        logger.info("预扫描分区：跳过目录前的封面/声明 %d 段，送AI %d 段",
                    skipped, len(ai_input))

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
