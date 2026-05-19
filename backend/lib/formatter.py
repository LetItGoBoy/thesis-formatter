"""
.docx 格式化模块（v2 - 完全对齐最新提示词）
backend/lib/formatter.py

关键规则：
1. 页边距：上 2.5 / 下 2.0 / 左 3.0 / 右 2.0 cm，装订线 0
2. 所有段落格式化前先调用 disable_snap_to_grid(paragraph) 取消文档网格
3. 中文按 chinese_font，数字/英文/英文标点统一 Times New Roman（字符级）
4. 关键词（keywords_cn / keywords_en）自动把 ;；,， 替换为空格，多空格合一
5. 五个大块每块另起一页（toc / abstract / body / conclusion / references）
6. 正文大块内每个 h1（一级标题）另起一页
7. h1 "第X章 标题" 自动规范为 "章" 后两个全角空格
8. numbered_item "1、" 自动改为 "1. "
9. 三线表：cantSplit + 上下 1.5pt、表头下 1pt
10. 总结标题固定 "总  结"（中间两个全角空格）
11. 参考文献正文：仿宋小四 左对齐
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


# 中文范围 + 中文标点（CJK Unified, Halfwidth Forms 等）
CHINESE_RE = re.compile(r'[　-〿一-鿿＀-￯]')

ALIGNMENT_MAP = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}

FULL_WIDTH_SPACE = "　"


# ============================================================
# 取消文档网格（关键！所有段落格式化前都要先调用）
# ============================================================
def disable_snap_to_grid(paragraph):
    """取消单段对文档网格的对齐"""
    pPr = paragraph._p.get_or_add_pPr()
    snap = pPr.find(qn("w:snapToGrid"))
    if snap is None:
        snap = OxmlElement("w:snapToGrid")
        pPr.append(snap)
    snap.set(qn("w:val"), "0")


def disable_doc_grid(doc):
    """取消整个section级别的文档网格（独立于段落级 snapToGrid）"""
    for section in doc.sections:
        sectPr = section._sectPr
        docGrid = sectPr.find(qn("w:docGrid"))
        if docGrid is None:
            docGrid = OxmlElement("w:docGrid")
            sectPr.append(docGrid)
        docGrid.set(qn("w:type"), "default")
        docGrid.set(qn("w:linePitch"), "312")
        docGrid.set(qn("w:charSpace"), "0")


# ============================================================
# XML 工具
# ============================================================
def _get_or_create_rpr(r_element):
    rpr = r_element.find(qn("w:rPr"))
    if rpr is None:
        rpr = OxmlElement("w:rPr")
        r_element.insert(0, rpr)
    return rpr


def _set_rpr_font(rpr, chinese_font: str, ascii_font: str):
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), ascii_font)
    rfonts.set(qn("w:hAnsi"), ascii_font)
    rfonts.set(qn("w:cs"), ascii_font)
    rfonts.set(qn("w:eastAsia"), chinese_font)


def _set_rpr_size(rpr, font_size_pt: float):
    half = str(int(float(font_size_pt) * 2))
    sz = rpr.find(qn("w:sz"))
    if sz is None:
        sz = OxmlElement("w:sz")
        rpr.append(sz)
    sz.set(qn("w:val"), half)
    szcs = rpr.find(qn("w:szCs"))
    if szcs is None:
        szcs = OxmlElement("w:szCs")
        rpr.append(szcs)
    szcs.set(qn("w:val"), half)


def _set_rpr_bold(rpr, bold: bool):
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
def _is_chinese_char(ch: str) -> bool:
    return bool(CHINESE_RE.match(ch))


def _split_text_by_script(text: str) -> list[tuple[str, str]]:
    """[(segment, 'zh'|'en'), ...]"""
    if not text:
        return []
    out = []
    cur = [text[0]]
    cur_s = "zh" if _is_chinese_char(text[0]) else "en"
    for ch in text[1:]:
        s = "zh" if _is_chinese_char(ch) else "en"
        if s == cur_s:
            cur.append(ch)
        else:
            out.append(("".join(cur), cur_s))
            cur = [ch]; cur_s = s
    out.append(("".join(cur), cur_s))
    return out


def _apply_mixed_font_to_paragraph(paragraph, chinese_font, ascii_font,
                                    font_size_pt, bold):
    """对段中每个run按字符级拆分中英文，分别设置字体"""
    runs = list(paragraph.runs)
    if not runs:
        return

    for run in runs:
        original_text = run.text
        original_r = run._r
        if not original_text:
            rpr = _get_or_create_rpr(original_r)
            _set_rpr_font(rpr, chinese_font, ascii_font)
            _set_rpr_size(rpr, font_size_pt)
            _set_rpr_bold(rpr, bold)
            continue

        segments = _split_text_by_script(original_text)
        if len(segments) == 1:
            rpr = _get_or_create_rpr(original_r)
            _set_rpr_font(rpr, chinese_font, ascii_font)
            _set_rpr_size(rpr, font_size_pt)
            _set_rpr_bold(rpr, bold)
            continue

        original_rpr = original_r.find(qn("w:rPr"))
        new_rs = []
        for seg_text, _ in segments:
            new_r = OxmlElement("w:r")
            if original_rpr is not None:
                new_rpr = deepcopy(original_rpr)
            else:
                new_rpr = OxmlElement("w:rPr")
            _set_rpr_font(new_rpr, chinese_font, ascii_font)
            _set_rpr_size(new_rpr, font_size_pt)
            _set_rpr_bold(new_rpr, bold)
            new_r.append(new_rpr)

            t = OxmlElement("w:t")
            t.text = seg_text
            if seg_text != seg_text.strip() or " " in seg_text:
                t.set(qn("xml:space"), "preserve")
            new_r.append(t)
            new_rs.append(new_r)

        parent = original_r.getparent()
        idx = list(parent).index(original_r)
        for off, nr in enumerate(new_rs):
            parent.insert(idx + off, nr)
        parent.remove(original_r)


# ============================================================
# 文字内容预处理（关键词清理、章号归一化等）
# ============================================================
def _normalize_text_for_type(text: str, ptype: str, style: dict) -> str:
    """根据类型规范化文字内容"""
    if text is None:
        return ""

    # 关键词：把分隔符替换为空格
    if style.get("is_keywords"):
        prefix = style.get("keywords_prefix", "")
        body_text = text
        # 剥离前缀（中文："关键词:" / "关键词：" / 英文 "Keywords:"）
        for p in [prefix, prefix.rstrip(":：") + ":", prefix.rstrip(":：") + "："]:
            if p and body_text.startswith(p):
                body_text = body_text[len(p):]
                break
        # 替换分隔符
        body_text = re.sub(r"[;；,，、]", " ", body_text)
        body_text = re.sub(r"\s+", " ", body_text).strip()
        return f"{prefix} {body_text}" if prefix else body_text

    # 数字序号：1、 → 1.
    if style.get("normalize_numbered_prefix"):
        text = re.sub(r"^(\s*\d+)\s*[、,，]\s*", r"\1. ", text)

    # 一级标题：第X章 + 两个全角空格 + 标题
    if style.get("chapter_two_space_normalize"):
        m = re.match(r"^(第[一二三四五六七八九十百零\d]+章)\s*(.*)$", text.strip())
        if m and m.group(2):
            text = f"{m.group(1)}{FULL_WIDTH_SPACE}{FULL_WIDTH_SPACE}{m.group(2)}"

    # 固定文字（如 "目  录"/"总  结"/"摘要"/"Abstract"/"参考文献"）
    fixed = style.get("fixed_text")
    if fixed and text.strip() in (fixed, fixed.replace(" ", ""), fixed.replace(FULL_WIDTH_SPACE, "")):
        text = fixed

    # toc_h2/h3 的前置全角空格
    n_lead = int(style.get("leading_full_width_spaces", 0))
    if n_lead > 0:
        # 先去掉已有的全角空格前导，再补足
        stripped = text.lstrip(FULL_WIDTH_SPACE).lstrip()
        text = FULL_WIDTH_SPACE * n_lead + stripped

    return text


# ============================================================
# 段落样式应用
# ============================================================
def _apply_paragraph_style(paragraph, ptype: str, style: dict):
    # 1. 先取消文档网格
    disable_snap_to_grid(paragraph)

    pf = paragraph.paragraph_format

    # 2. 对齐
    align = style.get("alignment", "justify")
    if align in ALIGNMENT_MAP:
        paragraph.alignment = ALIGNMENT_MAP[align]

    # 3. 行距（原生倍数）
    ls = style.get("line_spacing")
    if ls is not None:
        pf.line_spacing = float(ls)
        pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE

    # 4. 段前段后
    sb = style.get("space_before_pt")
    if sb is not None:
        pf.space_before = Pt(float(sb))
    sa = style.get("space_after_pt")
    if sa is not None:
        pf.space_after = Pt(float(sa))

    font_size_pt = float(style.get("font_size_pt", 12))

    # 5. 缩进
    indent_chars = style.get("first_line_indent_chars", 0)
    hanging = style.get("hanging_indent_chars", 0)
    if hanging and hanging > 0:
        pf.left_indent = Pt(hanging * font_size_pt)
        pf.first_line_indent = Pt(-hanging * font_size_pt)
    elif indent_chars and indent_chars > 0:
        pf.first_line_indent = Pt(indent_chars * font_size_pt)
    else:
        pf.first_line_indent = None
        pf.left_indent = None

    # 6. 分页前
    if style.get("page_break_before"):
        pf.page_break_before = True

    # 7. 字体（含中英文混排，字符级）
    chinese_font = style.get("chinese_font", "宋体")
    ascii_font = style.get("ascii_font", "Times New Roman")
    bold = bool(style.get("bold", False))
    _apply_mixed_font_to_paragraph(paragraph, chinese_font, ascii_font, font_size_pt, bold)


def _replace_paragraph_text(paragraph, new_text: str):
    """整体替换段落文字（清除所有原run内容，写入单个新run）"""
    for r in list(paragraph.runs):
        r.text = ""
    if paragraph.runs:
        paragraph.runs[0].text = new_text
    else:
        paragraph.add_run(new_text)


# ============================================================
# 表格三线表
# ============================================================
def _set_cell_borders(cell, borders: dict):
    tcPr = cell._tc.get_or_add_tcPr()
    old = tcPr.find(qn("w:tcBorders"))
    if old is not None:
        tcPr.remove(old)
    tcb = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        e = OxmlElement(f"w:{edge}")
        pt_val = borders.get(edge, 0)
        if pt_val and pt_val > 0:
            e.set(qn("w:val"), "single")
            e.set(qn("w:sz"), str(int(pt_val * 8)))
            e.set(qn("w:space"), "0")
            e.set(qn("w:color"), "000000")
        else:
            e.set(qn("w:val"), "nil")
        tcb.append(e)
    tcPr.append(tcb)


def _format_tables(doc, table_format_cfg: dict):
    cant_split = bool(table_format_cfg.get("cant_split", True))
    tl = table_format_cfg.get("three_line", {})
    three_line_on = bool(tl.get("enabled", True))
    top_pt = float(tl.get("top_border_pt", 1.5))
    bottom_pt = float(tl.get("bottom_border_pt", 1.5))
    header_pt = float(tl.get("header_bottom_border_pt", 1.0))
    inner_pt = float(tl.get("inner_border_pt", 0))

    tfont = table_format_cfg.get("font", {})
    t_zh = tfont.get("chinese_font", "宋体")
    t_en = tfont.get("ascii_font", "Times New Roman")
    t_sz = float(tfont.get("font_size_pt", 10.5))

    vcell = WD_ALIGN_VERTICAL.CENTER

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

        if three_line_on:
            for i, row in enumerate(rows):
                for cell in row.cells:
                    if n == 1:
                        b = {"top": top_pt, "bottom": bottom_pt, "left": 0, "right": 0}
                    elif i == 0:
                        b = {"top": top_pt, "bottom": header_pt, "left": 0, "right": 0}
                    elif i == n - 1:
                        b = {"top": inner_pt, "bottom": bottom_pt, "left": 0, "right": 0}
                    else:
                        b = {"top": inner_pt, "bottom": inner_pt, "left": 0, "right": 0}
                    _set_cell_borders(cell, b)

        # 单元格字体 + 居中 + 取消网格
        for row in rows:
            for cell in row.cells:
                cell.vertical_alignment = vcell
                for para in cell.paragraphs:
                    disable_snap_to_grid(para)
                    para.alignment = ALIGNMENT_MAP["center"]
                    _apply_mixed_font_to_paragraph(para, t_zh, t_en, t_sz, False)


# ============================================================
# 页面设置
# ============================================================
def _apply_page_settings(doc, page_cfg: dict):
    for section in doc.sections:
        if "margin_top_cm" in page_cfg:
            section.top_margin = Cm(float(page_cfg["margin_top_cm"]))
        if "margin_bottom_cm" in page_cfg:
            section.bottom_margin = Cm(float(page_cfg["margin_bottom_cm"]))
        if "margin_left_cm" in page_cfg:
            section.left_margin = Cm(float(page_cfg["margin_left_cm"]))
        if "margin_right_cm" in page_cfg:
            section.right_margin = Cm(float(page_cfg["margin_right_cm"]))
        # 装订线 0
        sectPr = section._sectPr
        pgMar = sectPr.find(qn("w:pgMar"))
        if pgMar is not None:
            pgMar.set(qn("w:gutter"), "0")


# ============================================================
# 大块切换：插入分页
# ============================================================
_BLOCK_ORDER = ["toc", "abstract", "body", "conclusion", "references"]


def _block_of_type(ptype: str, styles: dict) -> str:
    s = styles.get(ptype) or {}
    blk = s.get("block", "body")
    if blk == "_legacy":
        return "body"
    return blk


# ============================================================
# 主入口
# ============================================================
def format_docx(paragraphs: list[dict], format_config: dict,
                source_bytes: bytes = None) -> io.BytesIO:
    """
    paragraphs: [{"index": int, "type": str, "text": str}, ...]
    format_config: hulunbeier_univ.json
    source_bytes: 原始 docx
    """
    if source_bytes:
        doc = Document(io.BytesIO(source_bytes))
    else:
        doc = Document()

    styles = format_config.get("paragraph_styles", {})

    # 1. 页面 + 文档网格
    _apply_page_settings(doc, format_config.get("page", {}))
    disable_doc_grid(doc)

    # 2. 索引化用户确认
    type_map = {p["index"]: p for p in paragraphs}

    # 3. 跟踪 block 切换以插入分页
    last_block: str = None

    for i, paragraph in enumerate(doc.paragraphs):
        confirmed = type_map.get(i)
        if confirmed:
            ptype = confirmed.get("type", "body")
            new_text = confirmed.get("text")
        else:
            ptype = "body"
            new_text = None

        style = styles.get(ptype) or styles.get("body", {})

        # 文字预处理（关键词清理 / 章号 / 固定文字 / toc缩进）
        original_text = paragraph.text if new_text is None else new_text
        normalized = _normalize_text_for_type(original_text, ptype, style)
        if normalized != paragraph.text:
            _replace_paragraph_text(paragraph, normalized)

        # 大块切换 → 在首段前打分页
        cur_block = _block_of_type(ptype, styles)
        is_first_of_block = (cur_block != last_block) and (last_block is not None)
        if is_first_of_block:
            # 给这段设置 page_break_before
            paragraph.paragraph_format.page_break_before = True
        last_block = cur_block

        # 应用样式（包含 page_break_before / h1 章节分页）
        _apply_paragraph_style(paragraph, ptype, style)

    # 4. 表格
    _format_tables(doc, format_config.get("table_format", {}))

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out
