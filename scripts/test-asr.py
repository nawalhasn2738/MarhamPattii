"""Sanity-check the Balti ASR model against held-out BaltiVoice samples.

Run from the repository root:
    python scripts/test-asr.py
    python scripts/test-asr.py --samples 5
"""

from __future__ import annotations

import argparse
import io
import sys
from itertools import islice

import numpy as np
import soundfile as sf
from datasets import Audio, load_dataset
from jiwer import wer
from transformers import pipeline

MODEL_ID = "mohdali1/whisper-small-balti"
DATASET_ID = "mohdali1/baltivoice-asr"
SPLIT = "validation"
TARGET_SAMPLE_RATE = 16_000

# Windows PowerShell may default to CP1252, which cannot print Balti/Nastaliq.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


def load_audio(audio: dict) -> tuple[np.ndarray, int]:
    """Decode a datasets Audio(decode=False) item without torchcodec."""
    source = io.BytesIO(audio["bytes"]) if audio.get("bytes") else audio["path"]
    samples, sample_rate = sf.read(source, dtype="float32", always_2d=False)

    if samples.ndim > 1:
        samples = samples.mean(axis=1)

    if sample_rate != TARGET_SAMPLE_RATE:
        old_positions = np.arange(len(samples), dtype=np.float64)
        new_length = round(len(samples) * TARGET_SAMPLE_RATE / sample_rate)
        new_positions = np.linspace(0, max(len(samples) - 1, 0), new_length)
        samples = np.interp(new_positions, old_positions, samples).astype(np.float32)
        sample_rate = TARGET_SAMPLE_RATE

    return samples, sample_rate


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=3, choices=range(3, 6))
    args = parser.parse_args()

    print(f"Loading {MODEL_ID} ...")
    transcriber = pipeline(
        task="automatic-speech-recognition",
        model=MODEL_ID,
        generate_kwargs={"language": "urdu", "task": "transcribe"},
    )

    dataset = load_dataset(DATASET_ID, split=SPLIT, streaming=True)
    dataset = dataset.cast_column("audio", Audio(decode=False))

    references: list[str] = []
    predictions: list[str] = []

    for index, sample in enumerate(islice(dataset, args.samples), start=1):
        samples, sample_rate = load_audio(sample["audio"])
        result = transcriber({"array": samples, "sampling_rate": sample_rate})
        reference = str(sample.get("sentence") or sample.get("transcript") or "").strip()
        prediction = str(result.get("text") or "").strip()

        references.append(reference)
        predictions.append(prediction)
        print(f"\nSample {index}")
        print(f"Ground truth: {reference}")
        print(f"Prediction:   {prediction}")
        print(f"WER:          {wer(reference, prediction):.4f}")

    print(f"\nCorpus WER ({len(references)} samples): {wer(references, predictions):.4f}")


if __name__ == "__main__":
    main()
