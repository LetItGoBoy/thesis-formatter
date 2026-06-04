"""
论文表达润色 - 改写模块
backend/lib/polish_rewriter.py

独立于格式化工具。调用 get_polish_client()（默认 Moonshot moonshot-v1-32k）
对单个段落做表达优化，并在本地做安全校验（不丢数字/引用/图表/公式编号）。

action：
  academic_polish  学术润色
  make_specific    表达更具体
  shorten          压缩精简
  expand           适当扩写
  logic_optimize   逻辑优化
"""
import os
import re
import json
import logging

from .ai_client import get_polish_client, AIFatalError

logger = logging.getLogger("thesis.polish.rewriter")

POLISH_MAX_TOKENS = int(os.environ.get("POLISH_MAX_TOKENS", 4096))

# 各 action 的采样温度（越高越发散）
ACTION_TEMPERATURE = {
    "academic_polish": 0.25,
    "make_specific": 0.35,
    "shorten": 0.2,
    "expand": 0.4,
    "logic_optimize": 0.3,
}

# 各 action 对模型的具体要求（拼进系统提示）
ACTION_REQUIREMENT = {
    "academic_polish": (
        "【学术润色】修复病句、口语化表达和不通顺表达；"
        "调整为本科论文常见学术表达；不大幅扩写。"
    ),
    "make_specific": (
        "【表达更具体】减少空泛表达；在不新增事实的前提下，让表达更具体；"
        "可以基于原文已有对象、功能、方法进行更清晰表述；不能编造新功能。"
    ),
    "shorten": (
        "【压缩精简】保留核心意思；删除重复、空泛、啰嗦表达；"
        "适合摘要、总结、绪论等场景。"
    ),
    "expand": (
        "【适当扩写】在原文基础上适当展开；只能围绕原文已有信息合理展开；"
        "不能新增没有依据的功能、实验、结论或引用。"
    ),
    "logic_optimize": (
        "【逻辑优化】优化句子之间的顺序和衔接；提升段落内部逻辑连贯性；"
        "不改变核心意思。"
    ),
}

SUPPORTED_ACTIONS = list(ACTION_REQUIREMENT.keys())

_BASE_SYSTEM_PROMPT = (
    "你是本科论文表达润色助手。你的任务是在不改变原意的前提下，对用户选中的论文段落"
    "进行表达优化。你不能编造事实，不能新增原文没有的系统功能、实验结果、数据、引用或结论。"
    "你必须保留原文中的数字、年份、百分比、图表编号、公式编号、参考文献编号、专业术语和系统名称。"
    "不要把普通结论拔高为“显著提升”“重大创新”“广泛推广价值”。输出必须是 JSON。"
)


class PolishError(Exception):
    """对外抛出的用户可读润色失败"""
    pass


# ============================================================
# 本地校验：抽取并比对关键 token，防止模型悄悄改掉数字/引用/编号
# ============================================================
_RE_NUMBER = re.compile(r"\d+(?:\.\d+)?%?")           # 数字 / 小数 / 百分比
_RE_CITATION = re.compile(r"\[\d+\]")                  # 参考文献引用 [1]
_RE_FIGTAB = re.compile(r"[图表]\s*\d+(?:[-.]\d+)?")    # 图1-1 / 表2.1
_RE_FORMULA = re.compile(r"\(\s*\d+\s*[-—]\s*\d+\s*\)")  # 公式编号 (2-1)


def _missing_tokens(original: str, rewritten: str, pattern: re.Pattern) -> list[str]:
    """返回原文里出现、但改写后缺失（数量减少）的 token。"""
    from collections import Counter
    orig = Counter(re.sub(r"\s+", "", m) for m in pattern.findall(original))
    new = Counter(re.sub(r"\s+", "", m) for m in pattern.findall(rewritten))
    missing = []
    for tok, cnt in orig.items():
        if new.get(tok, 0) < cnt:
            missing.append(tok)
    return missing


def validate_polish(original: str, rewritten: str) -> tuple[bool, str]:
    """
    本地校验改写结果。返回 (ok, error_message)。
    校验失败时调用方不应直接替换原文。
    """
    o = (original or "").strip()
    r = (rewritten or "").strip()

    if not r:
        return False, "改写结果为空"

    o_len = len(o)
    if o_len > 0:
        ratio = len(r) / o_len
        if ratio < 0.4:
            return False, f"改写结果过短（为原文的 {ratio:.0%}，低于 40%）"
        if ratio > 2.2:
            return False, f"改写结果过长（为原文的 {ratio:.0%}，高于 220%）"

    miss_num = _missing_tokens(o, r, _RE_NUMBER)
    if miss_num:
        return False, f"改写丢失了原文中的数字：{ '、'.join(miss_num[:6]) }"

    miss_cite = _missing_tokens(o, r, _RE_CITATION)
    if miss_cite:
        return False, f"改写丢失了参考文献引用编号：{ '、'.join(miss_cite[:6]) }"

    miss_figtab = _missing_tokens(o, r, _RE_FIGTAB)
    if miss_figtab:
        return False, f"改写丢失了图/表编号：{ '、'.join(miss_figtab[:6]) }"

    miss_formula = _missing_tokens(o, r, _RE_FORMULA)
    if miss_formula:
        return False, f"改写丢失了公式编号：{ '、'.join(miss_formula[:6]) }"

    return True, ""


def _build_system_prompt(action: str) -> str:
    return _BASE_SYSTEM_PROMPT + "\n\n" + ACTION_REQUIREMENT[action] + (
        '\n\n用户消息是 JSON：{"action": "...", "text": "原文"}。'
        '你的输出必须是 JSON，且只包含两个字段：'
        '{"rewritten_text": "改写后的文本", "reason": "简短说明修改方向"}。'
        "不要输出 markdown 代码块，不要输出 JSON 以外的任何内容。"
    )


def _parse_result(raw: str) -> dict:
    """从模型响应解析出 {rewritten_text, reason}，容忍包裹的代码块。"""
    text = (raw or "").strip()
    if text.startswith("```"):
        m = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    if not text.startswith("{"):
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
    obj = json.loads(text)
    if not isinstance(obj, dict) or "rewritten_text" not in obj:
        raise ValueError("模型返回缺少 rewritten_text 字段")
    return obj


def rewrite_text(text: str, action: str) -> dict:
    """
    对单段文本做润色改写。
    返回 {"rewritten_text", "reason", "action"}。
    校验失败或解析失败抛出 PolishError。
    """
    original = (text or "").strip()
    if not original:
        raise PolishError("原文为空，无法润色")
    if action not in SUPPORTED_ACTIONS:
        raise PolishError(f"不支持的润色操作: {action}，可选: {SUPPORTED_ACTIONS}")

    client = get_polish_client()
    system_prompt = _build_system_prompt(action)
    user_message = json.dumps({"action": action, "text": original}, ensure_ascii=False)
    temperature = ACTION_TEMPERATURE.get(action, 0.3)

    # JSON 解析失败时重试一次（共两次尝试）
    last_err = None
    for attempt in range(2):
        try:
            raw = client.chat(
                system_prompt, user_message,
                temperature=temperature, max_tokens=POLISH_MAX_TOKENS,
            )
            obj = _parse_result(raw)
        except AIFatalError as e:
            raise PolishError(f"AI 服务不可用: {e}") from e
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
            logger.warning("润色返回解析失败（第 %d 次）: %s", attempt + 1, e)
            continue
        except Exception as e:
            last_err = e
            logger.warning("润色调用失败（第 %d 次）: %s", attempt + 1, e)
            continue

        rewritten = (obj.get("rewritten_text") or "").strip()
        reason = (obj.get("reason") or "").strip()
        ok, msg = validate_polish(original, rewritten)
        if not ok:
            raise PolishError(f"润色结果未通过校验：{msg}")
        return {"rewritten_text": rewritten, "reason": reason, "action": action}

    raise PolishError(f"润色失败，模型返回无法解析: {last_err}")
