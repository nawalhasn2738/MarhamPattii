"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { TranscribeResponse } from "@/lib/api";
import { getCopy } from "@/lib/copy";
import type { LanguageCode } from "@/lib/languages";
import {
  blobToBase64,
  getServerVisitSnapshot,
  getVisitSnapshot,
  readVisit,
  subscribeVisit,
  writeVisit,
  type EntryKind,
  type StoredRequest,
  type StoredVisit,
} from "@/lib/session";
import { putAudio, urlForBlob, useStoredBlob } from "@/lib/audioStore";
import { describeUnderstanding } from "@/lib/understand";

export type { EntryKind };

export type IntentResult = {
  intent: string;
  urgency: string;
  requires_human: boolean;
};

export type SavedRequest = StoredRequest;

export type RequestState = {
  language: LanguageCode;
  entry?: EntryKind;
  audioBlob?: Blob;
  audioUrl?: string;
  durationSeconds?: number;
  transcript?: string;
  intent?: IntentResult;
  confidence?: number;
  summaryLead?: string;
  summaryHeadline?: string;
  requestLabel?: string;
  durationLabel?: string;
  requestId?: string;
  status?: string;
  sentAt?: string;
  audioKey?: string;
  requests: SavedRequest[];
};

type RequestContextValue = {
  state: RequestState;
  hydrated: boolean;
  setLanguage: (language: LanguageCode) => void;
  beginRequest: (entry: EntryKind) => void;
  clearDraft: () => void;
  setAudio: (blob: Blob, durationSeconds: number) => void;
  applyUnderstanding: (result: TranscribeResponse) => void;
  markSent: (response: { id: string; status: string }) => void;
};

const RequestContext = createContext<RequestContextValue | null>(null);

const initialState: RequestState = {
  language: "bft",
  requests: [],
};

function clearedDraft(state: RequestState, audioUrl?: string): RequestState {
  return {
    ...state,
    audioBlob: undefined,
    audioUrl,
    durationSeconds: undefined,
    transcript: undefined,
    intent: undefined,
    confidence: undefined,
    summaryLead: undefined,
    summaryHeadline: undefined,
    requestLabel: undefined,
    durationLabel: undefined,
    requestId: undefined,
    status: undefined,
    sentAt: undefined,
    audioKey: undefined,
  };
}

function stateFromVisit(visit: StoredVisit): RequestState {
  let audioBlob: Blob | undefined;
  let audioUrl: string | undefined;
  if (visit.audioBase64) {
    const binary = atob(visit.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    audioBlob = new Blob([bytes], { type: visit.audioType || "audio/webm" });
    audioUrl = URL.createObjectURL(audioBlob);
  }

  return {
    language: visit.language,
    entry: visit.entry,
    audioBlob,
    audioUrl,
    audioKey: visit.audioBase64 ? undefined : visit.audioKey,
    durationSeconds: visit.durationSeconds,
    transcript: visit.transcript,
    intent: visit.intent
      ? {
          intent: visit.intent,
          urgency: visit.urgency ?? "unknown",
          requires_human: visit.requiresHuman ?? true,
        }
      : undefined,
    confidence: visit.confidence,
    summaryLead: visit.summaryLead,
    summaryHeadline: visit.summaryHeadline,
    requestLabel: visit.requestLabel,
    durationLabel: visit.durationLabel,
    requestId: visit.requestId,
    status: visit.status,
    sentAt: visit.sentAt,
    requests: visit.requests ?? [],
  };
}

export function RequestProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RequestState>(initialState);
  const [appliedVisit, setAppliedVisit] = useState<string | null>(null);
  const audioUrlRef = useRef<string | undefined>(undefined);
  const storedVisit = useSyncExternalStore(subscribeVisit, getVisitSnapshot, getServerVisitSnapshot);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const hydrated = isClient && appliedVisit === storedVisit;
  const recoveredAudio = useStoredBlob(state.audioBlob ? undefined : state.audioKey);

  if (!hydrated) {
    setAppliedVisit(storedVisit);
    if (storedVisit) {
      try {
        setState(stateFromVisit(JSON.parse(storedVisit) as StoredVisit));
      } catch {
        // A damaged saved visit should not block the app.
      }
    }
  }

  if (recoveredAudio.blob && !state.audioBlob) {
    const blob = recoveredAudio.blob;
    setState((current) => (current.audioBlob ? current : { ...current, audioBlob: blob, audioUrl: urlForBlob(blob) }));
  } else if (recoveredAudio.status === "missing" && state.audioKey && !state.audioBlob) {
    setState((current) => (current.audioKey ? { ...current, audioKey: undefined } : current));
  }

  const releaseAudio = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = undefined;
  }, []);

  useEffect(() => {
    audioUrlRef.current = state.audioUrl;
  }, [state.audioUrl]);

  const persistId = useRef(0);

  useEffect(() => {
    if (!isClient || !hydrated) return;
    const writeId = ++persistId.current;

    async function persist() {
      let audioBase64: string | undefined;
      let audioType: string | undefined;
      if (state.audioBlob) {
        try {
          await putAudio("draft", state.audioBlob);
          if (state.requestId) await putAudio(`request:${state.requestId}`, state.audioBlob);
        } catch {
          // A sessionStorage copy is still attempted below.
        }
        try {
          audioBase64 = await blobToBase64(state.audioBlob);
          audioType = state.audioBlob.type || "audio/webm";
        } catch {
          audioBase64 = undefined;
        }
      }
      if (writeId !== persistId.current) return;

      const previous = readVisit();
      const requests = state.requests.map((request) => {
        const stored = previous?.requests.find((item) => item.id === request.id);
        const nextAudio = request.audioBase64 ?? (request.id === state.requestId ? audioBase64 : stored?.audioBase64);
        const nextType = request.audioType ?? (request.id === state.requestId ? audioType : stored?.audioType);
        const hasAudio = Boolean(nextAudio || stored?.audioKey || (request.id === state.requestId && state.audioBlob));
        return {
          ...request,
          audioBase64: nextAudio,
          audioType: nextType,
          audioKey: hasAudio ? (request.audioKey ?? `request:${request.id}`) : request.audioKey,
        };
      });

      writeVisit({
        language: state.language,
        entry: state.entry,
        audioBase64,
        audioType,
        audioKey: state.audioBlob ? "draft" : undefined,
        durationSeconds: state.durationSeconds,
        transcript: state.transcript,
        intent: state.intent?.intent,
        urgency: state.intent?.urgency,
        requiresHuman: state.intent?.requires_human,
        confidence: state.confidence,
        summaryLead: state.summaryLead,
        summaryHeadline: state.summaryHeadline,
        requestLabel: state.requestLabel,
        durationLabel: state.durationLabel,
        requestId: state.requestId,
        status: state.status,
        sentAt: state.sentAt,
        requests,
      });
    }

    void persist();
  }, [hydrated, isClient, state]);

  const setLanguage = useCallback((language: LanguageCode) => {
    setState((current) => ({ ...current, language }));
  }, []);

  const clearDraft = useCallback(() => {
    releaseAudio();
    setState((current) => clearedDraft(current));
  }, [releaseAudio]);

  const beginRequest = useCallback(
    (entry: EntryKind) => {
      releaseAudio();
      setState((current) => ({ ...clearedDraft(current), entry }));
    },
    [releaseAudio],
  );

  const setAudio = useCallback(
    (blob: Blob, durationSeconds: number) => {
      releaseAudio();
      const audioUrl = URL.createObjectURL(blob);
      audioUrlRef.current = audioUrl;
      setState((current) => ({
        ...clearedDraft(current, audioUrl),
        audioBlob: blob,
        durationSeconds,
      }));
    },
    [releaseAudio],
  );

  const applyUnderstanding = useCallback((result: TranscribeResponse) => {
    setState((current) => {
      const copy = describeUnderstanding(result, current.entry, current.language);
      return {
        ...current,
        transcript: result.transcript,
        confidence: result.confidence,
        intent: {
          intent: result.intent,
          urgency: result.urgency,
          requires_human: copy.requiresHuman,
        },
        summaryLead: copy.summaryLead,
        summaryHeadline: copy.summaryHeadline,
        requestLabel: copy.requestLabel,
        durationLabel: copy.durationLabel,
      };
    });
  }, []);

  const markSent = useCallback((response: { id: string; status: string }) => {
    const sentAt = new Date().toISOString();
    setState((current) => {
      const text = getCopy(current.language);
      const understood = current.transcript
        ? describeUnderstanding(
            {
              transcript: current.transcript,
              intent: current.intent?.intent ?? "doctor_request",
              urgency: current.intent?.urgency ?? "unknown",
              confidence: current.confidence ?? 0,
            },
            current.entry,
            current.language,
          )
        : undefined;
      const item: SavedRequest = {
        id: response.id,
        language: current.language,
        entry: current.entry,
        summary: understood?.summaryHeadline ?? current.summaryHeadline ?? current.transcript ?? text.healthcareRequest,
        requestLabel: understood?.requestLabel ?? current.requestLabel ?? text.healthcareRequest,
        status: "waiting_for_provider",
        sentAt,
        confidence: current.confidence,
        transcript: current.transcript,
        durationLabel: understood?.durationLabel ?? current.durationLabel,
        durationSeconds: current.durationSeconds,
        audioKey: current.audioBlob ? `request:${response.id}` : undefined,
      };
      return {
        ...current,
        requestId: response.id,
        status: item.status,
        sentAt,
        requests: [item, ...current.requests.filter((request) => request.id !== item.id)],
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      hydrated,
      setLanguage,
      beginRequest,
      clearDraft,
      setAudio,
      applyUnderstanding,
      markSent,
    }),
    [state, hydrated, setLanguage, beginRequest, clearDraft, setAudio, applyUnderstanding, markSent],
  );

  return <RequestContext.Provider value={value}>{children}</RequestContext.Provider>;
}

export function useRequest() {
  const value = useContext(RequestContext);
  if (!value) {
    throw new Error("useRequest must be used within RequestProvider");
  }
  return value;
}
