# Adaptive-AI-Interview-Voice-Bot
# InterviewMentor 🎯

AI-powered mock interview coach with voice input (Whisper STT), voice output (Edge TTS — Guy Neural),
local AI (Ollama llama3.2), and SQLite storage. 100% local, no cloud required.

---

## Features

- 🎙 **Whisper STT** — speak your answers, they get transcribed automatically
- 🔊 **Edge TTS (Guy Neural)** — the AI mentor speaks back in a natural male voice
- 🧠 **Ollama llama3.2** — local AI, fully private
- 💾 **SQLite** — stores last 10 sessions, auto-deletes oldest
- 📄 **Document upload** — upload resume / JD for personalized questions
- 🗂 **Session history** — browse, load, delete past sessions

---

## Project Structure

```
interview-mentor/
├── app.py                  # Flask app & all API routes
├── database.py             # SQLite CRUD + auto-cleanup
├── ollama_client.py        # Ollama llama3.2 chat client
├── whisper_handler.py      # Whisper STT (openai-whisper)
├── tts_handler.py          # Edge TTS (en-US-GuyNeural)
├── requirements.txt        # Python dependencies
├── templates/
│   ├── index.html          # Landing page
│   └── app.html            # Main interview app
├── static/
│   ├── css/style.css       # All styles
│   └── js/
│       ├── main.js         # App logic, chat, TTS, sessions
│       └── recorder.js     # MediaRecorder voice capture
└── uploads/                # Temp audio + TTS cache (auto-created)
```

---

## Setup

### 1. Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com/) installed
- [ffmpeg](https://ffmpeg.org/) installed (for Whisper audio conversion)

**Install ffmpeg:**
```cmd
winget install ffmpeg
```
or download from https://ffmpeg.org/download.html and add to PATH.

---

### 2. Start Ollama with CORS enabled

Open CMD:
```cmd
set OLLAMA_ORIGINS=*
set OLLAMA_HOST=0.0.0.0
ollama serve
```

In a new CMD window, pull llama3.2:
```cmd
ollama pull llama3.2
```

---

### 3. Install Python dependencies

```cmd
cd interview-mentor
pip install -r requirements.txt
```

**Note:** Whisper will download the base model (~150MB) on first run automatically.

---

### 4. Run Flask

```cmd
python app.py
```

Open in browser: **http://localhost:5000**

---

## Usage

1. Open http://localhost:5000
2. Click **Launch App** (or go to http://localhost:5000/app)
3. Type your target role (e.g. "Senior Frontend Engineer")
4. Optionally upload your resume or job description
5. Click **Start Interview**
6. The AI mentor will greet you and ask the first question — spoken aloud in Guy's voice
7. Click the 🎙 mic button and speak your answer (or type it)
8. Get feedback after each answer
9. Sessions auto-save. After 10 sessions, the oldest is deleted automatically.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check Ollama status |
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions/start` | Start a new session |
| GET | `/api/sessions/:id` | Get session + messages |
| DELETE | `/api/sessions/:id` | Delete a session |
| POST | `/api/chat` | Send message, get AI reply |
| POST | `/api/stt` | Upload audio, get transcription |
| POST | `/api/tts` | Get TTS audio for text |

---

## Configuration

Edit these at the top of each file:

**ollama_client.py:**
```python
MODEL = "llama3.2"           # Change to any installed Ollama model
OLLAMA_URL = "http://localhost:11434"
```

**tts_handler.py:**
```python
VOICE = "en-US-GuyNeural"    # Change to any Edge TTS voice
```

**database.py:**
```python
MAX_SESSIONS = 10            # Auto-delete after this many sessions
```

**whisper_handler.py:**
```python
# In load_model("base") — change to "small", "medium", "large" for better accuracy
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Ollama offline | Run `set OLLAMA_ORIGINS=*` then `ollama serve` |
| No microphone | Allow browser mic permission in site settings |
| TTS not playing | Check browser allows audio autoplay |
| Whisper slow | Use `"tiny"` model in `whisper_handler.py` |
| ffmpeg error | Install ffmpeg and add to PATH |
| Port 5000 busy | Change port in `app.py`: `app.run(port=5001)` |
