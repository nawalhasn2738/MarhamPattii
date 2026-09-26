"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { PatientShell } from "@/components/PatientShell";
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

function shortSummary(request: ProviderRequest) {
  return request.transcript?.trim() || request.intent || "No transcript saved yet.";
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<ProviderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setRequests(await fetchDashboardRequests(controller.signal));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Failed to load requests.");
      } finally {
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const pendingCount = useMemo(() => requests.filter((request) => (request.status ?? "pending") === "pending").length, [requests]);

  async function setStatus(id: string, status: "accepted" | "clarification_requested") {
    try {
      setUpdatingId(id);
      const updated = await updateRequestStatus(id, status);
      setRequests((current) => current.map((request) => (request.id === id ? updated : request)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update request.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <PatientShell>
      <h1 className="screen-title">Provider Dashboard</h1>
      <p className="screen-copy">
        Incoming patient voice requests from Supabase. {pendingCount} request{pendingCount === 1 ? "" : "s"} pending.
      </p>

      {loading ? <p className="screen-copy">Loading incoming requests...</p> : null}
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && requests.length === 0 ? <p className="screen-copy">No patient requests found yet.</p> : null}

      <div className="request-list">
        {requests.map((request) => (
          <article key={request.id} className="summary" style={{ marginTop: 0 }}>
            <div className="dash-card-head">
              <span className="badge">{request.language || "Balti"}</span>
              <span className={urgencyClass(request.urgency)}>{request.urgency || "unknown"}</span>
              <span className="badge status-badge">{statusLabel(request.status)}</span>
            </div>

            <h2 className="big" style={{ marginBottom: 4 }}>
              {request.intent || "Unclear request"}
            </h2>
            <p className="lead">{shortSummary(request)}</p>

            <div className="kv">
              <span>AI confidence</span>
              <span>Not stored</span>
            </div>
            <div className="kv">
              <span>Received</span>
              <span>{request.created_at ? displaySentAt(request.created_at, "en") : "Unknown"}</span>
            </div>

            <div className="actions dashboard-actions">
              <Link href={`/requests/${request.id}`} className="btn ghost">
                Open details
              </Link>
              <ActionButton onClick={() => void setStatus(request.id, "accepted")} disabled={updatingId === request.id}>
                Accept
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() => void setStatus(request.id, "clarification_requested")}
                disabled={updatingId === request.id}
              >
                Ask for Clarification
              </ActionButton>
            </div>
          </article>
        ))}
      </div>
    </PatientShell>
  );
}