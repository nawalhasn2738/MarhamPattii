"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MicButton } from "@/components/MicButton";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";
import { useRecorder } from "@/context/RecorderContext";
import { getCopy } from "@/lib/copy";
import type { EntryKind } from "@/lib/session";

function QuickAction({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="quick" disabled={disabled}>
      <i aria-hidden />
      {label}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { state, beginRequest, setAudio } = useRequest();
  const { start } = useRecorder();
  const text = getCopy(state.language);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  function openRecorder(entry: EntryKind) {
    beginRequest(entry);
    void start();
    router.push("/record");
  }

  async function useDemoAudio() {
    if (loadingDemo) return;
    setLoadingDemo(true);
    setDemoError(null);
    try {
      beginRequest("doctor");
      const response = await fetch("/api/demo-audio", { cache: "no-store" });
      if (!response.ok) throw new Error("Demo audio could not be loaded.");
      const blob = await response.blob();
      setAudio(new Blob([blob], { type: blob.type || "audio/wav" }), 0);
      router.push("/processing");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Demo audio failed.");
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <PatientShell>
      <h1 className="screen-title">{text.howHelp}</h1>
      <p className="screen-copy">{text.tapMic}</p>
      <MicButton label={text.tapToSpeak} onClick={() => openRecorder("mic")} />
      <p className="speak-label">{text.speakInBalti}</p>
      {demoError ? (
        <p className="alert" role="alert">
          {demoError}
        </p>
      ) : null}
      <div className="actions">
        <QuickAction label={text.requestDoctor} onClick={() => openRecorder("doctor")} />
        <QuickAction label={text.findFacility} onClick={() => openRecorder("facility")} />
        <QuickAction label={loadingDemo ? "Loading demo audio..." : "Use Demo Audio"} onClick={() => void useDemoAudio()} disabled={loadingDemo} />
        <QuickAction label={text.myRequests} onClick={() => router.push("/requests")} />
      </div>
    </PatientShell>
  );
}