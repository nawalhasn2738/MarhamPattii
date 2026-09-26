"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { languageName } from "@/lib/languages";

export function PatientShell({
  children,
  showLanguage = true,
  screen,
}: {
  children: React.ReactNode;
  showLanguage?: boolean;
  screen?: string;
}) {
  const pathname = usePathname();
  const { state } = useRequest();
  const text = getCopy(state.language);
  const label = languageName(state.language);
  const urdu = state.language === "ur";
  const onRequests = pathname.startsWith("/requests");

  return (
    <div className="stage">
      <div className={urdu ? "patient-phone urdu-ui" : "patient-phone"} dir={urdu ? "rtl" : "ltr"} lang={urdu ? "ur" : "en"}>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href={showLanguage ? "/home" : "/"} className="brand">
              MarhamPattii
            </Link>
            {showLanguage ? (
              <nav className="site-nav" aria-label="Pages">
                <Link href="/home" className={pathname === "/home" ? "on" : undefined}>
                  {text.homeNav}
                </Link>
                <Link href="/requests" className={onRequests ? "on" : undefined}>
                  {text.myRequests}
                </Link>
              </nav>
            ) : null}
            {showLanguage ? (
              <Link href="/" className={urdu ? "lang-chip urdu" : "lang-chip"} aria-label={`${label}. ${text.changeLater}`}>
                {label}
              </Link>
            ) : null}
          </div>
        </header>
        <div className={screen ? `phone-body screen-${screen}` : "phone-body"}>
          <div className="page-wrap">{children}</div>
        </div>
        <footer className="site-foot">{text.safety}</footer>
      </div>
    </div>
  );
}
