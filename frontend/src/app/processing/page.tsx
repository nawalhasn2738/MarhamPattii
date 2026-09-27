"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ActionButton } from "@/components/ActionButton";
import { PatientShell } from "@/components/PatientShell";
import { ProcessingSteps, type ProcessingStep } from "@/components/ProcessingSteps";
import { RoleGuard } from "@/components/RoleGuard";
import { useRecorder } from "@/context/RecorderContext";
import { useRequest } from "@/context/RequestContext";
import { ApiClientError, createDemoRequest, discardDraftRequest, submitRecordedRequest } from "@/lib/api";
import type { IntentResponse } from "@/lib/aiTypes";
import { getCopy } from "@/lib/copy";
import { languageName } from "@/lib/languages";
import { currentProviderSession } from "@/lib/supabaseBrowser";

const LOW_CONFIDENCE_THRESHOLD = 0.55;

type ProcessingPhase = "processing" | "success" | "error";

type ProcessingFailure = {
  title: string;
  message: string;
  canRetry: boolean;
  offerDemo: boolean;
  failedStep: "audio" | "transcription" | "intent";
};

function failureFor(error: unknown): ProcessingFailure {
  const code = error instanceof ApiClientError ? error.code : "request_failed";

  if (["audio_empty", "audio_too_small", "audio_type_invalid", "empty_transcript", "low_confidence"].includes(code)) {
    return {
      title: "Recording was too short or silent",
      message: "Recording was too short or silent. Please try again and speak for at least a few seconds.",
      canRetry: false,
      offerDemo: true,
      failedStep: "audio",
    };
  }

  if (["hf_rate_limited", "hf_model_loading"].includes(code)) {
    return {
      title: "Transcription service is busy",
      message: "The transcription service is temporarily busy. Try again, or use Demo Audio for a reliable fallback.",
      canRetry: true,
      offerDemo: true,
      failedStep: "transcription",
    };
  }

  if (["hf_timeout", "request_timeout", "hf_auth_failed", "hf_transcription_failed", "invalid_asr_response"].includes(code)) {
    return {
      title: "Transcription failed",
      message: "Transcription failed. Please try again or use the Demo Audio fallback.",
      canRetry: true,
      offerDemo: true,
      failedStep: "transcription",
    };
  }

  if (["groq_timeout", "intent_service_failed", "empty_intent_response", "invalid_intent_response"].includes(code)) {
    return {
      title: "We could not prepare the request",
      message: "The recording was received, but the request summary could not be prepared. Try again or use Demo Audio.",
      canRetry: true,
      offerDemo: true,
      failedStep: "intent",
    };
  }

  return {
    title: "We could not reach the transcription service",
    message: "We could not reach the transcription service. Please check your connection and try again.",
    canRetry: true,
    offerDemo: true,
    failedStep: "transcription",
  };
}
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
    || error instanceof Error && error.name === "AbortError";
}

export default function ProcessingPage() {
  const router = useRouter();
  const { state, hydrated, applyUnderstanding, markDraft, beginRequest, setRole } = useRequest();
  const { start } = useRecorder();
  const text = getCopy(state.language);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<ProcessingPhase>("processing");
  const [failure, setFailure] = useState<ProcessingFailure | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const steps = useMemo<ProcessingStep[]>(() => {
    if (phase === "success") {
      return [text.stepSaved, text.stepListening, text.stepPreparing].map((label) => ({ label, status: "success" }));
    }
    if (phase === "error") {
      const intentFailed = failure?.failedStep === "intent";
      return [
        { label: text.stepSaved, status: "success" },
        { label: text.stepListening, status: intentFailed ? "success" : "error" },
        { label: text.stepPreparing, status: intentFailed ? "error" : "pending" },
      ];
    }
    return [
      { label: text.stepSaved, status: "success" },
      { label: text.stepListening, status: "active" },
      { label: text.stepPreparing, status: "pending" },
    ];
  }, [failure?.failedStep, phase, text.stepListening, text.stepPreparing, text.stepSaved]);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.audioBlob) {
      router.replace("/record");
      return;
    }

    const blob = state.audioBlob;
    const controller = new AbortController();
    let cancelled = false;

    async function run() {
      let draftId: string | undefined;
      let draftToken: string | undefined;
      setPhase("processing");
      setFailure(null);

      try {
        const result = await submitRecordedRequest(blob, languageName(state.language), controller.signal);
        if (cancelled) return;
        draftId = result.request.id;
        draftToken = result.draft_token;

        const transcript = (result.ai.transcript ?? result.request.transcript ?? "").trim();
        const confidence = result.ai.confidence;
        if (!transcript) {
          throw new ApiClientError(
            "We couldn't hear that clearly. Please tap to re-record.",
            "empty_transcript",
            422,
          );
        }
        if (typeof confidence === "number" && confidence < LOW_CONFIDENCE_THRESHOLD) {
          throw new ApiClientError(
            "We couldn't hear that clearly enough. Please tap to re-record.",
            "low_confidence",
            422,
          );
        }

        const aiIntent = result.ai.intent;
        const rawUrgency = aiIntent?.urgency ?? result.request.urgency;
        const urgency: IntentResponse["urgency"] =
          rawUrgency === "routine" || rawUrgency === "urgent" ? rawUrgency : "unknown";
        applyUnderstanding({
          transcript,
          confidence: confidence ?? null,
          intent: aiIntent?.intent ?? result.request.intent ?? "unclear",
          duration: aiIntent?.duration ?? null,
          urgency,
          requires_human: aiIntent?.requires_human ?? true,
          summary_for_provider: aiIntent?.summary_for_provider ?? transcript,
          summary_english: aiIntent?.summary_english,
          summary_urdu: aiIntent?.summary_urdu,
        });
        markDraft({
          id: result.request.id,
          status: result.request.status || "pending_confirmation",
          draftToken: result.draft_token,
        });
        setPhase("success");
        router.replace("/confirm");
      } catch (error) {
        if (cancelled || isAbortError(error)) return;
        if (draftId && draftToken) await discardDraftRequest(draftId, draftToken).catch(() => undefined);
        setFailure(failureFor(error));
        setPhase("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applyUnderstanding, attempt, hydrated, markDraft, router, state.audioBlob, state.language]);

  async function runDemoFallback() {
    if (loadingDemo) return;
    setLoadingDemo(true);
    try {
      await createDemoRequest();
      const providerSession = await currentProviderSession();
      if (providerSession) {
        flushSync(() => setRole("provider"));
        router.replace("/requests");
        return;
      }
      router.replace("/?next=/requests&demo=created");
    } catch (error) {
      setFailure({
        title: "Demo fallback could not be created",
        message: error instanceof Error ? error.message : "Please try the demo fallback again.",
        canRetry: true,
        offerDemo: true,
        failedStep: "transcription",
      });
    } finally {
      setLoadingDemo(false);
    }
  }
  async function recordAgain() {
    beginRequest(state.entry ?? "mic");
    router.push("/record");
    await start();
  }

  return (
    <RoleGuard role="patient">
      <PatientShell>
        <h1 className="screen-title lift">
          {phase === "error" ? failure?.title : text.understanding}
        </h1>
        <p className="screen-copy">
          {phase === "error" ? failure?.message : text.usuallySeconds}
        </p>

        <ProcessingSteps steps={steps} />

        {phase === "error" ? (
          <section className="processing-fallback" role="alert">
            <span className="processing-fallback-icon" aria-hidden="true">!</span>
            <p>{failure?.message}</p>
          </section>
        ) : null}

        <div className="actions">
          {phase === "error" ? (
            <>
              <ActionButton onClick={() => void recordAgain()}>{text.recordAgain}</ActionButton>
              {failure?.canRetry ? (
                <ActionButton
                  variant="ghost"
                  onClick={() => {
                    setAttempt((value) => value + 1);
                  }}
                >
                  {text.tryAgain}
                </ActionButton>
              ) : null}
              {failure?.offerDemo ? (
                <ActionButton
                  variant="ghost"
                  onClick={() => void runDemoFallback()}
                  disabled={loadingDemo}
                >
                  {loadingDemo ? "Creating demo request..." : "Use Demo Audio"}
                </ActionButton>
              ) : null}
            </>
          ) : (
            <ActionButton variant="ghost" onClick={() => router.push("/home")}>
              {text.cancel}
            </ActionButton>
          )}
        </div>
      </PatientShell>
    </RoleGuard>
  );
}
