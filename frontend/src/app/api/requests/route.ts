import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import type { IntentResponse } from "@/lib/aiTypes";
import { validateAudioBlob } from "@/lib/audio";
import {
  TranscriptionError,
  transcriptionErrorPayload,
  transcribeAudioBuffer,
} from "@/lib/server/transcribe";
import {
  GROQ_TIMEOUT_MS,
  REQUEST_DEADLINE_MS,
  ServerConfigurationError,
  requireServerEnvList,
  requiredServerEnv,
  requiredServerSecret,
} from "@/lib/server/config";
import { createServiceSupabaseClient } from "@/lib/server/providerAuth";
import { createDraftToken } from "@/lib/server/draftAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const AUDIO_BUCKET = "audio-recordings";
const GROQ_MODEL_ID = process.env.GROQ_MODEL_ID ?? "openai/gpt-oss-20b";
const REQUEST_REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
  "HF_API_TOKEN",
  "DRAFT_CONFIRMATION_SECRET",
] as const;

class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}


function getSafeExtension(filename: string, mimeType: string): string {
  const match = filename.toLowerCase().match(/\.(wav|webm|ogg|mp3|mp4|m4a)$/);
  if (match) return `.${match[1]}`;
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  return ".wav";
}

function parseJsonObject(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

function validateIntent(value: unknown): IntentResponse {
  if (!value || typeof value !== "object") {
    throw new ApiError("Intent extraction returned an invalid response.", "invalid_intent_response", 502);
  }
  const result = value as Partial<IntentResponse>;
  if (typeof result.intent !== "string" || typeof result.summary_for_provider !== "string") {
    throw new ApiError("Intent extraction returned an invalid response.", "invalid_intent_response", 502);
  }
  const urgency = ["unknown", "routine", "urgent"].includes(result.urgency ?? "")
    ? result.urgency as IntentResponse["urgency"]
    : "unknown";
  return {
    intent: result.intent,
    duration: typeof result.duration === "string" ? result.duration : null,
    urgency,
    requires_human: result.requires_human !== false,
    summary_for_provider: result.summary_for_provider,
    summary_english: typeof result.summary_english === "string" ? result.summary_english : undefined,
    summary_urdu: typeof result.summary_urdu === "string" ? result.summary_urdu : undefined,
  };
}

async function extractIntent(transcript: string, signal: AbortSignal): Promise<IntentResponse> {
  const groq = new Groq({ apiKey: requiredServerEnv("GROQ_API_KEY"), timeout: GROQ_TIMEOUT_MS, maxRetries: 0 });
  let completion;
  try {
    completion = await groq.chat.completions.create({
    model: GROQ_MODEL_ID,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You convert patient speech transcripts into structured healthcare requests. You are not a doctor. Never diagnose, recommend treatment, or add facts. Return only JSON with this shape: {"intent":"doctor_request|specialist_request|facility_info|unclear","duration":"string or null","urgency":"unknown|routine|urgent","requires_human":true,"summary_for_provider":"one neutral English sentence","summary_english":"short English summary","summary_urdu":"short Urdu summary"}.`,
      },
      { role: "user", content: `Patient transcript: ${JSON.stringify(transcript)}` },
    ],
    }, { signal });
  } catch (error) {
    if (signal.aborted) {
      throw new ApiError("Request processing took too long. Please try again.", "request_timeout", 504);
    }
    const errorName = error instanceof Error ? error.name : "";
    if (errorName.includes("Timeout")) {
      throw new ApiError("Intent extraction timed out. Please try again.", "groq_timeout", 504);
    }
    throw new ApiError("Intent extraction is temporarily unavailable. Please try again.", "intent_service_failed", 502);
  }

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new ApiError("Intent extraction returned no response.", "empty_intent_response", 502);
  }
  try {
    return validateIntent(parseJsonObject(responseContent));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Intent extraction returned an invalid response.", "invalid_intent_response", 502);
  }
}

export async function POST(request: Request) {
  const deadlineController = new AbortController();
  const deadline = setTimeout(() => deadlineController.abort(), REQUEST_DEADLINE_MS);

  try {
    // Fail before parsing/uploading audio so configuration errors identify
    // the exact missing key without consuming HF or Groq time.
    requireServerEnvList(REQUEST_REQUIRED_ENV);
    requiredServerSecret("DRAFT_CONFIRMATION_SECRET");

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "A multipart form containing an audio file is required.", code: "invalid_form_data" },
        { status: 400 },
      );
    }

    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, error: "Audio file is required.", code: "audio_missing" }, { status: 400 });
    }
    const audioValidation = validateAudioBlob(audio);
    if (!audioValidation.ok) {
      return NextResponse.json(
        { success: false, error: audioValidation.message, code: audioValidation.code },
        { status: 400 },
      );
    }
    const languageValue = formData.get("language");
    const language = typeof languageValue === "string" && languageValue.trim()
      ? languageValue.trim().slice(0, 80)
      : "Balti";
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    if (audioBuffer.length === 0) {
      return NextResponse.json({ success: false, error: "The audio file is empty.", code: "audio_empty" }, { status: 400 });
    }

    const { transcript, confidence } = await transcribeAudioBuffer(audioBuffer, {
      signal: deadlineController.signal,
      mimeType: audioValidation.mimeType,
    });
    const intent = await extractIntent(transcript, deadlineController.signal);
    if (deadlineController.signal.aborted) {
      throw new ApiError("Request processing took too long. Please try again.", "request_timeout", 504);
    }
    const supabase = createServiceSupabaseClient();
    const extension = getSafeExtension(audio.name, audio.type);
    const storagePath = `${Date.now()}-${crypto.randomUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(storagePath, audioBuffer, {
      contentType: audioValidation.mimeType,
      upsert: false,
    });
    if (uploadError) {
      console.error("Supabase audio upload failed:", uploadError.message);
      throw new ApiError("Failed to save the audio recording.", "storage_upload_failed", 500);
    }

    // Store the private object path, not a permanent public URL. Provider APIs
    // replace this value with a short-lived signed URL after authorization.
    const { data: insertedRequest, error: insertError } = await supabase
      .from("requests")
      .insert({
        language,
        audio_url: storagePath,
        transcript,
        intent: intent.intent,
        urgency: intent.urgency,
        status: "pending_confirmation",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase request insert failed:", insertError.message);
      await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]);
      throw new ApiError("Failed to save the request.", "database_insert_failed", 500);
    }

    return NextResponse.json({
      success: true,
      request: insertedRequest,
      draft_token: createDraftToken(insertedRequest.id),
      ai: { status: "ok", transcript, confidence, intent, llm_model: GROQ_MODEL_ID },
    });
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json(
        {
          success: false,
          error: process.env.NODE_ENV === "production"
            ? "The request service is not configured."
            : `The request service is missing ${error.variable}. Add it to frontend/.env.local and restart Next.js.`,
          code: "service_not_configured",
          ...(process.env.NODE_ENV !== "production" ? { missing: error.variable } : {}),
        },
        { status: 503 },
      );
    }
    if (error instanceof TranscriptionError) {
      return NextResponse.json(
        transcriptionErrorPayload(error),
        { status: error.status },
      );
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Request processing failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error.", code: "internal_error" },
      { status: 500 },
    );
  } finally {
    clearTimeout(deadline);
  }
}
