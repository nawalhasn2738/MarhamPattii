"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { PatientShell } from "@/components/PatientShell";
import { RoleGuard } from "@/components/RoleGuard";
import { SafetyNote } from "@/components/SafetyNote";
import { useRecorder } from "@/context/RecorderContext";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { describeUnderstanding } from "@/lib/understand";

export default function ConfirmPage() {
  const router = useRouter();
  const { state, hydrated, beginRequest } = useRequest();
  const { start } = useRecorder();
  const text = getCopy(state.language);
  const understood =
    state.transcript && state.intent
      ? describeUnderstanding(
          {
            transcript: state.transcript,
            intent: state.intent.intent,
            urgency: state.intent.urgency,
            confidence: state.confidence ?? 0,
          },
          state.entry,
          state.language,
        )
      : undefined;
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [readyToLeave, setReadyToLeave] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.transcript || !state.intent || !state.requestId) {
      router.replace("/home");
    }
  }, [hydrated, router, state.intent, state.requestId, state.transcript]);

  useEffect(() => {
    if (readyToLeave && state.requestId) {
      router.push("/sent");
    }
  }, [readyToLeave, router, state.requestId]);

  async function send() {
    if (!state.requestId || sending) return;
    setSending(true);
    setFailed(false);
    try {
      setReadyToLeave(true);
    } catch {
      setSending(false);
      setFailed(true);
    }
  }

  if (!hydrated || !state.transcript || !state.intent || !state.requestId) return null;

  return (
    <RoleGuard role="patient">
      <PatientShell>
      <h1 className="screen-title">{text.didWeUnderstand}</h1>
      <ConfirmationCard
        lead={understood?.summaryLead ?? text.understoodLead}
        headline={state.summaryHeadline ?? understood?.summaryHeadline ?? state.transcript}
        language={text.spokenLanguage}
        request={understood?.requestLabel ?? text.healthcareRequest}
        duration={state.durationLabel ?? understood?.durationLabel ?? text.notSpecified}
        providerSummary={state.providerSummary}
        languageCaption={text.language}
        requestCaption={text.request}
        durationCaption={text.howLong}
        audioUrl={state.audioUrl}
        durationSeconds={state.durationSeconds}
      />
      <SafetyNote>{text.safety}</SafetyNote>
      {failed ? (
        <p className="alert" role="alert">
          {text.couldNotSend}
        </p>
      ) : null}
      <div className="actions">
        <ActionButton variant="ghost" onClick={() => router.push("/record")} disabled={sending}>
          Back to recording
        </ActionButton>
        <ActionButton onClick={() => void send()} disabled={sending}>
          {sending ? text.sending : text.yesSend}
        </ActionButton>
        <ActionButton
          variant="ghost"
          onClick={() => {
            beginRequest(state.entry ?? "mic");
            void start();
            router.push("/record");
          }}
          disabled={sending}
        >
          {text.noSpeakAgain}
        </ActionButton>
      </div>
      </PatientShell>
    </RoleGuard>
  );
}