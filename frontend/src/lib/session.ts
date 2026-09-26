const STORAGE_KEY = "marhampattii-patient-visit";

export type EntryKind = "doctor" | "facility" | "mic";

export type StoredRequest = {
  id: string;
  language: "ur" | "en" | "bft";
  entry?: EntryKind;
  summary: string;
  requestLabel: string;
  status: string;
  sentAt: string;
  audioKey?: string;
  confidence?: number;
  transcript?: string;
  providerSummary?: string;
  durationLabel?: string;
  durationSeconds?: number;
  audioBase64?: string;
  audioType?: string;
};

export type StoredVisit = {
  language: "ur" | "en" | "bft";
  entry?: EntryKind;
  audioBase64?: string;
  audioType?: string;
  durationSeconds?: number;
  transcript?: string;
  intent?: string;
  urgency?: string;
  requiresHuman?: boolean;
  confidence?: number;
  summaryLead?: string;
  summaryHeadline?: string;
  providerSummary?: string;
  requestLabel?: string;
  durationLabel?: string;
  requestId?: string;
  status?: string;
  sentAt?: string;
  audioKey?: string;
  requests: StoredRequest[];
};

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

let cachedSnapshot: string | null = null;

export function subscribeVisit() {
  return () => {};
}

export function getVisitSnapshot() {
  if (cachedSnapshot === null) {
    cachedSnapshot = sessionStorage.getItem(STORAGE_KEY) ?? "";
  }
  return cachedSnapshot;
}

export function getServerVisitSnapshot() {
  return "";
}

export function readVisit(): StoredVisit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredVisit;
  } catch {
    return null;
  }
}

export function writeVisit(visit: StoredVisit) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  } catch {
    const withoutAudio: StoredVisit = {
      ...visit,
      audioBase64: undefined,
      requests: visit.requests.map((request) => ({ ...request, audioBase64: undefined })),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(withoutAudio));
    } catch {
      // The visit still works until the page reloads.
    }
  }
}
