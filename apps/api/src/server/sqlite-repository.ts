import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import Database from "better-sqlite3";
import type {
  ActivityDeadlineChangeSnapshot,
  ActivityBindingSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventVisitSnapshot,
  ConversionEventTypeOption,
  DealMeetingSlot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  DealPricingRule,
  DealPricingRuleInput,
  DealMeetingDateChangeSnapshot,
  DealSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  EventVisitStageHistorySnapshot,
  IdentityLinkSnapshot,
  LeadSnapshot,
  ManagerDirectoryEntry,
  ManagerWhitelistSetting,
  ModuleEventTypeSetting,
  OperationalStageAgingThreshold,
  OperationalThresholdSettings,
  OperationalThresholdSettingsInput,
  SalesPlanDraftRow,
  SalesPlanRow,
  SnapshotStats,
  StageCatalogEntry,
  StageHistorySnapshot,
  SyncDealChangeBreakdown,
  SyncRunLogEntry,
  UnitEconomicsCostArticle,
  UnitEconomicsCostFact,
  UnitEconomicsCostRule,
  UnitEconomicsEventParticipantMode
} from "@bitrix24-reporting/contracts";

import { DEFAULT_PRICING_RULES } from "../domain/deal-economics.js";
import {
  DEFAULT_UNIT_ECONOMICS_COST_ARTICLES,
  DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
  DEFAULT_UNIT_ECONOMICS_COST_RULES
} from "../domain/unit-economics.js";
import { ATTRACTION_MANAGER_CATALOG } from "../domain/attraction-managers.js";
import { sanitizeRefusalReasonDetail } from "../domain/refusal-detail.js";
import { createCallAnalysisRepositoryMethods } from "./sqlite/call-analysis.js";
import { createCommentRepositoryMethods } from "./sqlite/comments.js";
import { createEnrichmentProposalRepositoryMethods } from "./sqlite/enrichment-proposals.js";
import { createTelegramManagerRegistrationRepositoryMethods } from "./sqlite/telegram-manager-registrations.js";

export interface LastSyncSummary {
  finishedAt: string;
  leadsSynced: number;
  dealsSynced: number;
  mode: "full" | "delta";
  dealBreakdown: SyncDealChangeBreakdown;
}

const OPERATIONAL_THRESHOLD_SETTINGS_KEY = "attraction";
const CURRENT_ATTRACTION_SCOPE_KEY_STATE = "attraction_current_scope_key";
const CURRENT_ATTRACTION_SCOPE_RECONCILED_AT_STATE =
  "attraction_current_scope_reconciled_at";

export interface CurrentAttractionScopeSnapshot {
  scopeKey: string | null;
  reconciledAt: string | null;
  dealIds: string[];
}

const DEFAULT_OPERATIONAL_STAGE_AGING_THRESHOLDS: OperationalStageAgingThreshold[] = [
  {
    stageId: "C10:NEW",
    stageName: "База входящая",
    maxDaysOnStage: 1
  },
  {
    stageId: "C10:PREPARATION",
    stageName: "Звонок-знакомство",
    maxDaysOnStage: 3
  },
  {
    stageId: "C10:UC_9E0XYG",
    stageName: "Встреча-знакомство",
    maxDaysOnStage: 14
  },
  {
    stageId: "C10:UC_61CBCU",
    stageName: "Активация",
    maxDaysOnStage: 14
  },
  {
    stageId: "C10:UC_A249EJ",
    stageName: "Демонстрация",
    maxDaysOnStage: 14
  },
  {
    stageId: "C10:UC_CPR91Y",
    stageName: "Проблематизация",
    maxDaysOnStage: 14
  },
  {
    stageId: "C10:UC_5KZT6Y",
    stageName: "Адмиссия",
    maxDaysOnStage: 7
  },
  {
    stageId: "C10:UC_M1M5WM",
    stageName: "Контракт",
    maxDaysOnStage: 7
  },
  {
    stageId: "C10:UC_7CLBFT",
    stageName: "На передаче",
    maxDaysOnStage: 5
  }
];

const DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT: OperationalThresholdSettingsInput = {
  stageAging: DEFAULT_OPERATIONAL_STAGE_AGING_THRESHOLDS.map((threshold) => ({
    stageId: threshold.stageId,
    maxDaysOnStage: threshold.maxDaysOnStage
  })),
  noCallsMaxDays: 7,
  noActivityMaxDays: 5,
  slaBusinessHours: {
    sla1: 24,
    sla2: 5,
    sla3: 72
  }
};

export interface SyncCursorInput {
  key: string;
  cursorValue: string;
  updatedAt: string;
}

export interface SyncCoverageInput {
  scopeKey: string;
  stream: string;
  providerId: string | null;
  coveredFrom: string;
  coveredTo: string | null;
  algorithmVersion: string;
  syncedAt: string;
}

export interface SyncCoverageQuery {
  scopeKey: string;
  stream: string;
  providerId: string | null;
  requiredFrom: string;
  requiredTo?: string | null;
  requiredSyncedAt?: string | null;
  algorithmVersion: string;
}

export interface SnapshotStatsScope {
  categoryIds?: string[];
  assignedByIds?: string[];
}

export interface SuccessfulSyncScope {
  scopeKey: string;
  categoryIds: string[];
  assignedByIds: string[];
}

export interface ReplaceSalesPlanRowsInput {
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  rows: SalesPlanDraftRow[];
}

export interface ReplaceSalesPlanPeriodsInput {
  updatedAt: string;
  periods: Array<{
    periodStart: string;
    periodEnd: string;
    rows: SalesPlanDraftRow[];
  }>;
}

export interface ReplacePricingRulesInput {
  updatedAt: string;
  rules: DealPricingRuleInput[];
}

export interface ReplaceOperationalThresholdSettingsInput
  extends OperationalThresholdSettingsInput {
  updatedAt: string;
}

export interface ReplaceUnitEconomicsCostRulesInput {
  updatedAt: string;
  rules: UnitEconomicsCostRule[];
  eventParticipantMode?: UnitEconomicsEventParticipantMode;
}

export interface UnitEconomicsCostFactsQuery {
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface ReplaceManagerWhitelistSettingsInput {
  moduleKey: string;
  managerIds: string[];
  teams?: Array<{
    id?: string | null;
    name: string;
    managerIds: string[];
  }>;
  updatedAt: string;
}

export interface PruneConversionEventSnapshotsInput {
  scopedDealIds: string[];
  enabledEventTypeIds: string[];
}

export interface PruneConversionEventSnapshotsResult {
  conversionEventVisits: number;
  eventVisitStageHistory: number;
  eventVisitFacts: number;
  dealTouchpointFacts: number;
  eventSnapshots: number;
}

export interface ProtoCommentAnchor {
  blockId: string;
  blockLabel: string;
  blockSelector: string;
  blockRole: string | null;
  elementSelector: string;
  elementLabel: string;
  relativeX: number;
  relativeY: number;
}

export interface ProtoCommentRecord {
  id: string;
  sceneId: string;
  x: number;
  y: number;
  text: string;
  status?: "open" | "archived";
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  anchor?: ProtoCommentAnchor;
}

export type PaperclipCommentStatus =
  | "queued"
  | "sent"
  | "in_work"
  | "needs_input"
  | "done"
  | "failed";

export type PaperclipSyncStatus = "queued" | "syncing" | "sent" | "failed";

export interface DashboardCommentContext {
  filters?: unknown;
  [key: string]: unknown;
}

export interface DashboardCommentRecord extends ProtoCommentRecord {
  moduleId: string;
  authorUserId: number;
  authorLogin: string;
  paperclipIssueId: string | null;
  paperclipIssueIdentifier: string | null;
  paperclipStatus: PaperclipCommentStatus;
  paperclipSyncStatus: PaperclipSyncStatus;
  paperclipError: string | null;
  paperclipLastSyncedAt: string | null;
  paperclipRetryCount: number;
  context?: DashboardCommentContext;
}

export interface ProtoCommentStore {
  comments: ProtoCommentRecord[];
  updatedAt: string | null;
}

export type CallAnalysisTriggerMode = "manual" | "automatic";
export type CallAnalysisRunStatus = "queued" | "analyzing" | "ready" | "error";
export type CallAnalysisRecordingSource = "bitrix_disk" | "call_record_url";

export interface CallAnalysisRunInput {
  id: string;
  callId: string;
  crmActivityId: string | null;
  triggerMode: CallAnalysisTriggerMode;
  status: CallAnalysisRunStatus;
  startedAt: string;
  recordingSource: CallAnalysisRecordingSource | null;
  recordingFileId: string | null;
  model: string | null;
  promptVersion: string | null;
}

export interface FinishCallAnalysisRunInput {
  runId: string;
  finishedAt: string;
  status: Extract<CallAnalysisRunStatus, "ready">;
  recordingSource: CallAnalysisRecordingSource;
  recordingFileId: string | null;
  model: string;
  promptVersion: string;
}

export interface FailCallAnalysisRunInput {
  runId: string;
  failedAt: string;
  status: Extract<CallAnalysisRunStatus, "error">;
  errorCode: string;
  errorMessage: string;
}

export interface CallAnalysisRunSummary {
  callId: string;
  status: CallAnalysisRunStatus;
  startedAt: string;
  finishedAt: string | null;
  model: string | null;
  promptVersion: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface CallAnalysisResultRecord {
  callId: string;
  runId: string;
  status: Extract<CallAnalysisRunStatus, "ready">;
  transcriptByRoles: unknown[];
  fullTranscriptText: string;
  aiEvaluation: Record<string, unknown>;
  rawAiEvaluation: Record<string, unknown>;
  attributes: Record<string, unknown>;
  model: string;
  promptVersion: string;
  analyzedAt: string;
  updatedAt: string;
}

export type EnrichmentProposalBatchStatus =
  | "pending"
  | "partially_applied"
  | "approved"
  | "applied"
  | "declined"
  | "expired"
  | "failed";

export type EnrichmentProposalStatus =
  | "pending"
  | "approved"
  | "declined"
  | "applied"
  | "failed"
  | "expired"
  | "conflict";

export type EnrichmentProposalActionType = "fill_empty" | "overwrite";
export type EnrichmentProposalEntityType = "contact" | "deal";
export type EnrichmentProposalActorType = "system" | "manager";

export interface CreateEnrichmentProposalInput {
  id: string;
  batchId?: string;
  entityType: EnrichmentProposalEntityType;
  entityId: string;
  fieldCode: string;
  fieldTitle: string;
  actionType: EnrichmentProposalActionType;
  currentValue: unknown | null;
  proposedValue: unknown;
  normalizedValue: unknown;
  confidence: number;
  evidenceSnippet: string | null;
  status: EnrichmentProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnrichmentProposalBatchInput {
  id: string;
  callId: string;
  activityId: string | null;
  dealId: string;
  contactId: string | null;
  managerId: string;
  callAnalysisRunId: string | null;
  status: EnrichmentProposalBatchStatus;
  expiresAt: string;
  telegramChatId?: string | null;
  telegramMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
  proposals: CreateEnrichmentProposalInput[];
}

export interface EnrichmentProposalBatchRecord {
  id: string;
  callId: string;
  activityId: string | null;
  dealId: string;
  contactId: string | null;
  managerId: string;
  callAnalysisRunId: string | null;
  status: EnrichmentProposalBatchStatus;
  expiresAt: string;
  telegramChatId: string | null;
  telegramMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichmentProposalRecord {
  id: string;
  batchId: string;
  entityType: EnrichmentProposalEntityType;
  entityId: string;
  fieldCode: string;
  fieldTitle: string;
  actionType: EnrichmentProposalActionType;
  currentValue: unknown | null;
  proposedValue: unknown;
  normalizedValue: unknown;
  confidence: number;
  evidenceSnippet: string | null;
  status: EnrichmentProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichmentProposalEventInput {
  id: string;
  batchId: string;
  proposalId: string | null;
  actorType: EnrichmentProposalActorType;
  actorId: string | null;
  action: string;
  beforeStatus: string | null;
  afterStatus: string | null;
  reason: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EnrichmentProposalEventRecord {
  id: string;
  batchId: string;
  proposalId: string | null;
  actorType: EnrichmentProposalActorType;
  actorId: string | null;
  action: string;
  beforeStatus: string | null;
  afterStatus: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type TelegramEnrichmentAction = "approve" | "decline";

export interface CreateTelegramEnrichmentActionTokenInput {
  token: string;
  batchId: string;
  proposalId: string;
  action: TelegramEnrichmentAction;
  managerId: string;
  telegramChatId: string;
  expiresAt: string;
  createdAt: string;
}

export interface TelegramEnrichmentActionTokenRecord
  extends CreateTelegramEnrichmentActionTokenInput {
  usedAt: string | null;
}

export interface MarkTelegramEnrichmentActionTokenUsedInput {
  token: string;
  usedAt: string;
}

export interface UpdateEnrichmentProposalBatchTelegramMessageInput {
  batchId: string;
  telegramChatId: string;
  telegramMessageId: string | null;
  updatedAt: string;
}

export interface MarkEnrichmentProposalDecisionInput {
  proposalId: string;
  status: Extract<EnrichmentProposalStatus, "approved" | "declined">;
  actorId: string;
  decidedAt: string;
  eventId: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MarkEnrichmentProposalAppliedInput {
  proposalId: string;
  appliedAt: string;
  eventId: string;
  actorType?: EnrichmentProposalActorType;
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MarkEnrichmentProposalFailedInput {
  proposalId: string;
  failedAt: string;
  eventId: string;
  status?: Extract<EnrichmentProposalStatus, "failed" | "conflict" | "expired">;
  actorType?: EnrichmentProposalActorType;
  actorId?: string | null;
  reason: string;
  metadata?: Record<string, unknown> | null;
}

export interface ExpirePendingEnrichmentProposalsInput {
  expiredAt: string;
}

export interface TelegramManagerRegistrationInput {
  telegramChatId: string;
  telegramUserId: string;
  bitrixUserId: string | null;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  telegramLastName: string | null;
  registeredAt: string;
  lastSeenAt: string;
}

export interface TelegramManagerRegistrationRecord
  extends TelegramManagerRegistrationInput {
  active: boolean;
}

export interface SqliteRepository {
  getLatestSuccessCursor(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<string | null>;
  getLatestSuccessfulScope(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<SuccessfulSyncScope | null>;
  runSnapshotTransaction<T>(task: () => T): T;
  getSyncCursor(key: string): Promise<string | null>;
  setSyncCursor(input: SyncCursorInput): Promise<void>;
  hasSyncCoverage(input: SyncCoverageQuery): Promise<boolean>;
  upsertSyncCoverage(input: SyncCoverageInput): Promise<void>;
  getOperationalHistoryBootstrappedAt(): Promise<string | null>;
  getCallHistoryBootstrappedAt(): Promise<string | null>;
  getCallActivityHistoryBootstrappedAt(): Promise<string | null>;
  getMeetingActivityHistoryBootstrappedAt(): Promise<string | null>;
  getTaskActivityHistoryBootstrappedAt(): Promise<string | null>;
  getDealCustomFieldsBootstrappedAt(): Promise<string | null>;
  getDealMeetingDateFieldBootstrappedAt(): Promise<string | null>;
  getSnapshotStats(scope?: SnapshotStatsScope): Promise<SnapshotStats>;
  getActivitySnapshotCount(): Promise<number>;
  getDealIdsByCategoryIds(
    categoryIds: string[],
    assignedByIds?: string[]
  ): Promise<string[]>;
  getOpenDealIdsByCategoryIds(
    categoryIds: string[],
    assignedByIds?: string[]
  ): Promise<string[]>;
  getDealsByIds(dealIds: string[]): Promise<DealSnapshot[]>;
  getCurrentAttractionScope(): Promise<CurrentAttractionScopeSnapshot>;
  replaceCurrentAttractionScope(input: {
    scopeKey: string;
    dealIds: string[];
    reconciledAt: string;
  }): Promise<void>;
  getActivitiesByIds(activityIds: string[]): Promise<ActivitySnapshot[]>;
  getActivityBindingsByActivityIds(
    activityIds: string[]
  ): Promise<ActivityBindingSnapshot[]>;
  getCallById(callId: string): Promise<CallSnapshot | null>;
  getStageAtDealTime(
    dealId: string,
    at: string
  ): Promise<StageHistorySnapshot | null>;
  getCallAnalysisResult(callId: string): Promise<CallAnalysisResultRecord | null>;
  getLatestCallAnalysisRuns(callIds: string[]): Promise<CallAnalysisRunSummary[]>;
  startCallAnalysisRun(input: CallAnalysisRunInput): Promise<void>;
  saveCallAnalysisResult(input: CallAnalysisResultRecord): Promise<void>;
  finishCallAnalysisRun(input: FinishCallAnalysisRunInput): Promise<void>;
  failCallAnalysisRun(input: FailCallAnalysisRunInput): Promise<void>;
  createEnrichmentProposalBatch(
    input: CreateEnrichmentProposalBatchInput
  ): Promise<void>;
  getEnrichmentProposalBatch(
    batchId: string
  ): Promise<EnrichmentProposalBatchRecord | null>;
  getEnrichmentProposalBatchByCallId(
    callId: string
  ): Promise<EnrichmentProposalBatchRecord | null>;
  getEnrichmentProposal(
    proposalId: string
  ): Promise<EnrichmentProposalRecord | null>;
  listEnrichmentProposals(batchId: string): Promise<EnrichmentProposalRecord[]>;
  listEnrichmentProposalEvents(
    batchId: string
  ): Promise<EnrichmentProposalEventRecord[]>;
  createTelegramEnrichmentActionToken(
    input: CreateTelegramEnrichmentActionTokenInput
  ): Promise<void>;
  getTelegramEnrichmentActionToken(
    token: string
  ): Promise<TelegramEnrichmentActionTokenRecord | null>;
  markTelegramEnrichmentActionTokenUsed(
    input: MarkTelegramEnrichmentActionTokenUsedInput
  ): Promise<boolean>;
  releaseTelegramEnrichmentActionToken(
    input: MarkTelegramEnrichmentActionTokenUsedInput
  ): Promise<void>;
  updateEnrichmentProposalBatchTelegramMessage(
    input: UpdateEnrichmentProposalBatchTelegramMessageInput
  ): Promise<void>;
  appendEnrichmentProposalEvent(
    input: EnrichmentProposalEventInput
  ): Promise<void>;
  markEnrichmentProposalDecision(
    input: MarkEnrichmentProposalDecisionInput
  ): Promise<boolean>;
  markEnrichmentProposalApplied(
    input: MarkEnrichmentProposalAppliedInput
  ): Promise<void>;
  markEnrichmentProposalFailed(
    input: MarkEnrichmentProposalFailedInput
  ): Promise<void>;
  expirePendingEnrichmentProposals(
    input: ExpirePendingEnrichmentProposalsInput
  ): Promise<void>;
  upsertTelegramManagerRegistration(
    input: TelegramManagerRegistrationInput
  ): Promise<void>;
  listActiveTelegramManagerRegistrations(): Promise<
    TelegramManagerRegistrationRecord[]
  >;
  getCallActivityIdsMissingActivities(
    limit?: number,
    callStartDateFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getCallActivityIdsMissingCallStats(
    limit?: number,
    activityCreatedFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getCallActivityIdsForCallStatsRefresh(
    limit?: number,
    activityCreatedFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getConversionEventVisitIdsMissingStageHistory(limit?: number): Promise<string[]>;
  getConversionEventVisitsByIds(
    visitIds: string[]
  ): Promise<ConversionEventVisitSnapshot[]>;
  getConversionEventIdsMissingEventSnapshots(limit?: number): Promise<string[]>;
  replaceStageCatalog(rows: StageCatalogEntry[]): Promise<void>;
  upsertLeads(rows: LeadSnapshot[]): Promise<number>;
  upsertDeals(rows: DealSnapshot[]): Promise<number>;
  upsertStageHistory(rows: StageHistorySnapshot[]): Promise<number>;
  upsertActivities(rows: ActivitySnapshot[]): Promise<number>;
  upsertActivityBindings(rows: ActivityBindingSnapshot[]): Promise<number>;
  upsertActivityDeadlineChanges(
    rows: ActivityDeadlineChangeSnapshot[]
  ): Promise<number>;
  upsertDealMeetingDateChanges(
    rows: DealMeetingDateChangeSnapshot[]
  ): Promise<number>;
  upsertConversionEventVisits(
    rows: ConversionEventVisitSnapshot[]
  ): Promise<number>;
  pruneConversionEventSnapshots(
    input: PruneConversionEventSnapshotsInput
  ): Promise<PruneConversionEventSnapshotsResult>;
  upsertIdentityLinks(rows: IdentityLinkSnapshot[]): Promise<number>;
  upsertDealStageFacts(rows: DealStageFactSnapshot[]): Promise<number>;
  upsertDealTouchpointFacts(rows: DealTouchpointFactSnapshot[]): Promise<number>;
  replaceAnalyticsFacts(input: {
    identityLinks: IdentityLinkSnapshot[];
    dealStageFacts: DealStageFactSnapshot[];
    dealTouchpointFacts: DealTouchpointFactSnapshot[];
    eventVisitFacts?: EventVisitFactSnapshot[];
  }): Promise<{
    identityLinks: number;
    dealStageFacts: number;
    dealTouchpointFacts: number;
    eventVisitFacts?: number;
  }>;
  upsertEventSnapshots(rows: EventSnapshot[]): Promise<number>;
  upsertEventVisitFacts(rows: EventVisitFactSnapshot[]): Promise<number>;
  replaceEventVisitFacts(rows: EventVisitFactSnapshot[]): Promise<number>;
  upsertEventVisitStageHistory(
    rows: EventVisitStageHistorySnapshot[]
  ): Promise<number>;
  replaceModuleEventTypeSettings(input: {
    moduleKey: string;
    rows: ModuleEventTypeSetting[];
  }): Promise<number>;
  getManagerWhitelistSettings(moduleKey: string): Promise<ManagerWhitelistSetting[]>;
  replaceManagerWhitelistSettings(
    input: ReplaceManagerWhitelistSettingsInput
  ): Promise<ManagerWhitelistSetting[]>;
  replaceConversionEventTypeOptions(
    rows: ConversionEventTypeOption[]
  ): Promise<number>;
  upsertCalls(rows: CallSnapshot[]): Promise<number>;
  upsertManagerDirectory(rows: ManagerDirectoryEntry[]): Promise<number>;
  markOperationalHistoryBootstrapped(timestamp: string): Promise<void>;
  markCallHistoryBootstrapped(timestamp: string): Promise<void>;
  markCallActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markMeetingActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markTaskActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markDealCustomFieldsBootstrapped(timestamp: string): Promise<void>;
  markDealMeetingDateFieldBootstrapped(timestamp: string): Promise<void>;
  createSyncRun(input?: {
    startedAt: string;
    mode: "full" | "delta";
    modifiedAfter: string | null;
    scopeKey: string;
  }): Promise<number>;
  recoverStaleSyncRuns(input: {
    staleBefore: string;
    failedAt?: string;
    diagnostics?: string[];
  }): Promise<number>;
  failSyncRun(input: {
    syncRunId: number;
    finishedAt: string;
    status: "failed";
    diagnostics?: string[];
  }): Promise<void>;
  finishSyncRun(input: {
    syncRunId: number;
    finishedAt: string;
    status: "success";
    leadsSynced: number;
    dealsSynced: number;
    dealBreakdown?: SyncDealChangeBreakdown;
    diagnostics?: string[];
    modifiedAfter: string | null;
  }): Promise<void>;
  listSyncRuns(input?: {
    limit?: number;
    scopeKey?: string | null;
  }): Promise<SyncRunLogEntry[]>;
  getAllLeads(): Promise<LeadSnapshot[]>;
  getAllDeals(): Promise<DealSnapshot[]>;
  getAllStageHistory(): Promise<StageHistorySnapshot[]>;
  getStageHistoryByOwnerIds(ownerIds: string[]): Promise<StageHistorySnapshot[]>;
  getAllActivities(): Promise<ActivitySnapshot[]>;
  getAllActivityBindings(): Promise<ActivityBindingSnapshot[]>;
  getAllActivityDeadlineChanges(): Promise<ActivityDeadlineChangeSnapshot[]>;
  getAllDealMeetingDateChanges(): Promise<DealMeetingDateChangeSnapshot[]>;
  getAllConversionEventVisits(): Promise<ConversionEventVisitSnapshot[]>;
  getAllIdentityLinks(): Promise<IdentityLinkSnapshot[]>;
  getAllDealStageFacts(): Promise<DealStageFactSnapshot[]>;
  getDealStageFactsByDealIds(dealIds: string[]): Promise<DealStageFactSnapshot[]>;
  getAllDealTouchpointFacts(): Promise<DealTouchpointFactSnapshot[]>;
  getDealTouchpointFactsByDealIds(
    dealIds: string[]
  ): Promise<DealTouchpointFactSnapshot[]>;
  getAllEventSnapshots(): Promise<EventSnapshot[]>;
  getAllEventVisitFacts(): Promise<EventVisitFactSnapshot[]>;
  getEventVisitFactsByDealIds(dealIds: string[]): Promise<EventVisitFactSnapshot[]>;
  getAllEventVisitStageHistory(): Promise<EventVisitStageHistorySnapshot[]>;
  getModuleEventTypeSettings(moduleKey?: string): Promise<ModuleEventTypeSetting[]>;
  getConversionEventTypeOptions(): Promise<ConversionEventTypeOption[]>;
  getAllCalls(): Promise<CallSnapshot[]>;
  getManagerDirectory(): Promise<ManagerDirectoryEntry[]>;
  getStageCatalog(): Promise<StageCatalogEntry[]>;
  getSalesPlanRows(periodStart: string, periodEnd: string): Promise<SalesPlanRow[]>;
  replaceSalesPlanRows(input: ReplaceSalesPlanRowsInput): Promise<SalesPlanRow[]>;
  replaceSalesPlanPeriods(input: ReplaceSalesPlanPeriodsInput): Promise<void>;
  getPricingRules(): Promise<DealPricingRule[]>;
  replacePricingRules(input: ReplacePricingRulesInput): Promise<DealPricingRule[]>;
  getOperationalThresholdSettings(): Promise<OperationalThresholdSettings>;
  replaceOperationalThresholdSettings(
    input: ReplaceOperationalThresholdSettingsInput
  ): Promise<OperationalThresholdSettings>;
  getUnitEconomicsCostArticles(): Promise<UnitEconomicsCostArticle[]>;
  getUnitEconomicsCostRules(): Promise<UnitEconomicsCostRule[]>;
  replaceUnitEconomicsCostRules(
    input: ReplaceUnitEconomicsCostRulesInput
  ): Promise<UnitEconomicsCostRule[]>;
  getUnitEconomicsEventParticipantMode(): Promise<UnitEconomicsEventParticipantMode>;
  getUnitEconomicsCostFacts(
    query?: UnitEconomicsCostFactsQuery
  ): Promise<UnitEconomicsCostFact[]>;
  upsertUnitEconomicsCostFacts(rows: UnitEconomicsCostFact[]): Promise<number>;
  getProtoComments(): Promise<ProtoCommentStore>;
  replaceProtoComments(input: ProtoCommentStore): Promise<ProtoCommentStore>;
  getDashboardComments(moduleId: string): Promise<{
    comments: DashboardCommentRecord[];
    updatedAt: string | null;
  }>;
  getDashboardCommentById(id: string): Promise<DashboardCommentRecord | null>;
  createDashboardComment(input: DashboardCommentRecord): Promise<DashboardCommentRecord>;
  updateDashboardComment(input: {
    id: string;
    text?: string;
    context?: DashboardCommentContext;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  archiveDashboardComment(input: {
    id: string;
    archivedAt: string;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  updateDashboardCommentPaperclip(input: {
    id: string;
    paperclipIssueId?: string | null;
    paperclipIssueIdentifier?: string | null;
    paperclipStatus: PaperclipCommentStatus;
    paperclipSyncStatus: PaperclipSyncStatus;
    paperclipError?: string | null;
    paperclipLastSyncedAt?: string | null;
    incrementRetryCount?: boolean;
  }): Promise<DashboardCommentRecord | null>;
  getWonStageIds(): Promise<string[]>;
  setWonStageIds(stageIds: string[]): Promise<void>;
  getLastSyncSummary(scopeKey?: string): Promise<LastSyncSummary | null>;
  close(): void;
}

interface CreateSqliteRepositoryInput {
  databaseUrl: string;
  defaultWonStageIds: string[];
}

function resolveDatabasePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice("file:".length);
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function buildDealScopeWhereClause(scope: SnapshotStatsScope | undefined) {
  const clauses: string[] = [];
  const values: string[] = [];
  const categoryIds = scope?.categoryIds ?? [];
  const assignedByIds = scope?.assignedByIds ?? [];

  if (categoryIds.length > 0) {
    const placeholders = categoryIds.map(() => "?").join(", ");
    clauses.push(`category_id IN (${placeholders})`);
    values.push(...categoryIds);
  }

  if (assignedByIds.length > 0) {
    const placeholders = assignedByIds.map(() => "?").join(", ");
    clauses.push(`assigned_by_id IN (${placeholders})`);
    values.push(...assignedByIds);
  }

  return {
    clause: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1",
    hasScope: clauses.length > 0,
    values
  };
}

function buildCategoryScopeKey(categoryIds: string[], assignedByIds: string[] = []) {
  const categoryScope = `category:${[...categoryIds].sort().join(",")}`;

  if (assignedByIds.length === 0) {
    return categoryScope;
  }

  return `${categoryScope}:assigned:${[...assignedByIds].sort().join(",")}`;
}

function parseCategoryScopeKey(scopeKey: string): SuccessfulSyncScope | null {
  const match = /^category:([^:]*)(?::assigned:(.*))?$/.exec(scopeKey);
  if (!match) {
    return null;
  }

  return {
    scopeKey,
    categoryIds: (match[1] ?? "").split(",").filter(Boolean),
    assignedByIds: (match[2] ?? "").split(",").filter(Boolean)
  };
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right.map(String));
  return left.every((value) => rightSet.has(String(value)));
}

function isSubset(values: string[], requestedValues: string[]) {
  const requestedSet = new Set(requestedValues.map(String));
  return values.every((value) => requestedSet.has(String(value)));
}

function chunkValues<T>(values: T[], chunkSize = 500) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function mapActivityRows(
  rows: Array<
    Omit<ActivitySnapshot, "completed"> & {
      completed: number;
    }
  >
) {
  return rows.map((row) => ({
    ...row,
    completed: Boolean(row.completed)
  }));
}

function ensureColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );
  }
}

function buildLegacyDealBreakdown(total: number): SyncDealChangeBreakdown {
  return {
    total,
    created: 0,
    updated: total,
    closed: 0,
    reopened: 0,
    unchanged: 0
  };
}

function parseDealBreakdown(
  value: string | null | undefined,
  fallbackTotal: number
): SyncDealChangeBreakdown {
  if (!value) {
    return buildLegacyDealBreakdown(fallbackTotal);
  }

  try {
    const parsed = JSON.parse(value) as Partial<SyncDealChangeBreakdown>;
    return {
      total: Number(parsed.total ?? fallbackTotal),
      created: Number(parsed.created ?? 0),
      updated: Number(parsed.updated ?? fallbackTotal),
      closed: Number(parsed.closed ?? 0),
      reopened: Number(parsed.reopened ?? 0),
      unchanged: Number(parsed.unchanged ?? 0)
    };
  } catch {
    return buildLegacyDealBreakdown(fallbackTotal);
  }
}

function parseDiagnostics(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

function toPositiveInteger(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : fallback;
}

function parseOperationalThresholdSettingsPayload(
  value: string | null | undefined
): OperationalThresholdSettingsInput {
  if (!value) {
    return DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT;
  }

  try {
    const parsed = JSON.parse(value) as Partial<OperationalThresholdSettingsInput>;
    const stageAging = Array.isArray(parsed.stageAging)
      ? parsed.stageAging
          .map((row) => ({
            stageId:
              typeof row?.stageId === "string" && row.stageId.trim().length > 0
                ? row.stageId.trim()
                : null,
            maxDaysOnStage: toPositiveInteger(row?.maxDaysOnStage, 1)
          }))
          .filter(
            (row): row is OperationalThresholdSettingsInput["stageAging"][number] =>
              row.stageId !== null
          )
      : DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.stageAging;

    return {
      stageAging:
        stageAging.length > 0
          ? stageAging
          : DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.stageAging,
      noCallsMaxDays: toPositiveInteger(
        parsed.noCallsMaxDays,
        DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.noCallsMaxDays
      ),
      noActivityMaxDays: toPositiveInteger(
        parsed.noActivityMaxDays,
        DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.noActivityMaxDays
      ),
      slaBusinessHours: {
        sla1: toPositiveInteger(
          parsed.slaBusinessHours?.sla1,
          DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.slaBusinessHours.sla1
        ),
        sla2: toPositiveInteger(
          parsed.slaBusinessHours?.sla2,
          DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.slaBusinessHours.sla2
        ),
        sla3: toPositiveInteger(
          parsed.slaBusinessHours?.sla3,
          DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT.slaBusinessHours.sla3
        )
      }
    };
  } catch {
    return DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT;
  }
}

function hydrateOperationalThresholdSettings(input: {
  payloadJson: string | null | undefined;
  updatedAt: string | null;
}): OperationalThresholdSettings {
  const payload = parseOperationalThresholdSettingsPayload(input.payloadJson);
  const defaultStageById = new Map(
    DEFAULT_OPERATIONAL_STAGE_AGING_THRESHOLDS.map((threshold) => [
      threshold.stageId,
      threshold
    ])
  );
  const payloadStageById = new Map(
    payload.stageAging.map((threshold) => [threshold.stageId, threshold])
  );
  const stageAging = [
    ...DEFAULT_OPERATIONAL_STAGE_AGING_THRESHOLDS.map((threshold) => ({
      stageId: threshold.stageId,
      stageName: threshold.stageName,
      maxDaysOnStage:
        payloadStageById.get(threshold.stageId)?.maxDaysOnStage ??
        threshold.maxDaysOnStage
    })),
    ...payload.stageAging
      .filter((threshold) => !defaultStageById.has(threshold.stageId))
      .map((threshold) => ({
        stageId: threshold.stageId,
        stageName: threshold.stageId,
        maxDaysOnStage: threshold.maxDaysOnStage
      }))
  ];

  return {
    stageAging,
    noCallsMaxDays: payload.noCallsMaxDays,
    noActivityMaxDays: payload.noActivityMaxDays,
    slaBusinessHours: payload.slaBusinessHours,
    updatedAt: input.updatedAt
  };
}

function normalizeSyncRunStatus(value: string): SyncRunLogEntry["status"] {
  if (value === "running" || value === "success" || value === "failed") {
    return value;
  }

  return "failed";
}

function normalizeSyncRunMode(value: string): SyncRunLogEntry["mode"] {
  return value === "full" ? "full" : "delta";
}

function calculateSyncRunDurationMs(input: {
  startedAt: string;
  finishedAt: string | null;
}) {
  if (!input.finishedAt) {
    return null;
  }

  const startedAtMs = Date.parse(input.startedAt);
  const finishedAtMs = Date.parse(input.finishedAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(finishedAtMs)) {
    return null;
  }

  return Math.max(0, finishedAtMs - startedAtMs);
}

export function createSqliteRepository(
  input: CreateSqliteRepositoryInput
): SqliteRepository {
  const databasePath = resolveDatabasePath(input.databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("synchronous = NORMAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      modified_after TEXT,
      scope_key TEXT,
      leads_synced INTEGER DEFAULT 0,
      deals_synced INTEGER DEFAULT 0,
      deal_breakdown_json TEXT,
      diagnostics_json TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_cursors (
      key TEXT PRIMARY KEY,
      cursor_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_coverage (
      scope_key TEXT NOT NULL,
      stream TEXT NOT NULL,
      provider_id TEXT,
      covered_from TEXT NOT NULL,
      covered_to TEXT,
      algorithm_version TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (scope_key, stream, provider_id, algorithm_version)
    );

    CREATE TABLE IF NOT EXISTS lead_snapshots (
      id TEXT PRIMARY KEY,
      status_id TEXT NOT NULL,
      source_id TEXT,
      opportunity REAL,
      assigned_by_id TEXT,
      date_create TEXT NOT NULL,
      date_modify TEXT NOT NULL,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT
    );

    CREATE TABLE IF NOT EXISTS deal_snapshots (
      id TEXT PRIMARY KEY,
      title TEXT,
      contact_id TEXT,
      lead_id TEXT,
      category_id TEXT,
      stage_id TEXT NOT NULL,
      stage_semantic_id TEXT,
      opportunity REAL,
      assigned_by_id TEXT,
      source_id TEXT,
      quality_value TEXT,
      business_club_value TEXT,
      target_group_value TEXT,
      meeting_type_value TEXT,
      meeting_date_value TEXT,
      tariff_value TEXT,
      conversion_event_value TEXT,
      refusal_reason_value TEXT,
      refusal_reason_detail TEXT,
      date_create TEXT NOT NULL,
      date_modify TEXT NOT NULL,
      date_closed TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT
    );

    CREATE TABLE IF NOT EXISTS attraction_current_deal_ids (
      deal_id TEXT PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS stage_catalog (
      entity_type TEXT NOT NULL,
      category_id TEXT,
      status_id TEXT NOT NULL,
      name TEXT NOT NULL,
      semantic_id TEXT,
      sort_order INTEGER,
      PRIMARY KEY (entity_type, category_id, status_id)
    );

    CREATE TABLE IF NOT EXISTS stage_history_snapshots (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      category_id TEXT,
      stage_id TEXT NOT NULL,
      stage_semantic_id TEXT,
      type_id INTEGER,
      created_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_snapshots (
      id TEXT PRIMARY KEY,
      owner_type_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      type_id TEXT,
      provider_id TEXT,
      responsible_id TEXT,
      created_time TEXT NOT NULL,
      deadline TEXT,
      last_updated TEXT NOT NULL,
      completed INTEGER NOT NULL,
      completed_time TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_binding_snapshots (
      activity_id TEXT NOT NULL,
      owner_type_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      PRIMARY KEY (activity_id, owner_type_id, owner_id)
    );

    CREATE TABLE IF NOT EXISTS activity_deadline_changes (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      responsible_id TEXT,
      previous_deadline TEXT,
      next_deadline TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deal_meeting_date_changes (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL DEFAULT 1,
      assigned_by_id TEXT,
      previous_meeting_date TEXT,
      next_meeting_date TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deal_meeting_slots (
      deal_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      date_value TEXT,
      type_value TEXT,
      place_value TEXT,
      calendar_value TEXT,
      event_id TEXT,
      source TEXT NOT NULL DEFAULT 'deal_fields',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (deal_id, slot_index)
    );

    CREATE TABLE IF NOT EXISTS conversion_event_visit_snapshots (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      status TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      deal_id TEXT,
      contact_id TEXT,
      manager_id TEXT,
      source_id TEXT,
      created_time TEXT NOT NULL,
      updated_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS identity_links (
      identity_id TEXT PRIMARY KEY,
      module_key TEXT NOT NULL,
      deal_id TEXT,
      lead_id TEXT,
      contact_id TEXT,
      deal_category_id TEXT,
      lead_category_id TEXT,
      current_manager_id TEXT,
      current_stage_id TEXT,
      source_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      link_confidence TEXT NOT NULL,
      link_reason TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deal_stage_facts (
      fact_id TEXT PRIMARY KEY,
      source_system TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      deal_id TEXT NOT NULL,
      contact_id TEXT,
      lead_id TEXT,
      category_id TEXT,
      stage_id TEXT NOT NULL,
      stage_name TEXT,
      stage_semantic_id TEXT,
      entered_at TEXT NOT NULL,
      left_at TEXT,
      manager_id TEXT,
      source_id TEXT,
      sort_order INTEGER,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS deal_touchpoint_facts (
      fact_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      source_system TEXT NOT NULL,
      source_entity_type TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      deal_id TEXT,
      contact_id TEXT,
      lead_id TEXT,
      manager_id TEXT,
      source_id TEXT,
      stage_id_at_event TEXT,
      stage_name_at_event TEXT,
      link_confidence TEXT NOT NULL,
      link_reason TEXT NOT NULL,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS event_snapshots (
      event_id TEXT PRIMARY KEY,
      entity_type_id INTEGER NOT NULL,
      category_id INTEGER,
      title TEXT,
      event_date TEXT NOT NULL,
      start_at TEXT,
      end_at TEXT,
      stage_id TEXT NOT NULL,
      stage_name TEXT,
      status TEXT NOT NULL,
      event_type_id TEXT,
      event_type_label TEXT,
      format_id TEXT,
      created_time TEXT NOT NULL,
      updated_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_visit_facts (
      visit_id TEXT PRIMARY KEY,
      event_id TEXT,
      deal_id TEXT,
      contact_id TEXT,
      lead_id TEXT,
      manager_id TEXT,
      source_id TEXT,
      current_stage_id TEXT NOT NULL,
      current_stage_name TEXT,
      invited_at TEXT,
      confirmed_at TEXT,
      attended_at TEXT,
      refused_at TEXT,
      final_status TEXT NOT NULL,
      event_date TEXT,
      stage_id_at_event TEXT,
      link_confidence TEXT NOT NULL,
      link_reason TEXT NOT NULL,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS event_visit_stage_history (
      history_id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL,
      entity_type_id INTEGER NOT NULL,
      category_id INTEGER,
      stage_id TEXT NOT NULL,
      stage_name TEXT,
      type_id INTEGER,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS module_event_type_settings (
      module_key TEXT NOT NULL,
      event_type_id TEXT NOT NULL,
      event_type_label TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (module_key, event_type_id)
    );

    CREATE TABLE IF NOT EXISTS module_manager_whitelist_settings (
      module_key TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      manager_name TEXT NOT NULL,
      team_id TEXT,
      team_name TEXT,
      enabled INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (module_key, manager_id)
    );

    CREATE TABLE IF NOT EXISTS conversion_event_type_options (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category_id INTEGER,
      stage_id TEXT,
      selected_for_planned_inventory INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_snapshots (
      id TEXT PRIMARY KEY,
      crm_activity_id TEXT,
      portal_user_id TEXT,
      call_type TEXT,
      call_start_date TEXT NOT NULL,
      call_duration_seconds INTEGER NOT NULL,
      crm_entity_type TEXT,
      crm_entity_id TEXT,
      call_failed_code TEXT
    );

    CREATE TABLE IF NOT EXISTS call_analysis_runs (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL,
      crm_activity_id TEXT,
      trigger_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      recording_source TEXT,
      recording_file_id TEXT,
      model TEXT,
      prompt_version TEXT,
      error_code TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS call_analysis_results (
      call_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL,
      transcript_by_roles_json TEXT NOT NULL,
      full_transcript_text TEXT NOT NULL,
      ai_evaluation_json TEXT NOT NULL,
      raw_ai_evaluation_json TEXT NOT NULL DEFAULT '{}',
      attributes_json TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      analyzed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrichment_proposal_batches (
      id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL UNIQUE,
      activity_id TEXT,
      deal_id TEXT NOT NULL,
      contact_id TEXT,
      manager_id TEXT NOT NULL,
      call_analysis_run_id TEXT,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      telegram_chat_id TEXT,
      telegram_message_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrichment_proposals (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_code TEXT NOT NULL,
      field_title TEXT NOT NULL,
      action_type TEXT NOT NULL,
      current_value_json TEXT,
      proposed_value_json TEXT NOT NULL,
      normalized_value_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence_snippet TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id)
        REFERENCES enrichment_proposal_batches(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrichment_proposal_events (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      proposal_id TEXT,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      before_status TEXT,
      after_status TEXT,
      reason TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id)
        REFERENCES enrichment_proposal_batches(id)
        ON DELETE CASCADE,
      FOREIGN KEY (proposal_id)
        REFERENCES enrichment_proposals(id)
        ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS telegram_enrichment_action_tokens (
      token TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      proposal_id TEXT NOT NULL,
      action TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      telegram_chat_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id)
        REFERENCES enrichment_proposal_batches(id)
        ON DELETE CASCADE,
      FOREIGN KEY (proposal_id)
        REFERENCES enrichment_proposals(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telegram_manager_registrations (
      telegram_chat_id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      bitrix_user_id TEXT,
      telegram_username TEXT,
      telegram_first_name TEXT,
      telegram_last_name TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      registered_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manager_directory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS won_stage_config (
      stage_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_plan_rows (
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      manager_name TEXT,
      target_group_key TEXT NOT NULL,
      target_group_label TEXT NOT NULL,
      planned_deals INTEGER NOT NULL,
      planned_amount REAL NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (period_start, period_end, manager_id, target_group_key)
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      customer_label TEXT NOT NULL,
      tariff_label TEXT NOT NULL,
      attraction_revenue_amount REAL NOT NULL,
      enabled INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS operational_threshold_settings (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS unit_economics_cost_articles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pnl_level TEXT NOT NULL,
      cost_behavior TEXT NOT NULL,
      calculation_method TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      effective_from TEXT,
      effective_to TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS unit_economics_cost_rules (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      pnl_level TEXT NOT NULL,
      cost_behavior TEXT NOT NULL,
      calculation_method TEXT NOT NULL,
      unit_price REAL,
      percent REAL,
      amount REAL,
      source_key TEXT,
      quality_value TEXT,
      event_name_pattern TEXT,
      enabled INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      sort_order INTEGER NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS unit_economics_cost_facts (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      pnl_level TEXT NOT NULL,
      cost_behavior TEXT NOT NULL,
      calculation_method TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      quantity REAL,
      source_system TEXT NOT NULL,
      source_reference TEXT,
      confidence TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS unit_economics_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      event_participant_mode TEXT NOT NULL DEFAULT 'invited',
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS unit_economics_import_batches (
      id TEXT PRIMARY KEY,
      source_system TEXT NOT NULL,
      source_label TEXT NOT NULL,
      file_name TEXT,
      row_count INTEGER NOT NULL,
      accepted_count INTEGER NOT NULL,
      rejected_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proto_comment_store (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS proto_comments (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      text TEXT NOT NULL,
      status TEXT NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      anchor_json TEXT,
      sort_order INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deal_snapshots_category_id
      ON deal_snapshots (category_id);
    CREATE INDEX IF NOT EXISTS idx_stage_history_owner_id
      ON stage_history_snapshots (owner_id);
    CREATE INDEX IF NOT EXISTS idx_activity_owner_id
      ON activity_snapshots (owner_id);
    CREATE INDEX IF NOT EXISTS idx_activity_provider_created
      ON activity_snapshots (provider_id, created_time);
    CREATE INDEX IF NOT EXISTS idx_activity_binding_owner
      ON activity_binding_snapshots (owner_type_id, owner_id);
    CREATE INDEX IF NOT EXISTS idx_deal_meeting_date_changes_deal_id
      ON deal_meeting_date_changes (deal_id);
    CREATE INDEX IF NOT EXISTS idx_deal_meeting_date_changes_changed_at
      ON deal_meeting_date_changes (changed_at);
    CREATE INDEX IF NOT EXISTS idx_deal_meeting_slots_deal_id
      ON deal_meeting_slots (deal_id);
    CREATE INDEX IF NOT EXISTS idx_conversion_event_visits_event_date
      ON conversion_event_visit_snapshots (event_date);
    CREATE INDEX IF NOT EXISTS idx_conversion_event_visits_deal_id
      ON conversion_event_visit_snapshots (deal_id);
    CREATE INDEX IF NOT EXISTS idx_identity_links_deal_id
      ON identity_links (deal_id);
    CREATE INDEX IF NOT EXISTS idx_identity_links_contact_id
      ON identity_links (contact_id);
    CREATE INDEX IF NOT EXISTS idx_identity_links_lead_id
      ON identity_links (lead_id);
    CREATE INDEX IF NOT EXISTS idx_deal_stage_facts_deal_entered
      ON deal_stage_facts (deal_id, entered_at);
    CREATE INDEX IF NOT EXISTS idx_deal_touchpoint_facts_deal_time
      ON deal_touchpoint_facts (deal_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_deal_touchpoint_facts_contact_time
      ON deal_touchpoint_facts (contact_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_deal_touchpoint_facts_kind_time
      ON deal_touchpoint_facts (kind, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_event_snapshots_event_date
      ON event_snapshots (event_date);
    CREATE INDEX IF NOT EXISTS idx_event_visit_facts_event_id
      ON event_visit_facts (event_id);
    CREATE INDEX IF NOT EXISTS idx_event_visit_facts_deal_id
      ON event_visit_facts (deal_id);
    CREATE INDEX IF NOT EXISTS idx_event_visit_stage_history_visit
      ON event_visit_stage_history (visit_id, changed_at);
    CREATE INDEX IF NOT EXISTS idx_module_event_type_settings_module
      ON module_event_type_settings (module_key, enabled);
    CREATE INDEX IF NOT EXISTS idx_module_manager_whitelist_module
      ON module_manager_whitelist_settings (module_key, enabled, sort_order);
    CREATE INDEX IF NOT EXISTS idx_call_crm_activity_id
      ON call_snapshots (crm_activity_id);
    CREATE INDEX IF NOT EXISTS idx_call_analysis_runs_call
      ON call_analysis_runs (call_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_enrichment_batches_call
      ON enrichment_proposal_batches (call_id);
    CREATE INDEX IF NOT EXISTS idx_enrichment_batches_manager_status
      ON enrichment_proposal_batches (manager_id, status);
    CREATE INDEX IF NOT EXISTS idx_telegram_manager_registrations_bitrix
      ON telegram_manager_registrations (bitrix_user_id, active);
    CREATE INDEX IF NOT EXISTS idx_enrichment_batches_expires
      ON enrichment_proposal_batches (expires_at);
    CREATE INDEX IF NOT EXISTS idx_enrichment_proposals_batch_status
      ON enrichment_proposals (batch_id, status);
    CREATE INDEX IF NOT EXISTS idx_enrichment_events_batch_created
      ON enrichment_proposal_events (batch_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_proto_comments_scene_status
      ON proto_comments (scene_id, status);
    CREATE INDEX IF NOT EXISTS idx_unit_economics_cost_articles_sort
      ON unit_economics_cost_articles (enabled, sort_order);
    CREATE INDEX IF NOT EXISTS idx_unit_economics_cost_rules_active
      ON unit_economics_cost_rules (enabled, effective_from, effective_to, sort_order);
    CREATE INDEX IF NOT EXISTS idx_unit_economics_cost_facts_period
      ON unit_economics_cost_facts (period_start, period_end, status);
  `);

  ensureColumn(database, "deal_snapshots", "source_id", "TEXT");
  ensureColumn(database, "deal_snapshots", "title", "TEXT");
  ensureColumn(database, "deal_snapshots", "contact_id", "TEXT");
  ensureColumn(database, "deal_snapshots", "quality_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "business_club_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "target_group_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "meeting_type_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "meeting_date_value", "TEXT");
  ensureColumn(
    database,
    "deal_meeting_date_changes",
    "slot_index",
    "INTEGER NOT NULL DEFAULT 1"
  );
  ensureColumn(database, "deal_snapshots", "tariff_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "conversion_event_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "refusal_reason_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "refusal_reason_detail", "TEXT");
  ensureColumn(database, "module_manager_whitelist_settings", "team_id", "TEXT");
  ensureColumn(database, "module_manager_whitelist_settings", "team_name", "TEXT");
  ensureColumn(database, "conversion_event_visit_snapshots", "event_id", "TEXT");
  ensureColumn(database, "unit_economics_cost_rules", "event_name_pattern", "TEXT");
  ensureColumn(
    database,
    "unit_economics_settings",
    "event_participant_mode",
    "TEXT NOT NULL DEFAULT 'invited'"
  );
  ensureColumn(database, "unit_economics_settings", "updated_at", "TEXT");
  ensureColumn(database, "stage_catalog", "sort_order", "INTEGER");
  ensureColumn(
    database,
    "call_analysis_results",
    "raw_ai_evaluation_json",
    "TEXT NOT NULL DEFAULT '{}'"
  );
  ensureColumn(database, "sync_runs", "scope_key", "TEXT");
  ensureColumn(database, "sync_runs", "deal_breakdown_json", "TEXT");
  ensureColumn(database, "sync_runs", "diagnostics_json", "TEXT");
  ensureColumn(
    database,
    "proto_comments",
    "module_id",
    "TEXT NOT NULL DEFAULT 'attraction'"
  );
  ensureColumn(database, "proto_comments", "author_user_id", "INTEGER");
  ensureColumn(database, "proto_comments", "author_login", "TEXT");
  ensureColumn(database, "proto_comments", "paperclip_issue_id", "TEXT");
  ensureColumn(database, "proto_comments", "paperclip_issue_identifier", "TEXT");
  ensureColumn(
    database,
    "proto_comments",
    "paperclip_status",
    "TEXT NOT NULL DEFAULT 'queued'"
  );
  ensureColumn(
    database,
    "proto_comments",
    "paperclip_sync_status",
    "TEXT NOT NULL DEFAULT 'queued'"
  );
  ensureColumn(database, "proto_comments", "paperclip_error", "TEXT");
  ensureColumn(database, "proto_comments", "paperclip_last_synced_at", "TEXT");
  ensureColumn(
    database,
    "proto_comments",
    "paperclip_retry_count",
    "INTEGER NOT NULL DEFAULT 0"
  );
  ensureColumn(database, "proto_comments", "context_json", "TEXT");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_proto_comments_module_status
      ON proto_comments (module_id, status);
    CREATE INDEX IF NOT EXISTS idx_proto_comments_author_module
      ON proto_comments (author_user_id, module_id);
    CREATE INDEX IF NOT EXISTS idx_proto_comments_paperclip_sync
      ON proto_comments (module_id, paperclip_sync_status);
  `);

  const existingWonStages = database
    .prepare("SELECT COUNT(*) AS count FROM won_stage_config")
    .get() as { count: number };

  if (existingWonStages.count === 0 && input.defaultWonStageIds.length > 0) {
    const insertWonStage = database.prepare(`
      INSERT OR REPLACE INTO won_stage_config (stage_id, enabled)
      VALUES (?, 1)
    `);
    const seedTransaction = database.transaction((stageIds: string[]) => {
      for (const stageId of stageIds) {
        insertWonStage.run(stageId);
      }
    });
    seedTransaction(input.defaultWonStageIds);
  }

  const existingPricingRules = database
    .prepare("SELECT COUNT(*) AS count FROM pricing_rules")
    .get() as { count: number };

  if (existingPricingRules.count === 0) {
    const seedPricingRule = database.prepare(`
      INSERT INTO pricing_rules (
        id,
        customer_label,
        tariff_label,
        attraction_revenue_amount,
        enabled,
        sort_order,
        updated_at
      ) VALUES (
        @id,
        @customerLabel,
        @tariffLabel,
        @attractionRevenueAmount,
        @enabled,
        @sortOrder,
        @updatedAt
      )
    `);
    const seedPricingTransaction = database.transaction(
      (rules: DealPricingRule[]) => {
        for (const rule of rules) {
          seedPricingRule.run({
            ...rule,
            enabled: rule.enabled ? 1 : 0
          });
        }
      }
    );
    seedPricingTransaction(DEFAULT_PRICING_RULES);
  }

  const existingOperationalThresholdSettings = database
    .prepare("SELECT COUNT(*) AS count FROM operational_threshold_settings")
    .get() as { count: number };

  if (existingOperationalThresholdSettings.count === 0) {
    database
      .prepare(
        `INSERT INTO operational_threshold_settings (
          key,
          payload_json,
          updated_at
        ) VALUES (?, ?, NULL)`
      )
      .run(
        OPERATIONAL_THRESHOLD_SETTINGS_KEY,
        JSON.stringify(DEFAULT_OPERATIONAL_THRESHOLD_SETTINGS_INPUT)
      );
  }

  const existingUnitEconomicsArticles = database
    .prepare("SELECT COUNT(*) AS count FROM unit_economics_cost_articles")
    .get() as { count: number };

  if (existingUnitEconomicsArticles.count === 0) {
    const seedArticle = database.prepare(`
      INSERT INTO unit_economics_cost_articles (
        id,
        name,
        pnl_level,
        cost_behavior,
        calculation_method,
        enabled,
        sort_order,
        effective_from,
        effective_to,
        updated_at
      ) VALUES (
        @id,
        @name,
        @pnlLevel,
        @costBehavior,
        @calculationMethod,
        @enabled,
        @sortOrder,
        @effectiveFrom,
        @effectiveTo,
        @updatedAt
      )
    `);
    const seedArticlesTransaction = database.transaction(
      (articles: UnitEconomicsCostArticle[]) => {
        for (const article of articles) {
          seedArticle.run({
            ...article,
            enabled: article.enabled ? 1 : 0
          });
        }
      }
    );
    seedArticlesTransaction(DEFAULT_UNIT_ECONOMICS_COST_ARTICLES);
  }

  const existingUnitEconomicsRules = database
    .prepare("SELECT COUNT(*) AS count FROM unit_economics_cost_rules")
    .get() as { count: number };

  if (existingUnitEconomicsRules.count === 0) {
    const seedRule = database.prepare(`
      INSERT INTO unit_economics_cost_rules (
        id,
        article_id,
        pnl_level,
        cost_behavior,
        calculation_method,
        unit_price,
        percent,
        amount,
        source_key,
        quality_value,
        event_name_pattern,
        enabled,
        effective_from,
        effective_to,
        sort_order,
        updated_at
      ) VALUES (
        @id,
        @articleId,
        @pnlLevel,
        @costBehavior,
        @calculationMethod,
        @unitPrice,
        @percent,
        @amount,
        @sourceKey,
        @qualityValue,
        @eventNamePattern,
        @enabled,
        @effectiveFrom,
        @effectiveTo,
        @sortOrder,
        @updatedAt
      )
    `);
    const seedRulesTransaction = database.transaction(
      (rules: UnitEconomicsCostRule[]) => {
        for (const rule of rules) {
          seedRule.run({
            ...rule,
            eventNamePattern: rule.eventNamePattern ?? null,
            enabled: rule.enabled ? 1 : 0,
            updatedAt: null
          });
        }
      }
    );
    seedRulesTransaction(DEFAULT_UNIT_ECONOMICS_COST_RULES);
  }

  const insertMissingUnitEconomicsArticle = database.prepare(`
    INSERT OR IGNORE INTO unit_economics_cost_articles (
      id,
      name,
      pnl_level,
      cost_behavior,
      calculation_method,
      enabled,
      sort_order,
      effective_from,
      effective_to,
      updated_at
    ) VALUES (
      @id,
      @name,
      @pnlLevel,
      @costBehavior,
      @calculationMethod,
      @enabled,
      @sortOrder,
      @effectiveFrom,
      @effectiveTo,
      @updatedAt
    )
  `);
  const insertMissingUnitEconomicsRule = database.prepare(`
    INSERT OR IGNORE INTO unit_economics_cost_rules (
      id,
      article_id,
      pnl_level,
      cost_behavior,
      calculation_method,
      unit_price,
      percent,
      amount,
      source_key,
      quality_value,
      event_name_pattern,
      enabled,
      effective_from,
      effective_to,
      sort_order,
      updated_at
    ) VALUES (
      @id,
      @articleId,
      @pnlLevel,
      @costBehavior,
      @calculationMethod,
      @unitPrice,
      @percent,
      @amount,
      @sourceKey,
      @qualityValue,
      @eventNamePattern,
      @enabled,
      @effectiveFrom,
      @effectiveTo,
      @sortOrder,
      @updatedAt
    )
  `);
  const ensureUnitEconomicsDefaultsTransaction = database.transaction(() => {
    for (const article of DEFAULT_UNIT_ECONOMICS_COST_ARTICLES) {
      insertMissingUnitEconomicsArticle.run({
        ...article,
        enabled: article.enabled ? 1 : 0
      });
    }

    for (const rule of DEFAULT_UNIT_ECONOMICS_COST_RULES) {
      insertMissingUnitEconomicsRule.run({
        ...rule,
        eventNamePattern: rule.eventNamePattern ?? null,
        enabled: rule.enabled ? 1 : 0,
        updatedAt: null
      });
    }
  });
  ensureUnitEconomicsDefaultsTransaction();

  const defaultUnitEconomicsArticleIds = DEFAULT_UNIT_ECONOMICS_COST_ARTICLES.map(
    (article) => article.id
  );
  const defaultUnitEconomicsRuleIds = DEFAULT_UNIT_ECONOMICS_COST_RULES.map(
    (rule) => rule.id
  );
  if (defaultUnitEconomicsArticleIds.length > 0) {
    database
      .prepare(
        `
        UPDATE unit_economics_cost_articles
        SET effective_from = ?
        WHERE effective_from = '2026-01-01'
          AND id IN (${defaultUnitEconomicsArticleIds.map(() => "?").join(", ")})
      `
      )
      .run(DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM, ...defaultUnitEconomicsArticleIds);
  }
  if (defaultUnitEconomicsRuleIds.length > 0) {
    database
      .prepare(
        `
        UPDATE unit_economics_cost_rules
        SET effective_from = ?
        WHERE effective_from = '2026-01-01'
          AND id IN (${defaultUnitEconomicsRuleIds.map(() => "?").join(", ")})
      `
      )
      .run(DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM, ...defaultUnitEconomicsRuleIds);
  }

  database
    .prepare(
      `
      UPDATE unit_economics_cost_articles
      SET pnl_level = 'variable_contribution'
      WHERE id IN ('demo_events', 'ambassador_activities')
        AND pnl_level = 'above_ebitda'
    `
    )
    .run();
  database
    .prepare(
      `
      UPDATE unit_economics_cost_rules
      SET pnl_level = 'variable_contribution'
      WHERE article_id IN ('demo_events', 'ambassador_activities')
        AND calculation_method = 'amount_per_participant'
        AND pnl_level = 'above_ebitda'
    `
    )
    .run();
  database
    .prepare(
      `
      INSERT OR IGNORE INTO unit_economics_settings (
        id,
        event_participant_mode,
        updated_at
      ) VALUES (
        1,
        'invited',
        NULL
      )
    `
    )
    .run();
  database
    .prepare(
      `
      UPDATE unit_economics_cost_rules
      SET unit_price = 20000,
        enabled = 1
      WHERE id = 'leadgen-us-ready-to-meet-default'
        AND article_id = 'lead_purchase'
        AND calculation_method = 'amount_per_lead'
        AND source_key = 'Лидген УС'
        AND quality_value = 'Готов к встрече'
        AND unit_price = 0
        AND enabled = 0
    `
    )
    .run();
  database
    .prepare(
      `
      UPDATE unit_economics_cost_rules
      SET unit_price = 5000
      WHERE id = 'guest-meeting-participant-default'
        AND article_id = 'demo_events'
        AND calculation_method = 'amount_per_participant'
        AND event_name_pattern = 'Гостевая встреча'
        AND unit_price = 15000
    `
    )
    .run();
  database
    .prepare(
      `
      DELETE FROM unit_economics_cost_rules
      WHERE id = 'pau-participant-default'
        AND article_id = 'ambassador_activities'
        AND calculation_method = 'amount_per_participant'
        AND event_name_pattern = 'ПАУ'
        AND unit_price = 5000
    `
    )
    .run();

  const existingManagerWhitelist = database
    .prepare(
      "SELECT COUNT(*) AS count FROM module_manager_whitelist_settings WHERE module_key = ?"
    )
    .get("attraction") as { count: number };

  if (existingManagerWhitelist.count === 0) {
    const seedManagerWhitelist = database.prepare(`
      INSERT INTO module_manager_whitelist_settings (
        module_key,
        manager_id,
        manager_name,
        enabled,
        sort_order,
        updated_at
      ) VALUES (
        @moduleKey,
        @managerId,
        @managerName,
        1,
        @sortOrder,
        @updatedAt
      )
    `);
    const seedManagerWhitelistTransaction = database.transaction(
      (updatedAt: string) => {
        ATTRACTION_MANAGER_CATALOG.forEach((manager, index) => {
          seedManagerWhitelist.run({
            moduleKey: "attraction",
            managerId: manager.id,
            managerName: manager.name,
            sortOrder: index * 10,
            updatedAt
          });
        });
      }
    );
    seedManagerWhitelistTransaction(new Date().toISOString());
  }

  const replaceStageCatalogStatement = database.prepare(`
    INSERT INTO stage_catalog (
      entity_type,
      category_id,
      status_id,
      name,
      semantic_id,
      sort_order
    )
    VALUES (@entityType, @categoryId, @statusId, @name, @semanticId, @sortOrder)
  `);

  const upsertLeadStatement = database.prepare(`
    INSERT INTO lead_snapshots (
      id, status_id, source_id, opportunity, assigned_by_id, date_create, date_modify,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
      @id, @statusId, @sourceId, @opportunity, @assignedById, @dateCreate, @dateModify,
      @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm
    )
    ON CONFLICT(id) DO UPDATE SET
      status_id = excluded.status_id,
      source_id = excluded.source_id,
      opportunity = excluded.opportunity,
      assigned_by_id = excluded.assigned_by_id,
      date_create = excluded.date_create,
      date_modify = excluded.date_modify,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      utm_term = excluded.utm_term
  `);

  const upsertDealStatement = database.prepare(`
    INSERT INTO deal_snapshots (
      id, title, contact_id, lead_id, category_id, stage_id, stage_semantic_id, opportunity, assigned_by_id,
      source_id, quality_value, business_club_value, target_group_value, meeting_type_value, meeting_date_value, tariff_value, conversion_event_value, refusal_reason_value, refusal_reason_detail, date_create,
      date_modify, date_closed, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
      @id, @title, @contactId, @leadId, @categoryId, @stageId, @stageSemanticId, @opportunity, @assignedById,
      @sourceId, @qualityValue, @businessClubValue, @targetGroupValue, @meetingTypeValue, @meetingDateValue, @tariffValue, @conversionEventValue, @refusalReasonValue, @refusalReasonDetail, @dateCreate,
      @dateModify, @dateClosed, @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      contact_id = excluded.contact_id,
      lead_id = excluded.lead_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_semantic_id = excluded.stage_semantic_id,
      opportunity = excluded.opportunity,
      assigned_by_id = excluded.assigned_by_id,
      source_id = excluded.source_id,
      quality_value = excluded.quality_value,
      business_club_value = excluded.business_club_value,
      target_group_value = excluded.target_group_value,
      meeting_type_value = excluded.meeting_type_value,
      meeting_date_value = excluded.meeting_date_value,
      tariff_value = excluded.tariff_value,
      conversion_event_value = excluded.conversion_event_value,
      refusal_reason_value = excluded.refusal_reason_value,
      refusal_reason_detail = excluded.refusal_reason_detail,
      date_create = excluded.date_create,
      date_modify = excluded.date_modify,
      date_closed = excluded.date_closed,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      utm_term = excluded.utm_term
  `);

  const deleteDealMeetingSlotsStatement = database.prepare(`
    DELETE FROM deal_meeting_slots WHERE deal_id = ?
  `);

  const upsertDealMeetingSlotStatement = database.prepare(`
    INSERT INTO deal_meeting_slots (
      deal_id,
      slot_index,
      date_value,
      type_value,
      place_value,
      calendar_value,
      event_id,
      source,
      updated_at
    ) VALUES (
      @dealId,
      @slotIndex,
      @dateValue,
      @typeValue,
      @placeValue,
      @calendarValue,
      @eventId,
      @source,
      @updatedAt
    )
    ON CONFLICT(deal_id, slot_index) DO UPDATE SET
      date_value = excluded.date_value,
      type_value = excluded.type_value,
      place_value = excluded.place_value,
      calendar_value = excluded.calendar_value,
      event_id = excluded.event_id,
      source = excluded.source,
      updated_at = excluded.updated_at
  `);

  const upsertStageHistoryStatement = database.prepare(`
    INSERT INTO stage_history_snapshots (
      id,
      owner_id,
      category_id,
      stage_id,
      stage_semantic_id,
      type_id,
      created_time
    ) VALUES (
      @id,
      @ownerId,
      @categoryId,
      @stageId,
      @stageSemanticId,
      @typeId,
      @createdTime
    )
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_semantic_id = excluded.stage_semantic_id,
      type_id = excluded.type_id,
      created_time = excluded.created_time
  `);

  const upsertActivityStatement = database.prepare(`
    INSERT INTO activity_snapshots (
      id,
      owner_type_id,
      owner_id,
      type_id,
      provider_id,
      responsible_id,
      created_time,
      deadline,
      last_updated,
      completed,
      completed_time
    ) VALUES (
      @id,
      @ownerTypeId,
      @ownerId,
      @typeId,
      @providerId,
      @responsibleId,
      @createdTime,
      @deadline,
      @lastUpdated,
      @completed,
      @completedTime
    )
    ON CONFLICT(id) DO UPDATE SET
      owner_type_id = excluded.owner_type_id,
      owner_id = excluded.owner_id,
      type_id = excluded.type_id,
      provider_id = excluded.provider_id,
      responsible_id = excluded.responsible_id,
      created_time = excluded.created_time,
      deadline = excluded.deadline,
      last_updated = excluded.last_updated,
      completed = excluded.completed,
      completed_time = excluded.completed_time
  `);

  const deleteActivityBindingsStatement = database.prepare(`
    DELETE FROM activity_binding_snapshots
    WHERE activity_id = ?
  `);
  const insertActivityBindingStatement = database.prepare(`
    INSERT INTO activity_binding_snapshots (
      activity_id,
      owner_type_id,
      owner_id
    ) VALUES (
      @activityId,
      @ownerTypeId,
      @ownerId
    )
    ON CONFLICT(activity_id, owner_type_id, owner_id) DO NOTHING
  `);

  const upsertDeadlineChangeStatement = database.prepare(`
    INSERT INTO activity_deadline_changes (
      id,
      activity_id,
      owner_id,
      responsible_id,
      previous_deadline,
      next_deadline,
      changed_at
    ) VALUES (
      @id,
      @activityId,
      @ownerId,
      @responsibleId,
      @previousDeadline,
      @nextDeadline,
      @changedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      activity_id = excluded.activity_id,
      owner_id = excluded.owner_id,
      responsible_id = excluded.responsible_id,
      previous_deadline = excluded.previous_deadline,
      next_deadline = excluded.next_deadline,
      changed_at = excluded.changed_at
  `);

  const upsertDealMeetingDateChangeStatement = database.prepare(`
    INSERT INTO deal_meeting_date_changes (
      id,
      deal_id,
      slot_index,
      assigned_by_id,
      previous_meeting_date,
      next_meeting_date,
      changed_at
    ) VALUES (
      @id,
      @dealId,
      @slotIndex,
      @assignedById,
      @previousMeetingDate,
      @nextMeetingDate,
      @changedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      deal_id = excluded.deal_id,
      slot_index = excluded.slot_index,
      assigned_by_id = excluded.assigned_by_id,
      previous_meeting_date = excluded.previous_meeting_date,
      next_meeting_date = excluded.next_meeting_date,
      changed_at = excluded.changed_at
  `);

  const upsertConversionEventVisitStatement = database.prepare(`
    INSERT INTO conversion_event_visit_snapshots (
      id,
      event_id,
      event_name,
      event_date,
      status,
      stage_id,
      stage_name,
      deal_id,
      contact_id,
      manager_id,
      source_id,
      created_time,
      updated_time
    ) VALUES (
      @id,
      @eventId,
      @eventName,
      @eventDate,
      @status,
      @stageId,
      @stageName,
      @dealId,
      @contactId,
      @managerId,
      @sourceId,
      @createdTime,
      @updatedTime
    )
    ON CONFLICT(id) DO UPDATE SET
      event_id = excluded.event_id,
      event_name = excluded.event_name,
      event_date = excluded.event_date,
      status = excluded.status,
      stage_id = excluded.stage_id,
      stage_name = excluded.stage_name,
      deal_id = excluded.deal_id,
      contact_id = excluded.contact_id,
      manager_id = excluded.manager_id,
      source_id = excluded.source_id,
      created_time = excluded.created_time,
      updated_time = excluded.updated_time
  `);

  const upsertIdentityLinkStatement = database.prepare(`
    INSERT INTO identity_links (
      identity_id,
      module_key,
      deal_id,
      lead_id,
      contact_id,
      deal_category_id,
      lead_category_id,
      current_manager_id,
      current_stage_id,
      source_id,
      created_at,
      updated_at,
      link_confidence,
      link_reason
    ) VALUES (
      @identityId,
      @moduleKey,
      @dealId,
      @leadId,
      @contactId,
      @dealCategoryId,
      @leadCategoryId,
      @currentManagerId,
      @currentStageId,
      @sourceId,
      @createdAt,
      @updatedAt,
      @linkConfidence,
      @linkReason
    )
    ON CONFLICT(identity_id) DO UPDATE SET
      module_key = excluded.module_key,
      deal_id = excluded.deal_id,
      lead_id = excluded.lead_id,
      contact_id = excluded.contact_id,
      deal_category_id = excluded.deal_category_id,
      lead_category_id = excluded.lead_category_id,
      current_manager_id = excluded.current_manager_id,
      current_stage_id = excluded.current_stage_id,
      source_id = excluded.source_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      link_confidence = excluded.link_confidence,
      link_reason = excluded.link_reason
  `);

  const upsertDealStageFactStatement = database.prepare(`
    INSERT INTO deal_stage_facts (
      fact_id,
      source_system,
      source_entity_id,
      deal_id,
      contact_id,
      lead_id,
      category_id,
      stage_id,
      stage_name,
      stage_semantic_id,
      entered_at,
      left_at,
      manager_id,
      source_id,
      sort_order,
      payload_json
    ) VALUES (
      @factId,
      @sourceSystem,
      @sourceEntityId,
      @dealId,
      @contactId,
      @leadId,
      @categoryId,
      @stageId,
      @stageName,
      @stageSemanticId,
      @enteredAt,
      @leftAt,
      @managerId,
      @sourceId,
      @sortOrder,
      @payloadJson
    )
    ON CONFLICT(fact_id) DO UPDATE SET
      source_system = excluded.source_system,
      source_entity_id = excluded.source_entity_id,
      deal_id = excluded.deal_id,
      contact_id = excluded.contact_id,
      lead_id = excluded.lead_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_name = excluded.stage_name,
      stage_semantic_id = excluded.stage_semantic_id,
      entered_at = excluded.entered_at,
      left_at = excluded.left_at,
      manager_id = excluded.manager_id,
      source_id = excluded.source_id,
      sort_order = excluded.sort_order,
      payload_json = excluded.payload_json
  `);

  const upsertDealTouchpointFactStatement = database.prepare(`
    INSERT INTO deal_touchpoint_facts (
      fact_id,
      kind,
      source_system,
      source_entity_type,
      source_entity_id,
      occurred_at,
      deal_id,
      contact_id,
      lead_id,
      manager_id,
      source_id,
      stage_id_at_event,
      stage_name_at_event,
      link_confidence,
      link_reason,
      payload_json
    ) VALUES (
      @factId,
      @kind,
      @sourceSystem,
      @sourceEntityType,
      @sourceEntityId,
      @occurredAt,
      @dealId,
      @contactId,
      @leadId,
      @managerId,
      @sourceId,
      @stageIdAtEvent,
      @stageNameAtEvent,
      @linkConfidence,
      @linkReason,
      @payloadJson
    )
    ON CONFLICT(fact_id) DO UPDATE SET
      kind = excluded.kind,
      source_system = excluded.source_system,
      source_entity_type = excluded.source_entity_type,
      source_entity_id = excluded.source_entity_id,
      occurred_at = excluded.occurred_at,
      deal_id = excluded.deal_id,
      contact_id = excluded.contact_id,
      lead_id = excluded.lead_id,
      manager_id = excluded.manager_id,
      source_id = excluded.source_id,
      stage_id_at_event = excluded.stage_id_at_event,
      stage_name_at_event = excluded.stage_name_at_event,
      link_confidence = excluded.link_confidence,
      link_reason = excluded.link_reason,
      payload_json = excluded.payload_json
  `);

  const upsertEventSnapshotStatement = database.prepare(`
    INSERT INTO event_snapshots (
      event_id,
      entity_type_id,
      category_id,
      title,
      event_date,
      start_at,
      end_at,
      stage_id,
      stage_name,
      status,
      event_type_id,
      event_type_label,
      format_id,
      created_time,
      updated_time
    ) VALUES (
      @eventId,
      @entityTypeId,
      @categoryId,
      @title,
      @eventDate,
      @startAt,
      @endAt,
      @stageId,
      @stageName,
      @status,
      @eventTypeId,
      @eventTypeLabel,
      @formatId,
      @createdTime,
      @updatedTime
    )
    ON CONFLICT(event_id) DO UPDATE SET
      entity_type_id = excluded.entity_type_id,
      category_id = excluded.category_id,
      title = excluded.title,
      event_date = excluded.event_date,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      stage_id = excluded.stage_id,
      stage_name = excluded.stage_name,
      status = excluded.status,
      event_type_id = excluded.event_type_id,
      event_type_label = excluded.event_type_label,
      format_id = excluded.format_id,
      created_time = excluded.created_time,
      updated_time = excluded.updated_time
  `);
  const reconcileConversionEventVisitDateStatement = database.prepare(`
    UPDATE conversion_event_visit_snapshots
    SET event_date = @eventDate
    WHERE event_id = @eventId
      AND event_date <> @eventDate
  `);

  const upsertEventVisitFactStatement = database.prepare(`
    INSERT INTO event_visit_facts (
      visit_id,
      event_id,
      deal_id,
      contact_id,
      lead_id,
      manager_id,
      source_id,
      current_stage_id,
      current_stage_name,
      invited_at,
      confirmed_at,
      attended_at,
      refused_at,
      final_status,
      event_date,
      stage_id_at_event,
      link_confidence,
      link_reason,
      payload_json
    ) VALUES (
      @visitId,
      @eventId,
      @dealId,
      @contactId,
      @leadId,
      @managerId,
      @sourceId,
      @currentStageId,
      @currentStageName,
      @invitedAt,
      @confirmedAt,
      @attendedAt,
      @refusedAt,
      @finalStatus,
      @eventDate,
      @stageIdAtEvent,
      @linkConfidence,
      @linkReason,
      @payloadJson
    )
    ON CONFLICT(visit_id) DO UPDATE SET
      event_id = excluded.event_id,
      deal_id = excluded.deal_id,
      contact_id = excluded.contact_id,
      lead_id = excluded.lead_id,
      manager_id = excluded.manager_id,
      source_id = excluded.source_id,
      current_stage_id = excluded.current_stage_id,
      current_stage_name = excluded.current_stage_name,
      invited_at = excluded.invited_at,
      confirmed_at = excluded.confirmed_at,
      attended_at = excluded.attended_at,
      refused_at = excluded.refused_at,
      final_status = excluded.final_status,
      event_date = excluded.event_date,
      stage_id_at_event = excluded.stage_id_at_event,
      link_confidence = excluded.link_confidence,
      link_reason = excluded.link_reason,
      payload_json = excluded.payload_json
  `);

  const upsertEventVisitStageHistoryStatement = database.prepare(`
    INSERT INTO event_visit_stage_history (
      history_id,
      visit_id,
      entity_type_id,
      category_id,
      stage_id,
      stage_name,
      type_id,
      changed_at
    ) VALUES (
      @historyId,
      @visitId,
      @entityTypeId,
      @categoryId,
      @stageId,
      @stageName,
      @typeId,
      @changedAt
    )
    ON CONFLICT(history_id) DO UPDATE SET
      visit_id = excluded.visit_id,
      entity_type_id = excluded.entity_type_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_name = excluded.stage_name,
      type_id = excluded.type_id,
      changed_at = excluded.changed_at
  `);

  const deleteModuleEventTypeSettingsStatement = database.prepare(`
    DELETE FROM module_event_type_settings
    WHERE module_key = ?
  `);

  const upsertModuleEventTypeSettingStatement = database.prepare(`
    INSERT INTO module_event_type_settings (
      module_key,
      event_type_id,
      event_type_label,
      enabled,
      updated_at
    ) VALUES (
      @moduleKey,
      @eventTypeId,
      @eventTypeLabel,
      @enabled,
      @updatedAt
    )
    ON CONFLICT(module_key, event_type_id) DO UPDATE SET
      event_type_label = excluded.event_type_label,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `);

  const deleteManagerWhitelistSettingsStatement = database.prepare(`
    DELETE FROM module_manager_whitelist_settings
    WHERE module_key = ?
  `);

  const upsertManagerWhitelistSettingStatement = database.prepare(`
    INSERT INTO module_manager_whitelist_settings (
      module_key,
      manager_id,
      manager_name,
      team_id,
      team_name,
      enabled,
      sort_order,
      updated_at
    ) VALUES (
      @moduleKey,
      @managerId,
      @managerName,
      @teamId,
      @teamName,
      @enabled,
      @sortOrder,
      @updatedAt
    )
    ON CONFLICT(module_key, manager_id) DO UPDATE SET
      manager_name = excluded.manager_name,
      team_id = excluded.team_id,
      team_name = excluded.team_name,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  const deleteConversionEventTypeOptionsStatement = database.prepare(`
    DELETE FROM conversion_event_type_options
  `);

  const upsertConversionEventTypeOptionStatement = database.prepare(`
    INSERT INTO conversion_event_type_options (
      id,
      title,
      category_id,
      stage_id,
      selected_for_planned_inventory,
      updated_at
    ) VALUES (
      @id,
      @title,
      @categoryId,
      @stageId,
      @selectedForPlannedInventory,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      selected_for_planned_inventory = excluded.selected_for_planned_inventory,
      updated_at = excluded.updated_at
  `);

  const deleteIdentityLinksStatement = database.prepare(`
    DELETE FROM identity_links
  `);
  const deleteDealStageFactsStatement = database.prepare(`
    DELETE FROM deal_stage_facts
  `);
  const deleteDealTouchpointFactsStatement = database.prepare(`
    DELETE FROM deal_touchpoint_facts
  `);
  const deleteEventVisitFactsStatement = database.prepare(`
    DELETE FROM event_visit_facts
  `);

  const upsertCallStatement = database.prepare(`
    INSERT INTO call_snapshots (
      id,
      crm_activity_id,
      portal_user_id,
      call_type,
      call_start_date,
      call_duration_seconds,
      crm_entity_type,
      crm_entity_id,
      call_failed_code
    ) VALUES (
      @id,
      @crmActivityId,
      @portalUserId,
      @callType,
      @callStartDate,
      @callDurationSeconds,
      @crmEntityType,
      @crmEntityId,
      @callFailedCode
    )
    ON CONFLICT(id) DO UPDATE SET
      crm_activity_id = excluded.crm_activity_id,
      portal_user_id = excluded.portal_user_id,
      call_type = excluded.call_type,
      call_start_date = excluded.call_start_date,
      call_duration_seconds = excluded.call_duration_seconds,
      crm_entity_type = excluded.crm_entity_type,
      crm_entity_id = excluded.crm_entity_id,
      call_failed_code = excluded.call_failed_code
  `);

  const upsertManagerDirectoryStatement = database.prepare(`
    INSERT INTO manager_directory (
      id,
      name
    ) VALUES (
      @id,
      @name
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name
  `);

  const upsertSyncStateStatement = database.prepare(`
    INSERT INTO sync_state (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value
  `);
  const deleteCurrentAttractionDealIdsStatement = database.prepare(`
    DELETE FROM attraction_current_deal_ids
  `);
  const insertCurrentAttractionDealIdStatement = database.prepare(`
    INSERT INTO attraction_current_deal_ids (deal_id)
    VALUES (?)
  `);
  const upsertSyncCursorStatement = database.prepare(`
    INSERT INTO sync_cursors (key, cursor_value, updated_at)
    VALUES (@key, @cursorValue, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET
      cursor_value = excluded.cursor_value,
      updated_at = excluded.updated_at
  `);
  const upsertSyncCoverageStatement = database.prepare(`
    INSERT INTO sync_coverage (
      scope_key,
      stream,
      provider_id,
      covered_from,
      covered_to,
      algorithm_version,
      synced_at
    ) VALUES (
      @scopeKey,
      @stream,
      @providerId,
      @coveredFrom,
      @coveredTo,
      @algorithmVersion,
      @syncedAt
    )
    ON CONFLICT(scope_key, stream, provider_id, algorithm_version) DO UPDATE SET
      covered_from = CASE
        WHEN excluded.covered_from < sync_coverage.covered_from
          THEN excluded.covered_from
        ELSE sync_coverage.covered_from
      END,
      covered_to = excluded.covered_to,
      synced_at = excluded.synced_at
  `);
  const insertSalesPlanRowStatement = database.prepare(`
    INSERT INTO sales_plan_rows (
      period_start,
      period_end,
      manager_id,
      manager_name,
      target_group_key,
      target_group_label,
      planned_deals,
      planned_amount,
      updated_at
    ) VALUES (
      @periodStart,
      @periodEnd,
      @managerId,
      @managerName,
      @targetGroupKey,
      @targetGroupLabel,
      @plannedDeals,
      @plannedAmount,
      @updatedAt
    )
  `);
  const deleteSalesPlanRowsStatement = database.prepare(
    "DELETE FROM sales_plan_rows WHERE period_start = ? AND period_end = ?"
  );
  const insertPricingRuleStatement = database.prepare(`
    INSERT INTO pricing_rules (
      id,
      customer_label,
      tariff_label,
      attraction_revenue_amount,
      enabled,
      sort_order,
      updated_at
    ) VALUES (
      @id,
      @customerLabel,
      @tariffLabel,
      @attractionRevenueAmount,
      @enabled,
      @sortOrder,
      @updatedAt
    )
  `);
  const upsertOperationalThresholdSettingsStatement = database.prepare(`
    INSERT INTO operational_threshold_settings (
      key,
      payload_json,
      updated_at
    ) VALUES (
      @key,
      @payloadJson,
      @updatedAt
    )
    ON CONFLICT(key) DO UPDATE SET
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);
  const insertUnitEconomicsCostRuleStatement = database.prepare(`
    INSERT INTO unit_economics_cost_rules (
      id,
      article_id,
      pnl_level,
      cost_behavior,
      calculation_method,
      unit_price,
      percent,
        amount,
        source_key,
        quality_value,
        event_name_pattern,
        enabled,
      effective_from,
      effective_to,
      sort_order,
      updated_at
    ) VALUES (
      @id,
      @articleId,
      @pnlLevel,
      @costBehavior,
      @calculationMethod,
      @unitPrice,
      @percent,
        @amount,
        @sourceKey,
        @qualityValue,
        @eventNamePattern,
        @enabled,
      @effectiveFrom,
      @effectiveTo,
      @sortOrder,
      @updatedAt
    )
  `);
  const upsertUnitEconomicsCostFactStatement = database.prepare(`
    INSERT INTO unit_economics_cost_facts (
      id,
      article_id,
      pnl_level,
      cost_behavior,
      calculation_method,
      period_start,
      period_end,
      amount,
      currency,
      quantity,
      source_system,
      source_reference,
      confidence,
      status,
      comment,
      updated_at
    ) VALUES (
      @id,
      @articleId,
      @pnlLevel,
      @costBehavior,
      @calculationMethod,
      @periodStart,
      @periodEnd,
      @amount,
      @currency,
      @quantity,
      @sourceSystem,
      @sourceReference,
      @confidence,
      @status,
      @comment,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      article_id = excluded.article_id,
      pnl_level = excluded.pnl_level,
      cost_behavior = excluded.cost_behavior,
      calculation_method = excluded.calculation_method,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      amount = excluded.amount,
      currency = excluded.currency,
      quantity = excluded.quantity,
      source_system = excluded.source_system,
      source_reference = excluded.source_reference,
      confidence = excluded.confidence,
      status = excluded.status,
      comment = excluded.comment,
      updated_at = excluded.updated_at
  `);
  const replaceSalesPlanRowsTransaction = database.transaction(
    (input: ReplaceSalesPlanRowsInput) => {
      deleteSalesPlanRowsStatement.run(input.periodStart, input.periodEnd);

      for (const row of input.rows) {
        insertSalesPlanRowStatement.run({
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          managerId: row.managerId,
          managerName: row.managerName ?? null,
          targetGroupKey: row.targetGroupKey,
          targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
          plannedDeals: row.plannedDeals,
          plannedAmount: row.plannedAmount,
          updatedAt: input.updatedAt
        });
      }
    }
  );
  const replaceSalesPlanPeriodsTransaction = database.transaction(
    (input: ReplaceSalesPlanPeriodsInput) => {
      for (const period of input.periods) {
        deleteSalesPlanRowsStatement.run(period.periodStart, period.periodEnd);

        for (const row of period.rows) {
          insertSalesPlanRowStatement.run({
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            managerId: row.managerId,
            managerName: row.managerName ?? null,
            targetGroupKey: row.targetGroupKey,
            targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
            plannedDeals: row.plannedDeals,
            plannedAmount: row.plannedAmount,
            updatedAt: input.updatedAt
          });
        }
      }
    }
  );
  const replacePricingRulesTransaction = database.transaction(
    (input: ReplacePricingRulesInput) => {
      database.exec("DELETE FROM pricing_rules");

      input.rules.forEach((rule, index) => {
        insertPricingRuleStatement.run({
          id: rule.id,
          customerLabel: rule.customerLabel,
          tariffLabel: rule.tariffLabel,
          attractionRevenueAmount: rule.attractionRevenueAmount,
          enabled: rule.enabled ? 1 : 0,
          sortOrder: rule.sortOrder ?? index * 10,
          updatedAt: input.updatedAt
        });
      });
    }
  );
  const replaceOperationalThresholdSettingsTransaction = database.transaction(
    (input: ReplaceOperationalThresholdSettingsInput) => {
      const { updatedAt, ...settings } = input;
      upsertOperationalThresholdSettingsStatement.run({
        key: OPERATIONAL_THRESHOLD_SETTINGS_KEY,
        payloadJson: JSON.stringify(settings),
        updatedAt
      });
    }
  );
  const replaceUnitEconomicsCostRulesTransaction = database.transaction(
    (input: ReplaceUnitEconomicsCostRulesInput) => {
      database.exec("DELETE FROM unit_economics_cost_rules");

      input.rules.forEach((rule, index) => {
        insertUnitEconomicsCostRuleStatement.run({
          ...rule,
          eventNamePattern: rule.eventNamePattern ?? null,
          enabled: rule.enabled ? 1 : 0,
          sortOrder: rule.sortOrder ?? index * 10,
          updatedAt: input.updatedAt
        });
      });

      if (input.eventParticipantMode) {
        database
          .prepare(
            `
            INSERT INTO unit_economics_settings (
              id,
              event_participant_mode,
              updated_at
            ) VALUES (
              1,
              @eventParticipantMode,
              @updatedAt
            )
            ON CONFLICT(id) DO UPDATE SET
              event_participant_mode = excluded.event_participant_mode,
              updated_at = excluded.updated_at
          `
          )
          .run({
            eventParticipantMode: input.eventParticipantMode,
            updatedAt: input.updatedAt
          });
      }
    }
  );
  const upsertUnitEconomicsCostFactsTransaction = database.transaction(
    (rows: UnitEconomicsCostFact[]) => {
      const updatedAt = new Date().toISOString();

      for (const row of rows) {
        upsertUnitEconomicsCostFactStatement.run({
          ...row,
          updatedAt
        });
      }
    }
  );
  const snapshotTransaction = database.transaction((task: () => unknown) =>
    task()
  );
  const callAnalysisRepositoryMethods =
    createCallAnalysisRepositoryMethods(database);
  const enrichmentProposalRepositoryMethods =
    createEnrichmentProposalRepositoryMethods(database);
  const telegramManagerRegistrationRepositoryMethods =
    createTelegramManagerRegistrationRepositoryMethods(database);
  const commentRepositoryMethods = createCommentRepositoryMethods(database);

  const hydrateDealMeetingSlots = (deals: DealSnapshot[]): DealSnapshot[] => {
    if (deals.length === 0) {
      return deals;
    }

    const dealIds = deals.map((deal) => deal.id);
    const slotRows = chunkValues(dealIds).flatMap((chunk) => {
      const placeholders = chunk.map(() => "?").join(", ");
      return database
        .prepare(
          `SELECT
            deal_id AS dealId,
            slot_index AS slotIndex,
            date_value AS dateValue,
            type_value AS typeValue,
            place_value AS placeValue,
            calendar_value AS calendarValue,
            event_id AS eventId,
            source
          FROM deal_meeting_slots
          WHERE deal_id IN (${placeholders})
          ORDER BY deal_id ASC, slot_index ASC`
        )
        .all(...chunk) as Array<{
        dealId: string;
        slotIndex: number;
        dateValue: string | null;
        typeValue: string | null;
        placeValue: string | null;
        calendarValue: string | null;
        eventId: string | null;
        source: string;
      }>;
    });
    const slotsByDealId = new Map<string, DealMeetingSlot[]>();

    for (const row of slotRows) {
      if (![1, 2, 3].includes(row.slotIndex)) {
        continue;
      }

      const slot: DealMeetingSlot = {
        index: row.slotIndex as 1 | 2 | 3,
        dateValue: row.dateValue,
        typeValue: row.typeValue,
        placeValue: row.placeValue,
        calendarValue: row.calendarValue,
        eventId: row.eventId,
        source: "deal_fields"
      };
      slotsByDealId.set(row.dealId, [
        ...(slotsByDealId.get(row.dealId) ?? []),
        slot
      ]);
    }

    return deals.map((deal) => {
      const meetingSlots = slotsByDealId.get(deal.id);
      return meetingSlots ? { ...deal, meetingSlots } : deal;
    });
  };

  return {
    runSnapshotTransaction<T>(task: () => T) {
      return snapshotTransaction(task) as T;
    },

    async getLatestSuccessCursor(categoryIds = [], assignedByIds = []) {
      if (categoryIds.length > 0 || assignedByIds.length > 0) {
        const scopeKey = buildCategoryScopeKey(categoryIds, assignedByIds);
        const syncRun = database
          .prepare(
            `SELECT 1 AS value
            FROM sync_runs
            WHERE status = 'success' AND scope_key = ?
            LIMIT 1`
          )
          .get(scopeKey) as { value: number } | undefined;

        if (!syncRun) {
          return null;
        }
      }

      const where = buildDealScopeWhereClause({ categoryIds, assignedByIds });
      const row = database
        .prepare(
          `SELECT MAX(date_modify) AS value FROM deal_snapshots WHERE ${where.clause}`
        )
        .get(...where.values) as { value: string | null };

      return row.value ?? null;
    },

    async getLatestSuccessfulScope(categoryIds = [], assignedByIds = []) {
      const requestedCategoryIds = categoryIds.map(String);
      const requestedAssignedByIds = assignedByIds.map(String);
      if (requestedCategoryIds.length === 0) {
        return null;
      }

      const rows = database
        .prepare(
          `SELECT id, scope_key AS scopeKey
          FROM sync_runs
          WHERE status = 'success' AND scope_key IS NOT NULL
          ORDER BY id DESC`
        )
        .all() as Array<{ id: number; scopeKey: string | null }>;
      const candidates = rows.flatMap((row) => {
        if (!row.scopeKey) {
          return [];
        }

        const parsed = parseCategoryScopeKey(row.scopeKey);
        if (!parsed) {
          return [];
        }

        if (!sameStringSet(parsed.categoryIds, requestedCategoryIds)) {
          return [];
        }

        if (requestedAssignedByIds.length > 0) {
          if (parsed.assignedByIds.length === 0) {
            return [];
          }

          const parsedCoversRequested = isSubset(
            requestedAssignedByIds,
            parsed.assignedByIds
          );
          const requestedCoversParsed = isSubset(
            parsed.assignedByIds,
            requestedAssignedByIds
          );

          if (!parsedCoversRequested && !requestedCoversParsed) {
            return [];
          }
        } else if (parsed.assignedByIds.length > 0) {
          return [];
        }

        return [{ ...parsed, id: row.id }];
      });

      candidates.sort((left, right) => {
        if (right.assignedByIds.length !== left.assignedByIds.length) {
          return right.assignedByIds.length - left.assignedByIds.length;
        }

        return right.id - left.id;
      });

      const candidate = candidates[0];
      if (!candidate) {
        return null;
      }

      return {
        scopeKey: candidate.scopeKey,
        categoryIds: candidate.categoryIds,
        assignedByIds: candidate.assignedByIds
      };
    },

    async getSyncCursor(key) {
      const row = database
        .prepare("SELECT cursor_value AS value FROM sync_cursors WHERE key = ?")
        .get(key) as { value: string } | undefined;

      return row?.value ?? null;
    },

    setSyncCursor(inputRow) {
      upsertSyncCursorStatement.run(inputRow);
      return Promise.resolve();
    },

    async hasSyncCoverage(inputRow) {
      const providerClause =
        inputRow.providerId === null ? "provider_id IS NULL" : "provider_id = ?";
      const values: string[] =
        inputRow.providerId === null
          ? [inputRow.scopeKey, inputRow.stream, inputRow.algorithmVersion]
          : [
              inputRow.scopeKey,
              inputRow.stream,
              inputRow.providerId,
              inputRow.algorithmVersion
            ];
      const requiredTo = inputRow.requiredTo ?? null;
      const row = database
        .prepare(
          `SELECT COUNT(*) AS count
          FROM sync_coverage
          WHERE scope_key = ?
            AND stream = ?
            AND ${providerClause}
            AND algorithm_version = ?
            AND covered_from <= ?
            AND (? IS NULL OR covered_to IS NULL OR covered_to >= ?)
            AND (? IS NULL OR synced_at >= ?)`
        )
        .get(
          ...values,
          inputRow.requiredFrom,
          requiredTo,
          requiredTo,
          inputRow.requiredSyncedAt ?? null,
          inputRow.requiredSyncedAt ?? null
        ) as {
        count: number;
      };

      return row.count > 0;
    },

    upsertSyncCoverage(inputRow) {
      upsertSyncCoverageStatement.run(inputRow);
      return Promise.resolve();
    },

    async getOperationalHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'operational_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getCallHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'call_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getCallActivityHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'call_activity_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getMeetingActivityHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'meeting_activity_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getTaskActivityHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'task_activity_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getDealCustomFieldsBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'deal_custom_fields_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getDealMeetingDateFieldBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'deal_meeting_date_field_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getSnapshotStats(scope) {
      const where = buildDealScopeWhereClause(scope);

      if (where.hasScope) {
        const scopedDealSql = `SELECT id FROM deal_snapshots WHERE ${where.clause}`;
        const deals = database
          .prepare(`SELECT COUNT(*) AS count FROM deal_snapshots WHERE ${where.clause}`)
          .get(...where.values) as { count: number };
        const activities = database
          .prepare(
            `SELECT COUNT(*) AS count FROM activity_snapshots WHERE owner_id IN (${scopedDealSql})`
          )
          .get(...where.values) as { count: number };
        const calls = database
          .prepare(
            `SELECT COUNT(*) AS count
             FROM call_snapshots
             WHERE (
               crm_entity_type = 'DEAL'
               AND crm_entity_id IN (${scopedDealSql})
             )
             OR crm_activity_id IN (
               SELECT id
               FROM activity_snapshots
               WHERE owner_id IN (${scopedDealSql})
             )`
          )
          .get(...where.values, ...where.values) as { count: number };
        const stageHistory = database
          .prepare(
            `SELECT COUNT(*) AS count FROM stage_history_snapshots WHERE owner_id IN (${scopedDealSql})`
          )
          .get(...where.values) as { count: number };

        return {
          deals: deals.count,
          activities: activities.count,
          calls: calls.count,
          stageHistory: stageHistory.count
        };
      }

      const deals = database
        .prepare("SELECT COUNT(*) AS count FROM deal_snapshots")
        .get() as { count: number };
      const activities = database
        .prepare("SELECT COUNT(*) AS count FROM activity_snapshots")
        .get() as { count: number };
      const calls = database
        .prepare("SELECT COUNT(*) AS count FROM call_snapshots")
        .get() as { count: number };
      const stageHistory = database
        .prepare("SELECT COUNT(*) AS count FROM stage_history_snapshots")
        .get() as { count: number };

      return {
        deals: deals.count,
        activities: activities.count,
        calls: calls.count,
        stageHistory: stageHistory.count
      };
    },

    async getActivitySnapshotCount() {
      const row = database
        .prepare("SELECT COUNT(*) AS count FROM activity_snapshots")
        .get() as { count: number };

      return row.count;
    },

    async getDealIdsByCategoryIds(categoryIds, assignedByIds) {
      const where = buildDealScopeWhereClause({
        categoryIds,
        ...(assignedByIds ? { assignedByIds } : {})
      });
      const rows = database
        .prepare(
          `SELECT id FROM deal_snapshots WHERE ${where.clause} ORDER BY id ASC`
        )
        .all(...where.values) as Array<{ id: string }>;

      return rows.map((row) => row.id);
    },

    async getOpenDealIdsByCategoryIds(categoryIds, assignedByIds) {
      const where = buildDealScopeWhereClause({
        categoryIds,
        ...(assignedByIds ? { assignedByIds } : {})
      });
      const rows = database
        .prepare(
          `SELECT id
          FROM deal_snapshots
          WHERE ${where.clause} AND stage_semantic_id = 'P'
          ORDER BY id ASC`
        )
        .all(...where.values) as Array<{ id: string }>;

      return rows.map((row) => row.id);
    },

    async getDealsByIds(dealIds) {
      if (dealIds.length === 0) {
        return [];
      }

      const deals = chunkValues(Array.from(new Set(dealIds))).flatMap((chunk) => {
        const placeholders = chunk.map(() => "?").join(", ");
        return database
          .prepare(
            `SELECT
              id,
              title,
              contact_id AS contactId,
              lead_id AS leadId,
              category_id AS categoryId,
              stage_id AS stageId,
              stage_semantic_id AS stageSemanticId,
              opportunity,
              assigned_by_id AS assignedById,
              source_id AS sourceId,
              quality_value AS qualityValue,
              business_club_value AS businessClubValue,
              target_group_value AS targetGroupValue,
              meeting_type_value AS meetingTypeValue,
              meeting_date_value AS meetingDateValue,
              tariff_value AS tariffValue,
              conversion_event_value AS conversionEventValue,
              refusal_reason_value AS refusalReasonValue,
              refusal_reason_detail AS refusalReasonDetail,
              date_create AS dateCreate,
              date_modify AS dateModify,
              date_closed AS dateClosed,
              utm_source AS utmSource,
              utm_medium AS utmMedium,
              utm_campaign AS utmCampaign,
              utm_content AS utmContent,
              utm_term AS utmTerm
            FROM deal_snapshots
            WHERE id IN (${placeholders})
            ORDER BY id ASC`
          )
          .all(...chunk) as DealSnapshot[];
      });
      return hydrateDealMeetingSlots(deals);
    },

    async getCurrentAttractionScope() {
      const stateRows = database
        .prepare(
          `SELECT key, value
          FROM sync_state
          WHERE key IN (?, ?)`
        )
        .all(
          CURRENT_ATTRACTION_SCOPE_KEY_STATE,
          CURRENT_ATTRACTION_SCOPE_RECONCILED_AT_STATE
        ) as Array<{ key: string; value: string }>;
      const state = new Map(stateRows.map((row) => [row.key, row.value]));
      const rows = database
        .prepare(
          `SELECT deal_id AS dealId
          FROM attraction_current_deal_ids
          ORDER BY deal_id ASC`
        )
        .all() as Array<{ dealId: string }>;

      return {
        scopeKey: state.get(CURRENT_ATTRACTION_SCOPE_KEY_STATE) ?? null,
        reconciledAt:
          state.get(CURRENT_ATTRACTION_SCOPE_RECONCILED_AT_STATE) ?? null,
        dealIds: rows.map((row) => row.dealId)
      };
    },

    replaceCurrentAttractionScope(inputRow) {
      const dealIds = Array.from(
        new Set(inputRow.dealIds.map((dealId) => dealId.trim()).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right));
      const transaction = database.transaction(() => {
        deleteCurrentAttractionDealIdsStatement.run();
        for (const dealId of dealIds) {
          insertCurrentAttractionDealIdStatement.run(dealId);
        }
        upsertSyncStateStatement.run(
          CURRENT_ATTRACTION_SCOPE_KEY_STATE,
          inputRow.scopeKey
        );
        upsertSyncStateStatement.run(
          CURRENT_ATTRACTION_SCOPE_RECONCILED_AT_STATE,
          inputRow.reconciledAt
        );
      });
      transaction();
      return Promise.resolve();
    },

    async getActivitiesByIds(activityIds) {
      if (activityIds.length === 0) {
        return [];
      }

      const rows = chunkValues(activityIds).flatMap((chunk) => {
        const placeholders = chunk.map(() => "?").join(", ");
        return database
          .prepare(
            `SELECT
              id,
              owner_type_id AS ownerTypeId,
              owner_id AS ownerId,
              type_id AS typeId,
              provider_id AS providerId,
              responsible_id AS responsibleId,
              created_time AS createdTime,
              deadline,
              last_updated AS lastUpdated,
              completed,
              completed_time AS completedTime
            FROM activity_snapshots
            WHERE id IN (${placeholders})
            ORDER BY id ASC`
          )
          .all(...chunk) as Array<
          Omit<ActivitySnapshot, "completed"> & {
            completed: number;
          }
        >;
      });

      return mapActivityRows(rows);
    },

    async getCallById(callId) {
      const row = database
        .prepare(
          `SELECT
            id,
            crm_activity_id AS crmActivityId,
            portal_user_id AS portalUserId,
            call_type AS callType,
            call_start_date AS callStartDate,
            call_duration_seconds AS callDurationSeconds,
            crm_entity_type AS crmEntityType,
            crm_entity_id AS crmEntityId,
            call_failed_code AS callFailedCode
          FROM call_snapshots
          WHERE id = ?`
        )
        .get(callId) as CallSnapshot | undefined;

      return row ?? null;
    },

    async getStageAtDealTime(dealId, at) {
      const targetMs = Date.parse(at);
      if (!Number.isFinite(targetMs)) {
        return null;
      }

      const rows = database
        .prepare(
          `SELECT
            id,
            owner_id AS ownerId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_semantic_id AS stageSemanticId,
            type_id AS typeId,
            created_time AS createdTime
          FROM stage_history_snapshots
          WHERE owner_id = ?`
        )
        .all(dealId) as StageHistorySnapshot[];

      return (
        rows
          .map((row) => ({
            row,
            createdAtMs: Date.parse(row.createdTime)
          }))
          .filter(
            (entry) =>
              Number.isFinite(entry.createdAtMs) && entry.createdAtMs <= targetMs
          )
          .sort(
            (left, right) =>
              right.createdAtMs - left.createdAtMs ||
              right.row.id.localeCompare(left.row.id)
          )[0]?.row ?? null
      );
    },

    ...callAnalysisRepositoryMethods,
    ...enrichmentProposalRepositoryMethods,
    ...telegramManagerRegistrationRepositoryMethods,

    async getCallActivityIdsMissingActivities(
      limit = 20_000,
      callStartDateFrom = null,
      ownerIds = []
    ) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 20_000;
      const filters = [
        "c.crm_activity_id IS NOT NULL",
        "TRIM(c.crm_activity_id) <> ''",
        "c.crm_activity_id <> '0'",
        "a.id IS NULL"
      ];
      const values: Array<string | number> = [];

      if (callStartDateFrom) {
        filters.push("c.call_start_date >= ?");
        values.push(callStartDateFrom);
      }

      const queryRows = (scopedOwnerIds: string[]) => {
        const ownerFilters = [...filters];
        const ownerValues: Array<string | number> = [...values];

        if (scopedOwnerIds.length > 0) {
          const placeholders = scopedOwnerIds.map(() => "?").join(", ");
          ownerFilters.push("c.crm_entity_type = 'DEAL'");
          ownerFilters.push(`c.crm_entity_id IN (${placeholders})`);
          ownerValues.push(...scopedOwnerIds);
        }

        return database
          .prepare(
            `SELECT DISTINCT c.crm_activity_id AS activityId
            FROM call_snapshots c
            LEFT JOIN activity_snapshots a ON a.id = c.crm_activity_id
            WHERE ${ownerFilters.join(" AND ")}
            ORDER BY c.crm_activity_id ASC
            LIMIT ?`
          )
          .all(...ownerValues, safeLimit) as Array<{ activityId: string }>;
      };

      const rows =
        ownerIds.length > 0
          ? chunkValues(ownerIds).flatMap((chunk) => queryRows(chunk))
          : queryRows([]);

      return Array.from(new Set(rows.map((row) => row.activityId))).slice(
        0,
        safeLimit
      );
    },

    async getCallActivityIdsMissingCallStats(
      limit = 20_000,
      activityCreatedFrom = null,
      ownerIds = []
    ) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 20_000;
      const filters = [
        "a.owner_type_id = '2'",
        "a.provider_id = 'VOXIMPLANT_CALL'",
        "c.id IS NULL"
      ];
      const values: Array<string | number> = [];

      if (activityCreatedFrom) {
        filters.push("a.created_time >= ?");
        values.push(activityCreatedFrom);
      }

      const queryRows = (scopedOwnerIds: string[]) => {
        const ownerFilters = [...filters];
        const ownerValues: Array<string | number> = [...values];

        if (scopedOwnerIds.length > 0) {
          const placeholders = scopedOwnerIds.map(() => "?").join(", ");
          ownerFilters.push(`a.owner_id IN (${placeholders})`);
          ownerValues.push(...scopedOwnerIds);
        }

        return database
          .prepare(
            `SELECT DISTINCT a.id AS activityId
            FROM activity_snapshots a
            LEFT JOIN call_snapshots c ON c.crm_activity_id = a.id
            WHERE ${ownerFilters.join(" AND ")}
            ORDER BY a.id ASC
            LIMIT ?`
          )
          .all(...ownerValues, safeLimit) as Array<{ activityId: string }>;
      };

      const rows =
        ownerIds.length > 0
          ? chunkValues(ownerIds).flatMap((chunk) => queryRows(chunk))
          : queryRows([]);

      return Array.from(new Set(rows.map((row) => row.activityId))).slice(
        0,
        safeLimit
      );
    },

    async getCallActivityIdsForCallStatsRefresh(
      limit = 20_000,
      activityCreatedFrom = null,
      ownerIds = []
    ) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 20_000;
      const filters = [
        "owner_type_id = '2'",
        "provider_id = 'VOXIMPLANT_CALL'"
      ];
      const values: Array<string | number> = [];

      if (activityCreatedFrom) {
        filters.push("created_time >= ?");
        values.push(activityCreatedFrom);
      }

      const queryRows = (scopedOwnerIds: string[]) => {
        const ownerFilters = [...filters];
        const ownerValues: Array<string | number> = [...values];

        if (scopedOwnerIds.length > 0) {
          const placeholders = scopedOwnerIds.map(() => "?").join(", ");
          ownerFilters.push(`owner_id IN (${placeholders})`);
          ownerValues.push(...scopedOwnerIds);
        }

        return database
          .prepare(
            `SELECT DISTINCT id AS activityId
            FROM activity_snapshots
            WHERE ${ownerFilters.join(" AND ")}
            ORDER BY id ASC
            LIMIT ?`
          )
          .all(...ownerValues, safeLimit) as Array<{ activityId: string }>;
      };

      const rows =
        ownerIds.length > 0
          ? chunkValues(ownerIds).flatMap((chunk) => queryRows(chunk))
          : queryRows([]);

      return Array.from(new Set(rows.map((row) => row.activityId))).slice(
        0,
        safeLimit
      );
    },

    async getConversionEventVisitIdsMissingStageHistory(limit = 5_000) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 5_000;

      if (safeLimit === 0) {
        return [];
      }

      const rows = database
        .prepare(
          `SELECT v.id AS visitId
          FROM conversion_event_visit_snapshots v
          LEFT JOIN event_visit_stage_history h ON h.visit_id = v.id
          WHERE h.visit_id IS NULL
          ORDER BY CAST(v.id AS INTEGER) ASC, v.id ASC
          LIMIT ?`
        )
        .all(safeLimit) as Array<{ visitId: string }>;

      return rows.map((row) => row.visitId);
    },

    async getConversionEventVisitsByIds(visitIds) {
      const ids = Array.from(new Set(visitIds.map(String).filter(Boolean)));
      if (ids.length === 0) {
        return [];
      }

      const rows = chunkValues(ids).flatMap((chunk) => {
        const placeholders = chunk.map(() => "?").join(", ");
        return database
          .prepare(
            `SELECT
              id,
              event_id AS eventId,
              event_name AS eventName,
              event_date AS eventDate,
              status,
              stage_id AS stageId,
              stage_name AS stageName,
              deal_id AS dealId,
              contact_id AS contactId,
              manager_id AS managerId,
              source_id AS sourceId,
              created_time AS createdTime,
              updated_time AS updatedTime
            FROM conversion_event_visit_snapshots
            WHERE id IN (${placeholders})
            ORDER BY event_date ASC, id ASC`
          )
          .all(...chunk) as ConversionEventVisitSnapshot[];
      });

      const rowById = new Map(rows.map((row) => [row.id, row]));
      return ids.flatMap((id) => {
        const row = rowById.get(id);
        return row ? [row] : [];
      });
    },

    async getConversionEventIdsMissingEventSnapshots(limit = 5_000) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 5_000;

      if (safeLimit === 0) {
        return [];
      }

      const rows = database
        .prepare(
          `SELECT DISTINCT v.event_id AS eventId
          FROM conversion_event_visit_snapshots v
          LEFT JOIN event_snapshots e ON e.event_id = v.event_id
          WHERE v.event_id IS NOT NULL
            AND v.event_id <> ''
            AND e.event_id IS NULL
          ORDER BY CAST(v.event_id AS INTEGER) ASC, v.event_id ASC
          LIMIT ?`
        )
        .all(safeLimit) as Array<{ eventId: string }>;

      return rows.map((row) => row.eventId);
    },

    replaceStageCatalog(rows) {
      const transaction = database.transaction((nextRows: StageCatalogEntry[]) => {
        database.exec("DELETE FROM stage_catalog");
        for (const row of nextRows) {
          replaceStageCatalogStatement.run({
            ...row,
            sortOrder: row.sortOrder ?? null
          });
        }
      });
      transaction(rows);
      return Promise.resolve();
    },

    upsertLeads(rows) {
      const transaction = database.transaction((nextRows: LeadSnapshot[]) => {
        for (const row of nextRows) {
          upsertLeadStatement.run(row);
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertDeals(rows) {
      const transaction = database.transaction((nextRows: DealSnapshot[]) => {
        for (const row of nextRows) {
          upsertDealStatement.run({
            ...row,
            title: row.title ?? null,
            contactId: row.contactId ?? null,
            businessClubValue: row.businessClubValue ?? null,
            targetGroupValue: row.targetGroupValue ?? null,
            meetingTypeValue: row.meetingTypeValue ?? null,
            meetingDateValue: row.meetingDateValue ?? null,
            tariffValue: row.tariffValue ?? null,
            conversionEventValue: row.conversionEventValue ?? null,
            refusalReasonValue: row.refusalReasonValue ?? null,
            refusalReasonDetail: sanitizeRefusalReasonDetail(row.refusalReasonDetail)
          });
          deleteDealMeetingSlotsStatement.run(row.id);

          for (const slot of row.meetingSlots ?? []) {
            upsertDealMeetingSlotStatement.run({
              dealId: row.id,
              slotIndex: slot.index,
              dateValue: slot.dateValue ?? null,
              typeValue: slot.typeValue ?? null,
              placeValue: slot.placeValue ?? null,
              calendarValue: slot.calendarValue ?? null,
              eventId: slot.eventId ?? null,
              source: slot.source,
              updatedAt: row.dateModify
            });
          }
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertStageHistory(rows) {
      const transaction = database.transaction(
        (nextRows: StageHistorySnapshot[]) => {
          for (const row of nextRows) {
            upsertStageHistoryStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertActivities(rows) {
      const transaction = database.transaction((nextRows: ActivitySnapshot[]) => {
        for (const row of nextRows) {
          upsertActivityStatement.run({
            ...row,
            completed: row.completed ? 1 : 0
          });
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertActivityBindings(rows) {
      const transaction = database.transaction(
        (nextRows: ActivityBindingSnapshot[]) => {
          const activityIds = new Set(nextRows.map((row) => row.activityId));
          for (const activityId of activityIds) {
            deleteActivityBindingsStatement.run(activityId);
          }

          for (const row of nextRows) {
            insertActivityBindingStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertActivityDeadlineChanges(rows) {
      const transaction = database.transaction(
        (nextRows: ActivityDeadlineChangeSnapshot[]) => {
          for (const row of nextRows) {
            upsertDeadlineChangeStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertDealMeetingDateChanges(rows) {
      const transaction = database.transaction(
        (nextRows: DealMeetingDateChangeSnapshot[]) => {
          for (const row of nextRows) {
            upsertDealMeetingDateChangeStatement.run({
              ...row,
              slotIndex: row.slotIndex ?? 1
            });
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertConversionEventVisits(rows) {
      const transaction = database.transaction(
        (nextRows: ConversionEventVisitSnapshot[]) => {
          for (const row of nextRows) {
            upsertConversionEventVisitStatement.run({
              ...row,
              eventId: row.eventId ?? null
            });
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    pruneConversionEventSnapshots(input) {
      const scopedDealIds = Array.from(
        new Set(input.scopedDealIds.map(String).filter(Boolean))
      );
      const enabledEventTypeIds = Array.from(
        new Set(input.enabledEventTypeIds.map(String).filter(Boolean))
      );
      const transaction = database.transaction(
        (pruneInput: {
          scopedDealIds: string[];
          enabledEventTypeIds: string[];
        }): PruneConversionEventSnapshotsResult => {
          const dropPruneTables = () => {
            database.exec(`
              DROP TABLE IF EXISTS temp.prune_scoped_deal_ids;
              DROP TABLE IF EXISTS temp.prune_enabled_event_type_ids;
            `);
          };

          dropPruneTables();

          try {
            database.exec(`
              CREATE TEMP TABLE prune_scoped_deal_ids (
                deal_id TEXT PRIMARY KEY
              );
              CREATE TEMP TABLE prune_enabled_event_type_ids (
                event_type_id TEXT PRIMARY KEY
              );
            `);

            const insertScopedDeal = database.prepare(
              `INSERT OR IGNORE INTO prune_scoped_deal_ids (deal_id) VALUES (?)`
            );
            const insertEnabledEventType = database.prepare(
              `INSERT OR IGNORE INTO prune_enabled_event_type_ids (event_type_id)
              VALUES (?)`
            );

            for (const dealId of pruneInput.scopedDealIds) {
              insertScopedDeal.run(dealId);
            }
            for (const eventTypeId of pruneInput.enabledEventTypeIds) {
              insertEnabledEventType.run(eventTypeId);
            }

            const conversionEventVisits = database
              .prepare(
                `DELETE FROM conversion_event_visit_snapshots
                WHERE deal_id IS NULL
                  OR deal_id = ''
                  OR NOT EXISTS (
                    SELECT 1
                    FROM prune_scoped_deal_ids scoped
                    WHERE scoped.deal_id = conversion_event_visit_snapshots.deal_id
                  )
                `
              )
              .run().changes;
            const eventVisitStageHistory = database
              .prepare(
                `DELETE FROM event_visit_stage_history
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM conversion_event_visit_snapshots visits
                  WHERE visits.id = event_visit_stage_history.visit_id
                )`
              )
              .run().changes;
            const eventVisitFacts = database
              .prepare(
                `DELETE FROM event_visit_facts
                WHERE link_reason = 'contact_single_deal_fallback'
                  OR deal_id IS NULL
                  OR deal_id = ''
                  OR NOT EXISTS (
                    SELECT 1
                    FROM prune_scoped_deal_ids scoped
                    WHERE scoped.deal_id = event_visit_facts.deal_id
                  )
                `
              )
              .run().changes;
            const dealTouchpointFacts = database
              .prepare(
                `DELETE FROM deal_touchpoint_facts
                WHERE kind = 'conversion_event_visit'
                  AND (
                    link_reason = 'contact_single_deal_fallback'
                    OR deal_id IS NULL
                    OR deal_id = ''
                    OR NOT EXISTS (
                      SELECT 1
                      FROM prune_scoped_deal_ids scoped
                      WHERE scoped.deal_id = deal_touchpoint_facts.deal_id
                    )
                  )`
              )
              .run().changes;
            const eventSnapshots =
              pruneInput.enabledEventTypeIds.length > 0
                ? database
                    .prepare(
                      `DELETE FROM event_snapshots
                      WHERE NOT (
                        (
                          event_type_id IS NOT NULL
                          AND event_type_id <> ''
                          AND EXISTS (
                            SELECT 1
                            FROM prune_enabled_event_type_ids enabled
                            WHERE enabled.event_type_id = event_snapshots.event_type_id
                          )
                        )
                        OR EXISTS (
                          SELECT 1
                          FROM conversion_event_visit_snapshots visits
                          WHERE visits.event_id = event_snapshots.event_id
                        )
                        OR EXISTS (
                          SELECT 1
                          FROM event_visit_facts facts
                          WHERE facts.event_id = event_snapshots.event_id
                        )
                      )`
                    )
                    .run().changes
                : 0;

            return {
              conversionEventVisits,
              eventVisitStageHistory,
              eventVisitFacts,
              dealTouchpointFacts,
              eventSnapshots
            };
          } finally {
            dropPruneTables();
          }
        }
      );

      return Promise.resolve(
        transaction({
          scopedDealIds,
          enabledEventTypeIds
        })
      );
    },

    upsertIdentityLinks(rows) {
      const transaction = database.transaction(
        (nextRows: IdentityLinkSnapshot[]) => {
          for (const row of nextRows) {
            upsertIdentityLinkStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertDealStageFacts(rows) {
      const transaction = database.transaction(
        (nextRows: DealStageFactSnapshot[]) => {
          for (const row of nextRows) {
            upsertDealStageFactStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertDealTouchpointFacts(rows) {
      const transaction = database.transaction(
        (nextRows: DealTouchpointFactSnapshot[]) => {
          for (const row of nextRows) {
            upsertDealTouchpointFactStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    replaceAnalyticsFacts(factsInput) {
      const transaction = database.transaction(
        (payload: {
          identityLinks: IdentityLinkSnapshot[];
          dealStageFacts: DealStageFactSnapshot[];
          dealTouchpointFacts: DealTouchpointFactSnapshot[];
          eventVisitFacts?: EventVisitFactSnapshot[];
        }) => {
          if (payload.eventVisitFacts) {
            deleteEventVisitFactsStatement.run();
          }
          deleteDealTouchpointFactsStatement.run();
          deleteDealStageFactsStatement.run();
          deleteIdentityLinksStatement.run();

          for (const row of payload.identityLinks) {
            upsertIdentityLinkStatement.run(row);
          }
          for (const row of payload.dealStageFacts) {
            upsertDealStageFactStatement.run(row);
          }
          for (const row of payload.dealTouchpointFacts) {
            upsertDealTouchpointFactStatement.run(row);
          }
          for (const row of payload.eventVisitFacts ?? []) {
            upsertEventVisitFactStatement.run(row);
          }
        }
      );
      transaction(factsInput);
      return Promise.resolve({
        identityLinks: factsInput.identityLinks.length,
        dealStageFacts: factsInput.dealStageFacts.length,
        dealTouchpointFacts: factsInput.dealTouchpointFacts.length,
        ...(factsInput.eventVisitFacts
          ? { eventVisitFacts: factsInput.eventVisitFacts.length }
          : {})
      });
    },

    upsertEventSnapshots(rows) {
      const transaction = database.transaction((nextRows: EventSnapshot[]) => {
        for (const row of nextRows) {
          upsertEventSnapshotStatement.run(row);
          reconcileConversionEventVisitDateStatement.run(row);
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertEventVisitFacts(rows) {
      const transaction = database.transaction(
        (nextRows: EventVisitFactSnapshot[]) => {
          for (const row of nextRows) {
            upsertEventVisitFactStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    replaceEventVisitFacts(rows) {
      const transaction = database.transaction(
        (nextRows: EventVisitFactSnapshot[]) => {
          deleteEventVisitFactsStatement.run();
          for (const row of nextRows) {
            upsertEventVisitFactStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertEventVisitStageHistory(rows) {
      const transaction = database.transaction(
        (nextRows: EventVisitStageHistorySnapshot[]) => {
          for (const row of nextRows) {
            upsertEventVisitStageHistoryStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    replaceModuleEventTypeSettings(inputRow) {
      const transaction = database.transaction(
        (nextRows: ModuleEventTypeSetting[]) => {
          deleteModuleEventTypeSettingsStatement.run(inputRow.moduleKey);
          for (const row of nextRows) {
            upsertModuleEventTypeSettingStatement.run({
              ...row,
              enabled: row.enabled ? 1 : 0
            });
          }
        }
      );
      transaction(inputRow.rows);
      return Promise.resolve(inputRow.rows.length);
    },

    async getManagerWhitelistSettings(moduleKey) {
      const rows = database
        .prepare(
          `SELECT
            module_key AS moduleKey,
            manager_id AS managerId,
            manager_name AS managerName,
            team_id AS teamId,
            team_name AS teamName,
            enabled,
            sort_order AS sortOrder,
            updated_at AS updatedAt
          FROM module_manager_whitelist_settings
          WHERE module_key = ?
          ORDER BY sort_order ASC, manager_name ASC, manager_id ASC`
        )
        .all(moduleKey) as Array<
        Omit<ManagerWhitelistSetting, "enabled"> & {
          enabled: number;
        }
      >;

      return rows.map((row) => ({
        ...row,
        enabled: Boolean(row.enabled)
      }));
    },

    async replaceManagerWhitelistSettings(inputSettings) {
      const existingDirectory = new Map(
        (
          database
            .prepare(
              `SELECT
                id,
                name
              FROM manager_directory`
            )
            .all() as ManagerDirectoryEntry[]
        ).map((manager) => [manager.id, manager.name])
      );
      const seededDirectory = new Map(
        ATTRACTION_MANAGER_CATALOG.map((manager) => [manager.id, manager.name])
      );
      const managerIds = Array.from(
        new Set(inputSettings.managerIds.map(String).map((id) => id.trim()).filter(Boolean))
      );
      const teamByManagerId = new Map<
        string,
        { teamId: string | null; teamName: string | null }
      >();
      for (const team of inputSettings.teams ?? []) {
        const teamName = team.name.trim();
        if (!teamName) {
          continue;
        }
        const teamId = (team.id?.trim() || teamName).trim();
        for (const managerId of team.managerIds) {
          const normalizedManagerId = String(managerId).trim();
          if (normalizedManagerId && managerIds.includes(normalizedManagerId)) {
            teamByManagerId.set(normalizedManagerId, {
              teamId,
              teamName
            });
          }
        }
      }
      const rows: ManagerWhitelistSetting[] = managerIds.map((managerId, index) => ({
        moduleKey: inputSettings.moduleKey,
        managerId,
        managerName:
          seededDirectory.get(managerId) ?? existingDirectory.get(managerId) ?? managerId,
        teamId: teamByManagerId.get(managerId)?.teamId ?? null,
        teamName: teamByManagerId.get(managerId)?.teamName ?? null,
        enabled: true,
        sortOrder: index * 10,
        updatedAt: inputSettings.updatedAt
      }));
      const transaction = database.transaction((nextRows: ManagerWhitelistSetting[]) => {
        deleteManagerWhitelistSettingsStatement.run(inputSettings.moduleKey);
        for (const row of nextRows) {
          upsertManagerWhitelistSettingStatement.run({
            ...row,
            enabled: row.enabled ? 1 : 0
          });
        }
      });
      transaction(rows);
      return rows;
    },

    replaceConversionEventTypeOptions(rows) {
      const transaction = database.transaction(
        (nextRows: ConversionEventTypeOption[]) => {
          deleteConversionEventTypeOptionsStatement.run();
          const updatedAt = new Date().toISOString();
          for (const row of nextRows) {
            upsertConversionEventTypeOptionStatement.run({
              ...row,
              selectedForPlannedInventory: row.selectedForPlannedInventory ? 1 : 0,
              updatedAt
            });
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertCalls(rows) {
      const transaction = database.transaction((nextRows: CallSnapshot[]) => {
        for (const row of nextRows) {
          upsertCallStatement.run(row);
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertManagerDirectory(rows) {
      const transaction = database.transaction(
        (nextRows: ManagerDirectoryEntry[]) => {
          for (const row of nextRows) {
            upsertManagerDirectoryStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    markOperationalHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "operational_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markCallHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run("call_history_bootstrapped_at", timestamp);
      return Promise.resolve();
    },

    markCallActivityHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "call_activity_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markMeetingActivityHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "meeting_activity_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markTaskActivityHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "task_activity_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markDealCustomFieldsBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "deal_custom_fields_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markDealMeetingDateFieldBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "deal_meeting_date_field_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    async createSyncRun(inputRow) {
      const startedAt = inputRow?.startedAt ?? new Date().toISOString();
      const mode = inputRow?.mode ?? "full";
      const modifiedAfter = inputRow?.modifiedAfter ?? null;
      const scopeKey = inputRow?.scopeKey ?? null;
      const result = database
        .prepare(`
          INSERT INTO sync_runs (started_at, status, mode, modified_after, scope_key)
          VALUES (?, 'running', ?, ?, ?)
        `)
        .run(startedAt, mode, modifiedAfter, scopeKey);
      return Number(result.lastInsertRowid);
    },

    async recoverStaleSyncRuns(inputRow) {
      const failedAt = inputRow.failedAt ?? new Date().toISOString();
      const result = database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?,
              status = 'failed',
              diagnostics_json = ?
          WHERE status = 'running' AND started_at < ?
        `)
        .run(
          failedAt,
          JSON.stringify(inputRow.diagnostics ?? ["SYNC_FAILED", "error=STALE_RUNNING_SYNC"]),
          inputRow.staleBefore
        );
      return result.changes;
    },

    finishSyncRun(inputRow) {
      database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?,
              status = ?,
              leads_synced = ?,
              deals_synced = ?,
              deal_breakdown_json = ?,
              diagnostics_json = ?,
              modified_after = ?
          WHERE id = ?
        `)
        .run(
          inputRow.finishedAt,
          inputRow.status,
          inputRow.leadsSynced,
          inputRow.dealsSynced,
          JSON.stringify(
            inputRow.dealBreakdown ??
              buildLegacyDealBreakdown(inputRow.dealsSynced)
          ),
          JSON.stringify(inputRow.diagnostics ?? []),
          inputRow.modifiedAfter,
          inputRow.syncRunId
        );
      return Promise.resolve();
    },

    failSyncRun(inputRow) {
      database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?, status = ?, diagnostics_json = ?
          WHERE id = ?
        `)
        .run(
          inputRow.finishedAt,
          inputRow.status,
          JSON.stringify(inputRow.diagnostics ?? []),
          inputRow.syncRunId
        );
      return Promise.resolve();
    },

    async listSyncRuns(inputRow = {}) {
      const safeLimit = Math.max(
        1,
        Math.min(
          100,
          Number.isFinite(inputRow.limit) ? Math.trunc(inputRow.limit ?? 5) : 5
        )
      );
      const scopeKey = inputRow.scopeKey?.trim() || null;
      const scopeClause = scopeKey
        ? "WHERE scope_key = ? OR scope_key LIKE ?"
        : "";
      const values: Array<string | number> = scopeKey
        ? [scopeKey, `${scopeKey}:assigned:%`, safeLimit]
        : [safeLimit];
      const rows = database
        .prepare(
          `SELECT
            id,
            started_at AS startedAt,
            finished_at AS finishedAt,
            status,
            mode,
            modified_after AS modifiedAfter,
            scope_key AS scopeKey,
            leads_synced AS leadsSynced,
            deals_synced AS dealsSynced,
            deal_breakdown_json AS dealBreakdownJson,
            diagnostics_json AS diagnosticsJson
          FROM sync_runs
          ${scopeClause}
          ORDER BY id DESC
          LIMIT ?`
        )
        .all(...values) as Array<{
        id: number;
        startedAt: string;
        finishedAt: string | null;
        status: string;
        mode: string;
        modifiedAfter: string | null;
        scopeKey: string | null;
        leadsSynced: number | null;
        dealsSynced: number | null;
        dealBreakdownJson: string | null;
        diagnosticsJson: string | null;
      }>;

      return rows.map((row) => {
        const dealsSynced = Number(row.dealsSynced ?? 0);

        return {
          id: Number(row.id),
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          durationMs: calculateSyncRunDurationMs({
            startedAt: row.startedAt,
            finishedAt: row.finishedAt
          }),
          status: normalizeSyncRunStatus(row.status),
          mode: normalizeSyncRunMode(row.mode),
          modifiedAfter: row.modifiedAfter,
          scopeKey: row.scopeKey,
          leadsSynced: Number(row.leadsSynced ?? 0),
          dealsSynced,
          dealBreakdown: parseDealBreakdown(row.dealBreakdownJson, dealsSynced),
          diagnostics: parseDiagnostics(row.diagnosticsJson)
        };
      });
    },

    async getAllLeads() {
      return database
        .prepare(
          `SELECT
            id,
            status_id AS statusId,
            source_id AS sourceId,
            opportunity,
            assigned_by_id AS assignedById,
            date_create AS dateCreate,
            date_modify AS dateModify,
            utm_source AS utmSource,
            utm_medium AS utmMedium,
            utm_campaign AS utmCampaign,
            utm_content AS utmContent,
            utm_term AS utmTerm
          FROM lead_snapshots
          ORDER BY id ASC`
        )
        .all() as LeadSnapshot[];
    },

    async getAllDeals() {
      const deals = database
        .prepare(
          `SELECT
            id,
            title,
            contact_id AS contactId,
            lead_id AS leadId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_semantic_id AS stageSemanticId,
            opportunity,
            assigned_by_id AS assignedById,
            source_id AS sourceId,
            quality_value AS qualityValue,
            business_club_value AS businessClubValue,
            target_group_value AS targetGroupValue,
            meeting_type_value AS meetingTypeValue,
            meeting_date_value AS meetingDateValue,
            tariff_value AS tariffValue,
            conversion_event_value AS conversionEventValue,
            refusal_reason_value AS refusalReasonValue,
            refusal_reason_detail AS refusalReasonDetail,
            date_create AS dateCreate,
            date_modify AS dateModify,
            date_closed AS dateClosed,
            utm_source AS utmSource,
            utm_medium AS utmMedium,
            utm_campaign AS utmCampaign,
            utm_content AS utmContent,
            utm_term AS utmTerm
          FROM deal_snapshots
          ORDER BY id ASC`
        )
        .all() as DealSnapshot[];
      return hydrateDealMeetingSlots(deals);
    },

    async getAllStageHistory() {
      return database
        .prepare(
          `SELECT
            id,
            owner_id AS ownerId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_semantic_id AS stageSemanticId,
            type_id AS typeId,
            created_time AS createdTime
          FROM stage_history_snapshots
          ORDER BY created_time ASC, id ASC`
        )
        .all() as StageHistorySnapshot[];
    },

    async getStageHistoryByOwnerIds(ownerIds) {
      if (ownerIds.length === 0) {
        return [];
      }

      return chunkValues(Array.from(new Set(ownerIds)))
        .flatMap((chunk) => {
          const placeholders = chunk.map(() => "?").join(", ");
          return database
            .prepare(
              `SELECT
                id,
                owner_id AS ownerId,
                category_id AS categoryId,
                stage_id AS stageId,
                stage_semantic_id AS stageSemanticId,
                type_id AS typeId,
                created_time AS createdTime
              FROM stage_history_snapshots
              WHERE owner_id IN (${placeholders})
              ORDER BY created_time ASC, id ASC`
            )
            .all(...chunk) as StageHistorySnapshot[];
        })
        .sort((left, right) => {
          const byTime = left.createdTime.localeCompare(right.createdTime);
          return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
        });
    },

    async getAllActivities() {
      const rows = database
        .prepare(
          `SELECT
            id,
            owner_type_id AS ownerTypeId,
            owner_id AS ownerId,
            type_id AS typeId,
            provider_id AS providerId,
            responsible_id AS responsibleId,
            created_time AS createdTime,
            deadline,
            last_updated AS lastUpdated,
            completed,
            completed_time AS completedTime
          FROM activity_snapshots
          ORDER BY id ASC`
        )
        .all() as Array<
        Omit<ActivitySnapshot, "completed"> & {
          completed: number;
        }
      >;

      return mapActivityRows(rows);
    },

    async getAllActivityBindings() {
      return database
        .prepare(
          `SELECT
            activity_id AS activityId,
            owner_type_id AS ownerTypeId,
            owner_id AS ownerId
          FROM activity_binding_snapshots
          ORDER BY activity_id ASC, owner_type_id ASC, owner_id ASC`
        )
        .all() as ActivityBindingSnapshot[];
    },

    async getActivityBindingsByActivityIds(activityIds) {
      if (activityIds.length === 0) {
        return [];
      }

      return chunkValues(Array.from(new Set(activityIds))).flatMap((chunk) => {
        const placeholders = chunk.map(() => "?").join(", ");
        return database
          .prepare(
            `SELECT
              activity_id AS activityId,
              owner_type_id AS ownerTypeId,
              owner_id AS ownerId
            FROM activity_binding_snapshots
            WHERE activity_id IN (${placeholders})
            ORDER BY activity_id ASC, owner_type_id ASC, owner_id ASC`
          )
          .all(...chunk) as ActivityBindingSnapshot[];
      });
    },

    async getAllActivityDeadlineChanges() {
      return database
        .prepare(
          `SELECT
            id,
            activity_id AS activityId,
            owner_id AS ownerId,
            responsible_id AS responsibleId,
            previous_deadline AS previousDeadline,
            next_deadline AS nextDeadline,
            changed_at AS changedAt
          FROM activity_deadline_changes
          ORDER BY changed_at ASC, id ASC`
        )
        .all() as ActivityDeadlineChangeSnapshot[];
    },

    async getAllDealMeetingDateChanges() {
      return database
        .prepare(
          `SELECT
            id,
            deal_id AS dealId,
            slot_index AS slotIndex,
            assigned_by_id AS assignedById,
            previous_meeting_date AS previousMeetingDate,
            next_meeting_date AS nextMeetingDate,
            changed_at AS changedAt
          FROM deal_meeting_date_changes
          ORDER BY changed_at ASC, id ASC`
        )
        .all() as DealMeetingDateChangeSnapshot[];
    },

    async getAllConversionEventVisits() {
      return database
        .prepare(
          `SELECT
            id,
            event_id AS eventId,
            event_name AS eventName,
            event_date AS eventDate,
            status,
            stage_id AS stageId,
            stage_name AS stageName,
            deal_id AS dealId,
            contact_id AS contactId,
            manager_id AS managerId,
            source_id AS sourceId,
            created_time AS createdTime,
            updated_time AS updatedTime
          FROM conversion_event_visit_snapshots
          ORDER BY event_date ASC, id ASC`
        )
        .all() as ConversionEventVisitSnapshot[];
    },

    async getAllIdentityLinks() {
      return database
        .prepare(
          `SELECT
            identity_id AS identityId,
            module_key AS moduleKey,
            deal_id AS dealId,
            lead_id AS leadId,
            contact_id AS contactId,
            deal_category_id AS dealCategoryId,
            lead_category_id AS leadCategoryId,
            current_manager_id AS currentManagerId,
            current_stage_id AS currentStageId,
            source_id AS sourceId,
            created_at AS createdAt,
            updated_at AS updatedAt,
            link_confidence AS linkConfidence,
            link_reason AS linkReason
          FROM identity_links
          ORDER BY identity_id ASC`
        )
        .all() as IdentityLinkSnapshot[];
    },

    async getAllDealStageFacts() {
      return database
        .prepare(
          `SELECT
            fact_id AS factId,
            source_system AS sourceSystem,
            source_entity_id AS sourceEntityId,
            deal_id AS dealId,
            contact_id AS contactId,
            lead_id AS leadId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_name AS stageName,
            stage_semantic_id AS stageSemanticId,
            entered_at AS enteredAt,
            left_at AS leftAt,
            manager_id AS managerId,
            source_id AS sourceId,
            sort_order AS sortOrder,
            payload_json AS payloadJson
          FROM deal_stage_facts
          ORDER BY deal_id ASC, entered_at ASC, fact_id ASC`
        )
        .all() as DealStageFactSnapshot[];
    },

    async getDealStageFactsByDealIds(dealIds) {
      if (dealIds.length === 0) {
        return [];
      }

      return chunkValues(Array.from(new Set(dealIds)))
        .flatMap((chunk) => {
          const placeholders = chunk.map(() => "?").join(", ");
          return database
            .prepare(
              `SELECT
                fact_id AS factId,
                source_system AS sourceSystem,
                source_entity_id AS sourceEntityId,
                deal_id AS dealId,
                contact_id AS contactId,
                lead_id AS leadId,
                category_id AS categoryId,
                stage_id AS stageId,
                stage_name AS stageName,
                stage_semantic_id AS stageSemanticId,
                entered_at AS enteredAt,
                left_at AS leftAt,
                manager_id AS managerId,
                source_id AS sourceId,
                sort_order AS sortOrder,
                payload_json AS payloadJson
              FROM deal_stage_facts
              WHERE deal_id IN (${placeholders})
              ORDER BY deal_id ASC, entered_at ASC, fact_id ASC`
            )
            .all(...chunk) as DealStageFactSnapshot[];
        })
        .sort((left, right) => {
          const byDeal = left.dealId.localeCompare(right.dealId);
          if (byDeal !== 0) {
            return byDeal;
          }

          const byEntered = left.enteredAt.localeCompare(right.enteredAt);
          return byEntered !== 0 ? byEntered : left.factId.localeCompare(right.factId);
        });
    },

    async getAllDealTouchpointFacts() {
      return database
        .prepare(
          `SELECT
            fact_id AS factId,
            kind,
            source_system AS sourceSystem,
            source_entity_type AS sourceEntityType,
            source_entity_id AS sourceEntityId,
            occurred_at AS occurredAt,
            deal_id AS dealId,
            contact_id AS contactId,
            lead_id AS leadId,
            manager_id AS managerId,
            source_id AS sourceId,
            stage_id_at_event AS stageIdAtEvent,
            stage_name_at_event AS stageNameAtEvent,
            link_confidence AS linkConfidence,
            link_reason AS linkReason,
            payload_json AS payloadJson
          FROM deal_touchpoint_facts
          ORDER BY occurred_at ASC, fact_id ASC`
        )
        .all() as DealTouchpointFactSnapshot[];
    },

    async getDealTouchpointFactsByDealIds(dealIds) {
      if (dealIds.length === 0) {
        return [];
      }

      return chunkValues(Array.from(new Set(dealIds)))
        .flatMap((chunk) => {
          const placeholders = chunk.map(() => "?").join(", ");
          return database
            .prepare(
              `SELECT
                fact_id AS factId,
                kind,
                source_system AS sourceSystem,
                source_entity_type AS sourceEntityType,
                source_entity_id AS sourceEntityId,
                occurred_at AS occurredAt,
                deal_id AS dealId,
                contact_id AS contactId,
                lead_id AS leadId,
                manager_id AS managerId,
                source_id AS sourceId,
                stage_id_at_event AS stageIdAtEvent,
                stage_name_at_event AS stageNameAtEvent,
                link_confidence AS linkConfidence,
                link_reason AS linkReason,
                payload_json AS payloadJson
              FROM deal_touchpoint_facts
              WHERE deal_id IN (${placeholders})
              ORDER BY occurred_at ASC, fact_id ASC`
            )
            .all(...chunk) as DealTouchpointFactSnapshot[];
        })
        .sort((left, right) => {
          const byTime = left.occurredAt.localeCompare(right.occurredAt);
          return byTime !== 0 ? byTime : left.factId.localeCompare(right.factId);
        });
    },

    async getAllEventSnapshots() {
      return database
        .prepare(
          `SELECT
            event_id AS eventId,
            entity_type_id AS entityTypeId,
            category_id AS categoryId,
            title,
            event_date AS eventDate,
            start_at AS startAt,
            end_at AS endAt,
            stage_id AS stageId,
            stage_name AS stageName,
            status,
            event_type_id AS eventTypeId,
            event_type_label AS eventTypeLabel,
            format_id AS formatId,
            created_time AS createdTime,
            updated_time AS updatedTime
          FROM event_snapshots
          ORDER BY event_date ASC, event_id ASC`
        )
        .all() as EventSnapshot[];
    },

    async getAllEventVisitFacts() {
      return database
        .prepare(
          `SELECT
            visit_id AS visitId,
            event_id AS eventId,
            deal_id AS dealId,
            contact_id AS contactId,
            lead_id AS leadId,
            manager_id AS managerId,
            source_id AS sourceId,
            current_stage_id AS currentStageId,
            current_stage_name AS currentStageName,
            invited_at AS invitedAt,
            confirmed_at AS confirmedAt,
            attended_at AS attendedAt,
            refused_at AS refusedAt,
            final_status AS finalStatus,
            event_date AS eventDate,
            stage_id_at_event AS stageIdAtEvent,
            link_confidence AS linkConfidence,
            link_reason AS linkReason,
            payload_json AS payloadJson
          FROM event_visit_facts
          ORDER BY event_date ASC, visit_id ASC`
        )
        .all() as EventVisitFactSnapshot[];
    },

    async getEventVisitFactsByDealIds(dealIds) {
      if (dealIds.length === 0) {
        return [];
      }

      return chunkValues(Array.from(new Set(dealIds)))
        .flatMap((chunk) => {
          const placeholders = chunk.map(() => "?").join(", ");
          return database
            .prepare(
              `SELECT
                visit_id AS visitId,
                event_id AS eventId,
                deal_id AS dealId,
                contact_id AS contactId,
                lead_id AS leadId,
                manager_id AS managerId,
                source_id AS sourceId,
                current_stage_id AS currentStageId,
                current_stage_name AS currentStageName,
                invited_at AS invitedAt,
                confirmed_at AS confirmedAt,
                attended_at AS attendedAt,
                refused_at AS refusedAt,
                final_status AS finalStatus,
                event_date AS eventDate,
                stage_id_at_event AS stageIdAtEvent,
                link_confidence AS linkConfidence,
                link_reason AS linkReason,
                payload_json AS payloadJson
              FROM event_visit_facts
              WHERE deal_id IN (${placeholders})
              ORDER BY event_date ASC, visit_id ASC`
            )
            .all(...chunk) as EventVisitFactSnapshot[];
	        })
	        .sort((left, right) => {
	          const byDate = (left.eventDate ?? "").localeCompare(right.eventDate ?? "");
	          return byDate !== 0 ? byDate : left.visitId.localeCompare(right.visitId);
	        });
	    },

    async getAllEventVisitStageHistory() {
      return database
        .prepare(
          `SELECT
            history_id AS historyId,
            visit_id AS visitId,
            entity_type_id AS entityTypeId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_name AS stageName,
            type_id AS typeId,
            changed_at AS changedAt
          FROM event_visit_stage_history
          ORDER BY visit_id ASC, changed_at ASC, history_id ASC`
        )
        .all() as EventVisitStageHistorySnapshot[];
    },

    async getModuleEventTypeSettings(moduleKey) {
      const rows = database
        .prepare(
          `SELECT
            module_key AS moduleKey,
            event_type_id AS eventTypeId,
            event_type_label AS eventTypeLabel,
            enabled,
            updated_at AS updatedAt
          FROM module_event_type_settings
          WHERE (? IS NULL OR module_key = ?)
          ORDER BY module_key ASC, event_type_label ASC, event_type_id ASC`
        )
        .all(moduleKey ?? null, moduleKey ?? null) as Array<
        Omit<ModuleEventTypeSetting, "enabled"> & {
          enabled: number;
        }
      >;

      return rows.map((row) => ({
        ...row,
        enabled: Boolean(row.enabled)
      }));
    },

    async getConversionEventTypeOptions() {
      const rows = database
        .prepare(
          `SELECT
            id,
            title,
            category_id AS categoryId,
            stage_id AS stageId,
            selected_for_planned_inventory AS selectedForPlannedInventory
          FROM conversion_event_type_options
          ORDER BY title ASC, id ASC`
        )
        .all() as Array<
        Omit<ConversionEventTypeOption, "selectedForPlannedInventory"> & {
          selectedForPlannedInventory: number;
        }
      >;

      return rows.map((row) => ({
        ...row,
        selectedForPlannedInventory: Boolean(row.selectedForPlannedInventory)
      }));
    },

    async getAllCalls() {
      return database
        .prepare(
          `SELECT
            id,
            crm_activity_id AS crmActivityId,
            portal_user_id AS portalUserId,
            call_type AS callType,
            call_start_date AS callStartDate,
            call_duration_seconds AS callDurationSeconds,
            crm_entity_type AS crmEntityType,
            crm_entity_id AS crmEntityId,
            call_failed_code AS callFailedCode
          FROM call_snapshots
          ORDER BY call_start_date ASC, id ASC`
        )
        .all() as CallSnapshot[];
    },

    async getManagerDirectory() {
      return database
        .prepare(
          `SELECT
            id,
            name
          FROM manager_directory
          ORDER BY name ASC, id ASC`
        )
        .all() as ManagerDirectoryEntry[];
    },

    async getStageCatalog() {
      return database
        .prepare(
          `SELECT
            entity_type AS entityType,
            category_id AS categoryId,
            status_id AS statusId,
            name,
            semantic_id AS semanticId,
            sort_order AS sortOrder
          FROM stage_catalog
          ORDER BY entity_type ASC, category_id ASC, sort_order ASC, status_id ASC`
        )
        .all() as StageCatalogEntry[];
    },

    async getSalesPlanRows(periodStart, periodEnd) {
      return database
        .prepare(
          `SELECT
            period_start AS periodStart,
            period_end AS periodEnd,
            manager_id AS managerId,
            manager_name AS managerName,
            target_group_key AS targetGroupKey,
            target_group_label AS targetGroupLabel,
            planned_deals AS plannedDeals,
            planned_amount AS plannedAmount,
            updated_at AS updatedAt
          FROM sales_plan_rows
          WHERE period_start = ? AND period_end = ?
          ORDER BY manager_id ASC, target_group_label ASC, target_group_key ASC`
        )
        .all(periodStart, periodEnd) as SalesPlanRow[];
    },

    async replaceSalesPlanRows(input) {
      replaceSalesPlanRowsTransaction(input);
      return this.getSalesPlanRows(input.periodStart, input.periodEnd);
    },

    async replaceSalesPlanPeriods(input) {
      replaceSalesPlanPeriodsTransaction(input);
    },

    async getPricingRules() {
      const rows = database
        .prepare(
          `SELECT
            id,
            customer_label AS customerLabel,
            tariff_label AS tariffLabel,
            attraction_revenue_amount AS attractionRevenueAmount,
            enabled,
            sort_order AS sortOrder,
            updated_at AS updatedAt
          FROM pricing_rules
          ORDER BY sort_order ASC, id ASC`
        )
        .all() as Array<Omit<DealPricingRule, "enabled"> & { enabled: number }>;

      return rows.map((row) => ({
        ...row,
        enabled: Boolean(row.enabled)
      }));
    },

    async replacePricingRules(input) {
      replacePricingRulesTransaction(input);
      return this.getPricingRules();
    },

    async getOperationalThresholdSettings() {
      const row = database
        .prepare(
          `SELECT
            payload_json AS payloadJson,
            updated_at AS updatedAt
          FROM operational_threshold_settings
          WHERE key = ?`
        )
        .get(OPERATIONAL_THRESHOLD_SETTINGS_KEY) as
        | {
            payloadJson: string;
            updatedAt: string | null;
          }
        | undefined;

      return hydrateOperationalThresholdSettings({
        payloadJson: row?.payloadJson ?? null,
        updatedAt: row?.updatedAt ?? null
      });
    },

    async replaceOperationalThresholdSettings(input) {
      replaceOperationalThresholdSettingsTransaction(input);
      return this.getOperationalThresholdSettings();
    },

    async getUnitEconomicsCostArticles() {
      const rows = database
        .prepare(
          `SELECT
            id,
            name,
            pnl_level AS pnlLevel,
            cost_behavior AS costBehavior,
            calculation_method AS calculationMethod,
            enabled,
            sort_order AS sortOrder,
            effective_from AS effectiveFrom,
            effective_to AS effectiveTo,
            updated_at AS updatedAt
          FROM unit_economics_cost_articles
          ORDER BY sort_order ASC, id ASC`
        )
        .all() as Array<
        Omit<UnitEconomicsCostArticle, "enabled"> & { enabled: number }
      >;

      return rows.map((row) => ({
        ...row,
        enabled: Boolean(row.enabled)
      }));
    },

    async getUnitEconomicsCostRules() {
      const rows = database
        .prepare(
          `SELECT
            id,
            article_id AS articleId,
            pnl_level AS pnlLevel,
            cost_behavior AS costBehavior,
            calculation_method AS calculationMethod,
            unit_price AS unitPrice,
            percent,
            amount,
            source_key AS sourceKey,
            quality_value AS qualityValue,
            event_name_pattern AS eventNamePattern,
            enabled,
            effective_from AS effectiveFrom,
            effective_to AS effectiveTo,
            sort_order AS sortOrder
          FROM unit_economics_cost_rules
          ORDER BY sort_order ASC, id ASC`
        )
        .all() as Array<
        Omit<UnitEconomicsCostRule, "enabled"> & { enabled: number }
      >;

      return rows.map((row) => ({
        ...row,
        enabled: Boolean(row.enabled)
      }));
    },

    async getUnitEconomicsEventParticipantMode() {
      const row = database
        .prepare(
          `SELECT event_participant_mode AS eventParticipantMode
          FROM unit_economics_settings
          WHERE id = 1`
        )
        .get() as { eventParticipantMode: string } | undefined;

      return row?.eventParticipantMode === "attended" ? "attended" : "invited";
    },

    async replaceUnitEconomicsCostRules(input) {
      replaceUnitEconomicsCostRulesTransaction(input);
      return this.getUnitEconomicsCostRules();
    },

    async getUnitEconomicsCostFacts(query = {}) {
      const hasRange = Boolean(query.periodStart && query.periodEnd);
      const sql = `SELECT
          id,
          article_id AS articleId,
          pnl_level AS pnlLevel,
          cost_behavior AS costBehavior,
          calculation_method AS calculationMethod,
          period_start AS periodStart,
          period_end AS periodEnd,
          amount,
          currency,
          quantity,
          source_system AS sourceSystem,
          source_reference AS sourceReference,
          confidence,
          status,
          comment
        FROM unit_economics_cost_facts
        ${
          hasRange
            ? "WHERE period_start <= @periodEnd AND period_end >= @periodStart"
            : ""
        }
        ORDER BY period_start ASC, article_id ASC, id ASC`;

      return database.prepare(sql).all({
        periodStart: query.periodStart ?? null,
        periodEnd: query.periodEnd ?? null
      }) as UnitEconomicsCostFact[];
    },

    async upsertUnitEconomicsCostFacts(rows) {
      upsertUnitEconomicsCostFactsTransaction(rows);
      return rows.length;
    },

    ...commentRepositoryMethods,

    async getWonStageIds() {
      const rows = database
        .prepare(
          "SELECT stage_id AS stageId FROM won_stage_config WHERE enabled = 1 ORDER BY stage_id"
        )
        .all() as Array<{ stageId: string }>;
      return rows.map((row) => row.stageId);
    },

    async setWonStageIds(stageIds) {
      const transaction = database.transaction((nextStageIds: string[]) => {
        database.exec("DELETE FROM won_stage_config");
        const insertStatement = database.prepare(`
          INSERT INTO won_stage_config (stage_id, enabled)
          VALUES (?, 1)
        `);
        for (const stageId of nextStageIds) {
          insertStatement.run(stageId);
        }
      });
      transaction(stageIds);
    },

    async getLastSyncSummary(scopeKey) {
      const scopeClause = scopeKey ? "AND scope_key = ?" : "";
      const values = scopeKey ? [scopeKey] : [];
      const row = database
        .prepare(`
          SELECT
            finished_at AS finishedAt,
            leads_synced AS leadsSynced,
            deals_synced AS dealsSynced,
            deal_breakdown_json AS dealBreakdownJson,
            mode
          FROM sync_runs
          WHERE status = 'success' AND finished_at IS NOT NULL
          ${scopeClause}
          ORDER BY finished_at DESC
          LIMIT 1
        `)
        .get(...values) as
        | (Omit<LastSyncSummary, "dealBreakdown"> & {
            dealBreakdownJson?: string | null;
          })
        | undefined;

      return row
        ? {
            finishedAt: row.finishedAt,
            leadsSynced: row.leadsSynced,
            dealsSynced: row.dealsSynced,
            mode: row.mode,
            dealBreakdown: parseDealBreakdown(
              row.dealBreakdownJson,
              row.dealsSynced
            )
          }
        : null;
    },

    close() {
      database.close();
    }
  };
}
