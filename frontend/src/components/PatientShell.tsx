"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { languageName } from "@/lib/languages";
import { signOutProvider } from "@/lib/supabaseBrowser";

export function PatientShell({
  children,
  showLanguage = true,
}: {
  children: React.ReactNode;
  showLanguage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, logout } = useRequest();
  const text = getCopy(state.language);
  const label = languageName(state.language);
  const urdu = state.language === "ur";
  // The root route is a neutral chooser. Ignore any previously persisted role
  // until a guarded patient/provider page has been entered successfully.
  const activeRole = pathname === "/" ? undefined : state.role;
  const showSwitchRole = Boolean(activeRole);

  async function switchRole() {
    if (state.role === "provider") {
      await signOutProvider().catch(() => undefined);
    }
    logout();
    router.replace("/");
  }

  return (
    <div className="stage">
      <div className={urdu ? "patient-phone urdu-ui" : "patient-phone"} dir={urdu ? "rtl" : "ltr"} lang={urdu ? "ur" : "en"}>
        <header className="topbar">
          <Link href={activeRole === "provider" ? "/requests" : activeRole === "patient" ? "/home" : "/"}>MarhamPattii</Link>
          <span className="topbar-actions">
            {activeRole ? <span className="role-chip">{activeRole}</span> : null}
            {showSwitchRole ? (
              <button type="button" className="topbar-link" onClick={() => void switchRole()}>
                Switch Role
              </button>
            ) : showLanguage ? (
              <Link href="/" className={urdu ? "urdu" : undefined} aria-label={`${label}. ${text.changeLater}`}>
                {label}
              </Link>
            ) : null}
          </span>
        </header>
        <div className="phone-body">{children}</div>
      </div>
    </div>
  );
}
