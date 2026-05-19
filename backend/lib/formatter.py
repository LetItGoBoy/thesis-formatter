"""
.docx格式化模块
backend/lib/formatter.py

读取config/formats/hulunbeier_univ.json，
对原文档进行原地格式修改（不重建文档），保留图片、公式等原始元素。

核心规则：
- 中英文混排字体：中文用宋体/黑体，ASCII用Times New Roman（字符级别）
- 表格不跨页：cantSplit=1
- 三线表：上下1.5磅，标题行下1磅，无其他边框
"""
import io
import re
from copy import deepcopy

from docx import Document
from docx.shared import Pt, Cm, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn, nsmap
from docx.oxml import OxmlElement


# 中文字符范围（含基本汉字+扩展A+常用标点）
CHINESE_RE = re.compile(r'[一-鿿　-〿＀-￯]')

ALIGNMENT_MAP = {
    "left": WD_ALIGN_PARAGRAPH.LEFT,
    "center": WD_ALIGN_PARAGRAPH.CENTER,
    "right": WD_ALIGN_PARAGRAPH.RIGHT,
    "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
}


# ============================================================
# XML工具函数
# ============================================================
def _set_rpr_font(rpr, chinese_font: str, ascii_font: str):
    """在rPr节点上设置中英文字体（east-asia + ascii + hAnsi + cs）"""
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    rfonts.set(qn("w:ascii"), ascii_font)
    rfonts.set(qn("w:hAnsi"), ascii_font)
    rfonts.set(qn("w:eastAsia"), chinese_font)
    rfonts.set(qn("w:cs"), ascii_font)


def _set_rpr_size(rpr, font_size_pt: float):
    """设置字号（半磅单位）"""
    half_pt = str(int(font_size_pt * 2))
    sz = rpr.find(qn("w:sz"))
    if sz is None:
        sz = OxmlElement("w:sz")
        rpr.append(sz)
    sz.set(qn("w:val"), half_pt)
    szcs = rpr.find(qn("w:szCs"))
    if szcs is None:
        szcs = OxmlElement("w:szCs")
        rpr.append(szcs)
    szcs.set(qn("w:val"), half_pt)


def _set_rpr_bold(rpr, bold: bool):
    b = rpr.find(qn("w:b"))
    if bold:
        if b is None:
            b = OxmlElement("w:b")
            rpr.append(b)
        b.set(qn("w:val"), "1")
        bcs = rpr.find(qn("w:bCs"))
        if bcs is None:
            bcs = OxmlElement("w:bCs")
            rpr.append(bcs)
        bcs.set(qn("w:val"), "1")
    else:
        if b is not None:
            rpr.remove(b)
        bcs = rpr.find(qn("w:bCs"))
        if bcs is not None:
            rpr.remove(bcs)


def _get_or_create_rpr(run_element):
    rpr = run_element.find(qn("w:rPr"))
    if rpr is None:
        rpr = OxmlElement("w:rPr")
        run_element.insert(0, rpr)
    return rpr


# ============================================================
# 中英文混排：字符级拆分run
# ============================================================
def _is_chinese(ch: str) -> bool:
    return bool(CHINESE_RE.match(ch))


def _split_text_by_script(text: str) -> list[tuple[str, str]]:
    """
    把文字按中文/非中文切片。
    返回 [(segment, script), ...]，script ∈ {"zh", "en"}
    """
    if not text:
        return []
    segments = []
    cur = [text[0]]
    cur_script = "zh" if _is_chinese(text[0]) else "en"
    for ch in text[1:]:
        script = "zh" if _is_chinese(ch) else "en"
        if script == cur_script:
            cur.append(ch)
        else:
            segments.append(("".join(cur), cur_script))
            cur = [ch]
            cur_script = script
    segments.append(("".join(cur), cur_script))
    return segments


def _apply_mixed_font_to_paragraph(paragraph, chinese_font: str, ascii_font: str,
                                    font_size_pt: float, bold: bool):
    """
    遍历paragraph的所有run，对每个run按字符级拆分中英文，
    应用对应的字体。保留run原有的其他属性（颜色、下划线等）。
    """
    p_element = paragraph._p
    runs = list(paragraph.runs)
    if not runs:
        return

    for run in runs:
        original_text = run.text
        if not original_text:
            # 空run只更新字体属性
            rpr = _get_or_create_rpr(run._r)
            _set_rpr_font(rpr, chinese_font, ascii_font)
            _set_rpr_size(rpr, font_size_pt)
            _set_rpr_bold(rpr, bold)
            continue

        segments = _split_text_by_script(original_text)
        if len(segments) == 1:
            # 单一脚本，直接改字体
            rpr = _get_or_create_rpr(run._r)
            _set_rpr_font(rpr, chinese_font, ascii_font)
            _set_rpr_size(rpr, font_size_pt)
            _set_rpr_bold(rpr, bold)
            continue

        # 多脚本混合：拆分为多个run
        original_rpr = run._r.find(qn("w:rPr"))
        original_r = run._r

        # 创建新run列表插入到原run后面
        new_elements = []
        for seg_text, _script in segments:
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
            new_elements.append(new_r)

        # 插入新run，删除原run
        parent = original_r.getparent()
        idx = list(parent).index(original_r)
        for offset, new_r in enumerate(new_elements):
            parent.insert(idx + offset, new_r)
        parent.remove(original_r)


# ============================================================
# 段落样式应用
# ============================================================
def _apply_paragraph_style(paragraph, style: dict):
    """
    对单段应用样式：对齐、行距、缩进、字体（含中英文混排）。
    """
    pf = paragraph.paragraph_format

    # 对齐
    align = style.get("alignment", "justify")
    if align in ALIGNMENT_MAP:
        paragraph.alignment = ALIGNMENT_MAP[align]

    # 行距
    line_spacing = style.get("line_spacing")
    if line_spacing is not None:
        pf.line_spacing = float(line_spacing)
        pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE

    # 段前段后
    space_before = style.get("space_before_pt")
    if space_before is not None:
        pf.space_before = Pt(float(space_before))
    space_after = style.get("space_after_pt")
    if space_after is not None:
        pf.space_after = Pt(float(space_after))

    # 首行缩进（按中文字符数，1字符≈字号大小）
    indent_chars = style.get("first_line_indent_chars", 0)
    font_size_pt = float(style.get("font_size_pt", 12))
    if indent_chars and indent_chars > 0:
        pf.first_line_indent = Pt(indent_chars * font_size_pt)
    else:
        pf.first_line_indent = None

    # 悬挂缩进（参考文献）
    hanging = style.get("hanging_indent_chars", 0)
    if hanging and hanging > 0:
        pf.left_indent = Pt(hanging * font_size_pt)
        pf.first_line_indent = Pt(-hanging * font_size_pt)

    # 分页前（h1）
    if style.get("page_break_before"):
        pf.page_break_before = True

    # 字体（含中英文混排）
    chinese_font = style.get("chinese_font", "宋体")
    ascii_font = style.get("ascii_font", "Times New Roman")
    bold = bool(style.get("bold", False))
    _apply_mixed_font_to_paragraph(paragraph, chinese_font, ascii_font, font_size_pt, bold)


# ============================================================
# 表格：不跨页 + 三线表
# ============================================================
def _set_cell_borders(cell, borders: dict):
    """
    borders示例: {"top": 1.5, "bottom": 1.0, "left": 0, "right": 0, "insideH": 0, "insideV": 0}
    单位：磅，0表示无边框。
    """
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = tc_pr.find(qn("w:tcBorders"))
    if tc_borders is not None:
        tc_pr.remove(tc_borders)
    tc_borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        if edge in borders:
            border_el = OxmlElement(f"w:{edge}")
            pt_val = borders[edge]
            if pt_val and pt_val > 0:
                border_el.set(qn("w:val"), "single")
                border_el.set(qn("w:sz"), str(int(pt_val * 8)))  # 1/8磅单位
                border_el.set(qn("w:space"), "0")
                border_el.set(qn("w:color"), "000000")
            else:
                border_el.set(qn("w:val"), "nil")
            tc_borders.append(border_el)
    tc_pr.append(tc_borders)


def _format_tables(doc, table_config: dict):
    """对所有表格应用：不跨页 + 三线表 + 字体"""
    cant_split = bool(table_config.get("cant_split", True))
    three_line_cfg = table_config.get("three_line", {})
    three_line_on = bool(three_line_cfg.get("enabled", True))
    top_pt = float(three_line_cfg.get("top_border_pt", 1.5))
    bottom_pt = float(three_line_cfg.get("bottom_border_pt", 1.5))
    header_bottom_pt = float(three_line_cfg.get("header_bottom_border_pt", 1.0))
    inner_pt = float(three_line_cfg.get("inner_border_pt", 0))

    table_font = table_config.get("font", {})
    table_chinese_font = table_font.get("chinese_font", "宋体")
    table_ascii_font = table_font.get("ascii_font", "Times New Roman")
    table_font_size = float(table_font.get("font_size_pt", 10.5))

    for table in doc.tables:
        rows = table.rows
        row_count = len(rows)
        if row_count == 0:
            continue

        # 1. cantSplit：每行不允许跨页
        if cant_split:
            for row in rows:
                tr_pr = row._tr.get_or_add_trPr()
                cant = tr_pr.find(qn("w:cantSplit"))
                if cant is None:
                    cant = OxmlElement("w:cantSplit")
                    tr_pr.append(cant)

        # 2. 三线表边框
        if three_line_on:
            for r_idx, row in enumerate(rows):
                for cell in row.cells:
                    borders = {"left": 0, "right": 0}
                    if r_idx == 0:
                        # 首行：顶部1.5磅，底部1磅
                        borders["top"] = top_pt
                        borders["bottom"] = header_bottom_pt
                    elif r_idx == row_count - 1:
                        # 末行：底部1.5磅，顶部由上一行bottom处理
                        borders["top"] = inner_pt
                        borders["bottom"] = bottom_pt
                    else:
                        # 中间行：无横线
                        borders["top"] = inner_pt
                        borders["bottom"] = inner_pt
                    if row_count == 1:
                        borders = {"top": top_pt, "bottom": bottom_pt, "left": 0, "right": 0}
                    _set_cell_borders(cell, borders)

        # 3. 单元格字体
        for row in rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _apply_mixed_font_to_paragraph(
                        para, table_chinese_font, table_ascii_font, table_font_size, False
                    )


# ============================================================
# 页面设置
# ============================================================
def _apply_page_settings(doc, page_config: dict):
    for section in doc.sections:
        if "margin_top_cm" in page_config:
            section.top_margin = Cm(float(page_config["margin_top_cm"]))
        if "margin_bottom_cm" in page_config:
            section.bottom_margin = Cm(float(page_config["margin_bottom_cm"]))
        if "margin_left_cm" in page_config:
            section.left_margin = Cm(float(page_config["margin_left_cm"]))
        if "margin_right_cm" in page_config:
            section.right_margin = Cm(float(page_config["margin_right_cm"]))


# ============================================================
# 主入口
# ============================================================
def format_docx(paragraphs: list[dict], format_config: dict,
                source_bytes: bytes = None) -> io.BytesIO:
    """
    对.docx进行原地格式化。

    paragraphs: 用户确认后的段落列表 [{"index": int, "type": str, "text": str}, ...]
    format_config: 从hulunbeier_univ.json加载的格式规则
    source_bytes: 原始.docx字节流。若提供，则在原文档上修改；否则新建空文档。
    """
    if source_bytes:
        doc = Document(io.BytesIO(source_bytes))
    else:
        doc = Document()

    styles = format_config.get("paragraph_styles", {})
    type_map = {p["index"]: p for p in paragraphs}

    # 应用页面设置
    _apply_page_settings(doc, format_config.get("page", {}))

    # 遍历段落，按用户确认的type查找样式
    for i, paragraph in enumerate(doc.paragraphs):
        confirmed = type_map.get(i)
        if confirmed:
            # 如果用户编辑了文字，则替换文字
            new_text = confirmed.get("text")
            if new_text is not None and new_text != paragraph.text:
                # 清空原run，写入新文字（会丢失原run内的图片等，但用户改文字是显式的）
                for run in list(paragraph.runs):
                    run.text = ""
                if paragraph.runs:
                    paragraph.runs[0].text = new_text
                else:
                    paragraph.add_run(new_text)

            ptype = confirmed.get("type", "body")
        else:
            ptype = "body"

        style = styles.get(ptype) or styles.get("body", {})
        _apply_paragraph_style(paragraph, style)

    # 表格格式化
    _format_tables(doc, format_config.get("table", {}))

    # 保存到BytesIO
    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output
