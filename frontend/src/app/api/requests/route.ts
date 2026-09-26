import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AUDIO_BUCKET = "audio-recordings";
const DEFAULT_LANGUAGE = "Balti";

type ParsedIntent = {
  intent: string;
  urgency: "unknown" | "low" | "high";
  summary_english: string;
  summary_urdu: string;
  requires_human: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function extensionFor(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension && /^[a-z0-9]{1,10}$/.test(extension)) {
    return extension;
  }

  const mimeExtensions: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };

  return mimeExtensions[file.type] ?? "bin";
}

function parseIntent(content: string): ParsedIntent {
  const parsed: unknown = JSON.parse(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Groq returned an invalid JSON object");
  }

  const value = parsed as Record<string, unknown>;
  const validUrgencies = new Set(["unknown", "low", "high"]);

  if (
    typeof value.intent !== "string" ||
    typeof value.urgency !== "string" ||
    !validUrgencies.has(value.urgency) ||
    typeof value.summary_english !== "string" ||
    typeof value.summary_urdu !== "string" ||
    typeof value.requires_human !== "boolean"
  ) {
    throw new Error("Groq response did not match the required intent schema");
  }

  return value as ParsedIntent;
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const formData = await request.formData();
    const audioEntry = formData.get("audio");
    const languageEntry = formData.get("language");
    const transcriptEntry = formData.get("transcript");

    if (!(audioEntry instanceof File) || audioEntry.size === 0) {
      return NextResponse.json(
        { success: false, error: "An audio file is required." },
        { status: 400 },
      );
    }

    if (audioEntry.type && !audioEntry.type.startsWith("audio/")) {
      return NextResponse.json(
        { success: false, error: "The uploaded file must be an audio file." },
        { status: 400 },
      );
    }

    const language =
      typeof languageEntry === "string" && languageEntry.trim()
        ? languageEntry.trim()
        : DEFAULT_LANGUAGE;

    const submittedTranscript =
      typeof transcriptEntry === "string" ? transcriptEntry.trim() : "";
    const transcript =
      submittedTranscript ||
      `[Audio received in ${language}; transcription has not yet been provided.]`;

    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const groqApiKey = requiredEnv("GROQ_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const groq = new Groq({ apiKey: groqApiKey });

    uploadedPath = `${Date.now()}-${crypto.randomUUID()}.${extensionFor(audioEntry)}`;
    const audioBuffer = await audioEntry.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(uploadedPath, audioBuffer, {
        contentType: audioEntry.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Audio upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(uploadedPath);
    const audioUrl = publicUrlData.publicUrl;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You extract communication intent from patient-provided text.
Return exactly one JSON object with these keys:
- "intent": a short snake_case label such as "doctor_request"
- "urgency": exactly "unknown", "low", or "high"
- "summary_english": a short English translation or summary
- "summary_urdu": a short Urdu translation or summary
- "requires_human": a boolean

Do not diagnose or provide treatment. Use "unknown" when urgency cannot be
reliably inferred. Set requires_human to true for possible emergencies,
ambiguous requests, missing transcripts, or cases needing staff review.`,
        },
        {
          role: "user",
          content: `Language: ${language}\nTranscript: ${transcript}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error("Groq returned an empty response");
    }

    const aiIntent = parseIntent(content);

    const { data: insertedRequest, error: insertError } = await supabase
      .from("requests")
      .insert({
        language,
        audio_url: audioUrl,
        transcript,
        intent: aiIntent.intent,
        urgency: aiIntent.urgency,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    return NextResponse.json(
      { success: true, request: insertedRequest, ai_intent: aiIntent },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to process patient voice request", error);

    // Best-effort cleanup prevents orphaned recordings if AI/database work fails.
    if (uploadedPath) {
      try {
        const supabase = createClient(
          requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
            requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { error: cleanupError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error("Failed to clean up uploaded audio", cleanupError);
        }
      } catch (cleanupError) {
        console.error("Failed to initialize audio cleanup", cleanupError);
      }
    }

    return NextResponse.json(
      { success: false, error: "Unable to process the voice request." },
      { status: 500 },
    );
  }
}
