type StepState = "done" | "now" | "pending";

function stepState(index: number, activeIndex: number): StepState {
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "now";
  return "pending";
}

export function ProcessingSteps({ labels, activeIndex }: { labels: string[]; activeIndex: number }) {
  return (
    <ol className="steps">
      {labels.map((label, index) => {
        const state = stepState(index, activeIndex);
        return (
          <li key={label} className={state === "pending" ? undefined : state}>
            <b>{state === "done" ? "✓" : ""}</b>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
