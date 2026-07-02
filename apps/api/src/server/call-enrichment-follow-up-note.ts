import type { CallAnalysisResultRecord } from "./sqlite-repository.js";

export interface CallEnrichmentFollowUpNote {
  classificationType: string | null;
  summary: string | null;
  nextStep: string | null;
}

export function buildCallEnrichmentFollowUpNote(
  analysis: CallAnalysisResultRecord
): CallEnrichmentFollowUpNote | null {
  const summary = normalizeText(analysis.aiEvaluation.summary);
  const nextStep = normalizeText(analysis.aiEvaluation.suggestedNextStep);
  if (!summary && !nextStep) {
    return null;
  }

  return {
    classificationType: extractClassificationType(analysis.aiEvaluation),
    summary,
    nextStep
  };
}

function extractClassificationType(aiEvaluation: Record<string, unknown>) {
  const classification = aiEvaluation.callClassification;
  if (
    !classification ||
    typeof classification !== "object" ||
    Array.isArray(classification)
  ) {
    return null;
  }

  return normalizeText((classification as { type?: unknown }).type);
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}
