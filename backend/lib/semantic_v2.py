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
import re
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

# 「第X章」单独成段（其后无章名），用于合并被拆开的章标题
_BARE_CHAPTER_RE = re.compile(r"^第[一二三四五六七八九十百零\d]+章[\s　]*$")

# h2：两级编号（1.1 / 3.7 / 1.1xxx），负前瞻排除三级；h3：三级编号（1.1.1 / 3.7.2xxx）
_H3_NUM_RE = re.compile(r"^\d+\.\d+\.\d+")
_H2_NUM_RE = re.compile(r"^\d+\.\d+(?!\.\d)")

# 结论章标题：「结论」/「总结」/「结语」可选带章号前缀和「与…」后缀
_CONCLUSION_TITLE_RE = re.compile(
    r"^(?:第[一二三四五六七八九十百零\d]+章[　\s]*)?(总结|结论|结语|结束语)"
    r"(?:[　\s]*[与及和].*)?[　\s]*$"
)

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
                  "是对全文的整体回顾；可能写作'总结''结论''结语'，"
                  "也可能写作'第X章 结论''第X章 总结'等带章号形式——"
                  "只要没有 X.1/X.2 小节且是全文性回顾，就属于 conclusion，不是 body_chN）",
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
        "2.5 【目录是一整块·切忌拆成正文】目录里会列出'第X章 …''2.1 …'等条目，"
        "它们【长得很像正文章标题】，但目录条目【行尾都有页码数字】（如'2.1 系统设计  5'、"
        "'第3章 系统硬件设计  15'），而真正的正文章标题【行尾没有页码】。只要一段行尾是"
        "页码、且这种带页码的条目连续成片，它们【全部属于 toc 这一个块】，绝不能切成 "
        "body_chN。目录从第一条带页码条目开始，到最后一条带页码条目结束，中间不许拆开。",
        "3. 区间必须连续且完整覆盖：所有大块的 [start,end] 拼起来必须恰好等于"
        "[0, 最大index]，不重叠、不留空隙、不遗漏任何一段。",
        "4. 缺失的大块直接不输出（例如没有英文摘要就没有 abstract_en）。",
        "5. cover / declaration 即使存在也要切出来（后续会丢弃，但切块阶段要标出）。",
        "6. 区分'总结'与正文末章：总结/结论不含 1.1/1.2 小节、是全文性回顾。"
        "即使写成'第X章 结论''第6章 总结''第X章 结语'，只要没有编号小节、"
        "是全文性总结，就归 conclusion；若末章仍有 X.1/X.2 小节，才是 body_chN。",
        "7. 【边界对齐·极重要】每个块必须从它的标题/起始行开始：章标题（'第X章 …'、"
        "'绪论'、单独成行的'第X章'等）是其所在 body_chN 的【第一段】；'总结'/'结论'"
        "标题是 conclusion 的【第一段】；'参考文献'标题是 references 的【第一段】；"
        "'目录''摘要''Abstract''致谢''附录'同理。这些标题行绝不能划到上一块的末尾——"
        "宁可让上一块早一段结束，也要让标题行成为新块的开头。",
        "8. 章标题可能被学生拆成相邻两段（如一段只有'第5章'、下一段是'系统实现'）。"
        "这种情况两段都要划入【同一个】新章 body_chN 的开头，不要把'第5章'留在上一章。",
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

    blocks = _repair_coverage(blocks, raw_items)
    blocks = _merge_toc_runover(blocks, raw_items)
    by_idx = {it["index"]: it for it in raw_items}
    blocks = _reclassify_conclusion_chapter(blocks, by_idx)
    return blocks


# 目录条目特征：较短、行尾是页码（可带前导点线/空格）。正文章标题不带行尾页码。
_TOC_LINE_RE = re.compile(r"\S.*?[\s.．。…·\-_]+\d{1,4}\s*$")
# 这些块一旦出现就说明目录已结束，不再向后吸收
_TOC_STOP_BLOCKS = {"abstract_cn", "abstract_en", "conclusion", "references",
                    "acknowledgement", "appendix", "cover", "declaration"}


def _looks_like_toc_line(text: str) -> bool:
    t = (text or "").strip()
    if not t or len(t) > 50:   # 目录条目都很短；成段正文不是目录
        return False
    return bool(_TOC_LINE_RE.search(t))


def _merge_toc_runover(blocks: list[dict], raw_items: list[dict]) -> list[dict]:
    """修复 AI 把目录后半截误切成 body_chN 的常见错误。
    目录条目行尾都带页码（如 '2.1 系统设计  5'），正文章标题不带。
    若 toc 块后面紧跟的块整体仍是「带页码的目录条目」，把它们并回目录。"""
    by_index = {it["index"]: it for it in raw_items}

    def seg_text(i: int) -> str:
        it = by_index.get(i)
        if not it or it.get("kind") in ("table", "image"):
            return ""
        return (it.get("text") or "").strip()

    ti = next((k for k, b in enumerate(blocks) if b["type"] == "toc"), None)
    if ti is None:
        return blocks

    last = ti
    for k in range(ti + 1, len(blocks)):
        b = blocks[k]
        if b["type"] in _TOC_STOP_BLOCKS:
            break
        lines = [t for i in range(b["start"], b["end"] + 1) if (t := seg_text(i))]
        if not lines:
            break
        toc_like = sum(1 for l in lines if _looks_like_toc_line(l))
        if toc_like >= max(1, len(lines) * 0.6):
            last = k          # 整体仍是目录条目 -> 吸收
        else:
            break             # 出现真正的正文 -> 目录到此为止

    if last == ti:
        return blocks
    blocks[ti]["end"] = blocks[last]["end"]
    merged = blocks[:ti + 1] + blocks[last + 1:]
    logger.info("TOC 修复：将误判为正文的 %d 个块并回目录 -> toc[%d-%d]",
                last - ti, blocks[ti]["start"], blocks[ti]["end"])
    return merged


def _reclassify_conclusion_chapter(blocks: list[dict], by_index: dict) -> list[dict]:
    """把写成「第X章 结论/总结/结语」的 body_chN 重归类为 conclusion。
    仅检测每个 body_ch 块的首个文本段：若完全匹配结论章标题模式则重分类。"""
    result = []
    for b in blocks:
        nb = dict(b)
        if b["type"].startswith("body_ch"):
            for i in range(b["start"], b["end"] + 1):
                it = by_index.get(i)
                if not it or it.get("kind") in ("table", "image"):
                    continue
                text = (it.get("text") or "").strip()
                if not text:
                    continue
                if len(text) <= 20 and _CONCLUSION_TITLE_RE.match(text):
                    nb["type"] = "conclusion"
                    logger.info("结论修复：%s -> conclusion（首段='%s'）", b["type"], text)
                break
        result.append(nb)
    return result


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
# 经济版：纯规则识别，不调用 AI
# ============================================================
_ECON_TOC_TITLE_RE = re.compile(r"^目\s*录$")
_ECON_ABS_CN_RE = re.compile(r"^摘\s*要$")
_ECON_ABS_EN_RE = re.compile(r"^abstract$", re.IGNORECASE)
_ECON_REFS_TITLE_RE = re.compile(r"^参\s*考\s*文\s*献$")
_ECON_ACK_RE = re.compile(r"^(?:致\s*谢|附\s*录)")
_ECON_KW_CN_RE = re.compile(r"^(?:关键词|关键字)\s*[:：]")
_ECON_KW_EN_RE = re.compile(r"^keywords?\s*[:：]", re.IGNORECASE)
_ECON_CHAPTER_RE = re.compile(r"^第[一二三四五六七八九十百零\d]+章")
_ECON_INSTR_RE = re.compile(r"指导(老师|教师|教授)|Supervisor|导师")
_ECON_AUTHOR_RE = re.compile(r"^(?:作者|学生)[:：]?|学号[:：]|专业[:：]|姓名[:：]")


def recognize_economy(raw_items: list[dict]) -> list[dict]:
    """
    纯规则识别，不调用 AI，供经济版使用。精度约 60%，速度极快。
    通过关键词/数字模式状态机推断段落类型，不受 token 限制。
    """
    from .parser import select_content_items

    kept = select_content_items(raw_items)
    block = "pre"  # pre / toc / abstract_cn / abstract_en / body / conclusion / references / extra
    results: list[dict] = []

    def _append(it, ptype, conf, reason, blk):
        entry = {
            "index": it["index"], "text": (it.get("text") or "").strip(),
            "type": ptype, "confidence": conf, "reason": reason, "block": blk,
        }
        if it.get("orig_style"):
            entry["orig_style"] = it["orig_style"]
        results.append(entry)

    for it in kept:
        kind = it.get("kind")
        raw_text = it.get("text") or ""
        text = raw_text.strip()
        nt = re.sub(r"\s+", "", text)
        orig = it.get("orig_style") or {}

        if kind == "table":
            results.append({
                "index": it["index"], "text": raw_text, "type": "table",
                "confidence": 1.0, "reason": "规则识别:表格", "block": "body",
                "cells": it.get("cells"),
            })
            continue
        if kind == "image":
            results.append({
                "index": it["index"], "text": raw_text, "type": "figure",
                "confidence": 1.0, "reason": "规则识别:图片", "block": "body",
                "image_index": it.get("image_index"), "image_b64": it.get("image_b64"),
            })
            continue
        if not text:
            continue

        # 目录是一整块：目录条目「第X章…3」「2.1 …5」长得像正文章标题，但行尾都带页码。
        # 在目录块内，只要本行还带页码就继续算目录条目，绝不触发正文/章节跳转；
        # 直到出现一行【不带页码】（真正的章标题/摘要标题等），才退出目录块重新判定。
        if block == "toc":
            if _ECON_TOC_TITLE_RE.match(nt) or _TOC_LINE_RE.search(text):
                lstripped = text.lstrip()
                lead = len(text) - len(lstripped)
                if _H3_NUM_RE.match(lstripped):
                    ptype = "toc_h3"
                elif _H2_NUM_RE.match(lstripped):
                    ptype = "toc_h2"
                elif lead >= 4:
                    ptype = "toc_h3"
                elif lead >= 2:
                    ptype = "toc_h2"
                else:
                    ptype = "toc_h1"
                _append(it, ptype, 0.7, "规则:目录条目", "toc")
                continue
            block = "pre"  # 目录结束，下面重新判定本行属于哪个块

        # ── Block transition anchors ──
        if _ECON_TOC_TITLE_RE.match(nt) and block in ("pre", "abstract_cn", "abstract_en"):
            block = "toc"
            _append(it, "toc_title", 0.95, "规则:目录标题", "toc")
            continue
        if _ECON_ABS_CN_RE.match(nt) and block in ("pre", "toc"):
            block = "abstract_cn"
            _append(it, "abstract_title_cn", 0.95, "规则:中文摘要标题", "abstract")
            continue
        if _ECON_ABS_EN_RE.match(nt) and block not in ("body", "conclusion", "references", "extra"):
            block = "abstract_en"
            _append(it, "abstract_title_en", 0.95, "规则:英文摘要标题", "abstract")
            continue
        if _CONCLUSION_TITLE_RE.match(nt) and block not in ("references", "extra"):
            block = "conclusion"
            _append(it, "conclusion_title", 0.9, "规则:总结标题", "conclusion")
            continue
        if _ECON_REFS_TITLE_RE.match(nt):
            block = "references"
            _append(it, "references_title", 0.95, "规则:参考文献标题", "references")
            continue
        if _ECON_ACK_RE.match(nt):
            block = "extra"
            _append(it, "passthrough", 1.0, "规则:致谢/附录", "extra")
            continue
        if _ECON_CHAPTER_RE.match(text) and block not in ("references", "extra"):
            block = "body"
            _append(it, "h1", 0.9, "规则:一级标题(章)", "body")
            continue

        # ── Within-block classification ──
        if block == "abstract_cn":
            if _ECON_KW_CN_RE.match(text):
                _append(it, "keywords_cn", 0.95, "规则:中文关键词", "abstract")
            elif _ECON_INSTR_RE.search(text):
                _append(it, "instructor", 0.85, "规则:指导老师", "abstract")
            elif _ECON_AUTHOR_RE.match(text):
                _append(it, "author_line", 0.8, "规则:作者", "abstract")
            else:
                _append(it, "abstract_body_cn", 0.7, "规则:中文摘要正文", "abstract")

        elif block == "abstract_en":
            if _ECON_KW_EN_RE.match(text):
                _append(it, "keywords_en", 0.95, "规则:英文关键词", "abstract")
            else:
                _append(it, "abstract_body_en", 0.7, "规则:英文摘要正文", "abstract")

        elif block == "body":
            if _H3_NUM_RE.match(text):
                _append(it, "h3", 0.85, "规则:三级标题", "body")
            elif _H2_NUM_RE.match(text):
                _append(it, "h2", 0.85, "规则:二级标题", "body")
            else:
                _append(it, "body", 0.7, "规则:正文", "body")

        elif block == "conclusion":
            _append(it, "conclusion_body", 0.8, "规则:总结正文", "conclusion")

        elif block == "references":
            _append(it, "reference_item", 0.85, "规则:参考文献条目", "references")

        elif block == "extra":
            _append(it, "passthrough", 1.0, "规则:致谢/附录", "extra")

        else:  # "pre" - title page content before any anchor
            font_size = orig.get("font_size_pt", 12)
            align = orig.get("alignment", "left")
            is_bold = orig.get("is_bold", False)
            if font_size >= 16 and align == "center":
                _append(it, "paper_title", 0.7, "规则:论文题目(大字居中)", "abstract")
            elif align == "center" and is_bold and len(text) <= 50:
                _append(it, "paper_title", 0.65, "规则:论文题目(粗体居中)", "abstract")
            elif _ECON_INSTR_RE.search(text):
                _append(it, "instructor", 0.8, "规则:指导老师", "abstract")
            elif _ECON_AUTHOR_RE.match(text):
                _append(it, "author_line", 0.75, "规则:作者", "abstract")
            else:
                block = "abstract_cn"
                _append(it, "abstract_body_cn", 0.5, "规则:摘要区(兜底)", "abstract")

    results.sort(key=lambda r: r["index"])
    logger.info("经济版规则识别完成，输出 %d 段", len(results))
    return results


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

    # 经济版：纯规则识别，不调用 AI，避免 8k context 卡死
    if tier == "economy":
        logger.info("经济版：使用纯规则识别（不调用AI）")
        return recognize_economy(raw_items)

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

    # 确定性修正 h2/h3：按文本数字层级覆盖 AI 判断。
    # '3.7 xxx'（两级编号）-> h2；'3.7.1 xxx'（三级编号）-> h3，无编号的不动。
    for idx, ptype in list(type_map.items()):
        if ptype not in ("h2", "h3"):
            continue
        text = ((by_index.get(idx) or {}).get("text") or "").strip()
        if _H3_NUM_RE.match(text):
            type_map[idx] = "h3"
        elif _H2_NUM_RE.match(text):
            type_map[idx] = "h2"

    # 切块已判定每个 body_chN 的起点就是该章章标题，强制其首个文本段为 h1，
    # 与切块决策保持一致（避免章标题被块内分类误判成 h2/h3/body）。
    # 若章标题被学生拆成「第X章」+「章名」两段，合并成单个 h1，避免章号丢失。
    forced_h1: set[int] = set()           # 强制为 h1 的段 index
    merged_h1_text: dict[int, str] = {}    # h1 段 index -> 合并后文本
    merged_skip: set[int] = set()          # 被并入上一段、不再单独输出的 index
    for seg in segments:
        if not seg["type"].startswith("body_ch"):
            continue
        text_idxs = [i for i in range(seg["start"], seg["end"] + 1)
                     if (it := by_index.get(i)) is not None
                     and it.get("kind") not in ("table", "image")
                     and (it.get("text") or "").strip()]
        if not text_idxs:
            continue
        first = text_idxs[0]
        forced_h1.add(first)
        first_text = (by_index[first].get("text") or "").strip()
        # 「第X章」单独成段（其后无章名）：把下一文本段并入作为章名
        if _BARE_CHAPTER_RE.match(first_text) and len(text_idxs) >= 2:
            nxt = text_idxs[1]
            nxt_text = (by_index[nxt].get("text") or "").strip()
            merged_h1_text[first] = f"{first_text} {nxt_text}"
            merged_skip.add(nxt)

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
            if it is None or i in merged_skip:
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
            if i in forced_h1:
                ptype = "h1"
                text = merged_h1_text.get(i, it.get("text", ""))
                reason = f"V2 章首段强制 h1（{seg_type}）"
            else:
                ptype = type_map.get(i, V2_BLOCK_DEFAULT.get(ckey, "body"))
                text = it.get("text", "")
                reason = f"V2 块内识别（{seg_type}）"
            results.append({
                "index": i, "text": text, "type": ptype,
                "confidence": compute_rule_confidence(text, ptype),
                "reason": reason,
                "block": final_block, "orig_style": it.get("orig_style"),
            })

    results.sort(key=lambda r: r["index"])
    return results
