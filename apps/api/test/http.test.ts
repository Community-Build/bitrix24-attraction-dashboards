import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  AttractionOntologyResponse,
  CallsWorkloadReport,
  CohortConversionReport,
  ConversionEventsReport,
  DashboardData,
  LeadgenFunnelReport,
  ManagerActionOutcomeReport,
  ModuleCapabilityManifest,
  ModuleCapabilityManifestListResponse,
  ModuleCapabilityManifestResponse,
  OperationalDashboardReport,
  RevenueVelocityReport,
  SalesPlanData,
  SalesPlanQuarterData,
  SourceCohortConversionReport,
  SourceQualityConversionReport,
  StageCatalogEntry,
  TargetGroupConversionReport,
  TocFlowReport,
  UnitEconomicsCostRulesInput,
  UnitEconomicsReport
} from "@bitrix24-reporting/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { NO_ATTRACTION_MANAGER_MATCH_ID } from "../src/domain/attraction-managers";
import { SourceCohortConversionStageNotFoundError } from "../src/domain/source-cohort-conversion-stage-drilldown";
import { createApp } from "../src/server/app";
import { MessengerMessageCollectionError } from "../src/server/messenger-message-collection";
import type { ModuleCapabilityAdapter } from "../src/server/module-capabilities";

type AppConfig = NonNullable<Parameters<typeof createApp>[1]>;
type AuthSession = NonNullable<
  Awaited<ReturnType<NonNullable<AppConfig["auth"]>["getSession"]>>
>;

function createAuthenticatedModule(input: {
  id: string;
  name: string;
}): AuthSession["user"]["modules"][number] {
  return {
    id: input.id,
    slug: input.id,
    name: input.name,
    role: "employee",
    permissions: [],
    defaultManagerId: null,
    bitrixCategoryId: input.id === "leadgen" ? "28" : "10",
    paperclipCompanyId: null,
    paperclipProjectId: null,
    paperclipGoalId: null,
    paperclipTriageAgentId: null
  };
}

function createStaticAuthService(
  session: AuthSession | null
): NonNullable<AppConfig["auth"]> {
  return {
    cookieName: "b24dash_session",
    secureCookie: false,
    ttlMs: 43_200_000,
    async login() {
      throw new Error("login is not used in this test");
    },
    async getSession(sessionToken: string) {
      return sessionToken === "valid-session" ? session : null;
    },
    async issueCsrfToken() {
      return "csrf-token";
    },
    verifyCsrfToken() {
      return true;
    },
    async logout() {
      // No-op test auth service.
    }
  };
}

function createTestSession(input: {
  isSuperAdmin?: boolean;
  modules: AuthSession["user"]["modules"];
}): AuthSession {
  return {
    user: {
      id: 1,
      login: "module-user@example.com",
      firstName: null,
      lastName: null,
      role: "admin",
      isSuperAdmin: input.isSuperAdmin ?? false,
      modules: input.modules
    },
    sessionToken: "valid-session",
    tokenHash: "token-hash",
    csrfTokenHash: "csrf-token-hash",
    expiresAt: "2026-06-14T23:59:59.999Z"
  };
}

function createLeadgenModuleService(): Partial<Parameters<typeof createApp>[0]> {
  return {
    getLeadgenFunnelReport: async () => createEmptyLeadgenFunnelReport(),
    getActivitiesWorkloadReport: async () =>
      createEmptyActivitiesWorkloadReport(),
    getCallsWorkloadReport: async () => createEmptyCallsWorkloadReport()
  };
}

const operationalThresholdSettingsService = {
  getOperationalThresholdSettings: async () => ({
    stageAging: [],
    noCallsMaxDays: 7,
    noActivityMaxDays: 5,
    slaBusinessHours: {
      sla1: 24,
      sla2: 5,
      sla3: 72
    },
    updatedAt: null
  }),
  replaceOperationalThresholdSettings: async (input) => ({
    stageAging: input.stageAging.map((threshold) => ({
      stageId: threshold.stageId,
      stageName: threshold.stageId,
      maxDaysOnStage: threshold.maxDaysOnStage
    })),
    noCallsMaxDays: input.noCallsMaxDays,
    noActivityMaxDays: input.noActivityMaxDays,
    slaBusinessHours: input.slaBusinessHours,
    updatedAt: "2026-04-10T12:00:00.000Z"
  })
} satisfies Pick<
  Parameters<typeof createApp>[0],
  "getOperationalThresholdSettings" | "replaceOperationalThresholdSettings"
>;

function createCustomModuleManifest(): ModuleCapabilityManifest {
  return {
    moduleId: "custom-module",
    displayName: "Custom module",
    ontologyRef: "docs/modules/custom-module/MODULE_ONTOLOGY.md",
    reports: [
      {
        id: "activation-overview",
        title: "Activation overview",
        description: "Metadata-only custom activation report descriptor.",
        route: "/api/modules/custom-module/reports/activation-overview",
        inputSchemaId: "custom-module.activation-overview.input.v1",
        outputSchemaId: "custom-module.activation-overview.output.v1",
        status: "available",
        agentReadable: true
      }
    ],
    safeReadModels: [],
    capabilities: ["report"],
    dataPolicy: {
      allowedScopes: ["custom-module:activation-summary"],
      forbiddenFields: ["contact.email", "contact.phone", "rawBitrixPayload"],
      piiExcluded: true,
      rawPayloadAccess: false,
      directBitrixAccess: false,
      arbitrarySqliteAccess: false
    }
  };
}

const emptyCallPopulation = {
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
};

const emptyLinkedDealCalls = {
  ...emptyCallPopulation,
  totalDealCount: 0
};

const emptySnapshotStats = {
  deals: 0,
  activities: 0,
  calls: 0,
  stageHistory: 0
};

const emptyDealBreakdown = {
  total: 0,
  created: 0,
  updated: 0,
  closed: 0,
  reopened: 0,
  unchanged: 0
};

const emptySyncChanges = {
  deals: 0,
  dealBreakdown: emptyDealBreakdown,
  activities: 0,
  calls: 0,
  stageHistory: 0,
  managers: 0
};

const emptyAttractionOntology: AttractionOntologyResponse = {
  moduleKey: "attraction",
  title: "Онтология Привлечения",
  governance: {
    decisionRole: "Технолог бизнес-процессов",
    decisionUnit: "Центр Технологизации"
  },
  lastReviewedAt: "2026-05-29",
  sources: [],
  concepts: [],
  transitions: [],
  reportBindings: [],
  drift: []
};

const emptyAttractionOntologySourceDocument = {
  moduleKey: "attraction" as const,
  source: {
    id: "module_ontology",
    label: "MODULE_ONTOLOGY.md",
    kind: "markdown" as const,
    href: "docs/modules/attraction/MODULE_ONTOLOGY.md",
    canonicality: "canonical" as const
  },
  content: "# Онтология модуля «Привлечение»"
};

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

function createEmptyLeadgenFunnelReport(): LeadgenFunnelReport {
  return {
    range: {
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-31T23:59:59.999Z"
    },
    totalDeals: 0,
    createdDeals: 0,
    activeDeals: 0,
    closedDeals: 0,
    stageRows: [],
    sourceRows: [],
    utmRows: [],
    managerRows: [],
    reasonRows: [],
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
    totalReturnedDeals: 0,
    totalOpenDeals: 0,
    winRate: 0,
    averageDaysToWin: 0,
    cohortMonths: [],
    rows: [],
    trajectoryStatus: "unavailable",
    trajectoryUnavailableReason:
      "Траектория конверсии не рассчитана для этого ответа.",
    comparisons: []
  };
}

function createSyncSummary(
  overrides: Partial<{
    syncRunId: number;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
    modifiedAfter: string | null;
    finishedAt: string;
  }> = {}
) {
  return {
    syncRunId: 1,
    leadsSynced: 0,
    dealsSynced: 0,
    mode: "delta" as const,
    modifiedAfter: null,
    finishedAt: "2026-04-09T00:00:00.000Z",
    snapshotBefore: emptySnapshotStats,
    snapshotAfter: emptySnapshotStats,
    changes: emptySyncChanges,
    diagnostics: [],
    ...overrides
  };
}

function createEmptyActivitiesWorkloadReport(
  range = {
    from: "2026-06-04T00:00:00.000+03:00",
    to: "2026-06-04T20:00:00.000+03:00"
  }
): ActivitiesWorkloadReport {
  return {
    range,
    totalDealCount: 0,
    totalCreatedCount: 0,
    totalRescheduledCount: 0,
    totalClosedCount: 0,
    totalMeetingCount: 0,
    warnings: [],
    conversionEventRows: [],
    managerRows: [],
    comparisons: []
  };
}

function createEmptyOperationalDashboardReport(
  range = {
    from: "2026-04-01T00:00:00.000Z",
    to: "2026-04-30T23:59:59.999Z"
  }
): OperationalDashboardReport {
  return {
    range,
    generatedAt: "2026-04-30T12:00:00.000Z",
    currentScope: {
      status: "ready",
      reconciledAt: "2026-04-30T12:00:00.000Z",
      dealCount: 0
    },
    createdDeals: 0,
    meetingsHeld: {
      total: 0,
      bySlot: [
        { slotIndex: 1, slotLabel: "Встреча 1", count: 0 },
        { slotIndex: 2, slotLabel: "Встреча 2", count: 0 },
        { slotIndex: 3, slotLabel: "Встреча 3", count: 0 }
      ]
    },
    sales: {
      total: 0,
      byClub: []
    },
    lostDeals: 0,
    openDeals: 0,
    riskSummary: {
      total: 0,
      critical: 0,
      risk: 0,
      byRule: [],
      byStage: []
    },
    stageWip: [],
    sla: [],
    planned: {
      meetingsToday: [
        { slotIndex: 1, slotLabel: "Встреча 1", count: 0 },
        { slotIndex: 2, slotLabel: "Встреча 2", count: 0 },
        { slotIndex: 3, slotLabel: "Встреча 3", count: 0 }
      ],
      meetingsTomorrow: [
        { slotIndex: 1, slotLabel: "Встреча 1", count: 0 },
        { slotIndex: 2, slotLabel: "Встреча 2", count: 0 },
        { slotIndex: 3, slotLabel: "Встреча 3", count: 0 }
      ],
      tasksToday: 0,
      tasksTomorrow: 0
    },
    managers: [],
    risks: [],
    thresholdsUpdatedAt: null
  };
}

function createEmptyCallsWorkloadReport(
  range = {
    from: "2026-06-04T00:00:00.000+03:00",
    to: "2026-06-04T20:00:00.000+03:00"
  }
): CallsWorkloadReport {
  return {
    range,
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
    allCalls: emptyCallPopulation,
    linkedDealCalls: {
      ...emptyCallPopulation,
      totalDealCount: 0
    },
    warnings: [],
    managerRows: [],
    comparisons: []
  };
}

function createEmptyCallAnalysisQueue(
  range = {
    from: "2026-06-04T00:00:00.000+03:00",
    to: "2026-06-04T20:00:00.000+03:00"
  }
) {
  return {
    range,
    totals: {
      total: 0,
      notAnalyzed: 0,
      analyzing: 0,
      ready: 0,
      error: 0,
      averageScore: null
    },
    items: []
  };
}

function createEmptySalesPlanQuarter(input: { year: number; quarter: number }) {
  return {
    year: input.year,
    quarter: input.quarter,
    periodStart: "2026-04-01T00:00:00.000+03:00",
    periodEnd: "2026-06-30T23:59:59.999+03:00",
    months: [
      {
        month: "2026-04",
        label: "Апрель",
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00"
      },
      {
        month: "2026-05",
        label: "Май",
        periodStart: "2026-05-01T00:00:00.000+03:00",
        periodEnd: "2026-05-31T23:59:59.999+03:00"
      },
      {
        month: "2026-06",
        label: "Июнь",
        periodStart: "2026-06-01T00:00:00.000+03:00",
        periodEnd: "2026-06-30T23:59:59.999+03:00"
      }
    ],
    rows: [],
    updatedAt: null
  };
}

function createTestApp(
  serviceOverrides: Partial<Parameters<typeof createApp>[0]> = {},
  config?: {
    webOrigin?: string;
    apiAuthToken?: string;
    syncStreamHeartbeatMs?: number;
    attractionAutoSync?: {
      enabled?: boolean;
      intervalMs?: number;
      initialDelayMs?: number;
    };
    telegramActivityReport?: {
      enabled?: boolean;
      chatId?: string;
      chatIds?: string[];
      teamChatIds?: Record<string, string[]>;
      time?: string;
      timezone?: string;
      retryDelayMs?: number;
      sender?: {
        sendMessage(input: { chatId: string; text: string }): Promise<void>;
      };
    };
    telegramEnrichment?: AppConfig["telegramEnrichment"];
    telegramManagerRegistration?: AppConfig["telegramManagerRegistration"];
    callEnrichmentExpiry?: AppConfig["callEnrichmentExpiry"];
    modules?: Record<string, Partial<Parameters<typeof createApp>[0]>>;
    moduleCapabilityManifests?: ModuleCapabilityManifest[];
    moduleCapabilityAdapters?: ModuleCapabilityAdapter[];
    auth?: AppConfig["auth"];
    callAnalysis?: AppConfig["callAnalysis"];
    callEnrichmentIntake?: AppConfig["callEnrichmentIntake"];
    messengerMessages?: AppConfig["messengerMessages"];
    protoComments?: {
      getProtoComments(): Promise<{
        comments: unknown[];
        updatedAt: string | null;
      }>;
      replaceProtoComments(input: {
        comments: unknown[];
        updatedAt: string;
      }): Promise<{
        comments: unknown[];
        updatedAt: string | null;
      }>;
    };
  }
) {
  const service: Parameters<typeof createApp>[0] = {
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
    getSalesPlan: async () => ({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      rows: [],
      updatedAt: null
    }),
    replaceSalesPlan: async (input) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: input.rows.map((row) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        plannedDeals: row.plannedDeals,
        plannedAmount: row.plannedAmount,
        updatedAt: "2026-04-10T12:00:00.000Z"
      })),
      updatedAt: "2026-04-10T12:00:00.000Z"
    }),
    getSalesPlanQuarter: async (input) => ({
      year: input.year,
      quarter: input.quarter,
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-06-30T23:59:59.999+03:00",
      months: [
        {
          month: "2026-04",
          label: "Апрель",
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00"
        },
        {
          month: "2026-05",
          label: "Май",
          periodStart: "2026-05-01T00:00:00.000+03:00",
          periodEnd: "2026-05-31T23:59:59.999+03:00"
        },
        {
          month: "2026-06",
          label: "Июнь",
          periodStart: "2026-06-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00"
        }
      ],
      rows: [],
      updatedAt: null
    }),
    replaceSalesPlanQuarter: async (input) => ({
      year: input.year,
      quarter: input.quarter,
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-06-30T23:59:59.999+03:00",
      months: [
        {
          month: "2026-04",
          label: "Апрель",
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00"
        },
        {
          month: "2026-05",
          label: "Май",
          periodStart: "2026-05-01T00:00:00.000+03:00",
          periodEnd: "2026-05-31T23:59:59.999+03:00"
        },
        {
          month: "2026-06",
          label: "Июнь",
          periodStart: "2026-06-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00"
        }
      ],
      rows: input.rows.map((row) => ({
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        quarterPlannedDeals: row.quarterPlannedDeals,
        quarterPlannedAmount: row.quarterPlannedAmount,
        months: row.months.map((month) => ({
          month: month.month,
          periodStart: `${month.month}-01T00:00:00.000+03:00`,
          periodEnd: `${month.month}-30T23:59:59.999+03:00`,
          plannedDeals: month.plannedDeals,
          plannedAmount: month.plannedAmount,
          updatedAt: "2026-04-10T12:00:00.000Z"
        })),
        updatedAt: "2026-04-10T12:00:00.000Z"
      })),
      updatedAt: "2026-04-10T12:00:00.000Z"
    }),
    getEffectiveSalesPlan: async (input) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: [],
      updatedAt: null
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
    getOperationalDashboardReport: async () => createEmptyOperationalDashboardReport(),
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
      allCalls: emptyCallPopulation,
      linkedDealCalls: emptyLinkedDealCalls,
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
    getRevenueVelocityReport: async () => createEmptyRevenueVelocityReport(),
    getUnitEconomicsReport: async () => createEmptyUnitEconomicsReport(),
    getUnitEconomicsSettings: async () => ({
      articles: [
        {
          id: "lead_purchase",
          name: "Закупка лидов",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_lead",
          enabled: true,
          sortOrder: 10,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          updatedAt: null
        },
        {
          id: "contractation",
          name: "Контрактация",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_contract",
          enabled: true,
          sortOrder: 50,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          updatedAt: null
        }
      ],
      rules: [
        {
          id: "contractation-per-won-default",
          articleId: "contractation",
          pnlLevel: "variable_contribution",
          costBehavior: "variable",
          calculationMethod: "amount_per_contract",
          unitPrice: 5_000,
          percent: null,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        }
      ],
      eventParticipantMode: "invited",
      updatedAt: null
    }),
    replaceUnitEconomicsCostRules: async (input: UnitEconomicsCostRulesInput) => ({
      articles: [],
      rules: input.rules,
      eventParticipantMode: input.eventParticipantMode ?? "invited",
      updatedAt: "2026-06-02T08:00:00.000Z"
    }),
    getPricingSettings: async () => ({
      rules: [
        {
          id: "clubfirst-federal",
          customerLabel: "ClubFirst Russia / One",
          tariffLabel: "Федеральный",
          attractionRevenueAmount: 300000,
          enabled: true,
          sortOrder: 10,
          updatedAt: null
        }
      ],
      updatedAt: null
    }),
    replacePricingSettings: async (input) => ({
      rules: input.rules.map((rule, index) => ({
        id: rule.id,
        customerLabel: rule.customerLabel,
        tariffLabel: rule.tariffLabel,
        attractionRevenueAmount: rule.attractionRevenueAmount,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder ?? index * 10,
        updatedAt: "2026-04-29T10:00:00.000Z"
      })),
      updatedAt: "2026-04-29T10:00:00.000Z"
    }),
    getOperationalThresholdSettings: async () => ({
      stageAging: [
        {
          stageId: "C10:NEW",
          stageName: "База входящая",
          maxDaysOnStage: 1
        },
        {
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          maxDaysOnStage: 3
        }
      ],
      noCallsMaxDays: 7,
      noActivityMaxDays: 5,
      slaBusinessHours: {
        sla1: 24,
        sla2: 5,
        sla3: 72
      },
      updatedAt: null
    }),
    replaceOperationalThresholdSettings: async (input) => ({
      stageAging: [
        {
          stageId: "C10:NEW",
          stageName: "База входящая",
          maxDaysOnStage:
            input.stageAging.find((threshold) => threshold.stageId === "C10:NEW")
              ?.maxDaysOnStage ?? 1
        },
        {
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          maxDaysOnStage:
            input.stageAging.find(
              (threshold) => threshold.stageId === "C10:PREPARATION"
            )?.maxDaysOnStage ?? 3
        }
      ],
      noCallsMaxDays: input.noCallsMaxDays,
      noActivityMaxDays: input.noActivityMaxDays,
      slaBusinessHours: input.slaBusinessHours,
      updatedAt: "2026-04-29T10:00:00.000Z"
    }),
    getAttractionOntology: async () => emptyAttractionOntology,
    getAttractionOntologySourceDocument: async () =>
      emptyAttractionOntologySourceDocument,
    getConversionEventTypeSettings: async () => ({
      options: [
        {
          id: "128",
          title: "Гостевая встреча",
          categoryId: null,
          stageId: null,
          selectedForPlannedInventory: true
        }
      ],
      settings: [
        {
          moduleKey: "attraction",
          eventTypeId: "128",
          eventTypeLabel: "Гостевая встреча",
          enabled: true,
          updatedAt: "2026-04-29T10:00:00.000Z"
        }
      ]
    }),
    replaceConversionEventTypeSettings: async (input) => ({
      options: input.eventTypeIds.map((id) => ({
        id,
        title: id,
        categoryId: null,
        stageId: null,
        selectedForPlannedInventory: true
      })),
      settings: input.eventTypeIds.map((id) => ({
        moduleKey: "attraction",
        eventTypeId: id,
        eventTypeLabel: id,
        enabled: true,
        updatedAt: "2026-04-29T10:00:00.000Z"
      }))
    }),
    getMeta: async () => ({
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [],
      wonStageIds: [],
      defaultPeriodDays: 30,
      lastSync: null,
      snapshotStats: emptySnapshotStats,
      syncHealth: {
        status: "ready" as const,
        blocking: false,
        checkedAt: "2026-04-09T00:00:00.000Z",
        lastSuccessfulSync: null,
        issues: [],
        warnings: []
      }
    }),
    getSyncRuns: async () => ({
      runs: []
    }),
    performSync: async () => createSyncSummary(),
    updateWonStages: async (stageIds: string[]) => ({
      wonStageIds: stageIds
    }),
    ...serviceOverrides
  };

  return (
    createApp as unknown as (
      service: Parameters<typeof createApp>[0],
      config?: {
        webOrigin?: string;
        apiAuthToken?: string;
        syncStreamHeartbeatMs?: number;
        attractionAutoSync?: {
          enabled?: boolean;
          intervalMs?: number;
          initialDelayMs?: number;
        };
        telegramActivityReport?: {
          enabled?: boolean;
          chatId?: string;
          chatIds?: string[];
          teamChatIds?: Record<string, string[]>;
          time?: string;
          timezone?: string;
          retryDelayMs?: number;
          sender?: {
            sendMessage(input: { chatId: string; text: string }): Promise<void>;
          };
        };
        telegramEnrichment?: AppConfig["telegramEnrichment"];
        telegramManagerRegistration?: AppConfig["telegramManagerRegistration"];
        callEnrichmentExpiry?: AppConfig["callEnrichmentExpiry"];
        modules?: Record<string, Partial<Parameters<typeof createApp>[0]>>;
        moduleCapabilityManifests?: ModuleCapabilityManifest[];
        moduleCapabilityAdapters?: ModuleCapabilityAdapter[];
        auth?: AppConfig["auth"];
        protoComments?: {
          getProtoComments(): Promise<{
            comments: unknown[];
            updatedAt: string | null;
          }>;
          replaceProtoComments(input: {
            comments: unknown[];
            updatedAt: string;
          }): Promise<{
            comments: unknown[];
            updatedAt: string | null;
          }>;
        };
        callAnalysis?: AppConfig["callAnalysis"];
        callEnrichmentIntake?: AppConfig["callEnrichmentIntake"];
        messengerMessages?: AppConfig["messengerMessages"];
      }
    ) => ReturnType<typeof createApp>
  )(service, config);
}

describe("createApp", () => {
  it("returns a no-store safe messenger summary without raw message text", async () => {
    const rawMessageText = "Секретный полный текст сообщения";
    const app = createTestApp(
      {},
      {
        messengerMessages: {
          enabled: true,
          service: {
            getManagerMessageSummary: async (input) => {
              expect(input).toEqual({
                managerId: "78",
                from: "2026-08-01T00:00:00+03:00",
                to: "2026-08-03T23:59:59+03:00"
              });
              void rawMessageText;
              return {
                managerId: "78",
                managerName: "Егоров Андрей",
                from: input.from,
                to: input.to,
                currentDeals: 10,
                sessions: 2,
                uniqueDialogs: 2,
                dealsWithMessages: 2,
                messages: 5,
                messagesWithText: 4,
                attachmentOnlyMessages: 1,
                systemMessagesExcluded: 3,
                senderKinds: {
                  connector: 5,
                  operator: 0,
                  unknown: 0
                },
                channels: [
                  {
                    key: "wz_telegram",
                    label: "WAZZUP: Telegram",
                    messages: 5
                  }
                ],
                directionAvailable: false as const,
                personalAuthorAvailable: false as const
              };
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/messenger-messages/collect")
      .send({
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
      .expect("Cache-Control", "no-store")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          summary: expect.objectContaining({
            managerId: "78",
            messages: 5,
            messagesWithText: 4
          })
        });
        expect(JSON.stringify(body)).not.toContain(rawMessageText);
      });
  });

  it("returns a no-store messenger report summary for the selected managers", async () => {
    const rawMessageText = "Этот текст не должен попасть в итог";
    const app = createTestApp(
      {},
      {
        messengerMessages: {
          enabled: true,
          service: {
            getManagerMessageSummary: async () => {
              throw new Error("must not be called");
            },
            getMessengerReportSummary: async (input) => {
              expect(input).toEqual({
                managerIds: ["78", "11234"],
                from: "2026-08-01T00:00:00+03:00",
                to: "2026-08-03T23:59:59+03:00"
              });
              void rawMessageText;
              return {
                from: input.from,
                to: input.to,
                totalMessages: 9,
                messagesWithText: 8,
                attachmentOnlyMessages: 1,
                uniqueDialogs: 4,
                dealsWithMessages: 3,
                systemMessagesExcluded: 2,
                managerRows: [],
                directionAvailable: false as const,
                personalAuthorAvailable: false as const
              };
            },
            getManagerMessageDetails: async () => {
              throw new Error("must not be called");
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/messenger-messages/summary")
      .send({
        managerIds: ["78", "11234"],
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
      .expect("Cache-Control", "no-store")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          summary: expect.objectContaining({
            totalMessages: 9,
            uniqueDialogs: 4,
            dealsWithMessages: 3
          })
        });
        expect(JSON.stringify(body)).not.toContain(rawMessageText);
      });
  });

  it("returns bounded raw messenger details only through the no-store reader route", async () => {
    const app = createTestApp(
      {},
      {
        messengerMessages: {
          enabled: true,
          service: {
            getManagerMessageSummary: async () => {
              throw new Error("must not be called");
            },
            getMessengerReportSummary: async () => {
              throw new Error("must not be called");
            },
            getManagerMessageDetails: async (input) => {
              expect(input).toEqual({
                managerId: "78",
                from: "2026-08-01T00:00:00+03:00",
                to: "2026-08-03T23:59:59+03:00",
                limit: 250
              });
              return {
                managerId: input.managerId,
                managerName: "Егоров Андрей",
                from: input.from,
                to: input.to,
                totalMessages: 1,
                returnedMessages: 1,
                truncated: false,
                directionAvailable: false as const,
                personalAuthorAvailable: false as const,
                messages: [
                  {
                    id: "501",
                    sessionId: "441",
                    dealId: "1001",
                    occurredAt: "2026-08-03T10:15:00+03:00",
                    channel: {
                      key: "wz_telegram",
                      label: "WAZZUP: Telegram"
                    },
                    senderKind: "connector" as const,
                    direction: "unknown" as const,
                    text: "Полный текст сообщения",
                    hasAttachment: false
                  }
                ]
              };
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/messenger-messages/read")
      .send({
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00",
        limit: 250
      })
      .expect("Cache-Control", "no-store")
      .expect(200, {
        details: {
          managerId: "78",
          managerName: "Егоров Андрей",
          from: "2026-08-01T00:00:00+03:00",
          to: "2026-08-03T23:59:59+03:00",
          totalMessages: 1,
          returnedMessages: 1,
          truncated: false,
          directionAvailable: false,
          personalAuthorAvailable: false,
          messages: [
            {
              id: "501",
              sessionId: "441",
              dealId: "1001",
              occurredAt: "2026-08-03T10:15:00+03:00",
              channel: {
                key: "wz_telegram",
                label: "WAZZUP: Telegram"
              },
              senderKind: "connector",
              direction: "unknown",
              text: "Полный текст сообщения",
              hasAttachment: false
            }
          ]
        }
      });
  });

  it("denies messenger report summary and reader to attraction employees", async () => {
    let messageReads = 0;
    const auth = createStaticAuthService(
      createTestSession({
        modules: [
          createAuthenticatedModule({ id: "attraction", name: "Привлечение" })
        ]
      })
    );
    const app = createTestApp(
      {},
      {
        auth,
        messengerMessages: {
          enabled: true,
          service: {
            getManagerMessageSummary: async () => {
              throw new Error("must not be called");
            },
            getMessengerReportSummary: async () => {
              messageReads += 1;
              throw new Error("must not be called");
            },
            getManagerMessageDetails: async () => {
              messageReads += 1;
              throw new Error("must not be called");
            }
          }
        }
      }
    );

    const authenticatedRequest = (path: string) =>
      request(app)
        .post(path)
        .set("Cookie", "b24dash_session=valid-session")
        .set("X-CSRF-Token", "csrf-token");

    await authenticatedRequest("/api/messenger-messages/summary")
      .send({
        managerIds: ["78"],
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
      .expect("Cache-Control", "no-store")
      .expect(403, { error: "FORBIDDEN", code: "FORBIDDEN" });
    await authenticatedRequest("/api/messenger-messages/read")
      .send({
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
      .expect("Cache-Control", "no-store")
      .expect(403, { error: "FORBIDDEN", code: "FORBIDDEN" });
    expect(messageReads).toBe(0);
  });

  it("denies messenger collection to attraction employees before reading messages", async () => {
    let collectionCalls = 0;
    const auth = createStaticAuthService(
      createTestSession({
        modules: [
          createAuthenticatedModule({ id: "attraction", name: "Привлечение" })
        ]
      })
    );
    const app = createTestApp(
      {},
      {
        auth,
        messengerMessages: {
          enabled: true,
          service: {
            getManagerMessageSummary: async () => {
              collectionCalls += 1;
              throw new Error("must not be called");
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/messenger-messages/collect")
      .set("Cookie", "b24dash_session=valid-session")
      .set("X-CSRF-Token", "csrf-token")
      .send({
        managerId: "78",
        from: "2026-08-01T00:00:00+03:00",
        to: "2026-08-03T23:59:59+03:00"
      })
      .expect("Cache-Control", "no-store")
      .expect(403, {
        error: "FORBIDDEN",
        code: "FORBIDDEN"
      });
    expect(collectionCalls).toBe(0);
  });

  it("returns a stable validation error for an invalid messenger collection range", async () => {
    const app = createTestApp(
      {},
      {
        messengerMessages: {
          enabled: true,
          service: {
            getManagerMessageSummary: async () => {
              throw new MessengerMessageCollectionError(
                "INVALID_RANGE",
                "internal range detail"
              );
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/messenger-messages/collect")
      .send({
        managerId: "78",
        from: "2026-07-01T00:00:00+03:00",
        to: "2026-08-02T00:00:00+03:00"
      })
      .expect(400, {
        error: "INVALID_RANGE",
        code: "INVALID_RANGE"
      });
  });

  it("returns metadata-only capability manifests for existing modules", async () => {
    const app = createTestApp();

    await request(app)
      .get("/api/modules/capabilities")
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as ModuleCapabilityManifestListResponse;
        expect(responseBody.manifests.map((manifest) => manifest.moduleId)).toEqual([
          "attraction",
          "leadgen"
        ]);
        const attraction = responseBody.manifests.find(
          (manifest) => manifest.moduleId === "attraction"
        );
        const leadgen = responseBody.manifests.find(
          (manifest) => manifest.moduleId === "leadgen"
        );
        expect(attraction?.reports.every((report) => report.status === "available")).toBe(
          true
        );
        expect(leadgen?.reports.every((report) => report.status === "planned")).toBe(
          true
        );
        expect(
          responseBody.manifests.every((manifest) =>
            manifest.dataPolicy.piiExcluded &&
            manifest.dataPolicy.rawPayloadAccess === false &&
            manifest.dataPolicy.directBitrixAccess === false &&
            manifest.dataPolicy.arbitrarySqliteAccess === false
          )
        ).toBe(true);
        expect(JSON.stringify(body)).not.toMatch(
          /SqliteRepository|BITRIX24_WEBHOOK|sqliteUrl|webhook/i
        );
      });

    await request(app)
      .get("/api/modules/leadgen/capabilities")
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as ModuleCapabilityManifestResponse;
        expect(responseBody.manifest.moduleId).toBe("leadgen");
        expect(responseBody.manifest.reports.map((report) => report.id)).toContain(
          "leadgen-funnel"
        );
        expect(
          responseBody.manifest.reports.every((report) => report.status === "planned")
        ).toBe(true);
      });
  });

  it("marks leadgen report capabilities available only when the leadgen module service is registered", async () => {
    const app = createTestApp(
      {},
      {
        modules: {
          leadgen: createLeadgenModuleService()
        }
      }
    );

    await request(app)
      .get("/api/modules/leadgen/capabilities")
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as ModuleCapabilityManifestResponse;
        expect(
          responseBody.manifest.reports.every((report) => report.status === "available")
        ).toBe(true);
      });
  });

  it("exposes a fake custom-module capability manifest without adding custom routes", async () => {
    const customModuleManifest = createCustomModuleManifest();
    const app = createTestApp(
      {},
      {
        moduleCapabilityManifests: [customModuleManifest]
      }
    );

    await request(app)
      .get("/api/modules/custom-module/capabilities")
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as ModuleCapabilityManifestResponse;
        expect(responseBody.manifest.moduleId).toBe("custom-module");
        expect(responseBody.manifest.reports).toEqual([
          expect.objectContaining({
            id: "activation-overview",
            status: "planned"
          })
        ]);
        expect(responseBody.manifest.dataPolicy.allowedScopes).not.toContain(
          "attraction:manager-whitelist"
        );
      });

    await request(app)
      .get("/api/modules/custom-module/reports/activation-overview")
      .expect(404);
  });

  it("keeps custom-module report capabilities available when its adapter lists a live route", async () => {
    const customModuleManifest = createCustomModuleManifest();
    const app = createTestApp(
      {},
      {
        moduleCapabilityAdapters: [
          {
            manifest: customModuleManifest,
            availableReportRoutes: [
              "/api/modules/custom-module/reports/activation-overview"
            ]
          }
        ]
      }
    );

    await request(app)
      .get("/api/modules/custom-module/capabilities")
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as ModuleCapabilityManifestResponse;
        expect(responseBody.manifest.reports).toEqual([
          expect.objectContaining({
            id: "activation-overview",
            status: "available"
          })
        ]);
      });
  });

  it("requires authentication before returning capability manifests when password auth is enabled", async () => {
    const app = createTestApp(
      {},
      {
        auth: createStaticAuthService(
          createTestSession({
            modules: [createAuthenticatedModule({ id: "leadgen", name: "Leadgen" })]
          })
        )
      }
    );

    await request(app)
      .get("/api/modules/capabilities")
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    await request(app)
      .get("/api/modules/leadgen/capabilities")
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    await request(app)
      .get("/api/reports/operational-dashboard")
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });
  });

  it("filters capability manifests to authenticated module access", async () => {
    const auth = createStaticAuthService(
      createTestSession({
        modules: [createAuthenticatedModule({ id: "leadgen", name: "Leadgen" })]
      })
    );
    const app = createTestApp({}, { auth });

    await request(app)
      .get("/api/modules/capabilities")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(200)
      .expect(({ body }) => {
        expect(body.manifests.map((manifest: { moduleId: string }) => manifest.moduleId)).toEqual([
          "leadgen"
        ]);
      });

    await request(app)
      .get("/api/modules/leadgen/capabilities")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(200);

    await request(app)
      .get("/api/modules/attraction/capabilities")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe("FORBIDDEN");
      });
  });

  it("allows super admins to list every module capability manifest", async () => {
    const auth = createStaticAuthService(
      createTestSession({
        isSuperAdmin: true,
        modules: []
      })
    );
    const app = createTestApp({}, { auth });

    await request(app)
      .get("/api/modules/capabilities")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(200)
      .expect(({ body }) => {
        expect(body.manifests.map((manifest: { moduleId: string }) => manifest.moduleId)).toEqual([
          "attraction",
          "leadgen"
        ]);
      });
  });

  it("does not serve leadgen reports from the attraction service when the leadgen module is not registered", async () => {
    const getLeadgenFunnelReport = vi
      .fn()
      .mockResolvedValue(createEmptyLeadgenFunnelReport());
    const app = createTestApp({ getLeadgenFunnelReport });

    await request(app)
      .get("/api/modules/leadgen/reports/funnel")
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });

    expect(getLeadgenFunnelReport).not.toHaveBeenCalled();
  });

  it("allows later module report routes to handle generic custom module ids", async () => {
    const app = createTestApp(
      {},
      {
        modules: {
          leadgen: {
            getLeadgenFunnelReport: async () => createEmptyLeadgenFunnelReport()
          }
        }
      }
    );
    app.get("/api/modules/:moduleId/reports/funnel", (request, response) => {
      if (request.params.moduleId !== "custom-module") {
        response.status(404).json({ code: "NOT_FOUND" });
        return;
      }

      response.json({ moduleId: request.params.moduleId });
    });

    await request(app)
      .get("/api/modules/custom-module/reports/funnel")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleId).toBe("custom-module");
      });
  });

  it("allows later module ontology routes to handle generic custom module ids", async () => {
    const app = createTestApp();
    app.get("/api/modules/:moduleId/ontology", (request, response) => {
      if (request.params.moduleId !== "custom-module") {
        response.status(404).json({ code: "NOT_FOUND" });
        return;
      }

      response.json({ moduleKey: request.params.moduleId });
    });

    await request(app)
      .get("/api/modules/custom-module/ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("custom-module");
      });
  });

  it("allows later module call routes to handle generic custom module ids", async () => {
    const app = createTestApp();
    app.get("/api/modules/:moduleId/calls/analysis-queue", (request, response) => {
      if (request.params.moduleId !== "custom-module") {
        response.status(404).json({ code: "NOT_FOUND" });
        return;
      }

      response.json({ moduleId: request.params.moduleId, items: [] });
    });

    await request(app)
      .get("/api/modules/custom-module/calls/analysis-queue")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleId).toBe("custom-module");
        expect(body.items).toEqual([]);
      });
  });

  it("keeps Telegram enrichment callbacks disabled by default", async () => {
    const app = createTestApp();

    await request(app)
      .post("/api/telegram/enrichment/callback")
      .send({
        callback_query: {
          id: "callback-1",
          data: "ce:approve-token"
        }
      })
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });
  });

  it("rejects Telegram enrichment callbacks without the configured shared secret", async () => {
    const approvalService = {
      sendProposalBatch: vi.fn().mockResolvedValue(undefined),
      sendFollowUpNote: vi.fn().mockResolvedValue(undefined),
      handleCallback: vi.fn().mockResolvedValue(undefined)
    };
    const app = createTestApp(
      {},
      {
        telegramEnrichment: {
          enabled: true,
          secret: "telegram-enrichment-secret-with-32-chars",
          approvalService
        }
      }
    );

    await request(app)
      .post("/api/telegram/enrichment/callback")
      .send({
        callback_query: {
          id: "callback-1",
          data: "ce:approve-token"
        }
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    await request(app)
      .post("/api/telegram/enrichment/callback")
      .set("X-Telegram-Bot-Api-Secret-Token", "wrong-secret")
      .send({
        callback_query: {
          id: "callback-1",
          data: "ce:approve-token"
        }
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    expect(approvalService.handleCallback).not.toHaveBeenCalled();
  });

  it("passes Telegram enrichment callback payloads with native Telegram fields to the approval service", async () => {
    const approvalService = {
      sendProposalBatch: vi.fn().mockResolvedValue(undefined),
      sendFollowUpNote: vi.fn().mockResolvedValue(undefined),
      handleCallback: vi.fn().mockResolvedValue(undefined)
    };
    const app = createTestApp(
      {},
      {
        telegramEnrichment: {
          enabled: true,
          secret: "telegram-enrichment-secret-with-32-chars",
          approvalService
        }
      }
    );

    await request(app)
      .post("/api/telegram/enrichment/callback")
      .set(
        "X-Telegram-Bot-Api-Secret-Token",
        "telegram-enrichment-secret-with-32-chars"
      )
      .send({
        update_id: 42,
        callback_query: {
          id: "callback-1",
          from: {
            id: 78,
            is_bot: false,
            first_name: "Manager"
          },
          chat_instance: "chat-instance",
          data: "ce:approve-token",
          message: {
            message_id: 123,
            text: "После звонка есть предложения для CRM.",
            chat: {
              id: "chat-78",
              type: "private"
            }
          }
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true });
      });

    expect(approvalService.handleCallback).toHaveBeenCalledWith({
      callbackQueryId: "callback-1",
      data: "ce:approve-token",
      chatId: "chat-78"
    });
  });

  it("passes Telegram start messages to manager registration", async () => {
    const registrationService = {
      handleMessage: vi.fn().mockResolvedValue("saved" as const)
    };
    const app = createTestApp(
      {},
      {
        telegramEnrichment: {
          enabled: false,
          secret: "telegram-webhook-secret-with-32-characters"
        },
        telegramManagerRegistration: {
          enabled: true,
          exportSecret: "telegram-export-secret-with-32-characters",
          service: registrationService,
          repository: {
            listActiveTelegramManagerRegistrations: vi
              .fn()
              .mockResolvedValue([])
          }
        }
      }
    );

    await request(app)
      .post("/api/telegram/enrichment/callback")
      .set(
        "X-Telegram-Bot-Api-Secret-Token",
        "telegram-webhook-secret-with-32-characters"
      )
      .send({
        update_id: 43,
        message: {
          message_id: 124,
          text: "/start r1.11234.signature",
          from: {
            id: 70001,
            username: "olga",
            first_name: "Ольга",
            last_name: "Ромашова"
          },
          chat: {
            id: 70001,
            type: "private"
          }
        }
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true });
      });

    expect(registrationService.handleMessage).toHaveBeenCalledWith({
      chatId: "70001",
      chatType: "private",
      userId: "70001",
      username: "olga",
      firstName: "Ольга",
      lastName: "Ромашова",
      text: "/start r1.11234.signature"
    });
  });

  it("exports active Telegram registrations only with the configured secret", async () => {
    const listActiveTelegramManagerRegistrations = vi.fn().mockResolvedValue([
      {
        telegramChatId: "70001",
        telegramUserId: "70001",
        bitrixUserId: "11234",
        telegramUsername: "olga",
        telegramFirstName: "Ольга",
        telegramLastName: "Ромашова",
        active: true,
        registeredAt: "2026-07-27T10:00:00.000Z",
        lastSeenAt: "2026-07-27T11:00:00.000Z"
      }
    ]);
    const app = createTestApp(
      {},
      {
        telegramEnrichment: {
          enabled: false,
          secret: "telegram-webhook-secret-with-32-characters"
        },
        telegramManagerRegistration: {
          enabled: true,
          exportSecret: "telegram-export-secret-with-32-characters",
          service: {
            handleMessage: vi.fn().mockResolvedValue("ignored" as const)
          },
          repository: {
            listActiveTelegramManagerRegistrations
          }
        }
      }
    );

    await request(app).get("/api/telegram/registrations").expect(401);

    await request(app)
      .get("/api/telegram/registrations")
      .set(
        "X-Telegram-Registration-Secret",
        "telegram-export-secret-with-32-characters"
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          registrations: [
            {
              bitrix_user_id: "11234",
              telegram_chat_id: "70001",
              telegram_username: "olga",
              active: true,
              last_seen_at: "2026-07-27T11:00:00.000Z"
            }
          ]
        });
      });

    expect(listActiveTelegramManagerRegistrations).toHaveBeenCalledTimes(1);
  });

  it("keeps Bitrix call event intake disabled by default", async () => {
    const queueAutomaticCallAnalysis = vi.fn();
    const app = createTestApp(
      {},
      {
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .send({ callId: "CALL1" })
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });

    expect(queueAutomaticCallAnalysis).not.toHaveBeenCalled();
  });

  it("rejects Bitrix call events without the configured shared secret", async () => {
    const queueAutomaticCallAnalysis = vi.fn();
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .send({ callId: "CALL1" })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    await request(app)
      .post("/api/calls/events/bitrix")
      .set("X-Bitrix-Call-Event-Secret", "wrong-secret")
      .send({ callId: "CALL1" })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe("UNAUTHORIZED");
      });

    expect(queueAutomaticCallAnalysis).not.toHaveBeenCalled();
  });

  it("accepts the native Bitrix outgoing webhook application token", async () => {
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "CALL1"
    });
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .send({
        event: "ONVOXIMPLANTCALLEND",
        data: {
          CALL_ID: "CALL1",
          PORTAL_USER_ID: "13020"
        },
        auth: {
          application_token: "bitrix-call-event-secret-with-32-characters"
        }
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "queued",
          callId: "CALL1"
        });
      });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queueAutomaticCallAnalysis).toHaveBeenCalledWith({
      callId: "CALL1",
      activityId: null,
      dealId: null,
      contactId: null,
      managerId: "13020",
      durationSeconds: null,
      occurredAt: null
    });
  });

  it("queues a normalized Bitrix call event for automatic analysis", async () => {
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "CALL1"
    });
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/modules/attraction/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({
        callId: " CALL1 ",
        activityId: "A1",
        dealId: "23841",
        contactId: "901",
        managerId: "7",
        durationSeconds: "45",
        occurredAt: "2026-06-28T12:00:00.000Z"
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "queued",
          callId: "CALL1"
        });
      });

    expect(queueAutomaticCallAnalysis).toHaveBeenCalledWith({
      callId: "CALL1",
      activityId: "A1",
      dealId: "23841",
      contactId: "901",
      managerId: "7",
      durationSeconds: 45,
      occurredAt: "2026-06-28T12:00:00.000Z"
    });
  });

  it("queues a native Bitrix call end webhook for automatic analysis", async () => {
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "externalCall.abc"
    });
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({
        event: "ONVOXIMPLANTCALLEND",
        event_handler_id: "1061",
        data: {
          CALL_ID: " externalCall.abc ",
          PORTAL_USER_ID: "13020",
          CALL_DURATION: "45",
          CALL_START_DATE: "2026-03-11T17:28:46+02:00",
          CRM_ACTIVITY_ID: "7953",
          PHONE_NUMBER: "+79990000000"
        },
        ts: "1773239624",
        auth: {
          access_token: "secret-token",
          domain: "example.bitrix24.ru"
        }
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "queued",
          callId: "externalCall.abc"
        });
      });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queueAutomaticCallAnalysis).toHaveBeenCalledWith({
      callId: "externalCall.abc",
      activityId: "7953",
      dealId: null,
      contactId: null,
      managerId: "13020",
      durationSeconds: 45,
      occurredAt: "2026-03-11T17:28:46+02:00"
    });
  });

  it("queues a form-encoded native Bitrix call end webhook for automatic analysis", async () => {
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "externalCall.form"
    });
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .type("form")
      .send({
        event: "ONVOXIMPLANTCALLEND",
        event_handler_id: "1061",
        "data[CALL_ID]": " externalCall.form ",
        "data[PORTAL_USER_ID]": "13020",
        "data[CALL_DURATION]": "58",
        "data[CALL_START_DATE]": "2026-07-02T15:48:32+03:00",
        "data[CRM_ACTIVITY_ID]": "525646",
        "auth[application_token]":
          "bitrix-call-event-secret-with-32-characters"
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "queued",
          callId: "externalCall.form"
        });
      });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queueAutomaticCallAnalysis).toHaveBeenCalledWith({
      callId: "externalCall.form",
      activityId: "525646",
      dealId: null,
      contactId: null,
      managerId: "13020",
      durationSeconds: 58,
      occurredAt: "2026-07-02T15:48:32+03:00"
    });
  });

  it("acknowledges non-end native Bitrix call webhooks without enqueueing analysis", async () => {
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "CALL1"
    });
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({
        event: "ONVOXIMPLANTCALLSTART",
        data: {
          CALL_ID: "CALL1",
          USER_ID: "13020"
        }
      })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "skipped",
          callId: "CALL1",
          reason: "UNSUPPORTED_BITRIX_CALL_EVENT"
        });
      });

    expect(queueAutomaticCallAnalysis).not.toHaveBeenCalled();
  });

  it("acknowledges Bitrix call events without waiting for automatic analysis", async () => {
    let finishAnalysis: ((value: { status: "queued"; callId: string }) => void) | null =
      null;
    const queueAutomaticCallAnalysis = vi.fn(
      () =>
        new Promise<{ status: "queued"; callId: string }>((resolve) => {
          finishAnalysis = resolve;
        })
    );
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    const pendingRequest = request(app)
      .post("/api/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({ callId: "CALL1" })
      .expect(202)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "queued",
          callId: "CALL1"
        });
      });
    const responsePromise = Promise.resolve(pendingRequest);

    const earlyResult = await Promise.race([
      responsePromise.then(() => "responded"),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 1000))
    ]);
    const resolveAnalysis = finishAnalysis as
      | ((value: { status: "queued"; callId: string }) => void)
      | null;
    resolveAnalysis?.({ status: "queued", callId: "CALL1" });
    await responsePromise;

    expect(earlyResult).toBe("responded");
  });

  it("redacts sensitive details from asynchronous Bitrix call intake errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const queueAutomaticCallAnalysis = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Bitrix failed at https://portal/rest/1/secret/crm.activity.get for user@example.com +7 999 111-22-33"
        )
      );
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    try {
      await request(app)
        .post("/api/calls/events/bitrix")
        .set(
          "X-Bitrix-Call-Event-Secret",
          "bitrix-call-event-secret-with-32-characters"
        )
        .send({ callId: "CALL1" })
        .expect(202);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consoleError).toHaveBeenCalledWith(
        "call_enrichment.intake.failed",
        expect.objectContaining({
          callId: "CALL1",
          error: expect.stringContaining("[url]")
        })
      );
      const loggedPayload = consoleError.mock.calls[0]?.[1] as
        | { error?: string }
        | undefined;
      expect(loggedPayload?.error).not.toContain("https://portal");
      expect(loggedPayload?.error).not.toContain("user@example.com");
      expect(loggedPayload?.error).not.toContain("+7 999 111-22-33");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("rejects Bitrix call event payloads with unknown fields", async () => {
    const queueAutomaticCallAnalysis = vi.fn();
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({ callId: "CALL1", phone: "+79990000000" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.code).toBe("VALIDATION_ERROR");
      });

    expect(queueAutomaticCallAnalysis).not.toHaveBeenCalled();
  });

  it("returns service unavailable when Bitrix call event intake has no automatic runner", async () => {
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn()
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({ callId: "CALL1" })
      .expect(503)
      .expect(({ body }) => {
        expect(body.code).toBe("CALL_ENRICHMENT_NOT_CONFIGURED");
      });
  });

  it("does not require browser auth or CSRF for Bitrix call events with the shared secret", async () => {
    const queueAutomaticCallAnalysis = vi.fn().mockResolvedValue({
      status: "queued",
      callId: "CALL1"
    });
    const app = createTestApp(
      {},
      {
        auth: createStaticAuthService(null),
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis
        }
      }
    );

    await request(app)
      .post("/api/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({ callId: "CALL1" })
      .expect(202);

    expect(queueAutomaticCallAnalysis).toHaveBeenCalledTimes(1);
  });

  it("allows later module call event routes to handle generic custom module ids", async () => {
    const app = createTestApp(
      {},
      {
        callEnrichmentIntake: {
          enabled: true,
          secret: "bitrix-call-event-secret-with-32-characters"
        },
        callAnalysis: {
          analyzeCall: vi.fn(),
          queueAutomaticCallAnalysis: vi.fn()
        }
      }
    );
    app.post("/api/modules/:moduleId/calls/events/bitrix", (request, response) => {
      response.json({ moduleId: request.params.moduleId });
    });

    await request(app)
      .post("/api/modules/custom-module/calls/events/bitrix")
      .set(
        "X-Bitrix-Call-Event-Secret",
        "bitrix-call-event-secret-with-32-characters"
      )
      .send({ callId: "CALL1" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleId).toBe("custom-module");
      });
  });

  it("returns the call analysis queue for the attraction module", async () => {
    const getCallAnalysisQueue = vi.fn().mockResolvedValue({
      range: {
        from: "2026-06-09T00:00:00.000+03:00",
        to: "2026-06-09T23:59:59.999+03:00"
      },
      totals: {
        total: 1,
        notAnalyzed: 0,
        analyzing: 0,
        ready: 1,
        error: 0,
        averageScore: 88
      },
      items: [
        {
          callId: "221930",
          crmActivityId: "A1",
          startedAt: "2026-06-09T08:40:00.000Z",
          managerId: "7",
          managerName: "Мария",
          callType: "outgoing_over_30",
          callTypeLabel: "Исх >30",
          durationSeconds: 318,
          dealId: "23841",
          dealSourceId: "LEADGEN_US",
          dealCurrentStageId: "C10:NEW",
          dealCurrentStageName: "Новая",
          stageAtCallId: "C10:QUALIFICATION",
          stageAtCallName: "Квалификация",
          analysisStatus: "ready",
          score: 88,
          promptVersion: "calls-v2",
          model: "google/gemini-3.5-flash",
          analyzedAt: "2026-06-09T12:00:30.000Z",
          updatedAt: "2026-06-09T12:00:31.000Z",
          errorCode: null,
          errorMessage: null,
          bitrixUrl: "https://example.bitrix24.ru/crm/deal/details/23841/"
        }
      ]
    });
    const app = createTestApp({
      getCallAnalysisQueue
    });

    await request(app)
      .get(
        "/api/modules/attraction/calls/analysis-queue?from=2026-06-09T00:00:00.000%2B03:00&to=2026-06-09T23:59:59.999%2B03:00&managerIds=7&sourceKeys=LEADGEN_US&stageIds=C10%3AQUALIFICATION&callTypes=outgoing_over_30&analysisStatuses=ready"
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          totals: {
            total: 1,
            ready: 1,
            averageScore: 88
          },
          items: [
            {
              callId: "221930",
              analysisStatus: "ready",
              score: 88,
              stageAtCallName: "Квалификация"
            }
          ]
        });
      });

    expect(getCallAnalysisQueue).toHaveBeenCalledWith({
      range: {
        from: "2026-06-09T00:00:00.000+03:00",
        to: "2026-06-09T23:59:59.999+03:00"
      },
      filters: {
        managerIds: ["7"],
        sourceKeys: ["LEADGEN_US"]
      },
      stageIds: ["C10:QUALIFICATION"],
      callTypes: ["outgoing_over_30"],
      analysisStatuses: ["ready"]
    });
  });

  it("runs manual call analysis for a selected attraction call", async () => {
    const analyzeCall = vi.fn().mockResolvedValue({
      status: "ready",
      reusedExistingResult: false,
      result: {
        callId: "CALL1",
        runId: "run-1",
        status: "ready",
        transcriptByRoles: [
          {
            role: "manager",
            start: 0,
            end: 2,
            text: "Добрый день."
          }
        ],
        fullTranscriptText: "Менеджер: Добрый день.",
        aiEvaluation: {
          score: 82,
          summary: "Есть диагностика."
        },
        rawAiEvaluation: {
          score: 82,
          summary: "Есть диагностика."
        },
        attributes: {
          dealId: "23841"
        },
        model: "google/gemini-2.5-flash",
        promptVersion: "calls-v1",
        analyzedAt: "2026-06-09T12:00:30.000Z",
        updatedAt: "2026-06-09T12:00:31.000Z"
      }
    });
    const app = createTestApp(
      {},
      {
        callAnalysis: {
          analyzeCall
        }
      }
    );

    await request(app)
      .post("/api/modules/attraction/calls/CALL1/analyze")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ready",
          result: {
            callId: "CALL1",
            aiEvaluation: {
              score: 82
            },
            rawAiEvaluation: {
              score: 82
            }
          }
        });
      });

    expect(analyzeCall).toHaveBeenCalledWith({
      callId: "CALL1",
      triggerMode: "manual"
    });
  });

  it("returns a saved analysis for a selected attraction call", async () => {
    const getCallAnalysisResult = vi.fn().mockResolvedValue({
      callId: "CALL1",
      runId: "run-1",
      status: "ready",
      transcriptByRoles: [
        {
          role: "manager",
          start: 0,
          end: 2,
          text: "Добрый день."
        }
      ],
      fullTranscriptText: "Менеджер: Добрый день.",
      aiEvaluation: {
        score: 82
      },
      rawAiEvaluation: {
        score: 82
      },
      attributes: {
        dealId: "23841"
      },
      model: "google/gemini-2.5-flash",
      promptVersion: "calls-v1",
      analyzedAt: "2026-06-09T12:00:30.000Z",
      updatedAt: "2026-06-09T12:00:31.000Z"
    });
    const app = createTestApp(
      {},
      {
        callAnalysis: {
          analyzeCall: vi.fn(),
          getCallAnalysisResult
        }
      }
    );

    await request(app)
      .get("/api/modules/attraction/calls/CALL1/analysis")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ready",
          result: {
            callId: "CALL1",
            aiEvaluation: {
              score: 82
            },
            rawAiEvaluation: {
              score: 82
            }
          }
        });
      });

    expect(getCallAnalysisResult).toHaveBeenCalledWith("CALL1");
  });

  it("returns a saved analysis from the reporting service when the runner is not configured", async () => {
    const getCallAnalysisResult = vi.fn().mockResolvedValue({
      callId: "CALL1",
      runId: "run-1",
      status: "ready",
      transcriptByRoles: [
        {
          role: "manager",
          start: 0,
          end: 2,
          text: "Добрый день."
        }
      ],
      fullTranscriptText: "Менеджер: Добрый день.",
      aiEvaluation: {
        score: 82
      },
      rawAiEvaluation: {
        score: 82
      },
      attributes: {
        dealId: "23841"
      },
      model: "quality-review-v2",
      promptVersion: "calls-v2",
      analyzedAt: "2026-06-09T12:00:30.000Z",
      updatedAt: "2026-06-09T12:00:31.000Z"
    });
    const serviceOverrides = {
      getCallAnalysisResult
    } as Partial<Parameters<typeof createApp>[0]>;
    const app = createTestApp(serviceOverrides);

    await request(app)
      .get("/api/modules/attraction/calls/CALL1/analysis")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ready",
          result: {
            callId: "CALL1",
            aiEvaluation: {
              score: 82
            },
            rawAiEvaluation: {
              score: 82
            }
          }
        });
      });

    expect(getCallAnalysisResult).toHaveBeenCalledWith("CALL1");
  });

  it("returns the attraction sync journal without exposing a leadgen sync journal", async () => {
    const attractionRun = {
      id: 41,
      startedAt: "2026-06-03T06:00:00.000Z",
      finishedAt: "2026-06-03T06:01:00.000Z",
      durationMs: 60_000,
      status: "success" as const,
      mode: "delta" as const,
      modifiedAfter: "2026-06-03T05:00:00.000Z",
      scopeKey: "category:10:assigned:78",
      leadsSynced: 0,
      dealsSynced: 12,
      dealBreakdown: {
        total: 12,
        created: 2,
        updated: 8,
        closed: 1,
        reopened: 0,
        unchanged: 1
      },
      diagnostics: ["activityBindingError=Error"]
    };
    const app = createTestApp(
      {
        getSyncRuns: async (input?: { limit?: number }) => ({
          runs: input?.limit === 1 ? [attractionRun] : []
        })
      },
      {
        modules: {
          leadgen: {
            performSync: async () => createSyncSummary({ syncRunId: 42 })
          }
        }
      }
    );

    await request(app)
      .get("/api/sync-runs")
      .query({ limit: "1" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.runs).toEqual([attractionRun]);
      });

    await request(app).get("/api/modules/leadgen/sync-runs").expect(404);
  });

  it("reads and saves prototype comments with block anchors", async () => {
    let savedInput: { comments: unknown[]; updatedAt: string } | null = null;
    const app = createTestApp(undefined, {
      protoComments: {
        getProtoComments: async () => ({
          updatedAt: "2026-05-02T07:50:00.000Z",
          comments: [
            {
              id: "existing-comment",
              sceneId: "sales-report",
              x: 0.1,
              y: 0.2,
              text: "Старая заметка",
              status: "open",
              archivedAt: null,
              createdAt: "2026-05-02T07:40:00.000Z",
              updatedAt: "2026-05-02T07:50:00.000Z",
              anchor: {
                blockId: "sales-summary-card",
                blockLabel: "Выиграно",
                blockSelector: '[data-comment-block-id="sales-summary-card"]',
                blockRole: "section",
                elementSelector: "section:nth-of-type(2)",
                elementLabel: "Выиграно 1",
                relativeX: 0.1,
                relativeY: 0.2
              }
            }
          ]
        }),
        replaceProtoComments: async (input) => {
          savedInput = input;
          return {
            comments: input.comments,
            updatedAt: input.updatedAt
          };
        }
      }
    });

    await request(app)
      .get("/api/proto-comments")
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments[0].anchor.blockId).toBe("sales-summary-card");
      });

    await request(app)
      .post("/api/proto-comments")
      .send({
        comments: [
          {
            id: "new-comment",
            sceneId: "sales-report",
            x: 0.25,
            y: 0.5,
            text: "Проверить карточку продаж",
            status: "open",
            archivedAt: null,
            createdAt: "2026-05-02T08:00:00.000Z",
            updatedAt: "2026-05-02T08:00:00.000Z",
            anchor: {
              blockId: "sales-summary-card",
              blockLabel: "Выиграно",
              blockSelector: '[data-comment-block-id="sales-summary-card"]',
              blockRole: "section",
              elementSelector: "section:nth-of-type(2) > div:nth-of-type(1)",
              elementLabel: "Выиграно 1",
              relativeX: 0.1,
              relativeY: 0.2
            }
          }
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments[0].anchor.blockLabel).toBe("Выиграно");
      });

    expect(savedInput).toEqual(
      expect.objectContaining({
        updatedAt: expect.stringMatching(/^20/),
        comments: [
          expect.objectContaining({
            id: "new-comment",
            anchor: expect.objectContaining({
              blockId: "sales-summary-card"
            })
          })
        ]
      })
    );
  });

  it("returns conversion events report", async () => {
    const app = createTestApp({
      getConversionEventsReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalInvitedCount: 5,
        totalConfirmedCount: 0,
        totalAttendedCount: 2,
        totalRefusedCount: 1,
        totalMissedCount: 3,
        attendanceRate: 40,
        nextStepEligibleCount: 2,
        nextStepCount: 1,
        nextStepRate: 50,
        warnings: [],
        rows: [
          {
            eventKey: "Знакомство с клубом 29.04.|2026-04-29T00:00:00.000Z",
            eventName: "Знакомство с клубом 29.04.",
            eventDate: "2026-04-29T00:00:00.000Z",
            invitedCount: 5,
            confirmedCount: 0,
            attendedCount: 2,
            refusedCount: 1,
            missedCount: 3,
            attendanceRate: 40,
            nextStepEligibleCount: 2,
            nextStepCount: 1,
            nextStepRate: 50,
            unlinkedCount: 0,
            unknownStatusCount: 0,
            managerBreakdown: [],
            sourceBreakdown: [],
            businessClubBreakdown: []
          }
        ],
        comparisons: []
      })
    });

    await expect(
      request(app)
        .get(
          "/api/reports/conversion-events?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z"
        )
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        totalInvitedCount: 5,
        totalConfirmedCount: 0,
        rows: [
          {
            eventName: "Знакомство с клубом 29.04.",
            attendanceRate: 40,
            nextStepRate: 50
          }
        ]
      }
    });
  });

  it("returns unit economics report", async () => {
    let receivedInput: unknown = null;
    const app = createTestApp({
      getUnitEconomicsReport: async (input) => {
        receivedInput = input;
        return {
          ...createEmptyUnitEconomicsReport(),
          summary: {
            ...createEmptyUnitEconomicsReport().summary,
            createdDeals: 3,
            wonDeals: 2,
            purchasedLeads: 2,
            attractionRevenue: 600000,
            leadPurchaseCost: 80000,
            contractationCost: 10000,
            variableCosts: 90000,
            contributionResult: 510000,
            aboveEbitdaCosts: 91500,
            ebitda: 418500,
            netProfit: 418500
          }
        };
      }
    });

    await expect(
      request(app)
        .get(
          "/api/reports/unit-economics?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z&sourceKeys=LEADGEN_US"
        )
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        summary: {
          createdDeals: 3,
          wonDeals: 2,
          purchasedLeads: 2,
          attractionRevenue: 600000,
          leadPurchaseCost: 80000,
          contractationCost: 10000,
          variableCosts: 90000,
          contributionResult: 510000,
          ebitda: 418500
        }
      }
    });

    expect(receivedInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        sourceKeys: ["LEADGEN_US"]
      }
    });
  });

  it("reads and saves pricing settings", async () => {
    const app = createTestApp();

    await expect(
      request(app).get("/api/settings/pricing").expect(200)
    ).resolves.toMatchObject({
      body: {
        rules: [
          {
            id: "clubfirst-federal",
            attractionRevenueAmount: 300000
          }
        ]
      }
    });

    await expect(
      request(app)
        .put("/api/settings/pricing")
        .send({
          rules: [
            {
              id: "clubfirst-federal",
              customerLabel: "ClubFirst Russia / One",
              tariffLabel: "Федеральный",
              attractionRevenueAmount: 310000,
              enabled: true,
              sortOrder: 10
            }
          ]
        })
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        rules: [
          {
            id: "clubfirst-federal",
            attractionRevenueAmount: 310000,
            updatedAt: "2026-04-29T10:00:00.000Z"
          }
        ],
        updatedAt: "2026-04-29T10:00:00.000Z"
      }
    });
  });

  it("reads and saves operational threshold settings", async () => {
    const app = createTestApp();

    const readResponse = await request(app)
      .get("/api/settings/operational-thresholds")
      .expect(200);

    expect(readResponse.body).toMatchObject({
      noCallsMaxDays: 7,
      noActivityMaxDays: 5,
      slaBusinessHours: {
        sla1: 24,
        sla2: 5,
        sla3: 72
      }
    });
    expect(readResponse.body.stageAging).toEqual(
      expect.arrayContaining([
        expect.objectContaining(
          {
            stageId: "C10:NEW",
            stageName: "База входящая",
            maxDaysOnStage: 1
          }
        )
      ])
    );

    const updateResponse = await request(app)
      .put("/api/settings/operational-thresholds")
      .send({
        stageAging: [
          {
            stageId: "C10:NEW",
            maxDaysOnStage: 2
          }
        ],
        noCallsMaxDays: 6,
        noActivityMaxDays: 4,
        slaBusinessHours: {
          sla1: 20,
          sla2: 6,
          sla3: 60
        }
      })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      noCallsMaxDays: 6,
      noActivityMaxDays: 4,
      slaBusinessHours: {
        sla1: 20,
        sla2: 6,
        sla3: 60
      },
      updatedAt: "2026-04-29T10:00:00.000Z"
    });
    expect(updateResponse.body.stageAging).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stageId: "C10:NEW",
          stageName: "База входящая",
          maxDaysOnStage: 2
        }),
        expect.objectContaining({
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          maxDaysOnStage: 3
        })
      ])
    );
  });

  it("rejects non-positive operational threshold settings", async () => {
    const app = createTestApp();

    await request(app)
      .put("/api/settings/operational-thresholds")
      .send({
        stageAging: [
          {
            stageId: "C10:NEW",
            maxDaysOnStage: 0
          }
        ],
        noCallsMaxDays: 7,
        noActivityMaxDays: 5,
        slaBusinessHours: {
          sla1: 24,
          sla2: 5,
          sla3: 72
        }
      })
      .expect(400);
  });

  it("reads and saves unit economics cost rules", async () => {
    const app = createTestApp();

    await expect(
      request(app).get("/api/settings/unit-economics").expect(200)
    ).resolves.toMatchObject({
      body: {
        articles: [
          {
            id: "lead_purchase",
            name: "Закупка лидов",
            calculationMethod: "amount_per_lead"
          },
          {
            id: "contractation",
            name: "Контрактация",
            calculationMethod: "amount_per_contract"
          }
        ],
        rules: [
          {
            id: "contractation-per-won-default",
            articleId: "contractation",
            unitPrice: 5000
          }
        ]
      }
    });

    await expect(
      request(app)
        .put("/api/settings/unit-economics/cost-rules")
        .send({
          rules: [
            {
              id: "leadgen-ready-to-meet",
              articleId: "lead_purchase",
              pnlLevel: "variable_contribution",
              costBehavior: "variable",
              calculationMethod: "amount_per_lead",
              unitPrice: 40000,
              percent: null,
              amount: null,
              sourceKey: "LEADGEN_US",
              qualityValue: "Готов к встрече",
              enabled: true,
              effectiveFrom: "2026-01-01",
              effectiveTo: null,
              sortOrder: 10
            }
          ]
        })
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        rules: [
          {
            id: "leadgen-ready-to-meet",
            articleId: "lead_purchase",
            sourceKey: "LEADGEN_US",
            qualityValue: "Готов к встрече",
            unitPrice: 40000
          }
        ],
        updatedAt: "2026-06-02T08:00:00.000Z"
      }
    });
  });

  it("reads and saves conversion event type settings", async () => {
    const app = createTestApp();

    await expect(
      request(app).get("/api/settings/conversion-event-types").expect(200)
    ).resolves.toMatchObject({
      body: {
        options: [
          {
            id: "128",
            title: "Гостевая встреча",
            selectedForPlannedInventory: true
          }
        ],
        settings: [
          {
            moduleKey: "attraction",
            eventTypeId: "128",
            enabled: true
          }
        ]
      }
    });

    await expect(
      request(app)
        .put("/api/settings/conversion-event-types")
        .send({
          eventTypeIds: ["128", "256"]
        })
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        options: [
          {
            id: "128",
            selectedForPlannedInventory: true
          },
          {
            id: "256",
            selectedForPlannedInventory: true
          }
        ],
        settings: [
          {
            eventTypeId: "128",
            enabled: true
          },
          {
            eventTypeId: "256",
            enabled: true
          }
        ]
      }
    });
  });

  it("reads and saves manager whitelist settings", async () => {
    const app = createTestApp({
      getManagerWhitelistSettings: async () => ({
        options: [
          { id: "78", name: "Егоров Андрей" },
          { id: "13020", name: "Какулия Илья" }
        ],
        settings: [
          {
            moduleKey: "attraction",
            managerId: "78",
            managerName: "Егоров Андрей",
            enabled: true,
            sortOrder: 0,
            updatedAt: "2026-06-01T10:00:00.000Z"
          }
        ]
      }),
      replaceManagerWhitelistSettings: async (input: { managerIds: string[] }) => ({
        options: input.managerIds.map((id) => ({ id, name: id })),
        settings: input.managerIds.map((id, index) => ({
          moduleKey: "attraction",
          managerId: id,
          managerName: id,
          enabled: true,
          sortOrder: index * 10,
          updatedAt: "2026-06-01T10:05:00.000Z"
        })),
        teams:
          "teams" in input && Array.isArray(input.teams)
            ? input.teams.map((team: any, index) => ({
                id: team.id ?? `team-${index + 1}`,
                name: team.name,
                managerIds: team.managerIds,
                sortOrder: index * 10,
                updatedAt: "2026-06-01T10:05:00.000Z"
              }))
            : []
      })
    } as any);

    await expect(
      request(app).get("/api/settings/manager-whitelist").expect(200)
    ).resolves.toMatchObject({
      body: {
        options: [
          { id: "78", name: "Егоров Андрей" },
          { id: "13020", name: "Какулия Илья" }
        ],
        settings: [
          {
            moduleKey: "attraction",
            managerId: "78",
            enabled: true
          }
        ]
      }
    });

    await expect(
      request(app)
        .put("/api/settings/manager-whitelist")
        .send({
          managerIds: ["13020", "78"],
          teams: [
            {
              id: "attraction",
              name: "Привлечение",
              managerIds: ["13020", "78"]
            }
          ]
        })
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        settings: [
          {
            managerId: "13020",
            sortOrder: 0,
            updatedAt: "2026-06-01T10:05:00.000Z"
          },
          {
            managerId: "78",
            sortOrder: 10,
            updatedAt: "2026-06-01T10:05:00.000Z"
          }
        ],
        teams: [
          {
            id: "attraction",
            name: "Привлечение",
            managerIds: ["13020", "78"],
            sortOrder: 0,
            updatedAt: "2026-06-01T10:05:00.000Z"
          }
        ]
      }
    });
  });

  it("scopes employee attraction report filters to their manager team", async () => {
    let receivedDashboardInput: unknown = null;
    const module = {
      ...createAuthenticatedModule({
        id: "attraction",
        name: "Привлечение"
      }),
      defaultManagerId: "78"
    };
    const auth = createStaticAuthService(
      createTestSession({
        modules: [module]
      })
    );
    const app = createTestApp(
      {
        getManagerWhitelistSettings: async () => ({
          options: [
            { id: "78", name: "Егоров Андрей" },
            { id: "13020", name: "Какулия Илья" },
            { id: "11234", name: "Ромашова Ольга" }
          ],
          settings: [
            {
              moduleKey: "attraction",
              managerId: "78",
              managerName: "Егоров Андрей",
              enabled: true,
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction",
              teamName: "Привлечение"
            },
            {
              moduleKey: "attraction",
              managerId: "13020",
              managerName: "Какулия Илья",
              enabled: true,
              sortOrder: 10,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction",
              teamName: "Привлечение"
            },
            {
              moduleKey: "attraction",
              managerId: "11234",
              managerName: "Ромашова Ольга",
              enabled: true,
              sortOrder: 20,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction-stroke",
              teamName: "Привлечение штрих"
            }
          ],
          teams: [
            {
              id: "attraction",
              name: "Привлечение",
              managerIds: ["78", "13020"],
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z"
            },
            {
              id: "attraction-stroke",
              name: "Привлечение штрих",
              managerIds: ["11234"],
              sortOrder: 20,
              updatedAt: "2026-06-17T00:00:00.000Z"
            }
          ]
        }),
        getDashboard: async (input) => {
          receivedDashboardInput = input;
          return {
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
          };
        }
      },
      { auth }
    );

    await request(app)
      .get("/api/dashboard")
      .set("Cookie", "b24dash_session=valid-session")
      .query({ managerIds: "13020,11234" })
      .expect(200);

    expect(receivedDashboardInput).toMatchObject({
      filters: {
        managerIds: ["13020"]
      }
    });
  });

  it("fails employee attraction report scoping closed when whitelist settings are unavailable", async () => {
    let receivedDashboardInput: unknown = null;
    const module = {
      ...createAuthenticatedModule({
        id: "attraction",
        name: "Привлечение"
      }),
      defaultManagerId: "78"
    };
    const auth = createStaticAuthService(
      createTestSession({
        modules: [module]
      })
    );
    const app = createTestApp(
      {
        getDashboard: async (input) => {
          receivedDashboardInput = input;
          return {
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
          };
        }
      },
      { auth }
    );

    await request(app)
      .get("/api/dashboard")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(200);

    expect(receivedDashboardInput).toMatchObject({
      filters: {
        managerIds: [NO_ATTRACTION_MANAGER_MATCH_ID]
      }
    });
  });

  it("scopes employee call analysis queue filters to their manager team", async () => {
    let receivedQueueInput: unknown = null;
    const module = {
      ...createAuthenticatedModule({
        id: "attraction",
        name: "Привлечение"
      }),
      defaultManagerId: "78"
    };
    const auth = createStaticAuthService(
      createTestSession({
        modules: [module]
      })
    );
    const app = createTestApp(
      {
        getManagerWhitelistSettings: async () => ({
          options: [
            { id: "78", name: "Егоров Андрей" },
            { id: "13020", name: "Какулия Илья" },
            { id: "11234", name: "Ромашова Ольга" }
          ],
          settings: [
            {
              moduleKey: "attraction",
              managerId: "78",
              managerName: "Егоров Андрей",
              enabled: true,
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction",
              teamName: "Привлечение"
            },
            {
              moduleKey: "attraction",
              managerId: "13020",
              managerName: "Какулия Илья",
              enabled: true,
              sortOrder: 10,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction",
              teamName: "Привлечение"
            },
            {
              moduleKey: "attraction",
              managerId: "11234",
              managerName: "Ромашова Ольга",
              enabled: true,
              sortOrder: 20,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction-stroke",
              teamName: "Привлечение штрих"
            }
          ],
          teams: [
            {
              id: "attraction",
              name: "Привлечение",
              managerIds: ["78", "13020"],
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z"
            },
            {
              id: "attraction-stroke",
              name: "Привлечение штрих",
              managerIds: ["11234"],
              sortOrder: 20,
              updatedAt: "2026-06-17T00:00:00.000Z"
            }
          ]
        }),
        getCallAnalysisQueue: async (input) => {
          receivedQueueInput = input;
          return createEmptyCallAnalysisQueue();
        }
      },
      { auth }
    );

    await request(app)
      .get("/api/modules/attraction/calls/analysis-queue")
      .set("Cookie", "b24dash_session=valid-session")
      .query({ managerIds: "13020,11234" })
      .expect(200);

    expect(receivedQueueInput).toMatchObject({
      filters: {
        managerIds: ["13020"]
      }
    });
  });

  it("scopes employee attraction meta and manager whitelist responses to their manager team", async () => {
    let receivedMetaInput: unknown = null;
    const module = {
      ...createAuthenticatedModule({
        id: "attraction",
        name: "Привлечение"
      }),
      defaultManagerId: "78"
    };
    const auth = createStaticAuthService(
      createTestSession({
        modules: [module]
      })
    );
    const managerWhitelistSettings = {
      options: [
        { id: "78", name: "Егоров Андрей" },
        { id: "13020", name: "Какулия Илья" },
        { id: "11234", name: "Ромашова Ольга" }
      ],
      settings: [
        {
          moduleKey: "attraction",
          managerId: "78",
          managerName: "Егоров Андрей",
          enabled: true,
          sortOrder: 0,
          updatedAt: "2026-06-17T00:00:00.000Z",
          teamId: "attraction",
          teamName: "Привлечение"
        },
        {
          moduleKey: "attraction",
          managerId: "13020",
          managerName: "Какулия Илья",
          enabled: true,
          sortOrder: 10,
          updatedAt: "2026-06-17T00:00:00.000Z",
          teamId: "attraction",
          teamName: "Привлечение"
        },
        {
          moduleKey: "attraction",
          managerId: "11234",
          managerName: "Ромашова Ольга",
          enabled: true,
          sortOrder: 20,
          updatedAt: "2026-06-17T00:00:00.000Z",
          teamId: "attraction-stroke",
          teamName: "Привлечение штрих"
        }
      ],
      teams: [
        {
          id: "attraction",
          name: "Привлечение",
          managerIds: ["78", "13020"],
          sortOrder: 0,
          updatedAt: "2026-06-17T00:00:00.000Z"
        },
        {
          id: "attraction-stroke",
          name: "Привлечение штрих",
          managerIds: ["11234"],
          sortOrder: 20,
          updatedAt: "2026-06-17T00:00:00.000Z"
        }
      ]
    };
    const app = createTestApp(
      {
        getManagerWhitelistSettings: async () => managerWhitelistSettings,
        getMeta: async (input) => {
          receivedMetaInput = input;
          const managerIds = new Set(input?.filters?.managerIds ?? []);
          return {
            stageCatalog: [],
            managerCatalog: managerWhitelistSettings.options.filter((manager) =>
              managerIds.has(manager.id)
            ),
            sourceCatalog: [],
            wonStageIds: [],
            defaultPeriodDays: 30,
            lastSync: null,
            snapshotStats: emptySnapshotStats,
            syncHealth: {
              status: "ready" as const,
              blocking: false,
              checkedAt: "2026-04-09T00:00:00.000Z",
              lastSuccessfulSync: null,
              issues: [],
              warnings: []
            }
          };
        }
      },
      { auth }
    );

    await request(app)
      .get("/api/meta")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(200)
      .expect(({ body }) => {
        expect(body.managerCatalog.map((manager: { id: string }) => manager.id)).toEqual([
          "78",
          "13020"
        ]);
      });

    expect(receivedMetaInput).toMatchObject({
      filters: {
        managerIds: ["78", "13020"]
      }
    });

    await request(app)
      .get("/api/settings/manager-whitelist")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(200)
      .expect(({ body }) => {
        expect(body.settings.map((setting: { managerId: string }) => setting.managerId)).toEqual([
          "78",
          "13020"
        ]);
        expect(body.options.map((manager: { id: string }) => manager.id)).toEqual([
          "78",
          "13020"
        ]);
        expect(body.teams).toEqual([
          expect.objectContaining({
            id: "attraction",
            name: "Привлечение",
            managerIds: ["78", "13020"]
          })
        ]);
      });
  });

  it("denies employee direct call analysis access outside their manager team", async () => {
    const analyzedCallIds: string[] = [];
    const module = {
      ...createAuthenticatedModule({
        id: "attraction",
        name: "Привлечение"
      }),
      defaultManagerId: "78"
    };
    const auth = createStaticAuthService(
      createTestSession({
        modules: [module]
      })
    );
    const app = createTestApp(
      {
        getManagerWhitelistSettings: async () => ({
          options: [
            { id: "78", name: "Егоров Андрей" },
            { id: "11234", name: "Ромашова Ольга" }
          ],
          settings: [
            {
              moduleKey: "attraction",
              managerId: "78",
              managerName: "Егоров Андрей",
              enabled: true,
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction",
              teamName: "Привлечение"
            },
            {
              moduleKey: "attraction",
              managerId: "11234",
              managerName: "Ромашова Ольга",
              enabled: true,
              sortOrder: 10,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction-stroke",
              teamName: "Привлечение штрих"
            }
          ],
          teams: []
        }),
        isCallInAttractionManagerScope: async (callId, managerIds) =>
          callId === "OWN-CALL" && managerIds.includes("78")
      },
      {
        auth,
        callAnalysis: {
          analyzeCall: async ({ callId }) => {
            analyzedCallIds.push(callId);
            return { callId };
          },
          getCallAnalysisResult: async (callId) => ({ callId, summary: "ok" })
        }
      }
    );

    await request(app)
      .post("/api/calls/FOREIGN-CALL/analyze")
      .set("Cookie", "b24dash_session=valid-session")
      .set("X-CSRF-Token", "csrf-token")
      .expect(403);
    await request(app)
      .get("/api/calls/FOREIGN-CALL/analysis")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(403);
    await request(app)
      .post("/api/calls/OWN-CALL/analyze")
      .set("Cookie", "b24dash_session=valid-session")
      .set("X-CSRF-Token", "csrf-token")
      .expect(200);

    expect(analyzedCallIds).toEqual(["OWN-CALL"]);
  });

  it("denies employee direct call analysis access when the manager scope checker is unavailable", async () => {
    const analyzedCallIds: string[] = [];
    const module = {
      ...createAuthenticatedModule({
        id: "attraction",
        name: "Привлечение"
      }),
      defaultManagerId: "78"
    };
    const auth = createStaticAuthService(
      createTestSession({
        modules: [module]
      })
    );
    const app = createTestApp(
      {
        getManagerWhitelistSettings: async () => ({
          options: [{ id: "78", name: "Егоров Андрей" }],
          settings: [
            {
              moduleKey: "attraction",
              managerId: "78",
              managerName: "Егоров Андрей",
              enabled: true,
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z",
              teamId: "attraction",
              teamName: "Привлечение"
            }
          ],
          teams: [
            {
              id: "attraction",
              name: "Привлечение",
              managerIds: ["78"],
              sortOrder: 0,
              updatedAt: "2026-06-17T00:00:00.000Z"
            }
          ]
        })
      },
      {
        auth,
        callAnalysis: {
          analyzeCall: async ({ callId }) => {
            analyzedCallIds.push(callId);
            return { callId };
          },
          getCallAnalysisResult: async (callId) => ({ callId, summary: "ok" })
        }
      }
    );

    await request(app)
      .post("/api/calls/OWN-CALL/analyze")
      .set("Cookie", "b24dash_session=valid-session")
      .set("X-CSRF-Token", "csrf-token")
      .expect(403);
    await request(app)
      .get("/api/calls/OWN-CALL/analysis")
      .set("Cookie", "b24dash_session=valid-session")
      .expect(403);

    expect(analyzedCallIds).toEqual([]);
  });

  it("returns dashboard data, settings and sync status from the local API", async () => {
    let receivedActivitiesInput: unknown = null;
    let receivedOperationalDashboardInput: unknown = null;
    let receivedCohortInput: unknown = null;
    let receivedSourceCohortDrilldownInput: unknown = null;
    let receivedRevenueVelocityInput: unknown = null;
    let receivedLeadgenFunnelInput: unknown = null;
    let receivedLeadgenActivitiesInput: unknown = null;
    let receivedLeadgenCallsInput: unknown = null;
    const dashboard: DashboardData = {
      salesSummary: {
        salesCount: 3,
        salesAmount: 45000,
        averageSaleAmount: 15000,
        attractionRevenueAmount: 45000,
        averageAttractionRevenueAmount: 15000,
        membershipAmount: 45000,
        averageMembershipAmount: 15000,
        pricingWarnings: [],
        newDealsCount: 7,
        conversionRate: 42.86
      },
      managerGroups: []
    };
    const stageCatalog: StageCatalogEntry[] = [
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:WON",
        name: "Won",
        semanticId: "S"
      }
    ];
    const sourceQualityReport: SourceQualityConversionReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 4,
      totalWonDeals: 1,
      rows: [],
      stageSequence: []
    };
    const activitiesReport: ActivitiesWorkloadReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCreatedCount: 5,
      totalRescheduledCount: 0,
      totalClosedCount: 2,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: "2026-03-01T00:00:00.000Z",
            to: "2026-03-31T23:59:59.999Z"
          },
          snapshot: {
            range: {
              from: "2026-03-01T00:00:00.000Z",
              to: "2026-03-31T23:59:59.999Z"
            },
            totalDealCount: 1,
            totalCreatedCount: 2,
            totalRescheduledCount: 0,
            totalClosedCount: 1,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: []
          }
        }
      ]
    };
    const operationalDashboardReport: OperationalDashboardReport = {
      ...createEmptyOperationalDashboardReport(),
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      createdDeals: 6,
      riskSummary: {
        ...createEmptyOperationalDashboardReport().riskSummary,
        total: 2
      },
      managers: [
        {
          managerId: "7",
          managerName: "Manager 7",
          createdDeals: 2,
          meetingsBySlot: [
            { slotIndex: 1, slotLabel: "Встреча 1", count: 1 },
            { slotIndex: 2, slotLabel: "Встреча 2", count: 0 },
            { slotIndex: 3, slotLabel: "Встреча 3", count: 0 }
          ],
          wonDeals: 1,
          slaLateCount: 1,
          slaNoTouchCount: 0,
          openDeals: 1,
          riskDeals: 1
        }
      ]
    };
    const callsReport: CallsWorkloadReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCalls: 7,
      totalIncomingCalls: 3,
      totalMissedIncomingCalls: 0,
      totalOutgoingCalls: 4,
      totalOtherOutgoingCalls: 1,
      totalConnectedCalls: 6,
      totalFailedCalls: 1,
      totalCallsOverThirtySeconds: 4,
      totalConnectedCallsOverThirtySeconds: 4,
      allCalls: {
        ...emptyCallPopulation,
        totalCalls: 7,
        incomingCalls: 3,
        missedIncomingCalls: 0,
        outgoingCalls: 4,
        otherOutgoingCalls: 1,
        connectedCalls: 6,
        failedCalls: 1,
        callsOverThirtySeconds: 4,
        connectedCallsOverThirtySeconds: 4
      },
      linkedDealCalls: {
        ...emptyLinkedDealCalls,
        totalDealCount: 2,
        totalCalls: 7,
        incomingCalls: 3,
        missedIncomingCalls: 0,
        outgoingCalls: 4,
        otherOutgoingCalls: 1,
        connectedCalls: 6,
        failedCalls: 1,
        callsOverThirtySeconds: 4,
        connectedCallsOverThirtySeconds: 4
      },
      warnings: [],
      managerRows: []
    };
    const cohortReport: CohortConversionReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 4,
      totalClosedDeals: 2,
      totalWonDeals: 1,
      closureMonths: ["2026-04"],
      relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
      rows: [],
      breakdownRows: []
    };
    const tocReport: TocFlowReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      businessDays: 22,
      warnings: [],
      estimatedGainPerDay: null,
      bottleneck: null,
      rows: []
    };
    const acquisitionOutcomesReport: AcquisitionOutcomesReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalNewDeals: 3,
      totalLostDeals: 1,
      newDealsByManager: [],
      lostDealsByManager: [],
      lostStages: [],
      businessClubByManager: [],
      lostDealDetails: [],
      topLossReasons: []
    };
    const targetGroupConversionReport: TargetGroupConversionReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      rows: []
    };
    const managerActionOutcomeReport: ManagerActionOutcomeReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      warnings: [],
      rows: [],
      cohortMonths: [],
      cohortStatusRows: []
    };
    const leadgenFunnelReport = {
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      totalDeals: 4,
      createdDeals: 3,
      activeDeals: 2,
      closedDeals: 1,
      stageRows: [],
      sourceRows: [],
      utmRows: [],
      managerRows: [],
      reasonRows: [],
      warnings: []
    };
    const revenueVelocityReport: RevenueVelocityReport = {
      ...createEmptyRevenueVelocityReport(),
      dimension: "source",
      view: "createdCohort",
      totals: {
        ...createEmptyRevenueVelocityReport().totals,
        dimension: "source",
        view: "createdCohort",
        createdDeals: 4,
        wonDeals: 1,
        salesAmount: 125000,
        averageCheck: 125000,
        winRate: 0.25,
        averageCycleDays: 10,
        medianCycleDays: 10,
        revenueVelocityPerDay: 12500
      },
      rows: [
        {
          ...createEmptyRevenueVelocityReport().totals,
          dimension: "source",
          view: "createdCohort",
          key: "WEB",
          label: "Сайт",
          sourceKey: "WEB",
          sourceLabel: "Сайт",
          createdDeals: 4,
          wonDeals: 1,
          salesAmount: 125000,
          averageCheck: 125000,
          winRate: 0.25,
          averageCycleDays: 10,
          medianCycleDays: 10,
          revenueVelocityPerDay: 12500
        }
      ]
    };
    const service: Parameters<typeof createApp>[0] = {
      getDashboard: async () => dashboard,
      getSourceQualityConversionReport: async () => sourceQualityReport,
      getSourceCohortConversionReport: async () =>
        createEmptySourceCohortConversionReport(),
      getSourceCohortConversionJourneyDrilldown: async (input: unknown) => {
        receivedSourceCohortDrilldownInput = input;
        if (
          (input as { drilldownKind?: string; stepKey?: string }).drilldownKind ===
            "crm_stage" &&
          (input as { stepKey?: string }).stepKey === "C10:UNKNOWN"
        ) {
          throw new SourceCohortConversionStageNotFoundError("C10:UNKNOWN");
        }
        return {
          range: {
            from: "2026-04-01T00:00:00.000Z",
            to: "2026-04-30T23:59:59.999Z"
          },
          drilldownKind: "fact" as const,
          stepKey: "first_call" as const,
          stepLabel: "Первый звонок",
          previousStepKey: "created" as const,
          previousStepLabel: "Создана",
          nextStepKey: "confirmed_conversation" as const,
          nextStepLabel: "Подтвержденный разговор",
          asOf: "2026-05-01T00:00:00.000Z",
          views: {
            reached: {
              viewKey: "reached" as const,
              label: "Дошли сюда",
              count: 0,
              deals: []
            },
            missed: {
              viewKey: "missed" as const,
              label: "Не дошли из «Создана»",
              count: 0,
              deals: []
            },
            notAdvanced: {
              viewKey: "not_advanced" as const,
              label: "Не перешли к «Подтвержденный разговор»",
              count: 0,
              deals: []
            }
          }
        };
      },
      getActivitiesWorkloadReport: async (input: unknown) => {
        receivedActivitiesInput = input;
        return activitiesReport;
      },
      getOperationalDashboardReport: async (input: unknown) => {
        receivedOperationalDashboardInput = input;
        return operationalDashboardReport;
      },
      getCallsWorkloadReport: async () => callsReport,
      getCallAnalysisQueue: async () => createEmptyCallAnalysisQueue(),
      getCohortConversionReport: async (input: unknown) => {
        receivedCohortInput = input;
        return cohortReport;
      },
      getTocFlowReport: async () => tocReport,
      getAcquisitionOutcomesReport: async () => acquisitionOutcomesReport,
      getTargetGroupConversionReport: async () => targetGroupConversionReport,
      getManagerActionOutcomeReport: async () => managerActionOutcomeReport,
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
        rows: []
      }),
      getRevenueVelocityReport: async (input: unknown) => {
        receivedRevenueVelocityInput = input;
        return revenueVelocityReport;
      },
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
      getLeadgenFunnelReport: async (input: unknown) => {
        receivedLeadgenFunnelInput = input;
        return leadgenFunnelReport;
      },
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
      getSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      replaceSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
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
      ...operationalThresholdSettingsService,
      getAttractionOntology: async () => emptyAttractionOntology,
      getAttractionOntologySourceDocument: async () =>
        emptyAttractionOntologySourceDocument,
      getMeta: async () => ({
        stageCatalog,
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: ["C1:WON"],
        defaultPeriodDays: 30,
        lastSync: {
          finishedAt: "2026-04-08T12:00:00.000Z",
          leadsSynced: 8,
          dealsSynced: 5,
          mode: "delta" as const,
          dealBreakdown: {
            total: 5,
            created: 1,
            updated: 4,
            closed: 0,
            reopened: 0,
            unchanged: 0
          }
        },
        snapshotStats: {
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18
        },
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-08T12:00:00.000Z",
          lastSuccessfulSync: "2026-04-08T12:00:00.000Z",
          issues: [],
          warnings: []
        }
      }),
      performSync: async () =>
        createSyncSummary({
          syncRunId: 18,
          leadsSynced: 8,
          dealsSynced: 5,
          mode: "delta",
          modifiedAfter: "2026-04-08T00:00:00.000Z",
          finishedAt: "2026-04-08T12:00:00.000Z"
        }),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    };

    const app = createApp(service, {
      modules: {
        leadgen: {
          getLeadgenFunnelReport: async (input: unknown) => {
            receivedLeadgenFunnelInput = input;
            return leadgenFunnelReport;
          },
          getActivitiesWorkloadReport: async (input: unknown) => {
            receivedLeadgenActivitiesInput = input;
            return {
              ...activitiesReport,
              totalDealCount: 2,
              totalCreatedCount: 3
            };
          },
          getCallsWorkloadReport: async (input: unknown) => {
            receivedLeadgenCallsInput = input;
            return {
              ...callsReport,
              totalDealCount: 2,
              totalCalls: 4
            };
          },
          getMeta: async () => ({
            stageCatalog: [
              {
                entityType: "deal" as const,
                categoryId: "28",
                statusId: "C28:NEW",
                name: "Новый лид",
                semanticId: "P"
              }
            ],
            managerCatalog: [{ id: "501", name: "Лидген менеджер" }],
            sourceCatalog: [{ key: "WEB", label: "Сайт" }],
            wonStageIds: [],
            defaultPeriodDays: 30,
            lastSync: {
              finishedAt: "2026-05-14T12:00:00.000Z",
              leadsSynced: 0,
              dealsSynced: 333,
              mode: "delta" as const,
              dealBreakdown: {
                total: 333,
                created: 300,
                updated: 30,
                closed: 3,
                reopened: 0,
                unchanged: 0
              }
            },
            snapshotStats: {
              deals: 4140,
              activities: 306,
              calls: 119,
              stageHistory: 13166
            },
            syncHealth: {
              status: "ready" as const,
              blocking: false,
              checkedAt: "2026-05-14T12:00:00.000Z",
              lastSuccessfulSync: "2026-05-14T12:00:00.000Z",
              issues: [],
              warnings: []
            }
          }),
          performSync: async () => createSyncSummary({ syncRunId: 28 })
        }
      }
    });

    await request(app)
      .get("/api/dashboard")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.salesSummary.salesCount).toBe(3);
      });

    await request(app)
      .get("/api/reports/source-quality-conversion")
      .query({
        periodDays: 30
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCreatedDeals).toBe(4);
      });

    await request(app)
      .get("/api/reports/source-cohort-conversion/journey-deals")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        managerIds: "7,9",
        sourceKeys: "WEB",
        stepKey: "first_call"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.stepKey).toBe("first_call");
        expect(body.views.notAdvanced.count).toBe(0);
      });
    expect(receivedSourceCohortDrilldownInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["7", "9"],
        sourceKeys: ["WEB"]
      },
      drilldownKind: "fact",
      stepKey: "first_call"
    });

    await request(app)
      .get("/api/reports/source-cohort-conversion/journey-deals")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        drilldownKind: "crm_stage",
        stepKey: "C10:NEW"
      })
      .expect(200);
    expect(receivedSourceCohortDrilldownInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      drilldownKind: "crm_stage",
      stepKey: "C10:NEW"
    });

    await request(app)
      .get("/api/reports/source-cohort-conversion/journey-deals")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        drilldownKind: "crm_stage",
        stepKey: "C10:UNKNOWN"
      })
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "SOURCE_COHORT_CRM_STAGE_NOT_FOUND",
          code: "SOURCE_COHORT_CRM_STAGE_NOT_FOUND"
        });
      });

    const activitiesResponse = await request(app)
      .get("/api/reports/activities-workload")
      .query({
        periodDays: 30,
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: ["2026-03-31T23:59:59.999Z"]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCreatedCount).toBe(5);
        expect(body.comparisons).toHaveLength(1);
      });
    expect(activitiesResponse.headers["cache-control"]).toContain("no-store");

    const activitiesEtag = activitiesResponse.headers.etag;
    if (!activitiesEtag) {
      throw new Error("Expected activities workload response to include an ETag");
    }
    await request(app)
      .get("/api/reports/activities-workload")
      .set("If-None-Match", activitiesEtag)
      .query({
        periodDays: 30,
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: ["2026-03-31T23:59:59.999Z"]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCreatedCount).toBe(5);
      });

    expect(receivedActivitiesInput).toEqual({
      periodDays: 30,
      compareRanges: [
        {
          from: "2026-03-01T00:00:00.000Z",
          to: "2026-03-31T23:59:59.999Z"
        }
      ]
    });

    const operationalDashboardResponse = await request(app)
      .get("/api/reports/operational-dashboard")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        managerIds: "7,9",
        sourceKeys: "WEB",
        businessClubKeys: "ClubFirst Russia",
        targetGroupKeys: "ClubFirst Future,ClubFirst Ladies"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.createdDeals).toBe(6);
        expect(body.riskSummary.total).toBe(2);
        expect(body.managers).toHaveLength(1);
        expect(body.managers[0].meetingsBySlot[0]).toEqual({
          slotIndex: 1,
          slotLabel: "Встреча 1",
          count: 1
        });
      });
    expect(operationalDashboardResponse.headers["cache-control"]).toContain(
      "no-store"
    );
    expect(receivedOperationalDashboardInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["7", "9"],
        sourceKeys: ["WEB"],
        businessClubKeys: ["ClubFirst Russia"],
        targetGroupKeys: ["ClubFirst Future", "ClubFirst Ladies"]
      }
    });

    await request(app)
      .get("/api/reports/calls-workload")
      .query({
        periodDays: 30
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCalls).toBe(7);
      });

    await request(app)
      .get("/api/reports/cohort-conversion")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        managerIds: "7,9",
        sourceKeys: "WEB,REFERRAL",
        includeBreakdown: "false"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalClosedDeals).toBe(2);
      });
    expect(receivedCohortInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["7", "9"],
        sourceKeys: ["WEB", "REFERRAL"]
      },
      includeBreakdown: false
    });

    await request(app)
      .get("/api/reports/toc-flow")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.businessDays).toBe(22);
      });

    await request(app)
      .get("/api/reports/revenue-velocity")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        dimension: "source",
        view: "createdCohort",
        asOf: "2026-05-15T00:00:00.000Z",
        managerIds: "7,9",
        sourceKeys: "WEB",
        customerKeys: "Club One,unknown",
        qualityKeys: "A",
        tariffKeys: "Premium"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.dimension).toBe("source");
        expect(body.totals.revenueVelocityPerDay).toBe(12500);
        expect(body.rows[0].sourceLabel).toBe("Сайт");
      });

    expect(receivedRevenueVelocityInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["7", "9"],
        sourceKeys: ["WEB"],
        customerKeys: ["Club One", "unknown"],
        qualityKeys: ["A"],
        tariffKeys: ["Premium"]
      },
      dimension: "source",
      view: "createdCohort",
      asOf: "2026-05-15T00:00:00.000Z"
    });

    await request(app)
      .get("/api/reports/acquisition-outcomes")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalNewDeals).toBe(3);
        expect(body.totalLostDeals).toBe(1);
      });

    await request(app)
      .get("/api/meta")
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON"]);
        expect(body.stageCatalog).toEqual(stageCatalog);
        expect(body.managerCatalog).toEqual([]);
        expect(body.sourceCatalog).toEqual([]);
        expect(body.snapshotStats).toEqual({
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18
        });
      });

    await request(app)
      .get("/api/ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
        expect(body.title).toBe("Онтология Привлечения");
      });

    await request(app)
      .get("/api/modules/attraction/ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
      });

    await request(app)
      .get("/api/ontology/sources/module_ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
        expect(body.source.id).toBe("module_ontology");
        expect(body.content).toContain("Онтология модуля");
      });

    await request(app)
      .get("/api/modules/attraction/ontology/sources/module_ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
        expect(body.source.href).toBe(
          "docs/modules/attraction/MODULE_ONTOLOGY.md"
        );
      });

    await request(app)
      .get("/api/modules/leadgen/ontology")
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });

    await request(app)
      .get("/api/modules/leadgen/ontology/sources/module_ontology")
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });

    await request(app)
      .get("/api/modules/leadgen/meta")
      .expect(200)
      .expect(({ body }) => {
        expect(body.lastSync.finishedAt).toBe("2026-05-14T12:00:00.000Z");
        expect(body.lastSync.dealsSynced).toBe(333);
        expect(body.snapshotStats).toEqual({
          deals: 4140,
          activities: 306,
          calls: 119,
          stageHistory: 13166
        });
      });

    await request(app)
      .get("/api/modules/leadgen/reports/funnel")
      .query({
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z",
        managerIds: "501",
        sourceKeys: "WEB"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalDeals).toBe(4);
      });

    expect(receivedLeadgenFunnelInput).toEqual({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      filters: {
        managerIds: ["501"],
        sourceKeys: ["WEB"]
      }
    });

    await request(app)
      .get("/api/modules/leadgen/reports/activities-workload")
      .query({
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalDealCount).toBe(2);
        expect(body.totalCreatedCount).toBe(3);
      });

    await request(app)
      .get("/api/modules/leadgen/reports/calls-workload")
      .query({
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalDealCount).toBe(2);
        expect(body.totalCalls).toBe(4);
      });

    expect(receivedLeadgenActivitiesInput).toEqual({
      range: {
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      }
    });
    expect(receivedLeadgenCallsInput).toEqual({
      range: {
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      }
    });

    await request(app)
      .post("/api/sync")
      .expect(200)
      .expect(({ body }) => {
        expect(body.syncRunId).toBe(18);
      });

    await request(app)
      .put("/api/settings/won-stages")
      .send({ stageIds: ["C1:WON", "C1:PAID"] })
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON", "C1:PAID"]);
      });
  });

  it("returns conversion events report", async () => {
    const report: ConversionEventsReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalInvitedCount: 5,
      totalConfirmedCount: 0,
      totalAttendedCount: 2,
      totalRefusedCount: 1,
      totalMissedCount: 3,
      attendanceRate: 40,
      nextStepEligibleCount: 2,
      nextStepCount: 1,
      nextStepRate: 50,
      warnings: [],
      rows: [
        {
          eventKey: "2026-04-29::Знакомство с клубом 29.04.",
          eventName: "Знакомство с клубом 29.04.",
          eventDate: "2026-04-29T00:00:00.000Z",
          invitedCount: 5,
          confirmedCount: 0,
          attendedCount: 2,
          refusedCount: 1,
          missedCount: 3,
          attendanceRate: 40,
          nextStepEligibleCount: 2,
          nextStepCount: 1,
          nextStepRate: 50,
          unlinkedCount: 0,
          unknownStatusCount: 0,
          managerBreakdown: [{ key: "78", label: "Егоров Андрей", count: 5 }],
          sourceBreakdown: [{ key: "WEB", label: "Веб", count: 5 }],
          businessClubBreakdown: [
            { key: "ClubFirst One", label: "ClubFirst One", count: 5 }
          ]
        }
      ],
      comparisons: []
    };
    const app = createTestApp({
      getConversionEventsReport: async (input) => ({
        ...report,
        range: input.range ?? report.range
      })
    });

    await request(app)
      .get(
        "/api/reports/conversion-events?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z"
      )
      .expect(200)
      .expect({
        ...report,
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        }
      });
  });

  it("reads and replaces the saved sales plan for a report period", async () => {
    let receivedReplacement: unknown = null;
    const plan: SalesPlanData = {
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      rows: [
        {
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00",
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          plannedDeals: 3,
          plannedAmount: 2500000,
          updatedAt: "2026-04-10T12:00:00.000Z"
        }
      ],
      updatedAt: "2026-04-10T12:00:00.000Z"
    };
    const app = createTestApp({
      getSalesPlan: async (input) => ({
        ...plan,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd
      }),
      replaceSalesPlan: async (input) => {
        receivedReplacement = input;
        return {
          ...plan,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          rows: input.rows.map((row) => ({
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            managerId: row.managerId,
            managerName: row.managerName ?? null,
            targetGroupKey: row.targetGroupKey,
            targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
            plannedDeals: row.plannedDeals,
            plannedAmount: row.plannedAmount,
            updatedAt: "2026-04-10T12:00:00.000Z"
          }))
        };
      }
    });

    await request(app)
      .get("/api/sales-plan")
      .query({
        from: "2026-04-01T00:00:00.000+03:00",
        to: "2026-04-30T23:59:59.999+03:00"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.rows[0]).toMatchObject({
          managerId: "78",
          targetGroupKey: "ClubFirst Russia",
          plannedDeals: 3,
          plannedAmount: 2500000
        });
      });

    await request(app)
      .put("/api/sales-plan")
      .send({
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        rows: [
          {
            managerId: "78",
            managerName: "Егоров Андрей",
            targetGroupKey: "ClubFirst Russia",
            targetGroupLabel: "ClubFirst Russia",
            plannedDeals: 4,
            plannedAmount: 3000000
          }
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.updatedAt).toBe("2026-04-10T12:00:00.000Z");
        expect(body.rows[0].plannedDeals).toBe(4);
      });

    expect(receivedReplacement).toEqual({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          plannedDeals: 4,
          plannedAmount: 3000000
        }
      ]
    });
  });

  it("reads and replaces a quarterly sales plan", async () => {
    let receivedReplacement: unknown = null;
    const quarterPlan: SalesPlanQuarterData = {
      year: 2026,
      quarter: 2,
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-06-30T23:59:59.999+03:00",
      months: [
        {
          month: "2026-04",
          label: "Апрель",
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00"
        },
        {
          month: "2026-05",
          label: "Май",
          periodStart: "2026-05-01T00:00:00.000+03:00",
          periodEnd: "2026-05-31T23:59:59.999+03:00"
        },
        {
          month: "2026-06",
          label: "Июнь",
          periodStart: "2026-06-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00"
        }
      ],
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000,
          months: [
            {
              month: "2026-04",
              periodStart: "2026-04-01T00:00:00.000+03:00",
              periodEnd: "2026-04-30T23:59:59.999+03:00",
              plannedDeals: 3,
              plannedAmount: 3000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            },
            {
              month: "2026-05",
              periodStart: "2026-05-01T00:00:00.000+03:00",
              periodEnd: "2026-05-31T23:59:59.999+03:00",
              plannedDeals: 3,
              plannedAmount: 3000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            },
            {
              month: "2026-06",
              periodStart: "2026-06-01T00:00:00.000+03:00",
              periodEnd: "2026-06-30T23:59:59.999+03:00",
              plannedDeals: 3,
              plannedAmount: 3000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            }
          ],
          updatedAt: "2026-04-10T12:00:00.000Z"
        }
      ],
      updatedAt: "2026-04-10T12:00:00.000Z"
    };
    const app = createTestApp({
      getSalesPlanQuarter: async (input) => ({
        ...quarterPlan,
        year: input.year,
        quarter: input.quarter
      }),
      replaceSalesPlanQuarter: async (input) => {
        receivedReplacement = input;
        return {
          ...quarterPlan,
          year: input.year,
          quarter: input.quarter
        };
      }
    });

    await request(app)
      .get("/api/sales-plan/quarter")
      .query({ year: "2026", quarter: "2" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.months.map((month: { month: string }) => month.month)).toEqual([
          "2026-04",
          "2026-05",
          "2026-06"
        ]);
        expect(body.rows[0]).toMatchObject({
          managerId: "78",
          targetGroupKey: "ClubFirst Russia",
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000
        });
      });

    await request(app)
      .put("/api/sales-plan/quarter")
      .send({
        year: 2026,
        quarter: 2,
        rows: [
          {
            managerId: "78",
            managerName: "Егоров Андрей",
            targetGroupKey: "ClubFirst Russia",
            targetGroupLabel: "ClubFirst Russia",
            quarterPlannedDeals: 9,
            quarterPlannedAmount: 9000000,
            months: [
              { month: "2026-04", plannedDeals: 3, plannedAmount: 3000000 },
              { month: "2026-05", plannedDeals: 3, plannedAmount: 3000000 },
              { month: "2026-06", plannedDeals: 3, plannedAmount: 3000000 }
            ]
          }
        ]
      })
      .expect(200);

    expect(receivedReplacement).toEqual({
      year: 2026,
      quarter: 2,
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000,
          months: [
            { month: "2026-04", plannedDeals: 3, plannedAmount: 3000000 },
            { month: "2026-05", plannedDeals: 3, plannedAmount: 3000000 },
            { month: "2026-06", plannedDeals: 3, plannedAmount: 3000000 }
          ]
        }
      ]
    });
  });

  it("rejects quarterly sales plans whose months do not match the quarter total", async () => {
    const app = createTestApp();

    await request(app)
      .put("/api/sales-plan/quarter")
      .send({
        year: 2026,
        quarter: 2,
        rows: [
          {
            managerId: "78",
            targetGroupKey: "ClubFirst Russia",
            quarterPlannedDeals: 9,
            quarterPlannedAmount: 9000000,
            months: [
              { month: "2026-04", plannedDeals: 5, plannedAmount: 3000000 },
              { month: "2026-05", plannedDeals: 5, plannedAmount: 3000000 },
              { month: "2026-06", plannedDeals: 5, plannedAmount: 3000000 }
            ]
          }
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("VALIDATION_ERROR");
        expect(JSON.stringify(body.details.fieldErrors)).toContain("quarter");
      });
  });

  it("reads an effective sales plan prorated for the report range", async () => {
    const app = createTestApp({
      getEffectiveSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [
          {
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            managerId: "78",
            managerName: "Егоров Андрей",
            targetGroupKey: "ClubFirst Russia",
            targetGroupLabel: "ClubFirst Russia",
            plannedDeals: 2,
            plannedAmount: 1166667,
            updatedAt: "2026-04-10T12:00:00.000Z"
          }
        ],
        updatedAt: "2026-04-10T12:00:00.000Z"
      })
    });

    await request(app)
      .get("/api/sales-plan/effective")
      .query({
        from: "2026-04-01T00:00:00.000+03:00",
        to: "2026-04-07T23:59:59.999+03:00"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.rows[0]).toMatchObject({
          managerId: "78",
          plannedDeals: 2,
          plannedAmount: 1166667
        });
      });
  });

  it("rejects concurrent sync requests while one refresh is already running", async () => {
    let resolveSync!: (value: ReturnType<typeof createSyncSummary>) => void;

    const app = createApp({
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
      getOperationalDashboardReport: async () => createEmptyOperationalDashboardReport(),
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
        allCalls: emptyCallPopulation,
        linkedDealCalls: emptyLinkedDealCalls,
        warnings: [],
        managerRows: [],
        comparisons: []
      }),
      getCallAnalysisQueue: async () => createEmptyCallAnalysisQueue(),
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
      getSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      replaceSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
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
      ...operationalThresholdSettingsService,
      getMeta: async () => ({
        stageCatalog: [],
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: emptySnapshotStats,
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-09T00:00:00.000Z",
          lastSuccessfulSync: null,
          issues: [],
          warnings: []
        }
      }),
      performSync: () =>
        new Promise<ReturnType<typeof createSyncSummary>>((resolve) => {
          resolveSync = resolve;
        }),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    });

    const firstRequest = request(app)
      .post("/api/sync")
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await request(app)
      .post("/api/sync")
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toBe("SYNC_ALREADY_RUNNING");
      });

    resolveSync(createSyncSummary({
      syncRunId: 91,
      leadsSynced: 0,
      dealsSynced: 0,
      mode: "full",
      modifiedAfter: null,
      finishedAt: "2026-04-09T00:00:00.000Z"
    }));

    await expect(firstRequest).resolves.toMatchObject({
      status: 200
    });
  });

  it("routes module sync requests to the requested module service", async () => {
    const calls: string[] = [];
    const app = createTestApp(
      {
        performSync: async () => {
          calls.push("attraction");
          return createSyncSummary({ syncRunId: 10, dealsSynced: 10 });
        }
      },
      {
        modules: {
          leadgen: {
            performSync: async () => {
              calls.push("leadgen");
              return createSyncSummary({ syncRunId: 28, dealsSynced: 3 });
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/modules/leadgen/sync")
      .expect(200)
      .expect(({ body }) => {
        expect(body.syncRunId).toBe(28);
        expect(body.dealsSynced).toBe(3);
      });

    expect(calls).toEqual(["leadgen"]);
  });

  it("runs attraction auto sync only for the attraction module on the configured interval", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const app = createTestApp(
      {
        performSync: async () => {
          calls.push("root-attraction");
          return createSyncSummary({ syncRunId: 10, dealsSynced: 10 });
        }
      },
      {
        attractionAutoSync: {
          enabled: true,
          intervalMs: 1_000,
          initialDelayMs: 1_000
        },
        modules: {
          attraction: {
            performSync: async () => {
              calls.push("attraction");
              return createSyncSummary({ syncRunId: 18, dealsSynced: 4 });
            }
          },
          leadgen: {
            performSync: async () => {
              calls.push("leadgen");
              return createSyncSummary({ syncRunId: 28, dealsSynced: 3 });
            }
          }
        }
      }
    );

    try {
      await vi.advanceTimersByTimeAsync(999);
      expect(calls).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      expect(calls).toEqual(["attraction"]);
    } finally {
      app.locals.stopAttractionAutoSync?.();
      vi.useRealTimers();
    }
  });

  it("uses an hourly fallback interval for attraction auto sync", async () => {
    vi.useFakeTimers();
    const performSync = vi.fn(async () => createSyncSummary({ syncRunId: 18 }));
    const app = createTestApp(undefined, {
      attractionAutoSync: {
        enabled: true
      },
      modules: {
        attraction: {
          performSync
        }
      }
    });

    try {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
      expect(performSync).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30 * 60 * 1_000);
      expect(performSync).toHaveBeenCalledTimes(1);
    } finally {
      app.locals.stopAttractionAutoSync?.();
      vi.useRealTimers();
    }
  });

  it("expires pending call enrichment proposals on the configured interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T10:00:00.000Z"));
    const expirePendingEnrichmentProposals = vi.fn(async () => undefined);
    const app = createTestApp(undefined, {
      callEnrichmentExpiry: {
        enabled: true,
        intervalMs: 1_000,
        initialDelayMs: 1_000,
        repository: {
          expirePendingEnrichmentProposals
        }
      }
    });

    try {
      await vi.advanceTimersByTimeAsync(999);
      expect(expirePendingEnrichmentProposals).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(expirePendingEnrichmentProposals).toHaveBeenCalledWith({
        expiredAt: "2026-06-28T10:00:01.000Z"
      });

      await vi.advanceTimersByTimeAsync(1_000);
      expect(expirePendingEnrichmentProposals).toHaveBeenCalledTimes(2);
    } finally {
      app.locals.stopCallEnrichmentExpiry?.();
      vi.useRealTimers();
    }
  });

  it("sends the daily telegram activity report at the configured local time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T16:59:59.000Z"));
    const expectedRange = {
      from: "2026-06-04T00:00:00.000+03:00",
      to: "2026-06-04T20:00:00.000+03:00"
    };
    const activityInputs: unknown[] = [];
    const callInputs: unknown[] = [];
    const sendMessage = vi.fn(async (_input: { chatId: string; text: string }) => {
      return undefined;
    });
    const app = createTestApp(
      {
        getActivitiesWorkloadReport: async (input: unknown) => {
          activityInputs.push(input);
          return createEmptyActivitiesWorkloadReport(expectedRange);
        },
        getCallsWorkloadReport: async (input: unknown) => {
          callInputs.push(input);
          return createEmptyCallsWorkloadReport(expectedRange);
        },
        getMeta: async () => ({
          stageCatalog: [],
          managerCatalog: [
            { id: "1", name: "Анна" },
            { id: "2", name: "Борис" }
          ],
          sourceCatalog: [],
          wonStageIds: [],
          defaultPeriodDays: 30,
          lastSync: {
            finishedAt: "2026-06-04T16:40:00.000Z",
            leadsSynced: 0,
            dealsSynced: 31,
            mode: "delta" as const,
            dealBreakdown: emptyDealBreakdown
          },
          snapshotStats: emptySnapshotStats,
          syncHealth: {
            status: "ready" as const,
            blocking: false,
            checkedAt: "2026-06-04T16:40:00.000Z",
            lastSuccessfulSync: "2026-06-04T16:40:00.000Z",
            issues: [],
            warnings: []
          }
        }),
        getManagerWhitelistSettings: async () => ({
          options: [
            { id: "1", name: "Анна" },
            { id: "2", name: "Борис" }
          ],
          settings: [
            {
              moduleKey: "attraction",
              managerId: "1",
              managerName: "Анна",
              enabled: true,
              sortOrder: 0,
              updatedAt: "2026-06-04T16:00:00.000Z",
              teamId: "team-1",
              teamName: "Привлечение 1.0"
            },
            {
              moduleKey: "attraction",
              managerId: "2",
              managerName: "Борис",
              enabled: true,
              sortOrder: 10,
              updatedAt: "2026-06-04T16:00:00.000Z",
              teamId: "team-2",
              teamName: "Привлечение 2.0"
            }
          ],
          teams: [
            {
              id: "team-1",
              name: "Привлечение 1.0",
              managerIds: ["1"],
              sortOrder: 0,
              updatedAt: "2026-06-04T16:00:00.000Z"
            },
            {
              id: "team-2",
              name: "Привлечение 2.0",
              managerIds: ["2"],
              sortOrder: 10,
              updatedAt: "2026-06-04T16:00:00.000Z"
            }
          ]
        })
      },
      {
        telegramActivityReport: {
          enabled: true,
          chatIds: ["101", "202"],
          teamChatIds: {
            "team-2": ["303", "101"]
          },
          time: "20:00",
          timezone: "Europe/Istanbul",
          sender: { sendMessage }
        }
      }
    );

    try {
      await vi.advanceTimersByTimeAsync(999);
      expect(sendMessage).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(activityInputs).toEqual([{ range: expectedRange }]);
      expect(callInputs).toEqual([{ range: expectedRange }]);
      expect(sendMessage).toHaveBeenCalledTimes(5);
      expect(sendMessage).toHaveBeenNthCalledWith(1, {
        chatId: "101",
        text: expect.stringContaining("Активность: Привлечение 1.0 за 04.06.2026")
      });
      expect(sendMessage).toHaveBeenNthCalledWith(2, {
        chatId: "101",
        text: expect.stringContaining("Активность: Привлечение 2.0 за 04.06.2026")
      });
      expect(sendMessage).toHaveBeenNthCalledWith(3, {
        chatId: "202",
        text: expect.stringContaining("Активность: Привлечение 1.0 за 04.06.2026")
      });
      expect(sendMessage).toHaveBeenNthCalledWith(4, {
        chatId: "202",
        text: expect.stringContaining("Активность: Привлечение 2.0 за 04.06.2026")
      });
      expect(sendMessage).toHaveBeenNthCalledWith(5, {
        chatId: "303",
        text: expect.stringContaining("Активность: Привлечение 2.0 за 04.06.2026")
      });
      expect(
        sendMessage.mock.calls.some(
          ([input]) =>
            input.chatId === "303" &&
            input.text.includes("Активность: Привлечение 1.0")
        )
      ).toBe(false);
    } finally {
      app.locals.stopTelegramActivityReport?.();
      vi.useRealTimers();
    }
  });

  it("does not schedule the telegram activity report when disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T16:59:59.000Z"));
    const sendMessage = vi.fn(async (_input: { chatId: string; text: string }) => {
      return undefined;
    });
    const getActivitiesWorkloadReport = vi.fn(async () =>
      createEmptyActivitiesWorkloadReport()
    );
    const app = createTestApp(
      { getActivitiesWorkloadReport },
      {
        telegramActivityReport: {
          enabled: false,
          chatId: "-10042",
          time: "20:00",
          timezone: "Europe/Istanbul",
          sender: { sendMessage }
        }
      }
    );

    try {
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000);
      expect(getActivitiesWorkloadReport).not.toHaveBeenCalled();
      expect(sendMessage).not.toHaveBeenCalled();
    } finally {
      app.locals.stopTelegramActivityReport?.();
      vi.useRealTimers();
    }
  });

  it("retries a failed telegram activity report send once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T16:59:59.000Z"));
    const sendMessage = vi
      .fn(async (_input: { chatId: string; text: string }) => undefined)
      .mockRejectedValueOnce(new Error("telegram unavailable"));
    const app = createTestApp(undefined, {
      telegramActivityReport: {
        enabled: true,
        chatId: "-10042",
        time: "20:00",
        timezone: "Europe/Istanbul",
        retryDelayMs: 250,
        sender: { sendMessage }
      }
    });

    try {
      await vi.advanceTimersByTimeAsync(1_000);
      expect(sendMessage).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(249);
      expect(sendMessage).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(sendMessage).toHaveBeenCalledTimes(2);
    } finally {
      app.locals.stopTelegramActivityReport?.();
      vi.useRealTimers();
    }
  });

  it("keeps manual attraction sync locked out while auto sync is running", async () => {
    vi.useFakeTimers();
    let resolveSync!: (value: ReturnType<typeof createSyncSummary>) => void;
    let keepFirstSyncPending = true;
    const performSync = vi.fn(() => {
      if (!keepFirstSyncPending) {
        return Promise.resolve(createSyncSummary({ syncRunId: 32 }));
      }

      return new Promise<ReturnType<typeof createSyncSummary>>((resolve) => {
        resolveSync = (value) => {
          keepFirstSyncPending = false;
          resolve(value);
        };
      });
    });
    const app = createTestApp(
      {
        performSync
      },
      {
        attractionAutoSync: {
          enabled: true,
          intervalMs: 1_000,
          initialDelayMs: 1_000
        }
      }
    );

    try {
      await vi.advanceTimersByTimeAsync(1_000);
      expect(performSync).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(performSync).toHaveBeenCalledTimes(1);

      await request(app)
        .post("/api/sync")
        .expect(409)
        .expect(({ body }) => {
          expect(body.error).toBe("SYNC_ALREADY_RUNNING");
        });

      resolveSync(createSyncSummary({ syncRunId: 31 }));
      await vi.advanceTimersByTimeAsync(1_000);
      expect(performSync).toHaveBeenCalledTimes(2);
    } finally {
      app.locals.stopAttractionAutoSync?.();
      vi.useRealTimers();
    }
  });

  it("streams sync progress events when requested by the web client", async () => {
    const app = createTestApp({
      performSync: async (input) => {
        input?.onProgress?.({
          syncRunId: 18,
          phase: "fetch_deals",
          progress: 35,
          message: "Получено обновлений сделок: 5"
        });

        return createSyncSummary({
          syncRunId: 18,
          dealsSynced: 5,
          finishedAt: "2026-04-09T12:00:00.000Z"
        });
      }
    });

    await request(app)
      .post("/api/sync")
      .set("Accept", "text/event-stream")
      .expect(200)
      .expect("Content-Type", /text\/event-stream/)
      .expect(({ text }) => {
        expect(text).toContain("event: progress");
        expect(text).toContain("\"phase\":\"fetch_deals\"");
        expect(text).toContain("event: complete");
        expect(text).toContain("\"syncRunId\":18");
      });
  });

  it("keeps the sync stream alive while Bitrix requests are still running", async () => {
    const app = createTestApp({
      performSync: async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return createSyncSummary({
          syncRunId: 19,
          dealsSynced: 5,
          finishedAt: "2026-04-09T12:00:00.000Z"
        });
      }
    }, {
      syncStreamHeartbeatMs: 10
    });

    await request(app)
      .post("/api/sync")
      .set("Accept", "text/event-stream")
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(": keepalive");
        expect(text).toContain("event: complete");
      });
  });

  it("validates compare range query shape", async () => {
    const app = createApp({
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
        managerRows: []
      }),
      getOperationalDashboardReport: async () => createEmptyOperationalDashboardReport(),
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
        allCalls: emptyCallPopulation,
        linkedDealCalls: emptyLinkedDealCalls,
        warnings: [],
        managerRows: []
      }),
      getCallAnalysisQueue: async () => createEmptyCallAnalysisQueue(),
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
        breakdownRows: []
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
        rows: []
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
        rows: []
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
      getSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      replaceSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
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
      ...operationalThresholdSettingsService,
      getMeta: async () => ({
        stageCatalog: [],
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: emptySnapshotStats,
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-09T00:00:00.000Z",
          lastSuccessfulSync: null,
          issues: [],
          warnings: []
        }
      }),
      performSync: async () => createSyncSummary(),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        compareFrom: [
          "2026-03-01T00:00:00.000Z",
          "2026-02-01T00:00:00.000Z",
          "2026-01-01T00:00:00.000Z",
          "2025-12-01T00:00:00.000Z",
          "2025-11-01T00:00:00.000Z",
          "2025-10-01T00:00:00.000Z"
        ],
        compareTo: [
          "2026-03-31T23:59:59.999Z",
          "2026-02-28T23:59:59.999Z",
          "2026-01-31T23:59:59.999Z",
          "2025-12-31T23:59:59.999Z",
          "2025-11-30T23:59:59.999Z",
          "2025-10-31T23:59:59.999Z"
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("VALIDATION_ERROR");
        expect(body.details.fieldErrors.compareFrom).toContain(
          "A maximum of 5 compare ranges is supported."
        );
      });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: [
          "2026-03-31T23:59:59.999Z",
          "2026-02-28T23:59:59.999Z"
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("VALIDATION_ERROR");
        expect(body.details.fieldErrors.compareFrom).toContain(
          "compareFrom and compareTo must have the same number of values."
        );
      });
  });

  it("rejects unauthorized mutating requests when an API token is configured", async () => {
    const app = createTestApp(undefined, {
      apiAuthToken: "top-secret-token"
    });

    await request(app)
      .post("/api/sync")
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "UNAUTHORIZED",
          code: "UNAUTHORIZED"
        });
      });

    await request(app)
      .put("/api/settings/won-stages")
      .send({ stageIds: ["C1:WON"] })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "UNAUTHORIZED",
          code: "UNAUTHORIZED"
        });
      });
  });

  it("accepts configured API token via X-API-Token or Authorization Bearer", async () => {
    const app = createTestApp(undefined, {
      apiAuthToken: "top-secret-token"
    });

    await request(app)
      .post("/api/sync")
      .set("X-API-Token", "top-secret-token")
      .expect(200)
      .expect(({ body }) => {
        expect(body.syncRunId).toBe(1);
      });

    await request(app)
      .put("/api/settings/won-stages")
      .set("Authorization", "Bearer top-secret-token")
      .send({ stageIds: ["C1:WON", "C1:PAID"] })
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON", "C1:PAID"]);
      });
  });

  it("returns validation errors in a stable error contract", async () => {
    const app = createTestApp();

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: [
          "2026-03-31T23:59:59.999Z",
          "2026-02-28T23:59:59.999Z"
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: "VALIDATION_ERROR",
          code: "VALIDATION_ERROR"
        });
        expect(body.details.fieldErrors.compareFrom).toContain(
          "compareFrom and compareTo must have the same number of values."
        );
      });
  });

  it("does not leak raw error messages in generic 500 responses", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const app = createTestApp({
      performSync: async () => {
        throw new Error("database password leaked");
      }
    });

    await request(app)
      .post("/api/sync")
      .expect(500)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "INTERNAL_SERVER_ERROR",
          code: "INTERNAL_SERVER_ERROR"
        });
        expect(body).not.toHaveProperty("message");
      });
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some(
          (entry) =>
            entry instanceof Error ||
            String(entry).includes("database password leaked")
        )
      )
    ).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("compares range timestamps using Date.parse instead of lexicographic ISO strings", async () => {
    let receivedInput: unknown = null;
    const app = createTestApp({
      getActivitiesWorkloadReport: async (input: unknown) => {
        receivedInput = input;
        return {
          range: {
            from: "2026-03-31T21:30:00.000Z",
            to: "2026-03-31T23:00:00.000Z"
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
        };
      }
    });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        from: "2026-04-01T00:30:00+03:00",
        to: "2026-03-31T23:00:00Z",
        compareFrom: ["2026-04-02T00:30:00+03:00"],
        compareTo: ["2026-04-01T22:00:00Z"]
      })
      .expect(200);

    expect(receivedInput).toEqual({
      range: {
        from: "2026-04-01T00:30:00+03:00",
        to: "2026-03-31T23:00:00Z"
      },
      compareRanges: [
        {
          from: "2026-04-02T00:30:00+03:00",
          to: "2026-04-01T22:00:00Z"
        }
      ]
    });
  });
});
