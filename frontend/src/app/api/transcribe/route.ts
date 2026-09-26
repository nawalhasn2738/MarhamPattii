import { NextResponse } from "next/server";

// This route calls the low-resource, fine-tuned Balti Whisper model
// `mohdali1/whisper-small-balti` through Hugging Face hosted inference.
// The model reports roughly 30% WER, so transcripts are assistance only:
// ALWAYS show the transcript to the patient in the "What We Understood" step
// before sending it onward. Do not use this route for diagnosis or intent extraction.

export const runtime = "nodejs";
export const maxDuration = 60;

const HF_MODEL_ID = "mohdali1/whisper-small-balti";
const HF_ASR_URL = `https://api-inference.huggingface.co/models/${HF_MODEL_ID}`;
const MIN_AUDIO_BYTES = 400;
const HF_TIMEOUT_MS = 60_000;

type TranscribeSuccess = {
  transcript: string;
  // TODO: Hugging Face hosted ASR inference usually returns only text. A real
  // confidence score would require calling the model directly and reading
  // token-level log-probabilities; that is a stretch goal, not an MVP need.
  confidence: number | null;
};

type HfAsrResponse = {
  text?: string;
  error?: string;
  estimated_time?: number;
  warnings?: string[];
};

function jsonError(error: string, code: string, status: number, details?: unknown) {
  return NextResponse.json({ success: false, error, code, details }, { status });
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isLikelySilentWav(buffer: Buffer, mimeType: string, filename: string) {
  const looksLikeWav = mimeType.includes("wav") || filename.toLowerCase().endsWith(".wav");
  if (!looksLikeWav || buffer.length < 44) return false;

  // Minimal PCM WAV silence check. Browser WebM/Opus cannot be reliably checked
  // without a decoder/ffmpeg, so for WebM we only validate file size here.
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    return false;
  }

  const dataIndex = buffer.indexOf("data", 12, "ascii");
  if (dataIndex < 0 || dataIndex + 8 >= buffer.length) return false;

  const dataStart = dataIndex + 8;
  const pcm = buffer.subarray(dataStart);
  if (pcm.length < MIN_AUDIO_BYTES) return true;

  let sumSquares = 0;
  let samples = 0;
  for (let index = 0; index + 1 < pcm.length; index += 2) {
    const sample = pcm.readInt16LE(index);
    sumSquares += sample * sample;
    samples += 1;
  }

  if (!samples) return true;
  const rms = Math.sqrt(sumSquares / samples);
  return rms < 50;
}

async function readAudioFromRequest(request: Request): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { audioUrl?: string; url?: string };
    const audioUrl = body.audioUrl ?? body.url;
    if (!audioUrl) {
      throw Object.assign(new Error("Audio URL is required."), { code: "audio_missing", status: 400 });
    }

    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw Object.assign(new Error("Could not download the audio file."), {
        code: "audio_url_fetch_failed",
        status: 400,
        details: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") ?? "audio/wav",
      filename: audioUrl.split("/").pop() ?? "recording.wav",
    };
  }

  const form = await request.formData();
  const audio = form.get("audio");
  const audioUrl = form.get("audioUrl") ?? form.get("url");

  if (audio instanceof File) {
    return {
      buffer: Buffer.from(await audio.arrayBuffer()),
      mimeType: audio.type || "application/octet-stream",
      filename: audio.name || "recording.webm",
    };
  }

  if (typeof audioUrl === "string" && audioUrl.trim()) {
    const response = await fetch(audioUrl.trim());
    if (!response.ok) {
      throw Object.assign(new Error("Could not download the audio file."), {
        code: "audio_url_fetch_failed",
        status: 400,
        details: response.status,
      });
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") ?? "audio/wav",
      filename: audioUrl.split("/").pop() ?? "recording.wav",
    };
  }

  throw Object.assign(new Error("Audio file is required."), { code: "audio_missing", status: 400 });
}

async function callHuggingFaceAsr(buffer: Buffer, mimeType: string): Promise<HfAsrResponse> {
  const token = requiredEnv("HF_API_TOKEN");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

  try {
    // If browser audio is WebM/Opus and hosted inference rejects it, convert to
    // WAV before calling this route. Server-side conversion would require ffmpeg
    // or a separate media service, which is intentionally outside this MVP route.
    const response = await fetch(HF_ASR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType || "application/octet-stream",
        Accept: "application/json",
      },
      body: new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" }),
      signal: controller.signal,
    });

    let payload: HfAsrResponse = {};
    try {
      payload = (await response.json()) as HfAsrResponse;
    } catch {
      payload = { error: await response.text().catch(() => "Invalid Hugging Face response") };
    }

    if (response.ok) return payload;

    if (response.status === 401 || response.status === 403) {
      throw Object.assign(new Error("Hugging Face authentication failed."), {
        code: "hf_auth_failed",
        status: 502,
        details: payload.error,
      });
    }

    if (response.status === 429) {
      throw Object.assign(new Error("Transcription service is rate limited. Please try again shortly."), {
        code: "hf_rate_limited",
        status: 429,
        details: payload.error,
      });
    }

    if (response.status === 503) {
      throw Object.assign(new Error("Transcription model is warming up. Please try again in a moment."), {
        code: "hf_model_loading",
        status: 503,
        details: payload.estimated_time ?? payload.error,
      });
    }

    throw Object.assign(new Error("Transcription service failed."), {
      code: "hf_transcription_failed",
      status: 502,
      details: payload.error ?? response.status,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw Object.assign(new Error("Transcription timed out. Please try again."), {
        code: "hf_timeout",
        status: 504,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const { buffer, mimeType, filename } = await readAudioFromRequest(request);

    if (buffer.length < MIN_AUDIO_BYTES || isLikelySilentWav(buffer, mimeType, filename)) {
      return jsonError("We couldn't hear that clearly. Please record again.", "audio_too_short_or_silent", 400);
    }

    const result = await callHuggingFaceAsr(buffer, mimeType);
    const transcript = result.text?.trim() ?? "";

    if (!transcript) {
      return jsonError("We couldn't hear that clearly. Please record again.", "empty_transcript", 422, result.error);
    }

    const response: TranscribeSuccess = {
      transcript,
      confidence: null,
    };

    return NextResponse.json(response);
  } catch (error) {
    const typed = error as { message?: string; code?: string; status?: number; details?: unknown };
    console.error("HF transcription failed:", error);

    return jsonError(
      typed.message ?? "Could not transcribe audio. Please try again.",
      typed.code ?? "transcription_failed",
      typed.status ?? 500,
      typed.details,
    );
  }
}