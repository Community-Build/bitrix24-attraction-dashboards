import { describe, expect, it } from "vitest";

import {
  buildSourceCohortConversionStageDrilldown,
  type SourceCohortConversionStageDrilldownDealFacts,
  type SourceCohortConversionStageDrilldownStage
} from "../src/domain/source-cohort-conversion-stage-drilldown.js";

const range = {
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-30T23:59:59.999Z"
};
const asOf = "2026-06-10T00:00:00.000Z";
const stages: SourceCohortConversionStageDrilldownStage[] = [
  {
    stageId: "C10:NEW",
    stageName: "База входящая",
    sortOrder: 10,
    terminalKind: null
  },
  {
    stageId: "C10:CALL",
    stageName: "Звонок-знакомство",
    sortOrder: 20,
    terminalKind: null
  },
  {
    stageId: "C10:MEETING",
    stageName: "Встреча-знакомство",
    sortOrder: 30,
    terminalKind: null
  },
  {
    stageId: "C10:WON",
    stageName: "Передано в клуб",
    sortOrder: 40,
    terminalKind: "won"
  },
  {
    stageId: "C10:LOSE",
    stageName: "Корзина",
    sortOrder: 50,
    terminalKind: "lost"
  }
];

function deal(
  dealId: string,
  stageEntries: Record<string, string[]>,
  overrides: Partial<SourceCohortConversionStageDrilldownDealFacts> = {}
): SourceCohortConversionStageDrilldownDealFacts {
  const currentStageId = overrides.currentStageId ?? "C10:NEW";
  const currentStageName =
    stages.find((stage) => stage.stageId === currentStageId)?.stageName ??
    currentStageId;

  return {
    dealId,
    dealUrl: `https://example.bitrix24.ru/crm/deal/details/${dealId}/`,
    managerId: "10",
    managerName: "Менеджер",
    currentStageId,
    currentStageName,
    currentStageEnteredAt:
      stageEntries[currentStageId]?.at(-1) ?? "2026-06-01T00:00:00.000Z",
    outcome: "open",
    createdAt: "2026-06-01T00:00:00.000Z",
    stageEnteredAts: new Map(Object.entries(stageEntries)),
    ...overrides
  };
}

describe("source cohort CRM-stage drill-down", () => {
  it("reconciles reached, missed and not-advanced deals without treating shortcuts as losses", () => {
    const drilldown = buildSourceCohortConversionStageDrilldown({
      range,
      stages,
      stageId: "C10:CALL",
      asOf,
      dealFacts: [
        deal(
          "1",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:CALL": ["2026-06-01T01:00:00.000Z"],
            "C10:MEETING": ["2026-06-01T02:00:00.000Z"]
          },
          {
            currentStageId: "C10:MEETING",
            currentStageEnteredAt: "2026-06-01T02:00:00.000Z"
          }
        ),
        deal(
          "2",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:CALL": [
              "2026-06-02T00:30:00+01:00",
              "2026-06-01T23:45:00.000Z"
            ]
          },
          {
            currentStageId: "C10:CALL",
            currentStageEnteredAt: "2026-06-02T00:00:00.000Z"
          }
        ),
        deal("3", {
          "C10:NEW": ["2026-06-01T00:00:00.000Z"]
        }),
        deal(
          "4",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:MEETING": ["2026-06-03T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:MEETING",
            currentStageEnteredAt: "2026-06-03T00:00:00.000Z"
          }
        ),
        deal(
          "5",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:CALL": ["2026-06-02T00:00:00.000Z"],
            "C10:LOSE": ["2026-06-04T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:LOSE",
            currentStageEnteredAt: "2026-06-04T00:00:00.000Z",
            outcome: "lost"
          }
        )
      ]
    });

    expect(drilldown).toMatchObject({
      drilldownKind: "crm_stage",
      stepKey: "C10:CALL",
      previousStepKey: "C10:NEW",
      nextStepKey: "C10:MEETING"
    });
    expect(drilldown.views.reached.count).toBe(3);
    expect(drilldown.views.missed.count).toBe(2);
    expect(drilldown.views.notAdvanced.count).toBe(2);
    expect(
      drilldown.views.missed.deals.find((row) => row.dealId === "4")
    ).toMatchObject({
      status: "advanced",
      statusLabel: "Этап пропущен"
    });
    expect(
      drilldown.views.notAdvanced.deals.find((row) => row.dealId === "2")
    ).toMatchObject({
      status: "within_sla",
      statusLabel: "Сейчас на этапе",
      selectedStepAt: "2026-06-02T00:30:00+01:00",
      ageDays: 8,
      slaDays: null
    });
    expect(
      drilldown.views.notAdvanced.deals.find((row) => row.dealId === "5")
    ).toMatchObject({
      status: "lost",
      currentStageName: "Корзина"
    });
    expect(
      Object.keys(drilldown.views.reached.deals[0] ?? {})
    ).not.toEqual(
      expect.arrayContaining(["title", "contactId", "phone", "email"])
    );
  });

  it("shows a terminal loss stage as a reached-only deal list", () => {
    const drilldown = buildSourceCohortConversionStageDrilldown({
      range,
      stages,
      stageId: "C10:LOSE",
      asOf,
      dealFacts: [
        deal(
          "5",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:CALL": ["2026-06-02T00:00:00.000Z"],
            "C10:LOSE": ["2026-06-04T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:LOSE",
            currentStageEnteredAt: "2026-06-04T00:00:00.000Z",
            outcome: "lost"
          }
        )
      ]
    });

    expect(drilldown.views.reached.count).toBe(1);
    expect(drilldown.views.reached.deals[0]).toMatchObject({
      dealId: "5",
      status: "lost"
    });
    expect(drilldown.views.missed).toMatchObject({
      label: "Не применяется",
      count: 0
    });
    expect(drilldown.views.notAdvanced).toMatchObject({
      label: "Не применяется",
      count: 0
    });
  });
});
