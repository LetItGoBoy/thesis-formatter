"""
.docx文档解析模块
backend/lib/parser.py

用python-docx提取段落，调用ai_client分类。
保留段落顺序和原始索引，一段不漏。
"""
import io
from docx import Document

from .ai_client import classify_paragraphs


def extract_paragraphs(file_bytes: bytes) -> list[dict]:
    """
    从.docx字节流提取所有段落。
    保留段落顺序和索引（包括空段落，索引用于回写时定位）。

    返回: [{"index": int, "text": str}, ...]
    """
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = []
    for i, para in enumerate(doc.paragraphs):
        text = para.text if para.text is not None else ""
        paragraphs.append({"index": i, "text": text})
    return paragraphs


def parse_docx(file_bytes: bytes) -> list[dict]:
    """
    解析.docx并调用AI分类。
    返回: [{"index": int, "text": str, "type": str, "confidence": float, "reason": str}, ...]
    """
    raw_paragraphs = extract_paragraphs(file_bytes)

    # 过滤纯空段落送AI节省成本，但保留在结果中
    non_empty = [p for p in raw_paragraphs if p["text"].strip()]
    classified = classify_paragraphs(non_empty)

    classified_map = {p["index"]: p for p in classified}

    results = []
    for p in raw_paragraphs:
        if p["index"] in classified_map:
            results.append(classified_map[p["index"]])
        else:
            results.append({
                "index": p["index"],
                "text": p["text"],
                "type": "body",
                "confidence": 1.0,
                "reason": "空段落",
            })
    return results
