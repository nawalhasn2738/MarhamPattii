"use client";

export function MicButton({
  onClick,
  label = "Speak in Balti",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="mic">
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M5 11a7 7 0 0 0 14 0M12 18v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
