"""
.docx文档解析模块
backend/lib/parser.py

用python-docx提取段落，调用ai_client分类。
保留段落顺序和原始索引，一段不漏。
每识别一个段落打印一行日志，便于排查卡顿。
"""
import io
import logging
import time
from docx import Document

from .ai_client import (
    AIFatalError,
    classify_paragraph,
    get_ai_client,
)

logger = logging.getLogger("thesis.parser")


class ParseError(Exception):
    """对外抛出的解析失败异常，message是给用户看的具体原因"""
    pass


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

    抛出 ParseError 表示用户可读的失败信息。
    """
    try:
        raw_paragraphs = extract_paragraphs(file_bytes)
    except Exception as e:
        raise ParseError(f".docx文件解析失败，可能已损坏: {e}") from e

    total = len(raw_paragraphs)
    non_empty = [p for p in raw_paragraphs if p["text"].strip()]
    n_non_empty = len(non_empty)
    logger.info("开始解析：共 %d 段（其中非空 %d 段）", total, n_non_empty)

    try:
        client = get_ai_client()
    except Exception as e:
        raise ParseError(f"AI客户端初始化失败（请检查AI_PROVIDER和API_KEY环境变量）: {e}") from e

    classified_map: dict[int, dict] = {}
    consecutive_failures = 0
    started = time.monotonic()

    for i, para in enumerate(non_empty, start=1):
        idx = para["index"]
        text = para["text"]
        preview = text.strip().replace("\n", " ")[:30]
        t0 = time.monotonic()
        logger.info("正在识别第 %d/%d 段 (原索引#%d): %s", i, n_non_empty, idx, preview)

        try:
            result = classify_paragraph(client, text)
            elapsed = time.monotonic() - t0
            logger.info(
                "  ✓ 第 %d/%d 段识别完成 type=%s conf=%.2f 用时%.1fs",
                i, n_non_empty, result["type"], result["confidence"], elapsed,
            )
            consecutive_failures = 0
            classified_map[idx] = {**para, **result}
        except AIFatalError as e:
            # 认证/网络问题，立即中止整个解析
            logger.error("致命错误，中止解析: %s", e)
            raise ParseError(str(e)) from e
        except Exception as e:
            elapsed = time.monotonic() - t0
            consecutive_failures += 1
            logger.warning(
                "  ✗ 第 %d/%d 段识别失败 用时%.1fs: %s",
                i, n_non_empty, elapsed, e,
            )
            classified_map[idx] = {
                **para,
                "type": "body",
                "confidence": 0.3,
                "reason": f"识别失败: {e}",
            }
            # 连续失败超过阈值，判定为服务不可用，中止
            if consecutive_failures >= 3 and i <= 5:
                raise ParseError(
                    f"AI识别连续 {consecutive_failures} 次失败，已中止。"
                    f"最近错误: {e}"
                ) from e

    total_elapsed = time.monotonic() - started
    logger.info("解析完成：%d 段，用时 %.1fs", n_non_empty, total_elapsed)

    # 合并：空段落自动归为body
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
