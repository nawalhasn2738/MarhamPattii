"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";
import { currentProviderSession, signInProvider } from "@/lib/supabaseBrowser";

function RoleCard({
  eyebrow,
  title,
  body,
  action,
  onClick,
  primary = false,
  disabled = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={primary ? "role-card primary" : "role-card"}
      onClick={onClick}
      disabled={disabled}
    >
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
  const [showProviderLogin, setShowProviderLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingProvider, setCheckingProvider] = useState(false);
  const [authError, setAuthError] = useState("");

  function enterPatientPortal() {
    setRole("patient");
    router.push("/home");
  }

  async function openProviderPortal() {
    setCheckingProvider(true);
    setAuthError("");
    try {
      const session = await currentProviderSession();
      if (session) {
        setRole("provider");
        router.push("/requests");
        return;
      }
      setShowProviderLogin(true);
    } catch (error) {
      setShowProviderLogin(true);
      setAuthError(error instanceof Error ? error.message : "Could not verify the provider session.");
    } finally {
      setCheckingProvider(false);
    }
  }

  async function submitProviderLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckingProvider(true);
    setAuthError("");
    try {
      await signInProvider(email.trim(), password);
      setRole("provider");
      router.push("/requests");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Provider sign-in failed.");
    } finally {
      setCheckingProvider(false);
    }
  }

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
          onClick={enterPatientPortal}
          disabled={checkingProvider}
        />
        <RoleCard
          eyebrow="For providers"
          title="Provider Dashboard"
          body="Sign in to review requests, play original audio, and update request status."
          action={checkingProvider ? "Checking session..." : "Provider sign in"}
          onClick={() => void openProviderPortal()}
          disabled={checkingProvider}
        />
      </div>

      {showProviderLogin ? (
        <form className="provider-login" onSubmit={(event) => void submitProviderLogin(event)}>
          <h2>Provider sign in</h2>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={checkingProvider}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={checkingProvider}
            />
          </label>
          {authError ? <p className="alert" role="alert">{authError}</p> : null}
          <button className="primary-button" type="submit" disabled={checkingProvider}>
            {checkingProvider ? "Signing in..." : "Sign in securely"}
          </button>
        </form>
      ) : null}

      <p className="note">
        Provider access requires a Supabase account with the server-controlled provider role.
      </p>
    </PatientShell>
  );
}
