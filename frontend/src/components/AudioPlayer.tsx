"use client";

import { useRef, useState } from "react";
import { formatClock } from "@/lib/format";

export function AudioPlayer({ src, fallbackDuration = 0 }: { src: string; fallbackDuration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackedSrc, setTrackedSrc] = useState(src);

  if (trackedSrc !== src) {
    setTrackedSrc(src);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }

  function totalLength(elementDuration: number) {
    if (Number.isFinite(elementDuration) && elementDuration > 0) return elementDuration;
    return fallbackDuration;
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  }

  const shownDuration = duration > 0 ? duration : fallbackDuration;

  return (
    <div className="audio-row">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause original recording" : "Play original recording"}>
        {playing ? <span className="pause-bars" /> : <span className="play-tri" />}
      </button>
      <span className="audio-track" aria-hidden>
        <span style={{ width: `${Math.min(progress, 100)}%` }} />
      </span>
      <span>{formatClock(shownDuration)}</span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(event) => {
          const nextDuration = totalLength(event.currentTarget.duration);
          if (nextDuration > 0) setDuration(nextDuration);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          const total = totalLength(audio.duration);
          if (!total) return;
          setProgress((audio.currentTime / total) * 100);
        }}
      />
    </div>
  );
}
