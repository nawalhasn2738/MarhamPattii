"use client";

import { useRouter } from "next/navigation";
import { MicButton } from "@/components/MicButton";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";
import { useRecorder } from "@/context/RecorderContext";
import { getCopy } from "@/lib/copy";
import type { EntryKind } from "@/lib/session";

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="quick">
      <i aria-hidden />
      {label}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { state, beginRequest } = useRequest();
  const { start } = useRecorder();
  const text = getCopy(state.language);

  function openRecorder(entry: EntryKind) {
    beginRequest(entry);
    void start();
    router.push("/record");
  }

  return (
    <PatientShell screen="home">
      <div className="hero">
        <h1 className="screen-title">{text.howHelp}</h1>
        <p className="screen-copy">{text.tapMic}</p>
        <MicButton label={text.tapToSpeak} onClick={() => openRecorder("mic")} />
        <p className="speak-label">{text.speakInBalti}</p>
      </div>
      <div className="actions">
        <QuickAction label={text.requestDoctor} onClick={() => openRecorder("doctor")} />
        <QuickAction label={text.findFacility} onClick={() => openRecorder("facility")} />
        <QuickAction label={text.myRequests} onClick={() => router.push("/requests")} />
      </div>
    </PatientShell>
  );
}
