const HEIGHTS = [14, 28, 44, 30, 58, 72, 40, 24, 64, 80, 46, 22, 50, 68, 34, 18, 42, 60, 28, 16, 36, 52, 24, 12];

export function Waveform() {
  return (
    <div className="wave" aria-hidden>
      {HEIGHTS.map((height, index) => (
        <span
          key={index}
          className="wave-bar"
          style={{ ["--h" as string]: `${height}px`, animationDelay: `${(index % 8) * 0.08}s` }}
        />
      ))}
    </div>
  );
}
