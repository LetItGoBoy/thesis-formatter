"""
SQLite 数据访问模块
backend/lib/db.py

付费上线最小数据库：三张表（无账号 token 制）。
- orders      付款订单（创建->支付成功颁发一次性 token）
- free_usage  免费额度计数（按 IP + 日期限流，无需登录）
- token_usage 令牌使用记录（审计 + 防重复使用）

数据库文件路径由环境变量 THESIS_DB_PATH 指定，默认 backend/data/thesis.db。
DevBox 工作目录持久，文件落在项目内即可，不随容器重启丢失。
连接按调用即开即关（SQLite 写串行、读并发），适配 Flask 多线程/gunicorn 多 worker。
"""
import os
import uuid
import secrets
import sqlite3
import logging
from datetime import datetime, date, timezone

logger = logging.getLogger("thesis.db")

# 默认放在 backend/data/thesis.db（相对本文件 ../data/）
_DEFAULT_DB = os.path.join(os.path.dirname(__file__), "..", "data", "thesis.db")
DB_PATH = os.environ.get("THESIS_DB_PATH", os.path.abspath(_DEFAULT_DB))

# 免费额度：每个 IP 每天可用次数（可被环境变量覆盖）
FREE_DAILY_LIMIT = int(os.environ.get("FREE_DAILY_LIMIT", 3))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return date.today().isoformat()


def get_conn() -> sqlite3.Connection:
    """打开一个新连接（行可按列名访问）。调用方负责 close。"""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")   # 读写并发更好
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """建表（幂等）。应用启动时调用一次。"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_conn()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id            TEXT PRIMARY KEY,
                out_trade_no  TEXT UNIQUE,
                amount_fen    INTEGER NOT NULL,
                status        TEXT NOT NULL DEFAULT 'pending',
                token         TEXT UNIQUE,
                created_at    TEXT NOT NULL,
                paid_at       TEXT
            );

            CREATE TABLE IF NOT EXISTS free_usage (
                ip     TEXT NOT NULL,
                day    TEXT NOT NULL,
                count  INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (ip, day)
            );

            CREATE TABLE IF NOT EXISTS token_usage (
                token    TEXT PRIMARY KEY,
                used_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                phone         TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sms_codes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                phone       TEXT NOT NULL,
                code        TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                expires_at  TEXT NOT NULL,
                used        INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_sms_codes_phone
                ON sms_codes(phone, created_at);

            CREATE TABLE IF NOT EXISTS level_clears (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL,
                course        TEXT NOT NULL,
                level_id      TEXT NOT NULL,
                best_mistakes INTEGER NOT NULL DEFAULT 0,
                perfect       INTEGER NOT NULL DEFAULT 0,
                clears        INTEGER NOT NULL DEFAULT 1,
                first_at      TEXT NOT NULL,
                last_at       TEXT NOT NULL,
                UNIQUE(user_id, course, level_id)
            );
            CREATE INDEX IF NOT EXISTS idx_level_clears_user
                ON level_clears(user_id);
            """
        )
        conn.commit()
        _ensure_user_columns(conn)
        logger.info("SQLite 初始化完成：%s", DB_PATH)
    finally:
        conn.close()


# 成长系统字段：给老库平滑补列
_USER_EXTRA_COLUMNS = {
    "nickname": "TEXT",
    "xp": "INTEGER NOT NULL DEFAULT 0",
    "streak": "INTEGER NOT NULL DEFAULT 0",
    "last_active": "TEXT",
    "cleared_count": "INTEGER NOT NULL DEFAULT 0",
    "perfect_count": "INTEGER NOT NULL DEFAULT 0",
    "mistakes_total": "INTEGER NOT NULL DEFAULT 0",
}


def _ensure_user_columns(conn: sqlite3.Connection) -> None:
    """幂等地为 users 补齐成长系统列。"""
    existing = {r["name"] for r in conn.execute("PRAGMA table_info(users)")}
    for col, ddl in _USER_EXTRA_COLUMNS.items():
        if col not in existing:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
    conn.commit()


# ============================================================
# 订单
# ============================================================
def create_order(amount_fen: int) -> dict:
    """创建一笔待支付订单，返回订单字典（含内部单号 id 与对外单号 out_trade_no）。"""
    oid = uuid.uuid4().hex
    out_trade_no = uuid.uuid4().hex
    created_at = _now()
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO orders (id, out_trade_no, amount_fen, status, created_at) "
            "VALUES (?, ?, ?, 'pending', ?)",
            (oid, out_trade_no, amount_fen, created_at),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": oid,
        "out_trade_no": out_trade_no,
        "amount_fen": amount_fen,
        "status": "pending",
        "created_at": created_at,
    }


def get_order(order_id: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def mark_order_paid(out_trade_no: str) -> str | None:
    """
    按对外单号把订单置为已支付并颁发一次性 token（幂等）。
    返回该订单的 token；订单不存在返回 None。
    支付平台回调可能重复送达，这里重复调用返回同一个 token、不重复改时间。
    """
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, status, token FROM orders WHERE out_trade_no = ?",
            (out_trade_no,),
        ).fetchone()
        if row is None:
            return None
        if row["status"] == "paid" and row["token"]:
            return row["token"]  # 已处理过，幂等返回
        token = secrets.token_urlsafe(24)
        conn.execute(
            "UPDATE orders SET status = 'paid', token = ?, paid_at = ? WHERE out_trade_no = ?",
            (token, _now(), out_trade_no),
        )
        conn.commit()
        return token
    finally:
        conn.close()


# ============================================================
# 一次性令牌
# ============================================================
def consume_token(token: str) -> bool:
    """
    校验并消费一个已支付 token：必须存在于已支付订单、且未被用过。
    成功消费返回 True（并记入 token_usage）；无效或已用返回 False。
    """
    if not token:
        return False
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT 1 FROM orders WHERE token = ? AND status = 'paid'", (token,)
        ).fetchone()
        if row is None:
            return False
        # 唯一主键保证不可重复消费：已存在则插入失败 -> 视为已用
        try:
            conn.execute(
                "INSERT INTO token_usage (token, used_at) VALUES (?, ?)",
                (token, _now()),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False  # 已被消费过
    finally:
        conn.close()


# ============================================================
# 免费额度（按 IP + 日期）
# ============================================================
def get_free_remaining(ip: str, limit: int = FREE_DAILY_LIMIT) -> int:
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT count FROM free_usage WHERE ip = ? AND day = ?", (ip, _today())
        ).fetchone()
    finally:
        conn.close()
    used = row["count"] if row else 0
    return max(0, limit - used)


def consume_free(ip: str, limit: int = FREE_DAILY_LIMIT) -> bool:
    """
    尝试消费一次今日免费额度：未超限则计数 +1 返回 True，已超限返回 False。
    用 UPSERT 原子自增，避免并发下读改写竞争。
    """
    conn = get_conn()
    try:
        cur = conn.execute(
            "SELECT count FROM free_usage WHERE ip = ? AND day = ?", (ip, _today())
        ).fetchone()
        used = cur["count"] if cur else 0
        if used >= limit:
            return False
        conn.execute(
            "INSERT INTO free_usage (ip, day, count) VALUES (?, ?, 1) "
            "ON CONFLICT(ip, day) DO UPDATE SET count = count + 1",
            (ip, _today()),
        )
        conn.commit()
        return True
    finally:
        conn.close()


# ============================================================
# 用户账号（手机号唯一，一号一户）
# ============================================================
_SMS_EXPIRE_SEC = 300       # 验证码有效期 5 分钟
_SMS_COOLDOWN_SEC = 60      # 同一手机号两次发送最短间隔
_SMS_DAY_LIMIT = 10         # 同一手机号每天最多发送次数


def create_user(phone: str, password_hash: str, nickname: str | None = None) -> dict:
    """
    新建用户。若手机号已存在抛出 ValueError（调用方捕获）。
    phone UNIQUE 约束由数据库强制：即使并发也只有一个注册能成功。
    """
    created_at = _now()
    nickname = (nickname or "").strip() or f"学员{phone[-4:]}"
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (phone, password_hash, created_at, nickname) VALUES (?, ?, ?, ?)",
            (phone, password_hash, created_at, nickname),
        )
        conn.commit()
        return {"id": cur.lastrowid, "phone": phone, "created_at": created_at, "nickname": nickname}
    except sqlite3.IntegrityError:
        raise ValueError("该手机号已注册")
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ============================================================
# 成长系统：通关记录 + 经验/连续天数
# ============================================================
# 每个课程的总关卡数（用于计算进度百分比）；按需调整。
COURSE_TOTAL = {
    "ds-stack": 6, "ds-metro": 4, "ds-pipes": 5, "ds-archive": 5,
    "ds-tower": 5, "ds-postoffice": 5, "ds-grid": 4, "ds-sorting": 5,
    "db-detective": 8,
}
XP_FIRST_CLEAR = 20   # 首次通关
XP_PERFECT_BONUS = 10  # 零失误额外奖励
XP_REPLAY = 4         # 重复通关


def level_from_xp(xp: int) -> int:
    """等级：每 100 经验升一级，从 1 级起。"""
    return 1 + xp // 100


def title_from_level(level: int) -> str:
    titles = ["新手学徒", "初级探员", "熟练工程师", "资深玩家", "课程大师", "传奇导师"]
    return titles[min(level // 3, len(titles) - 1)]


def _bump_streak(user: dict, conn: sqlite3.Connection) -> int:
    """根据上次活跃日期更新连续学习天数，返回新 streak。"""
    today = _today()
    last = (user.get("last_active") or "")[:10]
    streak = user.get("streak") or 0
    if last == today:
        pass  # 今天已记过
    elif last == _yesterday():
        streak += 1
    else:
        streak = 1
    conn.execute(
        "UPDATE users SET streak = ?, last_active = ? WHERE id = ?",
        (streak, today, user["id"]),
    )
    return streak


def _yesterday() -> str:
    from datetime import timedelta
    return (date.today() - timedelta(days=1)).isoformat()


def record_clear(user_id: int, course: str, level_id: str, mistakes: int, perfect: bool) -> dict:
    """
    记录一次通关：首通发全额经验，重复通关发少量；更新最佳失误数、连续天数。
    返回最新的成长概况。
    """
    now = _now()
    conn = get_conn()
    try:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise ValueError("用户不存在")
        user = dict(user)

        existing = conn.execute(
            "SELECT * FROM level_clears WHERE user_id=? AND course=? AND level_id=?",
            (user_id, course, level_id),
        ).fetchone()

        first_time = existing is None
        gained = XP_FIRST_CLEAR if first_time else XP_REPLAY
        if perfect:
            gained += XP_PERFECT_BONUS

        if first_time:
            conn.execute(
                "INSERT INTO level_clears (user_id, course, level_id, best_mistakes, perfect, clears, first_at, last_at) "
                "VALUES (?,?,?,?,?,1,?,?)",
                (user_id, course, level_id, mistakes, 1 if perfect else 0, now, now),
            )
        else:
            best = min(existing["best_mistakes"], mistakes)
            newperfect = 1 if (existing["perfect"] or perfect) else 0
            conn.execute(
                "UPDATE level_clears SET best_mistakes=?, perfect=?, clears=clears+1, last_at=? "
                "WHERE id=?",
                (best, newperfect, now, existing["id"]),
            )

        # 汇总统计
        rows = conn.execute(
            "SELECT perfect, best_mistakes FROM level_clears WHERE user_id=?", (user_id,)
        ).fetchall()
        cleared_count = len(rows)
        perfect_count = sum(r["perfect"] for r in rows)
        mistakes_total = sum(r["best_mistakes"] for r in rows)

        new_xp = (user.get("xp") or 0) + gained
        streak = _bump_streak({**user, "last_active": user.get("last_active")}, conn)
        conn.execute(
            "UPDATE users SET xp=?, cleared_count=?, perfect_count=?, mistakes_total=? WHERE id=?",
            (new_xp, cleared_count, perfect_count, mistakes_total, user_id),
        )
        conn.commit()
        return {
            "gained": gained,
            "first_time": first_time,
            "xp": new_xp,
            "level": level_from_xp(new_xp),
            "title": title_from_level(level_from_xp(new_xp)),
            "streak": streak,
            "cleared_count": cleared_count,
            "perfect_count": perfect_count,
        }
    finally:
        conn.close()


def get_profile(user_id: int) -> dict | None:
    """学生个人成长概况 + 各课程进度。"""
    conn = get_conn()
    try:
        u = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not u:
            return None
        u = dict(u)
        clears = [dict(r) for r in conn.execute(
            "SELECT course, level_id, best_mistakes, perfect, clears, last_at "
            "FROM level_clears WHERE user_id=? ORDER BY last_at DESC", (user_id,)
        ).fetchall()]
        per_course: dict[str, dict] = {}
        for c in clears:
            pc = per_course.setdefault(c["course"], {"cleared": 0, "perfect": 0})
            pc["cleared"] += 1
            pc["perfect"] += c["perfect"]
        for course, pc in per_course.items():
            pc["total"] = COURSE_TOTAL.get(course, pc["cleared"])
        xp = u.get("xp") or 0
        lvl = level_from_xp(xp)
        return {
            "phone": u["phone"],
            "nickname": u.get("nickname") or f"学员{u['phone'][-4:]}",
            "xp": xp,
            "level": lvl,
            "xp_into_level": xp % 100,
            "xp_to_next": 100 - (xp % 100),
            "title": title_from_level(lvl),
            "streak": u.get("streak") or 0,
            "cleared_count": u.get("cleared_count") or 0,
            "perfect_count": u.get("perfect_count") or 0,
            "mistakes_total": u.get("mistakes_total") or 0,
            "last_active": u.get("last_active"),
            "per_course": per_course,
            "recent": clears[:8],
        }
    finally:
        conn.close()


def update_nickname(user_id: int, nickname: str) -> None:
    nickname = (nickname or "").strip()[:20]
    if not nickname:
        return
    conn = get_conn()
    try:
        conn.execute("UPDATE users SET nickname=? WHERE id=?", (nickname, user_id))
        conn.commit()
    finally:
        conn.close()


def list_students() -> list[dict]:
    """管理后台：所有学生的成长概况（按经验降序）。"""
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, phone, nickname, xp, streak, last_active, "
            "cleared_count, perfect_count, mistakes_total, created_at "
            "FROM users ORDER BY xp DESC, created_at ASC"
        ).fetchall()
        out = []
        total_levels = sum(COURSE_TOTAL.values())
        for r in rows:
            d = dict(r)
            xp = d.get("xp") or 0
            out.append({
                "id": d["id"],
                "phone": d["phone"],
                "nickname": d.get("nickname") or f"学员{d['phone'][-4:]}",
                "xp": xp,
                "level": level_from_xp(xp),
                "title": title_from_level(level_from_xp(xp)),
                "streak": d.get("streak") or 0,
                "cleared_count": d.get("cleared_count") or 0,
                "total_levels": total_levels,
                "perfect_count": d.get("perfect_count") or 0,
                "mistakes_total": d.get("mistakes_total") or 0,
                "last_active": d.get("last_active"),
                "created_at": d.get("created_at"),
            })
        return out
    finally:
        conn.close()


def get_user_by_phone(phone: str) -> dict | None:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ============================================================
# 短信验证码
# ============================================================
def can_send_sms(phone: str) -> tuple[bool, str]:
    """
    检查是否允许发送验证码。返回 (ok, reason)。
    - 冷却期内（60秒）：拒绝
    - 当日超限（10次）：拒绝
    """
    conn = get_conn()
    try:
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        cooldown_since = (now - timedelta(seconds=_SMS_COOLDOWN_SEC)).isoformat()
        day_since = (now - timedelta(hours=24)).isoformat()

        recent = conn.execute(
            "SELECT COUNT(*) FROM sms_codes WHERE phone = ? AND created_at > ?",
            (phone, cooldown_since),
        ).fetchone()[0]
        if recent > 0:
            return False, f"操作太频繁，请 {_SMS_COOLDOWN_SEC} 秒后再试"

        today_count = conn.execute(
            "SELECT COUNT(*) FROM sms_codes WHERE phone = ? AND created_at > ?",
            (phone, day_since),
        ).fetchone()[0]
        if today_count >= _SMS_DAY_LIMIT:
            return False, "今日验证码发送次数已达上限"

        return True, ""
    finally:
        conn.close()


def save_sms_code(phone: str, code: str) -> None:
    """存储验证码（不自动删旧码；verify_sms_code 已处理过期逻辑）。"""
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=_SMS_EXPIRE_SEC)).isoformat()
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO sms_codes (phone, code, created_at, expires_at, used) "
            "VALUES (?, ?, ?, ?, 0)",
            (phone, code, now.isoformat(), expires_at),
        )
        conn.commit()
    finally:
        conn.close()


def verify_sms_code(phone: str, code: str) -> bool:
    """
    校验验证码：找到最近一条未使用且未过期的匹配记录，标记为已用。
    用 used=1 防止重放攻击。
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id FROM sms_codes "
            "WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ? "
            "ORDER BY created_at DESC LIMIT 1",
            (phone, code, now),
        ).fetchone()
        if row is None:
            return False
        conn.execute("UPDATE sms_codes SET used = 1 WHERE id = ?", (row["id"],))
        conn.commit()
        return True
    finally:
        conn.close()
