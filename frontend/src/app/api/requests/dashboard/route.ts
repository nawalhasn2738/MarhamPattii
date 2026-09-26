import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data: requests, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch requests: ${error.message}`);
    }

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("Provider dashboard request fetch failed", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch requests." },
      { status: 500 },
    );
  }
}
