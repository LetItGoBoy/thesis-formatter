"""
.docx 图片提取共享工具
backend/lib/docx_images.py

解析端与格式化端共用同一套「按文档顺序」的图片遍历逻辑，保证两端为同一张图片
分配/使用相同的 image_index（顶层段落顺序，逐张图片计数）。
- 解析端：为每张图片产出一个 figure 段落（携带 base64 供预览 + image_index）
- 格式化端：按 image_index 从原文 source_bytes 取出原图，居中插回
两端都只遍历 body 顶层段落（与 parser._iter_block_items 的段落顺序一致），
表格单元格内的图片不处理（论文配图几乎都在顶层段落）。
"""
import io

from docx import Document
from docx.oxml.ns import qn
from docx.oxml.text.paragraph import CT_P
from docx.text.paragraph import Paragraph as DocxParagraph


def paragraph_image_refs(paragraph: DocxParagraph) -> list[tuple[str, int | None, int | None]]:
    """返回段落内图片引用 [(rId, cx_emu, cy_emu), ...]，按出现顺序（含 DrawingML 与 VML）。"""
    el = paragraph._element
    refs: list[tuple[str, int | None, int | None]] = []
    # DrawingML：<w:drawing> → <a:blip r:embed> + <wp:extent cx cy>
    for drawing in el.findall(".//" + qn("w:drawing")):
        blip = drawing.find(".//" + qn("a:blip"))
        if blip is None:
            continue
        rid = blip.get(qn("r:embed")) or blip.get(qn("r:link"))
        if not rid:
            continue
        cx = cy = None
        ext = drawing.find(".//" + qn("wp:extent"))
        if ext is not None:
            try:
                cx = int(ext.get("cx"))
                cy = int(ext.get("cy"))
            except (TypeError, ValueError):
                cx = cy = None
        refs.append((rid, cx, cy))
    # VML（老式）：<w:pict> → <v:imagedata r:id>
    for imagedata in el.findall(".//" + qn("v:imagedata")):
        rid = imagedata.get(qn("r:id"))
        if rid:
            refs.append((rid, None, None))
    return refs


def _iter_top_level_paragraphs(doc):
    """按文档顺序产出 body 顶层段落（与 parser._iter_block_items 的段落顺序一致）。"""
    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield DocxParagraph(child, doc)


def extract_ordered_images(file_bytes: bytes) -> list[dict | None]:
    """
    按文档顺序返回图片列表，下标即 image_index。
    每项为 {"blob": bytes, "cx": emu|None, "cy": emu|None}；
    若关系缺失则为 None 占位，保证下标与解析端一致。
    """
    doc = Document(io.BytesIO(file_bytes))
    out: list[dict | None] = []
    for p in _iter_top_level_paragraphs(doc):
        for rid, cx, cy in paragraph_image_refs(p):
            part = doc.part.related_parts.get(rid)
            if part is None:
                out.append(None)
                continue
            out.append({"blob": part.blob, "content_type": part.content_type, "cx": cx, "cy": cy})
    return out
