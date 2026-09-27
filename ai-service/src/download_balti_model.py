"""
Download the Balti Whisper model into ai-service/models/whisper-small-balti.

This bypasses the default Hugging Face cache, which may live on a full C: drive
on Windows machines. Run from ai-service:

    python src/download_balti_model.py
"""

from pathlib import Path

import requests
from huggingface_hub import hf_hub_url


REPO_ID = "mohdali1/whisper-small-balti"
FILES = [
    "config.json",
    "generation_config.json",
    "model.safetensors",
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
]
CHUNK_SIZE = 1024 * 1024


def download_file(filename: str, target_dir: Path) -> None:
    target_path = target_dir / filename
    part_path = target_path.with_suffix(target_path.suffix + ".part")

    if target_path.exists() and target_path.stat().st_size > 0:
        print(f"[skip] {filename} already exists")
        return

    url = hf_hub_url(REPO_ID, filename)
    print(f"[download] {filename}")

    with requests.get(url, stream=True, timeout=(30, 120)) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length") or 0)
        downloaded = 0

        with part_path.open("wb") as output:
            for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                if not chunk:
                    continue

                output.write(chunk)
                downloaded += len(chunk)

                if total >= 50 * CHUNK_SIZE and downloaded % (25 * CHUNK_SIZE) < CHUNK_SIZE:
                    percent = downloaded / total * 100
                    print(f"  {downloaded / CHUNK_SIZE:.0f} MB / {total / CHUNK_SIZE:.0f} MB ({percent:.1f}%)")

    part_path.replace(target_path)
    print(f"[done] {filename} -> {target_path}")


def main() -> None:
    service_root = Path(__file__).resolve().parent.parent
    target_dir = service_root / "models" / "whisper-small-balti"
    target_dir.mkdir(parents=True, exist_ok=True)

    for filename in FILES:
        download_file(filename, target_dir)

    print(f"[ready] Local model directory: {target_dir}")


if __name__ == "__main__":
    main()
