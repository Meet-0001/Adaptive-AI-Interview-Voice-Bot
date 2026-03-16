import requests
import json

OLLAMA_URL = "http://localhost:11434"
MODEL = "llama3.2"

SYSTEM_PROMPT = """You are InterviewMentor, an expert AI interview coach. Your job is to:
- Conduct realistic mock interviews tailored to the user's target role
- Ask one question at a time and wait for their answer before proceeding
- Give specific, actionable feedback after each answer using the STAR method
- Be encouraging but honest — point out both strengths and areas to improve
- Adapt your questions based on the role (technical for engineering, behavioral for management, etc.)
- Track the conversation and build follow-up questions naturally
- At the end of a session, provide a comprehensive summary with scores

Tone: Professional, warm, and coaching-oriented. You are like a senior mentor preparing someone for their dream job.

Format your responses clearly. Use short paragraphs. When giving feedback, use:
✓ for strengths
→ for suggestions
"""


def build_messages(user_message, history, role):
    system = SYSTEM_PROMPT
    if role and role != "General":
        system += f"\n\nThe user is preparing for a {role} position. Tailor your questions accordingly."

    messages = []
    for msg in history[-20:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})
    return system, messages


def chat(user_message, history=None, role="General"):
    if history is None:
        history = []

    system, messages = build_messages(user_message, history, role)

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": MODEL,
                "messages": messages,
                "system": system,
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]
    except requests.exceptions.ConnectionError:
        return "⚠ Ollama is not running. Please start Ollama with: set OLLAMA_ORIGINS=* && ollama serve"
    except Exception as e:
        return f"⚠ Error communicating with Ollama: {str(e)}"


def check_ollama():
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


def list_models():
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        data = resp.json()
        return [m["name"] for m in data.get("models", [])]
    except Exception:
        return []