"""
论文格式化工具 - Flask主应用
backend/app.py
"""
import os
import io
import sys
import json
import logging
import traceback
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

from lib.parser import parse_docx, ParseError
from lib.formatter import format_docx

load_dotenv()

# ============================================================
# 日志配置：stdout即时刷新，便于在容器中实时查看
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("thesis.app")

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

FLASK_PORT = int(os.environ.get("FLASK_PORT", 5000))
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", 20))
# 整个 /api/parse 接口的最长等待时间（秒）。超过此时长直接返回错误，避免前端无限转圈。
PARSE_TIMEOUT_SEC = float(os.environ.get("PARSE_TIMEOUT", 30))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config", "formats")

# 用于带超时执行parse_docx
_parse_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="parse")


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
    logger.info("收到/api/parse请求: file=%s size=%dB timeout=%.0fs",
                file.filename, len(file_bytes), PARSE_TIMEOUT_SEC)

    future = _parse_executor.submit(parse_docx, file_bytes)
    try:
        paragraphs = future.result(timeout=PARSE_TIMEOUT_SEC)
        logger.info("解析成功: %d段", len(paragraphs))
        return jsonify({"paragraphs": paragraphs})
    except FutureTimeout:
        # 注意：线程不能强制中断，但response立即返回，避免前端挂死
        future.cancel()
        logger.error("解析超时（>%.0fs）", PARSE_TIMEOUT_SEC)
        return jsonify({
            "error": (
                f"AI识别超时（{int(PARSE_TIMEOUT_SEC)}秒未完成）。"
                "请检查：(1) AI_PROVIDER 和对应 API_KEY 是否正确 "
                "(2) 后端容器是否能访问AI服务 "
                "(3) 论文段落数是否过多（可调大 PARSE_TIMEOUT 环境变量）"
            )
        }), 504
    except ParseError as e:
        # parser内部抛出的用户可读错误
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

    template_path = os.path.join(CONFIG_DIR, f"{template}.json")
    if not os.path.exists(template_path):
        return jsonify({"error": f"未找到模板: {template}"}), 400

    with open(template_path, "r", encoding="utf-8") as f:
        format_config = json.load(f)

    try:
        source_bytes = None
        if docx_b64:
            import base64
            source_bytes = base64.b64decode(docx_b64)

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
