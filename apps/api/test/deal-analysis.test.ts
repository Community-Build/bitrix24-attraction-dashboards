import type {
  ActivitySnapshot,
  DealSnapshot,
  OperationalThresholdSettings,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";
import { describe, expect, it } from "vitest";

import {
  buildDealAnalysisReport,
  buildDealAnalysisTimeline
} from "../src/domain/deal-analysis";

const now = "2026-06-20T12:00:00.000Z";
const range = { from: "2026-05-20T00:00:00.000Z", to: "2026-06-20T23:59:59.999Z" };
const thresholds: OperationalThresholdSettings = {
  stageAging: [{ stageId: "C10:NEW", stageName: "Новая", maxDaysOnStage: 5 }],
  noCallsMaxDays: 7,
  noActivityMaxDays: 5,
  slaBusinessHours: { sla1: 24, sla2: 5, sla3: 72 },
  updatedAt: "2026-06-01T00:00:00.000Z"
};
const stages: StageCatalogEntry[] = [
  { entityType: "deal", categoryId: "10", statusId: "C10:NEW", name: "Новая", semanticId: "P" },
  { entityType: "deal", categoryId: "10", statusId: "C10:WON", name: "Успех", semanticId: "S" }
];
const deal: DealSnapshot = {
  id: "42",
  leadId: null,
  categoryId: "10",
  stageId: "C10:NEW",
  stageSemanticId: "P",
  opportunity: 100_000,
  assignedById: "7",
  sourceId: null,
  qualityValue: null,
  dateCreate: "2026-06-01T12:00:00.000Z",
  dateModify: "2026-06-01T12:00:00.000Z",
  dateClosed: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null
};

function activity(overrides: Partial<ActivitySnapshot>): ActivitySnapshot {
  return {
    id: "a1",
    ownerTypeId: "DEAL",
    ownerId: "42",
    typeId: null,
    providerId: "CRM_TASKS_TASK",
    responsibleId: "7",
    createdTime: "2026-06-18T12:00:00.000Z",
    deadline: "2026-06-25T12:00:00.000Z",
    lastUpdated: "2026-06-18T12:00:00.000Z",
    completed: false,
    completedTime: null,
    ...overrides
  };
}

function build(input: { activities?: ActivitySnapshot[]; calls?: Parameters<typeof buildDealAnalysisReport>[0]["calls"] }) {
  return buildDealAnalysisReport({
    range,
    now,
    scope: "open",
    deals: [deal],
    currentDealIds: new Set(["42"]),
    currentScope: { status: "ready", reconciledAt: now, dealCount: 1 },
    stageCatalog: stages,
    stageHistory: [{
      id: "s1",
      ownerId: "42",
      categoryId: "10",
      stageId: "C10:NEW",
      stageSemanticId: "P",
      typeId: null,
      createdTime: "2026-06-10T12:00:00.000Z"
    }],
    activities: input.activities ?? [],
    calls: input.calls ?? [],
    touchpoints: [],
    managerDirectory: [{ id: "7", name: "Менеджер" }],
    thresholds,
    wonStageIds: ["C10:WON"]
  });
}

describe("buildDealAnalysisReport", () => {
  it("applies the agreed deterministic penalties and exposes their evidence", () => {
    const row = build({ activities: [] }).rows[0]!;
    expect(row.healthScore).toBe(20);
    expect(row.healthBand).toBe("critical");
    expect(row.risks.map((risk) => [risk.key, risk.deduction])).toEqual([
      ["missing_next_action", 30],
      ["stage_aging", 25],
      ["no_recent_activity", 15],
      ["no_recent_calls", 10]
    ]);
    expect(row.risks.every((risk) => risk.evidence && risk.recommendation)).toBe(true);
  });

  it("uses overdue instead of missing and keeps a healthy fully active deal", () => {
    const overdue = build({ activities: [activity({ deadline: "2026-06-18T12:00:00.000Z" })] }).rows[0]!;
    expect(overdue.risks.map((risk) => risk.key)).not.toContain("missing_next_action");
    expect(overdue.risks.map((risk) => risk.key)).toContain("overdue_next_action");

    const activeDeal = { ...deal, dateCreate: "2026-06-18T12:00:00.000Z" };
    const report = buildDealAnalysisReport({
      range,
      now,
      scope: "open",
      deals: [activeDeal],
      currentDealIds: new Set(["42"]),
      currentScope: { status: "ready", reconciledAt: now, dealCount: 1 },
      stageCatalog: stages,
      stageHistory: [],
      activities: [activity({})],
      calls: [{
        id: "c1", crmActivityId: null, portalUserId: "7", callType: "1",
        callStartDate: "2026-06-19T12:00:00.000Z", callDurationSeconds: 60,
        crmEntityType: "DEAL", crmEntityId: "42", callFailedCode: null
      }],
      touchpoints: [],
      thresholds,
      wonStageIds: ["C10:WON"]
    });
    expect(report.rows[0]?.healthScore).toBe(100);
    expect(report.rows[0]?.healthBand).toBe("healthy");
  });

  it("keeps terminal deals separate and does not health-score them", () => {
    const report = buildDealAnalysisReport({
      range,
      now,
      scope: "won",
      deals: [{ ...deal, stageId: "C10:WON", stageSemanticId: "S", dateClosed: now }],
      currentDealIds: new Set(["42"]),
      currentScope: { status: "ready", reconciledAt: now, dealCount: 1 },
      stageCatalog: stages,
      stageHistory: [], activities: [], calls: [], touchpoints: [], thresholds,
      wonStageIds: ["C10:WON"]
    });
    expect(report.rows[0]?.healthScore).toBeNull();
    expect(report.rows[0]?.risks).toEqual([]);
  });

  it("flags a deal that did not move after a completed meeting", () => {
    const report = buildDealAnalysisReport({
      range,
      now,
      scope: "open",
      deals: [deal],
      currentDealIds: new Set(["42"]),
      currentScope: { status: "ready", reconciledAt: now, dealCount: 1 },
      stageCatalog: stages,
      stageHistory: [{
        id: "s1", ownerId: "42", categoryId: "10", stageId: "C10:NEW",
        stageSemanticId: "P", typeId: null, createdTime: "2026-06-10T12:00:00.000Z"
      }],
      activities: [activity({})],
      calls: [{
        id: "c1", crmActivityId: null, portalUserId: "7", callType: "1",
        callStartDate: "2026-06-19T12:00:00.000Z", callDurationSeconds: 60,
        crmEntityType: "DEAL", crmEntityId: "42", callFailedCode: null
      }],
      touchpoints: [{
        factId: "meeting:1", kind: "meeting", sourceSystem: "bitrix",
        sourceEntityType: "activity", sourceEntityId: "m1",
        occurredAt: "2026-06-12T12:00:00.000Z", dealId: "42", contactId: null,
        leadId: null, managerId: "7", sourceId: null, stageIdAtEvent: "C10:NEW",
        stageNameAtEvent: "Новая", linkConfidence: "high", linkReason: "direct",
        payloadJson: JSON.stringify({ completed: true })
      }],
      thresholds,
      wonStageIds: ["C10:WON"]
    });
    expect(report.rows[0]?.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "stalled_after_milestone", deduction: 20 })
    ]));
  });
});

describe("buildDealAnalysisTimeline", () => {
  it("merges task lifecycle facts and keeps concrete task content and dates", () => {
    const timeline = buildDealAnalysisTimeline([
      {
        factId: "task-created:11", kind: "task_created", sourceSystem: "bitrix24",
        sourceEntityType: "activity", sourceEntityId: "11",
        occurredAt: "2026-08-01T09:00:00.000Z", dealId: "42", contactId: null,
        leadId: null, managerId: "7", sourceId: null, stageIdAtEvent: "C10:NEW",
        stageNameAtEvent: "Новая", linkConfidence: "high", linkReason: "direct",
        payloadJson: JSON.stringify({
          subject: "Подготовить предложение",
          description: "Согласовать состав пакета с клиентом",
          createdTime: "2026-08-01T09:00:00.000Z",
          deadline: "2026-08-03T12:00:00.000Z"
        })
      },
      {
        factId: "task-completed:11", kind: "task_completed", sourceSystem: "bitrix24",
        sourceEntityType: "activity", sourceEntityId: "11",
        occurredAt: "2026-08-02T15:00:00.000Z", dealId: "42", contactId: null,
        leadId: null, managerId: "7", sourceId: null, stageIdAtEvent: "C10:NEW",
        stageNameAtEvent: "Новая", linkConfidence: "high", linkReason: "direct",
        payloadJson: JSON.stringify({
          subject: "Подготовить предложение",
          description: "Согласовать состав пакета с клиентом",
          createdTime: "2026-08-01T09:00:00.000Z",
          completedTime: "2026-08-02T15:00:00.000Z",
          deadline: "2026-08-03T12:00:00.000Z"
        })
      }
    ]);

    expect(timeline).toEqual([
      expect.objectContaining({
        id: "task:11",
        sourceEntityId: "11",
        kind: "task_completed",
        title: "Подготовить предложение",
        comment: "Согласовать состав пакета с клиентом",
        createdAt: "2026-08-01T09:00:00.000Z",
        deadlineAt: "2026-08-03T12:00:00.000Z",
        completedAt: "2026-08-02T15:00:00.000Z",
        direction: null
      })
    ]);
  });
});
