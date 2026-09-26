"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { displaySentAt } from "@/lib/format";
import { presentRequest } from "@/lib/understand";

export default function RequestsPage() {
  const router = useRouter();
  const { state, hydrated } = useRequest();
  const text = getCopy(state.language);

  return (
    <PatientShell screen="requests">
      <h1 className="screen-title">{text.myRequests}</h1>
      {!hydrated ? null : state.requests.length === 0 ? (
        <p className="screen-copy">{text.noRequests}</p>
      ) : (
        <div className="request-list">
          {state.requests.map((request) => {
            const presented = presentRequest(request, state.language);
            return (
              <Link key={request.id} href={`/requests/${request.id}`} className="summary" style={{ marginTop: 0 }}>
                <h2 className="big" style={{ marginBottom: 4 }}>
                  {presented.requestLabel}
                </h2>
                <p className="lead">{presented.summary}</p>
                <div className="kv">
                  <span className="wait">{text.waiting}</span>
                  <span>{displaySentAt(request.sentAt, state.language)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <div className="actions">
        <ActionButton onClick={() => router.push("/home")}>{text.newRequest}</ActionButton>
      </div>
    </PatientShell>
  );
}
