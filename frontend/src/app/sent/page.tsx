"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ActionButton } from "@/components/ActionButton";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { displaySentAt } from "@/lib/format";

export default function SentPage() {
  const router = useRouter();
  const { state, hydrated } = useRequest();
  const text = getCopy(state.language);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.requestId) router.replace("/home");
  }, [hydrated, router, state.requestId]);

  if (!hydrated || !state.requestId) return null;

  return (
    <PatientShell screen="sent">
      <div className="ok">✓</div>
      <h1 className="screen-title center">{text.requestSent}</h1>
      <p className="screen-copy center">{text.providerWillReply}</p>
      <div className="summary">
        <div className="kv" style={{ borderTop: 0, paddingTop: 0 }}>
          <span>{text.status}</span>
          <span className="wait">{text.waiting}</span>
        </div>
        <div className="kv">
          <span>{text.sent}</span>
          <span>{displaySentAt(state.sentAt, state.language)}</span>
        </div>
      </div>
      <div className="actions">
        <ActionButton onClick={() => router.push("/requests")}>{text.viewRequests}</ActionButton>
        <ActionButton variant="ghost" onClick={() => router.push("/home")}>
          {text.newRequest}
        </ActionButton>
      </div>
    </PatientShell>
  );
}
