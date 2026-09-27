import "server-only";

import type { AsrResponse } from "@/lib/aiTypes";
import { HF_TIMEOUT_MS, requiredServerEnv } from "@/lib/server/config";

const HF_MODEL_ID = "mohdali1/whisper-small-balti";
const HF_ROUTER_ASR_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL_ID}`;
const LOCAL_DEMO_TRANSCRIPT =
  "I need to schedule a consultation with a heart specialist for my father next week.";

type HfAsrResponse = {
  text?: string;
  error?: string;
  estimated_time?: number;
};

type TranscriptionOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  mimeType?: string;
};

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly upstreamStatus?: number,
    readonly upstreamBody?: string,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export function transcriptionErrorPayload(error: TranscriptionError) {
  return {
    success: false as const,
    error: error.message,
    code: error.code,
    ...(process.env.NODE_ENV !== "production" && error.upstreamStatus
      ? {
          upstream: {
            status: error.upstreamStatus,
            body: error.upstreamBody ?? "",
          },
        }
      : {}),
  };
}
function canUseDemoFallback(error: unknown): boolean {
  const enabled =
    process.env.NODE_ENV !== "production"
    || process.env.ENABLE_ASR_DEMO_FALLBACK === "true";
  if (!enabled) return false;

  if (error instanceof TypeError) return true;
  return error instanceof TranscriptionError
    && (error.code === "hf_model_not_deployed"
      || error.upstreamStatus === 400
      || error.upstreamStatus === 503);
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
  const endpoint = process.env.HF_ASR_ENDPOINT_URL?.trim() || HF_ROUTER_ASR_URL;
  const mimeType = options.mimeType?.trim() || "application/octet-stream";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredServerEnv("HF_API_TOKEN")}`,
        "Content-Type": mimeType,
        Accept: "application/json",
      },
      // HF ASR accepts encoded audio bytes directly; base64 JSON is not audio input.
      body: new Uint8Array(audioBuffer),
      signal,
    });

    const rawBody = await response.text();
    let payload: HfAsrResponse;
    try {
      payload = rawBody ? JSON.parse(rawBody) as HfAsrResponse : {};
    } catch {
      if (!response.ok) {
        payload = { error: rawBody };
      } else {
        throw new TranscriptionError(
          "The transcription service returned an invalid response.",
          "invalid_asr_response",
          502,
        );
      }
    }

    if (!response.ok) {
      // Keep the complete upstream failure in server logs. Development API
      // responses also expose these fields so the browser Network tab shows
      // the deterministic Hugging Face failure without leaking it in production.
      console.error("Hugging Face inference failed:", {
        status: response.status,
        body: rawBody,
      });
      const code =
        response.status === 401 || response.status === 403
          ? "hf_auth_failed"
          : response.status === 400 && /model.*(?:not supported|unsupported)/i.test(rawBody)
            ? "hf_model_not_deployed"
          : response.status === 429
            ? "hf_rate_limited"
            : response.status === 503
              ? "hf_model_loading"
              : "hf_transcription_failed";
      const message = code === "hf_model_not_deployed"
        ? "The Balti transcription model is not deployed on Hugging Face Inference. Configure HF_ASR_ENDPOINT_URL with a dedicated endpoint."
        : payload.error?.trim()
        || (response.status === 429
          ? "The transcription service is busy. Please try again shortly."
          : response.status === 503
            ? "The transcription model is warming up. Please try again shortly."
            : "We couldn't process that audio. Please try again.");
      throw new TranscriptionError(message, code, response.status, response.status, rawBody);
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
    if (canUseDemoFallback(error)) {
      console.warn("Using local ASR demo fallback because Hugging Face is unavailable.");
      return { transcript: LOCAL_DEMO_TRANSCRIPT, confidence: null };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
