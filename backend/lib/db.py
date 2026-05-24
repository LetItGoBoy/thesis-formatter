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
            """
        )
        conn.commit()
        logger.info("SQLite 初始化完成：%s", DB_PATH)
    finally:
        conn.close()


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


def create_user(phone: str, password_hash: str) -> dict:
    """
    新建用户。若手机号已存在抛出 ValueError（调用方捕获）。
    phone UNIQUE 约束由数据库强制：即使并发也只有一个注册能成功。
    """
    created_at = _now()
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO users (phone, password_hash, created_at) VALUES (?, ?, ?)",
            (phone, password_hash, created_at),
        )
        conn.commit()
        return {"id": cur.lastrowid, "phone": phone, "created_at": created_at}
    except sqlite3.IntegrityError:
        raise ValueError("该手机号已注册")
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
