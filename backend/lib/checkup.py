"""
提交前体检 - 内容/结构体检模块
backend/lib/checkup.py

独立于格式化与润色：上传 .docx 后先做一次「内容体检」，识别结构完整性、
摘要、关键词、绪论、章节、参考文献、图表与表达层面的常见问题，输出一份
按严重度分级的「修改优先级清单」，避免最后阶段反复返工。

设计要点：
  - 纯规则，零 AI 调用：正则 + 字数 + 结构统计，即时返回、可预测、免费。
  - 阈值与关键词只读 config/checkup/rules.json，不在代码里硬编码数值。
  - 只查「内容/结构」，不查排版字体字号（那是 formatter 的职责）。
  - 自带轻量结构检测（不依赖 AI 识别结果），复用与 ai_client 一致的正则模式。
"""
import io
import os
import re
import json
import logging

from docx import Document as DocxDocument

from .parser import extract_blocks

logger = logging.getLogger("thesis.checkup")


class CheckupError(Exception):
    """对外抛出的用户可读体检失败"""
    pass


# ============================================================
# 规则配置加载
# ============================================================
_CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "config", "checkup", "rules.json"
)


def load_checkup_rules(path: str | None = None) -> dict:
    p = path or _CONFIG_PATH
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
# 严重度 / 分类标签
# ============================================================
CATEGORY_LABELS = {
    "structure": "结构完整性",
    "abstract": "摘要",
    "keywords": "关键词",
    "intro": "绪论",
    "headings": "章节标题",
    "references": "参考文献",
    "figures": "图表",
    "conclusion": "总结",
    "language": "语言表达",
}
SEVERITY_LABELS = {"high": "高", "medium": "中", "low": "低"}


# ============================================================
# 轻量结构检测正则（与 ai_client.py 模式保持一致）
# ============================================================
_CH_NUM = "一二三四五六七八九十百零"
_RE_CHAPTER = re.compile(rf"^第\s*[{_CH_NUM}\d]+\s*章")
_RE_H2 = re.compile(r"^\d+\.\d+(?!\.\d)\s*\S")
_RE_H3 = re.compile(r"^\d+\.\d+\.\d+\s*\S")
_RE_KW_CN = re.compile(r"^关\s*键\s*词\s*[:：]?")
_RE_KW_EN = re.compile(r"^key\s*words?\s*[:：]?", re.IGNORECASE)
_RE_FIG_CAP = re.compile(rf"^图\s*[\d{_CH_NUM}]+([-—.．][\d{_CH_NUM}]+)?[\s　]+\S")
_RE_TAB_CAP = re.compile(rf"^表\s*[\d{_CH_NUM}]+([-—.．][\d{_CH_NUM}]+)?[\s　]+\S")
_RE_REF_ITEM = re.compile(r"^\[(\d+)\]|^(\d+)[.\．]\s")
_RE_CITATION = re.compile(r"\[(\d+)\]")
_RE_CITE_FIG = re.compile(r"(如|见|由)?图\s*[\d一二三四五六七八九十]")
_RE_CITE_TAB = re.compile(r"(如|见|由)?表\s*[\d一二三四五六七八九十]")
_RE_SENT_PUNCT = re.compile(r"[。，；！？]")
_RE_END_PUNCT_BAD = re.compile(r"[。，；,.]$")

_CH_NUM_MAP = {c: i for i, c in enumerate("零一二三四五六七八九十", 0)}


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def _cn_or_digit_to_int(s: str) -> int | None:
    """把'第3章'/'第三章'里的编号转成整数（支持 1-99 的简单中文数字）。"""
    s = s.strip()
    if s.isdigit():
        return int(s)
    if not s:
        return None
    # 简化中文数字：十=10，十X=1X，X十=X0，X十Y=XY
    if s == "十":
        return 10
    if "十" in s:
        left, _, right = s.partition("十")
        tens = _CH_NUM_MAP.get(left, 1) if left else 1
        ones = _CH_NUM_MAP.get(right, 0) if right else 0
        return tens * 10 + ones
    if len(s) == 1 and s in _CH_NUM_MAP:
        return _CH_NUM_MAP[s]
    return None


def _split_keywords(line: str) -> list[str]:
    """从'关键词：A；B，C D'里拆出关键词列表（兼容各种分隔符）。"""
    body = _RE_KW_CN.sub("", line)
    body = _RE_KW_EN.sub("", body)
    parts = re.split(r"[；;，,、\s/|]+", body.strip())
    return [p for p in parts if p]


# ============================================================
# 结构检测：把 extract_blocks 的原始块切成各部分
# ============================================================
def detect_structure(items: list[dict]) -> dict:
    """
    线性扫描原始块，定位摘要/关键词/绪论/章节/参考文献等锚点，返回结构画像。
    不调用 AI；靠固定标题与正则模式。版式差异较大时尽量兜底。
    """
    texts = [(it.get("index"), (it.get("text") or "").strip(), it) for it in items]

    anchors = {
        "abstract_cn": None, "keywords_cn": None,
        "abstract_en": None, "keywords_en": None,
        "toc": None, "first_chapter": None,
        "conclusion": None, "references": None,
    }
    for pos, (idx, t, it) in enumerate(texts):
        if not t:
            continue
        nt = _norm(t)
        low = nt.lower()
        if anchors["toc"] is None and nt == "目录":
            anchors["toc"] = pos
        if anchors["abstract_cn"] is None and nt in ("摘要", "中文摘要"):
            anchors["abstract_cn"] = pos
        if anchors["abstract_en"] is None and low == "abstract":
            anchors["abstract_en"] = pos
        if anchors["keywords_cn"] is None and _RE_KW_CN.match(t):
            anchors["keywords_cn"] = pos
        if anchors["keywords_en"] is None and _RE_KW_EN.match(t):
            anchors["keywords_en"] = pos
        if anchors["first_chapter"] is None and _RE_CHAPTER.match(t):
            anchors["first_chapter"] = pos
        if anchors["conclusion"] is None and nt in ("总结", "结论", "总结与展望", "结论与展望"):
            anchors["conclusion"] = pos
        if anchors["references"] is None and nt in ("参考文献", "references", "reference"):
            anchors["references"] = pos

    def join_between(a, b, *, kind="paragraph"):
        out = []
        lo = (a + 1) if a is not None else 0
        hi = b if b is not None else len(texts)
        for pos in range(lo, hi):
            idx, t, it = texts[pos]
            if not t:
                continue
            if kind == "paragraph" and it.get("kind") in ("table", "image"):
                continue
            out.append(t)
        return out

    # 中文摘要正文：摘要标题 ~ (关键词 或 Abstract 或 首章)
    cn_end = _first_not_none(anchors["keywords_cn"], anchors["abstract_en"],
                             anchors["first_chapter"])
    abstract_cn_lines = join_between(anchors["abstract_cn"], cn_end) \
        if anchors["abstract_cn"] is not None else []
    abstract_cn = "".join(abstract_cn_lines)

    # 英文摘要正文：Abstract 标题 ~ (Keywords 或 首章)
    en_end = _first_not_none(anchors["keywords_en"], anchors["first_chapter"])
    abstract_en_lines = join_between(anchors["abstract_en"], en_end) \
        if anchors["abstract_en"] is not None else []
    abstract_en = " ".join(abstract_en_lines)

    # 关键词
    keywords_cn, keywords_en = [], []
    if anchors["keywords_cn"] is not None:
        keywords_cn = _split_keywords(texts[anchors["keywords_cn"]][1])
    if anchors["keywords_en"] is not None:
        keywords_en = _split_keywords(texts[anchors["keywords_en"]][1])

    # 章节标题（h1/h2/h3）
    body_lo = anchors["first_chapter"] if anchors["first_chapter"] is not None else 0
    body_hi = _first_not_none(anchors["conclusion"], anchors["references"], len(texts))
    headings, chapters = [], []
    for pos in range(body_lo, body_hi if body_hi else len(texts)):
        idx, t, it = texts[pos]
        if not t or it.get("kind") in ("table", "image"):
            continue
        if _RE_CHAPTER.match(t):
            m = re.match(rf"^第\s*([{_CH_NUM}\d]+)\s*章", t)
            num = _cn_or_digit_to_int(m.group(1)) if m else None
            chapters.append({"index": idx, "num": num, "text": t})
            headings.append({"index": idx, "level": 1, "text": t})
        elif _RE_H3.match(t):
            headings.append({"index": idx, "level": 3, "text": t})
        elif _RE_H2.match(t):
            headings.append({"index": idx, "level": 2, "text": t})

    # 绪论正文（第一章内的正文文字）
    intro_lo = anchors["first_chapter"]
    intro_hi = chapters[1]["index"] if len(chapters) >= 2 else None
    intro_text = ""
    if intro_lo is not None:
        intro_lines = []
        hi_pos = None
        if intro_hi is not None:
            hi_pos = next((p for p, (i, _, _) in enumerate(texts) if i == intro_hi), None)
        for pos in range(intro_lo + 1, hi_pos if hi_pos else len(texts)):
            idx, t, it = texts[pos]
            if not t or it.get("kind") in ("table", "image"):
                continue
            if _RE_CHAPTER.match(t):
                break
            intro_lines.append(t)
        intro_text = "".join(intro_lines)

    # 总结正文
    conclusion_text = ""
    if anchors["conclusion"] is not None:
        conclusion_lines = join_between(anchors["conclusion"], anchors["references"])
        conclusion_text = "".join(conclusion_lines)

    # 参考文献条目
    references = []
    if anchors["references"] is not None:
        for pos in range(anchors["references"] + 1, len(texts)):
            idx, t, it = texts[pos]
            if not t or it.get("kind") in ("table", "image"):
                continue
            m = _RE_REF_ITEM.match(t)
            num = None
            if m:
                num = int(m.group(1) or m.group(2))
            references.append({"index": idx, "num": num, "text": t})

    # 图表统计
    tables = [it for it in items if it.get("kind") == "table"]
    figures = [it for it in items if it.get("kind") == "image"]
    table_caps = [t for _, t, it in texts if it.get("kind") == "paragraph" and _RE_TAB_CAP.match(t)]
    figure_caps = [t for _, t, it in texts if it.get("kind") == "paragraph" and _RE_FIG_CAP.match(t)]

    # 全文正文文字（用于语言检查 / 图表引用 / 引文标注）
    body_text_parts = []
    for pos in range(body_lo, len(texts)):
        idx, t, it = texts[pos]
        if not t or it.get("kind") in ("table", "image"):
            continue
        body_text_parts.append(t)
    body_text = "\n".join(body_text_parts)

    citations = sorted({int(m) for m in _RE_CITATION.findall(body_text)})

    return {
        "anchors": anchors,
        "abstract_cn": abstract_cn,
        "abstract_cn_chars": len(abstract_cn),
        "abstract_en": abstract_en,
        "abstract_en_words": len(re.findall(r"[A-Za-z]+", abstract_en)),
        "keywords_cn": keywords_cn,
        "keywords_en": keywords_en,
        "has_toc": anchors["toc"] is not None,
        "headings": headings,
        "chapters": chapters,
        "intro_text": intro_text,
        "conclusion_text": conclusion_text,
        "conclusion_chars": len(conclusion_text),
        "references": references,
        "tables": tables,
        "figures": figures,
        "table_caption_count": len(table_caps),
        "figure_caption_count": len(figure_caps),
        "body_text": body_text,
        "citations": citations,
    }


def _first_not_none(*vals):
    for v in vals:
        if v is not None:
            return v
    return None


# ============================================================
# 体检规则
# ============================================================
def _issue(issues, *, id, category, severity, title, detail, suggestion,
           locations=None):
    issues.append({
        "id": id,
        "category": category,
        "category_label": CATEGORY_LABELS.get(category, category),
        "severity": severity,
        "severity_label": SEVERITY_LABELS.get(severity, severity),
        "title": title,
        "detail": detail,
        "suggestion": suggestion,
        "locations": locations or [],
    })


def _check_structure(s, rules, issues):
    if not s["abstract_cn"]:
        _issue(issues, id="missing_abstract_cn", category="structure", severity="high",
               title="缺少中文摘要", detail="未检测到「摘要」部分及其正文。",
               suggestion="补充 200–400 字的中文摘要，概括研究背景、方法、结果与结论。")
    if not s["keywords_cn"]:
        _issue(issues, id="missing_keywords_cn", category="structure", severity="high",
               title="缺少中文关键词", detail="未检测到以「关键词」开头的条目。",
               suggestion="在中文摘要下方补充 3–8 个关键词，用空格分隔。")
    if not s["abstract_en"]:
        _issue(issues, id="missing_abstract_en", category="structure", severity="medium",
               title="缺少英文摘要", detail="未检测到 Abstract 部分。",
               suggestion="补充与中文摘要对应的英文摘要 Abstract。")
    if not s["keywords_en"]:
        _issue(issues, id="missing_keywords_en", category="structure", severity="medium",
               title="缺少英文关键词", detail="未检测到 Keywords 条目。",
               suggestion="在英文摘要下方补充 Keywords，与中文关键词对应。")
    if not s["references"]:
        _issue(issues, id="missing_references", category="structure", severity="high",
               title="缺少参考文献", detail="未检测到「参考文献」部分及条目。",
               suggestion="补充参考文献列表，按 GB/T 7714 著录。")
    if s["anchors"]["conclusion"] is None:
        _issue(issues, id="missing_conclusion", category="structure", severity="medium",
               title="缺少总结/结论", detail="未检测到「总结」或「结论」章节。",
               suggestion="补充总结章节，归纳主要工作与结论。")
    if not s["has_toc"]:
        _issue(issues, id="missing_toc", category="structure", severity="low",
               title="缺少目录", detail="未检测到「目录」。",
               suggestion="插入自动生成的目录，便于评阅。")
    if not s["chapters"]:
        _issue(issues, id="missing_chapters", category="structure", severity="high",
               title="未检测到章节标题", detail="正文中没有发现「第X章」形式的一级标题。",
               suggestion="为正文划分章节，使用规范的章标题。")


def _check_abstract(s, rules, issues):
    cfg = rules["abstract_cn"]
    n = s["abstract_cn_chars"]
    if n > 0:
        loc = [s["anchors"]["abstract_cn"]] if s["anchors"]["abstract_cn"] is not None else []
        if n < cfg["min_chars"]:
            _issue(issues, id="abstract_cn_too_short", category="abstract", severity="medium",
                   title="中文摘要字数偏少",
                   detail=f"当前约 {n} 字，建议 {cfg['min_chars']}–{cfg['max_chars']} 字。",
                   suggestion="补充研究方法与主要结论的概括，使摘要自成一体。",
                   locations=loc)
        elif n > cfg["max_chars"]:
            _issue(issues, id="abstract_cn_too_long", category="abstract", severity="low",
                   title="中文摘要字数偏多",
                   detail=f"当前约 {n} 字，建议不超过 {cfg['max_chars']} 字。",
                   suggestion="精简背景铺垫，突出方法与结论。", locations=loc)
        # 摘要不应含引用标注
        if _RE_CITATION.search(s["abstract_cn"]):
            _issue(issues, id="abstract_has_citation", category="abstract", severity="low",
                   title="摘要中出现参考文献引用",
                   detail="摘要应独立成段，通常不出现 [1] 之类引用标注。",
                   suggestion="移除摘要中的引用标注，把它们放到正文。", locations=loc)
        # 摘要不应含图表引用
        if _RE_CITE_FIG.search(s["abstract_cn"]) or _RE_CITE_TAB.search(s["abstract_cn"]):
            _issue(issues, id="abstract_has_figref", category="abstract", severity="low",
                   title="摘要中引用了图表",
                   detail="摘要中出现「如图/见表」等图表引用，摘要不应依赖图表。",
                   suggestion="改写为文字概括，不引用具体图表。", locations=loc)
    # 英文摘要长度
    if s["abstract_en"]:
        w = s["abstract_en_words"]
        if w < rules["abstract_en"]["min_words"]:
            _issue(issues, id="abstract_en_too_short", category="abstract", severity="low",
                   title="英文摘要偏短",
                   detail=f"当前约 {w} 个英文单词，建议与中文摘要对应、不少于 {rules['abstract_en']['min_words']} 词。",
                   suggestion="将英文摘要补充完整，与中文摘要内容一致。")


def _check_keywords(s, rules, issues):
    cfg = rules["keywords"]
    kw = s["keywords_cn"]
    if kw:
        loc = [s["anchors"]["keywords_cn"]] if s["anchors"]["keywords_cn"] is not None else []
        if len(kw) < cfg["min_count"]:
            _issue(issues, id="keywords_too_few", category="keywords", severity="medium",
                   title="中文关键词偏少",
                   detail=f"当前 {len(kw)} 个：{ ' '.join(kw) }；建议 {cfg['min_count']}–{cfg['max_count']} 个。",
                   suggestion="补充能概括研究主题的关键词。", locations=loc)
        elif len(kw) > cfg["max_count"]:
            _issue(issues, id="keywords_too_many", category="keywords", severity="low",
                   title="中文关键词偏多",
                   detail=f"当前 {len(kw)} 个，建议不超过 {cfg['max_count']} 个。",
                   suggestion="保留最核心的关键词。", locations=loc)
        # 关键词与英文不一致
        if s["keywords_en"] and len(s["keywords_en"]) != len(kw):
            _issue(issues, id="keywords_count_mismatch", category="keywords", severity="low",
                   title="中英文关键词数量不一致",
                   detail=f"中文 {len(kw)} 个，英文 {len(s['keywords_en'])} 个。",
                   suggestion="使中英文关键词一一对应。", locations=loc)
        # 关键词内含句号
        if any("。" in k or "." in k for k in kw):
            _issue(issues, id="keywords_has_period", category="keywords", severity="low",
                   title="关键词中含句号",
                   detail="关键词之间不应使用句号，各关键词也不应以句号结尾。",
                   suggestion="去掉句号，关键词之间用空格分隔。", locations=loc)


def _check_intro(s, rules, issues):
    intro = s["intro_text"]
    if not intro or len(intro) < 50:
        return  # 绪论太短或缺失，结构检查已覆盖
    cfg = rules["intro"]
    loc = [s["chapters"][0]["index"]] if s["chapters"] else []
    if not any(k in intro for k in cfg["research_status_keywords"]):
        _issue(issues, id="intro_no_research_status", category="intro", severity="medium",
               title="绪论未涉及国内外研究现状",
               detail="第一章/绪论中未检测到「研究现状」「国内外」等内容。",
               suggestion="在绪论中补充国内外研究现状综述，并标注代表性文献。",
               locations=loc)
    if not any(k in intro for k in cfg["significance_keywords"]):
        _issue(issues, id="intro_no_significance", category="intro", severity="low",
               title="绪论未明确研究意义",
               detail="绪论中未检测到「研究意义」「价值」等表述。",
               suggestion="补充选题的理论意义与实践意义。", locations=loc)
    if not any(k in intro for k in cfg["content_keywords"]):
        _issue(issues, id="intro_no_content", category="intro", severity="low",
               title="绪论未交代研究内容/结构",
               detail="绪论中未检测到「研究内容」「技术路线」「论文结构」等表述。",
               suggestion="补充本文主要研究内容与章节安排。", locations=loc)


def _check_headings(s, rules, issues):
    chapters = s["chapters"]
    # 章号连续性
    nums = [c["num"] for c in chapters if c["num"] is not None]
    if len(nums) >= 2:
        expected = list(range(nums[0], nums[0] + len(nums)))
        if nums != expected:
            _issue(issues, id="chapter_not_continuous", category="headings", severity="medium",
                   title="章节编号不连续",
                   detail=f"检测到章号顺序为 {nums}，期望连续递增。",
                   suggestion="检查是否漏写或重复章节，使章号连续。",
                   locations=[c["index"] for c in chapters])
    # h2 出现在任何 h1 之前
    first_h1 = next((h for h in s["headings"] if h["level"] == 1), None)
    first_sub = next((h for h in s["headings"] if h["level"] in (2, 3)), None)
    if first_sub and (first_h1 is None or first_sub["index"] < first_h1["index"]):
        _issue(issues, id="subheading_before_chapter", category="headings", severity="low",
               title="二级/三级标题出现在章标题之前",
               detail="检测到 1.1 这类小节标题出现在任何「第X章」之前。",
               suggestion="确认章节层级，先有一级标题再有小节。",
               locations=[first_sub["index"]])
    # 标题以标点结尾
    bad = [h for h in s["headings"] if _RE_END_PUNCT_BAD.search(h["text"])]
    if bad:
        _issue(issues, id="heading_end_punct", category="headings", severity="low",
               title="标题以标点结尾",
               detail=f"有 {len(bad)} 个标题以句号/逗号结尾，标题通常不加结尾标点。",
               suggestion="删除标题末尾的标点。",
               locations=[h["index"] for h in bad[:10]])


def _check_references(s, rules, issues):
    refs = s["references"]
    if not refs:
        return
    cfg = rules["references"]
    loc = [s["anchors"]["references"]] if s["anchors"]["references"] is not None else []
    if len(refs) < cfg["min_count"]:
        _issue(issues, id="references_too_few", category="references", severity="medium",
               title="参考文献数量偏少",
               detail=f"当前 {len(refs)} 条，建议不少于 {cfg['min_count']} 条。",
               suggestion="补充与研究主题相关的近年文献。", locations=loc)
    # 编号连续性
    nums = [r["num"] for r in refs if r["num"] is not None]
    if len(nums) >= 2:
        expected = list(range(nums[0], nums[0] + len(nums)))
        if nums != expected:
            _issue(issues, id="references_not_continuous", category="references", severity="low",
                   title="参考文献编号不连续",
                   detail=f"检测到编号 {nums[:12]}{'…' if len(nums) > 12 else ''}，应连续。",
                   suggestion="重新编号，使其连续。", locations=loc)
    # 正文未引用任何文献
    if not s["citations"]:
        _issue(issues, id="no_citation_in_text", category="references", severity="medium",
               title="正文未出现引用标注",
               detail="有参考文献，但正文中未检测到 [1] 之类的引用标注（引而不标）。",
               suggestion="在正文相应位置补充上标引用标注。", locations=loc)
    else:
        max_cite = max(s["citations"])
        if max_cite > len(refs):
            _issue(issues, id="citation_out_of_range", category="references", severity="medium",
                   title="引用编号超出参考文献条数",
                   detail=f"正文最大引用编号 [{max_cite}]，但参考文献仅 {len(refs)} 条。",
                   suggestion="核对引用编号与文献列表的对应关系。", locations=loc)


def _check_figures(s, rules, issues):
    n_tab, n_fig = len(s["tables"]), len(s["figures"])
    if n_tab and s["table_caption_count"] < n_tab:
        _issue(issues, id="table_missing_caption", category="figures", severity="low",
               title="部分表格缺少表说明",
               detail=f"检测到 {n_tab} 个表格，但仅 {s['table_caption_count']} 条「表X-X」说明。",
               suggestion="为每个表格补充表头说明（表X-X 名称）。")
    if n_fig and s["figure_caption_count"] < n_fig:
        _issue(issues, id="figure_missing_caption", category="figures", severity="low",
               title="部分图片缺少图说明",
               detail=f"检测到 {n_fig} 张图片，但仅 {s['figure_caption_count']} 条「图X-X」说明。",
               suggestion="为每张图片补充图下说明（图X-X 名称）。")
    body = s["body_text"]
    if n_tab and not _RE_CITE_TAB.search(body):
        _issue(issues, id="table_not_referenced", category="figures", severity="low",
               title="表格未在正文中引用",
               detail="存在表格，但正文未出现「如表/见表」等引用。",
               suggestion="在正文中引用表格，做到图表与正文呼应。")
    if n_fig and not _RE_CITE_FIG.search(body):
        _issue(issues, id="figure_not_referenced", category="figures", severity="low",
               title="图片未在正文中引用",
               detail="存在图片，但正文未出现「如图/见图」等引用。",
               suggestion="在正文中引用图片。")


def _check_conclusion(s, rules, issues):
    if s["anchors"]["conclusion"] is None:
        return
    n = s["conclusion_chars"]
    cfg = rules["conclusion"]
    if 0 < n < cfg["min_chars"]:
        _issue(issues, id="conclusion_too_short", category="conclusion", severity="low",
               title="总结内容偏短",
               detail=f"总结约 {n} 字，偏短，可能未充分归纳。",
               suggestion="补充对研究工作、主要结论与不足的归纳。",
               locations=[s["chapters"][0]["index"]] if s["chapters"] else [])


def _check_language(s, rules, issues):
    body = s["body_text"]
    if not body:
        return
    cfg = rules["language"]
    hits_col = [w for w in cfg["colloquial_words"] if w in body]
    if hits_col:
        _issue(issues, id="colloquial_words", category="language", severity="low",
               title="正文存在口语化表达",
               detail="检测到口语化词：" + "、".join(hits_col[:8]),
               suggestion="替换为书面学术表达，可用「AI 表达优化」逐段润色。")
    hits_fp = [w for w in cfg["first_person"] if w in body]
    if hits_fp:
        _issue(issues, id="first_person", category="language", severity="low",
               title="正文出现第一人称",
               detail="检测到：" + "、".join(hits_fp[:6]) + "。学术写作一般避免「我/我们认为」。",
               suggestion="改为客观陈述，如「本文认为」「研究表明」。")


_CHECKS = [
    _check_structure, _check_abstract, _check_keywords, _check_intro,
    _check_headings, _check_references, _check_figures, _check_conclusion,
    _check_language,
]


# ============================================================
# 汇总
# ============================================================
def _summarize(issues, rules, structure):
    weights = rules["severity_weights"]
    by_sev = {"high": 0, "medium": 0, "low": 0}
    by_cat = {}
    for it in issues:
        by_sev[it["severity"]] = by_sev.get(it["severity"], 0) + 1
        by_cat[it["category"]] = by_cat.get(it["category"], 0) + 1
    deduction = sum(weights.get(it["severity"], 0) for it in issues)
    score = max(0, 100 - deduction)
    return {
        "score": score,
        "total": len(issues),
        "by_severity": by_sev,
        "by_category": by_cat,
        "structure_overview": {
            "abstract_cn_chars": structure["abstract_cn_chars"],
            "keywords_cn_count": len(structure["keywords_cn"]),
            "chapter_count": len(structure["chapters"]),
            "reference_count": len(structure["references"]),
            "table_count": len(structure["tables"]),
            "figure_count": len(structure["figures"]),
            "has_toc": structure["has_toc"],
            "has_conclusion": structure["anchors"]["conclusion"] is not None,
            "has_abstract_en": bool(structure["abstract_en"]),
        },
    }


_SEV_ORDER = {"high": 0, "medium": 1, "low": 2}


def run_checkup(items: list[dict], rules: dict | None = None) -> dict:
    """
    对 extract_blocks 的原始块运行体检，返回 {issues, summary, structure}。
    items: extract_blocks(file_bytes) 的输出（含段落/表格/图片块）。
    """
    rules = rules or load_checkup_rules()
    structure = detect_structure(items)
    issues: list[dict] = []
    for check in _CHECKS:
        try:
            check(structure, rules, issues)
        except Exception as e:
            logger.warning("体检规则 %s 执行异常: %s", getattr(check, "__name__", "?"), e)
    issues.sort(key=lambda it: (_SEV_ORDER.get(it["severity"], 9), it["category"]))
    summary = _summarize(issues, rules, structure)
    logger.info("体检完成：%d 项问题（高 %d / 中 %d / 低 %d），得分 %d",
                summary["total"], summary["by_severity"]["high"],
                summary["by_severity"]["medium"], summary["by_severity"]["low"],
                summary["score"])
    return {"issues": issues, "summary": summary}


def checkup_docx(file_bytes: bytes, rules: dict | None = None) -> dict:
    """上传入口：解析 .docx -> 抽取原始块 -> 体检。"""
    try:
        items = extract_blocks(file_bytes)
    except Exception as e:
        raise CheckupError(f".docx 文件解析失败，可能已损坏: {e}") from e
    if not items:
        raise CheckupError("文档为空，未提取到任何内容")
    return run_checkup(items, rules)
