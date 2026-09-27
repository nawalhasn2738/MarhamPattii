/** Shared browser/server validation for recorded audio.
 * Codec parameters are normalized for validation, but the original Blob is
 * preserved so WebM/Opus and Safari MP4 recordings can be uploaded unchanged.
 */
export const MIN_AUDIO_BYTES = 400;
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/wav", "audio/x-wav", "audio/wave", "audio/webm", "audio/ogg",
  "audio/mp4", "audio/mpeg", "audio/mp3", "audio/x-m4a",
]);

export type AudioValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; code: "audio_empty" | "audio_too_small" | "audio_too_large" | "audio_type_invalid"; message: string };

export function normalizeAudioMimeType(value: string): string {
  return value.toLowerCase().split(";", 1)[0].trim();
}

export function validateAudioBlob(audio: Blob): AudioValidationResult {
  if (audio.size === 0) {
    return { ok: false, code: "audio_empty", message: "Recording failed or audio is empty. Please try again." };
  }
  if (audio.size < MIN_AUDIO_BYTES) {
    return { ok: false, code: "audio_too_small", message: "Recording is too short. Please try again." };
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return { ok: false, code: "audio_too_large", message: "Recording is too large. Please keep it under one minute." };
  }
  const mimeType = normalizeAudioMimeType(audio.type);
  if (!mimeType || !SUPPORTED_AUDIO_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      code: "audio_type_invalid",
      message: "This browser produced an unsupported audio format. Please try Chrome, Edge, Firefox, or Safari.",
    };
  }
  return { ok: true, mimeType };
}