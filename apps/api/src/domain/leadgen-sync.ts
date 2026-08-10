import type {
  ActivityBindingSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  SnapshotStats,
  StageCatalogEntry,
  StageHistorySnapshot,
  SyncChangeSummary,
  SyncDealChangeBreakdown,
  SyncProgressEvent,
  SyncProgressPhase
} from "@bitrix24-reporting/contracts";

import {
  sanitizeActivityDescription,
  sanitizeActivitySubject
} from "./activity-content.js";

import type {
  ActivityBindingRow,
  ActivityRow,
  CallRow,
  DealRow,
  StageHistoryRow,
  SyncRepository,
  UserRow
} from "./sync.js";
import {
  ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
  CALL_STATS_COVERAGE_PROVIDER,
  CALL_STATS_COVERAGE_STREAM,
  CALL_STATS_COVERAGE_VERSION,
  LEADGEN_US_BASKET_REASON_FIELD_NAME,
  LEADGEN_US_RETURN_REASON_FIELD_NAME,
  LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME
} from "./sync.js";

const LEADGEN_DEFAULT_FROM = "2026-01-01T00:00:00+03:00";
const LEADGEN_TASK_ACTIVITY_PROVIDER_IDS = ["CRM_TODO", "CRM_TASKS_TASK"] as const;
const LEADGEN_ACTIVITY_HISTORY_COVERAGE_STREAM = "activity_history";
const LEADGEN_ACTIVITY_HISTORY_COVERAGE_VERSION = "activity-bindings-v2";
const MISSING_CALL_ACTIVITY_BACKFILL_LIMIT = 20_000;
const EMPTY_SNAPSHOT_STATS: SnapshotStats = {
  deals: 0,
  activities: 0,
  calls: 0,
  stageHistory: 0
};

export interface LeadgenSyncClient {
  fetchDealStages(categoryIds: string[]): Promise<StageCatalogEntry[]>;
  fetchSourceCatalog(): Promise<StageCatalogEntry[]>;
  fetchDealFieldValueMap?(fieldName: string): Promise<Record<string, string>>;
  listDeals(input: {
    modifiedAfter: string | null;
    categoryIds: string[];
    assignedByIds?: string[];
    customFieldNames?: string[];
  }): Promise<DealRow[]>;
  listStageHistory?(input: {
    ownerIds?: string[];
    categoryIds?: string[];
  }): Promise<StageHistoryRow[]>;
  listActivities?(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
    providerId?: string;
  }): Promise<ActivityRow[]>;
  listActivitiesByIds?(activityIds: string[]): Promise<ActivityRow[]>;
  listActivityBindings?(activityIds: string[]): Promise<ActivityBindingRow[]>;
  listCalls?(input: {
    activityIds?: string[];
    callStartDateFrom?: string;
    callStartDateTo?: string;
    portalUserIds?: string[];
  }): Promise<CallRow[]>;
  fetchUsers(input: { ids: string[] }): Promise<UserRow[]>;
}

export interface PerformLeadgenSyncInput {
  client: LeadgenSyncClient;
  repository: SyncRepository;
  categoryId: string;
  managerIds: string[];
  now: () => string;
  from?: string;
  onProgress?: (event: SyncProgressEvent) => void;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeMappedFieldValue(
  value: unknown,
  valueMap: Record<string, string>
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = normalizeString(
    typeof rawValue === "number" ? String(rawValue) : rawValue
  );

  if (!normalized) {
    return null;
  }

  return valueMap[normalized] ?? normalized;
}

function sanitizeRefusalReasonDetail(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(String).map((value) => value.trim()).filter(Boolean)));
}

export function buildLeadgenScopeKey(categoryId: string, managerIds: string[]) {
  return `module:leadgen:category:${categoryId}:assigned:${[...managerIds]
    .sort()
    .join(",")}`;
}

function buildSyncCursorKey(scopeKey: string) {
  return `${scopeKey}:deals:date_modify`;
}

function buildCallStatsCursorKey(scopeKey: string) {
  return `${scopeKey}:call_stats:call_start_date`;
}

function buildActivityCursorKey(scopeKey: string) {
  return `${scopeKey}:activities:last_updated`;
}

function timestampValue(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function maxTimestamp(values: Array<string | null | undefined>) {
  let selected: string | null = null;
  let selectedTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const parsed = timestampValue(value);
    if (value && parsed > selectedTime) {
      selected = value;
      selectedTime = parsed;
    }
  }

  return selected;
}

function advanceCursor(currentCursor: string | null, rows: DealRow[]) {
  const rowCursor = maxTimestamp(rows.map((row) => row.DATE_MODIFY));
  return timestampValue(rowCursor) > timestampValue(currentCursor)
    ? rowCursor
    : currentCursor;
}

function advanceTimestampCursorThroughWindow(
  currentCursor: string | null,
  rowTimestamps: Array<string | null | undefined>,
  completedThrough: string
) {
  const rowCursor = maxTimestamp(rowTimestamps);
  const selectedCursor =
    timestampValue(rowCursor) > timestampValue(currentCursor)
      ? rowCursor
      : currentCursor;

  return timestampValue(completedThrough) > timestampValue(selectedCursor)
    ? completedThrough
    : selectedCursor;
}

function buildProgressEvent(input: {
  syncRunId: number | null;
  phase: SyncProgressPhase;
  progress: number;
  message: string;
  snapshotBefore?: SnapshotStats;
  snapshotAfter?: SnapshotStats;
  changes?: SyncChangeSummary;
  mode?: "full" | "delta";
  modifiedAfter?: string | null;
  startedAt?: string;
  finishedAt?: string;
  diagnostics?: string[];
}): SyncProgressEvent {
  return input;
}

function emitProgress(
  input: PerformLeadgenSyncInput,
  event: SyncProgressEvent
) {
  input.onProgress?.(event);
  if (process.env.NODE_ENV !== "test") {
    console.info("sync.leadgen.progress", JSON.stringify(event));
  }
}

function emptyDealBreakdown(total: number): SyncDealChangeBreakdown {
  return {
    total,
    created: total,
    updated: 0,
    closed: 0,
    reopened: 0,
    unchanged: 0
  };
}

function mapLeadgenDealRow(
  row: DealRow,
  returnReasonMap: Record<string, string>,
  basketReasonMap: Record<string, string>
): DealSnapshot {
  const returnReasonValue = normalizeMappedFieldValue(
    row[LEADGEN_US_RETURN_REASON_FIELD_NAME],
    returnReasonMap
  );
  const basketReasonValue = normalizeMappedFieldValue(
    row[LEADGEN_US_BASKET_REASON_FIELD_NAME],
    basketReasonMap
  );
  const genericReasonDetail = normalizeMappedFieldValue(
    row[ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME],
    {}
  );

  return {
    id: String(row.ID),
    title: null,
    contactId: null,
    leadId: null,
    categoryId: normalizeString(row.CATEGORY_ID),
    stageId: String(row.STAGE_ID),
    stageSemanticId: normalizeString(row.STAGE_SEMANTIC_ID),
    opportunity:
      typeof row.OPPORTUNITY === "number"
        ? row.OPPORTUNITY
        : row.OPPORTUNITY
          ? Number(row.OPPORTUNITY)
          : null,
    assignedById: normalizeString(row.ASSIGNED_BY_ID),
    sourceId: normalizeString(row.SOURCE_ID),
    qualityValue: null,
    businessClubValue: null,
    targetGroupValue: null,
    meetingTypeValue: null,
    meetingDateValue: null,
    tariffValue: null,
    conversionEventValue: null,
    refusalReasonValue: returnReasonValue ?? basketReasonValue,
    refusalReasonDetail: sanitizeRefusalReasonDetail(genericReasonDetail),
    dateCreate: String(row.DATE_CREATE),
    dateModify: String(row.DATE_MODIFY),
    dateClosed: normalizeString(row.DATE_CLOSED),
    utmSource: normalizeString(row.UTM_SOURCE),
    utmMedium: normalizeString(row.UTM_MEDIUM),
    utmCampaign: normalizeString(row.UTM_CAMPAIGN),
    utmContent: normalizeString(row.UTM_CONTENT),
    utmTerm: normalizeString(row.UTM_TERM)
  };
}

function mapUserRow(row: UserRow): ManagerDirectoryEntry {
  const fullName = [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim();

  return {
    id: String(row.ID),
    name: fullName || String(row.ID)
  };
}

function mapStageHistoryRow(row: StageHistoryRow): StageHistorySnapshot {
  return {
    id: String(row.ID),
    ownerId: String(row.OWNER_ID),
    categoryId:
      row.CATEGORY_ID === null || row.CATEGORY_ID === undefined
        ? null
        : String(row.CATEGORY_ID),
    stageId: row.STAGE_ID,
    stageSemanticId: row.STAGE_SEMANTIC_ID,
    typeId: row.TYPE_ID,
    createdTime: row.CREATED_TIME
  };
}

function mapActivityRow(row: ActivityRow): ActivitySnapshot {
  const completed = row.COMPLETED === "Y";

  return {
    id: String(row.ID),
    ownerTypeId: String(row.OWNER_TYPE_ID),
    ownerId: String(row.OWNER_ID),
    typeId: normalizeString(row.TYPE_ID),
    providerId: row.PROVIDER_ID,
    responsibleId: normalizeString(row.RESPONSIBLE_ID),
    createdTime: row.CREATED,
    deadline: row.DEADLINE ?? null,
    lastUpdated: row.LAST_UPDATED,
    completed,
    completedTime: completed ? row.COMPLETED_DATE ?? row.LAST_UPDATED : null,
    subject: sanitizeActivitySubject(row.SUBJECT),
    description: sanitizeActivityDescription(row.DESCRIPTION)
  };
}

function mapActivityBindingRow(row: ActivityBindingRow): ActivityBindingSnapshot {
  return {
    activityId: String(row.activityId),
    ownerTypeId: String(row.ownerTypeId),
    ownerId: String(row.ownerId)
  };
}

function mapCallRow(row: CallRow): CallSnapshot {
  const duration =
    typeof row.CALL_DURATION === "number"
      ? row.CALL_DURATION
      : Number(row.CALL_DURATION ?? 0);

  return {
    id: String(row.ID),
    crmActivityId: normalizeString(row.CRM_ACTIVITY_ID),
    portalUserId: normalizeString(row.PORTAL_USER_ID),
    callType: normalizeString(row.CALL_TYPE),
    callStartDate: row.CALL_START_DATE,
    callDurationSeconds: Number.isFinite(duration) ? duration : 0,
    crmEntityType: row.CRM_ENTITY_TYPE,
    crmEntityId: normalizeString(row.CRM_ENTITY_ID),
    callFailedCode: normalizeString(row.CALL_FAILED_CODE)
  };
}

async function getSnapshotStats(
  repository: SyncRepository,
  categoryId: string,
  managerIds: string[]
) {
  return repository.getSnapshotStats
    ? repository.getSnapshotStats({
        categoryIds: [categoryId],
        assignedByIds: managerIds
      })
    : EMPTY_SNAPSHOT_STATS;
}

function runSnapshotTransaction<T>(repository: SyncRepository, task: () => T) {
  return repository.runSnapshotTransaction
    ? repository.runSnapshotTransaction(task)
    : task();
}

function buildFailureDiagnostics(error: unknown) {
  if (!(error instanceof Error)) {
    return ["SYNC_FAILED", "error=unknown"];
  }

  return ["SYNC_FAILED", `error=${error.name}`];
}

async function hasLeadgenActivityCoverage(input: {
  repository: SyncRepository;
  scopeKey: string;
  providerId: string;
  requiredFrom: string;
}) {
  if (!input.repository.hasSyncCoverage) {
    return true;
  }

  return input.repository.hasSyncCoverage({
    scopeKey: input.scopeKey,
    stream: LEADGEN_ACTIVITY_HISTORY_COVERAGE_STREAM,
    providerId: input.providerId,
    requiredFrom: input.requiredFrom,
    algorithmVersion: LEADGEN_ACTIVITY_HISTORY_COVERAGE_VERSION
  });
}

export async function performLeadgenSync(
  input: PerformLeadgenSyncInput
): Promise<ManualSyncSummary> {
  const categoryId = input.categoryId.trim();
  const managerIds = uniqueStrings(input.managerIds);
  const startedAt = input.now();
  const scopeKey = buildLeadgenScopeKey(categoryId, managerIds);
  const cursorKey = buildSyncCursorKey(scopeKey);
  const callStatsCursorKey = buildCallStatsCursorKey(scopeKey);
  const activityCursorKey = buildActivityCursorKey(scopeKey);
  const hasLeadgenScope = categoryId.length > 0 && managerIds.length > 0;
  const createdFrom = input.from ?? LEADGEN_DEFAULT_FROM;
  const snapshotBefore = hasLeadgenScope
    ? await getSnapshotStats(input.repository, categoryId, managerIds)
    : EMPTY_SNAPSHOT_STATS;
  const cursorFromState =
    hasLeadgenScope && input.repository.getSyncCursor
      ? await input.repository.getSyncCursor(cursorKey)
      : null;
  const latestDealCursor = hasLeadgenScope
    ? cursorFromState ??
      (await input.repository.getLatestSuccessCursor([categoryId], managerIds))
    : null;
  const callStatsCursorFromState =
    hasLeadgenScope && input.repository.getSyncCursor
      ? await input.repository.getSyncCursor(callStatsCursorKey)
      : null;
  const activityCursorFromState =
    hasLeadgenScope && input.repository.getSyncCursor
      ? await input.repository.getSyncCursor(activityCursorKey)
      : null;
  const callHistoryBootstrappedAt =
    hasLeadgenScope && input.repository.getCallHistoryBootstrappedAt
      ? await input.repository.getCallHistoryBootstrappedAt()
      : "__legacy__";
  const hasCallStatsCoverage =
    !hasLeadgenScope ||
    (input.repository.hasSyncCoverage
      ? await input.repository.hasSyncCoverage({
          scopeKey,
          stream: CALL_STATS_COVERAGE_STREAM,
          providerId: CALL_STATS_COVERAGE_PROVIDER,
          requiredFrom: createdFrom,
          algorithmVersion: CALL_STATS_COVERAGE_VERSION
        })
      : Boolean(callHistoryBootstrappedAt));
  const shouldBackfillCallStats = hasLeadgenScope && !hasCallStatsCoverage;
  const mode = latestDealCursor ? "delta" : "full";
  const runModifiedAfter = latestDealCursor;
  const queryModifiedAfter = latestDealCursor ?? input.from ?? LEADGEN_DEFAULT_FROM;
  const activityModifiedAfter = activityCursorFromState ?? queryModifiedAfter;
  const taskActivityCoverage = hasLeadgenScope
    ? await Promise.all(
        LEADGEN_TASK_ACTIVITY_PROVIDER_IDS.map((providerId) =>
          hasLeadgenActivityCoverage({
            repository: input.repository,
            scopeKey,
            providerId,
            requiredFrom: createdFrom
          })
        )
      )
    : LEADGEN_TASK_ACTIVITY_PROVIDER_IDS.map(() => true);
  const taskActivityProvidersToBackfill = LEADGEN_TASK_ACTIVITY_PROVIDER_IDS.filter(
    (_providerId, index) => !taskActivityCoverage[index]
  );
  const callStatsModifiedAfter = shouldBackfillCallStats
    ? createdFrom
    : callStatsCursorFromState ?? queryModifiedAfter;
  const syncRunId = await input.repository.createSyncRun({
    startedAt,
    mode,
    modifiedAfter: runModifiedAfter,
    scopeKey
  });

  emitProgress(
    input,
    buildProgressEvent({
      syncRunId,
      phase: "inspect_snapshot",
      progress: 5,
      message: "Проверяем leadgen snapshot",
      snapshotBefore,
      mode,
      modifiedAfter: runModifiedAfter,
      startedAt
    })
  );

  if (!hasLeadgenScope) {
    const finishedAt = input.now();
    const dealBreakdown = emptyDealBreakdown(0);
    const changes: SyncChangeSummary = {
      deals: 0,
      dealBreakdown,
      activities: 0,
      calls: 0,
      stageHistory: 0,
      managers: 0
    };
    const diagnostics = [
      "leadgenSkipped=empty-scope",
      `leadgenManagers=${managerIds.length}`
    ];
    await input.repository.finishSyncRun({
      syncRunId,
      finishedAt,
      status: "success",
      leadsSynced: 0,
      dealsSynced: 0,
      dealBreakdown,
      diagnostics,
      modifiedAfter: runModifiedAfter
    });

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced: 0,
      mode,
      modifiedAfter: runModifiedAfter,
      finishedAt,
      snapshotBefore,
      snapshotAfter: snapshotBefore,
      changes,
      diagnostics
    };
  }

  try {
    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_catalogs",
        progress: 20,
        message: "Загружаем справочники лидгена из Bitrix24",
        snapshotBefore,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const [dealStages, sourceCatalog, dealRows, returnReasonMap, basketReasonMap] =
      await Promise.all([
        input.client.fetchDealStages([categoryId]),
        input.client.fetchSourceCatalog(),
        input.client.listDeals({
          modifiedAfter: queryModifiedAfter,
          categoryIds: [categoryId],
          assignedByIds: managerIds,
          customFieldNames: [
            LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME,
            ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
            LEADGEN_US_RETURN_REASON_FIELD_NAME,
            LEADGEN_US_BASKET_REASON_FIELD_NAME
          ]
        }),
        input.client.fetchDealFieldValueMap
          ? input.client.fetchDealFieldValueMap(LEADGEN_US_RETURN_REASON_FIELD_NAME)
          : Promise.resolve({}),
        input.client.fetchDealFieldValueMap
          ? input.client.fetchDealFieldValueMap(LEADGEN_US_BASKET_REASON_FIELD_NAME)
          : Promise.resolve({})
      ]);
    const allowedManagers = new Set(managerIds);
    const cursorRows = dealRows.filter((row) => {
      const rowCategoryId = normalizeString(row.CATEGORY_ID);
      const managerId = normalizeString(row.ASSIGNED_BY_ID);
      return (
        rowCategoryId === categoryId &&
        Boolean(managerId && allowedManagers.has(managerId))
      );
    });
    const scopedRows = cursorRows.filter(
      (row) =>
        timestampValue(normalizeString(row.DATE_CREATE)) >=
        timestampValue(createdFrom)
    );
    const deals = scopedRows.map((row) =>
      mapLeadgenDealRow(row, returnReasonMap, basketReasonMap)
    );
    const existingScopedDealIds = await input.repository.getDealIdsByCategoryIds(
      [categoryId],
      managerIds
    );
    const operationalOwnerIds = uniqueStrings([
      ...existingScopedDealIds,
      ...deals.map((deal) => deal.id)
    ]);
    const operationalOwnerIdSet = new Set(operationalOwnerIds);
    const historicalTaskActivityRows =
      operationalOwnerIds.length > 0 &&
      input.client.listActivities &&
      taskActivityProvidersToBackfill.length > 0
        ? (
            await Promise.all(
              taskActivityProvidersToBackfill.map((providerId) =>
                input.client.listActivities
                  ? input.client.listActivities({
                      ownerIds: operationalOwnerIds,
                      modifiedAfter: createdFrom,
                      providerId
                    })
                  : Promise.resolve([])
              )
            )
          ).flat()
        : [];
    const deltaActivityRows =
      operationalOwnerIds.length > 0 && input.client.listActivities
        ? await input.client.listActivities({
            ownerIds: operationalOwnerIds,
            modifiedAfter: activityModifiedAfter
          })
        : [];
    const activityRows = Array.from(
      new Map(
        [...historicalTaskActivityRows, ...deltaActivityRows].map((row) => [
          String(row.ID),
          row
        ])
      ).values()
    );
    const missingCallActivityIds =
      input.repository.getCallActivityIdsMissingActivities &&
      input.client.listActivitiesByIds &&
      operationalOwnerIds.length > 0
        ? await input.repository.getCallActivityIdsMissingActivities(
            MISSING_CALL_ACTIVITY_BACKFILL_LIMIT,
            createdFrom
          )
        : [];
    const missingCallActivityRows =
      missingCallActivityIds.length > 0 && input.client.listActivitiesByIds
        ? (await input.client.listActivitiesByIds(missingCallActivityIds)).filter(
            (row) =>
              String(row.OWNER_TYPE_ID) === "2" &&
              operationalOwnerIdSet.has(String(row.OWNER_ID))
          )
        : [];
    const initialActivityRows = Array.from(
      new Map(
        [...activityRows, ...missingCallActivityRows].map((row) => [
          String(row.ID),
          row
        ])
      ).values()
    );
    const initialActivities = initialActivityRows.map(mapActivityRow);
    const initialCallActivityIds = activityRows
      .map(mapActivityRow)
      .filter((activity) => activity.providerId === "VOXIMPLANT_CALL")
      .map((activity) => activity.id);
    const [callRowsByActivity, supplementalCallRows, stageHistory] =
      await Promise.all([
        initialCallActivityIds.length > 0 && input.client.listCalls
          ? input.client.listCalls({ activityIds: initialCallActivityIds })
          : Promise.resolve([]),
        input.client.listCalls
          ? input.client.listCalls({
              callStartDateFrom: callStatsModifiedAfter,
              callStartDateTo: startedAt,
              portalUserIds: managerIds
            })
          : Promise.resolve([]),
        operationalOwnerIds.length > 0 && input.client.listStageHistory
          ? input.client
              .listStageHistory({ ownerIds: operationalOwnerIds })
              .then((rows) => rows.map(mapStageHistoryRow))
          : Promise.resolve([])
      ]);
    const initialActivityIdSet = new Set(
      initialActivityRows.map((row) => String(row.ID))
    );
    const supplementalActivityIds =
      operationalOwnerIds.length > 0
        ? Array.from(
            new Set(
              supplementalCallRows
                .map((row) => normalizeString(row.CRM_ACTIVITY_ID))
                .filter((activityId): activityId is string => {
                  if (!activityId || activityId === "0") {
                    return false;
                  }

                  return !initialActivityIdSet.has(activityId);
                })
            )
          )
        : [];
    const storedSupplementalActivities =
      supplementalActivityIds.length > 0
        ? await input.repository.getActivitiesByIds(supplementalActivityIds)
        : [];
    const storedSupplementalActivityIdSet = new Set(
      storedSupplementalActivities.map((activity) => activity.id)
    );
    const missingSupplementalActivityIds = supplementalActivityIds.filter(
      (activityId) => !storedSupplementalActivityIdSet.has(activityId)
    );
    const fetchedSupplementalActivityRows =
      input.client.listActivitiesByIds &&
      missingSupplementalActivityIds.length > 0
        ? (await input.client.listActivitiesByIds(missingSupplementalActivityIds)).filter(
            (row) =>
              String(row.OWNER_TYPE_ID) === "2" &&
              operationalOwnerIdSet.has(String(row.OWNER_ID))
          )
        : [];
    const scopedSupplementalActivities = storedSupplementalActivities.filter(
      (activity) =>
        activity.ownerTypeId === "2" && operationalOwnerIdSet.has(activity.ownerId)
    );
    const activities = Array.from(
      new Map(
        [
          ...initialActivities,
          ...scopedSupplementalActivities,
          ...fetchedSupplementalActivityRows.map(mapActivityRow)
        ].map((activity) => [activity.id, activity])
      ).values()
    );
    const callActivityIdsForBindings = initialCallActivityIds;
    const activityBindings =
      input.client.listActivityBindings && callActivityIdsForBindings.length > 0
        ? (await input.client.listActivityBindings(callActivityIdsForBindings)).map(
            mapActivityBindingRow
          )
        : [];
    const calls = Array.from(
      new Map(
        [...callRowsByActivity, ...supplementalCallRows]
          .map(mapCallRow)
          .map((call) => [call.id, call])
      ).values()
    );
    const managerDirectory = (
      await input.client.fetchUsers({
        ids: uniqueStrings(
          [
            ...deals.map((deal) => deal.assignedById),
            ...activities.map((activity) => activity.responsibleId),
            ...calls.map((call) => call.portalUserId)
          ].filter((managerId): managerId is string => Boolean(managerId))
        )
      })
    ).map(mapUserRow);
    const dealBreakdown = emptyDealBreakdown(deals.length);
    const changes: SyncChangeSummary = {
      deals: deals.length,
      dealBreakdown,
      activities: activities.length,
      calls: calls.length,
      stageHistory: stageHistory.length,
      managers: managerDirectory.length
    };

    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_deals",
        progress: 55,
        message: `Получено leadgen сделок из Bitrix: ${deals.length}`,
        snapshotBefore,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const finishedAt = input.now();
    const nextCursor = advanceCursor(runModifiedAfter, cursorRows);
    const nextActivityCursor = input.client.listActivities
      ? advanceTimestampCursorThroughWindow(
          activityModifiedAfter,
          deltaActivityRows.map((row) => row.LAST_UPDATED),
          startedAt
        )
      : null;
    const nextCallStatsCursor = advanceTimestampCursorThroughWindow(
      callStatsModifiedAfter,
      supplementalCallRows.map((row) => row.CALL_START_DATE),
      startedAt
    );
    const diagnostics = [
      `dealCursor=${nextCursor ?? "not-updated"}`,
      `activityCursor=${nextActivityCursor ?? "not-updated"}`,
      `taskActivityCoverage=${
        taskActivityProvidersToBackfill.length > 0 ? "backfill" : "delta"
      }`,
      `callStatsCursor=${nextCallStatsCursor ?? "not-updated"}`,
      `callStatsCoverage=${shouldBackfillCallStats ? "backfill" : "delta"}`,
      `leadgenDeals=${deals.length}`,
      `leadgenActivities=${activities.length}`,
      `leadgenCalls=${calls.length}`,
      `leadgenStageHistory=${stageHistory.length}`,
      `leadgenManagers=${managerIds.length}`
    ];

    runSnapshotTransaction(input.repository, () => {
      void input.repository.replaceStageCatalog([...dealStages, ...sourceCatalog]);
      void input.repository.upsertDeals(deals);
      void input.repository.upsertStageHistory(stageHistory);
      void input.repository.upsertActivities(activities);
      if (input.repository.upsertActivityBindings) {
        void input.repository.upsertActivityBindings(activityBindings);
      }
      void input.repository.upsertCalls(calls);
      void input.repository.upsertManagerDirectory(managerDirectory);
      if (
        shouldBackfillCallStats &&
        input.repository.markCallHistoryBootstrapped
      ) {
        void input.repository.markCallHistoryBootstrapped(finishedAt);
      }
      if (input.repository.setSyncCursor && nextCursor) {
        void input.repository.setSyncCursor({
          key: cursorKey,
          cursorValue: nextCursor,
          updatedAt: finishedAt
        });
      }
      if (input.repository.setSyncCursor && nextActivityCursor) {
        void input.repository.setSyncCursor({
          key: activityCursorKey,
          cursorValue: nextActivityCursor,
          updatedAt: finishedAt
        });
      }
      if (input.repository.setSyncCursor && nextCallStatsCursor) {
        void input.repository.setSyncCursor({
          key: callStatsCursorKey,
          cursorValue: nextCallStatsCursor,
          updatedAt: finishedAt
        });
      }
      if (input.repository.upsertSyncCoverage && shouldBackfillCallStats) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: CALL_STATS_COVERAGE_STREAM,
          providerId: CALL_STATS_COVERAGE_PROVIDER,
          coveredFrom: createdFrom,
          coveredTo: null,
          algorithmVersion: CALL_STATS_COVERAGE_VERSION,
          syncedAt: finishedAt
        });
      }
      if (
        input.repository.upsertSyncCoverage &&
        taskActivityProvidersToBackfill.length > 0
      ) {
        for (const providerId of taskActivityProvidersToBackfill) {
          void input.repository.upsertSyncCoverage({
            scopeKey,
            stream: LEADGEN_ACTIVITY_HISTORY_COVERAGE_STREAM,
            providerId,
            coveredFrom: createdFrom,
            coveredTo: null,
            algorithmVersion: LEADGEN_ACTIVITY_HISTORY_COVERAGE_VERSION,
            syncedAt: finishedAt
          });
        }
      }
    });

    await input.repository.finishSyncRun({
      syncRunId,
      finishedAt,
      status: "success",
      leadsSynced: 0,
      dealsSynced: deals.length,
      dealBreakdown,
      diagnostics,
      modifiedAfter: runModifiedAfter
    });

    const snapshotAfter = await getSnapshotStats(input.repository, categoryId, managerIds);

    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "complete",
        progress: 100,
        message: "Синхронизация лидгена завершена",
        snapshotBefore,
        snapshotAfter,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt,
        finishedAt,
        diagnostics
      })
    );

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced: deals.length,
      mode,
      modifiedAfter: runModifiedAfter,
      finishedAt,
      snapshotBefore,
      snapshotAfter,
      changes,
      diagnostics
    };
  } catch (error) {
    const finishedAt = input.now();
    const diagnostics = buildFailureDiagnostics(error);
    await input.repository.failSyncRun({
      syncRunId,
      finishedAt,
      status: "failed",
      diagnostics
    });
    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "failed",
        progress: 100,
        message: "Синхронизация лидгена завершилась ошибкой",
        snapshotBefore,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt,
        finishedAt,
        diagnostics
      })
    );
    throw error;
  }
}
