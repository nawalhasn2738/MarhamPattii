"""
AI-iman pipeline test script.
Balti audio -> BaltiVoice (Whisper) transcript -> Groq LLM -> structured intent JSON

Usage:
    python test_pipeline.py path/to/audio.wav

Pre-hackathon checklist this script covers:
  1. BaltiVoice access tested
  2. One Balti audio -> transcript tested
  3. LLM API tested
  4. Intent extraction prompt tested
  5. JSON output tested
  6. Error handling planned

Install:
    pip install transformers torch librosa soundfile groq python-dotenv

.env.local (same folder or project root):
    GROQ_API_KEY=your_key_here
"""

import os
import sys
import json
import re

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ASR_MODEL_ID = "mohdali1/whisper-small-balti"
LLM_MODEL_ID = "llama-3.3-70b-versatile"
MIN_TRANSCRIPT_WORDS = 2  # below this -> treat as unclear / ask patient to repeat

SYSTEM_PROMPT = """You are a communication assistant that converts patient requests \
into structured healthcare intent data. You are NOT a doctor. You must NEVER \
diagnose, suggest treatment, or name a disease. You only classify what KIND of \
help the patient is asking for and any stated duration/urgency, strictly from \
what was said.

Respond ONLY with valid JSON, no preamble, no markdown fences, in this exact shape:
{
  "intent": "doctor_request" | "specialist_request" | "facility_info" | "unclear",
  "duration": "<string or null>",
  "urgency": "unknown" | "routine" | "urgent",
  "requires_human": true,
  "summary_for_provider": "<one neutral sentence, no medical claims>"
}"""

FALLBACK_INTENT = {
    "intent": "unclear",
    "duration": None,
    "urgency": "unknown",
    "requires_human": True,
    "summary_for_provider": "Could not confidently interpret the request. Please review original audio.",
}


# ---------------------------------------------------------------------------
# Step 1 & 2: BaltiVoice ASR
# ---------------------------------------------------------------------------

def load_asr_pipeline():
    """Loads the BaltiVoice (fine-tuned Whisper) model. Checklist item #1."""
    from transformers import pipeline
    print(f"[ASR] Loading {ASR_MODEL_ID} ... (first run downloads ~1GB)")
    asr = pipeline(
        "automatic-speech-recognition",
        model=ASR_MODEL_ID,
        generate_kwargs={"language": "urdu", "task": "transcribe"},
    )
    print("[ASR] Model loaded.")
    return asr


def transcribe_audio(asr, audio_path: str) -> dict:
    """
    Checklist item #2. Returns a dict so we can carry confidence/error state
    forward instead of just a bare string.
    """
    if not os.path.exists(audio_path):
        return {"ok": False, "error": "audio_file_not_found", "text": ""}

    try:
        result = asr(audio_path)
        text = (result.get("text") or "").strip()
    except Exception as e:
        # Error handling: ASR crashes / model error
        return {"ok": False, "error": f"asr_failed: {e}", "text": ""}

    if not text:
        # Error handling: audio silent / no speech detected
        return {"ok": False, "error": "empty_transcript", "text": ""}

    if len(text.split()) < MIN_TRANSCRIPT_WORDS:
        # Error handling: transcript too short -> low confidence
        return {"ok": True, "error": "low_confidence_short", "text": text}

    return {"ok": True, "error": None, "text": text}


# ---------------------------------------------------------------------------
# Step 3 & 4: LLM intent extraction
# ---------------------------------------------------------------------------

def call_llm(transcript: str) -> str:
    """Checklist item #3. Raises on hard failure; caller handles retry/fallback."""
    from groq import Groq

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set (check .env.local)")

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=LLM_MODEL_ID,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f'Patient transcript: "{transcript}"'},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content


def extract_intent(transcript: str, retries: int = 1) -> dict:
    """Checklist item #4, with one retry on transient LLM failure."""
    last_error = None
    for attempt in range(retries + 1):
        try:
            raw = call_llm(transcript)
            return safe_parse_json(raw)
        except Exception as e:
            last_error = e
            print(f"[LLM] attempt {attempt + 1} failed: {e}")

    # Error handling: LLM API timeout/down after retries -> fallback
    fallback = dict(FALLBACK_INTENT)
    fallback["summary_for_provider"] = f"LLM unavailable ({last_error}). Raw transcript: {transcript}"
    return fallback


# ---------------------------------------------------------------------------
# Step 5: JSON parsing / validation
# ---------------------------------------------------------------------------

def safe_parse_json(raw: str) -> dict:
    """
    Checklist item #5. LLMs sometimes wrap JSON in ```json fences or add
    stray text -- strip that, then parse defensively. Never raises; always
    returns a valid-shaped dict.
    """
    if not raw:
        return dict(FALLBACK_INTENT)

    cleaned = re.sub(r"```json|```", "", raw).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        fallback = dict(FALLBACK_INTENT)
        fallback["summary_for_provider"] = f"Could not parse LLM response: {cleaned[:200]}"
        return fallback

    # Validate required keys exist; fill in anything missing
    required_defaults = FALLBACK_INTENT
    for key, default_val in required_defaults.items():
        if key not in data:
            data[key] = default_val

    return data


# ---------------------------------------------------------------------------
# Step 6: Full pipeline with error handling wired together
# ---------------------------------------------------------------------------

def run_pipeline(audio_path: str) -> dict:
    """
    Full end-to-end test: audio -> transcript -> intent JSON.
    Always returns a dict describing what happened, never raises.
    """
    asr = load_asr_pipeline()
    asr_result = transcribe_audio(asr, audio_path)

    if not asr_result["ok"]:
        return {
            "status": "asr_failed",
            "error": asr_result["error"],
            "transcript": None,
            "intent": None,
            "note": "Ask patient to re-record. Do not send to LLM.",
        }

    transcript = asr_result["text"]
    intent = extract_intent(transcript)

    status = "ok"
    if asr_result["error"] == "low_confidence_short":
        status = "low_confidence"

    return {
        "status": status,
        "transcript": transcript,
        "intent": intent,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_pipeline.py path/to/audio.wav")
        sys.exit(1)

    from pathlib import Path
    from dotenv import load_dotenv
    # Always look for .env.local next to this script (ai-service/.env.local),
    # regardless of which directory the script was launched from.
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    output = run_pipeline(sys.argv[1])
    print("\n=== PIPELINE RESULT ===")
    print(json.dumps(output, indent=2, ensure_ascii=False))
