import { AudioPlayer } from "@/components/AudioPlayer";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ConfirmationCard({
  lead,
  headline,
  language,
  request,
  duration,
  providerSummary,
  languageCaption = "Language",
  requestCaption = "Request",
  durationCaption = "How long",
  providerSummaryCaption = "Provider summary",
  audioUrl,
  durationSeconds = 0,
}: {
  lead: string;
  headline: string;
  language: string;
  request: string;
  duration: string;
  providerSummary?: string;
  languageCaption?: string;
  requestCaption?: string;
  durationCaption?: string;
  providerSummaryCaption?: string;
  audioUrl?: string;
  durationSeconds?: number;
}) {
  return (
    <div className="summary">
      <p className="lead">{lead}</p>
      <p className="big">{headline}</p>
      <Row label={languageCaption} value={language} />
      <Row label={requestCaption} value={request} />
      <Row label={durationCaption} value={duration} />
      {providerSummary ? <Row label={providerSummaryCaption} value={providerSummary} /> : null}
      {audioUrl ? <AudioPlayer src={audioUrl} fallbackDuration={durationSeconds} /> : null}
    </div>
  );
}