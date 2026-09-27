export type ProcessingStepStatus = "pending" | "active" | "success" | "error";

export type ProcessingStep = {
  label: string;
  status: ProcessingStepStatus;
};

export function ProcessingSteps({ steps }: { steps: ProcessingStep[] }) {
  return (
    <ol className="steps" aria-live="polite">
      {steps.map((step) => (
        <li key={step.label} className={step.status}>
          <b aria-hidden="true">
            {step.status === "success" ? "✓" : step.status === "error" ? "!" : ""}
          </b>
          <span>{step.label}</span>
          <span className="sr-only">
            {step.status === "active" ? "In progress" : step.status === "success" ? "Complete" : step.status === "error" ? "Failed" : "Waiting"}
          </span>
        </li>
      ))}
    </ol>
  );
}