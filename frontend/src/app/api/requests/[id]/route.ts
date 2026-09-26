import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 900;

const ALLOWED_STATUSES = new Set(["pending", "accepted", "clarification_requested", "completed"]);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createServerSupabaseClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await context.params;
    const id = params.id;
    const body = (await request.json()) as { status?: string };
    const status = body.status?.trim();

    if (!id) {
      return NextResponse.json({ success: false, error: "Request id is required." }, { status: 400 });
    }

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid status value." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("requests").update({ status }).eq("id", id).select("*").single();

    if (error) {
      console.error("Request status update failed:", error);
      return NextResponse.json({ success: false, error: "Failed to update request status." }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    console.error("Request status route failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}