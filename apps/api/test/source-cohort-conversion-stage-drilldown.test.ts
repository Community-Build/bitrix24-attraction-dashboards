import { describe, expect, it } from "vitest";

import {
  buildSourceCohortConversionStageDrilldown,
  SourceCohortConversionStageNotFoundError,
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
    stageKind: "productive"
  },
  {
    stageId: "C10:CALL",
    stageName: "Звонок-знакомство",
    sortOrder: 20,
    stageKind: "productive"
  },
  {
    stageId: "C10:MEETING",
    stageName: "Встреча-знакомство",
    sortOrder: 30,
    stageKind: "productive"
  },
  {
    stageId: "C10:WON",
    stageName: "Передано в клуб",
    sortOrder: 40,
    stageKind: "won"
  },
  {
    stageId: "C10:LOSE",
    stageName: "Корзина",
    sortOrder: 50,
    stageKind: "lost"
  }
];
const stagesWithAlternativeRoutes: SourceCohortConversionStageDrilldownStage[] = [
  ...stages.filter(
    (stage) => stage.stageId !== "C10:WON" && stage.stageId !== "C10:LOSE"
  ),
  {
    stageId: "C10:UC_XEEP0A",
    stageName: "Отклонено потребителем",
    sortOrder: 35,
    stageKind: "productive"
  },
  stages.find((stage) => stage.stageId === "C10:WON")!,
  stages.find((stage) => stage.stageId === "C10:LOSE")!,
  {
    stageId: "C10:UC_EA3R76",
    stageName: "Возврат в Лидген(неквал)",
    sortOrder: 60,
    stageKind: "return"
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
      selectedStepAt: "2026-06-01T23:45:00.000Z",
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
      stages: stagesWithAlternativeRoutes,
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
        ),
        deal(
          "6",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:LOSE": ["2026-06-03T00:00:00.000Z"],
            "C10:CALL": ["2026-06-05T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:CALL",
            currentStageEnteredAt: "2026-06-05T00:00:00.000Z",
            outcome: "open"
          }
        ),
        deal(
          "10",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:LOSE": ["2026-06-03T00:00:00.000Z"],
            "C10:UC_EA3R76": ["2026-06-05T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:UC_EA3R76",
            currentStageName: "Возврат в Лидген(неквал)",
            currentStageEnteredAt: "2026-06-05T00:00:00.000Z",
            outcome: "returned"
          }
        )
      ]
    });

    expect(drilldown.views.reached.count).toBe(3);
    expect(
      drilldown.views.reached.deals.find((row) => row.dealId === "5")
    ).toMatchObject({
      dealId: "5",
      status: "lost"
    });
    expect(
      drilldown.views.reached.deals.find((row) => row.dealId === "6")
    ).toMatchObject({
      dealId: "6",
      outcome: "open",
      status: "advanced",
      statusLabel: "Снова в работе"
    });
    expect(
      drilldown.views.reached.deals.find((row) => row.dealId === "10")
    ).toMatchObject({
      dealId: "10",
      outcome: "returned",
      status: "returned",
      statusLabel: "Возвращена в лидген"
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

  it("treats consumer rejection as a repairable stage and follows the current outcome", () => {
    const drilldown = buildSourceCohortConversionStageDrilldown({
      range,
      stages: stagesWithAlternativeRoutes,
      stageId: "C10:UC_XEEP0A",
      asOf,
      dealFacts: [
        deal(
          "7",
          {
            "C10:MEETING": ["2026-06-02T00:00:00.000Z"],
            "C10:UC_XEEP0A": ["2026-06-03T00:00:00.000Z"],
            "C10:WON": ["2026-06-04T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:WON",
            currentStageEnteredAt: "2026-06-04T00:00:00.000Z",
            outcome: "won"
          }
        )
      ]
    });

    expect(drilldown).toMatchObject({
      previousStepKey: "C10:MEETING",
      nextStepKey: "C10:WON"
    });
    expect(drilldown.views.reached.deals[0]).toMatchObject({
      dealId: "7",
      outcome: "won",
      status: "advanced"
    });
    expect(drilldown.views.reached.deals[0]?.status).not.toBe("lost");
  });

  it("keeps return-to-leadgen distinct from basket loss and reclassifies resumed deals", () => {
    const drilldown = buildSourceCohortConversionStageDrilldown({
      range,
      stages: stagesWithAlternativeRoutes,
      stageId: "C10:UC_EA3R76",
      asOf,
      dealFacts: [
        deal(
          "8",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:UC_EA3R76": ["2026-06-03T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:UC_EA3R76",
            currentStageName: "Возврат в Лидген(неквал)",
            currentStageEnteredAt: "2026-06-03T00:00:00.000Z",
            outcome: "returned"
          }
        ),
        deal(
          "9",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:UC_EA3R76": ["2026-06-03T00:00:00.000Z"],
            "C10:CALL": ["2026-06-05T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:CALL",
            currentStageEnteredAt: "2026-06-05T00:00:00.000Z",
            outcome: "open"
          }
        )
      ]
    });

    expect(drilldown.views.reached.deals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dealId: "8",
          outcome: "returned",
          status: "returned",
          statusLabel: "Возвращена в лидген"
        }),
        expect.objectContaining({
          dealId: "9",
          outcome: "open",
          status: "advanced",
          statusLabel: "Снова в работе"
        })
      ])
    );
    expect(
      drilldown.views.reached.deals.filter(
        (row) => row.status === "lost" && row.outcome !== "lost"
      )
    ).toEqual([]);
    expect(drilldown.views.missed.label).toBe("Не применяется");
    expect(drilldown.views.notAdvanced.label).toBe("Не применяется");
  });

  it("keeps the current return route distinct in productive-stage views", () => {
    const drilldown = buildSourceCohortConversionStageDrilldown({
      range,
      stages: stagesWithAlternativeRoutes,
      stageId: "C10:CALL",
      asOf,
      dealFacts: [
        deal(
          "11",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:CALL": ["2026-06-02T00:00:00.000Z"],
            "C10:UC_EA3R76": ["2026-06-04T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:UC_EA3R76",
            currentStageName: "Возврат в Лидген(неквал)",
            currentStageEnteredAt: "2026-06-04T00:00:00.000Z",
            outcome: "returned"
          }
        ),
        deal(
          "12",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:UC_EA3R76": ["2026-06-04T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:UC_EA3R76",
            currentStageName: "Возврат в Лидген(неквал)",
            currentStageEnteredAt: "2026-06-04T00:00:00.000Z",
            outcome: "returned"
          }
        )
      ]
    });

    expect(drilldown.views.reached.deals[0]).toMatchObject({
      dealId: "11",
      status: "returned"
    });
    expect(drilldown.views.notAdvanced.deals[0]).toMatchObject({
      dealId: "11",
      status: "returned"
    });
    expect(drilldown.views.missed.deals[0]).toMatchObject({
      dealId: "12",
      status: "returned"
    });
  });

  it("uses the latest CRM-stage visit when a deal returns from the next stage", () => {
    const drilldown = buildSourceCohortConversionStageDrilldown({
      range,
      stages,
      stageId: "C10:CALL",
      asOf,
      dealFacts: [
        deal(
          "13",
          {
            "C10:NEW": ["2026-06-01T00:00:00.000Z"],
            "C10:CALL": [
              "2026-06-02T00:00:00.000Z",
              "2026-06-05T00:00:00.000Z"
            ],
            "C10:MEETING": ["2026-06-03T00:00:00.000Z"]
          },
          {
            currentStageId: "C10:CALL",
            currentStageName: "Звонок-знакомство",
            currentStageEnteredAt: "2026-06-05T00:00:00.000Z"
          }
        )
      ]
    });

    expect(drilldown.views.reached.deals[0]).toMatchObject({
      dealId: "13",
      selectedStepAt: "2026-06-05T00:00:00.000Z",
      nextStepAt: null,
      status: "within_sla",
      statusLabel: "Сейчас на этапе"
    });
    expect(drilldown.views.notAdvanced.deals).toEqual([
      expect.objectContaining({
        dealId: "13",
        selectedStepAt: "2026-06-05T00:00:00.000Z",
        nextStepAt: null,
        status: "within_sla"
      })
    ]);
  });

  it("throws a typed error for an unknown CRM stage", () => {
    expect(() =>
      buildSourceCohortConversionStageDrilldown({
        range,
        stages,
        stageId: "C10:UNKNOWN",
        asOf,
        dealFacts: []
      })
    ).toThrow(SourceCohortConversionStageNotFoundError);
  });
});
