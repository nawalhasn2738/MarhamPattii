"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { AudioPlayer } from "@/components/AudioPlayer";
import { PatientShell } from "@/components/PatientShell";
import { SafetyNote } from "@/components/SafetyNote";
import { fetchDashboardRequests, updateRequestStatus, type ProviderRequest } from "@/lib/api";
import { displaySentAt } from "@/lib/format";

function statusLabel(status: string | null) {
  if (status === "accepted") return "Accepted";
  if (status === "clarification_requested") return "Clarification requested";
  if (status === "completed") return "Completed";
  return "Pending";
}

function urgencyClass(urgency: string | null) {
  if (urgency === "high") return "badge danger";
  if (urgency === "low") return "badge ok-badge";
  return "badge";
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const [request, setRequest] = useState<ProviderRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const allRequests = await fetchDashboardRequests(controller.signal);
        setRequest(allRequests.find((item) => item.id === params.id) ?? null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Failed to load request.");
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [params.id]);

  const summary = useMemo(() => request?.transcript?.trim() || "No transcript saved for this request.", [request]);

  async function setStatus(status: "accepted" | "clarification_requested" | "completed") {
    if (!request) return;
    try {
      setUpdating(true);
      setError(null);
      setRequest(await updateRequestStatus(request.id, status));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update request.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <PatientShell>
      <h1 className="screen-title">Request Details</h1>

      {loading ? <p className="screen-copy">Loading request...</p> : null}
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !request ? (
        <p className="screen-copy">This request could not be found.</p>
      ) : null}

      {request ? (
        <>
          <p className="screen-copy">Review the AI interpretation and listen to the original Balti voice recording.</p>
          <div className="summary" style={{ marginTop: 0 }}>
            <div className="dash-card-head">
              <span className="badge">{request.language || "Balti"}</span>
              <span className={urgencyClass(request.urgency)}>{request.urgency || "unknown"}</span>
              <span className="badge status-badge">{statusLabel(request.status)}</span>
            </div>

            <p className="lead">Intent</p>
            <p className="big">{request.intent || "Unclear request"}</p>

            <div className="kv">
              <span>Provider summary</span>
              <span>{summary}</span>
            </div>
            <div className="kv">
              <span>Transcript</span>
              <span>{request.transcript || "Not available"}</span>
            </div>
            <div className="kv">
              <span>AI confidence</span>
              <span>Not stored</span>
            </div>
            <div className="kv">
              <span>Received</span>
              <span>{request.created_at ? displaySentAt(request.created_at, "en") : "Unknown"}</span>
            </div>

            {request.audio_url ? <AudioPlayer src={request.audio_url} /> : <p className="alert">Original audio URL is missing.</p>}
          </div>

          <SafetyNote>Provider action updates the request status in Supabase and refreshes this dashboard card.</SafetyNote>

          <div className="actions">
            <ActionButton onClick={() => void setStatus("accepted")} disabled={updating}>
              Accept
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => void setStatus("clarification_requested")} disabled={updating}>
              Ask for Clarification
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => void setStatus("completed")} disabled={updating}>
              Mark Completed
            </ActionButton>
          </div>
        </>
      ) : null}

      <div className="actions" style={{ marginTop: 12 }}>
        <Link href="/requests" className="btn ghost">
          Back to dashboard
        </Link>
      </div>
    </PatientShell>
  );
}