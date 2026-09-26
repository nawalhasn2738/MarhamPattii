import { formatRecording } from "@/lib/format";

export function RecordingTimer({ seconds }: { seconds: number }) {
  return <p className="timer">{formatRecording(seconds)}</p>;
}
