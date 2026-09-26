export type TranscribeResponse = {
  transcript: string;
  intent: string;
  urgency: string;
  confidence: number;
};

export type SubmitRequestBody = {
  language: string;
  transcript: string;
  intent: string;
  urgency: string;
  confidence: number;
};

export type SubmitRequestResponse = {
  id: string;
  status: string;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "request_failed";
  } catch {
    return "request_failed";
  }
}

export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse> {
  const body = new FormData();
  const type = audio.type || "audio/webm";
  const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  body.append("audio", audio, `recording.${extension}`);

  const response = await fetch("/api/transcribe", { method: "POST", body, signal });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<TranscribeResponse>;
}

export async function submitRequest(payload: SubmitRequestBody): Promise<SubmitRequestResponse> {
  const response = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<SubmitRequestResponse>;
}
