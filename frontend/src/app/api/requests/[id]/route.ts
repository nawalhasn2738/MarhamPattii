import { NextResponse } from "next/server";
import { ServerConfigurationError } from "@/lib/server/config";
import { DraftAuthorizationError, requireDraftToken } from "@/lib/server/draftAuth";
import {
  createServiceSupabaseClient,
  ProviderAuthError,
  requireProvider,
  storagePathFromValue,
} from "@/lib/server/providerAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const AUDIO_BUCKET = "audio-recordings";
const SIGNED_URL_SECONDS = 5 * 60;
const PROVIDER_STATUSES = new Set(["accepted", "clarification_requested", "completed"]);
type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase } = await requireProvider(request);
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .neq("status", "pending_confirmation")
      .single();
    if (error || !data) return NextResponse.json({ success: false, error: "Request was not found." }, { status: 404 });

    const storagePath = storagePathFromValue(data.audio_url);
    let audioUrl: string | null = null;
    if (storagePath) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
      if (!signedError) audioUrl = signed.signedUrl;
    }
    return NextResponse.json({ success: true, request: { ...data, audio_url: audioUrl } });
  } catch (error) {
    if (error instanceof DraftAuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json({ success: false, error: "Request service is not configured." }, { status: 503 });
    }
    if (error instanceof ProviderAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Request detail route failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };
    const status = body.status?.trim();
    if (!id) return NextResponse.json({ success: false, error: "Request id is required." }, { status: 400 });

    if (status === "pending") {
      requireDraftToken(request, id);
      // Narrow patient action: publish only this unguessable draft id, and only
      // from pending_confirmation. Provider actions below always require Auth.
      const supabase = createServiceSupabaseClient();
      const { data, error } = await supabase
        .from("requests")
        .update({ status: "pending" })
        .eq("id", id)
        .eq("status", "pending_confirmation")
        .select("*")
        .single();
      if (error) return NextResponse.json({ success: false, error: "Draft could not be confirmed." }, { status: 409 });
      return NextResponse.json({ success: true, request: data });
    }

    if (!status || !PROVIDER_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value." }, { status: 400 });
    }

    const { supabase } = await requireProvider(request);
    const { data, error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", id)
      .neq("status", "pending_confirmation")
      .select("*")
      .single();
    if (error) {
      console.error("Request status update failed:", error.message);
      return NextResponse.json({ success: false, error: "Failed to update request status." }, { status: 500 });
    }
    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    if (error instanceof DraftAuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json({ success: false, error: "Request service is not configured." }, { status: 503 });
    }
    if (error instanceof ProviderAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("Request status route failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ success: false, error: "Request id is required." }, { status: 400 });
    requireDraftToken(request, id);
    const supabase = createServiceSupabaseClient();
    const { data: draft, error: lookupError } = await supabase
      .from("requests")
      .select("id,status,audio_url")
      .eq("id", id)
      .single();
    if (lookupError || !draft) return NextResponse.json({ success: false, error: "Draft was not found." }, { status: 404 });
    if (draft.status !== "pending_confirmation") {
      return NextResponse.json({ success: false, error: "Only unconfirmed drafts can be discarded." }, { status: 409 });
    }

    const { error: deleteError } = await supabase
      .from("requests")
      .delete()
      .eq("id", id)
      .eq("status", "pending_confirmation");
    if (deleteError) return NextResponse.json({ success: false, error: "Draft could not be discarded." }, { status: 500 });

    const storagePath = storagePathFromValue(draft.audio_url);
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]);
      if (storageError) console.error("Discarded draft audio cleanup failed:", storageError.message);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DraftAuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof ServerConfigurationError) {
      console.error(error.message);
      return NextResponse.json({ success: false, error: "Request service is not configured." }, { status: 503 });
    }
    console.error("Draft deletion route failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}
