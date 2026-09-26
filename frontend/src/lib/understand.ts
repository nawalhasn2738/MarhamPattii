import type { TranscribeResponse } from "@/lib/api";
import { getCopy } from "@/lib/copy";
import type { LanguageCode } from "@/lib/languages";
import type { EntryKind } from "@/lib/session";

export const SAMPLE_TRANSCRIPT =
  "I want to talk to a doctor about my problem. It has been going on for several days.";

export type Understanding = {
  summaryLead: string;
  summaryHeadline: string;
  requestLabel: string;
  durationLabel: string;
  requiresHuman: true;
};

function requestLabel(entry: EntryKind | undefined, intent: string, text: ReturnType<typeof getCopy>) {
  if (entry === "facility" || intent === "facility_request") return text.facilityRequest;
  if (entry === "doctor" || entry === "mic" || intent === "doctor_request") return text.doctorConsultation;
  return text.healthcareRequest;
}

function durationLabel(urgency: string, text: ReturnType<typeof getCopy>) {
  if (urgency === "several_days") return text.severalDays;
  if (!urgency || urgency === "unknown") return text.notSpecified;
  return urgency;
}

export function describeUnderstanding(
  result: TranscribeResponse,
  entry: EntryKind | undefined,
  language: LanguageCode,
): Understanding {
  const text = getCopy(language);
  const heard = result.transcript.trim();
  const sample = heard === SAMPLE_TRANSCRIPT;

  if (heard && !sample) {
    return {
      summaryLead: text.understoodLead,
      summaryHeadline: heard,
      requestLabel: requestLabel(entry, result.intent, text),
      durationLabel: durationLabel(result.urgency, text),
      requiresHuman: true,
    };
  }

  if (entry === "facility" || result.intent === "facility_request") {
    return {
      summaryLead: text.wantFacilityLead,
      summaryHeadline: text.wantFacilityHeadline,
      requestLabel: text.facilityRequest,
      durationLabel: text.notSpecified,
      requiresHuman: true,
    };
  }

  return {
    summaryLead: text.wantDoctorLead,
    summaryHeadline: text.wantDoctorHeadline,
    requestLabel: text.doctorConsultation,
    durationLabel: text.severalDays,
    requiresHuman: true,
  };
}

export function presentRequest(
  request: {
    transcript?: string;
    entry?: EntryKind;
    summary: string;
    requestLabel: string;
    durationLabel?: string;
    confidence?: number;
  },
  language: LanguageCode,
) {
  if (!request.transcript) {
    return {
      summary: request.summary,
      requestLabel: request.requestLabel,
      durationLabel: request.durationLabel,
    };
  }

  const understood = describeUnderstanding(
    {
      transcript: request.transcript,
      intent: request.entry === "facility" ? "facility_request" : "doctor_request",
      urgency: "unknown",
      confidence: request.confidence ?? 0,
    },
    request.entry,
    language,
  );

  return {
    summary: understood.summaryHeadline,
    requestLabel: understood.requestLabel,
    durationLabel: understood.durationLabel,
  };
}
