import type {
  RevenueVelocityReport,
  SourceCohortConversionReport,
  UnitEconomicsCostRulesInput,
  UnitEconomicsReport
} from "@bitrix24-reporting/contracts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  ALLOWED_BITRIX_METHODS,
  FORBIDDEN_FIELD_TOKENS,
  assertAllowedCallEnrichmentWriteMethod,
  assertAllowedBitrixMethod,
  assertSafeSelectFields,
  assertSafeCallEnrichmentWriteFields,
  redactWebhookUrl
} from "../src/bitrix/security";
import {
  CALL_ENRICHMENT_CONTACT_FIELD_CODES,
  CALL_ENRICHMENT_DEAL_FIELD_CODES
} from "../src/server/call-enrichment-fields";
import { createApp } from "../src/server/app";

function getPlaybookInlineScriptHash() {
  const playbookHtml = readFileSync(
    new URL(
      "../../../docs/modules/attraction/playbook/playbook-ki.html",
      import.meta.url
    ),
    "utf8"
  );
  const script = playbookHtml.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];

  if (!script) {
    throw new Error("Playbook inline script not found.");
  }

  return `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
}

function createEmptyRevenueVelocityReport(): RevenueVelocityReport {
  return {
    range: {
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    },
    asOf: "2026-04-30T23:59:59.999Z",
    previousAsOf: null,
    dimension: "manager",
    view: "systemState",
    actionWeights: {
      connectedCallOverThirtySeconds: 1,
      meeting: 3,
      conversionEvent: 5,
      closedTask: 0.5
    },
    totals: {
      dimension: "manager",
      view: "systemState",
      key: "total",
      label: "Итого",
      managerId: null,
      managerName: null,
      sourceKey: null,
      sourceLabel: null,
      customerKey: null,
      customerLabel: null,
      createdDeals: 0,
      activeDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      wipDeals: 0,
      salesAmount: 0,
      averageCheck: null,
      winRate: null,
      averageCycleDays: null,
      medianCycleDays: null,
      revenueVelocityPerDay: null,
      activePipelineAmount: 0,
      expectedPipelineAmount: 0,
      previousExpectedPipelineAmount: null,
      expectedPipelineDelta: null,
      liveRevenueVelocity: null,
      previousLiveRevenueVelocity: null,
      velocityDelta: null,
      velocityDeltaPercent: null,
      averageRemainingDays: null,
      realizedWonAmountInPeriod: 0,
      wonDealsInPeriod: 0,
      lostDealsInPeriod: 0,
      systemValueCreated: null,
      actionPointsDelta: null,
      systemValuePerActionPoint: null,
      realizedMoneyPerActionPoint: null,
      historicalMoneyPerActionPoint: null,
      estimatedFutureMoneyFromPeriodActions: null,
      actions: {
        totalCalls: 0,
        connectedCallsOverThirtySeconds: 0,
        meetingsCount: 0,
        conversionEventsCount: 0,
        createdTasks: 0,
        closedTasks: 0,
        weightedActionPoints: 0,
        weightedActionPointsPerDeal: null,
        weightedActionPointsPerWin: null
      },
      moneyPerAction: {
        moneyPerMeeting: null,
        moneyPerConnectedCallOverThirtySeconds: null,
        moneyPerConversionEvent: null,
        moneyPerClosedTask: null,
        moneyPerWeightedActionPoint: null,
        actionEfficiencyIndex: null
      },
      bottleneckStageId: null,
      bottleneckStageName: null,
      warnings: []
    },
    rows: [],
    formulaTooltips: [],
    warnings: []
  };
}

function createEmptyUnitEconomicsReport(): UnitEconomicsReport {
  return {
    range: {
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    },
    summary: {
      createdDeals: 0,
      wonDeals: 0,
      purchasedLeads: 0,
      attractionRevenue: 0,
      clubRevenue: 0,
      leadPurchaseCost: 0,
      eventCost: 0,
      ambassadorActivityCost: 0,
      ctuCertificateCost: 0,
      contractationCost: 0,
      otherVariableCost: 0,
      variableCosts: 0,
      contributionResult: 0,
      contributionMargin: null,
      aboveEbitdaCosts: 0,
      ebitda: 0,
      ebitdaMargin: null,
      belowEbitdaCosts: 0,
      netProfit: 0,
      netProfitMargin: null,
      attractionAverageCheck: null,
      clubAverageCheck: null,
      costPerWonDeal: null,
      costPerCreatedDeal: null
    },
    sourceQualityRows: [],
    managerRows: [],
    costRows: [],
    warnings: []
  };
}

function createEmptySourceCohortConversionReport(): SourceCohortConversionReport {
  return {
    range: {
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    },
    totalCreatedDeals: 0,
    totalWonDeals: 0,
    totalLostDeals: 0,
    totalOpenDeals: 0,
    winRate: 0,
    averageDaysToWin: 0,
    cohortMonths: [],
    rows: [],
    comparisons: []
  };
}

function createCorsTestApp(config?: {
  webOrigin?: string;
  apiAuthToken?: string;
}) {
  return (
    createApp as unknown as (
      service: Parameters<typeof createApp>[0],
      config?: {
        webOrigin?: string;
        apiAuthToken?: string;
      }
    ) => ReturnType<typeof createApp>
  )(
    {
      getDashboard: async () => ({
        salesSummary: {
          salesCount: 0,
          salesAmount: 0,
          averageSaleAmount: 0,
          attractionRevenueAmount: 0,
          averageAttractionRevenueAmount: 0,
          membershipAmount: 0,
          averageMembershipAmount: 0,
          pricingWarnings: [],
          newDealsCount: 0,
          conversionRate: 0
        },
        managerGroups: []
      }),
      getSourceQualityConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalWonDeals: 0,
        rows: [],
        stageSequence: []
      }),
      getSourceCohortConversionReport: async () =>
        createEmptySourceCohortConversionReport(),
      getActivitiesWorkloadReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalDealCount: 0,
        totalCreatedCount: 0,
        totalRescheduledCount: 0,
        totalClosedCount: 0,
        totalMeetingCount: 0,
        warnings: [],
        conversionEventRows: [],
        managerRows: [],
        comparisons: []
      }),
      getCallsWorkloadReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalDealCount: 0,
        totalCalls: 0,
        totalIncomingCalls: 0,
        totalMissedIncomingCalls: 0,
        totalOutgoingCalls: 0,
        totalOtherOutgoingCalls: 0,
        totalConnectedCalls: 0,
        totalFailedCalls: 0,
        totalCallsOverThirtySeconds: 0,
        totalConnectedCallsOverThirtySeconds: 0,
        allCalls: {
          totalCalls: 0,
          incomingCalls: 0,
          missedIncomingCalls: 0,
          outgoingCalls: 0,
          otherOutgoingCalls: 0,
          connectedCalls: 0,
          failedCalls: 0,
          callsOverThirtySeconds: 0,
          connectedCallsOverThirtySeconds: 0,
          averageDurationSeconds: 0
        },
        linkedDealCalls: {
          totalDealCount: 0,
          totalCalls: 0,
          incomingCalls: 0,
          missedIncomingCalls: 0,
          outgoingCalls: 0,
          otherOutgoingCalls: 0,
          connectedCalls: 0,
          failedCalls: 0,
          callsOverThirtySeconds: 0,
          connectedCallsOverThirtySeconds: 0,
          averageDurationSeconds: 0
        },
        warnings: [],
        managerRows: [],
        comparisons: []
      }),
      getCallAnalysisQueue: async () => ({
        range: {
          from: "2026-06-09T00:00:00.000+03:00",
          to: "2026-06-09T23:59:59.999+03:00"
        },
        totals: {
          total: 0,
          notAnalyzed: 0,
          analyzing: 0,
          ready: 0,
          error: 0,
          averageScore: null
        },
        items: []
      }),
      getCohortConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalClosedDeals: 0,
        totalWonDeals: 0,
        closureMonths: [],
        relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
        rows: [],
        breakdownRows: [],
        comparisons: []
      }),
      getTocFlowReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        businessDays: 0,
        warnings: [],
        estimatedGainPerDay: null,
        bottleneck: null,
        rows: [],
        comparisons: []
      }),
      getAcquisitionOutcomesReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalNewDeals: 0,
        totalLostDeals: 0,
        newDealsByManager: [],
        lostDealsByManager: [],
        lostStages: [],
        businessClubByManager: [],
        lostDealDetails: [],
        topLossReasons: []
      }),
      getTargetGroupConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalWonDeals: 0,
        rows: []
      }),
      getManagerActionOutcomeReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        warnings: [],
        rows: [],
        cohortMonths: [],
        cohortStatusRows: []
      }),
      getConversionEventsReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalInvitedCount: 0,
        totalConfirmedCount: 0,
        totalAttendedCount: 0,
        totalRefusedCount: 0,
        totalMissedCount: 0,
        attendanceRate: null,
        nextStepEligibleCount: 0,
        nextStepCount: 0,
        nextStepRate: null,
        warnings: [],
        rows: [],
        comparisons: []
      }),
      getRevenueVelocityReport: async () => createEmptyRevenueVelocityReport(),
      getUnitEconomicsReport: async () => createEmptyUnitEconomicsReport(),
      getUnitEconomicsSettings: async () => ({
        articles: [],
        rules: [],
        eventParticipantMode: "invited",
        updatedAt: null
      }),
      replaceUnitEconomicsCostRules: async (input: UnitEconomicsCostRulesInput) => ({
        articles: [],
        rules: input.rules,
        eventParticipantMode: input.eventParticipantMode ?? "invited",
        updatedAt: "2026-06-02T08:00:00.000Z"
      }),
      getSalesPlan: async () => ({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
        rows: [],
        updatedAt: null
      }),
      replaceSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getSalesPlanQuarter: async (input) => ({
        year: input.year,
        quarter: input.quarter,
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-06-30T23:59:59.999+03:00",
        months: [],
        rows: [],
        updatedAt: null
      }),
      replaceSalesPlanQuarter: async (input) => ({
        year: input.year,
        quarter: input.quarter,
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-06-30T23:59:59.999+03:00",
        months: [],
        rows: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getEffectiveSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: null
      }),
      getPricingSettings: async () => ({
        rules: [],
        updatedAt: null
      }),
      replacePricingSettings: async () => ({
        rules: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getMeta: async () => ({
        stageCatalog: [],
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: {
          deals: 0,
          activities: 0,
          calls: 0,
          stageHistory: 0
        },
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-09T00:00:00.000Z",
          lastSuccessfulSync: null,
          issues: [],
          warnings: []
        }
      }),
      performSync: async () => ({
        syncRunId: 1,
        leadsSynced: 0,
        dealsSynced: 0,
        mode: "delta" as const,
        modifiedAfter: null,
        finishedAt: "2026-04-09T00:00:00.000Z",
        snapshotBefore: {
          deals: 0,
          activities: 0,
          calls: 0,
          stageHistory: 0
        },
        snapshotAfter: {
          deals: 0,
          activities: 0,
          calls: 0,
          stageHistory: 0
        },
        changes: {
          deals: 0,
          dealBreakdown: {
            total: 0,
            created: 0,
            updated: 0,
            closed: 0,
            reopened: 0,
            unchanged: 0
          },
          activities: 0,
          calls: 0,
          stageHistory: 0,
          managers: 0
        },
        diagnostics: []
      }),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    },
    config
  );
}

describe("Bitrix transport security", () => {
  it("keeps the runtime method policy on a strict allowlist", () => {
    expect(ALLOWED_BITRIX_METHODS).toEqual([
      "crm.deal.list",
      "crm.status.list",
      "crm.deal.fields",
      "crm.type.list",
      "crm.item.fields",
      "crm.category.list",
      "crm.contact.list",
      "crm.contact.fields",
      "crm.item.list",
      "lists.element.get",
      "crm.stagehistory.list",
      "crm.activity.list",
      "crm.activity.binding.list",
      "disk.file.get",
      "voximplant.statistic.get",
      "user.get"
    ]);
    expect(() => assertAllowedBitrixMethod("crm.contact.get")).toThrow(
      /forbidden/i
    );
    expect(ALLOWED_BITRIX_METHODS).not.toContain("crm.contact.update");
    expect(ALLOWED_BITRIX_METHODS).not.toContain("crm.deal.update");
  });

  it("rejects selects that contain pii or wildcard fields while allowing the configured quality field", () => {
    expect(FORBIDDEN_FIELD_TOKENS).toContain("PHONE");
    expect(FORBIDDEN_FIELD_TOKENS).toContain("TITLE");
    expect(FORBIDDEN_FIELD_TOKENS).not.toContain("CONTACT_ID");
    expect(() => assertSafeSelectFields(["ID", "PHONE"])).toThrow(/PHONE/);
    expect(() => assertSafeSelectFields(["ID", "TITLE"])).toThrow(/TITLE/);
    expect(() => assertSafeSelectFields(["ID", "CONTACT_ID"])).not.toThrow();
    expect(() => assertSafeSelectFields(["ID", "*"])).toThrow(/\*/);
    expect(() =>
      assertSafeSelectFields(["ID", "UF_CRM_999"], ["UF_CRM_1730380390"])
    ).toThrow(/UF_CRM_999/);
    expect(() =>
      assertSafeSelectFields(
        ["ID", "UF_CRM_1730380390", "UF_CRM_1647422744"],
        ["UF_CRM_1730380390", "UF_CRM_1647422744"]
      )
    ).not.toThrow();
    expect(() => assertSafeSelectFields(["ID", "DATE_CREATE"])).not.toThrow();
  });

  it("allows only approved call enrichment custom fields in read selects", () => {
    expect(() =>
      assertSafeSelectFields(
        ["ID", ...CALL_ENRICHMENT_CONTACT_FIELD_CODES],
        CALL_ENRICHMENT_CONTACT_FIELD_CODES
      )
    ).not.toThrow();
    expect(() =>
      assertSafeSelectFields(
        ["ID", "CONTACT_ID", "ASSIGNED_BY_ID", ...CALL_ENRICHMENT_DEAL_FIELD_CODES],
        CALL_ENRICHMENT_DEAL_FIELD_CODES
      )
    ).not.toThrow();
    expect(() =>
      assertSafeSelectFields(
        ["ID", ...CALL_ENRICHMENT_DEAL_FIELD_CODES, "UF_CRM_UNAPPROVED"],
        CALL_ENRICHMENT_DEAL_FIELD_CODES
      )
    ).toThrow(/UF_CRM_UNAPPROVED/);
  });

  it("keeps call enrichment writes behind a separate allowlist", () => {
    expect(() =>
      assertAllowedCallEnrichmentWriteMethod("crm.contact.update")
    ).not.toThrow();
    expect(() =>
      assertAllowedCallEnrichmentWriteMethod("crm.deal.update")
    ).not.toThrow();
    expect(() =>
      assertAllowedCallEnrichmentWriteMethod("crm.item.update")
    ).toThrow(/forbidden/i);

    expect(() =>
      assertSafeCallEnrichmentWriteFields("contact", {
        UF_CRM_1647946359: "602"
      })
    ).not.toThrow();
    expect(() =>
      assertSafeCallEnrichmentWriteFields("deal", {
        UF_CRM_1766147164481: "Проект"
      })
    ).not.toThrow();
    expect(() =>
      assertSafeCallEnrichmentWriteFields("contact", {
        UF_CRM_1647946359: "602",
        UF_CRM_1766136147: 42
      })
    ).toThrow(/exactly one/i);
    expect(() =>
      assertSafeCallEnrichmentWriteFields("contact", {
        UF_CRM_1649418456: "Москва"
      })
    ).toThrow(/not writable/i);
    expect(() =>
      assertSafeCallEnrichmentWriteFields("deal", {
        UF_CRM_1647946359: "602"
      })
    ).toThrow(/belongs to contact/);
    expect(() =>
      assertSafeCallEnrichmentWriteFields("contact", {
        UF_CRM_1766147164481: "Проект"
      })
    ).toThrow(/belongs to deal/);

    for (const field of [
      "PHONE",
      "EMAIL",
      "NAME",
      "COMMENTS",
      "CONTACT_IDS",
      "COMPANY_ID"
    ]) {
      expect(() =>
        assertSafeCallEnrichmentWriteFields("contact", { [field]: "x" })
      ).toThrow(new RegExp(field));
    }
  });

  it("redacts the secret part of the webhook url before logging", () => {
    expect(
      redactWebhookUrl("https://portal.bitrix24.ru/rest/1/secrettoken/crm.deal.list")
    ).toBe("https://portal.bitrix24.ru/rest/1/[REDACTED]/crm.deal.list");
  });

  it("uses a configured WEB_ORIGIN allowlist instead of wildcard CORS", async () => {
    const app = createCorsTestApp({
      webOrigin: "http://localhost:5173"
    });

    await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173")
      .expect(200)
      .expect((response) => {
        expect(response.headers["access-control-allow-origin"]).toBe(
          "http://localhost:5173"
        );
        expect(response.headers["access-control-allow-origin"]).not.toBe("*");
      });

    await request(app)
      .get("/api/health")
      .set("Origin", "http://127.0.0.1:5173")
      .expect(200)
      .expect((response) => {
        expect(response.headers["access-control-allow-origin"]).toBe(
          "http://127.0.0.1:5173"
        );
      });

    await request(app)
      .get("/api/health")
      .set("Origin", "http://127.0.0.1:5174")
      .expect(200)
      .expect((response) => {
        expect(response.headers["access-control-allow-origin"]).toBe(
          "http://127.0.0.1:5174"
        );
      });

    await request(app)
      .get("/api/health")
      .set("Origin", "https://evil.example")
      .expect(200)
      .expect((response) => {
        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      });
  });

  it("sets browser security headers on API responses", async () => {
    const app = createCorsTestApp({
      webOrigin: "https://dash.example.com"
    });

    await request(app)
      .get("/api/health")
      .expect(200)
      .expect((response) => {
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["x-frame-options"]).toBe("DENY");
        expect(response.headers["referrer-policy"]).toBe("no-referrer");
        expect(response.headers["permissions-policy"]).toContain("camera=()");
        expect(response.headers["content-security-policy"]).toContain(
          "default-src 'self'"
        );
        expect(response.headers["content-security-policy"]).toContain(
          `script-src 'self' ${getPlaybookInlineScriptHash()}`
        );
      });
  });
});
