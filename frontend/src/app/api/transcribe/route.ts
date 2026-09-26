import { NextResponse } from "next/server";
import { SAMPLE_TRANSCRIPT } from "@/lib/understand";

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get("audio");

  if (!audio || typeof audio === "string" || audio.size < 400) {
    return NextResponse.json({ error: "recording_too_short" }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 1600));

  return NextResponse.json({
    transcript: SAMPLE_TRANSCRIPT,
    intent: "doctor_request",
    urgency: "unknown",
    confidence: 87,
  });
}
