import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const audioPath = path.resolve(process.cwd(), "..", "ai-service", "audio", "test2.wav");
    const audio = await readFile(audioPath);

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": 'inline; filename="test2.wav"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Demo audio load failed:", error);
    return NextResponse.json({ success: false, error: "Demo audio file is unavailable." }, { status: 404 });
  }
}