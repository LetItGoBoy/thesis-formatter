"""
论文格式化工具 - Flask主应用
backend/app.py
"""
import os
import io
import json
import traceback
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

from lib.parser import parse_docx
from lib.formatter import format_docx

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

FLASK_PORT = int(os.environ.get("FLASK_PORT", 5000))
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", 20))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config", "formats")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "ai_provider": os.environ.get("AI_PROVIDER", "deepseek"),
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

    try:
        file_bytes = file.read()
        paragraphs = parse_docx(file_bytes)
        return jsonify({"paragraphs": paragraphs})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"解析失败: {str(e)}"}), 500


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
        traceback.print_exc()
        return jsonify({"error": f"格式化失败: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=True)
