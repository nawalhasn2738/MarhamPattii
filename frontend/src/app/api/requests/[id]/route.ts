import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_STATUSES = new Set([
  "accepted",
  "clarification_requested",
  "completed",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { success: false, error: "A valid request ID is required." },
        { status: 400 },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "The request body must be valid JSON." },
        { status: 400 },
      );
    }

    const status =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).status
        : undefined;

    if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Status must be accepted, clarification_requested, or completed.",
        },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();
    const { data: updatedRequest, error } = await supabase
      .from("requests")
      .update({ status })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update request: ${error.message}`);
    }

    if (!updatedRequest) {
      return NextResponse.json(
        { success: false, error: "Request not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error("Provider request status update failed", error);

    return NextResponse.json(
      { success: false, error: "Unable to update the request status." },
      { status: 500 },
    );
  }
}
