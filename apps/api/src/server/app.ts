import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  AttractionOntologyResponse,
  CallAnalysisQueueResponse,
  CallsWorkloadReport,
  CohortConversionReport,
  ConversionEventsReport,
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  DashboardData,
  DealPricingSettings,
  DealPricingSettingsInput,
  LeadgenFunnelReport,
  ManagerActionOutcomeReport,
  ManagerDirectoryEntry,
  ManagerWhitelistSettingsData,
  ManagerWhitelistSettingsInput,
  ManualSyncSummary,
  ModuleCapabilityManifest,
  ModuleCapabilityManifestListResponse,
  ModuleCapabilityManifestResponse,
  OperationalDashboardReport,
  OntologySourceDocumentResponse,
  OperationalThresholdSettings,
  OperationalThresholdSettingsInput,
  RevenueVelocityDimension,
  RevenueVelocityReport,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
  SnapshotStats,
  SourceCohortConversionJourneyDrilldown,
  SourceCohortConversionReport,
  SourceCatalogEntry,
  SourceQualityConversionReport,
  StageCatalogEntry,
  SyncDealChangeBreakdown,
  SyncHealth,
  SyncProgressEvent,
  SyncRunHistoryResponse,
  TargetGroupConversionReport,
  TocFlowReport,
  UnitEconomicsCostRulesInput,
  UnitEconomicsEventParticipantMode,
  UnitEconomicsSettings,
  UnitEconomicsReport
} from "@bitrix24-reporting/contracts";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import cors from "cors";
import express from "express";
import { z } from "zod";

import type {
  AuthenticatedSession,
  AuthenticatedModule,
  ModuleMembershipStatus,
  ModulePermission,
  ModuleRole,
  PasswordAuthService,
  SqliteAuthStore
} from "./auth.js";
import { AuthError, hashPassword, verifyPassword } from "./auth.js";
import type {
  DashboardCommentRecord,
  PaperclipCommentStatus,
  SqliteRepository
} from "./sqlite-repository.js";
import type {
  PlatformCommentRepository,
  ProtoCommentRepository
} from "./repository-roles.js";
import {
  registerAttractionCallRoutes,
  registerAttractionReportRoutes,
  registerAttractionSettingsRoutes
} from "./routes/attraction-routes.js";
import {
  createAttractionCallRouteHandlers,
  type CallAnalysisQueueRequest,
  type CallAnalysisRunner
} from "./routes/attraction-call-handlers.js";
import { createAttractionReportRouteHandlers } from "./routes/attraction-report-handlers.js";
import { createCommentRouteHandlers } from "./routes/comment-handlers.js";
import { registerCommentRoutes } from "./routes/comment-routes.js";
import { registerLeadgenRoutes } from "./routes/leadgen-routes.js";
import { registerModuleAdminRoutes } from "./routes/module-admin-routes.js";
import {
  registerPlatformPublicRoutes,
  registerPlatformRoutes
} from "./routes/platform-routes.js";
import { registerSyncRoutes } from "./routes/sync-routes.js";
import { registerTelegramEnrichmentRoutes } from "./routes/telegram-enrichment-routes.js";
import {
  buildManagerTeams,
  NO_ATTRACTION_MANAGER_MATCH_ID,
  resolveAttractionManagerAccessScope
} from "../domain/attraction-managers.js";
import { SOURCE_COHORT_CRM_STAGE_NOT_FOUND_ERROR_CODE } from "../domain/source-cohort-conversion-stage-drilldown.js";
import {
  type ModuleCapabilityAdapter,
  createAttractionCapabilityAdapter,
  createLeadgenCapabilityAdapter,
  createModuleCapabilityRegistry
} from "./module-capabilities.js";
import type {
  PaperclipIssueClient,
  PaperclipIssueComment
} from "./paperclip-client.js";
import type { TelegramMessageSender } from "./telegram-client.js";
import type { TelegramEnrichmentApprovalService } from "./telegram-enrichment-approval.js";
import type { TelegramManagerRegistrationService } from "./telegram-manager-registration.js";
import {
  buildDailyActivityReportRange,
  buildTelegramActivityReportDeliveries,
  getNextDailyActivityReportDelayMs
} from "./telegram-activity-report.js";
import type { TelegramActivityReportDelivery } from "./telegram-activity-report.js";
import type { AttractionMcpGateway } from "../agent/mcp-server.js";
import { registerAttractionMcpHttpRoute } from "../agent/mcp-http.js";

interface MetaResponse {
  stageCatalog: StageCatalogEntry[];
  managerCatalog: ManagerDirectoryEntry[];
  sourceCatalog: SourceCatalogEntry[];
  businessClubCatalog?: SourceCatalogEntry[];
  targetGroupCatalog?: SourceCatalogEntry[];
  wonStageIds: string[];
  defaultPeriodDays: number;
  lastSync: {
    finishedAt: string;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
    dealBreakdown: SyncDealChangeBreakdown;
  } | null;
  snapshotStats: SnapshotStats;
  syncHealth: SyncHealth;
}

interface RangeRequest {
  periodDays?: number;
  range?: {
    from: string;
    to: string;
  };
  compareRanges?: Array<{
    from: string;
    to: string;
  }>;
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
    businessClubKeys?: string[];
    targetGroupKeys?: string[];
  };
  includeBreakdown?: boolean;
  eventParticipantMode?: UnitEconomicsEventParticipantMode;
}

interface RevenueVelocityRequest extends RangeRequest {
  dimension: RevenueVelocityDimension;
  view: RevenueVelocityView;
  asOf?: string;
  filters?: RangeRequest["filters"] & {
    customerKeys?: string[];
    qualityKeys?: string[];
    tariffKeys?: string[];
  };
}

interface AppService {
  getLeadgenFunnelReport?(input: RangeRequest): Promise<LeadgenFunnelReport>;
  getDashboard(input: RangeRequest): Promise<DashboardData>;
  getSourceQualityConversionReport(
    input: RangeRequest
  ): Promise<SourceQualityConversionReport>;
  getSourceCohortConversionReport(
    input: RangeRequest
  ): Promise<SourceCohortConversionReport>;
  getSourceCohortConversionJourneyDrilldown?(
    input: RangeRequest & {
      drilldownKind?: "fact" | "crm_stage";
      stepKey: string;
    }
  ): Promise<SourceCohortConversionJourneyDrilldown>;
  getActivitiesWorkloadReport(
    input: RangeRequest
  ): Promise<ActivitiesWorkloadReport>;
  getOperationalDashboardReport(
    input: RangeRequest
  ): Promise<OperationalDashboardReport>;
  getAcquisitionOutcomesReport(
    input: RangeRequest
  ): Promise<AcquisitionOutcomesReport>;
  getTargetGroupConversionReport(
    input: RangeRequest
  ): Promise<TargetGroupConversionReport>;
  getManagerActionOutcomeReport(
    input: RangeRequest
  ): Promise<ManagerActionOutcomeReport>;
  getCallsWorkloadReport(input: RangeRequest): Promise<CallsWorkloadReport>;
  getCallAnalysisQueue(input: CallAnalysisQueueRequest): Promise<CallAnalysisQueueResponse>;
  getCallAnalysisResult?(callId: string): Promise<unknown | null>;
  getConversionEventsReport(input: RangeRequest): Promise<ConversionEventsReport>;
  getCohortConversionReport(input: RangeRequest): Promise<CohortConversionReport>;
  getTocFlowReport(input: RangeRequest): Promise<TocFlowReport>;
  getRevenueVelocityReport(
    input: RevenueVelocityRequest
  ): Promise<RevenueVelocityReport>;
  getUnitEconomicsReport(input: RangeRequest): Promise<UnitEconomicsReport>;
  getUnitEconomicsSettings(): Promise<UnitEconomicsSettings>;
  replaceUnitEconomicsCostRules(
    input: UnitEconomicsCostRulesInput
  ): Promise<UnitEconomicsSettings>;
  getSalesPlan(input: {
    periodStart: string;
    periodEnd: string;
  }): Promise<SalesPlanData>;
  replaceSalesPlan(input: SalesPlanInput): Promise<SalesPlanData>;
  getSalesPlanQuarter(input: {
    year: number;
    quarter: number;
  }): Promise<SalesPlanQuarterData>;
  replaceSalesPlanQuarter(input: SalesPlanQuarterInput): Promise<SalesPlanQuarterData>;
  getEffectiveSalesPlan(input: {
    periodStart: string;
    periodEnd: string;
  }): Promise<SalesPlanData>;
  getPricingSettings(): Promise<DealPricingSettings>;
  replacePricingSettings(input: DealPricingSettingsInput): Promise<DealPricingSettings>;
  getOperationalThresholdSettings(): Promise<OperationalThresholdSettings>;
  replaceOperationalThresholdSettings(
    input: OperationalThresholdSettingsInput
  ): Promise<OperationalThresholdSettings>;
  getAttractionOntology?(): Promise<AttractionOntologyResponse>;
  getAttractionOntologySourceDocument?(
    sourceId: string
  ): Promise<OntologySourceDocumentResponse>;
  getConversionEventTypeSettings?(): Promise<ConversionEventTypeSettingsData>;
  replaceConversionEventTypeSettings?(
    input: ConversionEventTypeSettingsInput
  ): Promise<ConversionEventTypeSettingsData>;
  getManagerWhitelistSettings?(): Promise<ManagerWhitelistSettingsData>;
  replaceManagerWhitelistSettings?(
    input: ManagerWhitelistSettingsInput
  ): Promise<ManagerWhitelistSettingsData>;
  isCallInAttractionManagerScope?(
    callId: string,
    managerIds: string[]
  ): Promise<boolean>;
  getMeta(input?: RangeRequest): Promise<MetaResponse>;
  getSyncRuns?(input?: { limit?: number }): Promise<SyncRunHistoryResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

interface ModuleService {
  getLeadgenFunnelReport?(input: RangeRequest): Promise<LeadgenFunnelReport>;
  getActivitiesWorkloadReport?(
    input: RangeRequest
  ): Promise<ActivitiesWorkloadReport>;
  getCallsWorkloadReport?(input: RangeRequest): Promise<CallsWorkloadReport>;
  getAttractionOntology?(): Promise<AttractionOntologyResponse>;
  getAttractionOntologySourceDocument?(
    sourceId: string
  ): Promise<OntologySourceDocumentResponse>;
  getMeta?(input?: RangeRequest): Promise<MetaResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
}

interface DashboardPaperclipReadyReport {
  id: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

type DashboardPaperclipThreadEntryKind =
  | "development_report"
  | "dashboard_rework"
  | "board_note"
  | "system_note";

interface DashboardPaperclipThreadEntry extends DashboardPaperclipReadyReport {
  kind: DashboardPaperclipThreadEntryKind;
}

type DashboardCommentView = DashboardCommentRecord & {
  paperclipReadyReport?: DashboardPaperclipReadyReport | null;
  paperclipThread?: DashboardPaperclipThreadEntry[];
};

interface AppConfig {
  webOrigin?: string;
  apiAuthToken?: string;
  auth?: PasswordAuthService;
  authStore?: SqliteAuthStore;
  comments?: PlatformCommentRepository;
  paperclip?: PaperclipIssueClient;
  protoComments?: ProtoCommentRepository;
  jsonBodyLimit?: string;
  trustProxy?: string | boolean | number;
  webStaticDir?: string;
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
    sender?: TelegramMessageSender;
  };
  telegramEnrichment?: {
    enabled?: boolean;
    secret?: string;
    approvalService?: TelegramEnrichmentApprovalService;
  };
  telegramManagerRegistration?: {
    enabled?: boolean;
    exportSecret?: string;
    service?: TelegramManagerRegistrationService;
    repository?: Pick<
      SqliteRepository,
      "listActiveTelegramManagerRegistrations"
    >;
  };
  callEnrichmentIntake?: {
    enabled?: boolean;
    secret?: string;
  };
  callEnrichmentExpiry?: {
    enabled?: boolean;
    intervalMs?: number;
    initialDelayMs?: number;
    repository?: Pick<SqliteRepository, "expirePendingEnrichmentProposals">;
  };
  callAnalysis?: CallAnalysisRunner;
  modules?: Record<string, ModuleService>;
  moduleCapabilityManifests?: ModuleCapabilityManifest[];
  moduleCapabilityAdapters?: ModuleCapabilityAdapter[];
  agentMcp?: {
    accessToken?: string;
    gateway?: AttractionMcpGateway;
  };
}

function parseCsvArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        typeof item === "string" ? item.split(",") : [String(item)]
      )
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function parseOptionalBoolean(value: unknown) {
  const firstValue = Array.isArray(value) ? value[0] : value;
  if (firstValue === undefined) {
    return undefined;
  }

  if (typeof firstValue === "boolean") {
    return firstValue;
  }

  if (typeof firstValue === "string") {
    const normalized = firstValue.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return firstValue;
}

function isLaterThan(from: string, to: string) {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);

  return Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs > toMs;
}

const reportQuerySchema = z
  .object({
    periodDays: z.coerce.number().int().positive().max(365).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    compareFrom: z.preprocess(
      parseCsvArray,
      z.array(z.string().datetime({ offset: true })).optional()
    ),
    compareTo: z.preprocess(
      parseCsvArray,
      z.array(z.string().datetime({ offset: true })).optional()
    ),
    managerIds: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
    sourceKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
    businessClubKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
    targetGroupKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
    includeBreakdown: z.preprocess(
      parseOptionalBoolean,
      z.boolean().optional()
    ),
    eventParticipantMode: z.enum(["invited", "attended"]).optional()
  })
  .superRefine((value, context) => {
    const hasFrom = Boolean(value.from);
    const hasTo = Boolean(value.to);

    if (hasFrom !== hasTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both from and to must be provided together.",
        path: hasFrom ? ["to"] : ["from"]
      });
      return;
    }

    if (value.from && value.to && isLaterThan(value.from, value.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must be earlier than or equal to to.",
        path: ["from"]
      });
    }

    const compareFrom = value.compareFrom ?? [];
    const compareTo = value.compareTo ?? [];

    if (compareFrom.length !== compareTo.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "compareFrom and compareTo must have the same number of values.",
        path: ["compareFrom"]
      });
      return;
    }

    if (compareFrom.length > 5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A maximum of 5 compare ranges is supported.",
        path: ["compareFrom"]
      });
    }

    for (let index = 0; index < compareFrom.length; index += 1) {
      const from = compareFrom[index];
      const to = compareTo[index];

      if (from && to && isLaterThan(from, to)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `compareFrom[${index}] must be earlier than or equal to compareTo[${index}].`,
          path: ["compareFrom", index]
        });
      }
    }
  });

const updateWonStagesSchema = z.object({
  stageIds: z.array(z.string().min(1)).min(1)
});

const protoCommentAnchorSchema = z.object({
  blockId: z.string().trim().min(1).max(500),
  blockLabel: z.string().trim().min(1).max(500),
  blockSelector: z.string().trim().min(1).max(1000),
  blockRole: z.string().trim().min(1).max(100).nullable(),
  elementSelector: z.string().trim().min(1).max(1000),
  elementLabel: z.string().trim().max(500),
  relativeX: z.number().finite().min(0).max(1),
  relativeY: z.number().finite().min(0).max(1)
});

const protoCommentSchema = z.object({
  id: z.string().trim().min(1).max(200),
  sceneId: z.string().trim().min(1).max(200),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  text: z.string().trim().min(1).max(5000),
  status: z.enum(["open", "archived"]).default("open"),
  archivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  anchor: protoCommentAnchorSchema.optional()
});

const protoCommentsBodySchema = z.object({
  comments: z.array(protoCommentSchema).max(500)
});

const commentContextSchema = z
  .object({
    filters: z.unknown().optional()
  })
  .catchall(z.unknown())
  .optional();

const createCommentBodySchema = z.object({
  sceneId: z.string().trim().min(1).max(200),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  text: z.string().trim().min(1).max(5000),
  anchor: protoCommentAnchorSchema.optional(),
  context: commentContextSchema
});

const updateCommentBodySchema = z.object({
  text: z.string().trim().min(1).max(5000).optional(),
  context: commentContextSchema
});

const reworkCommentBodySchema = z.object({
  text: z.string().trim().min(1).max(5000)
});

const PAPERCLIP_DEVELOPMENT_READY_REPORT_MARKER =
  "source: dashboard-system / development-ready-report";
const PAPERCLIP_DEVELOPMENT_READY_REPORT_HEADING = "## Готово к проверке";

const createModuleUserBodySchema = z.object({
  login: z.string().trim().min(1).max(128),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  password: z.string().min(8).max(200),
  role: z.enum(["leader", "employee"]).default("employee"),
  defaultManagerId: z.string().trim().min(1).max(100).nullable().optional()
});

const updateModuleUserBodySchema = z.object({
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(["leader", "employee"]).optional(),
  disabled: z.boolean().optional(),
  membershipStatus: z.enum(["active", "disabled"]).optional(),
  defaultManagerId: z.string().trim().min(1).max(100).nullable().optional()
});

const platformMembershipsBodySchema = z.object({
  memberships: z.array(
    z.object({
      moduleId: z.string().trim().min(1).max(100),
      role: z.enum(["leader", "employee"]),
      status: z.enum(["active", "disabled"]).default("active")
    })
  )
});

const revenueVelocityExtraQuerySchema = z.object({
  dimension: z
    .enum([
      "manager",
      "source",
      "customer",
      "managerSource",
      "sourceCustomer",
      "managerCustomer"
    ])
    .optional(),
  view: z
    .enum(["systemState", "operationalPeriod", "createdCohort"])
    .optional(),
  asOf: z.string().datetime({ offset: true }).optional(),
  customerKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
  qualityKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
  tariffKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional())
});

const salesPlanQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true })
  })
  .superRefine((value, context) => {
    if (isLaterThan(value.from, value.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must be earlier than or equal to to.",
        path: ["from"]
      });
    }
  });

const salesPlanBodySchema = z
  .object({
    periodStart: z.string().datetime({ offset: true }),
    periodEnd: z.string().datetime({ offset: true }),
    rows: z.array(
      z.object({
        managerId: z.string().min(1),
        managerName: z.string().trim().min(1).nullable().optional(),
        targetGroupKey: z.string().min(1),
        targetGroupLabel: z.string().trim().min(1).nullable().optional(),
        plannedDeals: z.number().int().nonnegative(),
        plannedAmount: z.number().finite().nonnegative()
      })
    )
  })
  .superRefine((value, context) => {
    if (isLaterThan(value.periodStart, value.periodEnd)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "periodStart must be earlier than or equal to periodEnd.",
        path: ["periodStart"]
      });
    }
  });

function expectedQuarterMonths(year: number, quarter: number) {
  const firstMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map(
    (offset) => `${year}-${String(firstMonth + offset).padStart(2, "0")}`
  );
}

const salesPlanQuarterQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.coerce.number().int().min(1).max(4)
});

const salesPlanQuarterBodySchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    quarter: z.number().int().min(1).max(4),
    rows: z.array(
      z.object({
        managerId: z.string().min(1),
        managerName: z.string().trim().min(1).nullable().optional(),
        targetGroupKey: z.string().min(1),
        targetGroupLabel: z.string().trim().min(1).nullable().optional(),
        quarterPlannedDeals: z.number().int().nonnegative(),
        quarterPlannedAmount: z.number().int().nonnegative(),
        months: z.array(
          z.object({
            month: z.string().regex(/^\d{4}-\d{2}$/),
            plannedDeals: z.number().int().nonnegative(),
            plannedAmount: z.number().int().nonnegative()
          })
        )
      })
    )
  })
  .superRefine((value, context) => {
    const expectedMonths = expectedQuarterMonths(value.year, value.quarter);

    value.rows.forEach((row, rowIndex) => {
      const monthKeys = row.months.map((month) => month.month);
      const hasExpectedMonths =
        row.months.length === expectedMonths.length &&
        expectedMonths.every((month) => monthKeys.includes(month));

      if (!hasExpectedMonths) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quarter months must match the selected quarter.",
          path: ["rows", rowIndex, "months"]
        });
      }

      const plannedDeals = row.months.reduce(
        (total, month) => total + month.plannedDeals,
        0
      );
      const plannedAmount = row.months.reduce(
        (total, month) => total + month.plannedAmount,
        0
      );

      if (plannedDeals !== row.quarterPlannedDeals) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quarter planned deals must equal the sum of month planned deals.",
          path: ["rows", rowIndex, "quarterPlannedDeals"]
        });
      }

      if (plannedAmount !== row.quarterPlannedAmount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quarter planned amount must equal the sum of month planned amounts.",
          path: ["rows", rowIndex, "quarterPlannedAmount"]
        });
      }
    });
  });

const pricingSettingsBodySchema = z.object({
  rules: z.array(
    z.object({
      id: z.string().trim().min(1),
      customerLabel: z.string().trim().min(1),
      tariffLabel: z.string().trim().min(1),
      attractionRevenueAmount: z.number().finite().nonnegative(),
      enabled: z.boolean(),
      sortOrder: z.number().int().nonnegative().nullable().optional()
    })
  )
});

const operationalThresholdSettingsBodySchema = z.object({
  stageAging: z
    .array(
      z.object({
        stageId: z.string().trim().min(1),
        maxDaysOnStage: z.number().int().positive()
      })
    )
    .min(1),
  noCallsMaxDays: z.number().int().positive(),
  noActivityMaxDays: z.number().int().positive(),
  slaBusinessHours: z.object({
    sla1: z.number().int().positive(),
    sla2: z.number().int().positive(),
    sla3: z.number().int().positive()
  })
});

const unitEconomicsCostRulesBodySchema = z.object({
  eventParticipantMode: z.enum(["invited", "attended"]).optional(),
  rules: z.array(
    z.object({
      id: z.string().trim().min(1),
      articleId: z.string().trim().min(1),
      pnlLevel: z.enum(["variable_contribution", "above_ebitda", "below_ebitda"]),
      costBehavior: z.enum(["fixed", "variable", "mixed"]),
      calculationMethod: z.enum([
        "manual_amount",
        "percent_of_module_revenue",
        "percent_of_sale",
        "percent_of_club_membership",
        "amount_per_lead",
        "amount_per_participant",
        "amount_per_contract",
        "amount_per_event",
        "amount_per_period",
        "imported_fact"
      ]),
      unitPrice: z.number().finite().nonnegative().nullable(),
      percent: z.number().finite().nonnegative().nullable(),
      amount: z.number().finite().nonnegative().nullable(),
      sourceKey: z.string().trim().min(1).nullable(),
      qualityValue: z.string().trim().min(1).nullable(),
      eventNamePattern: z.string().trim().min(1).nullable().optional(),
      enabled: z.boolean(),
      effectiveFrom: z.string().trim().min(1),
      effectiveTo: z.string().trim().min(1).nullable(),
      sortOrder: z.number().int().nonnegative()
    })
  )
});

const conversionEventTypeSettingsBodySchema = z.object({
  eventTypeIds: z.array(z.string().trim().min(1))
});

const managerWhitelistSettingsBodySchema = z.object({
  managerIds: z.array(z.string().trim().min(1)),
  teams: z
    .array(
      z.object({
        id: z.string().trim().min(1).nullable().optional(),
        name: z.string().trim().min(1),
        managerIds: z.array(z.string().trim().min(1))
      })
    )
    .optional()
});

const callAnalysisQueueQuerySchema = z.object({
  stageIds: z
    .preprocess(parseCsvArray, z.array(z.string().trim().min(1)).optional())
    .optional(),
  callTypes: z
    .preprocess(
      parseCsvArray,
      z
        .array(
          z.enum([
            "outgoing_over_30",
            "outgoing_under_30",
            "incoming",
            "unknown"
          ])
        )
        .optional()
    )
    .optional(),
  analysisStatuses: z
    .preprocess(
      parseCsvArray,
      z
        .array(z.enum(["not_analyzed", "analyzing", "ready", "error"]))
        .optional()
    )
    .optional()
});

const loginBodySchema = z.object({
  login: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024)
});

const updateCurrentUserBodySchema = z.object({
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional()
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8).max(200)
});

function parseRangeRequest(query: unknown): RangeRequest {
  const parsed = reportQuerySchema.parse(query);
  const compareRanges = (parsed.compareFrom ?? []).map((from, index) => ({
    from,
    to: parsed.compareTo?.[index] ?? from
  }));
  const filters =
    parsed.managerIds?.length ||
    parsed.sourceKeys?.length ||
    parsed.businessClubKeys?.length ||
    parsed.targetGroupKeys?.length
      ? {
          ...(parsed.managerIds?.length ? { managerIds: parsed.managerIds } : {}),
          ...(parsed.sourceKeys?.length ? { sourceKeys: parsed.sourceKeys } : {}),
          ...(parsed.businessClubKeys?.length
            ? { businessClubKeys: parsed.businessClubKeys }
            : {}),
          ...(parsed.targetGroupKeys?.length
            ? { targetGroupKeys: parsed.targetGroupKeys }
            : {})
        }
      : undefined;

  if (parsed.from && parsed.to) {
    return {
      range: {
        from: parsed.from,
        to: parsed.to
      },
      ...(compareRanges.length > 0 ? { compareRanges } : {}),
      ...(filters ? { filters } : {}),
      ...(parsed.includeBreakdown !== undefined
        ? { includeBreakdown: parsed.includeBreakdown }
        : {}),
      ...(parsed.eventParticipantMode
        ? { eventParticipantMode: parsed.eventParticipantMode }
        : {})
    };
  }

  if (parsed.periodDays) {
    return {
      periodDays: parsed.periodDays,
      ...(compareRanges.length > 0 ? { compareRanges } : {}),
      ...(filters ? { filters } : {}),
      ...(parsed.includeBreakdown !== undefined
        ? { includeBreakdown: parsed.includeBreakdown }
        : {}),
      ...(parsed.eventParticipantMode
        ? { eventParticipantMode: parsed.eventParticipantMode }
        : {})
    };
  }

  return {
    ...(compareRanges.length > 0 ? { compareRanges } : {}),
    ...(filters ? { filters } : {}),
    ...(parsed.includeBreakdown !== undefined
      ? { includeBreakdown: parsed.includeBreakdown }
      : {}),
    ...(parsed.eventParticipantMode
      ? { eventParticipantMode: parsed.eventParticipantMode }
      : {})
  };
}

function parseCallAnalysisQueueRequest(query: unknown): CallAnalysisQueueRequest {
  const base = parseRangeRequest(query);
  const parsed = callAnalysisQueueQuerySchema.parse(query);

  return {
    ...base,
    ...(parsed.stageIds?.length ? { stageIds: parsed.stageIds } : {}),
    ...(parsed.callTypes?.length ? { callTypes: parsed.callTypes } : {}),
    ...(parsed.analysisStatuses?.length
      ? { analysisStatuses: parsed.analysisStatuses }
      : {})
  };
}

function parseRevenueVelocityRequest(query: unknown): RevenueVelocityRequest {
  const base = parseRangeRequest(query);
  const extra = revenueVelocityExtraQuerySchema.parse(query);
  const filters =
    base.filters ||
    extra.customerKeys?.length ||
    extra.qualityKeys?.length ||
    extra.tariffKeys?.length
      ? {
          ...(base.filters ?? {}),
          ...(extra.customerKeys?.length ? { customerKeys: extra.customerKeys } : {}),
          ...(extra.qualityKeys?.length ? { qualityKeys: extra.qualityKeys } : {}),
          ...(extra.tariffKeys?.length ? { tariffKeys: extra.tariffKeys } : {})
        }
      : undefined;

  return {
    ...base,
    dimension: extra.dimension ?? "manager",
    view: extra.view ?? "systemState",
    ...(extra.asOf ? { asOf: extra.asOf } : {}),
    ...(filters ? { filters } : {})
  };
}

function createErrorResponse(code: string, details?: unknown) {
  return {
    error: code,
    code,
    ...(details === undefined ? {} : { details })
  };
}

function readErrorCode(error: unknown) {
  return error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

function summarizeReportQuery(request: express.Request) {
  const query = request.query as Record<string, unknown>;
  return {
    method: request.method,
    path: request.path,
    periodDays: query.periodDays ?? null,
    hasRange: Boolean(query.from && query.to),
    compareRangeCount: parseCsvArray(query.compareFrom)?.length ?? 0,
    managerFilterCount: parseCsvArray(query.managerIds)?.length ?? 0,
    sourceFilterCount: parseCsvArray(query.sourceKeys)?.length ?? 0,
    dimension: query.dimension ?? null,
    view: query.view ?? null,
    hasAsOf: Boolean(query.asOf)
  };
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      code: readErrorCode(error)
    };
  }

  return {
    name: typeof error
  };
}

function logJson(
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>
) {
  console[level](event, JSON.stringify(payload));
}

function timingErrorStatusCode(response: express.Response, error: unknown) {
  if (response.statusCode >= 400) {
    return response.statusCode;
  }

  if (error instanceof z.ZodError) {
    return 400;
  }

  if (readErrorCode(error) === SOURCE_COHORT_CRM_STAGE_NOT_FOUND_ERROR_CODE) {
    return 404;
  }

  return 500;
}

function normalizeProfileField(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMutatingMethod(method: string) {
  return mutatingMethods.has(method.toUpperCase());
}

function parseCookieHeader(value: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of value?.split(";") ?? []) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const cookieValue = part.slice(separatorIndex + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(cookieValue));
    } catch {
      // Ignore malformed cookie values and let auth fail normally.
    }
  }

  return cookies;
}

function readSessionCookie(request: express.Request, cookieName: string) {
  return parseCookieHeader(request.header("Cookie")).get(cookieName);
}

function readAuthSession(response: express.Response) {
  return response.locals.authSession as AuthenticatedSession | undefined;
}

function getModuleAccess(
  session: AuthenticatedSession | undefined,
  moduleId = "attraction"
): AuthenticatedModule | null {
  return (
    session?.user.modules.find(
      (module) => module.id === moduleId || module.slug === moduleId
    ) ?? null
  );
}

function hasModulePermission(
  module: AuthenticatedModule,
  permission: ModulePermission
) {
  return module.permissions.includes(permission);
}

function requireModuleAccess(
  response: express.Response,
  permission?: ModulePermission,
  moduleId = "attraction"
) {
  const session = readAuthSession(response);
  const module = getModuleAccess(session, moduleId);

  if (!session || !module) {
    return null;
  }

  if (permission && !hasModulePermission(module, permission)) {
    return null;
  }

  return {
    session,
    module
  };
}

function requireSuperAdmin(response: express.Response) {
  const session = readAuthSession(response);
  return session?.user.isSuperAdmin ? session : null;
}

function requestRouteParam(request: express.Request, name: string) {
  const value = request.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function requestModuleId(request: express.Request) {
  return requestRouteParam(request, "moduleId").trim() || "attraction";
}

function redactPhoneCandidate(value: string) {
  const digitCount = value.replace(/\D/g, "").length;
  return digitCount >= 10 ? "[redacted-phone]" : value;
}

function sanitizePaperclipText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, redactPhoneCandidate)
    .replace(/BITRIX24_WEBHOOK_TOKEN\s*[:=]\s*\S+/gi, "BITRIX24_WEBHOOK_TOKEN=[redacted]");
}

function formatJsonForPaperclip(value: unknown) {
  if (value === undefined || value === null) {
    return "null";
  }

  return sanitizePaperclipText(JSON.stringify(value, null, 2));
}

function buildPaperclipIssueDescription(input: {
  module: AuthenticatedModule;
  authorLogin: string;
  comment: DashboardCommentRecord;
}) {
  const anchor = input.comment.anchor
    ? {
        blockId: input.comment.anchor.blockId,
        blockLabel: input.comment.anchor.blockLabel,
        blockSelector: input.comment.anchor.blockSelector,
        blockRole: input.comment.anchor.blockRole,
        elementSelector: input.comment.anchor.elementSelector,
        elementLabel: input.comment.anchor.elementLabel,
        relativeX: input.comment.anchor.relativeX,
        relativeY: input.comment.anchor.relativeY
      }
    : null;
  const implementationInstructions =
    input.module.slug === "leadgen"
      ? [
          "- Work only in leadgen module-owned code and docs unless a shared/platform issue explicitly expands scope.",
          "- Do not change attraction UI, reports, manager whitelist, or Paperclip behavior from a leadgen comment.",
          "- Keep leadgen scoped to Bitrix category 28 and the leadgen manager whitelist.",
          "- Do not request SSH/root access as part of normal implementation.",
          "- Do not include deal/contact names, phones, emails, raw Bitrix payloads, or secrets in follow-up comments.",
          `- When ready for dashboard review, add one issue comment containing exactly this marker line followed by ${PAPERCLIP_DEVELOPMENT_READY_REPORT_HEADING}: ${PAPERCLIP_DEVELOPMENT_READY_REPORT_MARKER}. The dashboard shows only that marked ready report.`,
          "- Create a focused branch/PR through the normal GitHub/CI workflow."
        ]
      : [
          "- Work in the Bitrix24 attraction dashboard repository.",
          "- Keep attraction manager scoping intact.",
          "- Do not request SSH/root access as part of normal implementation.",
          "- Do not include deal/contact names, phones, emails, raw Bitrix payloads, or secrets in follow-up comments.",
          `- When ready for dashboard review, add one issue comment containing exactly this marker line followed by ${PAPERCLIP_DEVELOPMENT_READY_REPORT_HEADING}: ${PAPERCLIP_DEVELOPMENT_READY_REPORT_MARKER}. The dashboard shows only that marked ready report.`,
          "- Create a focused branch/PR through the normal GitHub/CI workflow."
        ];

  return [
    "## Dashboard Comment",
    "",
    `Module: ${input.module.slug}`,
    `Author login: ${sanitizePaperclipText(input.authorLogin)}`,
    `Scene: ${input.comment.sceneId}`,
    "",
    "### Anchor",
    "",
    "```json",
    formatJsonForPaperclip(anchor),
    "```",
    "",
    "### Filters And Range",
    "",
    "```json",
    formatJsonForPaperclip(input.comment.context ?? null),
    "```",
    "",
    "### Comment Text",
    "",
    sanitizePaperclipText(input.comment.text),
    "",
    "### Implementation Instructions",
    "",
    ...implementationInstructions
  ].join("\n");
}

function buildPaperclipReworkComment(input: {
  module: AuthenticatedModule;
  authorLogin: string;
  comment: DashboardCommentRecord;
  text: string;
}) {
  const anchor = input.comment.anchor
    ? {
        blockId: input.comment.anchor.blockId,
        blockLabel: input.comment.anchor.blockLabel,
        blockSelector: input.comment.anchor.blockSelector,
        blockRole: input.comment.anchor.blockRole,
        elementSelector: input.comment.anchor.elementSelector,
        elementLabel: input.comment.anchor.elementLabel,
        relativeX: input.comment.anchor.relativeX,
        relativeY: input.comment.anchor.relativeY
      }
    : null;

  return [
    "@Dashboard Engineering Manager",
    "",
    "## Возврат на доработку из dashboard review",
    "",
    `Module: ${input.module.slug}`,
    "Source: dashboard-system / board-originated rework",
    `Dashboard author login: ${sanitizePaperclipText(input.authorLogin)}`,
    `Dashboard comment id: ${sanitizePaperclipText(input.comment.id)}`,
    `Paperclip issue: ${sanitizePaperclipText(input.comment.paperclipIssueIdentifier ?? input.comment.paperclipIssueId ?? "")}`,
    "",
    "### Пользовательский комментарий",
    "",
    sanitizePaperclipText(input.text),
    "",
    "### Исходный dashboard comment",
    "",
    sanitizePaperclipText(input.comment.text),
    "",
    "### Anchor",
    "",
    "```json",
    formatJsonForPaperclip(anchor),
    "```",
    "",
    "### Filters And Range",
    "",
    "```json",
    formatJsonForPaperclip(input.comment.context ?? null),
    "```",
    "",
    "### Rework Handling",
    "",
    "- Treat this as board rework intake. Triage, delegation, blocker, and progress comments are not dashboard-ready reports.",
    "- Do not include the dashboard ready-report marker in triage, delegation, blocker, or progress comments.",
    "- Use the dashboard ready-report marker from the original issue description only after the corrected work is implemented, freshly reviewed, deployed or verified when required, and ready for dashboard review.",
    "- In the final ready report include: what was done, root cause, how it works now, and what was checked.",
    "- Если нужен продуктовый выбор, не угадывать поведение: предложить варианты и ждать board comment.",
    "- Не включать имена/контакты, телефоны, email, raw Bitrix payloads, cookies, tokens или secrets."
  ].join("\n");
}

function mapPaperclipIssueStatus(status: string | null | undefined): PaperclipCommentStatus {
  if (status === "in_progress" || status === "in_review") {
    return "in_work";
  }
  if (status === "blocked") {
    return "in_work";
  }
  if (status === "done" || status === "cancelled") {
    return "done";
  }
  return "sent";
}

function paperclipErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function paperclipErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : "";
  }

  const responseMessage = (error as { responseMessage?: unknown }).responseMessage;
  const message = error instanceof Error ? error.message : "";
  return [
    typeof responseMessage === "string" ? responseMessage : "",
    message
  ].join(" ");
}

function isPaperclipBlockedFollowUpError(error: unknown) {
  return (
    paperclipErrorStatus(error) === 409 &&
    /(?:follow-up blocked|unresolved blockers)/i.test(paperclipErrorMessage(error))
  );
}

async function addDashboardReworkComment(input: {
  paperclip: PaperclipIssueClient;
  issueId: string;
  body: string;
}) {
  try {
    await input.paperclip.addIssueComment({
      issueId: input.issueId,
      origin: "dashboard_rework",
      body: input.body,
      reopen: true
    });
  } catch (error) {
    if (!isPaperclipBlockedFollowUpError(error)) {
      throw error;
    }

    await input.paperclip.addIssueComment({
      issueId: input.issueId,
      origin: "dashboard_rework",
      body: input.body,
      reopen: false
    });
  }
}

function isDashboardOriginatedPaperclipComment(comment: PaperclipIssueComment) {
  const body = comment.body.toLowerCase();
  return (
    body.includes("source: dashboard-system / board-originated rework") ||
    body.includes("возврат на доработку из dashboard review")
  );
}

function isDevelopmentReadyReportComment(comment: PaperclipIssueComment) {
  const body = comment.body.toLowerCase();
  if (!body.includes(PAPERCLIP_DEVELOPMENT_READY_REPORT_MARKER)) {
    return false;
  }

  if (
    comment.body
      .split("\n")
      .some((line) => line.trim() === PAPERCLIP_DEVELOPMENT_READY_REPORT_HEADING)
  ) {
    return true;
  }

  return isLegacyDevelopmentReadyReportComment(comment.body);
}

function isLegacyDevelopmentReadyReportComment(body: string) {
  const normalized = body.toLowerCase();
  const contentAfterMarker = body
    .replace(new RegExp(PAPERCLIP_DEVELOPMENT_READY_REPORT_MARKER, "i"), "")
    .trim();

  return (
    /^done:/i.test(contentAfterMarker) &&
    /what was done:/i.test(body) &&
    /root cause/i.test(body) &&
    /(?:what was checked:|verified|checked|проверено)/i.test(body) &&
    /(?:ready for (?:dashboard|board|user) review|production-verified|deployed|готово к проверке)/i.test(body) &&
    !/(?:dependency-blocked|remains blocked|unresolved blockers|blocked by|заблокирован)/i.test(normalized)
  );
}

function stripDevelopmentReadyReportMarker(body: string) {
  return body
    .split("\n")
    .filter(
      (line) =>
        !line
          .trim()
          .toLowerCase()
          .includes(PAPERCLIP_DEVELOPMENT_READY_REPORT_MARKER)
    )
    .join("\n")
    .trim();
}

function toPaperclipReadyReport(
  comment: PaperclipIssueComment
): DashboardPaperclipReadyReport {
  return {
    id: comment.id,
    body: stripDevelopmentReadyReportMarker(
      sanitizePaperclipText(comment.body)
    ),
    authorAgentId: comment.authorAgentId,
    authorUserId: comment.authorUserId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

function selectPaperclipReadyReport(
  comments: PaperclipIssueComment[]
): DashboardPaperclipReadyReport | null {
  const candidates = comments
    .filter((comment) => comment.body.trim().length > 0)
    .filter((comment) => comment.authorAgentId)
    .filter((comment) => !isDashboardOriginatedPaperclipComment(comment))
    .filter(isDevelopmentReadyReportComment)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return rightTime - leftTime;
    });

  const latest = candidates[0];
  return latest ? toPaperclipReadyReport(latest) : null;
}

function writeSessionCookie(
  response: express.Response,
  auth: PasswordAuthService,
  sessionToken: string,
  expiresAt: string
) {
  response.cookie(auth.cookieName, sessionToken, {
    httpOnly: true,
    secure: auth.secureCookie,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
    maxAge: auth.ttlMs
  });
}

function clearSessionCookie(response: express.Response, auth: PasswordAuthService) {
  response.clearCookie(auth.cookieName, {
    httpOnly: true,
    secure: auth.secureCookie,
    sameSite: "lax",
    path: "/"
  });
}

function createSecurityHeadersMiddleware() {
  // Allows the fixed inline script inside the sandboxed KI playbook srcDoc iframe
  // without enabling arbitrary inline scripts for the whole dashboard.
  const playbookInlineScriptHash =
    "'sha256-tJ7YR6/OAd2ZBnGeJCPOYt9AX7VO+SvW57OnGYbol8I='";
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' ${playbookInlineScriptHash}`,
    "connect-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ");

  return (
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    response.setHeader("Content-Security-Policy", contentSecurityPolicy);
    next();
  };
}

function createApiNoStoreMiddleware() {
  return (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    if (request.path.startsWith("/api/")) {
      delete request.headers["if-none-match"];
      delete request.headers["if-modified-since"];
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");
    }

    next();
  };
}

function isDeniedWebPath(pathname: string) {
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return true;
  }

  const lowerPathname = decodedPathname.toLowerCase();
  const segments = lowerPathname.split("/").filter(Boolean);

  return (
    segments.some((segment) => segment.startsWith(".")) ||
    lowerPathname === "/.env" ||
    lowerPathname.startsWith("/.env.") ||
    lowerPathname.startsWith("/.codex") ||
    lowerPathname.startsWith("/apps/api/data") ||
    lowerPathname.startsWith("/backups")
  );
}

function getErrorCauseCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause && typeof cause === "object" && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : "";
}

function createSyncErrorResponse(error: unknown) {
  const causeCode = getErrorCauseCode(error);
  const diagnostics =
    causeCode.length > 0
      ? [`network=${causeCode}`]
    : error instanceof Error && error.name === "AbortError"
        ? error.message
          ? ["network=ABORT_TIMEOUT", `abort=${error.message}`]
          : ["network=ABORT_TIMEOUT"]
        : error instanceof Error && error.message.startsWith("Bitrix24 ")
          ? [`bitrix=${error.message}`]
      : ["error=SYNC_FAILED"];

  return createErrorResponse("SYNC_FAILED", { diagnostics });
}

function logInternalError(error: unknown) {
  const payload = {
    errorName: error instanceof Error ? error.name : typeof error,
    causeCode: getErrorCauseCode(error) || undefined
  };

  console.error("api.internal_error", JSON.stringify(payload));
}

function wantsSyncStream(request: express.Request) {
  return request.header("Accept")?.includes("text/event-stream") === true;
}

function writeSyncEvent(
  response: express.Response,
  event: "progress" | "complete" | "error",
  data: unknown
) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeSyncKeepalive(response: express.Response) {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  response.write(": keepalive\n\n");
}

function readBearerToken(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim();
}

function isBitrixCallEventRoute(request: express.Request) {
  return (
    request.method === "POST" &&
    /^\/api\/(?:modules\/[^/]+\/)?calls\/events\/bitrix$/.test(request.path)
  );
}

const localWebHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

function isAllowedWebOrigin(origin: string, webOrigin: string) {
  if (origin === webOrigin) {
    return true;
  }

  try {
    const candidate = new URL(origin);
    const configured = new URL(webOrigin);

    return (
      candidate.protocol === configured.protocol &&
      localWebHostnames.has(candidate.hostname) &&
      localWebHostnames.has(configured.hostname)
    );
  } catch {
    return false;
  }
}

export function createApp(
  service: AppService,
  config: AppConfig = {}
): express.Express {
  const app = express();
  const activeSyncByModule = new Map<string, Promise<ManualSyncSummary>>();
  const webOrigin = config.webOrigin?.trim() || "http://localhost:5173";
  const apiAuthToken = config.apiAuthToken?.trim() || undefined;
  const auth = config.auth;
  const moduleServices = new Map<string, ModuleService>([
    ["attraction", service],
    ...Object.entries(config.modules ?? {})
  ]);
  const moduleCapabilityRegistry = createModuleCapabilityRegistry({
    includeDefaultAdapters: false,
    adapters: [
      createAttractionCapabilityAdapter(service),
      createLeadgenCapabilityAdapter(moduleServices.get("leadgen")),
      ...(config.moduleCapabilityAdapters ?? [])
    ],
    ...(config.moduleCapabilityManifests
      ? { extraManifests: config.moduleCapabilityManifests }
      : {})
  });

  async function sendTimedJson<T>(input: {
    request: express.Request;
    response: express.Response;
    next: express.NextFunction;
    moduleId: string;
    route: string;
    handler: () => Promise<T>;
  }) {
    const startedAt = performance.now();

    try {
      const result = await input.handler();
      input.response.json(result);
      logJson("info", "api.report.timing", {
        moduleId: input.moduleId,
        route: input.route,
        statusCode: input.response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        ...summarizeReportQuery(input.request)
      });
    } catch (error) {
      logJson("warn", "api.report.timing", {
        moduleId: input.moduleId,
        route: input.route,
        statusCode: timingErrorStatusCode(input.response, error),
        durationMs: Math.round(performance.now() - startedAt),
        error: describeError(error),
        ...summarizeReportQuery(input.request)
      });
      input.next(error);
    }
  }

  function runAttractionAutoSync() {
    const moduleId = "attraction";
    const moduleService = moduleServices.get(moduleId) ?? service;

    if (activeSyncByModule.has(moduleId)) {
      logJson("info", "sync.auto_scheduled.skipped", {
        moduleId,
        reason: "SYNC_ALREADY_RUNNING",
        checkedAt: new Date().toISOString()
      });
      return;
    }

    const startedAt = new Date().toISOString();
    const startedMs = performance.now();
    let sync: Promise<ManualSyncSummary>;
    try {
      sync = moduleService.performSync();
    } catch (error) {
      logJson("error", "sync.auto_scheduled.failed", {
        moduleId,
        durationMs: Math.round(performance.now() - startedMs),
        failedAt: new Date().toISOString(),
        error: describeError(error)
      });
      return;
    }

    activeSyncByModule.set(moduleId, sync);
    logJson("info", "sync.auto_scheduled.started", {
      moduleId,
      startedAt
    });

    sync
      .then((summary) => {
        logJson("info", "sync.auto_scheduled.completed", {
          moduleId,
          syncRunId: summary.syncRunId,
          mode: summary.mode,
          dealsSynced: summary.dealsSynced,
          leadsSynced: summary.leadsSynced,
          durationMs: Math.round(performance.now() - startedMs),
          finishedAt: summary.finishedAt
        });
      })
      .catch((error) => {
        logJson("error", "sync.auto_scheduled.failed", {
          moduleId,
          durationMs: Math.round(performance.now() - startedMs),
          failedAt: new Date().toISOString(),
          error: describeError(error)
        });
      })
      .finally(() => {
        if (activeSyncByModule.get(moduleId) === sync) {
          activeSyncByModule.delete(moduleId);
        }
      });
  }

  function startAttractionAutoSync() {
    if (!config.attractionAutoSync?.enabled) {
      return undefined;
    }

    const intervalMs =
      config.attractionAutoSync.intervalMs &&
      Number.isFinite(config.attractionAutoSync.intervalMs) &&
      config.attractionAutoSync.intervalMs > 0
        ? config.attractionAutoSync.intervalMs
        : 60 * 60 * 1_000;
    const initialDelayMs =
      config.attractionAutoSync.initialDelayMs !== undefined &&
      Number.isFinite(config.attractionAutoSync.initialDelayMs) &&
      config.attractionAutoSync.initialDelayMs >= 0
        ? config.attractionAutoSync.initialDelayMs
        : intervalMs;

    let intervalTimer: ReturnType<typeof setInterval> | null = null;
    const initialTimer = setTimeout(() => {
      runAttractionAutoSync();
      intervalTimer = setInterval(runAttractionAutoSync, intervalMs);
      intervalTimer.unref?.();
    }, initialDelayMs);
    initialTimer.unref?.();

    logJson("info", "sync.auto_scheduled.enabled", {
      moduleId: "attraction",
      intervalMs,
      initialDelayMs
    });

    return () => {
      clearTimeout(initialTimer);
      if (intervalTimer) {
        clearInterval(intervalTimer);
      }
    };
  }

  function startTelegramActivityReport() {
    if (!config.telegramActivityReport?.enabled) {
      return undefined;
    }

    const sender = config.telegramActivityReport.sender;
    const chatIds = Array.from(
      new Set([
        ...(config.telegramActivityReport.chatIds ?? []),
        config.telegramActivityReport.chatId ?? ""
      ])
    )
      .map((chatId) => chatId.trim())
      .filter(Boolean);
    if (!sender || chatIds.length === 0) {
      throw new Error(
        "Telegram activity report requires chatIds and sender when enabled."
      );
    }
    const telegramSender = sender;
    const telegramChatIds = chatIds;
    const telegramTeamChatIds = Object.fromEntries(
      Object.entries(config.telegramActivityReport.teamChatIds ?? {}).map(
        ([teamId, configuredChatIds]) => [
          teamId,
          Array.from(
            new Set(
              configuredChatIds.map((chatId) => chatId.trim()).filter(Boolean)
            )
          )
        ]
      )
    );

    const moduleId = "attraction";
    const reportTime = config.telegramActivityReport.time ?? "20:00";
    const timezone = config.telegramActivityReport.timezone ?? "Europe/Istanbul";
    const retryDelayMs =
      config.telegramActivityReport.retryDelayMs !== undefined &&
      Number.isFinite(config.telegramActivityReport.retryDelayMs) &&
      config.telegramActivityReport.retryDelayMs >= 0
        ? config.telegramActivityReport.retryDelayMs
        : 30_000;
    let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let activeReport: Promise<void> | null = null;

    async function sendMessages(input: {
      deliveries: TelegramActivityReportDelivery[];
      attempt: number;
      startedMs: number;
      range: { from: string; to: string };
    }): Promise<void> {
      try {
        const deliveredChatIds = new Set<string>();
        let sendCount = 0;
        for (const chatId of telegramChatIds) {
          for (const delivery of input.deliveries) {
            await telegramSender.sendMessage({ chatId, text: delivery.text });
            deliveredChatIds.add(chatId);
            sendCount += 1;
          }
        }

        for (const delivery of input.deliveries) {
          if (!delivery.teamId) {
            continue;
          }

          for (const chatId of telegramTeamChatIds[delivery.teamId] ?? []) {
            if (telegramChatIds.includes(chatId)) {
              continue;
            }

            await telegramSender.sendMessage({ chatId, text: delivery.text });
            deliveredChatIds.add(chatId);
            sendCount += 1;
          }
        }

        logJson("info", "telegram.activity_report.sent", {
          moduleId,
          attempt: input.attempt,
          recipientCount: deliveredChatIds.size,
          messageCount: input.deliveries.length,
          sendCount,
          rangeFrom: input.range.from,
          rangeTo: input.range.to,
          durationMs: Math.round(performance.now() - input.startedMs),
          sentAt: new Date().toISOString()
        });
      } catch (error) {
        if (input.attempt === 0) {
          logJson("warn", "telegram.activity_report.retried", {
            moduleId,
            retryDelayMs,
            error: describeError(error)
          });

          await new Promise<void>((resolve) => {
            retryTimer = setTimeout(() => {
              retryTimer = null;
              sendMessages({
                ...input,
                attempt: input.attempt + 1
              }).finally(resolve);
            }, retryDelayMs);
            retryTimer.unref?.();
          });
          return;
        }

        logJson("error", "telegram.activity_report.failed", {
          moduleId,
          attempt: input.attempt,
          durationMs: Math.round(performance.now() - input.startedMs),
          failedAt: new Date().toISOString(),
          error: describeError(error)
        });
      }
    }

    function runTelegramActivityReport() {
      if (activeReport) {
        logJson("info", "telegram.activity_report.skipped", {
          moduleId,
          reason: "REPORT_ALREADY_RUNNING",
          checkedAt: new Date().toISOString()
        });
        return;
      }

      const startedMs = performance.now();
      const now = new Date();
      const range = buildDailyActivityReportRange({
        now,
        timezone,
        reportTime
      });
      const moduleService = moduleServices.get(moduleId) ?? service;
      const getActivitiesWorkloadReport =
        moduleService.getActivitiesWorkloadReport ??
        service.getActivitiesWorkloadReport;
      const getCallsWorkloadReport =
        moduleService.getCallsWorkloadReport ?? service.getCallsWorkloadReport;
      const getMeta = moduleService.getMeta ?? service.getMeta;
      const getManagerWhitelistSettings = service.getManagerWhitelistSettings;
      const report = Promise.all([
        getActivitiesWorkloadReport({ range }),
        getCallsWorkloadReport({ range }),
        getMeta(),
        getManagerWhitelistSettings?.()
      ])
        .then(([activities, calls, meta, managerWhitelist]) =>
          sendMessages({
            deliveries: buildTelegramActivityReportDeliveries({
              moduleName: "Привлечение",
              timezone,
              now,
              lastSyncFinishedAt: meta.lastSync?.finishedAt ?? null,
              managerCatalog: meta.managerCatalog,
              ...(managerWhitelist?.teams
                ? { managerTeams: managerWhitelist.teams }
                : {}),
              activities,
              calls
            }),
            attempt: 0,
            startedMs,
            range
          })
        )
        .catch((error) => {
          logJson("error", "telegram.activity_report.failed", {
            moduleId,
            durationMs: Math.round(performance.now() - startedMs),
            failedAt: new Date().toISOString(),
            error: describeError(error)
          });
        });

      activeReport = report;
      report.finally(() => {
        if (activeReport === report) {
          activeReport = null;
        }
      });
    }

    function scheduleNextRun() {
      const delayMs = getNextDailyActivityReportDelayMs({
        now: new Date(),
        timezone,
        reportTime
      });
      scheduleTimer = setTimeout(() => {
        runTelegramActivityReport();
        scheduleNextRun();
      }, delayMs);
      scheduleTimer.unref?.();
    }

    scheduleNextRun();
    logJson("info", "telegram.activity_report.enabled", {
      moduleId,
      reportTime,
      timezone
    });

    return () => {
      if (scheduleTimer) {
        clearTimeout(scheduleTimer);
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }

  function startCallEnrichmentExpiry() {
    if (!config.callEnrichmentExpiry?.enabled) {
      return undefined;
    }

    const repository = config.callEnrichmentExpiry.repository;
    if (!repository) {
      throw new Error("Call enrichment expiry requires a repository when enabled.");
    }
    const expirePendingEnrichmentProposals =
      repository.expirePendingEnrichmentProposals.bind(repository);

    const intervalMs =
      config.callEnrichmentExpiry.intervalMs &&
      Number.isFinite(config.callEnrichmentExpiry.intervalMs) &&
      config.callEnrichmentExpiry.intervalMs > 0
        ? config.callEnrichmentExpiry.intervalMs
        : 60 * 60 * 1_000;
    const initialDelayMs =
      config.callEnrichmentExpiry.initialDelayMs !== undefined &&
      Number.isFinite(config.callEnrichmentExpiry.initialDelayMs) &&
      config.callEnrichmentExpiry.initialDelayMs >= 0
        ? config.callEnrichmentExpiry.initialDelayMs
        : intervalMs;

    let intervalTimer: ReturnType<typeof setInterval> | null = null;

    function runExpiry() {
      const startedMs = performance.now();
      const expiredAt = new Date().toISOString();
      expirePendingEnrichmentProposals({ expiredAt })
        .then(() => {
          logJson("info", "call_enrichment.expiry.completed", {
            expiredAt,
            durationMs: Math.round(performance.now() - startedMs)
          });
        })
        .catch((error) => {
          logJson("error", "call_enrichment.expiry.failed", {
            expiredAt,
            durationMs: Math.round(performance.now() - startedMs),
            error: describeError(error)
          });
        });
    }

    const initialTimer = setTimeout(() => {
      runExpiry();
      intervalTimer = setInterval(runExpiry, intervalMs);
      intervalTimer.unref?.();
    }, initialDelayMs);
    initialTimer.unref?.();

    logJson("info", "call_enrichment.expiry.enabled", {
      intervalMs,
      initialDelayMs
    });

    return () => {
      clearTimeout(initialTimer);
      if (intervalTimer) {
        clearInterval(intervalTimer);
      }
    };
  }

  function denyIfMissingAttractionAccess(
    response: express.Response,
    options: { leaderOnly?: boolean } = {}
  ) {
    if (!auth) {
      return false;
    }

    const access = requireModuleAccess(response, undefined, "attraction");
    if (!access || (options.leaderOnly && access.module.role !== "leader")) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return true;
    }

    return false;
  }

  function denyIfMissingModuleSyncAccess(
    response: express.Response,
    moduleId: string
  ) {
    if (!auth) {
      return false;
    }

    const access = requireModuleAccess(response, undefined, moduleId);
    if (!access || access.module.role !== "leader") {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return true;
    }

    return false;
  }

  async function denyIfInvalidDefaultManager(
    response: express.Response,
    moduleId: string,
    defaultManagerId: string | null | undefined
  ) {
    if (defaultManagerId === undefined || defaultManagerId === null) {
      return false;
    }

    const managerId = defaultManagerId.trim();
    if (!managerId || moduleId !== "attraction") {
      return false;
    }

    if (!service.getManagerWhitelistSettings) {
      response.status(400).json(
        createErrorResponse("VALIDATION_ERROR", {
          field: "defaultManagerId",
          reason: "DEFAULT_MANAGER_NOT_IN_WHITELIST"
        })
      );
      return true;
    }

    const whitelist = await service.getManagerWhitelistSettings();
    const allowed = whitelist.settings.some(
      (setting) => setting.enabled && setting.managerId === managerId
    );
    if (!allowed) {
      response.status(400).json(
        createErrorResponse("VALIDATION_ERROR", {
          field: "defaultManagerId",
          reason: "DEFAULT_MANAGER_NOT_IN_WHITELIST"
        })
      );
      return true;
    }

    return false;
  }

  async function scopeAttractionRangeRequest<T extends RangeRequest>(
    response: express.Response,
    input: T
  ): Promise<T> {
    if (!auth) {
      return input;
    }

    const access = requireModuleAccess(response, undefined, "attraction");
    if (!access || access.session.user.isSuperAdmin || access.module.role === "leader") {
      return input;
    }

    if (!service.getManagerWhitelistSettings) {
      return addNoAttractionManagerMatchFilter(input);
    }

    const whitelist = await service.getManagerWhitelistSettings();
    const allowedManagerIds = resolveAttractionManagerAccessScope({
      settings: whitelist.settings,
      defaultManagerId: access.module.defaultManagerId,
      canSeeAllTeams: false
    });
    const allowedManagerIdSet = new Set(allowedManagerIds);
    const requestedManagerIds = input.filters?.managerIds ?? [];
    const scopedManagerIds =
      requestedManagerIds.length > 0
        ? requestedManagerIds.filter((managerId) => allowedManagerIdSet.has(managerId))
        : allowedManagerIds;

    if (scopedManagerIds.length === 0) {
      return addNoAttractionManagerMatchFilter(input);
    }

    return {
      ...input,
      filters: {
        ...(input.filters ?? {}),
        managerIds: scopedManagerIds
      }
    };
  }

  function addNoAttractionManagerMatchFilter<T extends RangeRequest>(input: T): T {
    return {
      ...input,
      filters: {
        ...(input.filters ?? {}),
        managerIds: [NO_ATTRACTION_MANAGER_MATCH_ID]
      }
    };
  }

  async function resolveAttractionAccessManagerIds(response: express.Response) {
    if (!auth || !service.getManagerWhitelistSettings) {
      return null;
    }

    const access = requireModuleAccess(response, undefined, "attraction");
    if (!access || access.session.user.isSuperAdmin || access.module.role === "leader") {
      return null;
    }

    const whitelist = await service.getManagerWhitelistSettings();
    return resolveAttractionManagerAccessScope({
      settings: whitelist.settings,
      defaultManagerId: access.module.defaultManagerId,
      canSeeAllTeams: false
    });
  }

  async function denyIfMissingCallAnalysisAccess(
    response: express.Response,
    callId: string
  ) {
    const allowedManagerIds = await resolveAttractionAccessManagerIds(response);
    if (!allowedManagerIds) {
      return false;
    }
    if (!service.isCallInAttractionManagerScope) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return true;
    }

    const allowed = await service.isCallInAttractionManagerScope(callId, allowedManagerIds);
    if (allowed) {
      return false;
    }

    response.status(403).json(createErrorResponse("FORBIDDEN"));
    return true;
  }

  async function scopeManagerWhitelistSettingsResponse(
    response: express.Response,
    data: ManagerWhitelistSettingsData
  ): Promise<ManagerWhitelistSettingsData> {
    const allowedManagerIds = await resolveAttractionAccessManagerIds(response);
    if (!allowedManagerIds) {
      return data;
    }

    const allowedManagerIdSet = new Set(allowedManagerIds);
    const settings = data.settings.filter((setting) =>
      allowedManagerIdSet.has(setting.managerId)
    );
    return {
      ...data,
      options: data.options.filter((manager) => allowedManagerIdSet.has(manager.id)),
      settings,
      teams: buildManagerTeams(settings)
    };
  }

  async function runSyncRequest(input: {
    request: express.Request;
    response: express.Response;
    next: express.NextFunction;
    moduleId: string;
    moduleService: ModuleService;
  }) {
    if (activeSyncByModule.has(input.moduleId)) {
      input.response.status(409).json(createErrorResponse("SYNC_ALREADY_RUNNING"));
      return;
    }

    if (wantsSyncStream(input.request)) {
      input.response.status(200);
      input.response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      input.response.setHeader("Cache-Control", "no-cache, no-transform");
      input.response.setHeader("Connection", "keep-alive");
      input.response.flushHeaders?.();

      const heartbeat = setInterval(
        () => writeSyncKeepalive(input.response),
        config.syncStreamHeartbeatMs ?? 15_000
      );

      try {
        const sync = input.moduleService.performSync({
          onProgress: (event) => {
            writeSyncEvent(input.response, "progress", event);
          }
        });
        activeSyncByModule.set(input.moduleId, sync);
        const summary = await sync;
        writeSyncEvent(input.response, "complete", summary);
        input.response.end();
      } catch (error) {
        writeSyncEvent(input.response, "error", createSyncErrorResponse(error));
        input.response.end();
      } finally {
        clearInterval(heartbeat);
        activeSyncByModule.delete(input.moduleId);
      }
      return;
    }

    try {
      const sync = input.moduleService.performSync();
      activeSyncByModule.set(input.moduleId, sync);
      input.response.json(await sync);
    } catch (error) {
      input.next(error);
    } finally {
      activeSyncByModule.delete(input.moduleId);
    }
  }

  app.disable("x-powered-by");

  if (config.trustProxy !== undefined) {
    app.set("trust proxy", config.trustProxy);
  }

  app.use(createSecurityHeadersMiddleware());
  app.use(createApiNoStoreMiddleware());

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin) {
          callback(null, false);
          return;
        }

        callback(null, isAllowedWebOrigin(origin, webOrigin) ? origin : false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Token",
        "X-CSRF-Token",
        "X-Telegram-Bot-Api-Secret-Token",
        "X-Telegram-Registration-Secret"
      ]
    })
  );
  app.use(express.json({ limit: config.jsonBodyLimit ?? "256kb" }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: config.jsonBodyLimit ?? "256kb"
    })
  );

  registerTelegramEnrichmentRoutes(app, {
    ...(config.telegramEnrichment ?? {}),
    ...(config.telegramManagerRegistration
      ? { registration: config.telegramManagerRegistration }
      : {})
  });

  if (config.agentMcp?.accessToken && config.agentMcp.gateway) {
    registerAttractionMcpHttpRoute(app, {
      accessToken: config.agentMcp.accessToken,
      gateway: config.agentMcp.gateway
    });
  }

  const stopAttractionAutoSync = startAttractionAutoSync();
  if (stopAttractionAutoSync) {
    app.locals.stopAttractionAutoSync = stopAttractionAutoSync;
  }
  const stopTelegramActivityReport = startTelegramActivityReport();
  if (stopTelegramActivityReport) {
    app.locals.stopTelegramActivityReport = stopTelegramActivityReport;
  }
  const stopCallEnrichmentExpiry = startCallEnrichmentExpiry();
  if (stopCallEnrichmentExpiry) {
    app.locals.stopCallEnrichmentExpiry = stopCallEnrichmentExpiry;
  }

  registerPlatformPublicRoutes(app, {
    login: async (request, response, next) => {
      if (!auth) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const payload = loginBodySchema.parse(request.body);
        const rateLimitKey = request.ip ?? request.socket.remoteAddress ?? "unknown";
        const loginResult = await auth.login({
          login: payload.login,
          password: payload.password,
          rateLimitKey,
          metadata: {
            ip: rateLimitKey,
            userAgent: request.header("User-Agent") ?? null
          }
        });

        writeSessionCookie(
          response,
          auth,
          loginResult.sessionToken,
          loginResult.expiresAt
        );
        response.json({
          user: loginResult.user,
          csrfToken: loginResult.csrfToken
        });
      } catch (error) {
        next(error);
      }
    }
  });

  app.use(async (request, response, next) => {
    if (!auth || !request.path.startsWith("/api/")) {
      next();
      return;
    }

    if (request.path === "/api/health" || request.path === "/api/auth/login") {
      next();
      return;
    }

    if (isBitrixCallEventRoute(request)) {
      next();
      return;
    }

    const sessionToken = readSessionCookie(request, auth.cookieName);

    if (!sessionToken) {
      response.status(401).json(createErrorResponse("UNAUTHORIZED"));
      return;
    }

    const session = await auth.getSession(sessionToken);
    if (!session) {
      clearSessionCookie(response, auth);
      response.status(401).json(createErrorResponse("SESSION_EXPIRED"));
      return;
    }

    response.locals.authSession = session;

    if (isMutatingMethod(request.method)) {
      const csrfToken = request.header("X-CSRF-Token")?.trim();
      if (!csrfToken || !auth.verifyCsrfToken(session, csrfToken)) {
        response.status(403).json(createErrorResponse("CSRF_TOKEN_INVALID"));
        return;
      }
    }

    next();
  });

  app.use((request, response, next) => {
    if (auth || !apiAuthToken || !request.path.startsWith("/api/")) {
      next();
      return;
    }

    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      next();
      return;
    }

    if (request.path === "/api/health") {
      next();
      return;
    }

    if (isBitrixCallEventRoute(request)) {
      next();
      return;
    }

    const token =
      request.header("X-API-Token")?.trim() ??
      readBearerToken(request.header("Authorization"));

    if (token === apiAuthToken) {
      next();
      return;
    }

    response.status(401).json(createErrorResponse("UNAUTHORIZED"));
  });

  registerPlatformRoutes(app, {
    health: (_request, response) => {
      response.json({ ok: true });
    },
    getCurrentUser: async (_request, response, next) => {
      if (!auth) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const session = readAuthSession(response);
        if (!session) {
          response.status(401).json(createErrorResponse("UNAUTHORIZED"));
          return;
        }

        response.json({
          user: session.user,
          csrfToken: await auth.issueCsrfToken(session)
        });
      } catch (error) {
        next(error);
      }
    },
    updateCurrentUser: async (request, response, next) => {
      if (!auth || !config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const session = readAuthSession(response);
        if (!session) {
          response.status(401).json(createErrorResponse("UNAUTHORIZED"));
          return;
        }

        const payload = updateCurrentUserBodySchema.parse(request.body);
        const user = await config.authStore.updateUserProfile({
          userId: session.user.id,
          ...(payload.firstName !== undefined
            ? { firstName: normalizeProfileField(payload.firstName) ?? null }
            : {}),
          ...(payload.lastName !== undefined
            ? { lastName: normalizeProfileField(payload.lastName) ?? null }
            : {})
        });
        if (!user) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }

        response.json({
          user: {
            id: user.id,
            login: user.login,
            firstName: user.firstName,
            lastName: user.lastName,
            role: "admin",
            isSuperAdmin: user.isSuperAdmin,
            modules: await config.authStore.listUserModules(user.id)
          },
          csrfToken: await auth.issueCsrfToken(session)
        });
      } catch (error) {
        next(error);
      }
    },
    changePassword: async (request, response, next) => {
      if (!auth || !config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const session = readAuthSession(response);
        if (!session) {
          response.status(401).json(createErrorResponse("UNAUTHORIZED"));
          return;
        }

        const payload = changePasswordBodySchema.parse(request.body);
        const user = await config.authStore.findUserByLogin(session.user.login);
        const validCurrentPassword = user
          ? await verifyPassword(payload.currentPassword, user.passwordHash)
          : false;

        if (!user || !validCurrentPassword) {
          throw new AuthError("CURRENT_PASSWORD_INVALID", 403);
        }

        await config.authStore.resetPassword({
          login: user.login,
          passwordHash: await hashPassword(payload.newPassword)
        });
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
    logout: async (_request, response, next) => {
      if (!auth) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const session = readAuthSession(response);
        if (session) {
          await auth.logout(session.sessionToken);
        }
        clearSessionCookie(response, auth);
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
    listModuleCapabilities: (_request, response) => {
      const manifests = moduleCapabilityRegistry.list();
      if (!auth) {
        const payload: ModuleCapabilityManifestListResponse = { manifests };
        response.json(payload);
        return;
      }

      const session = readAuthSession(response);
      if (!session) {
        response.status(401).json(createErrorResponse("UNAUTHORIZED"));
        return;
      }

      if (session.user.isSuperAdmin) {
        const payload: ModuleCapabilityManifestListResponse = { manifests };
        response.json(payload);
        return;
      }

      const accessibleModuleIds = new Set(
        session.user.modules.flatMap((module) => [module.id, module.slug])
      );
      const payload: ModuleCapabilityManifestListResponse = {
        manifests: manifests.filter((manifest) =>
          accessibleModuleIds.has(manifest.moduleId)
        )
      };
      response.json(payload);
    },
    getModuleCapabilities: (request, response) => {
      const moduleId = requestModuleId(request);
      const manifest = moduleCapabilityRegistry.get(moduleId);
      if (!manifest) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      if (auth && !requireModuleAccess(response, undefined, moduleId)) {
        if (requireSuperAdmin(response)) {
          const payload: ModuleCapabilityManifestResponse = { manifest };
          response.json(payload);
          return;
        }
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      const payload: ModuleCapabilityManifestResponse = { manifest };
      response.json(payload);
    },
    getPlatformAccess: async (_request, response, next) => {
      if (!config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      if (!requireSuperAdmin(response)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        response.json({
          modules: await config.authStore.listModules(),
          users: await config.authStore.listPlatformUsers()
        });
      } catch (error) {
        next(error);
      }
    },
    updatePlatformUserModuleMemberships: async (request, response, next) => {
      if (!config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      if (!requireSuperAdmin(response)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const userId = Number(request.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
          response.status(400).json(createErrorResponse("VALIDATION_ERROR"));
          return;
        }

        const payload = platformMembershipsBodySchema.parse(request.body);
        const modules = await config.authStore.listModules();
        const moduleIds = new Set(modules.map((module) => module.id));
        const unknownModule = payload.memberships.find(
          (membership) => !moduleIds.has(membership.moduleId)
        );
        if (unknownModule) {
          response
            .status(400)
            .json(createErrorResponse("UNKNOWN_MODULE", unknownModule.moduleId));
          return;
        }

        const user = await config.authStore.replaceUserModuleMemberships({
          userId,
          memberships: payload.memberships.map((membership) => ({
            moduleId: membership.moduleId,
            role: membership.role as ModuleRole,
            status: membership.status as ModuleMembershipStatus
          }))
        });
        if (!user) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }

        response.json({ user });
      } catch (error) {
        next(error);
      }
    }
  });

  registerAttractionCallRoutes(
    app,
    createAttractionCallRouteHandlers({
      service,
      ...(config.callAnalysis ? { callAnalysis: config.callAnalysis } : {}),
      parseCallAnalysisQueueRequest,
      ...(config.callEnrichmentIntake
        ? { callEnrichmentIntake: config.callEnrichmentIntake }
        : {}),
      scopeCallAnalysisQueueRequest: (_request, response, input) =>
        scopeAttractionRangeRequest(response, input),
      denyIfMissingCallAnalysisAccess: (_request, response, callId) =>
        denyIfMissingCallAnalysisAccess(response, callId),
      denyIfMissingAttractionAccess
    })
  );

  async function deliverCommentToPaperclip(
    comment: DashboardCommentRecord,
    module: AuthenticatedModule
  ) {
    if (!config.comments) {
      return comment;
    }

    if (comment.paperclipIssueId) {
      return comment;
    }

    if (!config.paperclip || !module.paperclipCompanyId) {
      return config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipStatus: "failed",
        paperclipSyncStatus: "failed",
        paperclipError: "Paperclip integration is not configured.",
        paperclipLastSyncedAt: new Date().toISOString()
      });
    }

    try {
      await config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipStatus: "queued",
        paperclipSyncStatus: "syncing",
        paperclipError: null
      });
      const issue = await config.paperclip.createIssue({
        companyId: module.paperclipCompanyId,
        projectId: module.paperclipProjectId,
        goalId: module.paperclipGoalId,
        assigneeAgentId: module.paperclipTriageAgentId,
        title: `Dashboard comment: ${comment.anchor?.blockLabel ?? comment.sceneId}`,
        description: buildPaperclipIssueDescription({
          module,
          authorLogin: comment.authorLogin,
          comment
        }),
        priority: "medium"
      });

      return config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipIssueId: issue.id,
        paperclipIssueIdentifier: issue.identifier,
        paperclipStatus: mapPaperclipIssueStatus(issue.status),
        paperclipSyncStatus: "sent",
        paperclipError: null,
        paperclipLastSyncedAt: new Date().toISOString()
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Paperclip issue creation failed.";
      return config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipStatus: "failed",
        paperclipSyncStatus: "failed",
        paperclipError: message,
        paperclipLastSyncedAt: new Date().toISOString(),
        incrementRetryCount: true
      });
    }
  }

  async function loadPaperclipIssueComments(
    comment: DashboardCommentRecord
  ): Promise<PaperclipIssueComment[]> {
    if (!config.paperclip || !comment.paperclipIssueId) {
      return [];
    }

    try {
      return await config.paperclip.listIssueComments({
        issueId: comment.paperclipIssueId
      });
    } catch {
      return [];
    }
  }

  async function loadPaperclipContext(
    comment: DashboardCommentRecord
  ): Promise<{
    paperclipReadyReport: DashboardPaperclipReadyReport | null;
    paperclipThread: DashboardPaperclipThreadEntry[];
  }> {
    const issueComments =
      comment.paperclipStatus === "done"
        ? await loadPaperclipIssueComments(comment)
        : [];

    return {
      paperclipReadyReport:
        comment.paperclipStatus === "done"
          ? selectPaperclipReadyReport(issueComments)
          : null,
      paperclipThread: []
    };
  }

  async function refreshCommentPaperclipStatus(
    comment: DashboardCommentRecord
  ): Promise<DashboardCommentView> {
    if (!config.comments || !config.paperclip || !comment.paperclipIssueId) {
      return comment;
    }

    try {
      const issue = await config.paperclip.getIssue({
        issueId: comment.paperclipIssueId
      });
      const paperclipIssueId = issue.id || comment.paperclipIssueId;
      const paperclipIssueIdentifier =
        issue.identifier ?? comment.paperclipIssueIdentifier;
      const paperclipStatus = mapPaperclipIssueStatus(issue.status);
      const hasPaperclipChange =
        paperclipIssueId !== comment.paperclipIssueId ||
        paperclipIssueIdentifier !== comment.paperclipIssueIdentifier ||
        paperclipStatus !== comment.paperclipStatus ||
        comment.paperclipSyncStatus !== "sent" ||
        comment.paperclipError !== null;

      if (!hasPaperclipChange) {
        const paperclipContext = await loadPaperclipContext(comment);
        return { ...comment, ...paperclipContext };
      }

      const updated = await config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipIssueId,
        paperclipIssueIdentifier,
        paperclipStatus,
        paperclipSyncStatus: "sent",
        paperclipError: null,
        paperclipLastSyncedAt: new Date().toISOString()
      });
      const nextComment = updated ?? comment;
      const paperclipContext = await loadPaperclipContext(nextComment);
      return { ...nextComment, ...paperclipContext };
    } catch {
      return comment;
    }
  }

  async function refreshOpenDashboardComments(
    comments: DashboardCommentRecord[]
  ): Promise<DashboardCommentView[]> {
    return Promise.all(
      comments.map((comment) =>
        (comment.status ?? "open") === "open"
          ? refreshCommentPaperclipStatus(comment)
          : comment
      )
    );
  }

  registerCommentRoutes(
    app,
    createCommentRouteHandlers({
      ...(config.comments ? { comments: config.comments } : {}),
      ...(config.protoComments ? { protoComments: config.protoComments } : {}),
      ...(config.paperclip ? { paperclip: config.paperclip } : {}),
      parseProtoCommentsBody: (body) => protoCommentsBodySchema.parse(body),
      parseCreateCommentBody: (body) => createCommentBodySchema.parse(body),
      parseUpdateCommentBody: (body) => updateCommentBodySchema.parse(body),
      parseReworkCommentBody: (body) => reworkCommentBodySchema.parse(body),
      requireModuleAccess,
      deliverCommentToPaperclip,
      refreshOpenDashboardComments,
      addDashboardReworkComment,
      buildPaperclipReworkComment,
      createId: randomUUID,
      now: () => new Date().toISOString()
    })
  );

  registerModuleAdminRoutes(app, {
    listModuleUsers: async (request, response, next) => {
      if (!config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      const access = requireModuleAccess(
        response,
        "module-users:manage",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        response.json({ users: await config.authStore.listModuleUsers(access.module.id) });
      } catch (error) {
        next(error);
      }
    },
    createModuleUser: async (request, response, next) => {
      if (!config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      const access = requireModuleAccess(
        response,
        "module-users:manage",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const payload = createModuleUserBodySchema.parse(request.body);
        const existing = await config.authStore.findUserByLogin(payload.login);
        if (existing) {
          response.status(409).json(createErrorResponse("USER_ALREADY_EXISTS"));
          return;
        }
        if (
          await denyIfInvalidDefaultManager(
            response,
            access.module.id,
            payload.defaultManagerId
          )
        ) {
          return;
        }

        const user = await config.authStore.createUser({
          login: payload.login,
          firstName: normalizeProfileField(payload.firstName) ?? null,
          lastName: normalizeProfileField(payload.lastName) ?? null,
          passwordHash: await hashPassword(payload.password)
        });

        try {
          await config.authStore.setModuleMembership({
            userId: user.id,
            moduleId: access.module.id,
            role: payload.role,
            status: "active",
            defaultManagerId: payload.defaultManagerId ?? null
          });
          const moduleUser = await config.authStore.updateModuleUser({
            userId: user.id,
            moduleId: access.module.id
          });
          if (!moduleUser) {
            throw new Error("Failed to read created module user.");
          }
          response.status(201).json({ user: moduleUser });
        } catch (createMembershipError) {
          try {
            await config.authStore.deleteUser(user.id);
          } catch (cleanupError) {
            logInternalError(cleanupError);
          }
          throw createMembershipError;
        }
      } catch (error) {
        next(error);
      }
    },
    updateModuleUser: async (request, response, next) => {
      if (!config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      const access = requireModuleAccess(
        response,
        "module-users:manage",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const userId = Number(request.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
          response.status(400).json(createErrorResponse("VALIDATION_ERROR"));
          return;
        }
        const payload = updateModuleUserBodySchema.parse(request.body);
        if (
          await denyIfInvalidDefaultManager(
            response,
            access.module.id,
            payload.defaultManagerId
          )
        ) {
          return;
        }
        const user = await config.authStore.updateModuleUser({
          userId,
          moduleId: access.module.id,
          ...(payload.firstName !== undefined
            ? { firstName: normalizeProfileField(payload.firstName) ?? null }
            : {}),
          ...(payload.lastName !== undefined
            ? { lastName: normalizeProfileField(payload.lastName) ?? null }
            : {}),
          ...(payload.password ? { passwordHash: await hashPassword(payload.password) } : {}),
          ...(payload.role ? { role: payload.role as ModuleRole } : {}),
          ...(payload.membershipStatus
            ? { membershipStatus: payload.membershipStatus }
            : {}),
          ...(payload.defaultManagerId !== undefined
            ? { defaultManagerId: payload.defaultManagerId ?? null }
            : {})
        });
        if (!user) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }
        response.json({ user });
      } catch (error) {
        next(error);
      }
    },
    deleteModuleUser: async (request, response, next) => {
      if (!config.authStore) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      const access = requireModuleAccess(
        response,
        "module-users:manage",
        requestModuleId(request)
      );
      if (!access) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      try {
        const userId = Number(request.params.id);
        if (!Number.isInteger(userId) || userId <= 0) {
          response.status(400).json(createErrorResponse("VALIDATION_ERROR"));
          return;
        }
        if (userId === access.session.user.id) {
          response.status(400).json(createErrorResponse("CANNOT_DELETE_SELF"));
          return;
        }

        const user = await config.authStore.updateModuleUser({
          userId,
          moduleId: access.module.id,
          membershipStatus: "disabled"
        });
        if (!user) {
          response.status(404).json(createErrorResponse("NOT_FOUND"));
          return;
        }
        response.json({ user });
      } catch (error) {
        next(error);
      }
    }
  });

  registerLeadgenRoutes(app, {
    notFound: (_request, response) => {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
    },
    getFunnelReport: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "leadgen") {
        next("route");
        return;
      }

      if (auth && !requireModuleAccess(response, undefined, moduleId)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      const moduleService = moduleServices.get(moduleId);
      const getLeadgenFunnelReport = moduleService?.getLeadgenFunnelReport;
      if (!getLeadgenFunnelReport) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId,
        route: "leadgen.funnel",
        handler: () =>
          getLeadgenFunnelReport(parseRangeRequest(request.query))
      });
    },
    getActivitiesWorkloadReport: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "leadgen") {
        next("route");
        return;
      }

      if (auth && !requireModuleAccess(response, undefined, moduleId)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      const moduleService = moduleServices.get(moduleId);
      const getActivitiesWorkloadReport =
        moduleService?.getActivitiesWorkloadReport;
      if (!getActivitiesWorkloadReport) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId,
        route: "leadgen.activities-workload",
        handler: () =>
          getActivitiesWorkloadReport(parseRangeRequest(request.query))
      });
    },
    getCallsWorkloadReport: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      if (moduleId !== "leadgen") {
        next("route");
        return;
      }

      if (auth && !requireModuleAccess(response, undefined, moduleId)) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      const moduleService = moduleServices.get(moduleId);
      const getCallsWorkloadReport = moduleService?.getCallsWorkloadReport;
      if (!getCallsWorkloadReport) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      await sendTimedJson({
        request,
        response,
        next,
        moduleId,
        route: "leadgen.calls-workload",
        handler: () => getCallsWorkloadReport(parseRangeRequest(request.query))
      });
    }
  });

  registerAttractionReportRoutes(
    app,
    createAttractionReportRouteHandlers({
      service,
      getModuleService: (moduleId) => moduleServices.get(moduleId),
      authEnabled: Boolean(auth),
      denyIfMissingAttractionAccess,
      requireModuleAccess,
      parseRangeRequest,
      parseRevenueVelocityRequest,
      scopeRangeRequest: (_request, response, input) =>
        scopeAttractionRangeRequest(response, input),
      scopeRevenueVelocityRequest: (_request, response, input) =>
        scopeAttractionRangeRequest(response, input),
      sendTimedJson
    })
  );

  registerAttractionSettingsRoutes(app, {
    getSalesPlan: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        const query = salesPlanQuerySchema.parse(request.query);
        response.json(
          await service.getSalesPlan({
            periodStart: query.from,
            periodEnd: query.to
          })
        );
      } catch (error) {
        next(error);
      }
    },
    replaceSalesPlan: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      try {
        const payload = salesPlanBodySchema.parse(request.body);
        response.json(await service.replaceSalesPlan(payload));
      } catch (error) {
        next(error);
      }
    },
    getSalesPlanQuarter: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        const query = salesPlanQuarterQuerySchema.parse(request.query);
        response.json(
          await service.getSalesPlanQuarter({
            year: query.year,
            quarter: query.quarter
          })
        );
      } catch (error) {
        next(error);
      }
    },
    replaceSalesPlanQuarter: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      try {
        const payload = salesPlanQuarterBodySchema.parse(request.body);
        response.json(await service.replaceSalesPlanQuarter(payload));
      } catch (error) {
        next(error);
      }
    },
    getEffectiveSalesPlan: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        const query = salesPlanQuerySchema.parse(request.query);
        response.json(
          await service.getEffectiveSalesPlan({
            periodStart: query.from,
            periodEnd: query.to
          })
        );
      } catch (error) {
        next(error);
      }
    },
    getPricingSettings: async (_request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        response.json(await service.getPricingSettings());
      } catch (error) {
        next(error);
      }
    },
    replacePricingSettings: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      try {
        const payload = pricingSettingsBodySchema.parse(request.body);
        response.json(
          await service.replacePricingSettings({
            rules: payload.rules.map((rule, index) => ({
              id: rule.id,
              customerLabel: rule.customerLabel,
              tariffLabel: rule.tariffLabel,
              attractionRevenueAmount: rule.attractionRevenueAmount,
              enabled: rule.enabled,
              sortOrder: rule.sortOrder ?? index * 10
            }))
          })
        );
      } catch (error) {
        next(error);
      }
    },
    getOperationalThresholdSettings: async (_request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        response.json(await service.getOperationalThresholdSettings());
      } catch (error) {
        next(error);
      }
    },
    replaceOperationalThresholdSettings: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      try {
        const payload = operationalThresholdSettingsBodySchema.parse(request.body);
        response.json(await service.replaceOperationalThresholdSettings(payload));
      } catch (error) {
        next(error);
      }
    },
    getUnitEconomicsSettings: async (_request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      try {
        response.json(await service.getUnitEconomicsSettings());
      } catch (error) {
        next(error);
      }
    },
    replaceUnitEconomicsCostRules: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      try {
        const payload = unitEconomicsCostRulesBodySchema.parse(request.body);
        const normalizedPayload: UnitEconomicsCostRulesInput = {
          ...(payload.eventParticipantMode
            ? { eventParticipantMode: payload.eventParticipantMode }
            : {}),
          rules: payload.rules.map((rule) => ({
            ...rule,
            eventNamePattern: rule.eventNamePattern ?? null
          }))
        };
        response.json(await service.replaceUnitEconomicsCostRules(normalizedPayload));
      } catch (error) {
        next(error);
      }
    },
    getConversionEventTypeSettings: async (_request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      if (!service.getConversionEventTypeSettings) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(await service.getConversionEventTypeSettings());
      } catch (error) {
        next(error);
      }
    },
    replaceConversionEventTypeSettings: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      if (!service.replaceConversionEventTypeSettings) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const payload = conversionEventTypeSettingsBodySchema.parse(request.body);
        response.json(await service.replaceConversionEventTypeSettings(payload));
      } catch (error) {
        next(error);
      }
    },
    getManagerWhitelistSettings: async (_request, response, next) => {
      if (denyIfMissingAttractionAccess(response)) {
        return;
      }

      if (!service.getManagerWhitelistSettings) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        response.json(
          await scopeManagerWhitelistSettingsResponse(
            response,
            await service.getManagerWhitelistSettings()
          )
        );
      } catch (error) {
        next(error);
      }
    },
    replaceManagerWhitelistSettings: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      if (!service.replaceManagerWhitelistSettings) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      try {
        const payload = managerWhitelistSettingsBodySchema.parse(request.body);
        const managerWhitelistInput: ManagerWhitelistSettingsInput = {
          managerIds: payload.managerIds,
          ...(payload.teams !== undefined
            ? {
                teams: payload.teams.map((team) => ({
                  name: team.name,
                  managerIds: team.managerIds,
                  ...(team.id !== undefined ? { id: team.id } : {})
                }))
              }
            : {})
        };
        const result = await service.replaceManagerWhitelistSettings(managerWhitelistInput);
        if (config.authStore) {
          await config.authStore.clearModuleDefaultManagersExcept({
            moduleId: "attraction",
            managerIds: managerWhitelistInput.managerIds
          });
        }
        response.json(result);
      } catch (error) {
        next(error);
      }
    },
    updateWonStages: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      try {
        const payload = updateWonStagesSchema.parse(request.body);
        response.json(await service.updateWonStages(payload.stageIds));
      } catch (error) {
        next(error);
      }
    }
  });

  registerSyncRoutes(app, {
    syncAttraction: async (request, response, next) => {
      if (denyIfMissingAttractionAccess(response, { leaderOnly: true })) {
        return;
      }

      await runSyncRequest({
        request,
        response,
        next,
        moduleId: "attraction",
        moduleService: service
      });
    },
    syncModule: async (request, response, next) => {
      const moduleId = requestModuleId(request);
      const moduleService = moduleServices.get(moduleId);
      if (!moduleService) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      if (denyIfMissingModuleSyncAccess(response, moduleId)) {
        return;
      }

      await runSyncRequest({
        request,
        response,
        next,
        moduleId,
        moduleService
      });
    }
  });

  if (config.webStaticDir) {
    app.use((request, response, next) => {
      if (
        !request.path.startsWith("/api/") &&
        isDeniedWebPath(request.path)
      ) {
        response.status(404).end();
        return;
      }

      next();
    });
    app.use(
      express.static(config.webStaticDir, {
        dotfiles: "deny",
        index: false
      })
    );
    app.use((request, response, next) => {
      if (
        request.path.startsWith("/api/") ||
        !["GET", "HEAD"].includes(request.method)
      ) {
        next();
        return;
      }

      response.sendFile(
        "index.html",
        {
          root: config.webStaticDir,
          dotfiles: "deny"
        },
        (error) => {
          if (error) {
            next(error);
          }
        }
      );
    });
  }

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof AuthError) {
        response.status(error.status).json(createErrorResponse(error.code));
        return;
      }

      if (error instanceof z.ZodError) {
        response
          .status(400)
          .json(createErrorResponse("VALIDATION_ERROR", error.flatten()));
        return;
      }

      if (
        readErrorCode(error) ===
        SOURCE_COHORT_CRM_STAGE_NOT_FOUND_ERROR_CODE
      ) {
        response
          .status(404)
          .json(
            createErrorResponse(
              SOURCE_COHORT_CRM_STAGE_NOT_FOUND_ERROR_CODE
            )
          );
        return;
      }

      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error as { type?: unknown }).type === "entity.too.large"
      ) {
        response.status(413).json(createErrorResponse("PAYLOAD_TOO_LARGE"));
        return;
      }

      logInternalError(error);

      response.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  );

  return app;
}
