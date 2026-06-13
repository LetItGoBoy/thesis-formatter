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
from lib.checkup import checkup_docx, run_checkup_typed, load_checkup_rules, CheckupError
from lib.polish_parser import import_docx_as_blocks
from lib.polish_rewriter import rewrite_text, SUPPORTED_ACTIONS, PolishError
from lib.polish_export import export_polished_docx
from lib import db
from lib.auth import require_auth, require_admin, is_admin, sign_jwt, hash_password, verify_password
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


    nickname = (data.get("nickname") or "").strip()[:20]
    try:
        user = db.create_user(phone, hash_password(password), nickname)
    except ValueError as e:
        return jsonify({"error": str(e)}), 409  # 409 Conflict = 手机号已注册

    token = sign_jwt(user["id"], phone)
    logger.info("新用户注册: phone=%s***%s uid=%s", phone[:3], phone[-4:], user["id"])
    return jsonify({"token": token, "phone": phone, "nickname": user["nickname"]})


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
    return jsonify({
        "token": token,
        "phone": phone,
        "nickname": user.get("nickname") or f"学员{phone[-4:]}",
        "is_admin": is_admin(phone),
    })


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def auth_me():
    return jsonify(request.current_user)


# ============================================================
# 成长系统：通关上报 / 个人概况 / 管理后台
# ============================================================
@app.route("/api/progress/clear", methods=["POST"])
@require_auth
def progress_clear():
    data = request.get_json(silent=True) or {}
    course = (data.get("course") or "").strip()[:40]
    level_id = (data.get("level_id") or "").strip()[:40]
    mistakes = int(data.get("mistakes") or 0)
    perfect = bool(data.get("perfect"))
    if not course or not level_id:
        return jsonify({"error": "缺少 course / level_id"}), 400
    result = db.record_clear(request.current_user["user_id"], course, level_id, mistakes, perfect)
    return jsonify(result)


@app.route("/api/profile", methods=["GET"])
@require_auth
def profile():
    p = db.get_profile(request.current_user["user_id"])
    if not p:
        return jsonify({"error": "用户不存在"}), 404
    p["is_admin"] = request.current_user.get("is_admin", False)
    return jsonify(p)


@app.route("/api/profile/nickname", methods=["POST"])
@require_auth
def profile_nickname():
    data = request.get_json(silent=True) or {}
    db.update_nickname(request.current_user["user_id"], data.get("nickname") or "")
    return jsonify({"ok": True})


@app.route("/api/admin/students", methods=["GET"])
@require_admin
def admin_students():
    return jsonify({"students": db.list_students()})


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


# ============================================================
# 提交前体检（第三个模块，独立于格式化与润色）
#   纯规则、零 AI 调用：上传 .docx -> 抽取原始块 -> 内容/结构体检
#   -> 返回按严重度分级的问题清单 + 评分。
# ============================================================

@app.route("/api/checkup", methods=["POST"])
def api_checkup():
    """
    两种入口：
      A) JSON {paragraphs:[...]} —— 复用前端缓存的 AI 解析结果，边界可靠（推荐）
      B) multipart file —— 无缓存时上传 .docx，走正则结构检测（离线兜底）
    """
    rules = load_checkup_rules()

    # A) 复用已解析的带类型段落
    if request.is_json or request.form.get("paragraphs"):
        data = request.get_json(silent=True) or {}
        paragraphs = data.get("paragraphs")
        if not isinstance(paragraphs, list) or not paragraphs:
            return jsonify({"error": "缺少paragraphs字段"}), 400
        logger.info("收到 /api/checkup(JSON): %d 段（复用解析）", len(paragraphs))
        try:
            return jsonify(run_checkup_typed(paragraphs, rules))
        except Exception as e:
            logger.error("体检(typed)异常: %s\n%s", e, traceback.format_exc())
            return jsonify({"error": f"体检失败: {e}"}), 500

    # B) 文件上传（正则兜底）
    if "file" not in request.files:
        return jsonify({"error": "缺少file字段或paragraphs字段"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "文件名为空"}), 400
    if not file.filename.lower().endswith(".docx"):
        return jsonify({"error": "仅支持.docx文件"}), 400

    file_bytes = file.read()
    logger.info("收到 /api/checkup(file): file=%s size=%dB", file.filename, len(file_bytes))
    try:
        result = checkup_docx(file_bytes, rules)
        return jsonify(result)
    except CheckupError as e:
        logger.warning("体检失败: %s", e)
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        logger.error("体检未知异常: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": f"体检失败: {e}"}), 500


# ============================================================
# 论文表达润色（第二个模块，独立于格式化流程）
#   不调用 parse_docx / format_docx / semantic_v2，不做结构识别。
#   /api/polish/import  上传 docx -> 顺序抽取 blocks（不调用 AI）
#   /api/polish/rewrite 单段润色（点击按钮时才调 AI）
#   /api/polish/export  基于原始 docx 回写修改过的段落 -> polished.docx
# ============================================================

@app.route("/api/polish/import", methods=["POST"])
def api_polish_import():
    if "file" not in request.files:
        return jsonify({"error": "缺少file字段"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "文件名为空"}), 400
    if not file.filename.lower().endswith(".docx"):
        return jsonify({"error": "仅支持.docx文件"}), 400

    file_bytes = file.read()
    logger.info("收到 /api/polish/import: file=%s size=%dB", file.filename, len(file_bytes))
    try:
        result = import_docx_as_blocks(file_bytes)
    except Exception as e:
        logger.error("润色解析失败: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": f".docx解析失败，可能已损坏: {e}"}), 500

    # 第一版不做后端状态管理：直接把原始 docx 以 base64 回传给前端，
    # 导出时再传回来，减少服务端临时存储。
    docx_b64 = base64.b64encode(file_bytes).decode("ascii")
    return jsonify({
        "docx_base64": docx_b64,
        "file_name": file.filename,
        "blocks": result["blocks"],
        "stats": result["stats"],
    })


@app.route("/api/polish/rewrite", methods=["POST"])
def api_polish_rewrite():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    action = (data.get("action") or "").strip()

    if not text:
        return jsonify({"error": "原文为空，无法润色"}), 400
    if action not in SUPPORTED_ACTIONS:
        return jsonify({"error": f"不支持的润色操作: {action}"}), 400

    try:
        result = rewrite_text(text, action)
        return jsonify(result)
    except PolishError as e:
        logger.warning("润色失败: %s", e)
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        logger.error("润色未知异常: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": f"润色失败: {e}"}), 500


@app.route("/api/polish/export", methods=["POST"])
def api_polish_export():
    data = request.get_json(silent=True) or {}
    docx_b64 = data.get("docx_base64")
    blocks = data.get("blocks")

    if not docx_b64:
        return jsonify({"error": "缺少docx_base64字段"}), 400
    if not isinstance(blocks, list):
        return jsonify({"error": "缺少blocks字段"}), 400

    try:
        source_bytes = base64.b64decode(docx_b64)
        output_stream = export_polished_docx(source_bytes, blocks)
        output_stream.seek(0)
        return send_file(
            output_stream,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            as_attachment=True,
            download_name="polished.docx",
        )
    except Exception as e:
        logger.error("润色导出失败: %s\n%s", e, traceback.format_exc())
        return jsonify({"error": f"导出失败: {e}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=True)
