"use client";

import Link from "next/link";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { languageName } from "@/lib/languages";

export function PatientShell({
  children,
  showLanguage = true,
}: {
  children: React.ReactNode;
  showLanguage?: boolean;
}) {
  const { state } = useRequest();
  const text = getCopy(state.language);
  const label = languageName(state.language);
  const urdu = state.language === "ur";

  return (
    <div className="stage">
      <div className={urdu ? "patient-phone urdu-ui" : "patient-phone"} dir={urdu ? "rtl" : "ltr"} lang={urdu ? "ur" : "en"}>
        <header className="topbar">
          <span>MarhamPattii</span>
          {showLanguage ? (
            <Link href="/" className={urdu ? "urdu" : undefined} aria-label={`${label}. ${text.changeLater}`}>
              {label}
            </Link>
          ) : null}
        </header>
        <div className="phone-body">{children}</div>
      </div>
    </div>
  );
}
