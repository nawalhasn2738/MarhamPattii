import { NextResponse } from "next/server";
import {
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
  validateAudioBlob,
} from "@/lib/audio";
import {
  TranscriptionError,
  transcriptionErrorPayload,
  transcribeAudioBuffer,
} from "@/lib/server/transcribe";

// `mohdali1/whisper-small-balti` has roughly 25-30% WER on read speech and
// may perform worse on spontaneous patient audio. Always show its transcript
// on the "What We Understood" screen before a request becomes provider-visible.

export const runtime = "nodejs";
export const maxDuration = 60;

// Allows for multipart boundaries and the language field while enforcing the
// audio limit itself again after parsing. URL-based ingestion is deliberately
// unsupported to eliminate server-side request forgery.
const MAX_MULTIPART_OVERHEAD_BYTES = 512 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

function isLikelySilentWav(buffer: Buffer, mimeType: string, filename: string): boolean {
  const looksLikeWav = mimeType.includes("wav") || filename.toLowerCase().endsWith(".wav");
  if (!looksLikeWav || buffer.length < 44) return false;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return false;

  const dataIndex = buffer.indexOf("data", 12, "ascii");
  if (dataIndex < 0 || dataIndex + 8 >= buffer.length) return false;
  const pcm = buffer.subarray(dataIndex + 8);
  if (pcm.length < MIN_AUDIO_BYTES) return true;

  let sumSquares = 0;
  let samples = 0;
  for (let index = 0; index + 1 < pcm.length; index += 2) {
    const sample = pcm.readInt16LE(index);
    sumSquares += sample * sample;
    samples += 1;
  }
  return samples === 0 || Math.sqrt(sumSquares / samples) < 50;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return jsonError(
        "Upload the recording directly as multipart form-data.",
        "multipart_audio_required",
        415,
      );
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonError(
        "Recording is too large. Please keep it under one minute.",
        "audio_too_large",
        413,
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError("The audio upload could not be read.", "invalid_form_data", 400);
    }

    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return jsonError("Audio file is required.", "audio_missing", 400);
    }

    const validation = validateAudioBlob(audio);
    if (!validation.ok) {
      return jsonError(
        validation.message,
        validation.code,
        validation.code === "audio_too_large" ? 413 : 400,
      );
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    if (buffer.length > MAX_AUDIO_BYTES) {
      return jsonError(
        "Recording is too large. Please keep it under one minute.",
        "audio_too_large",
        413,
      );
    }
    if (isLikelySilentWav(buffer, validation.mimeType, audio.name)) {
      return jsonError(
        "We couldn't hear that clearly. Please record again.",
        "audio_too_short_or_silent",
        400,
      );
    }

    return NextResponse.json(
      await transcribeAudioBuffer(buffer, { mimeType: validation.mimeType }),
    );
  } catch (error) {
    if (error instanceof TranscriptionError) {
      return NextResponse.json(transcriptionErrorPayload(error), { status: error.status });
    }
    console.error("HF transcription failed:", error);
    return jsonError("Could not transcribe audio. Please try again.", "transcription_failed", 500);
  }
}
