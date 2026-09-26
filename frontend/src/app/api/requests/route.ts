import { NextResponse } from "next/server";

type RequestBody = {
  transcript?: string;
  intent?: string;
  urgency?: string;
  confidence?: number;
  language?: string;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.transcript || !body.intent) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  const id = String(1000 + Math.floor(Math.random() * 9000));
  return NextResponse.json({ id, status: "waiting_for_provider" });
}
