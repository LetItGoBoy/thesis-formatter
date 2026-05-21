"""
.docx 文档解析模块
backend/lib/parser.py

用 python-docx 按文档顺序遍历正文 -> 区分「段落」与「表格」（一段不漏）
-> 预扫描定位「目录」标题，其之前的封面/声明整体跳过
-> 段落整片送AI由其通读全文语义判断类型与边界；表格在解析阶段即识别为
   table 并携带单元格网格（cells），不送AI、格式化时重建为真正的三线表。
"""
import io
import re
import base64
import logging
import time

from docx import Document as DocxDocument
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P

from .ai_client import AIFatalError, classify_paragraphs_batch
from .docx_images import paragraph_image_refs

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
    "figure_caption": "body", "caption": "body", "figure": "body",
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


def _iter_block_items(doc: DocxDocument):
    """按文档顺序产出正文里的段落(DocxParagraph)与表格(DocxTable)。"""
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield DocxParagraph(child, doc)
        elif isinstance(child, CT_Tbl):
            yield DocxTable(child, doc)


def _table_to_cells(table: DocxTable) -> list[list[str]]:
    """
    抽取表格为二维文本网格。
    合并单元格在 python-docx 中会让同一个底层 tc 重复出现在多个网格位上；
    据此把「延续格」（与左侧或上方同一 tc）留空，避免文字重复。
    """
    grid = []
    above: dict[int, int] = {}  # 列 -> 上一行该列的 tc id
    for row in table.rows:
        line = []
        prev_tc = None
        for col, cell in enumerate(row.cells):
            tc_id = id(cell._tc)
            if tc_id == prev_tc or above.get(col) == tc_id:
                text = ""  # 横向/纵向合并的延续格
            else:
                text = re.sub(r"\s*\n\s*", " ", (cell.text or "").strip())
            above[col] = tc_id
            prev_tc = tc_id
            line.append(text)
        grid.append(line)
    return grid


def extract_blocks(file_bytes: bytes) -> list[dict]:
    """
    按文档顺序抽取「段落」与「表格」，保留所有非空块，顺序索引（一段不漏）。
    段落 -> {"index", "text"}
    表格 -> {"index", "text"(预览), "kind": "table", "cells": [[...], ...]}
    """
    doc = DocxDocument(io.BytesIO(file_bytes))
    items = []
    idx = 0
    img_counter = 0  # 顶层段落图片计数，与 docx_images.extract_ordered_images 下标对齐
    for blk in _iter_block_items(doc):
        if isinstance(blk, DocxTable):
            cells = _table_to_cells(blk)
            if not any(any(c for c in row) for row in cells):
                continue  # 空表跳过
            preview = "；".join(" / ".join(c for c in row if c) for row in cells if any(row))
            items.append({"index": idx, "text": preview, "kind": "table", "cells": cells})
            idx += 1
        else:
            # 图片：原先无文字段落被直接跳过导致配图丢失；这里为每张图产出一个 figure 段落
            for rid, cx, cy in paragraph_image_refs(blk):
                k = img_counter
                img_counter += 1
                part = doc.part.related_parts.get(rid)
                if part is None:
                    continue  # 关系缺失：占位计数已自增，保持与格式化端下标一致
                b64 = base64.b64encode(part.blob).decode("ascii")
                items.append({
                    "index": idx,
                    "text": "[图片]",
                    "kind": "image",
                    "type": "figure",
                    "image_index": k,
                    "image_b64": f"data:{part.content_type};base64,{b64}",
                })
                idx += 1
            text = (blk.text or "").strip()
            if not text:
                continue
            items.append({"index": idx, "text": text})
            idx += 1
    return items


def parse_docx(file_bytes: bytes) -> list[dict]:
    """
    解析 .docx 并批量识别。
    返回带 block 标签的完整段落列表（表格段附带 cells）。
    """
    try:
        raw_items = extract_blocks(file_bytes)
    except Exception as e:
        raise ParseError(f".docx文件解析失败，可能已损坏: {e}") from e

    n_tbl = sum(1 for p in raw_items if p.get("kind") == "table")
    logger.info("python-docx 提取：%d 块（其中表格 %d）", len(raw_items), n_tbl)
    if not raw_items:
        return []

    # 预扫描定位目录：之前的封面/声明整体跳过，从目录开始整片送AI（block=None 不约束）
    start = find_content_start(raw_items)
    if start is None:
        logger.warning("未检测到目录标题，全文交AI识别")
        kept = raw_items
    else:
        kept = raw_items[start:]
        logger.info("预扫描：跳过目录前的封面/声明 %d 段，从目录起整片识别 %d 块",
                    start, len(kept))
    if not kept:
        raise ParseError("预扫描后没有可识别的段落（未找到目录之后的内容）")

    # 表格/图片不送 AI（解析阶段已确定 type）；其余文本段整片送 AI
    text_items = [{"index": p["index"], "text": p["text"], "block": None}
                  for p in kept if p.get("kind") not in ("table", "image")]

    classified = []
    if text_items:
        t0 = time.monotonic()
        try:
            classified = classify_paragraphs_batch(text_items)
        except AIFatalError as e:
            logger.error("致命错误，中止: %s", e)
            raise ParseError(str(e)) from e
        except Exception as e:
            logger.exception("AI批量识别失败")
            raise ParseError(f"AI批量识别失败: {e}") from e
        logger.info("AI批量识别完成，用时 %.1fs", time.monotonic() - t0)

    cmap = {c["index"]: c for c in classified}
    results = []
    for p in kept:
        if p.get("kind") == "table":
            results.append({
                "index": p["index"],
                "text": p["text"],
                "type": "table",
                "confidence": 1.0,
                "reason": "解析阶段识别为表格",
                "block": "body",
                "cells": p["cells"],
            })
            continue
        if p.get("kind") == "image":
            results.append({
                "index": p["index"],
                "text": p["text"],
                "type": "figure",
                "confidence": 1.0,
                "reason": "解析阶段识别为图片",
                "block": "body",
                "image_index": p["image_index"],
                "image_b64": p["image_b64"],
            })
            continue
        c = cmap.get(p["index"], {})
        ptype = c.get("type", "body")
        results.append({
            "index": p["index"],
            "text": p["text"],
            "type": ptype,
            "confidence": c.get("confidence", 0.5),
            "reason": c.get("reason", ""),
            "block": _type_to_block(ptype),
        })
    return results
