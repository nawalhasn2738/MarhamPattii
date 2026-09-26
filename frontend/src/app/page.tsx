"use client";

import { useRouter } from "next/navigation";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";

function RoleCard({
  eyebrow,
  title,
  body,
  action,
  onClick,
  primary = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button type="button" className={primary ? "role-card primary" : "role-card"} onClick={onClick}>
      <span className="role-eyebrow">{eyebrow}</span>
      <span className="role-title">{title}</span>
      <span className="role-body">{body}</span>
      <span className="role-action">{action}</span>
    </button>
  );
}

export default function RoleSelectionPage() {
  const router = useRouter();
  const { setRole } = useRequest();

  return (
    <PatientShell showLanguage={false}>
      <section className="welcome-hero">
        <span className="brand-pill">MarhamPattii</span>
        <h1 className="screen-title center">Choose your portal</h1>
        <p className="screen-copy center">
          A voice-first Balti healthcare bridge for patients and providers.
        </p>
      </section>

      <div className="role-grid" aria-label="Choose your role">
        <RoleCard
          primary
          eyebrow="For patients"
          title="Patient Portal"
          body="Record a Balti voice request and review what the system understood."
          action="Start voice request"
          onClick={() => { setRole("patient"); router.push("/home"); }}
        />
        <RoleCard
          eyebrow="For providers"
          title="Provider Dashboard"
          body="Review incoming requests, play original audio, and update request status."
          action="Open dashboard"
          onClick={() => { setRole("provider"); router.push("/requests"); }}
        />
      </div>

      <p className="note">
        Hackathon MVP: this screen simulates role selection. Full authentication and role-based access can be added with Supabase Auth later.
      </p>
    </PatientShell>
  );
}