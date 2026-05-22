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
from docx.enum.text import WD_ALIGN_PARAGRAPH

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


# 原创性声明 / 签名 / 日期 识别标记
_DECL_END = "特此声明"
_DECL_MARKERS = ("郑重声明", "原创性声明", "知识产权声明", "原创性及知识产权")
_SIG_MARKERS = ("毕业论文作者", "指导教师", "学生签名", "导师签名", "作者签名", "签名", "日期")
_DATE_RE = re.compile(r"年\s*月\s*日|\d{2,4}\s*年")
_RE_PURE_NUM = re.compile(r"^\d{1,4}$")  # 手写日期被拆成的数字段（2026 / 4 / 24）


def _is_text_item(it: dict) -> bool:
    return it.get("kind") not in ("table", "image")


def _item_text(it: dict) -> str:
    return it.get("text", "") if _is_text_item(it) else ""


def select_content_items(items: list[dict]) -> list[dict]:
    """
    跳过封面、整体移除原创性声明区域，返回应送 AI 识别的正文条目。

    论文版式多变，目录可能在声明之前或之后（封面→目录→声明→摘要，或
    封面→声明→标题页→摘要→目录）。因此不能用「跳到声明之后」的单点切割
    （会误删声明前的目录），而是：
      1. 封面 = 第一个结构标记（目录/摘要/声明）之前的部分，整段跳过；
      2. 原创性声明区域（声明正文 +「特此声明」+ 签名/日期文字 + 手写签名/
         日期图片）作为一个整体区域挖除，无论它在目录前还是后；
      3. 其余（目录、标题页、摘要、正文…）全部保留，交 AI 通读判断。
    无任何锚点时返回原始全部条目（安全兜底）。
    """
    n = len(items)
    if n == 0:
        return items

    def ntxt(it: dict) -> str:
        return _norm(_item_text(it))

    decl_start = next(
        (i for i in range(n) if any(m in _item_text(items[i]) for m in _DECL_MARKERS)),
        None,
    )
    toc_idx = next((i for i in range(n) if ntxt(items[i]) == "目录"), None)
    abs_idx = next(
        (i for i in range(n) if ntxt(items[i]).lower() in ("摘要", "abstract")), None
    )

    # 封面终点 = 第一个结构标记（声明/目录/摘要）位置；之前整段是封面
    markers = [x for x in (decl_start, toc_idx, abs_idx) if x is not None]
    cover_end = min(markers) if markers else 0

    # 原创性声明区域 [decl_start, decl_end]（含签名/日期/手写图片）
    remove: set[int] = set()
    if decl_start is not None:
        anchor = next(
            (i for i in range(decl_start, n) if _DECL_END in _item_text(items[i])), None
        )
        decl_end = anchor if anchor is not None else decl_start
        j = decl_end + 1
        steps = 0
        while j < n and steps < 20:
            it = items[j]
            t = _item_text(it)
            nt = _norm(t)
            # 遇到结构标记或实质正文段 -> 声明区域结束
            if nt == "目录" or nt.lower() in ("摘要", "abstract"):
                break
            if _is_text_item(it) and len(nt) >= 15 and not any(m in t for m in _SIG_MARKERS):
                break
            # 签名/日期文字、手写签名/日期图片、空行 -> 仍属声明区域
            if (
                not _is_text_item(it)
                or any(m in t for m in _SIG_MARKERS)
                or _DATE_RE.search(t)
                or _RE_PURE_NUM.match(nt)
                or len(nt) <= 2
            ):
                decl_end = j
                j += 1
                steps += 1
                continue
            break
        remove.update(range(decl_start, decl_end + 1))

    return [items[i] for i in range(cover_end, n) if i not in remove]


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


def _capture_orig_style(p: DocxParagraph) -> dict:
    """抽取段落原始格式属性，供前端「上传原文」侧原样渲染。"""
    fmt = p.paragraph_format
    _align = {
        WD_ALIGN_PARAGRAPH.CENTER: "center",
        WD_ALIGN_PARAGRAPH.RIGHT: "right",
        WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
    }
    alignment = _align.get(fmt.alignment, "left")
    indent_emu = fmt.left_indent
    indent_cm = round(indent_emu.cm, 2) if indent_emu else 0.0
    first_line_emu = fmt.first_line_indent
    first_line_cm = round(first_line_emu.cm, 2) if first_line_emu else 0.0
    is_bold = False
    font_size_pt = 12.0
    for run in p.runs:
        if run.text.strip():
            if run.bold is not None:
                is_bold = bool(run.bold)
            if run.font.size:
                font_size_pt = round(run.font.size.pt, 1)
            break
    if font_size_pt == 12.0:
        try:
            sz = p.style.font.size
            if sz:
                font_size_pt = round(sz.pt, 1)
        except Exception:
            pass
    return {
        "alignment": alignment,
        "indent_cm": indent_cm,
        "first_line_cm": first_line_cm,
        "is_bold": is_bold,
        "font_size_pt": font_size_pt,
        "style_name": p.style.name if p.style else "",
    }


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
            items.append({"index": idx, "text": text, "orig_style": _capture_orig_style(blk)})
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

    # 预扫描：跳过封面、整体移除原创性声明区域（含签名/日期手写图片），
    # 其余整片送AI（block=None 不约束）。目录无论在声明前后都保留。
    kept = select_content_items(raw_items)
    logger.info("预扫描：原始 %d 块 -> 跳过封面/声明后保留 %d 块",
                len(raw_items), len(kept))
    if not kept:
        raise ParseError("预扫描后没有可识别的段落（未找到正文内容）")

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
            "orig_style": p.get("orig_style"),
        })
    return results
