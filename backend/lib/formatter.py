"""
.docx 格式化核心
backend/lib/formatter.py

按 config/formats/<template>.json 的规则「重建」一个新 .docx（不硬编码任何数值）。

实现要点：
- disable_snap_to_grid：所有段落格式化前先取消文档网格
- 中英文混排字体（字符级）：中文按段落字体，数字/英文/英文标点统一 ascii_font（TNR）
- 五个大块各另起一页；正文大块内每个 h1 另起一页
- 关键词清理为空格分隔；数字序号 1、->1.；章号双全角空格；固定标题文字
- 三线表：cantSplit + 上下 1.5pt、表头下 1pt（对文档中存在的表格生效）
"""
import io
import re
from copy import deepcopy

from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# 中文 + 中文标点
CHINESE_RE = re.compile(r"[　-〿一-鿿＀-￯]")
FULL_WIDTH_SPACE = "　"

ALIGNMENT_MAP = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}

_BLOCK_ORDER = ["toc", "abstract", "body", "conclusion", "references"]


# ============================================================
# 取消文档网格
# ============================================================
def disable_snap_to_grid(paragraph):
    """取消单段对文档网格的对齐（设置字体/行距前必须先调用）"""
    pPr = paragraph._p.get_or_add_pPr()
    snap = pPr.find(qn("w:snapToGrid"))
    if snap is None:
        snap = OxmlElement("w:snapToGrid")
        pPr.append(snap)
    snap.set(qn("w:val"), "0")


def disable_doc_grid(doc):
    """取消 section 级文档网格"""
    for section in doc.sections:
        sectPr = section._sectPr
        grid = sectPr.find(qn("w:docGrid"))
        if grid is None:
            grid = OxmlElement("w:docGrid")
            sectPr.append(grid)
        grid.set(qn("w:type"), "default")
        grid.set(qn("w:linePitch"), "312")
        grid.set(qn("w:charSpace"), "0")


# ============================================================
# run 属性
# ============================================================
def _get_or_create_rpr(r_el):
    rpr = r_el.find(qn("w:rPr"))
    if rpr is None:
        rpr = OxmlElement("w:rPr")
        r_el.insert(0, rpr)
    return rpr


def _set_rpr_font(rpr, chinese_font, ascii_font):
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), ascii_font)
    rfonts.set(qn("w:hAnsi"), ascii_font)
    rfonts.set(qn("w:cs"), ascii_font)
    rfonts.set(qn("w:eastAsia"), chinese_font)


def _set_rpr_size(rpr, pt):
    half = str(int(float(pt) * 2))
    for tag in ("w:sz", "w:szCs"):
        el = rpr.find(qn(tag))
        if el is None:
            el = OxmlElement(tag)
            rpr.append(el)
        el.set(qn("w:val"), half)


def _set_rpr_bold(rpr, bold):
    b = rpr.find(qn("w:b"))
    bcs = rpr.find(qn("w:bCs"))
    if bold:
        if b is None:
            b = OxmlElement("w:b"); rpr.append(b)
        b.set(qn("w:val"), "1")
        if bcs is None:
            bcs = OxmlElement("w:bCs"); rpr.append(bcs)
        bcs.set(qn("w:val"), "1")
    else:
        if b is not None: rpr.remove(b)
        if bcs is not None: rpr.remove(bcs)


# ============================================================
# 中英文字符级拆分
# ============================================================
def _is_chinese(ch):
    return bool(CHINESE_RE.match(ch))


def _split_by_script(text):
    if not text:
        return []
    out, cur = [], [text[0]]
    cur_s = "zh" if _is_chinese(text[0]) else "en"
    for ch in text[1:]:
        s = "zh" if _is_chinese(ch) else "en"
        if s == cur_s:
            cur.append(ch)
        else:
            out.append(("".join(cur), cur_s))
            cur, cur_s = [ch], s
    out.append(("".join(cur), cur_s))
    return out


def _apply_mixed_font(paragraph, chinese_font, ascii_font, pt, bold):
    runs = list(paragraph.runs)
    if not runs:
        return
    for run in runs:
        text = run.text
        r_el = run._r
        if not text:
            rpr = _get_or_create_rpr(r_el)
            _set_rpr_font(rpr, chinese_font, ascii_font)
            _set_rpr_size(rpr, pt)
            _set_rpr_bold(rpr, bold)
            continue
        segments = _split_by_script(text)
        if len(segments) == 1:
            rpr = _get_or_create_rpr(r_el)
            _set_rpr_font(rpr, chinese_font, ascii_font)
            _set_rpr_size(rpr, pt)
            _set_rpr_bold(rpr, bold)
            continue
        orig_rpr = r_el.find(qn("w:rPr"))
        new_rs = []
        for seg, _ in segments:
            nr = OxmlElement("w:r")
            nrpr = deepcopy(orig_rpr) if orig_rpr is not None else OxmlElement("w:rPr")
            _set_rpr_font(nrpr, chinese_font, ascii_font)
            _set_rpr_size(nrpr, pt)
            _set_rpr_bold(nrpr, bold)
            nr.append(nrpr)
            t = OxmlElement("w:t")
            t.text = seg
            if seg != seg.strip() or " " in seg:
                t.set(qn("xml:space"), "preserve")
            nr.append(t)
            new_rs.append(nr)
        parent = r_el.getparent()
        idx = list(parent).index(r_el)
        for off, nr in enumerate(new_rs):
            parent.insert(idx + off, nr)
        parent.remove(r_el)


# ============================================================
# 文本归一化
# ============================================================
def _normalize_text(text, ptype, style):
    if text is None:
        return ""

    if style.get("is_keywords"):
        prefix = style.get("keywords_prefix", "")
        body = text
        for p in [prefix, prefix.rstrip(":：") + ":", prefix.rstrip(":：") + "："]:
            if p and body.startswith(p):
                body = body[len(p):]
                break
        body = re.sub(r"[;；,，、]", " ", body)
        body = re.sub(r"\s+", " ", body).strip()
        return f"{prefix} {body}" if prefix else body

    if style.get("normalize_numbered_prefix"):
        text = re.sub(r"^(\s*\d+)\s*[、,，]\s*", r"\1. ", text)

    if style.get("chapter_two_space_normalize"):
        m = re.match(r"^(第[一二三四五六七八九十百零\d]+章)\s*(.*)$", text.strip())
        if m and m.group(2):
            text = f"{m.group(1)}{FULL_WIDTH_SPACE}{FULL_WIDTH_SPACE}{m.group(2)}"

    fixed = style.get("fixed_text")
    if fixed:
        bare = text.replace(" ", "").replace(FULL_WIDTH_SPACE, "")
        if bare == fixed.replace(" ", "").replace(FULL_WIDTH_SPACE, ""):
            text = fixed

    n_lead = int(style.get("leading_full_width_spaces", 0))
    if n_lead > 0:
        stripped = text.lstrip(FULL_WIDTH_SPACE).lstrip()
        text = FULL_WIDTH_SPACE * n_lead + stripped

    return text


# ============================================================
# 段落样式
# ============================================================
def _apply_paragraph_style(paragraph, ptype, style):
    disable_snap_to_grid(paragraph)  # 先取消网格

    pf = paragraph.paragraph_format
    align = style.get("alignment", "justify")
    if align in ALIGNMENT_MAP:
        paragraph.alignment = ALIGNMENT_MAP[align]

    ls = style.get("line_spacing")
    if ls is not None:
        pf.line_spacing = float(ls)
        pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE

    if style.get("space_before_pt") is not None:
        pf.space_before = Pt(float(style["space_before_pt"]))
    if style.get("space_after_pt") is not None:
        pf.space_after = Pt(float(style["space_after_pt"]))

    pt = float(style.get("font_size_pt", 12))
    indent_chars = style.get("first_line_indent_chars", 0)
    hanging = style.get("hanging_indent_chars", 0)
    if hanging and hanging > 0:
        pf.left_indent = Pt(hanging * pt)
        pf.first_line_indent = Pt(-hanging * pt)
    elif indent_chars and indent_chars > 0:
        pf.first_line_indent = Pt(indent_chars * pt)
    else:
        pf.first_line_indent = None
        pf.left_indent = None

    if style.get("page_break_before"):
        pf.page_break_before = True

    _apply_mixed_font(
        paragraph,
        style.get("chinese_font", "宋体"),
        style.get("ascii_font", "Times New Roman"),
        pt,
        bool(style.get("bold", False)),
    )


# ============================================================
# 三线表（对文档中存在的表格生效）
# ============================================================
def _set_cell_borders(cell, borders):
    tcPr = cell._tc.get_or_add_tcPr()
    old = tcPr.find(qn("w:tcBorders"))
    if old is not None:
        tcPr.remove(old)
    tcb = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        e = OxmlElement(f"w:{edge}")
        v = borders.get(edge, 0)
        if v and v > 0:
            e.set(qn("w:val"), "single")
            e.set(qn("w:sz"), str(int(v * 8)))
            e.set(qn("w:space"), "0")
            e.set(qn("w:color"), "000000")
        else:
            e.set(qn("w:val"), "nil")
        tcb.append(e)
    tcPr.append(tcb)


def _format_tables(doc, table_cfg):
    cant_split = bool(table_cfg.get("cant_split", True))
    tl = table_cfg.get("three_line", {})
    on = bool(tl.get("enabled", True))
    top = float(tl.get("top_border_pt", 1.5))
    bottom = float(tl.get("bottom_border_pt", 1.5))
    header = float(tl.get("header_bottom_border_pt", 1.0))
    inner = float(tl.get("inner_border_pt", 0))

    tfont = table_cfg.get("font", {})
    zh = tfont.get("chinese_font", "宋体")
    en = tfont.get("ascii_font", "Times New Roman")
    sz = float(tfont.get("font_size_pt", 10.5))

    for table in doc.tables:
        rows = table.rows
        n = len(rows)
        if n == 0:
            continue
        if cant_split:
            for row in rows:
                trPr = row._tr.get_or_add_trPr()
                if trPr.find(qn("w:cantSplit")) is None:
                    trPr.append(OxmlElement("w:cantSplit"))
        if on:
            for i, row in enumerate(rows):
                for cell in row.cells:
                    if n == 1:
                        b = {"top": top, "bottom": bottom}
                    elif i == 0:
                        b = {"top": top, "bottom": header}
                    elif i == n - 1:
                        b = {"top": inner, "bottom": bottom}
                    else:
                        b = {"top": inner, "bottom": inner}
                    _set_cell_borders(cell, b)
        for row in rows:
            for cell in row.cells:
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                for para in cell.paragraphs:
                    disable_snap_to_grid(para)
                    para.alignment = ALIGNMENT_MAP["center"]
                    _apply_mixed_font(para, zh, en, sz, False)


# ============================================================
# 页面设置
# ============================================================
def _apply_page_settings(doc, page_cfg):
    for section in doc.sections:
        if "margin_top_cm" in page_cfg:
            section.top_margin = Cm(float(page_cfg["margin_top_cm"]))
        if "margin_bottom_cm" in page_cfg:
            section.bottom_margin = Cm(float(page_cfg["margin_bottom_cm"]))
        if "margin_left_cm" in page_cfg:
            section.left_margin = Cm(float(page_cfg["margin_left_cm"]))
        if "margin_right_cm" in page_cfg:
            section.right_margin = Cm(float(page_cfg["margin_right_cm"]))
        sectPr = section._sectPr
        pgMar = sectPr.find(qn("w:pgMar"))
        if pgMar is not None:
            pgMar.set(qn("w:gutter"), str(int(float(page_cfg.get("gutter_cm", 0)) * 567)))


def _block_of(ptype, styles):
    blk = (styles.get(ptype) or {}).get("block", "body")
    return "body" if blk == "_legacy" else blk


# ============================================================
# 主入口：重建 .docx
# ============================================================
def format_docx(paragraphs, format_config, source_bytes=None):
    """
    paragraphs: [{"index": int, "type": str, "text": str}, ...]
    format_config: hulunbeier_univ.json 内容
    source_bytes: 兼容参数；本实现按 CLAUDE.md「重建.docx」从段落列表新建文档。
    """
    doc = Document()
    styles = format_config.get("paragraph_styles", {})

    _apply_page_settings(doc, format_config.get("page", {}))
    disable_doc_grid(doc)

    ordered = sorted(paragraphs, key=lambda p: p.get("index", 0))

    last_block = None
    for p in ordered:
        ptype = p.get("type", "body")
        style = styles.get(ptype) or styles.get("body", {})
        text = _normalize_text(p.get("text", ""), ptype, style)

        para = doc.add_paragraph()
        para.add_run(text)

        # 大块切换 -> 另起一页
        cur_block = _block_of(ptype, styles)
        if last_block is not None and cur_block != last_block:
            para.paragraph_format.page_break_before = True
        last_block = cur_block

        _apply_paragraph_style(para, ptype, style)

    _format_tables(doc, format_config.get("table_format", {}))

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out
