from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import os
import uuid

import database as db
import ollama_client as ollama
import whisper_handler as whisper
import tts_handler as tts

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ─── Pages ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/app")
def app_page():
    return render_template("app.html")


# ─── Health ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    ollama_ok = ollama.check_ollama()
    models = ollama.list_models() if ollama_ok else []
    return jsonify({
        "status": "ok",
        "ollama": ollama_ok,
        "models": models,
    })


# ─── Sessions ────────────────────────────────────────────────────────────────

@app.route("/api/sessions", methods=["GET"])
def get_sessions():
    return jsonify(db.get_all_sessions())


@app.route("/api/sessions/start", methods=["POST"])
def start_session():
    data = request.get_json(silent=True) or {}
    role = data.get("role", "General")
    session_id = db.create_session(role)
    db.cleanup_old_sessions()
    return jsonify({"session_id": session_id, "role": role})


@app.route("/api/sessions/<int:session_id>", methods=["GET"])
def get_session(session_id):
    session = db.get_session(session_id)
    if not session:
        return jsonify({"error": "Session not found"}), 404
    messages = db.get_session_messages(session_id)
    return jsonify({"session": session, "messages": messages})


@app.route("/api/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    db.delete_session(session_id)
    return jsonify({"success": True})


# ─── Chat ────────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    message = data.get("message", "").strip()
    role = data.get("role", "General")

    if not message:
        return jsonify({"error": "No message provided"}), 400

    history = db.get_session_messages(session_id) if session_id else []

    if session_id:
        db.add_message(session_id, "user", message)

    response = ollama.chat(message, history, role)

    if session_id:
        db.add_message(session_id, "assistant", response)

    return jsonify({"response": response})


# ─── STT ─────────────────────────────────────────────────────────────────────

@app.route("/api/stt", methods=["POST"])
def speech_to_text():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    ext = ".webm"
    filename = f"rec_{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(temp_path)

    text = whisper.transcribe(temp_path)

    try:
        os.remove(temp_path)
    except Exception:
        pass

    return jsonify({"text": text})


# ─── TTS ─────────────────────────────────────────────────────────────────────

@app.route("/api/tts", methods=["POST"])
def text_to_speech():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    # Limit TTS to 500 chars for speed
    if len(text) > 500:
        text = text[:497] + "..."

    try:
        audio_path = tts.synthesize(text)
        return send_file(audio_path, mimetype="audio/mpeg", as_attachment=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("  InterviewMentor Server")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, port=5000, host="0.0.0.0")