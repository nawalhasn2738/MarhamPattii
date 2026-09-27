import { NextResponse } from "next/server";
import { ProviderAuthError, requireProvider, storagePathFromValue } from "@/lib/server/providerAuth";
import { ServerConfigurationError } from "@/lib/server/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const AUDIO_BUCKET = "audio-recordings";
const SIGNED_URL_SECONDS = 5 * 60;

export async function GET(request: Request) {
  try {
    const { supabase } = await requireProvider(request);
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .neq("status", "pending_confirmation")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Dashboard requests fetch failed:", error.message);
      return NextResponse.json({ success: false, error: "Failed to fetch requests." }, { status: 500 });
    }

    const requests = await Promise.all((data ?? []).map(async (item) => {
      const storagePath = storagePathFromValue(item.audio_url);
      if (!storagePath) return { ...item, audio_url: null };
      const { data: signed, error: signedError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
      if (signedError) {
        console.error("Audio signed URL creation failed:", signedError.message);
        return { ...item, audio_url: null };
      }
      return { ...item, audio_url: signed.signedUrl };
    }));

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json({ success: false, error: "Provider service is not configured." }, { status: 503 });
    }
    if (error instanceof ProviderAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Dashboard route failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
