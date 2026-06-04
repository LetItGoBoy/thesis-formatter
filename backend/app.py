"""
论文格式化工具 - Flask主应用
backend/app.py

接口：
  POST /api/parse   multipart/form-data, 字段 file(.docx)
                    -> {paragraphs:[{index, type, text, confidence, block}]}
  POST /api/format  {paragraphs:[{index, type, text}], template, docx_base64?}
                    -> .docx 文件流
"""
import os
import sys
import json
import base64
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

from lib.parser import parse_docx, ParseError
from lib.formatter import format_docx
from lib import db
from lib.auth import require_auth, sign_jwt, hash_password, verify_password
from lib.sms import send_verification_code

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("thesis.app")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 启动即建表（幂等）。SQLite 文件路径见 lib/db.py（默认 backend/data/thesis.db）
db.init_db()

FLASK_PORT = int(os.environ.get("FLASK_PORT", 5000))
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", 20))
PARSE_TIMEOUT_SEC = float(os.environ.get("PARSE_TIMEOUT", 60))
# 格式化接口要发回 docx_base64（≈原文件 ×1.33）+ 段落数据，用更大的上限
# MAX_UPLOAD_MB 控制上传文件大小，MAX_CONTENT_MB 控制所有请求体上限
MAX_CONTENT_MB = int(os.environ.get("MAX_CONTENT_MB", 100))
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_MB * 1024 * 1024

# 格式规则只从 config/formats/ 下的 JSON 读取，不硬编码
CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config", "formats")

_parse_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="parse")


def _load_template(template: str) -> dict | None:
    path = os.path.join(CONFIG_DIR, f"{template}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


import re
_PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


# ============================================================
# 认证接口
# ============================================================

@app.route("/api/auth/send-code", methods=["POST"])
def auth_send_code():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    if not _PHONE_RE.match(phone):
        return jsonify({"error": "手机号格式不正确"}), 400

    ok, reason = db.can_send_sms(phone)
    if not ok:
        return jsonify({"error": reason}), 429

    try:
        code = send_verification_code(phone)
        db.save_sms_code(phone, code)
        return jsonify({"ok": True})
    except Exception as e:
        logger.error("发送短信失败: %s", e)
        return jsonify({"error": f"短信发送失败: {e}"}), 500


@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not _PHONE_RE.match(phone):
        return jsonify({"error": "手机号格式不正确"}), 400
    if len(password) < 6:
        return jsonify({"error": "密码不少于6位"}), 400


    try:
        user = db.create_user(phone, hash_password(password))
    except ValueError as e:
        return jsonify({"error": str(e)}), 409  # 409 Conflict = 手机号已注册

    token = sign_jwt(user["id"], phone)
    logger.info("新用户注册: phone=%s***%s uid=%s", phone[:3], phone[-4:], user["id"])
    return jsonify({"token": token, "phone": phone})


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""

    if not _PHONE_RE.match(phone):
        return jsonify({"error": "手机号格式不正确"}), 400

    user = db.get_user_by_phone(phone)
    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "手机号或密码错误"}), 401

    token = sign_jwt(user["id"], phone)
    return jsonify({"token": token, "phone": phone})


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def auth_me():
    return jsonify(request.current_user)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "ai_provider": os.environ.get("AI_PROVIDER", "deepseek"),
        "parse_timeout_sec": PARSE_TIMEOUT_SEC,
    })


@app.route("/api/parse", methods=["POST"])
def api_parse():
    if "file" not in request.files:
        return jsonify({"error": "缺少file字段"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "文件名为空"}), 400
    if not file.filename.lower().endswith(".docx"):
        return jsonify({"error": "仅支持.docx文件"}), 400

    file_bytes = file.read()
    tier = (request.form.get("tier") or "").strip() or None
    logger.info("收到 /api/parse: file=%s size=%dB tier=%s",
                file.filename, len(file_bytes), tier)

    future = _parse_executor.submit(parse_docx, file_bytes, tier)
    try:
        paragraphs = future.result(timeout=PARSE_TIMEOUT_SEC)
        logger.info("解析成功: %d 段", len(paragraphs))
        return jsonify({"paragraphs": paragraphs})
    except FutureTimeout:
        future.cancel()
        logger.error("解析超时 (>%.0fs)", PARSE_TIMEOUT_SEC)
        return jsonify({
            "error": (
                f"AI识别超时（{int(PARSE_TIMEOUT_SEC)}秒）。请检查 AI_PROVIDER / API_KEY "
                "是否正确，后端是否能访问AI服务，或调大 PARSE_TIMEOUT。"
            )
        }), 504
    except ParseError as e:
        logger.error("解析失败: %s", e)
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.error("解析未知异常: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": f"解析失败: {e}"}), 500


@app.route("/api/format", methods=["POST"])
def api_format():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "缺少JSON请求体"}), 400

    paragraphs = data.get("paragraphs")
    template = data.get("template", "hulunbeier_univ")
    docx_b64 = data.get("docx_base64")

    if not paragraphs:
        return jsonify({"error": "缺少paragraphs字段"}), 400

    format_config = _load_template(template)
    if format_config is None:
        return jsonify({"error": f"未找到模板: {template}"}), 400

    try:
        source_bytes = base64.b64decode(docx_b64) if docx_b64 else None
        output_stream = format_docx(
            paragraphs=paragraphs,
            format_config=format_config,
            source_bytes=source_bytes,
        )
        output_stream.seek(0)
        return send_file(
            output_stream,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            as_attachment=True,
            download_name="formatted.docx",
        )
    except Exception as e:
        logger.error("格式化失败: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": f"格式化失败: {e}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=True)
