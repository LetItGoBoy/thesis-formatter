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

load_dotenv()

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
PARSE_TIMEOUT_SEC = float(os.environ.get("PARSE_TIMEOUT", 60))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# 格式规则只从 config/formats/ 下的 JSON 读取，不硬编码
CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config", "formats")

_parse_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="parse")


def _load_template(template: str) -> dict | None:
    path = os.path.join(CONFIG_DIR, f"{template}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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
    logger.info("收到 /api/parse: file=%s size=%dB", file.filename, len(file_bytes))

    future = _parse_executor.submit(parse_docx, file_bytes)
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
