export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function formatRecording(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function formatSentAt(date: Date, language: "ur" | "en" | "bft" = "en") {
  const time = new Intl.DateTimeFormat(language === "ur" ? "ur-PK" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return language === "ur" ? `آج، ${time}` : `Today, ${time}`;
}

export function displaySentAt(value: string | undefined, language: "ur" | "en" | "bft") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatSentAt(date, language);
}
