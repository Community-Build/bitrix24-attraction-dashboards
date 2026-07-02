import { describe, expect, it } from "vitest";

import { buildCallEnrichmentFollowUpNote } from "../src/server/call-enrichment-follow-up-note";
import type { CallAnalysisResultRecord } from "../src/server/sqlite-repository";

const analysis = {
  callId: "CALL1",
  runId: "run-1",
  status: "ready",
  transcriptByRoles: [],
  fullTranscriptText: "Менеджер: Когда созвонимся?\nКлиент: Завтра в обед.",
  aiEvaluation: {
    callClassification: {
      type: "scheduling",
      confidence: 0.95,
      reason: "Согласование времени следующего контакта."
    },
    summary: "Клиент попросил перезвонить завтра в обед.",
    suggestedNextStep: "Перезвонить завтра в обед и согласовать Zoom."
  },
  rawAiEvaluation: {},
  attributes: {
    callId: "CALL1",
    dealId: "23841",
    contactId: "901"
  },
  model: "google/gemini-3.5-flash",
  promptVersion: "calls-v2",
  analyzedAt: "2026-07-02T12:00:00.000Z",
  updatedAt: "2026-07-02T12:00:00.000Z"
} satisfies CallAnalysisResultRecord;

describe("buildCallEnrichmentFollowUpNote", () => {
  it("builds an informational note from call summary and suggested next step", () => {
    expect(buildCallEnrichmentFollowUpNote(analysis)).toEqual({
      classificationType: "scheduling",
      summary: "Клиент попросил перезвонить завтра в обед.",
      nextStep: "Перезвонить завтра в обед и согласовать Zoom."
    });
  });

  it("returns null when the analysis has neither summary nor next step", () => {
    expect(
      buildCallEnrichmentFollowUpNote({
        ...analysis,
        aiEvaluation: {
          callClassification: {
            type: "follow_up",
            confidence: 0.8,
            reason: "Короткий follow-up."
          }
        }
      })
    ).toBeNull();
  });
});
