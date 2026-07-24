import { describe, expect, it } from "vitest";

import {
  buildSourceCohortConversionJourney,
  buildSourceCohortConversionJourneyDrilldown,
  type SourceCohortConversionJourneyDrilldownDealFacts
} from "../src/domain/source-cohort-conversion-journey.js";

const range = {
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-30T23:59:59.999Z"
};
const asOf = "2026-06-10T00:00:00.000Z";

function deal(
  dealId: string,
  overrides: Partial<SourceCohortConversionJourneyDrilldownDealFacts> = {}
): SourceCohortConversionJourneyDrilldownDealFacts {
  return {
    dealId,
    dealUrl: `https://example.bitrix24.ru/crm/deal/details/${dealId}/`,
    managerId: "10",
    managerName: "Менеджер",
    currentStageId: "C10:NEW",
    currentStageName: "База входящая",
    outcome: "open",
    createdAt: "2026-06-01T00:00:00.000Z",
    firstCallAt: null,
    confirmedConversationAt: null,
    meetingScheduledAt: null,
    meetingCompletedAt: null,
    attendedEventAts: [],
    contractAt: null,
    transferredAt: null,
    ...overrides
  };
}

describe("source cohort conversion journey drill-down", () => {
  it("reconciles reached, missed and not-advanced deals with journey aggregates", () => {
    const facts = [
      deal("1", {
        firstCallAt: "2026-06-01T02:00:00.000Z",
        confirmedConversationAt: "2026-06-01T03:00:00.000Z"
      }),
      deal("2", {
        firstCallAt: "2026-06-02T00:00:00.000Z"
      }),
      deal("3", {
        createdAt: "2026-06-08T00:00:00.000Z",
        firstCallAt: "2026-06-09T00:00:00.000Z"
      }),
      deal("4", {
        firstCallAt: "2026-06-02T00:00:00.000Z",
        currentStageId: "C10:LOSE",
        currentStageName: "Корзина",
        outcome: "lost"
      }),
      deal("5"),
      deal("6", {
        currentStageId: "WON",
        currentStageName: "Передано в клуб",
        outcome: "won",
        transferredAt: "2026-06-06T00:00:00.000Z"
      }),
      deal("7", {
        firstCallAt: "2026-06-03T00:00:00.000Z",
        confirmedConversationAt: "2026-06-02T00:00:00.000Z"
      })
    ];
    const journey = buildSourceCohortConversionJourney({ dealFacts: facts, asOf });
    const drilldown = buildSourceCohortConversionJourneyDrilldown({
      range,
      dealFacts: facts,
      stepKey: "first_call",
      asOf
    });
    const firstCall = journey.coreSteps.find(
      (step) => step.stepKey === "first_call"
    );
    const confirmedConversation = journey.coreSteps.find(
      (step) => step.stepKey === "confirmed_conversation"
    );

    expect(drilldown.views.reached.count).toBe(firstCall?.deals);
    expect(drilldown.views.missed.count).toBe(firstCall?.dropoffDeals);
    expect(drilldown.views.notAdvanced.count).toBe(
      confirmedConversation?.dropoffDeals
    );
    expect(drilldown.views.reached.deals.map((row) => row.dealId)).toHaveLength(5);
    expect(drilldown.views.missed.deals.map((row) => row.dealId).sort()).toEqual([
      "5",
      "6"
    ]);
    expect(
      drilldown.views.notAdvanced.deals.map((row) => row.dealId).sort()
    ).toEqual(["2", "3", "4", "7"]);
  });

  it("separates stuck, within-SLA, lost and data-gap explanations without PII", () => {
    const drilldown = buildSourceCohortConversionJourneyDrilldown({
      range,
      stepKey: "first_call",
      asOf,
      dealFacts: [
        deal("2", { firstCallAt: "2026-06-02T00:00:00.000Z" }),
        deal("3", {
          createdAt: "2026-06-08T00:00:00.000Z",
          firstCallAt: "2026-06-09T00:00:00.000Z"
        }),
        deal("4", {
          firstCallAt: "2026-06-02T00:00:00.000Z",
          currentStageId: "C10:LOSE",
          currentStageName: "Корзина",
          outcome: "lost"
        }),
        deal("7", {
          firstCallAt: "2026-06-03T00:00:00.000Z",
          confirmedConversationAt: "2026-06-02T00:00:00.000Z"
        })
      ]
    });
    const rows = new Map(
      drilldown.views.notAdvanced.deals.map((row) => [row.dealId, row])
    );

    expect(rows.get("2")).toMatchObject({
      status: "stuck",
      statusLabel: "Застряла",
      slaDays: 3,
      ageDays: 9
    });
    expect(rows.get("3")).toMatchObject({
      status: "within_sla",
      statusLabel: "В пределах SLA",
      slaDays: 3,
      ageDays: 2
    });
    expect(rows.get("4")).toMatchObject({
      status: "lost",
      currentStageName: "Корзина"
    });
    expect(rows.get("7")).toMatchObject({
      status: "data_gap",
      statusLabel: "Проверить данные"
    });
    expect(Object.keys(rows.get("2") ?? {})).not.toEqual(
      expect.arrayContaining(["title", "contactId", "phone", "email"])
    );
  });
});
