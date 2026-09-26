"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { LanguageOption } from "@/components/LanguageOption";
import { PatientShell } from "@/components/PatientShell";
import { useRequest } from "@/context/RequestContext";
import { getCopy } from "@/lib/copy";
import { LANGUAGES } from "@/lib/languages";

export default function LanguagePage() {
  const router = useRouter();
  const { state, setLanguage } = useRequest();
  const text = getCopy(state.language);

  return (
    <PatientShell showLanguage={false} screen="language">
      <h1 className="screen-title">{text.chooseLanguage}</h1>
      <p className="screen-copy">{text.changeLater}</p>
      <div className="choices">
        {LANGUAGES.map((language) => (
          <LanguageOption
            key={language.code}
            tag={language.tag}
            title={language.title}
            hint={language.hint}
            urdu={language.urdu}
            selected={state.language === language.code}
            onSelect={() => setLanguage(language.code)}
          />
        ))}
      </div>
      <div className="actions">
        <ActionButton onClick={() => router.push("/home")}>{text.continue}</ActionButton>
      </div>
    </PatientShell>
  );
}
