export type TranscribeResponse = {
  transcript: string;
  intent: string;
  urgency: string;
  confidence: number;
  summary_for_provider?: string;
  summary_english?: string;
  summary_urdu?: string;
};

export type SubmitRequestBody = {
  language: string;
  transcript: string;
  intent: string;
  urgency: string;
  confidence: number;
  summary_for_provider?: string;
  summary_english?: string;
  summary_urdu?: string;
};

export type SubmitRequestResponse = {
  id: string;
  status: string;
};

type BackendIntent = {
  intent?: string;
  urgency?: string;
  summary_english?: string;
  summary_urdu?: string;
  summary_for_provider?: string;
  requires_human?: boolean;
};

type BackendRequestRecord = {
  id: string;
  status?: string;
  language?: string;
  audio_url?: string;
  transcript?: string;
  intent?: string;
  urgency?: string;
  created_at?: string;
};

export type SubmitRecordedRequestResponse = {
  success: true;
  request: BackendRequestRecord;
  ai: {
    status?: string;
    transcript?: string;
    intent?: BackendIntent | null;
    llm_model?: string;
    note?: string;
  };
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    return body.error ?? body.code ?? "request_failed";
  } catch {
    return "request_failed";
  }
}

function audioFileName(audio: Blob) {
  const type = audio.type || "audio/webm";
  if (type.includes("wav")) return "recording.wav";
  if (type.includes("mp4")) return "recording.m4a";
  if (type.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}

export async function submitRecordedRequest(
  audio: Blob,
  language = "Balti",
  signal?: AbortSignal,
): Promise<SubmitRecordedRequestResponse> {
  const body = new FormData();
  body.append("audio", audio, audioFileName(audio));
  body.append("language", language);

  const response = await fetch("/api/requests", { method: "POST", body, signal });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as SubmitRecordedRequestResponse | { success?: false; error?: string };
  if (!payload.success) {
    throw new Error("error" in payload && payload.error ? payload.error : "request_failed");
  }

  return payload;
}

export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse> {
  const body = new FormData();
  body.append("audio", audio, audioFileName(audio));

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
export type ProviderRequest = {
  id: string;
  language: string | null;
  audio_url: string | null;
  transcript: string | null;
  intent: string | null;
  urgency: string | null;
  status: string | null;
  created_at: string | null;
};

export type DashboardResponse = {
  success: true;
  requests: ProviderRequest[];
};

export async function fetchDashboardRequests(signal?: AbortSignal): Promise<ProviderRequest[]> {
  const response = await fetch("/api/requests/dashboard", { method: "GET", signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as DashboardResponse | { success?: false; error?: string };
  if (!payload.success) {
    throw new Error("error" in payload && payload.error ? payload.error : "request_failed");
  }

  return payload.requests;
}

export async function updateRequestStatus(id: string, status: string): Promise<ProviderRequest> {
  const response = await fetch(`/api/requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as { success: true; request: ProviderRequest } | { success?: false; error?: string };
  if (!payload.success) {
    throw new Error("error" in payload && payload.error ? payload.error : "request_failed");
  }

  return payload.request;
}