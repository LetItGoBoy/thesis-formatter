"""
V2 识别器：纯 AI 语义切块 + 块内专属 prompt 分类。
backend/lib/semantic_v2.py

设计思路（与 v1 整片批量识别的区别）：
  v1：规则跳封面/声明 -> 整篇一次性批量分类（所有类型同时竞争，易混淆）
  v2：两步走
      第一步 切块：整篇喂 AI，纯语义判断每段属于哪个大块（含正文按章切分）。
                   不用任何关键词规则——学生写法千差万别，可能缺摘要/总结、
                   可能不写"摘要""参考文献"等关键词，只能靠语义。
      第二步 块内识别：每个大块单独送 AI，用该块专属 prompt，候选类型只有
                   3~8 个，歧义大幅减少，精度更高。

块处理策略（用户已确认）：
  - cover / declaration       -> 整块丢弃，不进入格式化
  - acknowledgement / appendix -> 识别出边界但保持原样（type=passthrough，不重排）
  - 其余                       -> 块内识别后按学院规范重排

通过环境变量 RECOGNIZER=semantic_v2 启用；默认仍走 v1（parser 原路径）。
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from .ai_client import (
    get_ai_client,
    _chat_with_retry,
    _extract_json_array,
    AIFatalError,
    compute_rule_confidence,
    apply_pattern_override,
    TYPE_DESC,
)

logger = logging.getLogger("thesis.ai.v2")

# ============================================================
# 切块阶段词表：一篇完整论文「可能」出现的所有大块
# 不固定顺序、不固定数量；缺哪块 AI 就不输出哪块。
# ============================================================
SEG_DISCARD = {"cover", "declaration"}            # 整块丢弃
SEG_PASSTHROUGH = {"acknowledgement", "appendix"}  # 识别但不重排

# 切块 type -> 前端五大块（toc/abstract/body/conclusion/references）
SEG_TO_FINAL = {
    "toc": "toc",
    "abstract_cn": "abstract",
    "abstract_en": "abstract",
    "body": "body",          # body_ch1 / body_ch2 ... 统一归 body
    "conclusion": "conclusion",
    "references": "references",
}

SEG_BLOCK_DESC = {
    "cover": "封面（题目/学校/姓名/学号/专业/日期等，无正文叙述）",
    "declaration": "原创性声明 / 知识产权声明（含'特此声明'、签名、日期）",
    "toc": "目录（带页码的章节条目，行尾通常是页码数字）",
    "abstract_cn": "中文摘要部分（论文题目、作者、指导老师、'摘要'标题、摘要正文、中文关键词）",
    "abstract_en": "英文摘要部分（Abstract 标题、英文摘要正文、Keywords）",
    "body_chN": "正文的第 N 章。每一章是独立一块，N 从 1 开始按【出现顺序】连续编号"
                "（即使原文第一个出现的章写作'第三章'或直接是'绪论'，也记为 body_ch1）。"
                "章标题写法多样：'第一章 绪论' / '第1章 绪论' / '1 绪论' / '一、绪论'，"
                "甚至直接是章名'绪论'而没有任何章号。判断依据是语义：它开启了一段"
                "包含 1.1 / 1.2 等小节的正文内容，而不是靠是否出现'第X章'字样。",
    "conclusion": "总结 / 结论（全文末尾的总结性章节，不带 1.1/1.2 小节，"
                  "不属于编号正文章节；可能写作'总结''结论''结语'）",
    "references": "参考文献（'参考文献'/'REFERENCES' 标题及其下的文献条目）",
    "acknowledgement": "致谢（向师长亲友致谢的一段话，通常很短）",
    "appendix": "附录（'附录A''附录1'等，常含代码/表格/问卷等附加材料）",
}

# ============================================================
# 块内识别：每个大块允许的候选类型（只在本块类型里选）
# ============================================================
V2_BLOCK_TYPES = {
    "toc": ["toc_title", "toc_h1", "toc_h2", "toc_h3"],
    "abstract_cn": ["paper_title", "author_line", "instructor",
                    "abstract_title_cn", "abstract_body_cn", "keywords_cn"],
    "abstract_en": ["abstract_title_en", "abstract_body_en", "keywords_en"],
    "body": ["h1", "h2", "h3", "body", "numbered_item",
             "table_caption", "figure_caption", "formula", "formula_number"],
    "conclusion": ["conclusion_title", "conclusion_body"],
    "references": ["references_title", "reference_item"],
}

V2_BLOCK_DEFAULT = {
    "toc": "toc_h1", "abstract_cn": "abstract_body_cn", "abstract_en": "abstract_body_en",
    "body": "body", "conclusion": "conclusion_body", "references": "reference_item",
}

V2_BLOCK_LABEL = {
    "toc": "目录", "abstract_cn": "中文摘要", "abstract_en": "英文摘要",
    "body": "正文", "conclusion": "总结", "references": "参考文献",
}

# 各块的额外判别要点（注入块内识别 prompt，消解最易混淆的类型）
V2_BLOCK_HINTS = {
    "toc": [
        "只有带页码（行尾是数字）的条目才是 toc_*；toc_title 就是'目录'两字。",
        "toc_h1 含章号或为一级条目，toc_h2 形如'1.1 xxx'，toc_h3 形如'1.1.1 xxx'。",
    ],
    "abstract_cn": [
        "author_line 是作者本人信息（姓名/学号/专业），绝不含'指导''老师''教师'字样。",
        "instructor 必须含'指导老师''指导教师''Supervisor'等字样，才算指导老师行。",
        "keywords_cn 只有几个短词、极短（一般不超过 60 字）；成段长句即使在摘要里也是 abstract_body_cn，绝不是关键词。",
        "paper_title 是论文题目，很短、无句末标点。",
    ],
    "abstract_en": [
        "keywords_en 以 Keywords / Key words 开头，只有几个短词；成段英文叙述是 abstract_body_en。",
        "单独一行的 Abstract 是 abstract_title_en。",
    ],
    "body": [
        "h1 是【本章】的章标题，通常是本块的第一行，形如'第X章 章名'或直接是章名；每个块最多一个 h1。",
        "h2 形如'1.1 xxx'，h3 形如'1.1.1 xxx'；所有标题都很短、不带句末标点（。！？）。",
        "成段的长句叙述是 body；以'图X-X'开头的短行是 figure_caption，以'表X-X'开头的是 table_caption。",
        "单独成行的公式编号'(2-1)'是 formula_number。",
    ],
    "conclusion": [
        "conclusion_title 是'总结''结论''结语'等标题（很短）；其余成段文字是 conclusion_body。",
    ],
    "references": [
        "references_title 是'参考文献'/'REFERENCES'标题；其余每一条文献是 reference_item。",
    ],
}


# ============================================================
# 第一步：语义切块
# ============================================================
def _seg_system_prompt() -> str:
    lines = [
        "你是学术论文结构分析助手。下面给出一篇本科毕业论文按文档顺序排列的全部段落"
        "（每段前的方括号是它的编号 index）。请通读全文、理解整体结构，把连续的段落"
        "切分成若干「大块」，输出每个大块覆盖的 index 区间。",
        "",
        "一篇完整论文可能包含以下大块（按常见顺序，但实际顺序/有无以正文为准）：",
    ]
    for k, v in SEG_BLOCK_DESC.items():
        lines.append(f"- {k}: {v}")
    lines += [
        "",
        "论文典型结构（仅供参考，实际以语义为准）：",
        "  封面 → 声明 → [目录] → [中文摘要] → [英文摘要] → 正文各章 → [总结] → 参考文献 → [致谢] → [附录]",
        "  方括号表示该块可能缺失。目录有时在摘要之前、有时在之后。",
        "",
        "切块要求（极重要）：",
        "1. 完全靠语义判断，不要只看是否出现某个关键词——很多学生不写'摘要''参考文献'"
        "等字样，或根本没有某些大块（如没写总结、没写英文摘要），这些都要正确应对。",
        "2. 正文必须按【章】切开：每一章是一个独立的块，type 写 body_ch1 / body_ch2 / "
        "body_ch3 …… 按出现顺序连续编号（见上面 body_chN 的说明）。每个 body_chN 块"
        "应当从该章的章标题那一段开始，到下一章标题前一段结束。",
        "3. 区间必须连续且完整覆盖：所有大块的 [start,end] 拼起来必须恰好等于"
        "[0, 最大index]，不重叠、不留空隙、不遗漏任何一段。",
        "4. 缺失的大块直接不输出（例如没有英文摘要就没有 abstract_en）。",
        "5. cover / declaration 即使存在也要切出来（后续会丢弃，但切块阶段要标出）。",
        "6. 区分'总结'与正文末章：总结/结论不含 1.1/1.2 小节、是全文性回顾；"
        "若末章仍是带小节的普通章节，它属于 body_chN 而不是 conclusion。",
        "",
        "输出规则：",
        "- 只输出 JSON，不要 markdown 标记、不要解释。",
        '- 格式：{"blocks":[{"type":"...","start":数字,"end":数字}, ...]}',
        "- start/end 为该块首段、末段的 index（闭区间），均为输入方括号中的编号。",
    ]
    return "\n".join(lines)


def _seg_user_message(text_items: list[dict]) -> str:
    """切块阶段发送完整全文（不截断），表格/图片用占位标记表示其位置。"""
    lines = ["以下是论文全部段落，请切块。只输出 JSON：", ""]
    for it in text_items:
        lines.append(f"[{it['index']}] {it['text']}")
    lines += ["", '输出：{"blocks":[{"type":"...","start":N,"end":M}, ...]}']
    return "\n".join(lines)


def _placeholder_text(it: dict) -> str:
    kind = it.get("kind")
    if kind == "table":
        return "〈表格〉" + (it.get("text", "")[:60])
    if kind == "image":
        return "〈图片〉"
    return (it.get("text") or "").strip().replace("\n", " ")


def segment_document(raw_items: list[dict], tier: str | None) -> list[dict]:
    """整篇语义切块。返回 [{type, start, end}, ...]（已校验为连续全覆盖）。"""
    text_items = [{"index": it["index"], "text": _placeholder_text(it)} for it in raw_items]
    client = get_ai_client(tier)
    resp = _chat_with_retry(client, _seg_system_prompt(), _seg_user_message(text_items))

    try:
        data = _extract_json_array(_coerce_to_array(resp))
    except Exception as e:
        raise AIFatalError(f"切块响应解析失败: {e} | {(resp or '')[:200]}") from e

    blocks = []
    for b in data:
        if not isinstance(b, dict):
            continue
        t = b.get("type")
        s, e = b.get("start"), b.get("end")
        if isinstance(t, str) and isinstance(s, int) and isinstance(e, int) and s <= e:
            blocks.append({"type": t, "start": s, "end": e})
    if not blocks:
        raise AIFatalError("切块未返回任何有效区间")

    return _repair_coverage(blocks, raw_items)


def _coerce_to_array(resp: str) -> str:
    """把 {"blocks":[...]} 包装成裸数组字符串，复用 _extract_json_array。"""
    import json, re
    s = (resp or "").strip()
    if s.startswith("```"):
        m = re.search(r"```(?:json)?\s*(.+?)```", s, re.DOTALL)
        if m:
            s = m.group(1).strip()
    try:
        obj = json.loads(s)
        if isinstance(obj, dict) and "blocks" in obj:
            return json.dumps(obj["blocks"], ensure_ascii=False)
        if isinstance(obj, list):
            return s
    except Exception:
        pass
    m = re.search(r'"blocks"\s*:\s*(\[.*\])', s, re.DOTALL)
    if m:
        return m.group(1)
    return s


def _repair_coverage(blocks: list[dict], raw_items: list[dict]) -> list[dict]:
    """按 start 排序，修补缝隙/重叠，保证连续全覆盖 [0, max_index]。"""
    idxs = [it["index"] for it in raw_items]
    lo, hi = min(idxs), max(idxs)
    blocks = sorted(blocks, key=lambda b: b["start"])

    repaired = []
    cursor = lo
    for b in blocks:
        s = max(b["start"], cursor)
        e = b["end"]
        if e < s:
            continue  # 完全被前块吞掉，丢弃
        if b["start"] > cursor and repaired:
            # 缝隙：并入前一块
            repaired[-1]["end"] = b["start"] - 1
        repaired.append({"type": b["type"], "start": s, "end": e})
        cursor = e + 1

    if not repaired:
        raise AIFatalError("切块修补后为空")
    # 末尾补齐到 hi
    if repaired[-1]["end"] < hi:
        repaired[-1]["end"] = hi
    # 开头补齐到 lo（极少见）
    if repaired[0]["start"] > lo:
        repaired[0]["start"] = lo

    logger.info("切块结果：%s", " | ".join(f"{b['type']}[{b['start']}-{b['end']}]" for b in repaired))
    return repaired


# ============================================================
# 第二步：块内识别（专属 prompt）
# ============================================================
def _classify_key(seg_type: str) -> str | None:
    """切块 type -> 块内识别用的 prompt/类型表 key（V2_BLOCK_TYPES 的键）。
    abstract_cn / abstract_en 各用专属 prompt；body_chN 统一用 body。
    cover/declaration/acknowledgement/appendix 不分类，返回 None。"""
    if seg_type.startswith("body_ch"):
        return "body"
    return seg_type if seg_type in V2_BLOCK_TYPES else None


def _final_block(seg_type: str) -> str | None:
    """切块 type -> 前端五大块（abstract_cn/en -> abstract，body_chN -> body）。"""
    if seg_type.startswith("body_ch"):
        return "body"
    return SEG_TO_FINAL.get(seg_type)


def _block_system_prompt(block: str) -> str:
    types = V2_BLOCK_TYPES[block]
    label = V2_BLOCK_LABEL[block]
    lines = [
        f"你是学术论文段落格式分类助手。下面这一批段落都来自论文的【{label}】部分，"
        f"请只在【{label}】允许的类型里给每段分类，输出 JSON 数组。",
        "",
        f"【{label}】允许的类型（只能从这些里选，不得使用其他类型）：",
    ]
    for t in types:
        lines.append(f"- {t}: {TYPE_DESC.get(t, t)}")
    hints = V2_BLOCK_HINTS.get(block)
    if hints:
        lines.append("")
        lines.append("判别要点：")
        for h in hints:
            lines.append(f"- {h}")
    lines += [
        "",
        "输出规则（极重要）：",
        "1. 只输出 JSON 数组，不要 markdown 标记、不要解释",
        "2. 元素数必须等于输入段落数，每段都分类，一段都不能漏",
        '3. 每元素格式：{"index": 数字, "type": "类型"}',
        "4. index 必须精确等于输入方括号中的编号",
        "5. type 只能是上面列出的类型，绝不允许其他值",
    ]
    return "\n".join(lines)


def _block_user_message(items: list[dict]) -> str:
    lines = ["请识别以下段落的类型。只输出 JSON 数组：", ""]
    for it in items:
        text = (it.get("text") or "").strip().replace("\n", " ")
        lines.append(f"[{it['index']}] {text}")
    lines += ["", '输出：[{"index":N,"type":"xxx"}, ...]']
    return "\n".join(lines)


def classify_block(client, block: str, items: list[dict]) -> dict[int, str]:
    """对单个大块内的文本段做分类，返回 {index: type}。"""
    text_items = [it for it in items if it.get("kind") not in ("table", "image")]
    if not text_items:
        return {}
    allowed = set(V2_BLOCK_TYPES[block])
    fallback = V2_BLOCK_DEFAULT[block]
    resp = _chat_with_retry(client, _block_system_prompt(block), _block_user_message(text_items))

    try:
        arr = _extract_json_array(resp)
    except Exception as e:
        logger.warning("块[%s]解析失败，整块回退 %s: %s", block, fallback, e)
        return {it["index"]: fallback for it in text_items}

    text_by_idx = {it["index"]: it.get("text", "") for it in text_items}
    out: dict[int, str] = {}
    for entry in arr:
        if not isinstance(entry, dict):
            continue
        idx = entry.get("index")
        if not isinstance(idx, int) or idx not in text_by_idx:
            continue
        t = entry.get("type", fallback)
        if t not in allowed:
            t = fallback
        t2 = apply_pattern_override(text_by_idx[idx], t)
        if t2 != t and t2 in allowed:
            t = t2
        out[idx] = t
    for it in text_items:
        out.setdefault(it["index"], fallback)
    return out


# ============================================================
# 总入口
# ============================================================
def recognize_v2(raw_items: list[dict], tier: str | None = None) -> list[dict]:
    """
    V2 识别主流程。
    raw_items: parser.extract_blocks 的全部块（含封面/声明），
               每项 {index, text, kind?, cells?, image_*?, orig_style?}
    返回最终段落列表（封面/声明已剔除）：
        [{index, text, type, confidence, reason, block, ...}]
    """
    if not raw_items:
        return []

    by_index = {it["index"]: it for it in raw_items}

    # 第一步：切块
    segments = segment_document(raw_items, tier)

    # 第二步：逐块识别（可分类的块并发跑）
    client = get_ai_client(tier)
    classify_tasks = []  # (seg_idx, classify_key, items)
    for si, seg in enumerate(segments):
        if seg["type"] in SEG_DISCARD or seg["type"] in SEG_PASSTHROUGH:
            continue
        ckey = _classify_key(seg["type"])
        if ckey is None:
            continue  # 未知块不送分类
        items = [by_index[i] for i in range(seg["start"], seg["end"] + 1) if i in by_index]
        classify_tasks.append((si, ckey, items))

    type_map: dict[int, str] = {}
    if classify_tasks:
        workers = min(4, len(classify_tasks))
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="v2-block") as pool:
            futures = {
                pool.submit(classify_block, client, ckey, items): (si, ckey)
                for si, ckey, items in classify_tasks
            }
            for fut in as_completed(futures):
                si, ckey = futures[fut]
                try:
                    type_map.update(fut.result())
                except AIFatalError:
                    raise
                except Exception as e:
                    logger.warning("块[%s]识别失败: %s", ckey, e)

    # 组装最终结果
    results = []
    for seg in segments:
        seg_type = seg["type"]
        if seg_type in SEG_DISCARD:
            continue
        passthrough = seg_type in SEG_PASSTHROUGH
        final_block = _final_block(seg_type)
        for i in range(seg["start"], seg["end"] + 1):
            it = by_index.get(i)
            if it is None:
                continue
            kind = it.get("kind")
            if kind == "table":
                results.append({
                    "index": i, "text": it.get("text", ""), "type": "table",
                    "confidence": 1.0, "reason": "解析阶段识别为表格",
                    "block": "body", "cells": it.get("cells"),
                })
                continue
            if kind == "image":
                results.append({
                    "index": i, "text": it.get("text", ""), "type": "figure",
                    "confidence": 1.0, "reason": "解析阶段识别为图片",
                    "block": "body", "image_index": it.get("image_index"),
                    "image_b64": it.get("image_b64"),
                })
                continue
            if passthrough:
                results.append({
                    "index": i, "text": it.get("text", ""), "type": "passthrough",
                    "confidence": 1.0, "reason": f"{seg_type} 块保持原样不重排",
                    "block": seg_type, "orig_style": it.get("orig_style"),
                })
                continue
            ckey = _classify_key(seg_type)
            ptype = type_map.get(i, V2_BLOCK_DEFAULT.get(ckey, "body"))
            results.append({
                "index": i, "text": it.get("text", ""), "type": ptype,
                "confidence": compute_rule_confidence(it.get("text", ""), ptype),
                "reason": f"V2 块内识别（{seg_type}）",
                "block": final_block, "orig_style": it.get("orig_style"),
            })

    results.sort(key=lambda r: r["index"])
    return results
