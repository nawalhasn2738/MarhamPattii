"""
JSON-only wrapper for the Balti ASR pipeline.

Usage:
    python run_pipeline_json.py path/to/audio.wav

This script intentionally prints only one JSON object to stdout so Node.js can
parse it safely. Pipeline logs are captured and returned under "logs".
"""

import contextlib
import io
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from test_pipeline import LLM_MODEL_ID, run_pipeline


def main() -> int:
    if len(sys.argv) < 2:
        print(
            json.dumps(
                {
                    "status": "error",
                    "error": "missing_audio_path",
                    "transcript": None,
                    "intent": None,
                },
                ensure_ascii=True,
            )
        )
        return 1

    audio_path = sys.argv[1]
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    captured_stdout = io.StringIO()
    captured_stderr = io.StringIO()

    try:
        with contextlib.redirect_stdout(captured_stdout):
            with contextlib.redirect_stderr(captured_stderr):
                output = run_pipeline(audio_path)

        if not isinstance(output, dict):
            output = {
                "status": "error",
                "error": "pipeline_returned_non_object",
                "transcript": None,
                "intent": None,
            }

        output["llm_model"] = LLM_MODEL_ID

        logs = "\n".join(
            part.strip()
            for part in [captured_stdout.getvalue(), captured_stderr.getvalue()]
            if part.strip()
        )

        if logs:
            output["logs"] = logs

        print(json.dumps(output, ensure_ascii=True))
        return 0
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "error",
                    "error": str(error),
                    "transcript": None,
                    "intent": None,
                    "llm_model": LLM_MODEL_ID,
                },
                ensure_ascii=True,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())