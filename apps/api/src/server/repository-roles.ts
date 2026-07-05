import type { SyncRepository } from "../domain/sync.js";
import type { SqliteRepository } from "./sqlite-repository.js";

export type PlatformCommentRepository = Pick<
  SqliteRepository,
  | "getDashboardComments"
  | "getDashboardCommentById"
  | "createDashboardComment"
  | "updateDashboardComment"
  | "archiveDashboardComment"
  | "updateDashboardCommentPaperclip"
>;

export type ProtoCommentRepository = Pick<
  SqliteRepository,
  "getProtoComments" | "replaceProtoComments"
>;

export type SyncRunRepository = Pick<
  SqliteRepository,
  | "createSyncRun"
  | "recoverStaleSyncRuns"
  | "failSyncRun"
  | "finishSyncRun"
  | "listSyncRuns"
  | "getLastSyncSummary"
>;

export type SnapshotReadRepository = Pick<
  SqliteRepository,
  | "getLatestSuccessCursor"
  | "getLatestSuccessfulScope"
  | "getSnapshotStats"
  | "getActivitySnapshotCount"
  | "getDealIdsByCategoryIds"
  | "getOpenDealIdsByCategoryIds"
  | "getDealsByIds"
  | "getActivitiesByIds"
  | "getCallById"
  | "getStageAtDealTime"
  | "getAllLeads"
  | "getAllDeals"
  | "getAllStageHistory"
  | "getAllActivities"
  | "getAllActivityBindings"
  | "getAllActivityDeadlineChanges"
  | "getAllDealMeetingDateChanges"
  | "getAllConversionEventVisits"
  | "getAllIdentityLinks"
  | "getAllDealStageFacts"
  | "getAllDealTouchpointFacts"
  | "getAllEventSnapshots"
  | "getAllEventVisitFacts"
  | "getAllEventVisitStageHistory"
  | "getAllCalls"
  | "getManagerDirectory"
  | "getStageCatalog"
  | "getWonStageIds"
>;

export type SnapshotWriteRepository = Pick<
  SqliteRepository,
  | "runSnapshotTransaction"
  | "replaceStageCatalog"
  | "upsertLeads"
  | "upsertDeals"
  | "upsertStageHistory"
  | "upsertActivities"
  | "upsertActivityBindings"
  | "upsertActivityDeadlineChanges"
  | "upsertDealMeetingDateChanges"
  | "upsertConversionEventVisits"
  | "pruneConversionEventSnapshots"
  | "upsertIdentityLinks"
  | "upsertDealStageFacts"
  | "upsertDealTouchpointFacts"
  | "replaceAnalyticsFacts"
  | "upsertEventSnapshots"
  | "upsertEventVisitFacts"
  | "replaceEventVisitFacts"
  | "upsertEventVisitStageHistory"
  | "upsertCalls"
  | "upsertManagerDirectory"
  | "setWonStageIds"
>;

export type AttractionSettingsRepository = Pick<
  SqliteRepository,
  | "getModuleEventTypeSettings"
  | "replaceModuleEventTypeSettings"
  | "getManagerWhitelistSettings"
  | "replaceManagerWhitelistSettings"
  | "getConversionEventTypeOptions"
  | "replaceConversionEventTypeOptions"
  | "getSalesPlanRows"
  | "replaceSalesPlanRows"
  | "replaceSalesPlanPeriods"
  | "getPricingRules"
  | "replacePricingRules"
  | "getOperationalThresholdSettings"
  | "replaceOperationalThresholdSettings"
  | "getUnitEconomicsCostArticles"
  | "getUnitEconomicsCostRules"
  | "replaceUnitEconomicsCostRules"
  | "getUnitEconomicsEventParticipantMode"
  | "getUnitEconomicsCostFacts"
  | "upsertUnitEconomicsCostFacts"
  | "getWonStageIds"
  | "setWonStageIds"
>;

export type LeadgenSettingsRepository = Pick<
  SqliteRepository,
  | "getManagerWhitelistSettings"
  | "replaceManagerWhitelistSettings"
  | "getStageCatalog"
  | "getManagerDirectory"
  | "getWonStageIds"
>;

export type CallAnalysisRepository = Pick<
  SqliteRepository,
  | "getCallAnalysisResult"
  | "getLatestCallAnalysisRuns"
  | "startCallAnalysisRun"
  | "saveCallAnalysisResult"
  | "finishCallAnalysisRun"
  | "failCallAnalysisRun"
  | "getCallActivityIdsMissingActivities"
  | "getCallActivityIdsMissingCallStats"
  | "getCallActivityIdsForCallStatsRefresh"
>;

export type ReportingRepository = SyncRepository &
  Pick<
    SqliteRepository,
    // Snapshot reads and report inputs.
    | "getSnapshotStats"
    | "getDealIdsByCategoryIds"
    | "getAllDeals"
    | "getAllStageHistory"
    | "getAllActivities"
    | "getAllActivityBindings"
    | "getAllActivityDeadlineChanges"
    | "getAllDealMeetingDateChanges"
    | "getAllConversionEventVisits"
    | "getAllDealStageFacts"
    | "getAllDealTouchpointFacts"
    | "getAllEventSnapshots"
    | "getAllEventVisitFacts"
    | "getAllEventVisitStageHistory"
    | "getAllCalls"
    | "getManagerDirectory"
    | "getStageCatalog"
    | "getWonStageIds"
    | "setWonStageIds"
    // Sync health and sync status used by reporting endpoints.
    | "hasSyncCoverage"
    | "getDealMeetingDateFieldBootstrappedAt"
    | "getCallActivityIdsMissingCallStats"
    | "recoverStaleSyncRuns"
    | "getLastSyncSummary"
    | "listSyncRuns"
    // Report-owned generated facts.
    | "replaceAnalyticsFacts"
    // Sales plan and pricing settings.
    | "getSalesPlanRows"
    | "replaceSalesPlanRows"
    | "replaceSalesPlanPeriods"
    | "getPricingRules"
    | "replacePricingRules"
    | "getOperationalThresholdSettings"
    | "replaceOperationalThresholdSettings"
    // Unit economics.
    | "getUnitEconomicsCostArticles"
    | "getUnitEconomicsCostRules"
    | "replaceUnitEconomicsCostRules"
    | "getUnitEconomicsEventParticipantMode"
    | "getUnitEconomicsCostFacts"
    // Call analysis reads.
    | "getCallAnalysisResult"
    | "getLatestCallAnalysisRuns"
    // Module report settings.
    | "getModuleEventTypeSettings"
    | "replaceModuleEventTypeSettings"
    | "getConversionEventTypeOptions"
    | "getManagerWhitelistSettings"
    | "replaceManagerWhitelistSettings"
  >;
