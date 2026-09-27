import { NextResponse } from "next/server";
import { validateAudioBlob } from "@/lib/audio";
import { ServerConfigurationError } from "@/lib/server/config";
import { createServiceSupabaseClient } from "@/lib/server/providerAuth";

export const runtime = "nodejs";
export const maxDuration = 15;

const AUDIO_BUCKET = "audio-recordings";
const DEMO_TRANSCRIPT =
  "Demo request: the Balti-speaking patient would like to consult a doctor.";
const DEMO_INTENT = "doctor_request";
const DEMO_URGENCY = "routine";

function demoEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_MODE === "true";
}

export async function POST(request: Request) {
  if (!demoEnabled()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled.", code: "demo_disabled" },
      { status: 404 },
    );
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, error: "Demo audio could not be read.", code: "invalid_form_data" },
        { status: 400 },
      );
    }

    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Demo audio is missing.", code: "audio_missing" },
        { status: 400 },
      );
    }

    const validation = validateAudioBlob(audio);
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.message, code: validation.code },
        { status: validation.code === "audio_too_large" ? 413 : 400 },
      );
    }

    const supabase = createServiceSupabaseClient();
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const storagePath = `demo/${Date.now()}-${crypto.randomUUID()}.wav`;

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(storagePath, audioBuffer, {
        contentType: validation.mimeType,
        upsert: false,
      });
    if (uploadError) {
      console.error("Demo audio upload failed:", uploadError.message);
      return NextResponse.json(
        { success: false, error: "Demo request could not be created.", code: "demo_upload_failed" },
        { status: 500 },
      );
    }

    const { data, error: insertError } = await supabase
      .from("requests")
      .insert({
        language: "Balti (Demo)",
        audio_url: storagePath,
        transcript: DEMO_TRANSCRIPT,
        intent: DEMO_INTENT,
        urgency: DEMO_URGENCY,
        status: "pending",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Demo request insert failed:", insertError.message);
      await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { success: false, error: "Demo request could not be saved.", code: "demo_insert_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      request: data,
      demo: {
        transcript: DEMO_TRANSCRIPT,
        intent: DEMO_INTENT,
        urgency: DEMO_URGENCY,
        bypassed: ["microphone", "hugging_face_asr", "groq_intent_extraction"],
      },
    });
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json(
        { success: false, error: "Demo service is not configured.", code: "service_not_configured" },
        { status: 503 },
      );
    }
    console.error("Demo request failed:", error);
    return NextResponse.json(
      { success: false, error: "Demo request could not be created.", code: "demo_failed" },
      { status: 500 },
    );
  }
}
