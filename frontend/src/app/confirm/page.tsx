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
import { confirmDraftRequest, discardDraftRequest } from "@/lib/api";
import { getCopy } from "@/lib/copy";
import { describeUnderstanding } from "@/lib/understand";

export default function ConfirmPage() {
  const router = useRouter();
  const { state, hydrated, beginRequest, markSent } = useRequest();
  const { start } = useRecorder();
  const text = getCopy(state.language);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [readyToLeave, setReadyToLeave] = useState(false);

  const understood = state.transcript && state.intent
    ? describeUnderstanding({
        transcript: state.transcript,
        intent: state.intent.intent,
        urgency: state.intent.urgency,
        confidence: state.confidence ?? 0,
      }, state.entry, state.language)
    : undefined;

  useEffect(() => {
    if (readyToLeave && state.requestId) router.push("/sent");
  }, [readyToLeave, router, state.requestId]);

  async function recordAgain() {
    if (sending) return;
    setSending(true);
    setFailed(false);
    try {
      if (state.requestId && state.draftToken) await discardDraftRequest(state.requestId, state.draftToken);
      beginRequest(state.entry ?? "mic");
      router.push("/record");
      await start();
    } catch {
      setFailed(true);
      setSending(false);
    }
  }

  async function discardAndGoHome() {
    if (sending) return;
    setSending(true);
    setFailed(false);
    try {
      if (state.requestId && state.draftToken) await discardDraftRequest(state.requestId, state.draftToken);
      beginRequest(state.entry ?? "mic");
      router.push("/home");
    } catch {
      setFailed(true);
      setSending(false);
    }
  }
  async function send() {
    if (!state.requestId || !state.draftToken || sending) return;
    setSending(true);
    setFailed(false);
    try {
      const confirmed = await confirmDraftRequest(state.requestId, state.draftToken);
      markSent({ id: confirmed.id, status: confirmed.status ?? "pending" });
      setReadyToLeave(true);
    } catch {
      setSending(false);
      setFailed(true);
    }
  }

  if (!hydrated) return null;

  if (!state.transcript?.trim() || !state.intent || !state.requestId || !state.draftToken) {
    return (
      <RoleGuard role="patient">
        <PatientShell>
          <h1 className="screen-title">We could not hear that clearly</h1>
          <p className="screen-copy">Please record your request again so you can review it before sending.</p>
          <section className="processing-fallback" role="alert">
            <span className="processing-fallback-icon" aria-hidden="true">!</span>
            <p>No request was sent without your confirmation.</p>
          </section>
          {failed ? <p className="alert" role="alert">The draft could not be discarded. Please try again.</p> : null}
          <div className="actions">
            <ActionButton onClick={() => void recordAgain()} disabled={sending}>{text.recordAgain}</ActionButton>
            <ActionButton variant="ghost" onClick={() => void discardAndGoHome()} disabled={sending}>{text.backHome}</ActionButton>
          </div>
        </PatientShell>
      </RoleGuard>
    );
  }

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
        {failed ? <p className="alert" role="alert">The request could not be updated. Please try again.</p> : null}
        <div className="actions">
          <ActionButton onClick={() => void send()} disabled={sending}>
            {sending ? text.sending : text.yesSend}
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => void recordAgain()} disabled={sending}>
            {text.noSpeakAgain}
          </ActionButton>
        </div>
      </PatientShell>
    </RoleGuard>
  );
}
