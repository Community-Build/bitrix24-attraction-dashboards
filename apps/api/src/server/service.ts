import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomesReportSnapshot,
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  ConversionEventsReport,
  ConversionEventsReportSnapshot,
  AttractionOntologyResponse,
  OntologySourceDocumentResponse,
  ActivitySnapshot,
  CallAnalysisQueueCallType,
  CallAnalysisQueueItem,
  CallAnalysisQueueResponse,
  CallAnalysisQueueStatus,
  CallSnapshot,
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  DashboardData,
  DashboardSnapshot,
  DealSnapshot,
  DealPricingSettings,
  DealPricingSettingsInput,
  LeadgenFunnelReport,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeReportSnapshot,
  ManagerDirectoryEntry,
  ManagerWhitelistSettingsData,
  ManagerWhitelistSettingsInput,
  ManualSyncSummary,
  OperationalDashboardReport,
  OperationalThresholdSettings,
  OperationalThresholdSettingsInput,
  ReportRange,
  ReportFilters,
  RevenueVelocityDimension,
  RevenueVelocityReport,
  RevenueVelocityReportSnapshot,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
  SalesPlanQuarterMonth,
  SourceCatalogEntry,
  SourceCohortConversionJourneyCoreStepKey,
  SourceCohortConversionJourneyDrilldown,
  SourceCohortConversionReport,
  SourceCohortConversionReportSnapshot,
  SourceQualityConversionReport,
  SourceQualityConversionReportSnapshot,
  SnapshotStats,
  StageCatalogEntry,
  StageHistorySnapshot,
  SyncHealth,
  SyncHealthIssue,
  SyncDealChangeBreakdown,
  SyncProgressEvent,
  SyncRunHistoryResponse,
  TargetGroupConversionReport,
  TargetGroupConversionReportSnapshot,
  TocFlowReport,
  TocFlowReportSnapshot,
  UnitEconomicsCostRulesInput,
  UnitEconomicsEventParticipantMode,
  UnitEconomicsReport,
  UnitEconomicsSettings
} from "@bitrix24-reporting/contracts";

import {
  buildActivitiesWorkloadReport,
  buildAcquisitionOutcomesReport,
  buildCohortConversionReport,
  buildCallsWorkloadReport,
  buildManagerActionOutcomeReport,
  buildSourceCohortConversionReport,
  buildSourceQualityConversionReport,
  buildTargetGroupConversionReport
} from "../domain/operational-reports.js";
import {
  OPERATIONAL_LOST_STAGE_IDS,
  buildOperationalDashboardReport
} from "../domain/operational-dashboard.js";
import {
  ATTRACTION_MANAGER_CATALOG,
  buildManagerTeams,
  normalizeAttractionManagerFilters,
  sortAttractionManagers
} from "../domain/attraction-managers.js";
import { buildTocFlowReport } from "../domain/toc-report.js";
import { buildRevenueVelocityReport } from "../domain/revenue-velocity.js";
import { buildUnitEconomicsReport } from "../domain/unit-economics.js";
import { buildConversionEventsReport } from "../domain/conversion-events.js";
import {
  loadAttractionOntology,
  loadAttractionOntologySourceDocument
} from "../domain/attraction-ontology.js";
import {
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  UNATTRIBUTED_SOURCE_KEY,
  UNASSIGNED_MANAGER_ID,
  UNASSIGNED_MANAGER_NAME
} from "../domain/report-dimensions.js";
import { buildDashboard } from "../domain/reporting.js";
import {
  buildConversionEventTouchpointFacts,
  buildDealStageFacts,
  buildDealTouchpointFacts,
  buildEventVisitFacts,
  buildIdentityLinks
} from "../domain/analytics-facts.js";
import {
  stageFactsToStageHistory,
  touchpointFactsToActivities,
  touchpointFactsToCalls,
  touchpointFactsToMeetingDateChanges
} from "../domain/fact-report-adapters.js";
import {
  ACTIVITY_HISTORY_COVERAGE_VERSION,
  CALL_STATS_COVERAGE_PROVIDER,
  CALL_STATS_COVERAGE_STREAM,
  CALL_STATS_COVERAGE_VERSION,
  buildCategoryScopeKey,
  CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER,
  CONVERSION_EVENT_VISITS_COVERAGE_STREAM,
  CONVERSION_EVENT_VISITS_COVERAGE_VERSION,
  DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
  DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
  DEAL_CUSTOM_FIELDS_COVERAGE_VERSION,
  DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
  DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION,
  FULL_COVERAGE_FROM,
  LEADGEN_US_CATEGORY_ID,
  performManualSync
} from "../domain/sync.js";
import type { SyncClient } from "../domain/sync.js";
import type { ReportingRepository } from "./repository-roles.js";
import type {
  CallAnalysisResultRecord,
  CallAnalysisRunSummary
} from "./sqlite-repository.js";

interface CreateReportingServiceInput {
  dealCategoryIds: string[];
  leadgenCategoryId?: string;
  leadgenManagerIds?: string[];
  workloadScope?: "attraction" | "leadgen";
  qualityFieldName: string;
  tariffFieldName?: string;
  businessClubFieldName?: string;
  targetGroupFieldName?: string;
  meetingTypeFieldName?: string;
  meetingDateFieldName?: string;
  contactTargetGroupFieldName?: string;
  legacyContactTargetGroupFieldName?: string;
  repository: ReportingRepository;
  client: SyncClient;
  defaultPeriodDays: number;
  bootstrapLookbackDays?: number;
  bitrixPortalHost?: string;
  now?: () => Date;
}

export interface ReportingService {
  getLeadgenFunnelReport(input: {
    periodDays?: number;
    range?: ReportRange;
    filters?: ReportFilters;
  }): Promise<LeadgenFunnelReport>;
  getDashboard(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<DashboardData>;
  getSourceQualityConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<SourceQualityConversionReport>;
  getSourceCohortConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<SourceCohortConversionReport>;
  getSourceCohortConversionJourneyDrilldown(input: {
    periodDays?: number;
    range?: ReportRange;
    filters?: ReportFilters;
    stepKey: SourceCohortConversionJourneyCoreStepKey;
  }): Promise<SourceCohortConversionJourneyDrilldown>;
  getActivitiesWorkloadReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<ActivitiesWorkloadReport>;
  getOperationalDashboardReport(input: {
    periodDays?: number;
    range?: ReportRange;
    filters?: ReportFilters;
  }): Promise<OperationalDashboardReport>;
  getAcquisitionOutcomesReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<AcquisitionOutcomesReport>;
  getTargetGroupConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<TargetGroupConversionReport>;
  getManagerActionOutcomeReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<ManagerActionOutcomeReport>;
  getCallsWorkloadReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<CallsWorkloadReport>;
  getCallAnalysisQueue(input: {
    periodDays?: number;
    range?: ReportRange;
    filters?: ReportFilters;
    stageIds?: string[];
    callTypes?: CallAnalysisQueueCallType[];
    analysisStatuses?: CallAnalysisQueueStatus[];
  }): Promise<CallAnalysisQueueResponse>;
  getConversionEventsReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<ConversionEventsReport>;
  getCohortConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
    includeBreakdown?: boolean;
  }): Promise<CohortConversionReport>;
  getTocFlowReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<TocFlowReport>;
  getRevenueVelocityReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters & {
      customerKeys?: string[];
      qualityKeys?: string[];
      tariffKeys?: string[];
    };
    dimension?: RevenueVelocityDimension;
    view?: RevenueVelocityView;
    asOf?: string;
  }): Promise<RevenueVelocityReport>;
  getUnitEconomicsReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
    eventParticipantMode?: UnitEconomicsEventParticipantMode;
  }): Promise<UnitEconomicsReport>;
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
  getAttractionOntology(): Promise<AttractionOntologyResponse>;
  getAttractionOntologySourceDocument(
    sourceId: string
  ): Promise<OntologySourceDocumentResponse>;
  getConversionEventTypeSettings(): Promise<ConversionEventTypeSettingsData>;
  replaceConversionEventTypeSettings(
    input: ConversionEventTypeSettingsInput
  ): Promise<ConversionEventTypeSettingsData>;
  getManagerWhitelistSettings(): Promise<ManagerWhitelistSettingsData>;
  replaceManagerWhitelistSettings(
    input: ManagerWhitelistSettingsInput
  ): Promise<ManagerWhitelistSettingsData>;
  isCallInAttractionManagerScope(
    callId: string,
    managerIds: string[]
  ): Promise<boolean>;
  getCallAnalysisResult(callId: string): Promise<unknown | null>;
  getMeta(input?: { filters?: ReportFilters }): Promise<{
    stageCatalog: StageCatalogEntry[];
    managerCatalog: ManagerDirectoryEntry[];
    sourceCatalog: SourceCatalogEntry[];
    businessClubCatalog: SourceCatalogEntry[];
    targetGroupCatalog: SourceCatalogEntry[];
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
  }>;
  getSyncRuns(input?: { limit?: number }): Promise<SyncRunHistoryResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
  rebuildAnalyticsFacts(): Promise<AnalyticsFactsBuildSummary | null>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

export interface AnalyticsFactsBuildSummary {
  identityLinks: number;
  dealStageFacts: number;
  dealTouchpointFacts: number;
  eventVisitFacts: number;
}

function createRange(periodDays: number, now: Date) {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (periodDays - 1));
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function resolveRange(
  periodDays: number | undefined,
  range: ReportRange | undefined,
  defaultPeriodDays: number,
  now: Date
) {
  if (range) {
    return range;
  }

  const safePeriod =
    Number.isFinite(periodDays) && (periodDays ?? 0) > 0
      ? (periodDays as number)
      : defaultPeriodDays;

  return createRange(safePeriod, now);
}

function resolveLatestTwelveMonthCohortRange(now: Date): ReportRange {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function normalizeNullableId(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 && normalized !== "0" ? normalized : null;
}

function isDealOwnerType(value: string | null | undefined) {
  return value === "2" || value?.toUpperCase() === "DEAL";
}

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isInTimestampRange(
  value: string | null | undefined,
  fromMs: number,
  toMs: number
) {
  const timestamp = toTimestamp(value);
  return timestamp !== null && timestamp >= fromMs && timestamp <= toMs;
}

function toMoscowDateKey(value: string | null | undefined) {
  const timestamp = toTimestamp(value);
  if (timestamp === null) {
    return null;
  }

  return new Date(timestamp + MOSCOW_OFFSET_MS).toISOString().slice(0, 10);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const timestamp = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(timestamp + days * MS_PER_DAY).toISOString().slice(0, 10);
}

function isOperationalClosedStage(
  stageId: string,
  stageSemanticId: string | null,
  wonStageIds: Set<string>
) {
  return (
    wonStageIds.has(stageId) ||
    stageSemanticId === "S" ||
    stageSemanticId === "F" ||
    OPERATIONAL_LOST_STAGE_IDS.has(stageId)
  );
}

function isOperationalOpenDeal(deal: DealSnapshot, wonStageIds: Set<string>) {
  return (
    deal.stageSemanticId !== "S" &&
    deal.stageSemanticId !== "F" &&
    !wonStageIds.has(deal.stageId) &&
    !OPERATIONAL_LOST_STAGE_IDS.has(deal.stageId)
  );
}

export function selectOperationalDashboardDealIds(input: {
  deals: DealSnapshot[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  range: ReportRange;
  now: string;
  wonStageIds: string[];
}) {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const nowMs = toTimestamp(input.now) ?? toMs;
  const todayKey = toMoscowDateKey(input.now) ?? input.now.slice(0, 10);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const wonStageIds = new Set(input.wonStageIds);
  const scopedDealIds = new Set(input.deals.map((deal) => deal.id));
  const selectedDealIds = new Set<string>();

  for (const deal of input.deals) {
    if (
      isOperationalOpenDeal(deal, wonStageIds) ||
      isInTimestampRange(deal.dateCreate, fromMs, toMs) ||
      (isOperationalClosedStage(deal.stageId, deal.stageSemanticId, wonStageIds) &&
        isInTimestampRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs))
    ) {
      selectedDealIds.add(deal.id);
      continue;
    }

    for (const slot of deal.meetingSlots ?? []) {
      const slotTimestamp = toTimestamp(slot.dateValue);
      if (
        slotTimestamp !== null &&
        slotTimestamp >= fromMs &&
        slotTimestamp <= toMs &&
        slotTimestamp <= nowMs
      ) {
        selectedDealIds.add(deal.id);
        break;
      }

      const slotDateKey = toMoscowDateKey(slot.dateValue);
      if (slotDateKey === todayKey || slotDateKey === tomorrowKey) {
        selectedDealIds.add(deal.id);
        break;
      }
    }
  }

  for (const row of input.stageHistory) {
    if (
      scopedDealIds.has(row.ownerId) &&
      isOperationalClosedStage(row.stageId, row.stageSemanticId, wonStageIds) &&
      isInTimestampRange(row.createdTime, fromMs, toMs)
    ) {
      selectedDealIds.add(row.ownerId);
    }
  }

  for (const activity of input.activities) {
    if (
      activity.completed ||
      !isDealOwnerType(activity.ownerTypeId) ||
      !scopedDealIds.has(activity.ownerId)
    ) {
      continue;
    }

    const deadlineKey = toMoscowDateKey(activity.deadline);
    if (deadlineKey === todayKey || deadlineKey === tomorrowKey) {
      selectedDealIds.add(activity.ownerId);
    }
  }

  return selectedDealIds;
}

function resolveQueueCallType(call: CallSnapshot): CallAnalysisQueueCallType {
  if (call.callType === "2") {
    return "incoming";
  }

  if (call.callType === "1") {
    return call.callDurationSeconds > 30
      ? "outgoing_over_30"
      : "outgoing_under_30";
  }

  return "unknown";
}

function formatQueueCallTypeLabel(type: CallAnalysisQueueCallType) {
  if (type === "incoming") {
    return "Входящий";
  }

  if (type === "outgoing_over_30") {
    return "Исх >30";
  }

  if (type === "outgoing_under_30") {
    return "Исх <30";
  }

  return "Неизвестно";
}

function isInsideRange(value: string, range: ReportRange) {
  const timestamp = Date.parse(value);
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);

  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    timestamp >= from &&
    timestamp <= to
  );
}

function resolveCallDealId(call: CallSnapshot, activity: ActivitySnapshot | null) {
  if (isDealOwnerType(call.crmEntityType)) {
    return normalizeNullableId(call.crmEntityId);
  }

  if (isDealOwnerType(activity?.ownerTypeId)) {
    return normalizeNullableId(activity?.ownerId);
  }

  return null;
}

function resolveCallManagerId(
  call: CallSnapshot,
  activity: ActivitySnapshot | null,
  deal: DealSnapshot | null
) {
  return (
    normalizeNullableId(call.portalUserId) ??
    normalizeNullableId(activity?.responsibleId) ??
    normalizeNullableId(deal?.assignedById)
  );
}

function resolveStageAtCall(
  stageHistory: StageHistorySnapshot[],
  dealId: string | null,
  at: string
) {
  if (!dealId) {
    return null;
  }

  return (
    stageHistory
      .filter((stage) => stage.ownerId === dealId && stage.createdTime <= at)
      .sort((left, right) => {
        const createdCompare = right.createdTime.localeCompare(left.createdTime);
        return createdCompare || right.id.localeCompare(left.id);
      })[0] ?? null
  );
}

function resolveStageCatalogName(
  stageCatalog: StageCatalogEntry[],
  categoryId: string | null | undefined,
  stageId: string | null | undefined
) {
  if (!stageId) {
    return null;
  }

  return (
    stageCatalog.find(
      (stage) =>
        stage.entityType === "deal" &&
        stage.statusId === stageId &&
        (stage.categoryId === (categoryId ?? null) || !stage.categoryId)
    )?.name ?? stageId
  );
}

function normalizeBitrixPortalHost(value: string | undefined) {
  const host = value
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");

  return host || null;
}

function buildBitrixDealUrl(portalHost: string | null, dealId: string | null | undefined) {
  if (!portalHost || !dealId) {
    return null;
  }

  return `https://${portalHost}/crm/deal/details/${encodeURIComponent(dealId)}/`;
}

function extractQueueScore(result: CallAnalysisResultRecord | null) {
  const score = result?.aiEvaluation.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function resolveQueueAnalysisStatus(
  result: CallAnalysisResultRecord | null,
  latestRun: CallAnalysisRunSummary | null
): CallAnalysisQueueStatus {
  if (result) {
    return "ready";
  }

  if (latestRun?.status === "analyzing" || latestRun?.status === "queued") {
    return "analyzing";
  }

  if (latestRun?.status === "error") {
    return "error";
  }

  return "not_analyzed";
}

function buildQueueTotals(items: CallAnalysisQueueItem[]) {
  const readyScores = items
    .map((item) => item.score)
    .filter((score): score is number => score !== null);

  return {
    total: items.length,
    notAnalyzed: items.filter((item) => item.analysisStatus === "not_analyzed").length,
    analyzing: items.filter((item) => item.analysisStatus === "analyzing").length,
    ready: items.filter((item) => item.analysisStatus === "ready").length,
    error: items.filter((item) => item.analysisStatus === "error").length,
    averageScore:
      readyScores.length > 0
        ? Math.round(
            readyScores.reduce((total, score) => total + score, 0) / readyScores.length
          )
        : null
  };
}

const MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING =
  "Данные по делам/звонкам неполные: требуется историческая синхронизация за выбранный период.";
const CONVERSION_EVENTS_INCOMPLETE_WARNING =
  "Локальный snapshot конверсионных мероприятий не загружен: проверьте доступ webhook к smart-process \"Посещения мероприятий\" и запустите sync.";
const MANAGER_ACTION_REQUIRED_ACTIVITY_PROVIDERS = [
  "CRM_TODO",
  "CRM_TASKS_TASK",
  "VOXIMPLANT_CALL",
  "CRM_MEETING"
];
const SYNC_HEALTH_STALE_RUN_HOURS = 2;
const SYNC_HEALTH_STALE_SUCCESS_HOURS = 24;
type DealStageFacts = Awaited<ReturnType<ReportingRepository["getAllDealStageFacts"]>>;
type DealTouchpointFacts = Awaited<
  ReturnType<ReportingRepository["getAllDealTouchpointFacts"]>
>;
type EventVisitFacts = Awaited<ReturnType<ReportingRepository["getAllEventVisitFacts"]>>;

function addHours(date: Date, hours: number) {
  const copy = new Date(date);
  copy.setUTCHours(copy.getUTCHours() + hours);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function buildSyncHealth(input: {
  repository: ReportingRepository;
  categoryIds: string[];
  assignedByIds: string[];
  lastSync: {
    finishedAt: string;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
    dealBreakdown: SyncDealChangeBreakdown;
  } | null;
  now: Date;
  bootstrapLookbackDays: number;
  meetingDateFieldName?: string;
}): Promise<SyncHealth> {
  const checkedAt = input.now.toISOString();
  const issues: SyncHealthIssue[] = [];
  const staleBefore = addHours(
    input.now,
    -SYNC_HEALTH_STALE_RUN_HOURS
  ).toISOString();
  const recoveredStaleRuns = await input.repository.recoverStaleSyncRuns({
    staleBefore,
    failedAt: checkedAt
  });

  if (recoveredStaleRuns > 0) {
    issues.push({
      code: "STALE_RUNNING_SYNC",
      severity: "blocking",
      message:
        "Есть зависшие sync runs; они помечены как failed, нужен новый успешный sync."
    });
  }

  if (!input.lastSync) {
    issues.push({
      code: "NO_SUCCESSFUL_SYNC",
      severity: "blocking",
      message: "Нет успешной синхронизации локального snapshot."
    });
  } else {
    const staleSuccessBefore = addHours(
      input.now,
      -SYNC_HEALTH_STALE_SUCCESS_HOURS
    ).getTime();
    const lastSuccessTime = Date.parse(input.lastSync.finishedAt);
    if (!Number.isFinite(lastSuccessTime) || lastSuccessTime < staleSuccessBefore) {
      issues.push({
        code: "STALE_SUCCESSFUL_SYNC",
        severity: "blocking",
        message: "Последняя успешная синхронизация устарела."
      });
    }
  }

  const requiredFrom = addDays(
    input.now,
    -input.bootstrapLookbackDays
  ).toISOString();
  const scopeKey = buildCategoryScopeKey(input.categoryIds, input.assignedByIds);
  const coverageChecks = [
    ...MANAGER_ACTION_REQUIRED_ACTIVITY_PROVIDERS.map((providerId) => ({
      stream: "activity_history",
      providerId,
      algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION
    })),
    {
      stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
      providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
      algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION
    },
    {
      stream: CALL_STATS_COVERAGE_STREAM,
      providerId: CALL_STATS_COVERAGE_PROVIDER,
      algorithmVersion: CALL_STATS_COVERAGE_VERSION
    },
    {
      stream: CONVERSION_EVENT_VISITS_COVERAGE_STREAM,
      providerId: CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER,
      algorithmVersion: CONVERSION_EVENT_VISITS_COVERAGE_VERSION
    },
    ...(input.meetingDateFieldName
      ? [
          {
            stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
            providerId: input.meetingDateFieldName,
            algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION
          }
        ]
      : [])
  ];

  const coverageResults = await Promise.all(
    coverageChecks.map((check) =>
      input.repository.hasSyncCoverage({
        scopeKey,
        stream: check.stream,
        providerId: check.providerId,
        requiredFrom,
        requiredTo: checkedAt,
        algorithmVersion: check.algorithmVersion
      })
    )
  );

  if (coverageResults.some((covered) => covered !== true)) {
    issues.push({
      code: "MISSING_COVERAGE",
      severity: "blocking",
      message: "Нет подтвержденного покрытия локального snapshot."
    });
  }

  const blocking = issues.some((issue) => issue.severity === "blocking");

  return {
    status: blocking ? "blocked" : issues.length > 0 ? "warning" : "ready",
    blocking,
    checkedAt,
    lastSuccessfulSync: input.lastSync?.finishedAt ?? null,
    issues,
    warnings: issues.map((issue) => issue.message)
  };
}

async function buildManagerActionOutcomeWarnings(input: {
  repository: ReportingRepository;
  categoryIds: string[];
  assignedByIds: string[];
  range: ReportRange;
  meetingDateFieldName?: string;
}) {
  const warnings = new Set<string>();
  let meetingDateFieldCoverageConfirmed = false;

  const scopeKey = buildCategoryScopeKey(input.categoryIds, input.assignedByIds);
  const coverageResults = await Promise.all(
    MANAGER_ACTION_REQUIRED_ACTIVITY_PROVIDERS.map((providerId) =>
      input.repository.hasSyncCoverage({
        scopeKey,
        stream: "activity_history",
        providerId,
        requiredFrom: input.range.from,
        requiredTo: input.range.to,
        algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION
      })
    )
  );

  if (coverageResults.some((covered) => covered !== true)) {
    warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
  }

  const dealCustomFieldCoverage = input.repository.hasSyncCoverage({
    scopeKey,
    stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
    providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
    requiredFrom: input.range.from,
    requiredTo: input.range.to,
    algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION
  });
  const meetingDateFieldCoverage = input.meetingDateFieldName
    ? input.repository.hasSyncCoverage({
        scopeKey,
        stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
        providerId: input.meetingDateFieldName,
        requiredFrom: input.range.from,
        requiredTo: input.range.to,
        algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION
      })
    : Promise.resolve(true);
  const callStatsCoverage = input.repository.hasSyncCoverage({
    scopeKey,
    stream: CALL_STATS_COVERAGE_STREAM,
    providerId: CALL_STATS_COVERAGE_PROVIDER,
    requiredFrom: input.range.from,
    requiredTo: input.range.to,
    algorithmVersion: CALL_STATS_COVERAGE_VERSION
  });
  const fieldCoverageResults = await Promise.all([
    dealCustomFieldCoverage,
    meetingDateFieldCoverage,
    callStatsCoverage
  ]);
  meetingDateFieldCoverageConfirmed = fieldCoverageResults[1] === true;

  if (fieldCoverageResults.some((covered) => covered !== true)) {
    warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
  }

  const bootstrappedAt =
    await input.repository.getDealMeetingDateFieldBootstrappedAt();
  if (
    input.meetingDateFieldName &&
    !bootstrappedAt &&
    !meetingDateFieldCoverageConfirmed
  ) {
    warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
  }

  const ownerIds = await input.repository.getDealIdsByCategoryIds(
    input.categoryIds,
    input.assignedByIds
  );
  const missingCallStatActivityIds =
    ownerIds.length > 0
      ? await input.repository.getCallActivityIdsMissingCallStats(
          1,
          input.range.from,
          ownerIds
        )
      : [];
  if (missingCallStatActivityIds.length > 0) {
    warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
  }

  return Array.from(warnings);
}

function attachComparisons<TReport extends object, TSnapshot extends object>(
  report: TReport,
  compareRanges: ReportRange[] | undefined,
  buildSnapshot: (range: ReportRange) => TSnapshot
) {
  if (!compareRanges || compareRanges.length === 0) {
    return report;
  }

  return {
    ...report,
    comparisons: compareRanges.map((range, index) => ({
      compareIndex: index + 1,
      range,
      snapshot: buildSnapshot(range)
    }))
  };
}

function filterStageCatalog(
  stageCatalog: StageCatalogEntry[],
  allowedCategoryIds: Set<string>,
  options?: {
    includeSources?: boolean;
  }
) {
  return stageCatalog.filter((entry) => {
    if (entry.entityType === "source") {
      return options?.includeSources ?? false;
    }

    if (entry.entityType !== "deal") {
      return false;
    }

    return allowedCategoryIds.has(normalizeCategoryId(entry.categoryId));
  });
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function sortManagers(rows: ManagerDirectoryEntry[]) {
  return [...rows].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, "ru");
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });
}

function sortSources(rows: SourceCatalogEntry[]) {
  return [...rows].sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label, "ru");
    return byLabel !== 0 ? byLabel : left.key.localeCompare(right.key);
  });
}

function resolveBusinessClubFilterKey(deal: Pick<DealSnapshot, "businessClubValue">) {
  const value = deal.businessClubValue?.trim();
  return value && value.length > 0 ? value : null;
}

function resolveTargetGroupFilterKey(deal: Pick<DealSnapshot, "targetGroupValue">) {
  const value = deal.targetGroupValue?.trim();
  if (!value || value.length === 0) {
    return null;
  }

  return /^\d+$/.test(value) || value === "Неизвестная таргет-группа" ? null : value;
}

function isTimestampWithinRange(value: string | null | undefined, range: ReportRange) {
  const timestamp = Date.parse(value ?? "");
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);

  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(from) &&
    Number.isFinite(to) &&
    timestamp >= from &&
    timestamp <= to
  );
}

function isClosedDeal(deal: {
  stageSemanticId: string | null;
  dateClosed: string | null;
}) {
  return Boolean(
    deal.dateClosed || deal.stageSemanticId === "S" || deal.stageSemanticId === "F"
  );
}

function isManagerInScope(
  managerIds: Set<string>,
  managerId: string | null | undefined
) {
  return (
    managerIds.size === 0 ||
    managerIds.has(managerId ?? UNASSIGNED_MANAGER_ID)
  );
}

const MONTH_LABELS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

function formatMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildMonthPeriod(year: number, month: number): SalesPlanQuarterMonth {
  const monthPart = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayPart = String(lastDay).padStart(2, "0");

  return {
    month: formatMonthKey(year, month),
    label: MONTH_LABELS_RU[month - 1] ?? formatMonthKey(year, month),
    periodStart: `${year}-${monthPart}-01T00:00:00.000+03:00`,
    periodEnd: `${year}-${monthPart}-${lastDayPart}T23:59:59.999+03:00`
  };
}

function buildQuarterMonths(year: number, quarter: number) {
  const firstMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((offset) => buildMonthPeriod(year, firstMonth + offset));
}

function buildQuarterPeriod(year: number, quarter: number) {
  const months = buildQuarterMonths(year, quarter);
  const first = months[0]!;
  const last = months[months.length - 1]!;

  return {
    months,
    periodStart: first.periodStart,
    periodEnd: last.periodEnd
  };
}

function salesPlanRowKey(input: { managerId: string; targetGroupKey: string }) {
  return `${input.managerId}::${input.targetGroupKey}`;
}

function latestSalesPlanUpdatedAt(rows: Array<{ updatedAt: string | null }>) {
  return rows.reduce<string | null>(
    (latest, row) =>
      row.updatedAt && (!latest || row.updatedAt > latest) ? row.updatedAt : latest,
    null
  );
}

function moscowMonthFromTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const shifted = new Date(timestamp + MOSCOW_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1
  };
}

function enumerateMonthPeriods(periodStart: string, periodEnd: string) {
  const start = moscowMonthFromTimestamp(periodStart);
  const end = moscowMonthFromTimestamp(periodEnd);
  if (!start || !end) {
    return [];
  }

  const months: SalesPlanQuarterMonth[] = [];
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push(buildMonthPeriod(year, month));
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }

  return months;
}

function proratePlanValue(value: number, overlapMs: number, periodMs: number) {
  if (value <= 0 || overlapMs <= 0 || periodMs <= 0) {
    return 0;
  }

  return Math.ceil((value * overlapMs) / periodMs);
}

export function createReportingService(
  input: CreateReportingServiceInput
): ReportingService {
  const nowFactory = input.now ?? (() => new Date());
  const allowedCategoryIds = new Set(input.dealCategoryIds);
  const leadgenCategoryId = normalizeCategoryId(
    input.leadgenCategoryId ?? LEADGEN_US_CATEGORY_ID
  );
  const leadgenManagerIds = uniqueStrings(input.leadgenManagerIds ?? []);
  const workloadScope = input.workloadScope ?? "attraction";
  const noLeadgenManagerMatchId = "__NO_LEADGEN_MANAGER_MATCH__";
  const bitrixPortalHost = normalizeBitrixPortalHost(input.bitrixPortalHost);
  const getScopedStageCatalog = async (includeSources = false) =>
    filterStageCatalog(
      await input.repository.getStageCatalog(),
      allowedCategoryIds,
      includeSources ? { includeSources: true } : undefined
    );
  const getPricingRules = () => input.repository.getPricingRules();
  const reportInputCache: {
    dealStageFacts?: Promise<DealStageFacts>;
    dealTouchpointFacts?: Promise<DealTouchpointFacts>;
    eventVisitFacts?: Promise<EventVisitFacts>;
  } = {};
  const clearReportInputCache = () => {
    delete reportInputCache.dealStageFacts;
    delete reportInputCache.dealTouchpointFacts;
    delete reportInputCache.eventVisitFacts;
  };
  const getCachedDealStageFacts = () => {
    if (!reportInputCache.dealStageFacts) {
      let promise: Promise<DealStageFacts>;
      promise = input.repository.getAllDealStageFacts().catch((error) => {
        if (reportInputCache.dealStageFacts === promise) {
          delete reportInputCache.dealStageFacts;
        }
        throw error;
      });
      reportInputCache.dealStageFacts = promise;
    }
    return reportInputCache.dealStageFacts;
  };
  const getCachedDealTouchpointFacts = () => {
    if (!reportInputCache.dealTouchpointFacts) {
      let promise: Promise<DealTouchpointFacts>;
      promise = input.repository.getAllDealTouchpointFacts().catch((error) => {
        if (reportInputCache.dealTouchpointFacts === promise) {
          delete reportInputCache.dealTouchpointFacts;
        }
        throw error;
      });
      reportInputCache.dealTouchpointFacts = promise;
    }
    return reportInputCache.dealTouchpointFacts;
  };
  const getCachedEventVisitFacts = () => {
    if (!reportInputCache.eventVisitFacts) {
      let promise: Promise<EventVisitFacts>;
      promise = input.repository.getAllEventVisitFacts().catch((error) => {
        if (reportInputCache.eventVisitFacts === promise) {
          delete reportInputCache.eventVisitFacts;
        }
        throw error;
      });
      reportInputCache.eventVisitFacts = promise;
    }
    return reportInputCache.eventVisitFacts;
  };
  const getUnitEconomicsEventParticipantMode = () =>
    input.repository.getUnitEconomicsEventParticipantMode();

  const filterDealsByFilters = (
    deals: Awaited<ReturnType<ReportingRepository["getAllDeals"]>>,
    stageCatalog: StageCatalogEntry[],
    filters: ReportFilters | undefined,
    options?: {
      includeManagerFilter?: boolean;
    }
  ) => {
    const sourceLabels = buildSourceLabelMap(stageCatalog);
    const managerIds = new Set(filters?.managerIds ?? []);
    const sourceKeys = new Set(filters?.sourceKeys ?? []);
    const businessClubKeys = new Set(filters?.businessClubKeys ?? []);
    const targetGroupKeys = new Set(filters?.targetGroupKeys ?? []);

    return deals.filter((deal) => {
      if (!allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))) {
        return false;
      }

      if ((options?.includeManagerFilter ?? true) && managerIds.size > 0) {
        const managerId = deal.assignedById ?? UNASSIGNED_MANAGER_ID;
        if (!managerIds.has(managerId)) {
          return false;
        }
      }

      if (sourceKeys.size > 0) {
        const source = resolveDealSource(deal, sourceLabels);
        if (!sourceKeys.has(source.key)) {
          return false;
        }
      }

      if (businessClubKeys.size > 0) {
        const businessClubKey = resolveBusinessClubFilterKey(deal);
        if (!businessClubKey || !businessClubKeys.has(businessClubKey)) {
          return false;
        }
      }

      if (targetGroupKeys.size > 0) {
        const targetGroupKey = resolveTargetGroupFilterKey(deal);
        if (!targetGroupKey || !targetGroupKeys.has(targetGroupKey)) {
          return false;
        }
      }

      return true;
    });
  };

  const isDealOwnerType = (ownerTypeId: string) =>
    ownerTypeId === "2" || ownerTypeId.toUpperCase() === "DEAL";

  const isDealCallEntity = (crmEntityType: string | null) =>
    crmEntityType === "2" || crmEntityType?.toUpperCase() === "DEAL";

  const ensureManagerDirectory = async (
    managerIds: string[],
    options?: { attractionOrder?: boolean }
  ) => {
    const requestedIds = uniqueStrings(managerIds);
    const needsUnassigned = requestedIds.includes(UNASSIGNED_MANAGER_ID);
    const lookupIds = requestedIds.filter((id) => id !== UNASSIGNED_MANAGER_ID);
    const existing = await input.repository.getManagerDirectory();
    const existingById = new Map(existing.map((row) => [row.id, row]));
    for (const manager of ATTRACTION_MANAGER_CATALOG) {
      existingById.set(manager.id, manager);
    }
    const missing = lookupIds.filter((id) => !existingById.has(id));

    if (missing.length > 0) {
      try {
        const fetched = (await input.client.fetchUsers({ ids: missing })).map((row) => {
          const id = String(row.ID);
          return {
            id,
            name: [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim() || id
          };
        });

        if (fetched.length > 0) {
          await input.repository.upsertManagerDirectory(fetched);
          for (const row of fetched) {
            existingById.set(row.id, row);
          }
        }
      } catch (error) {
        console.warn("Skipping manager directory refresh:", error);
      }
    }

    const rows = lookupIds
      .map((id) => existingById.get(id))
      .filter((row): row is ManagerDirectoryEntry => Boolean(row));

    if (needsUnassigned) {
      rows.push({
        id: UNASSIGNED_MANAGER_ID,
        name: UNASSIGNED_MANAGER_NAME
      });
    }

    const sortedRows = sortManagers(rows);
    return options?.attractionOrder === false
      ? sortedRows
      : sortAttractionManagers(sortedRows);
  };

  const getLocalManagerDirectory = async (managerIds: string[]) => {
    const requestedIds = uniqueStrings(managerIds);
    const existingById = new Map<string, ManagerDirectoryEntry>();

    for (const manager of await input.repository.getManagerDirectory()) {
      existingById.set(manager.id, manager);
    }
    for (const manager of ATTRACTION_MANAGER_CATALOG) {
      existingById.set(manager.id, {
        ...existingById.get(manager.id),
        ...manager
      });
    }
    for (const managerId of requestedIds) {
      if (managerId === UNASSIGNED_MANAGER_ID) {
        existingById.set(managerId, {
          id: UNASSIGNED_MANAGER_ID,
          name: UNASSIGNED_MANAGER_NAME
        });
      } else if (!existingById.has(managerId)) {
        existingById.set(managerId, {
          id: managerId,
          name: managerId
        });
      }
    }

    const rows =
      requestedIds.length > 0
        ? requestedIds
            .map((managerId) => existingById.get(managerId))
            .filter((row): row is ManagerDirectoryEntry => Boolean(row))
        : Array.from(existingById.values());

    return sortAttractionManagers(sortManagers(rows));
  };

  const getAttractionManagerScope = async () => {
    const settings = await input.repository.getManagerWhitelistSettings("attraction");
    return settings
      .filter((setting) => setting.enabled)
      .map((setting) => setting.managerId);
  };

  const normalizeAttractionReportFilters = async (
    filters: ReportFilters | undefined
  ) => normalizeAttractionManagerFilters(filters, await getAttractionManagerScope());

  const buildManagerWhitelistSettingsData =
    async (): Promise<ManagerWhitelistSettingsData> => {
      const settings = await input.repository.getManagerWhitelistSettings(
        "attraction"
      );
      const existing = await input.repository.getManagerDirectory();
      const optionsById = new Map<string, ManagerDirectoryEntry>();
      const upsertOption = (manager: ManagerDirectoryEntry) => {
        const current = optionsById.get(manager.id);
        const callAttributionPolicy =
          manager.callAttributionPolicy ?? current?.callAttributionPolicy;

        optionsById.set(manager.id, {
          ...current,
          ...manager,
          ...(callAttributionPolicy ? { callAttributionPolicy } : {})
        });
      };

      for (const manager of ATTRACTION_MANAGER_CATALOG) {
        upsertOption(manager);
      }
      for (const manager of existing) {
        upsertOption(manager);
      }
      for (const setting of settings) {
        upsertOption({
          id: setting.managerId,
          name: setting.managerName
        });
      }

      return {
        options: sortAttractionManagers(sortManagers(Array.from(optionsById.values()))),
        settings,
        teams: buildManagerTeams(settings)
      };
  };

  const buildSourceCatalog = (
    deals: Awaited<ReturnType<ReportingRepository["getAllDeals"]>>,
    stageCatalog: StageCatalogEntry[]
  ) => {
    const sourceLabels = buildSourceLabelMap(stageCatalog);
    const rows = new Map<string, SourceCatalogEntry>();

    for (const deal of deals) {
      const source = resolveDealSource(deal, sourceLabels);
      rows.set(source.key, {
        key: source.key,
        label: source.label
      });
    }

    return sortSources(Array.from(rows.values()));
  };

  const buildValueCatalog = (
    deals: Awaited<ReturnType<ReportingRepository["getAllDeals"]>>,
    resolveValue: (
      deal: Awaited<ReturnType<ReportingRepository["getAllDeals"]>>[number]
    ) => string | null
  ) => {
    const rows = new Map<string, SourceCatalogEntry>();

    for (const deal of deals) {
      const value = resolveValue(deal);
      if (!value) {
        continue;
      }

      rows.set(value, {
        key: value,
        label: value
      });
    }

    return sortSources(Array.from(rows.values()));
  };

  const rebuildAnalyticsFacts = async (): Promise<AnalyticsFactsBuildSummary | null> => {
    clearReportInputCache();

    const [
      deals,
      stageCatalog,
      stageHistory,
      activities,
      activityBindings,
      calls,
      meetingDateChanges,
      conversionEventVisits,
      conversionEvents,
      conversionEventVisitStageHistory
    ] = await Promise.all([
      input.repository.getAllDeals(),
      input.repository.getStageCatalog(),
      input.repository.getAllStageHistory(),
      input.repository.getAllActivities(),
      input.repository.getAllActivityBindings(),
      input.repository.getAllCalls(),
      input.repository.getAllDealMeetingDateChanges(),
      input.repository.getAllConversionEventVisits(),
      input.repository.getAllEventSnapshots(),
      input.repository.getAllEventVisitStageHistory()
    ]);
    const scopedFilters = await normalizeAttractionReportFilters(undefined);
    const scopedDeals = filterDealsByFilters(
      deals,
      stageCatalog,
      scopedFilters
    );
    const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
    const scopedStageHistory = stageHistory.filter((row) =>
      scopedDealIds.has(row.ownerId)
    );
    const stageFacts = buildDealStageFacts({
      deals: scopedDeals,
      stageHistory: scopedStageHistory,
      stageCatalog
    });
    const identityLinks = buildIdentityLinks({
      moduleKey: "attraction",
      deals: scopedDeals
    });
    const eventVisitFacts = buildEventVisitFacts({
      visits: conversionEventVisits,
      events: conversionEvents,
      visitStageHistory: conversionEventVisitStageHistory,
      deals: scopedDeals,
      stageFacts
    });
    const touchpointFacts = [
      ...buildDealTouchpointFacts({
        deals: scopedDeals,
        stageFacts,
        activities,
        activityBindings,
        calls,
        meetingDateChanges
      }),
      ...buildConversionEventTouchpointFacts({
        eventVisitFacts,
        stageFacts
      })
    ];

    let baseCounts: Awaited<ReturnType<ReportingRepository["replaceAnalyticsFacts"]>>;
    try {
      baseCounts = await input.repository.replaceAnalyticsFacts({
        identityLinks,
        dealStageFacts: stageFacts,
        dealTouchpointFacts: touchpointFacts,
        eventVisitFacts
      });
    } finally {
      clearReportInputCache();
    }

    return {
      ...baseCounts,
      eventVisitFacts: baseCounts.eventVisitFacts ?? 0
    };
  };

  const loadCanonicalReportInputs = async (fallback: {
    stageHistory: Awaited<ReturnType<ReportingRepository["getAllStageHistory"]>>;
    activities?: Awaited<ReturnType<ReportingRepository["getAllActivities"]>>;
    calls?: Awaited<ReturnType<ReportingRepository["getAllCalls"]>>;
    meetingDateChanges?: Awaited<
      ReturnType<ReportingRepository["getAllDealMeetingDateChanges"]>
    >;
  }, options?: {
    includeTouchpointFacts?: boolean;
    includeEventVisitFacts?: boolean;
  }) => {
    const includeTouchpointFacts =
      options?.includeTouchpointFacts ??
      Boolean(fallback.activities || fallback.calls || fallback.meetingDateChanges);
    const [stageFacts, touchpointFacts, eventVisitFacts] = await Promise.all([
      getCachedDealStageFacts(),
      includeTouchpointFacts
        ? getCachedDealTouchpointFacts()
        : Promise.resolve([] as DealTouchpointFacts),
      options?.includeEventVisitFacts
        ? getCachedEventVisitFacts()
        : Promise.resolve([] as EventVisitFacts)
    ]);
    const hasStageFacts = stageFacts.length > 0;
    const hasTouchpointFacts = touchpointFacts.length > 0;

    return {
      dealStageFacts: hasStageFacts ? stageFacts : [],
      stageHistory: hasStageFacts
        ? stageFactsToStageHistory(stageFacts)
        : fallback.stageHistory,
      activities:
        hasTouchpointFacts && fallback.activities
          ? touchpointFactsToActivities(touchpointFacts)
          : fallback.activities,
      calls:
        hasTouchpointFacts && fallback.calls
          ? touchpointFactsToCalls(touchpointFacts)
          : fallback.calls,
      meetingDateChanges:
        hasTouchpointFacts && fallback.meetingDateChanges
          ? touchpointFactsToMeetingDateChanges(touchpointFacts)
          : fallback.meetingDateChanges,
      eventVisitFacts,
      dealTouchpointFacts: touchpointFacts
    };
  };

  const loadScopedCanonicalReportInputs = async (dealIds: string[]) => {
    const scopedDealIds = uniqueStrings(dealIds);
    const [
      scopedStageHistory,
      scopedDealStageFacts,
      scopedDealTouchpointFacts,
      scopedEventVisitFacts
    ] = await Promise.all([
      input.repository.getStageHistoryByOwnerIds(scopedDealIds),
      input.repository.getDealStageFactsByDealIds(scopedDealIds),
      input.repository.getDealTouchpointFactsByDealIds(scopedDealIds),
      input.repository.getEventVisitFactsByDealIds(scopedDealIds)
    ]);
    const hasStageFacts = scopedDealStageFacts.length > 0;

    return {
      dealStageFacts: hasStageFacts ? scopedDealStageFacts : [],
      stageHistory: hasStageFacts
        ? stageFactsToStageHistory(scopedDealStageFacts)
        : scopedStageHistory,
      dealTouchpointFacts: scopedDealTouchpointFacts,
      eventVisitFacts: scopedEventVisitFacts
    };
  };

  const normalizeLeadgenWorkloadFilters = (filters: ReportFilters | undefined) => {
    const requestedManagerIds = filters?.managerIds ?? [];
    const allowedManagers = new Set(leadgenManagerIds);
    const scopedManagerIds =
      requestedManagerIds.length > 0
        ? requestedManagerIds.filter((id) => allowedManagers.has(id))
        : leadgenManagerIds;

    return {
      filters: {
        ...(filters ?? {}),
        managerIds:
          scopedManagerIds.length > 0
            ? scopedManagerIds
            : [noLeadgenManagerMatchId]
      },
      warnings:
        leadgenManagerIds.length === 0
          ? ["Leadgen manager whitelist is empty."]
          : []
    };
  };
  const normalizeWorkloadFilters = async (filters: ReportFilters | undefined) =>
    workloadScope === "leadgen"
      ? normalizeLeadgenWorkloadFilters(filters)
      : {
          filters: await normalizeAttractionReportFilters(filters),
          warnings: [] as string[]
        };

  const loadSourceCohortReportInputs = async (
    filters: ReportFilters | undefined
  ) => {
    const scopedFilters = await normalizeAttractionReportFilters(filters);
    const [deals, stageCatalog, wonStageIds, events] = await Promise.all([
      input.repository.getAllDeals(),
      getScopedStageCatalog(true),
      input.repository.getWonStageIds(),
      input.repository.getAllEventSnapshots()
    ]);
    const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
    const canonical = await loadScopedCanonicalReportInputs(
      scopedDeals.map((deal) => deal.id)
    );
    const managerDirectory = await ensureManagerDirectory(
      uniqueStrings([
        ...scopedDeals.map(
          (deal) => deal.assignedById ?? UNASSIGNED_MANAGER_ID
        ),
        ...canonical.eventVisitFacts.map((fact) => fact.managerId)
      ])
    );

    return {
      scopedDeals,
      stageCatalog,
      wonStageIds,
      events,
      canonical,
      managerDirectory
    };
  };

  return {
    async getLeadgenFunnelReport({ periodDays, range, filters }) {
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );
      const [deals, stageCatalog] = await Promise.all([
        input.repository.getAllDeals(),
        input.repository.getStageCatalog()
      ]);
      const sourceLabels = buildSourceLabelMap(stageCatalog);
      const stageById = new Map(
        stageCatalog
          .filter(
            (entry) =>
              entry.entityType === "deal" &&
              normalizeCategoryId(entry.categoryId) === leadgenCategoryId
          )
          .map((entry) => [entry.statusId, entry])
      );
      const allowedManagers = new Set(leadgenManagerIds);
      const filteredManagers =
        filters?.managerIds && filters.managerIds.length > 0
          ? new Set(
              filters.managerIds.filter((managerId) =>
                allowedManagers.has(managerId)
              )
            )
          : allowedManagers;
      const sourceKeys = new Set(filters?.sourceKeys ?? []);
      const scopedDeals =
        allowedManagers.size === 0
          ? []
          : deals.filter((deal) => {
              if (normalizeCategoryId(deal.categoryId) !== leadgenCategoryId) {
                return false;
              }

              const managerId = deal.assignedById ?? UNASSIGNED_MANAGER_ID;
              if (!allowedManagers.has(managerId) || !filteredManagers.has(managerId)) {
                return false;
              }

              if (!isTimestampWithinRange(deal.dateCreate, resolvedRange)) {
                return false;
              }

              if (sourceKeys.size > 0) {
                const source = resolveDealSource(deal, sourceLabels);
                if (!sourceKeys.has(source.key)) {
                  return false;
                }
              }

              return true;
            });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById)),
        { attractionOrder: false }
      );
      const managerById = new Map(
        managerDirectory.map((manager) => [manager.id, manager.name])
      );
      const stageRows = new Map<
        string,
        {
          stageId: string;
          stageName: string;
          sortOrder: number;
          activeDeals: number;
          createdDeals: number;
          closedDeals: number;
        }
      >();
      const sourceRows = new Map<
        string,
        { sourceKey: string; sourceLabel: string; dealCount: number }
      >();
      const utmRows = new Map<
        string,
        {
          utmSource: string | null;
          utmMedium: string | null;
          utmCampaign: string | null;
          dealCount: number;
        }
      >();
      const managerRows = new Map<
        string,
        { managerId: string; managerName: string; dealCount: number }
      >();
      const reasonRows = new Map<
        string,
        { reasonKey: string; reasonLabel: string; dealCount: number }
      >();

      for (const deal of scopedDeals) {
        const closed = isClosedDeal(deal);
        const stage = stageById.get(deal.stageId);
        const stageRow =
          stageRows.get(deal.stageId) ??
          {
            stageId: deal.stageId,
            stageName: stage?.name ?? deal.stageId,
            sortOrder: stage?.sortOrder ?? 999_999,
            activeDeals: 0,
            createdDeals: 0,
            closedDeals: 0
          };
        stageRow.createdDeals += 1;
        if (closed) {
          stageRow.closedDeals += 1;
        } else {
          stageRow.activeDeals += 1;
        }
        stageRows.set(stageRow.stageId, stageRow);

        const source = resolveDealSource(deal, sourceLabels);
        const sourceRow =
          sourceRows.get(source.key) ??
          {
            sourceKey: source.key,
            sourceLabel: source.label,
            dealCount: 0
          };
        sourceRow.dealCount += 1;
        sourceRows.set(sourceRow.sourceKey, sourceRow);

        const utmKey = [
          deal.utmSource ?? "",
          deal.utmMedium ?? "",
          deal.utmCampaign ?? ""
        ].join("::");
        const utmRow =
          utmRows.get(utmKey) ??
          {
            utmSource: deal.utmSource,
            utmMedium: deal.utmMedium,
            utmCampaign: deal.utmCampaign,
            dealCount: 0
          };
        utmRow.dealCount += 1;
        utmRows.set(utmKey, utmRow);

        const managerId = deal.assignedById ?? UNASSIGNED_MANAGER_ID;
        const managerRow =
          managerRows.get(managerId) ??
          {
            managerId,
            managerName:
              managerById.get(managerId) ??
              (managerId === UNASSIGNED_MANAGER_ID
                ? UNASSIGNED_MANAGER_NAME
                : managerId),
            dealCount: 0
          };
        managerRow.dealCount += 1;
        managerRows.set(managerId, managerRow);

        const reason = deal.refusalReasonValue?.trim();
        if (reason) {
          const reasonRow =
            reasonRows.get(reason) ??
            {
              reasonKey: reason,
              reasonLabel: reason,
              dealCount: 0
            };
          reasonRow.dealCount += 1;
          reasonRows.set(reason, reasonRow);
        }
      }

      return {
        range: resolvedRange,
        totalDeals: scopedDeals.length,
        createdDeals: scopedDeals.length,
        activeDeals: scopedDeals.filter((deal) => !isClosedDeal(deal)).length,
        closedDeals: scopedDeals.filter(isClosedDeal).length,
        stageRows: Array.from(stageRows.values()).sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.stageName.localeCompare(right.stageName, "ru") ||
            left.stageId.localeCompare(right.stageId)
        ),
        sourceRows: Array.from(sourceRows.values()).sort(
          (left, right) =>
            right.dealCount - left.dealCount ||
            left.sourceLabel.localeCompare(right.sourceLabel, "ru")
        ),
        utmRows: Array.from(utmRows.values()).sort(
          (left, right) =>
            right.dealCount - left.dealCount ||
            (left.utmSource ?? "").localeCompare(right.utmSource ?? "", "ru")
        ),
        managerRows: Array.from(managerRows.values()).sort(
          (left, right) =>
            right.dealCount - left.dealCount ||
            left.managerName.localeCompare(right.managerName, "ru")
        ),
        reasonRows: Array.from(reasonRows.values()).sort(
          (left, right) =>
            right.dealCount - left.dealCount ||
            left.reasonLabel.localeCompare(right.reasonLabel, "ru")
        ),
        warnings:
          allowedManagers.size === 0
            ? ["Leadgen manager whitelist is empty."]
            : []
      };
    },

    async getSalesPlan({ periodStart, periodEnd }) {
      const rows = await input.repository.getSalesPlanRows(periodStart, periodEnd);
      const updatedAt = rows.reduce<string | null>(
        (latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest),
        null
      );

      return {
        periodStart,
        periodEnd,
        rows,
        updatedAt
      };
    },

    async replaceSalesPlan(planInput) {
      const updatedAt = nowFactory().toISOString();
      const rows = await input.repository.replaceSalesPlanRows({
        ...planInput,
        updatedAt
      });

      return {
        periodStart: planInput.periodStart,
        periodEnd: planInput.periodEnd,
        rows,
        updatedAt
      };
    },

    async getSalesPlanQuarter({ year, quarter }) {
      const { months, periodStart, periodEnd } = buildQuarterPeriod(year, quarter);
      const [quarterRows, ...monthRows] = await Promise.all([
        input.repository.getSalesPlanRows(periodStart, periodEnd),
        ...months.map((month) =>
          input.repository.getSalesPlanRows(month.periodStart, month.periodEnd)
        )
      ]);
      const rows = new Map<
        string,
        {
          managerId: string;
          managerName: string | null;
          targetGroupKey: string;
          targetGroupLabel: string;
          quarterPlannedDeals: number;
          quarterPlannedAmount: number;
          explicitQuarterPlan: boolean;
          months: Array<{
            month: string;
            periodStart: string;
            periodEnd: string;
            plannedDeals: number;
            plannedAmount: number;
            updatedAt: string | null;
          }>;
          updatedAt: string | null;
        }
      >();

      const ensureRow = (row: {
        managerId: string;
        managerName: string | null;
        targetGroupKey: string;
        targetGroupLabel: string;
        updatedAt?: string | null;
      }) => {
        const key = salesPlanRowKey(row);
        const existing = rows.get(key);
        if (existing) {
          if (row.managerName && !existing.managerName) {
            existing.managerName = row.managerName;
          }
          if (row.targetGroupLabel && existing.targetGroupLabel === row.targetGroupKey) {
            existing.targetGroupLabel = row.targetGroupLabel;
          }
          if (row.updatedAt && (!existing.updatedAt || row.updatedAt > existing.updatedAt)) {
            existing.updatedAt = row.updatedAt;
          }
          return existing;
        }

        const created = {
          managerId: row.managerId,
          managerName: row.managerName,
          targetGroupKey: row.targetGroupKey,
          targetGroupLabel: row.targetGroupLabel || row.targetGroupKey,
          quarterPlannedDeals: 0,
          quarterPlannedAmount: 0,
          explicitQuarterPlan: false,
          months: months.map((month) => ({
            month: month.month,
            periodStart: month.periodStart,
            periodEnd: month.periodEnd,
            plannedDeals: 0,
            plannedAmount: 0,
            updatedAt: null
          })),
          updatedAt: row.updatedAt ?? null
        };
        rows.set(key, created);
        return created;
      };

      for (const row of quarterRows) {
        const target = ensureRow(row);
        target.quarterPlannedDeals = row.plannedDeals;
        target.quarterPlannedAmount = row.plannedAmount;
        target.explicitQuarterPlan = true;
        target.updatedAt = row.updatedAt;
      }

      monthRows.forEach((rowsForMonth, index) => {
        const month = months[index]!;
        for (const row of rowsForMonth) {
          const target = ensureRow(row);
          target.months[index] = {
            month: month.month,
            periodStart: month.periodStart,
            periodEnd: month.periodEnd,
            plannedDeals: row.plannedDeals,
            plannedAmount: row.plannedAmount,
            updatedAt: row.updatedAt
          };
        }
      });

      const normalizedRows = Array.from(rows.values()).map((row) => {
        const monthPlannedDeals = row.months.reduce(
          (total, month) => total + month.plannedDeals,
          0
        );
        const monthPlannedAmount = row.months.reduce(
          (total, month) => total + month.plannedAmount,
          0
        );
        const { explicitQuarterPlan, ...rest } = row;

        return {
          ...rest,
          quarterPlannedDeals: explicitQuarterPlan
            ? row.quarterPlannedDeals
            : monthPlannedDeals,
          quarterPlannedAmount: explicitQuarterPlan
            ? row.quarterPlannedAmount
            : monthPlannedAmount,
          updatedAt: latestSalesPlanUpdatedAt([
            { updatedAt: row.updatedAt },
            ...row.months.map((month) => ({ updatedAt: month.updatedAt }))
          ])
        };
      });

      normalizedRows.sort((left, right) => {
        const byManager = (left.managerName ?? left.managerId).localeCompare(
          right.managerName ?? right.managerId,
          "ru"
        );
        return byManager !== 0
          ? byManager
          : left.targetGroupLabel.localeCompare(right.targetGroupLabel, "ru");
      });

      return {
        year,
        quarter,
        periodStart,
        periodEnd,
        months,
        rows: normalizedRows,
        updatedAt: latestSalesPlanUpdatedAt(normalizedRows)
      };
    },

    async replaceSalesPlanQuarter(planInput) {
      const { months, periodStart, periodEnd } = buildQuarterPeriod(
        planInput.year,
        planInput.quarter
      );
      const updatedAt = nowFactory().toISOString();
      const periods = [
        {
          periodStart,
          periodEnd,
          rows: planInput.rows.map((row) => ({
            managerId: row.managerId,
            managerName: row.managerName ?? null,
            targetGroupKey: row.targetGroupKey,
            targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
            plannedDeals: row.quarterPlannedDeals,
            plannedAmount: row.quarterPlannedAmount
          }))
        },
        ...months.map((month) => ({
          periodStart: month.periodStart,
          periodEnd: month.periodEnd,
          rows: planInput.rows.map((row) => {
            const monthValue = row.months.find((entry) => entry.month === month.month);
            return {
              managerId: row.managerId,
              managerName: row.managerName ?? null,
              targetGroupKey: row.targetGroupKey,
              targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
              plannedDeals: monthValue?.plannedDeals ?? 0,
              plannedAmount: monthValue?.plannedAmount ?? 0
            };
          })
        }))
      ];

      await input.repository.replaceSalesPlanPeriods({
        updatedAt,
        periods
      });

      return this.getSalesPlanQuarter({
        year: planInput.year,
        quarter: planInput.quarter
      });
    },

    async getEffectiveSalesPlan({ periodStart, periodEnd }) {
      const queryStart = Date.parse(periodStart);
      const queryEnd = Date.parse(periodEnd);
      const rows = new Map<string, SalesPlanData["rows"][number]>();
      const allSourceRows = [];

      for (const month of enumerateMonthPeriods(periodStart, periodEnd)) {
        const sourceRows = await input.repository.getSalesPlanRows(
          month.periodStart,
          month.periodEnd
        );
        allSourceRows.push(...sourceRows);

        const monthStart = Date.parse(month.periodStart);
        const monthEnd = Date.parse(month.periodEnd);
        const overlapStart = Math.max(queryStart, monthStart);
        const overlapEnd = Math.min(queryEnd, monthEnd);
        const overlapMs = overlapEnd - overlapStart + 1;
        const monthMs = monthEnd - monthStart + 1;

        for (const sourceRow of sourceRows) {
          const key = salesPlanRowKey(sourceRow);
          const existing =
            rows.get(key) ??
            ({
              periodStart,
              periodEnd,
              managerId: sourceRow.managerId,
              managerName: sourceRow.managerName,
              targetGroupKey: sourceRow.targetGroupKey,
              targetGroupLabel: sourceRow.targetGroupLabel,
              plannedDeals: 0,
              plannedAmount: 0,
              updatedAt: sourceRow.updatedAt
            } satisfies SalesPlanData["rows"][number]);

          existing.plannedDeals += proratePlanValue(
            sourceRow.plannedDeals,
            overlapMs,
            monthMs
          );
          existing.plannedAmount += proratePlanValue(
            sourceRow.plannedAmount,
            overlapMs,
            monthMs
          );
          if (sourceRow.updatedAt > existing.updatedAt) {
            existing.updatedAt = sourceRow.updatedAt;
          }
          rows.set(key, existing);
        }
      }

      const effectiveRows = Array.from(rows.values()).sort((left, right) => {
        const byManager = (left.managerName ?? left.managerId).localeCompare(
          right.managerName ?? right.managerId,
          "ru"
        );
        return byManager !== 0
          ? byManager
          : left.targetGroupLabel.localeCompare(right.targetGroupLabel, "ru");
      });

      return {
        periodStart,
        periodEnd,
        rows: effectiveRows,
        updatedAt: latestSalesPlanUpdatedAt(allSourceRows)
      };
    },

    async getPricingSettings() {
      const rules = await input.repository.getPricingRules();
      const updatedAt = rules.reduce<string | null>(
        (latest, rule) =>
          rule.updatedAt && (!latest || rule.updatedAt > latest)
            ? rule.updatedAt
            : latest,
        null
      );

      return {
        rules,
        updatedAt
      };
    },

    async replacePricingSettings(settingsInput) {
      const updatedAt = nowFactory().toISOString();
      const rules = await input.repository.replacePricingRules({
        ...settingsInput,
        updatedAt
      });

      return {
        rules,
        updatedAt
      };
    },

    async getOperationalThresholdSettings() {
      return input.repository.getOperationalThresholdSettings();
    },

    async replaceOperationalThresholdSettings(settingsInput) {
      return input.repository.replaceOperationalThresholdSettings({
        ...settingsInput,
        updatedAt: nowFactory().toISOString()
      });
    },

    async getUnitEconomicsSettings() {
      const [articles, rules, eventParticipantMode] = await Promise.all([
        input.repository.getUnitEconomicsCostArticles(),
        input.repository.getUnitEconomicsCostRules(),
        getUnitEconomicsEventParticipantMode()
      ]);

      return {
        articles,
        rules,
        eventParticipantMode,
        updatedAt: null
      };
    },

    async replaceUnitEconomicsCostRules(settingsInput) {
      const updatedAt = nowFactory().toISOString();
      const rules = await input.repository.replaceUnitEconomicsCostRules({
        ...settingsInput,
        updatedAt
      });
      const articles = await input.repository.getUnitEconomicsCostArticles();
      const eventParticipantMode =
        await getUnitEconomicsEventParticipantMode();

      return {
        articles,
        rules,
        eventParticipantMode,
        updatedAt
      };
    },

    async getConversionEventTypeSettings() {
      const [options, settings] = await Promise.all([
        input.repository.getConversionEventTypeOptions(),
        input.repository.getModuleEventTypeSettings("attraction")
      ]);
      const enabledTypeIds = new Set(
        settings.filter((setting) => setting.enabled).map((setting) => setting.eventTypeId)
      );

      return {
        options: options.map((option) => ({
          ...option,
          selectedForPlannedInventory: enabledTypeIds.has(option.id)
        })),
        settings
      };
    },

    async replaceConversionEventTypeSettings(settingsInput) {
      const options = await input.repository.getConversionEventTypeOptions();
      const optionById = new Map(options.map((option) => [option.id, option]));
      const selectedIds = Array.from(new Set(settingsInput.eventTypeIds.map(String)));
      const updatedAt = nowFactory().toISOString();
      const rows = selectedIds.map((eventTypeId) => {
        const option = optionById.get(eventTypeId);

        return {
          moduleKey: "attraction",
          eventTypeId,
          eventTypeLabel: option?.title ?? eventTypeId,
          enabled: true,
          updatedAt
        };
      });

      await input.repository.replaceModuleEventTypeSettings({
        moduleKey: "attraction",
        rows
      });

      return {
        options: options.map((option) => ({
          ...option,
          selectedForPlannedInventory: selectedIds.includes(option.id)
        })),
        settings: rows
      };
    },

    getManagerWhitelistSettings() {
      return buildManagerWhitelistSettingsData();
    },

    async replaceManagerWhitelistSettings(settingsInput) {
      const selectedIds = Array.from(
        new Set(settingsInput.managerIds.map(String).map((id) => id.trim()).filter(Boolean))
      );

      await input.repository.replaceManagerWhitelistSettings({
        moduleKey: "attraction",
        managerIds: selectedIds,
        ...(settingsInput.teams !== undefined
          ? { teams: settingsInput.teams }
          : {}),
        updatedAt: nowFactory().toISOString()
      });

      return buildManagerWhitelistSettingsData();
    },

    async getDashboard({ periodDays, range, compareRanges, filters }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [
        deals,
        stageCatalog,
        wonStageIds,
        stageHistory,
        activities,
        calls,
        pricingRules,
        events,
        costRules,
        eventParticipantMode
      ] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getWonStageIds(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls(),
          getPricingRules(),
          input.repository.getAllEventSnapshots(),
          input.repository.getUnitEconomicsCostRules(),
          getUnitEconomicsEventParticipantMode()
        ]);
      const canonical = await loadCanonicalReportInputs({
        stageHistory,
        activities,
        calls
      }, {
        includeEventVisitFacts: true
      });
      const reportStageHistory = canonical.stageHistory;
      const reportActivities = canonical.activities ?? activities;
      const reportCalls = canonical.calls ?? calls;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const scopedTouchpointFacts = canonical.dealTouchpointFacts.filter(
        (fact) => fact.dealId !== null && scopedDealIds.has(fact.dealId)
      );
      const scopedEventVisitFacts = canonical.eventVisitFacts.filter(
        (fact) => fact.dealId !== null && scopedDealIds.has(fact.dealId)
      );
      const scopedActivities = reportActivities.filter(
        (activity) =>
          isDealOwnerType(activity.ownerTypeId) && scopedDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = reportCalls.filter((call) => {
        if (
          isDealCallEntity(call.crmEntityType) &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(
          call.crmActivityId && activityById.has(call.crmActivityId)
        );
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById))
      );
      const buildSnapshot = (targetRange: ReportRange): DashboardSnapshot =>
        buildDashboard({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          leads: [],
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          calls: scopedCalls,
          managerDirectory,
          pricingRules,
          dealTouchpointFacts: scopedTouchpointFacts,
          eventVisitFacts: scopedEventVisitFacts,
          events,
          costRules,
          costFacts: [],
          eventParticipantMode
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as DashboardData;
    },

    async getSourceQualityConversionReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [deals, stageCatalog, stageHistory, wonStageIds] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(true),
        input.repository.getAllStageHistory(),
        input.repository.getWonStageIds()
      ]);
      const canonical = await loadCanonicalReportInputs({ stageHistory });
      const reportStageHistory = canonical.stageHistory;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): SourceQualityConversionReportSnapshot =>
        buildSourceQualityConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as SourceQualityConversionReport;
    },

    async getSourceCohortConversionReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const {
        scopedDeals,
        stageCatalog,
        wonStageIds,
        events,
        canonical,
        managerDirectory
      } = await loadSourceCohortReportInputs(filters);
      const reportNow = nowFactory();
      const buildSnapshot = (
        targetRange: ReportRange
      ): SourceCohortConversionReportSnapshot =>
        buildSourceCohortConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: canonical.stageHistory,
          dealStageFacts: canonical.dealStageFacts,
          dealTouchpointFacts: canonical.dealTouchpointFacts,
          eventVisitFacts: canonical.eventVisitFacts,
          events,
          managerDirectory,
          includeTrajectory: true,
          now: reportNow
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        reportNow
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as SourceCohortConversionReport;
    },

    async getSourceCohortConversionJourneyDrilldown({
      periodDays,
      range,
      filters,
      stepKey
    }) {
      const {
        scopedDeals,
        stageCatalog,
        wonStageIds,
        events,
        canonical,
        managerDirectory
      } = await loadSourceCohortReportInputs(filters);
      const reportNow = nowFactory();
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        reportNow
      );
      const snapshot = buildSourceCohortConversionReport({
        range: resolvedRange,
        wonStageIds,
        deals: scopedDeals,
        stageCatalog,
        stageHistory: canonical.stageHistory,
        dealStageFacts: canonical.dealStageFacts,
        dealTouchpointFacts: canonical.dealTouchpointFacts,
        eventVisitFacts: canonical.eventVisitFacts,
        events,
        managerDirectory,
        includeTrajectory: true,
        journeyDrilldown: {
          stepKey,
          dealUrlBuilder: (dealId) =>
            buildBitrixDealUrl(bitrixPortalHost, dealId)
        },
        now: reportNow
      });
      const drilldown = snapshot.trajectory?.journeyDrilldown;

      if (!drilldown) {
        throw new Error("Source cohort conversion journey drill-down is unavailable.");
      }

      return drilldown;
    },

    async getActivitiesWorkloadReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const workloadFilters = await normalizeWorkloadFilters(filters);
      const scopedFilters = workloadFilters.filters;
      const [
        deals,
        stageCatalog,
        stageHistory,
        activities,
        deadlineChanges,
        meetingDateChanges,
        calls,
        operationalThresholdSettings
      ] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllActivityDeadlineChanges(),
          input.repository.getAllDealMeetingDateChanges
            ? input.repository.getAllDealMeetingDateChanges()
            : Promise.resolve([]),
          input.repository.getAllCalls(),
          input.repository.getOperationalThresholdSettings()
        ]);
      const canonical = await loadCanonicalReportInputs({
        stageHistory,
        activities,
        calls,
        meetingDateChanges
      }, {
        includeTouchpointFacts: true,
        includeEventVisitFacts: true
      });
      const reportStageHistory = canonical.stageHistory;
      const reportActivities = canonical.activities ?? activities;
      const reportCalls = canonical.calls ?? calls;
      const reportMeetingDateChanges =
        canonical.meetingDateChanges ?? meetingDateChanges;
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );
      const allScopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDeals =
        workloadScope === "leadgen"
          ? allScopedDeals.filter((deal) =>
              isTimestampWithinRange(deal.dateCreate, resolvedRange)
            )
          : allScopedDeals;
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedDealById = new Map(scopedDeals.map((deal) => [deal.id, deal]));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const scopedActivities = reportActivities.filter(
        (activity) =>
          scopedDealIds.has(activity.ownerId) &&
          isManagerInScope(managerIds, activity.responsibleId)
      );
      const scopedDeadlineChanges = deadlineChanges.filter(
        (change) =>
          scopedDealIds.has(change.ownerId) &&
          isManagerInScope(managerIds, change.responsibleId)
      );
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...Array.from(managerIds),
          ...scopedDeals.map((deal) => deal.assignedById),
          ...scopedActivities.map((row) => row.responsibleId),
          ...scopedDeadlineChanges.map((row) => row.responsibleId),
          managerIds.has(UNASSIGNED_MANAGER_ID) ? UNASSIGNED_MANAGER_ID : null
        ]),
        { attractionOrder: workloadScope !== "leadgen" }
      );
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = reportCalls.filter((call) => {
        const activity = call.crmActivityId
          ? activityById.get(call.crmActivityId)
          : null;
        if (
          call.crmEntityType === "DEAL" &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return isManagerInScope(
            managerIds,
            call.portalUserId ?? activity?.responsibleId
          );
        }

        return Boolean(
          activity &&
            isManagerInScope(
              managerIds,
              call.portalUserId ?? activity.responsibleId
            )
          );
      });
      const scopedEventVisitFacts = canonical.eventVisitFacts.filter((fact) => {
        if (!fact.dealId || !scopedDealIds.has(fact.dealId)) {
          return false;
        }

        const deal = scopedDealById.get(fact.dealId);
        return isManagerInScope(managerIds, deal?.assignedById ?? fact.managerId);
      });
      const scopedDealTouchpointFacts = canonical.dealTouchpointFacts.filter(
        (fact) => {
          if (
            fact.kind !== "conversion_event_visit" ||
            !fact.dealId ||
            !scopedDealIds.has(fact.dealId)
          ) {
            return false;
          }

          const deal = scopedDealById.get(fact.dealId);
          return isManagerInScope(managerIds, deal?.assignedById ?? fact.managerId);
        }
      );
      const slaAsOf = nowFactory().toISOString();
      const buildSnapshot = (
        targetRange: ReportRange
      ): ActivitiesWorkloadReportSnapshot =>
        buildActivitiesWorkloadReport({
          range: targetRange,
          slaAsOf,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          deadlineChanges: scopedDeadlineChanges,
          meetingDateChanges: reportMeetingDateChanges,
          calls: scopedCalls,
          eventVisitFacts: scopedEventVisitFacts,
          dealTouchpointFacts: scopedDealTouchpointFacts,
          managerDirectory,
          slaBusinessHours: operationalThresholdSettings.slaBusinessHours
        });

      const report = attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as ActivitiesWorkloadReport;

      return {
        ...report,
        warnings: [...workloadFilters.warnings, ...report.warnings]
      };
    },

    async getOperationalDashboardReport({ periodDays, range, filters }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const now = nowFactory();
      const [
        deals,
        stageCatalog,
        stageHistory,
        activities,
        calls,
        wonStageIds,
        operationalThresholdSettings
      ] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(true),
        input.repository.getAllStageHistory(),
        input.repository.getAllActivities(),
        input.repository.getAllCalls(),
        input.repository.getWonStageIds(),
        input.repository.getOperationalThresholdSettings()
      ]);
      const canonical = await loadCanonicalReportInputs({
        stageHistory,
        activities,
        calls
      }, {
        includeTouchpointFacts: true
      });
      const reportStageHistory = canonical.stageHistory;
      const reportActivities = canonical.activities ?? activities;
      const reportCalls = canonical.calls ?? calls;
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        now
      );
      const allScopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const allScopedDealIds = new Set(allScopedDeals.map((deal) => deal.id));
      const allScopedStageHistory = reportStageHistory.filter((row) =>
        allScopedDealIds.has(row.ownerId)
      );
      const relevantDealIds = selectOperationalDashboardDealIds({
        deals: allScopedDeals,
        stageHistory: allScopedStageHistory,
        activities: reportActivities,
        range: resolvedRange,
        now: now.toISOString(),
        wonStageIds
      });
      const scopedDeals = allScopedDeals.filter((deal) =>
        relevantDealIds.has(deal.id)
      );
      const scopedStageHistory = allScopedStageHistory.filter((row) =>
        relevantDealIds.has(row.ownerId)
      );
      const scopedActivities = reportActivities.filter(
        (activity) =>
          isDealOwnerType(activity.ownerTypeId) &&
          relevantDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = reportCalls.filter((call) => {
        if (
          isDealCallEntity(call.crmEntityType) &&
          call.crmEntityId &&
          relevantDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(call.crmActivityId && activityById.has(call.crmActivityId));
      });
      const managerDirectory = await getLocalManagerDirectory(
        uniqueStrings([
          ...scopedDeals.map((deal) => deal.assignedById),
          ...scopedActivities.map((activity) => activity.responsibleId),
          ...scopedCalls.map((call) => call.portalUserId),
          ...scopedCalls.map((call) =>
            call.crmActivityId
              ? activityById.get(call.crmActivityId)?.responsibleId ?? null
              : null
          )
        ])
      );

      return buildOperationalDashboardReport({
        range: resolvedRange,
        now: now.toISOString(),
        deals: scopedDeals,
        stageCatalog,
        stageHistory: scopedStageHistory,
        activities: scopedActivities,
        calls: scopedCalls,
        managerDirectory,
        thresholds: operationalThresholdSettings,
        wonStageIds,
        dealUrlBuilder: (dealId) => buildBitrixDealUrl(bitrixPortalHost, dealId)
      });
    },

    async getAcquisitionOutcomesReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [deals, stageCatalog, stageHistory] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(true),
        input.repository.getAllStageHistory()
      ]);
      const canonical = await loadCanonicalReportInputs({ stageHistory });
      const reportStageHistory = canonical.stageHistory;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById))
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): AcquisitionOutcomesReportSnapshot =>
        buildAcquisitionOutcomesReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          managerDirectory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as AcquisitionOutcomesReport;
    },

    async getTargetGroupConversionReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [deals, stageCatalog, wonStageIds, stageHistory, pricingRules] =
        await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(),
        input.repository.getWonStageIds(),
        input.repository.getAllStageHistory(),
        getPricingRules()
      ]);
      const canonical = await loadCanonicalReportInputs({ stageHistory });
      const reportStageHistory = canonical.stageHistory;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): TargetGroupConversionReportSnapshot =>
        buildTargetGroupConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          pricingRules
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as TargetGroupConversionReport;
    },

    async getManagerActionOutcomeReport({ filters }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [
        deals,
        stageCatalog,
        stageHistory,
        activities,
        calls,
        wonStageIds,
        events,
        costRules,
        eventParticipantMode
      ] = await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls(),
          input.repository.getWonStageIds(),
          input.repository.getAllEventSnapshots(),
          input.repository.getUnitEconomicsCostRules(),
          getUnitEconomicsEventParticipantMode()
        ]);
      const canonical = await loadCanonicalReportInputs({
        stageHistory,
        activities,
        calls
      }, {
        includeEventVisitFacts: true
      });
      const reportStageHistory = canonical.stageHistory;
      const reportActivities = canonical.activities ?? activities;
      const reportCalls = canonical.calls ?? calls;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedTouchpointFacts = canonical.dealTouchpointFacts.filter(
        (fact) => fact.dealId !== null && scopedDealIds.has(fact.dealId)
      );
      const scopedEventVisitFacts = canonical.eventVisitFacts.filter(
        (fact) => fact.dealId !== null && scopedDealIds.has(fact.dealId)
      );
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const dealScopedActivities = reportActivities.filter((activity) =>
        scopedDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        dealScopedActivities.map((activity) => [activity.id, activity])
      );
      const dealScopedCalls = reportCalls.filter((call) => {
        const activity = call.crmActivityId
          ? activityById.get(call.crmActivityId)
          : null;
        if (
          call.crmEntityType === "DEAL" &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(activity);
      });
      const managerScopedActivities = dealScopedActivities.filter((activity) =>
        isManagerInScope(managerIds, activity.responsibleId)
      );
      const managerScopedCalls = dealScopedCalls.filter((call) => {
        const activity = call.crmActivityId
          ? activityById.get(call.crmActivityId)
          : null;

        return isManagerInScope(
          managerIds,
          call.portalUserId ?? activity?.responsibleId
        );
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...scopedDeals.map((deal) => deal.assignedById),
          ...managerScopedActivities.map((activity) => activity.responsibleId),
          ...managerScopedCalls.map((call) => call.portalUserId)
        ])
      );
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const pricingRules = await getPricingRules();
      const slaAsOf = nowFactory().toISOString();
      const buildSnapshot = (
        targetRange: ReportRange
      ): ManagerActionOutcomeReportSnapshot =>
        buildManagerActionOutcomeReport({
          range: targetRange,
          slaAsOf,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: dealScopedActivities,
          calls: dealScopedCalls,
          managerDirectory,
          pricingRules,
          dealTouchpointFacts: scopedTouchpointFacts,
          eventVisitFacts: scopedEventVisitFacts,
          events,
          costRules,
          costFacts: [],
          eventParticipantMode
        });
      const reportRange = resolveLatestTwelveMonthCohortRange(nowFactory());
      const warnings = await buildManagerActionOutcomeWarnings({
        repository: input.repository,
        categoryIds: input.dealCategoryIds,
        assignedByIds: scopedFilters.managerIds ?? [],
        range: reportRange,
        ...(input.meetingDateFieldName
          ? { meetingDateFieldName: input.meetingDateFieldName }
          : {})
      });

      const snapshot = buildSnapshot(reportRange);

      return {
        ...snapshot,
        warnings: [...warnings, ...snapshot.warnings]
      };
    },

    async getCallsWorkloadReport({ periodDays, range, compareRanges, filters }) {
      const workloadFilters = await normalizeWorkloadFilters(filters);
      const scopedFilters = workloadFilters.filters;
      const [deals, stageCatalog, stageHistory, activities, activityBindings, calls] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllActivityBindings(),
          input.repository.getAllCalls()
        ]);
      const canonical = await loadCanonicalReportInputs({
        stageHistory,
        activities,
        calls
      });
      const reportStageHistory = canonical.stageHistory;
      const reportActivities = canonical.activities ?? activities;
      const reportCalls = canonical.calls ?? calls;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters, {
        includeManagerFilter: workloadScope === "leadgen"
      });
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const activityById = new Map(reportActivities.map((activity) => [activity.id, activity]));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const managerScopedCalls = reportCalls.filter((call) => {
        const activity = call.crmActivityId ? activityById.get(call.crmActivityId) : null;
        const managerId =
          call.portalUserId ?? activity?.responsibleId ?? UNASSIGNED_MANAGER_ID;

        if (managerIds.size > 0 && !managerIds.has(managerId)) {
          return false;
        }

        return true;
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...Array.from(managerIds),
          ...managerScopedCalls.map((row) => row.portalUserId),
          ...managerScopedCalls.map((row) =>
            row.crmActivityId
              ? activityById.get(row.crmActivityId)?.responsibleId ?? null
              : null
          ),
          managerIds.has(UNASSIGNED_MANAGER_ID) ? UNASSIGNED_MANAGER_ID : null
        ]),
        { attractionOrder: workloadScope !== "leadgen" }
      );
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (targetRange: ReportRange): CallsWorkloadReportSnapshot =>
        buildCallsWorkloadReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: reportActivities,
          activityBindings,
          calls: managerScopedCalls,
          managerDirectory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      const report = attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as CallsWorkloadReport;

      return {
        ...report,
        warnings: [...workloadFilters.warnings, ...report.warnings]
      };
    },

    async getCallAnalysisQueue({
      periodDays,
      range,
      filters,
      stageIds,
      callTypes,
      analysisStatuses
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );
      const [calls, activities, deals, stageHistory, stageCatalog] =
        await Promise.all([
          input.repository.getAllCalls(),
          input.repository.getAllActivities(),
          input.repository.getAllDeals(),
          input.repository.getAllStageHistory(),
          getScopedStageCatalog(true)
        ]);
      const activityById = new Map(activities.map((activity) => [activity.id, activity]));
      const dealById = new Map(deals.map((deal) => [deal.id, deal]));
      const sourceLabels = buildSourceLabelMap(stageCatalog);
      const managerFilter = new Set(scopedFilters.managerIds ?? []);
      const sourceFilter = new Set(scopedFilters.sourceKeys ?? []);
      const stageFilter = new Set(stageIds ?? []);
      const callTypeFilter = new Set(callTypes ?? []);

      const scopedCalls = calls
        .filter((call) => isInsideRange(call.callStartDate, resolvedRange))
        .map((call) => {
          const activity = call.crmActivityId
            ? activityById.get(call.crmActivityId) ?? null
            : null;
          const dealId = resolveCallDealId(call, activity);
          const deal = dealId ? dealById.get(dealId) ?? null : null;
          const managerId = resolveCallManagerId(call, activity, deal);
          const sourceKey = deal ? resolveDealSource(deal, sourceLabels).key : null;
          const callType = resolveQueueCallType(call);
          const stageAtCall = resolveStageAtCall(
            stageHistory,
            deal?.id ?? null,
            call.callStartDate
          );
          const stageAtCallId = stageAtCall?.stageId ?? deal?.stageId ?? null;

          return {
            call,
            activity,
            deal,
            managerId,
            sourceKey,
            stageAtCallId,
            callType
          };
        })
        .filter((row) => {
          if (
            !row.deal ||
            !allowedCategoryIds.has(normalizeCategoryId(row.deal.categoryId))
          ) {
            return false;
          }

          if (managerFilter.size > 0 && (!row.managerId || !managerFilter.has(row.managerId))) {
            return false;
          }

          if (sourceFilter.size > 0 && (!row.sourceKey || !sourceFilter.has(row.sourceKey))) {
            return false;
          }

          if (stageFilter.size > 0 && (!row.stageAtCallId || !stageFilter.has(row.stageAtCallId))) {
            return false;
          }

          if (callTypeFilter.size > 0 && !callTypeFilter.has(row.callType)) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          const durationCompare =
            right.call.callDurationSeconds - left.call.callDurationSeconds;
          return durationCompare || right.call.callStartDate.localeCompare(left.call.callStartDate);
        });

      const managerIds = Array.from(
        new Set(
          scopedCalls
            .map((row) => row.managerId)
            .filter((managerId): managerId is string => managerId !== null)
        )
      );
      const managers = await ensureManagerDirectory(managerIds);
      const managerNameById = new Map(managers.map((manager) => [manager.id, manager.name]));
      const callIds = scopedCalls.map((row) => row.call.id);
      const [results, latestRuns] = await Promise.all([
        Promise.all(callIds.map((callId) => input.repository.getCallAnalysisResult(callId))),
        input.repository.getLatestCallAnalysisRuns(callIds)
      ]);
      const resultByCallId = new Map(
        results.filter((result): result is CallAnalysisResultRecord => result !== null)
          .map((result) => [result.callId, result])
      );
      const latestRunByCallId = new Map(
        latestRuns.map((run) => [run.callId, run])
      );

      const statusFilter = new Set(analysisStatuses ?? []);
      const items = scopedCalls
        .map<CallAnalysisQueueItem>((row) => {
          const result = resultByCallId.get(row.call.id) ?? null;
          const latestRun = latestRunByCallId.get(row.call.id) ?? null;
          const analysisStatus = resolveQueueAnalysisStatus(result, latestRun);

          return {
            callId: row.call.id,
            crmActivityId: normalizeNullableId(row.call.crmActivityId),
            startedAt: row.call.callStartDate,
            managerId: row.managerId,
            managerName: row.managerId
              ? managerNameById.get(row.managerId) ?? row.managerId
              : UNASSIGNED_MANAGER_NAME,
            callType: row.callType,
            callTypeLabel: formatQueueCallTypeLabel(row.callType),
            durationSeconds: row.call.callDurationSeconds,
            dealId: row.deal?.id ?? null,
            dealSourceId: row.sourceKey,
            dealCurrentStageId: row.deal?.stageId ?? null,
            dealCurrentStageName: resolveStageCatalogName(
              stageCatalog,
              row.deal?.categoryId,
              row.deal?.stageId
            ),
            stageAtCallId: row.stageAtCallId,
            stageAtCallName: resolveStageCatalogName(
              stageCatalog,
              row.deal?.categoryId,
              row.stageAtCallId
            ),
            analysisStatus,
            score: extractQueueScore(result),
            promptVersion: result?.promptVersion ?? latestRun?.promptVersion ?? null,
            model: result?.model ?? latestRun?.model ?? null,
            analyzedAt: result?.analyzedAt ?? null,
            updatedAt: result?.updatedAt ?? latestRun?.finishedAt ?? null,
            errorCode: latestRun?.errorCode ?? null,
            errorMessage: latestRun?.errorMessage ?? null,
            bitrixUrl: buildBitrixDealUrl(bitrixPortalHost, row.deal?.id ?? null)
          };
        })
        .filter((item) =>
          statusFilter.size > 0 ? statusFilter.has(item.analysisStatus) : true
        )
        .sort((left, right) => {
          const leftReady = left.analysisStatus === "ready" ? 1 : 0;
          const rightReady = right.analysisStatus === "ready" ? 1 : 0;
          return (
            leftReady - rightReady ||
            right.durationSeconds - left.durationSeconds ||
            right.startedAt.localeCompare(left.startedAt)
          );
        });

      return {
        range: resolvedRange,
        totals: buildQueueTotals(items),
        items
      };
    },

    async getCallAnalysisResult(callId) {
      return input.repository.getCallAnalysisResult(callId);
    },

    async isCallInAttractionManagerScope(callId, managerIds) {
      const managerIdSet = new Set(managerIds);
      if (managerIdSet.size === 0) {
        return false;
      }

      const [calls, activities, deals] = await Promise.all([
        input.repository.getAllCalls(),
        input.repository.getAllActivities(),
        input.repository.getAllDeals()
      ]);
      const call = calls.find((row) => row.id === callId);
      if (!call) {
        return false;
      }

      const activity = call.crmActivityId
        ? activities.find((row) => row.id === call.crmActivityId) ?? null
        : null;
      const dealId = resolveCallDealId(call, activity);
      const deal = dealId ? deals.find((row) => row.id === dealId) ?? null : null;
      if (!deal || !allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))) {
        return false;
      }

      const managerId = resolveCallManagerId(call, activity, deal);
      return Boolean(managerId && managerIdSet.has(managerId));
    },

    async getConversionEventsReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [
        deals,
        stageCatalog,
        stageHistory,
        visits,
        events,
        eventTypeSettings
      ] =
        await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(true),
        input.repository.getAllStageHistory(),
        input.repository.getAllConversionEventVisits(),
        input.repository.getAllEventSnapshots(),
        input.repository.getModuleEventTypeSettings("attraction")
      ]);
      const canonical = await loadCanonicalReportInputs(
        { stageHistory },
        { includeEventVisitFacts: true }
      );
      const reportStageHistory = canonical.stageHistory;
      const eventVisitFacts = canonical.eventVisitFacts;
      const sourceLabels = buildSourceLabelMap(stageCatalog);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const dealsById = new Map(scopedDeals.map((deal) => [deal.id, deal]));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const sourceKeys = new Set(scopedFilters.sourceKeys ?? []);
      const scopedVisits = visits.filter((visit) => {
        const deal = visit.dealId ? dealsById.get(visit.dealId) : undefined;

        if (visit.dealId && !deal) {
          return false;
        }

        const managerId =
          visit.managerId ?? deal?.assignedById ?? UNASSIGNED_MANAGER_ID;
        if (managerIds.size > 0 && !managerIds.has(managerId)) {
          return false;
        }

        const sourceKey =
          visit.sourceId ?? deal?.sourceId ?? UNATTRIBUTED_SOURCE_KEY;
        if (sourceKeys.size > 0 && !sourceKeys.has(sourceKey)) {
          return false;
        }

        return true;
      });
      const scopedEventVisitFacts = eventVisitFacts.filter((fact) => {
        const deal = fact.dealId ? dealsById.get(fact.dealId) : undefined;

        if (fact.dealId && !deal) {
          return false;
        }

        const managerId =
          deal?.assignedById ?? fact.managerId ?? UNASSIGNED_MANAGER_ID;
        if (managerIds.size > 0 && !managerIds.has(managerId)) {
          return false;
        }

        const sourceKey =
          deal?.sourceId ?? fact.sourceId ?? UNATTRIBUTED_SOURCE_KEY;
        if (sourceKeys.size > 0 && !sourceKeys.has(sourceKey)) {
          return false;
        }

        return true;
      });
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const conversionEventsCoverageConfirmed =
        await input.repository.hasSyncCoverage({
          scopeKey: buildCategoryScopeKey(
            input.dealCategoryIds,
            scopedFilters.managerIds ?? []
          ),
          stream: CONVERSION_EVENT_VISITS_COVERAGE_STREAM,
          providerId: CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER,
          requiredFrom: FULL_COVERAGE_FROM,
          algorithmVersion: CONVERSION_EVENT_VISITS_COVERAGE_VERSION
        });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...scopedDeals.map((deal) => deal.assignedById),
          ...scopedVisits.map((visit) => visit.managerId),
          ...scopedEventVisitFacts.map((fact) => fact.managerId)
        ])
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): ConversionEventsReportSnapshot => {
        const snapshot = buildConversionEventsReport({
          range: targetRange,
          visits: scopedVisits,
          eventVisitFacts: scopedEventVisitFacts,
          events,
          eventTypeSettings,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          managerDirectory,
          sourceLabels,
          asOf: nowFactory().toISOString()
        });

        if (conversionEventsCoverageConfirmed) {
          return snapshot;
        }

        return {
          ...snapshot,
          warnings: Array.from(
            new Set([
              ...snapshot.warnings,
              CONVERSION_EVENTS_INCOMPLETE_WARNING
            ])
          )
        };
      };
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as ConversionEventsReport;
    },

    async getCohortConversionReport({
      filters,
      includeBreakdown
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [deals, wonStageIds, stageHistory] = await Promise.all([
        input.repository.getAllDeals(),
        input.repository.getWonStageIds(),
        input.repository.getAllStageHistory()
      ]);
      const stageCatalog = await getScopedStageCatalog(true);
      const canonical = await loadCanonicalReportInputs({ stageHistory });
      const reportStageHistory = canonical.stageHistory;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): CohortConversionReportSnapshot =>
        buildCohortConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          ...(includeBreakdown !== undefined ? { includeBreakdown } : {}),
          stageCatalog,
          stageHistory: scopedStageHistory
        });

      return buildSnapshot(resolveLatestTwelveMonthCohortRange(nowFactory()));
    },

    async getTocFlowReport({ periodDays, range, compareRanges, filters }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [deals, stageCatalog, stageHistory] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(),
        input.repository.getAllStageHistory()
      ]);
      const canonical = await loadCanonicalReportInputs({ stageHistory });
      const reportStageHistory = canonical.stageHistory;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (targetRange: ReportRange): TocFlowReportSnapshot =>
        buildTocFlowReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as TocFlowReport;
    },

    async getRevenueVelocityReport({
      periodDays,
      range,
      compareRanges,
      filters,
      dimension = "manager",
      view = "systemState",
      asOf
    }) {
      const scopedFilters = (await normalizeAttractionReportFilters(filters)) as ReportFilters & {
        customerKeys?: string[];
        qualityKeys?: string[];
        tariffKeys?: string[];
      };
      const [
        deals,
        stageCatalog,
        stageHistory,
        activities,
        calls,
        wonStageIds,
        pricingRules
      ] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls(),
          input.repository.getWonStageIds(),
          getPricingRules()
        ]);
      const canonical = await loadCanonicalReportInputs({
        stageHistory,
        activities,
        calls
      });
      const reportStageHistory = canonical.stageHistory;
      const reportActivities = canonical.activities ?? activities;
      const reportCalls = canonical.calls ?? calls;
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = reportStageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const scopedActivities = reportActivities.filter(
        (activity) =>
          isDealOwnerType(activity.ownerTypeId) && scopedDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = reportCalls.filter((call) => {
        if (
          isDealCallEntity(call.crmEntityType) &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(
          call.crmActivityId && activityById.has(call.crmActivityId)
        );
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById))
      );
      const sourceCatalog = buildSourceCatalog(scopedDeals, stageCatalog);
      const buildSnapshot = (
        targetRange: ReportRange
      ): RevenueVelocityReportSnapshot => {
        const snapshotAsOf = asOf ?? targetRange.to;

        return buildRevenueVelocityReport({
          range: targetRange,
          asOf: snapshotAsOf,
          dimension,
          view,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          calls: scopedCalls,
          conversionEvents: [],
          managerDirectory,
          sourceCatalog,
          filters: scopedFilters,
          pricingRules
        });
      };
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as RevenueVelocityReport;
    },

    async getUnitEconomicsReport({
      periodDays,
      range,
      compareRanges,
      filters,
      eventParticipantMode
    }) {
      const scopedFilters = await normalizeAttractionReportFilters(filters);
      const [
        deals,
        stageCatalog,
        stageHistory,
        wonStageIds,
        pricingRules,
        eventVisitFacts,
        events
      ] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getAllStageHistory(),
          input.repository.getWonStageIds(),
          getPricingRules(),
          input.repository.getAllEventVisitFacts(),
          input.repository.getAllEventSnapshots()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const dealsById = new Map(scopedDeals.map((deal) => [deal.id, deal]));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const sourceKeys = new Set(scopedFilters.sourceKeys ?? []);
      const scopedEventVisitFacts = eventVisitFacts.filter((fact) => {
        const deal = fact.dealId ? dealsById.get(fact.dealId) : undefined;

        if (fact.dealId && !deal) {
          return false;
        }

        const managerId =
          deal?.assignedById ?? fact.managerId ?? UNASSIGNED_MANAGER_ID;
        if (managerIds.size > 0 && !managerIds.has(managerId)) {
          return false;
        }

        const sourceKey =
          deal?.sourceId ?? fact.sourceId ?? UNATTRIBUTED_SOURCE_KEY;
        if (sourceKeys.size > 0 && !sourceKeys.has(sourceKey)) {
          return false;
        }

        return true;
      });
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...scopedDeals.map((deal) => deal.assignedById ?? UNASSIGNED_MANAGER_ID),
          ...scopedEventVisitFacts.map((fact) => fact.managerId)
        ])
      );
      const buildSnapshot = async (targetRange: ReportRange) => {
        const [costRules, costFacts, savedEventParticipantMode] = await Promise.all([
          input.repository.getUnitEconomicsCostRules(),
          input.repository.getUnitEconomicsCostFacts({
            periodStart: targetRange.from,
            periodEnd: targetRange.to
          }),
          getUnitEconomicsEventParticipantMode()
        ]);

        return buildUnitEconomicsReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          eventVisitFacts: scopedEventVisitFacts,
          events,
          wonStageIds,
          pricingRules,
          costRules,
          costFacts,
          eventParticipantMode: eventParticipantMode ?? savedEventParticipantMode,
          managerDirectory
        });
      };
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );
      const snapshot = await buildSnapshot(resolvedRange);

      if (!compareRanges?.length) {
        return snapshot;
      }

      return {
        ...snapshot,
        comparisons: await Promise.all(
          compareRanges.map(async (compareRange, compareIndex) => ({
            compareIndex,
            range: compareRange,
            snapshot: await buildSnapshot(compareRange)
          }))
        )
      };
    },

    async getAttractionOntology() {
      return loadAttractionOntology({
        stageCatalog: await getScopedStageCatalog(true)
      });
    },

    async getAttractionOntologySourceDocument(sourceId) {
      return loadAttractionOntologySourceDocument({ sourceId });
    },

    async getMeta(metaInput = {}) {
      const managerScope = metaInput.filters?.managerIds ?? await getAttractionManagerScope();
      const scopeKey = buildCategoryScopeKey(input.dealCategoryIds, managerScope);
      const [deals, stageCatalog, wonStageIds, lastSync, snapshotStats] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getWonStageIds(),
          input.repository.getLastSyncSummary(scopeKey),
          input.repository.getSnapshotStats({
            categoryIds: input.dealCategoryIds,
            assignedByIds: managerScope
          })
        ]);
      const scopedFilters = normalizeAttractionManagerFilters(undefined, managerScope);
      const scopedDeals = filterDealsByFilters(
        deals,
        stageCatalog,
        scopedFilters
      );
      const managerCatalog = await ensureManagerDirectory(managerScope);
      const syncHealth = await buildSyncHealth({
        repository: input.repository,
        categoryIds: input.dealCategoryIds,
        assignedByIds: managerScope,
        lastSync,
        now: nowFactory(),
        bootstrapLookbackDays: input.bootstrapLookbackDays ?? 365,
        ...(input.meetingDateFieldName
          ? { meetingDateFieldName: input.meetingDateFieldName }
          : {})
      });

      return {
        stageCatalog,
        managerCatalog,
        sourceCatalog: buildSourceCatalog(scopedDeals, stageCatalog),
        businessClubCatalog: buildValueCatalog(scopedDeals, resolveBusinessClubFilterKey),
        targetGroupCatalog: buildValueCatalog(scopedDeals, resolveTargetGroupFilterKey),
        wonStageIds,
        defaultPeriodDays: input.defaultPeriodDays,
        lastSync,
        snapshotStats,
        syncHealth
      };
    },

    async getSyncRuns(syncInput = {}) {
      const scopeKey = buildCategoryScopeKey(input.dealCategoryIds);

      return {
        runs: await input.repository.listSyncRuns({
          ...(syncInput.limit === undefined ? {} : { limit: syncInput.limit }),
          scopeKey
        })
      };
    },

    async performSync(syncInput) {
      clearReportInputCache();
      try {
        const assignedByIds = await getAttractionManagerScope();
        const summary = await performManualSync({
          categoryIds: input.dealCategoryIds,
          qualityFieldName: input.qualityFieldName,
          client: input.client,
          repository: input.repository,
          now: () => nowFactory().toISOString(),
          assignedByIds,
          ...(syncInput?.onProgress ? { onProgress: syncInput.onProgress } : {}),
          ...(input.bootstrapLookbackDays
            ? { bootstrapLookbackDays: input.bootstrapLookbackDays }
            : {}),
          ...(input.tariffFieldName
            ? { tariffFieldName: input.tariffFieldName }
            : {}),
          ...(input.businessClubFieldName
            ? { businessClubFieldName: input.businessClubFieldName }
            : {}),
          ...(input.targetGroupFieldName
            ? { targetGroupFieldName: input.targetGroupFieldName }
            : {}),
          ...(input.meetingTypeFieldName
            ? { meetingTypeFieldName: input.meetingTypeFieldName }
            : {}),
          ...(input.meetingDateFieldName
            ? { meetingDateFieldName: input.meetingDateFieldName }
            : {}),
          ...(input.contactTargetGroupFieldName
            ? { contactTargetGroupFieldName: input.contactTargetGroupFieldName }
            : {}),
          ...(input.legacyContactTargetGroupFieldName
            ? {
                legacyContactTargetGroupFieldName:
                  input.legacyContactTargetGroupFieldName
            }
            : {}),
          afterPersist: async () => {
            await rebuildAnalyticsFacts();
          }
        });
        return summary;
      } finally {
        clearReportInputCache();
      }
    },

    rebuildAnalyticsFacts() {
      return rebuildAnalyticsFacts();
    },

    async updateWonStages(stageIds) {
      await input.repository.setWonStageIds(stageIds);
      return {
        wonStageIds: await input.repository.getWonStageIds()
      };
    }
  };
}
