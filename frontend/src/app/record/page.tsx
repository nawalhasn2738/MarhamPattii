"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ActionButton } from "@/components/ActionButton";
import { PatientShell } from "@/components/PatientShell";
import { RecordingTimer } from "@/components/RecordingTimer";
import { Waveform } from "@/components/Waveform";
import { useRecorder } from "@/context/RecorderContext";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import type { RecorderPhase } from "@/hooks/useAudioRecorder";

export default function RecordPage() {
  const router = useRouter();
  const { state } = useRequest();
  const text = getCopy(state.language);
  const { phase, seconds, take, start, stop } = useRecorder();
  const seenTake = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "idle") return;
    const timer = window.setTimeout(() => {
      router.replace("/home");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [phase, router]);

  useEffect(() => {
    if (seenTake.current === null) {
      seenTake.current = take;
      return;
    }
    if (take !== seenTake.current && state.audioBlob) {
      seenTake.current = take;
      router.push("/processing");
    }
  }, [router, state.audioBlob, take]);

  const errors: Partial<Record<RecorderPhase, { title: string; body: string; action: string }>> = {
    denied: { title: text.micNeeded, body: text.tapAllow, action: text.useMic },
    unavailable: { title: text.noMic, body: text.connectMic, action: text.tryAgain },
    unsupported: { title: text.recordingUnavailable, body: text.openBrowser, action: text.tryAgain },
    "too-short": { title: text.tooShort, body: text.speakLonger, action: text.recordAgain },
    silent: { title: text.silentTitle, body: text.silentBody, action: text.recordAgain },
    error: { title: text.micFailed, body: text.tryAgain, action: text.tryAgain },
  };
  const error = errors[phase];

  return (
    <PatientShell>
      {phase === "recording" || phase === "starting" ? (
        <>
          <div className="rec-label">
            <i aria-hidden />
            {text.recording}
          </div>
          <RecordingTimer seconds={seconds} />
          <Waveform />
          <p className="screen-copy center">
            {text.speakNaturally}
            <br />
            {text.takeYourTime}
          </p>
          <div className="stop-wrap">
            <button type="button" onClick={stop} aria-label={text.tapToStop} className="stop">
              <i />
            </button>
            <p className="stop-caption">{text.tapToStop}</p>
          </div>
        </>
      ) : null}

      {error ? (
        <>
          <h1 className="screen-title">{error.title}</h1>
          <p className="screen-copy">{error.body}</p>
          <div className="actions">
            <ActionButton onClick={() => void start()}>{error.action}</ActionButton>
            <ActionButton variant="ghost" onClick={() => router.push("/home")}>
              {text.backHome}
            </ActionButton>
          </div>
        </>
      ) : null}
    </PatientShell>
  );
}
