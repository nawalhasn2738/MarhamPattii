export type LanguageCode = "ur" | "en" | "bft";

export type LanguageOptionData = {
  code: LanguageCode;
  title: string;
  tag: string;
  hint?: string;
  urdu?: boolean;
};

export const LANGUAGES: LanguageOptionData[] = [
  { code: "ur", title: "اردو", tag: "ا", urdu: true },
  { code: "en", title: "English", tag: "A" },
  { code: "bft", title: "Balti", tag: "ب", hint: "Speak in Balti" },
];

export function languageName(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code)?.title ?? "Balti";
}
