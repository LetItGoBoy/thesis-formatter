"""
论文表达润色 - 文档解析模块
backend/lib/polish_parser.py

独立于格式化工具：不做结构识别（标题/正文/摘要/参考文献），
只按 Word 原始顺序把段落与表格抽取为「blocks」，供前端逐段润色。

- 段落 kind="paragraph"，editable=true（空段落 editable=false）
- 表格 kind="table"，editable=false（在线不润色，导出原样保留）
- 每个 block 有稳定 index，与导出时回写顺序严格一致
"""
import io
import re
import html
import logging

from docx import Document as DocxDocument
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.enum.text import WD_ALIGN_PARAGRAPH

logger = logging.getLogger("thesis.polish.parser")

_ALIGN_MAP = {
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.DISTRIBUTE: "justify",
}


def _style_chain(p: DocxParagraph):
    """段落自身样式 + 其继承的 base_style 链（用于读取有效格式）。"""
    chain = []
    st = p.style
    seen = set()
    while st is not None and id(st) not in seen:
        seen.add(id(st))
        chain.append(st)
        st = getattr(st, "base_style", None)
    return chain


def _capture_style(p: DocxParagraph) -> dict:
    """
    抽取段落「有效」显示样式，供前端文档视图尽量还原 Word 观感：
    对齐 / 首行缩进 / 左缩进 / 加粗 / 字号。直接属性缺省时回溯样式继承链。
    """
    fmt = p.paragraph_format
    chain = _style_chain(p)

    # 对齐
    align = fmt.alignment
    if align is None:
        for st in chain:
            if st.paragraph_format.alignment is not None:
                align = st.paragraph_format.alignment
                break
    alignment = _ALIGN_MAP.get(align, "")

    # 首行缩进 / 左缩进（cm）
    def _eff_indent(attr: str):
        v = getattr(fmt, attr)
        if v is None:
            for st in chain:
                v = getattr(st.paragraph_format, attr)
                if v is not None:
                    break
        return round(v.cm, 2) if v is not None else 0.0

    first_line_cm = _eff_indent("first_line_indent")
    left_cm = _eff_indent("left_indent")

    # 加粗：取首个有文字的 run；缺省回溯样式 font.bold
    bold = None
    size_pt = None
    for run in p.runs:
        if run.text.strip():
            if run.bold is not None:
                bold = bool(run.bold)
            if run.font.size is not None:
                size_pt = round(run.font.size.pt, 1)
            break
    if bold is None:
        for st in chain:
            if st.font.bold is not None:
                bold = bool(st.font.bold)
                break
    if size_pt is None:
        for st in chain:
            if st.font.size is not None:
                size_pt = round(st.font.size.pt, 1)
                break

    return {
        "align": alignment,
        "first_line_cm": first_line_cm,
        "left_cm": left_cm,
        "bold": bool(bold),
        "size_pt": size_pt,  # 可能为 None，前端用默认值
    }


def _table_to_cells(table: DocxTable) -> list[list[str]]:
    """抽取表格为二维文本网格（仅供前端只读展示，合并格延续位留空）。"""
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


def _iter_block_items(doc: DocxDocument):
    """按文档顺序产出 body 里的段落(CT_P)与表格(CT_Tbl)。
    与 export 模块保持完全一致的遍历顺序，保证 index 对齐可回写。"""
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield DocxParagraph(child, doc)
        elif isinstance(child, CT_Tbl):
            yield DocxTable(child, doc)


def import_docx_as_blocks(file_bytes: bytes) -> dict:
    """
    把 docx 转成 Web 可展示的 blocks。

    返回：
      {
        "blocks": [{id, index, kind, text, html, editable}, ...],
        "stats": {paragraph_count, editable_count, table_count}
      }
    """
    doc = DocxDocument(io.BytesIO(file_bytes))

    blocks: list[dict] = []
    paragraph_count = 0
    editable_count = 0
    table_count = 0
    idx = 0

    for blk in _iter_block_items(doc):
        if isinstance(blk, DocxTable):
            table_count += 1
            cells = _table_to_cells(blk)
            blocks.append({
                "id": f"block_{idx}",
                "index": idx,
                "kind": "table",
                "text": "[表格]",
                "html": (
                    "<div class='doc-table-placeholder'>"
                    "表格内容暂不支持在线润色，导出时会保留原表格</div>"
                ),
                "editable": False,
                "cells": cells,
            })
            idx += 1
            continue

        # 段落（含空段落，空段落保留但不可润色）
        text = (blk.text or "").strip()
        paragraph_count += 1
        editable = bool(text)
        if editable:
            editable_count += 1
        safe = html.escape(text)
        blocks.append({
            "id": f"block_{idx}",
            "index": idx,
            "kind": "paragraph",
            "text": text,
            "html": f"<p>{safe}</p>" if text else "<p></p>",
            "editable": editable,
            "style": _capture_style(blk),
        })
        idx += 1

    stats = {
        "paragraph_count": paragraph_count,
        "editable_count": editable_count,
        "table_count": table_count,
    }
    logger.info("import_docx_as_blocks: %d blocks（段落 %d / 可润色 %d / 表格 %d）",
                len(blocks), paragraph_count, editable_count, table_count)
    return {"blocks": blocks, "stats": stats}
