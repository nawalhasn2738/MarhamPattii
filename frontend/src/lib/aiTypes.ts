export type AsrResponse = {
  transcript: string;
  // Hosted HF ASR does not expose token log-probabilities for this model.
  confidence: number | null;
};

export type IntentResponse = {
  intent: string;
  duration: string | null;
  urgency: "unknown" | "routine" | "urgent";
  requires_human: boolean;
  summary_for_provider: string;
  summary_english?: string;
  summary_urdu?: string;
};

// Used only at UI boundaries that genuinely need both independent results.
export type UnderstandingResponse = AsrResponse & IntentResponse;