import { providerAuthorizationHeaders } from "@/lib/supabaseBrowser";
import type { AsrResponse, IntentResponse, UnderstandingResponse } from "@/lib/aiTypes";

export type { AsrResponse, IntentResponse, UnderstandingResponse } from "@/lib/aiTypes";

export type SubmitRequestBody = UnderstandingResponse & {
  language: string;
};

export type SubmitRequestResponse = {
  id: string;
  status: string;
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
  draft_token: string;
  ai: {
    status?: string;
    transcript?: string;
    confidence?: number | null;
    intent?: Partial<IntentResponse> | null;
    llm_model?: string;
    note?: string;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function apiError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    return new ApiClientError(
      body.error ?? "We couldn't process your request. Please try again.",
      body.code ?? "request_failed",
      response.status,
    );
  } catch {
    return new ApiClientError("We couldn't process your request. Please try again.", "request_failed", response.status);
  }
}

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
    throw await apiError(response);
  }

  const payload = (await response.json()) as SubmitRecordedRequestResponse | { success?: false; error?: string };
  if (!payload.success) {
    throw new Error("error" in payload && payload.error ? payload.error : "request_failed");
  }

  return payload;
}

export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<AsrResponse> {
  const body = new FormData();
  body.append("audio", audio, audioFileName(audio));

  const response = await fetch("/api/transcribe", { method: "POST", body, signal });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<AsrResponse>;
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
  const headers = await providerAuthorizationHeaders();
  const response = await fetch("/api/requests/dashboard", { method: "GET", headers, signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as DashboardResponse | { success?: false; error?: string };
  if (!payload.success) {
    throw new Error("error" in payload && payload.error ? payload.error : "request_failed");
  }

  return payload.requests;
}

export async function confirmDraftRequest(id: string, draftToken: string): Promise<ProviderRequest> {
  const response = await fetch(`/api/requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Draft-Token": draftToken },
    body: JSON.stringify({ status: "pending" }),
  });
  if (!response.ok) throw await apiError(response);
  const payload = (await response.json()) as { success: true; request: ProviderRequest };
  return payload.request;
}
export async function discardDraftRequest(id: string, draftToken: string): Promise<void> {
  const response = await fetch("/api/requests/" + id, {
    method: "DELETE",
    headers: { "X-Draft-Token": draftToken },
  });
  if (!response.ok) throw await apiError(response);
}
export async function updateRequestStatus(id: string, status: string): Promise<ProviderRequest> {
  const authorization = await providerAuthorizationHeaders();
  const response = await fetch(`/api/requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authorization },
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
