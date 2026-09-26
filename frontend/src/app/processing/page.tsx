"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { PatientShell } from "@/components/PatientShell";
import { ProcessingSteps } from "@/components/ProcessingSteps";
import { useRequest } from "@/context/RequestContext";
import { submitRecordedRequest } from "@/lib/api";
import { getCopy } from "@/lib/copy";
import { languageName } from "@/lib/languages";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ProcessingPage() {
  const router = useRouter();
  const { state, hydrated, applyUnderstanding, markSent } = useRequest();
  const text = getCopy(state.language);
  const steps = [text.stepSaved, text.stepListening, text.stepPreparing];
  const [attempt, setAttempt] = useState(0);
  const [activeIndex, setActiveIndex] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [readyToConfirm, setReadyToConfirm] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.audioBlob) {
      if (state.audioKey) return;
      router.replace("/record");
      return;
    }

    const blob = state.audioBlob;
    const controller = new AbortController();
    let cancelled = false;

    async function run() {
      try {
        setActiveIndex(1);
        const result = await submitRecordedRequest(blob, languageName(state.language), controller.signal);
        if (cancelled) return;

        setActiveIndex(2);
        await delay(450);
        if (cancelled) return;

        const aiIntent = result.ai.intent;
        applyUnderstanding({
          transcript: result.ai.transcript || result.request.transcript || "",
          intent: aiIntent?.intent || result.request.intent || "unclear",
          urgency: aiIntent?.urgency || result.request.urgency || "unknown",
          confidence: 1,
          summary_for_provider: aiIntent?.summary_for_provider,
          summary_english: aiIntent?.summary_english,
          summary_urdu: aiIntent?.summary_urdu,
        });
        markSent({
          id: result.request.id,
          status: result.request.status || "pending",
        });

        setActiveIndex(3);
        await delay(350);
        if (cancelled) return;
        setReadyToConfirm(true);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "request_failed");
      }
    }

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applyUnderstanding, attempt, hydrated, markSent, router, state.audioBlob, state.audioKey, state.language]);

  useEffect(() => {
    if (readyToConfirm && state.transcript) {
      router.push("/confirm");
    }
  }, [readyToConfirm, router, state.transcript]);

  const tooShort = error === "recording_too_short";

  return (
    <PatientShell>
      {error ? (
        <>
          <h1 className="screen-title">{tooShort ? text.couldNotHear : text.couldNotUnderstand}</h1>
          <p className="screen-copy">{tooShort ? text.pleaseSpeakAgain : text.tryOrRecord}</p>
          <div className="actions">
            {tooShort ? null : (
              <ActionButton
                onClick={() => {
                  setError(null);
                  setActiveIndex(1);
                  setReadyToConfirm(false);
                  setAttempt((value) => value + 1);
                }}
              >
                {text.tryAgain}
              </ActionButton>
            )}
            <ActionButton variant="ghost" onClick={() => router.push("/record")}>
              {text.speakAgain}
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <h1 className="screen-title lift">{text.understanding}</h1>
          <p className="screen-copy">{text.usuallySeconds}</p>
          <ProcessingSteps labels={steps} activeIndex={activeIndex} />
          <div className="actions">
            <ActionButton variant="ghost" onClick={() => router.push("/home")}>
              {text.cancel}
            </ActionButton>
          </div>
        </>
      )}
    </PatientShell>
  );
}