import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 900;

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

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });

    if (error) {
      console.error("Dashboard requests fetch failed:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch requests." }, { status: 500 });
    }

    return NextResponse.json({ success: true, requests: data ?? [] });
  } catch (error) {
    console.error("Dashboard route failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error." }, { status: 500 });
  }
}