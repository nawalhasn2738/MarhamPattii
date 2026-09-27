import "server-only";

import type { AsrResponse } from "@/lib/aiTypes";
import { HF_TIMEOUT_MS, requiredServerEnv } from "@/lib/server/config";

const HF_MODEL_ID = "mohdali1/whisper-small-balti";
const HF_ASR_URL = `https://api-inference.huggingface.co/models/${HF_MODEL_ID}`;

type HfAsrResponse = {
  text?: string;
  error?: string;
  estimated_time?: number;
};

type TranscriptionOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class TranscriptionError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  options: TranscriptionOptions = {},
): Promise<AsrResponse> {
  if (audioBuffer.length === 0) {
    throw new TranscriptionError("Recording failed or audio is empty. Please try again.", "audio_empty", 400);
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), options.timeoutMs ?? HF_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    const response = await fetch(HF_ASR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredServerEnv("HF_API_TOKEN")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        inputs: audioBuffer.toString("base64"),
        parameters: {
          generate_kwargs: { language: "urdu", task: "transcribe" },
        },
      }),
      signal,
    });

    const rawBody = await response.text();
    let payload: HfAsrResponse;
    try {
      payload = rawBody ? JSON.parse(rawBody) as HfAsrResponse : {};
    } catch {
      throw new TranscriptionError(
        "The transcription service returned an invalid response.",
        "invalid_asr_response",
        502,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new TranscriptionError("The transcription service could not authenticate.", "hf_auth_failed", 502);
    }
    if (response.status === 429) {
      throw new TranscriptionError(
        "The transcription service is busy. Please try again shortly.",
        "hf_rate_limited",
        429,
      );
    }
    if (response.status === 503) {
      throw new TranscriptionError(
        "The transcription model is warming up. Please try again shortly.",
        "hf_model_loading",
        503,
      );
    }
    if (!response.ok) {
      throw new TranscriptionError(
        "We couldn't process that audio. Please try again.",
        "hf_transcription_failed",
        502,
      );
    }

    const transcript = payload.text?.trim() ?? "";
    if (!transcript) {
      throw new TranscriptionError(
        "We couldn't hear that clearly. Please record again.",
        "empty_transcript",
        422,
      );
    }

    // TODO: A real confidence score requires local inference with access to
    // token-level log-probabilities; hosted HF inference does not provide it.
    return { transcript, confidence: null };
  } catch (error) {
    if (options.signal?.aborted) {
      throw new TranscriptionError(
        "Audio processing took too long. Please try again.",
        "request_timeout",
        504,
      );
    }
    if (timeoutController.signal.aborted) {
      throw new TranscriptionError(
        "Transcription timed out. Please try again.",
        "hf_timeout",
        504,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
