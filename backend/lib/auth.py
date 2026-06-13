"""
JWT 签发/验证 + 密码哈希
backend/lib/auth.py

仅用标准库实现 HS256 JWT，不依赖 PyJWT，避免系统包冲突。
密码用 PBKDF2-SHA256 + 随机盐哈希，不存明文。
"""
import os
import json
import base64
import hashlib
import hmac
import secrets
import logging
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import request, jsonify

logger = logging.getLogger("thesis.auth")

_SECRET = (os.environ.get("JWT_SECRET") or secrets.token_hex(32)).encode("utf-8")
_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", 7))

if not os.environ.get("JWT_SECRET"):
    logger.warning("⚠️  JWT_SECRET 未设置，使用随机密钥——重启后所有登录态失效")


# ── 密码哈希 ──────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode(), 200_000)
    return f"{salt}:{h.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, h = hashed.split(":", 1)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode(), 200_000)
        return hmac.compare_digest(expected.hex(), h)
    except Exception:
        return False


# ── 纯标准库 HS256 JWT ────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (pad % 4))


def sign_jwt(user_id: int, phone: str) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    exp = int((datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)).timestamp())
    payload = _b64url_encode(
        json.dumps({"user_id": user_id, "phone": phone, "exp": exp}).encode()
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    sig = _b64url_encode(hmac.new(_SECRET, signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def verify_jwt(token: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = _b64url_encode(hmac.new(_SECRET, signing_input, hashlib.sha256).digest())
        if not hmac.compare_digest(expected_sig, sig_b64):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("exp", 0) < datetime.now(timezone.utc).timestamp():
            return None
        return {"user_id": payload["user_id"], "phone": payload["phone"]}
    except Exception:
        return None


# ── Flask 装饰器 ──────────────────────────────────────────────

# 管理员手机号白名单（逗号分隔）：ADMIN_PHONES=18700001234,13900005678
_ADMIN_PHONES = {
    p.strip() for p in (os.environ.get("ADMIN_PHONES") or "").split(",") if p.strip()
}


def is_admin(phone: str) -> bool:
    return phone in _ADMIN_PHONES


def require_auth(f):
    """验证 Bearer JWT，注入 request.current_user（含 is_admin）。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        user = verify_jwt(token)
        if not user:
            return jsonify({"error": "请先登录"}), 401
        user["is_admin"] = is_admin(user.get("phone", ""))
        request.current_user = user
        return f(*args, **kwargs)
    return wrapper


def require_admin(f):
    """仅管理员可访问。"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        user = verify_jwt(token)
        if not user:
            return jsonify({"error": "请先登录"}), 401
        if not is_admin(user.get("phone", "")):
            return jsonify({"error": "需要管理员权限"}), 403
        user["is_admin"] = True
        request.current_user = user
        return f(*args, **kwargs)
    return wrapper
