"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AudioPlayer } from "@/components/AudioPlayer";
import { PatientShell } from "@/components/PatientShell";
import { SafetyNote } from "@/components/SafetyNote";
import { useStoredBlob, urlForBlob } from "@/lib/audioStore";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { displaySentAt } from "@/lib/format";
import { base64ToBlob } from "@/lib/session";
import { presentRequest } from "@/lib/understand";

const audioUrls = new Map<string, string>();

function storedAudioUrl(base64: string, type: string) {
  const cached = audioUrls.get(base64);
  if (cached) return cached;
  const url = URL.createObjectURL(base64ToBlob(base64, type));
  audioUrls.set(base64, url);
  return url;
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, hydrated } = useRequest();
  const text = getCopy(state.language);
  const request = state.requests.find((item) => item.id === params.id);
  const presented = request ? presentRequest(request, state.language) : undefined;
  const backup = useStoredBlob(request?.audioBase64 ? undefined : request?.audioKey);
  let audioUrl = request?.id === state.requestId ? state.audioUrl : undefined;
  if (request?.audioBase64) {
    try {
      audioUrl = storedAudioUrl(request.audioBase64, request.audioType || "audio/webm");
    } catch {
      audioUrl = undefined;
    }
  } else if (backup.blob) {
    audioUrl = urlForBlob(backup.blob);
  }

  return (
    <PatientShell screen="detail">
      {!hydrated ? null : !request ? (
        <>
          <h1 className="screen-title">{text.myRequests}</h1>
          <p className="screen-copy">{text.requestMissing}</p>
        </>
      ) : (
        <>
          <h1 className="screen-title">{presented?.requestLabel}</h1>
          <p className="screen-copy">{presented?.summary}</p>
          <div className="summary" style={{ marginTop: 0 }}>
            <div className="kv" style={{ borderTop: 0, paddingTop: 0 }}>
              <span>{text.status}</span>
              <span className="wait">{text.waiting}</span>
            </div>
            <div className="kv">
              <span>{text.sent}</span>
              <span>{displaySentAt(request.sentAt, state.language)}</span>
            </div>
            {presented?.durationLabel ? (
              <div className="kv">
                <span>{text.howLong}</span>
                <span>{presented.durationLabel}</span>
              </div>
            ) : null}
            {audioUrl ? <AudioPlayer src={audioUrl} fallbackDuration={request.durationSeconds ?? 0} /> : null}
          </div>
          <SafetyNote>{text.safety}</SafetyNote>
        </>
      )}
      <div className="actions">
        <Link href="/requests" className="btn ghost">
          {text.backToRequests}
        </Link>
      </div>
    </PatientShell>
  );
}
