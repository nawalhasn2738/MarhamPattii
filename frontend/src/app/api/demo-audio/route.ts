import { NextResponse } from "next/server";

// Backward-compatible endpoint. The deployable asset lives under public/ and
// is served by Next.js/Vercel without filesystem access or a serverless worker.
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/audio/test2.wav", request.url), 307);
}