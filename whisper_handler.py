import whisper
import os
import subprocess
import tempfile

_model = None


def load_model(size="base"):
    global _model
    if _model is None:
        print(f"[Whisper] Loading model: {size}")
        _model = whisper.load_model(size)
        print("[Whisper] Model loaded.")
    return _model


def transcribe(audio_path: str) -> str:
    """Transcribe audio file to text using Whisper."""
    try:
        model = load_model("base")

        # Convert webm/ogg to wav if needed
        wav_path = audio_path
        if not audio_path.endswith(".wav"):
            wav_path = audio_path.replace(os.path.splitext(audio_path)[1], ".wav")
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path],
                capture_output=True,
                timeout=30,
            )
            if result.returncode != 0:
                # Try without ffmpeg — Whisper can handle some formats directly
                wav_path = audio_path

        result = model.transcribe(wav_path, fp16=False)
        text = result.get("text", "").strip()

        # Cleanup converted file
        if wav_path != audio_path and os.path.exists(wav_path):
            os.remove(wav_path)

        return text if text else "[Could not transcribe audio]"

    except FileNotFoundError:
        return "[ffmpeg not found — install ffmpeg for audio conversion]"
    except Exception as e:
        return f"[Transcription error: {str(e)}]"