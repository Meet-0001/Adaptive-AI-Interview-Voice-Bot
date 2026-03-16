import asyncio
import edge_tts
import os
import tempfile
import hashlib

VOICE = "en-US-GuyNeural"
OUTPUT_DIR = "uploads"

os.makedirs(OUTPUT_DIR, exist_ok=True)


async def _synthesize_async(text: str, output_path: str):
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_path)


def synthesize(text: str) -> str:
    """Convert text to speech using Edge TTS Guy voice. Returns path to audio file."""
    # Use hash so same text reuses cached file
    text_hash = hashlib.md5(text.encode()).hexdigest()[:10]
    output_path = os.path.join(OUTPUT_DIR, f"tts_{text_hash}.mp3")

    if os.path.exists(output_path):
        return output_path

    try:
        # Run async in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_synthesize_async(text, output_path))
        loop.close()
        return output_path
    except Exception as e:
        raise RuntimeError(f"TTS synthesis failed: {str(e)}")


def get_available_voices():
    """Return list of available Edge TTS voices (async)."""
    async def _list():
        voices = await edge_tts.list_voices()
        return [v for v in voices if v["Locale"].startswith("en-")]

    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(_list())
    loop.close()
    return result