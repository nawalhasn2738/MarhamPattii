"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { MicButton } from "@/components/MicButton";
import { PatientShell } from "@/components/PatientShell";
import { RoleGuard } from "@/components/RoleGuard";
import { useRequest } from "@/context/RequestContext";
import { useRecorder } from "@/context/RecorderContext";
import { getCopy } from "@/lib/copy";
import { createDemoRequest } from "@/lib/api";
import type { EntryKind } from "@/lib/session";
import { currentProviderSession } from "@/lib/supabaseBrowser";

function QuickAction({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="quick" disabled={disabled} aria-label={label} title={label}>
      <i aria-hidden />
      {label}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { state, beginRequest, setRole } = useRequest();
  const { start } = useRecorder();
  const text = getCopy(state.language);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  function openRecorder(entry: EntryKind) {
    beginRequest(entry);
    void start();
    router.push("/record");
  }

  async function submitDemoRequest() {
    if (loadingDemo) return;
    setLoadingDemo(true);
    setDemoError(null);

    try {
      await createDemoRequest();
      const providerSession = await currentProviderSession();
      if (providerSession) {
        flushSync(() => setRole("provider"));
        router.replace("/requests");
        return;
      }

      // The demo request is ready, but dashboard authorization is never bypassed.
      router.replace("/?next=/requests&demo=created");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Demo request failed.");
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <RoleGuard role="patient">
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
        <section className="demo-fallback-card" aria-labelledby="demo-fallback-title">
          <div className="demo-fallback-copy">
            <span className="demo-fallback-kicker">Presentation safety net</span>
            <h2 id="demo-fallback-title">Skip recording and use verified audio</h2>
            <p>Creates a ready-to-review sample request without microphone, ASR, or Groq.</p>
          </div>
          <button
            type="button"
            className="demo-fallback-button"
            onClick={() => void submitDemoRequest()}
            disabled={loadingDemo}
          >
            <span className="demo-fallback-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M8 5.75v12.5L18 12 8 5.75Z" fill="currentColor" />
              </svg>
            </span>
            <span>{loadingDemo ? "Creating demo request..." : "Use Demo Audio"}</span>
          </button>
        </section>
        <div className="actions">
          <QuickAction label={text.requestDoctor} onClick={() => openRecorder("doctor")} />
          <QuickAction label={text.findFacility} onClick={() => openRecorder("facility")} />

          <QuickAction label={text.myRequests} onClick={() => router.push("/requests")} />
        </div>
      </PatientShell>
    </RoleGuard>
  );
}
