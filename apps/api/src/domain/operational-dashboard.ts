import type {
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  OperationalDashboardReport,
  OperationalManagerRow,
  OperationalMeetingSlotCount,
  OperationalRiskDeal,
  OperationalRiskFlag,
  OperationalRiskRuleKey,
  OperationalSaleByClub,
  OperationalStageWip,
  OperationalThresholdSettings,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  buildSlaMetricsByManager,
  buildSlaSummaryMetrics
} from "./operational-reports.js";
import {
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveManagerName
} from "./report-dimensions.js";

const LOST_STAGE_IDS = new Set(["C10:LOSE", "C10:UC_EA3R76"]);
const SLOT_INDEXES = [1, 2, 3] as const;
const RISK_RULE_LABELS = {
  stage_aging: "Застряли на этапе",
  no_open_activity: "Нет запланированных дел",
  no_recent_calls: "Нет звонков",
  no_recent_activity: "Нет активностей"
} satisfies Record<OperationalRiskRuleKey, string>;
const SLA_LABELS = {
  sla1: "Время в работу",
  sla2: "Первый контакт",
  sla3: "Обработка лида"
} as const;
const UNSPECIFIED_BUSINESS_CLUB_LABEL = "Без бизнес-клуба заказчика";
const UNSPECIFIED_TARGET_GROUP_LABEL = "Без таргет-группы";
const MS_PER_DAY = 86_400_000;
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

interface BuildOperationalDashboardReportInput {
  range: ReportRange;
  now: string;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
  thresholds: OperationalThresholdSettings;
  wonStageIds: string[];
  dealUrlBuilder?: (dealId: string) => string | null;
  capRisks?: number;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isWithinRange(value: string | null | undefined, fromMs: number, toMs: number) {
  const timestamp = toTimestamp(value);
  return timestamp !== null && timestamp >= fromMs && timestamp <= toMs;
}

function toRoundedNumber(value: number) {
  return Number(value.toFixed(2));
}

function toFloorDays(start: string | null | undefined, endMs: number) {
  const startMs = toTimestamp(start);
  if (startMs === null || endMs < startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / MS_PER_DAY);
}

function getAllowedCategoryIds(stageCatalog: StageCatalogEntry[]) {
  return new Set(
    stageCatalog
      .filter((entry) => entry.entityType === "deal" && entry.categoryId)
      .map((entry) => normalizeCategoryId(entry.categoryId))
  );
}

function buildStageLookup(stageCatalog: StageCatalogEntry[]) {
  return new Map(
    stageCatalog
      .filter((entry) => entry.entityType === "deal")
      .map((entry) => [
        entry.statusId,
        {
          stageName: entry.name,
          sortOrder: entry.sortOrder ?? 0
        }
      ])
  );
}

function buildStageHistoryMap(stageHistory: StageHistorySnapshot[]) {
  const map = new Map<string, StageHistorySnapshot[]>();

  for (const row of stageHistory) {
    const current = map.get(row.ownerId) ?? [];
    current.push(row);
    map.set(row.ownerId, current);
  }

  for (const rows of map.values()) {
    rows.sort((left, right) => {
      const byTime = Date.parse(left.createdTime) - Date.parse(right.createdTime);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
  }

  return map;
}

function findFirstStageTime(
  rows: StageHistorySnapshot[],
  matcher: (row: StageHistorySnapshot) => boolean
) {
  return rows.find(matcher)?.createdTime ?? null;
}

function findLatestStageTime(
  rows: StageHistorySnapshot[],
  matcher: (row: StageHistorySnapshot) => boolean
) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row && matcher(row)) {
      return row.createdTime;
    }
  }

  return null;
}

function isOpenDeal(deal: DealSnapshot, wonStageIds: Set<string>) {
  return (
    deal.stageSemanticId !== "S" &&
    deal.stageSemanticId !== "F" &&
    !wonStageIds.has(deal.stageId) &&
    !LOST_STAGE_IDS.has(deal.stageId)
  );
}

function resolveWonAt(
  deal: DealSnapshot,
  stageHistoryRows: StageHistorySnapshot[],
  wonStageIds: Set<string>
) {
  const wonAt = findFirstStageTime(
    stageHistoryRows,
    (row) => wonStageIds.has(row.stageId) || row.stageSemanticId === "S"
  );

  if (wonAt) {
    return wonAt;
  }

  return wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S"
    ? deal.dateClosed ?? deal.dateModify
    : null;
}

function resolveLostAt(deal: DealSnapshot, stageHistoryRows: StageHistorySnapshot[]) {
  const lostAt = findFirstStageTime(
    stageHistoryRows,
    (row) => LOST_STAGE_IDS.has(row.stageId) || row.stageSemanticId === "F"
  );

  if (lostAt) {
    return lostAt;
  }

  return LOST_STAGE_IDS.has(deal.stageId) || deal.stageSemanticId === "F"
    ? deal.dateClosed ?? deal.dateModify
    : null;
}

function resolveStageName(
  stageId: string,
  stageLookup: Map<string, { stageName: string; sortOrder: number }>
) {
  return stageLookup.get(stageId)?.stageName ?? stageId;
}

function resolveTargetGroup(deal: DealSnapshot) {
  const value = deal.targetGroupValue?.trim();
  return {
    key: value && value.length > 0 ? value : "UNSPECIFIED",
    label: value && value.length > 0 ? value : UNSPECIFIED_TARGET_GROUP_LABEL
  };
}

function resolveBusinessClubLabel(deal: DealSnapshot) {
  const value = deal.businessClubValue?.trim();
  return value && value.length > 0 ? value : UNSPECIFIED_BUSINESS_CLUB_LABEL;
}

function createSlotCounts(): OperationalMeetingSlotCount[] {
  return SLOT_INDEXES.map((slotIndex) => ({
    slotIndex,
    slotLabel: `Встреча ${slotIndex}`,
    count: 0
  }));
}

function incrementSlotCount(
  rows: OperationalMeetingSlotCount[],
  slotIndex: 1 | 2 | 3
) {
  const row = rows.find((entry) => entry.slotIndex === slotIndex);
  if (row) {
    row.count += 1;
  }
}

function buildActivitiesByDeal(activities: ActivitySnapshot[]) {
  const rows = new Map<string, ActivitySnapshot[]>();

  for (const activity of activities) {
    if (activity.ownerTypeId !== "2" && activity.ownerTypeId.toUpperCase() !== "DEAL") {
      continue;
    }

    const current = rows.get(activity.ownerId) ?? [];
    current.push(activity);
    rows.set(activity.ownerId, current);
  }

  return rows;
}

function buildCallsByDeal(
  calls: CallSnapshot[],
  activities: ActivitySnapshot[],
  dealMap: Map<string, DealSnapshot>
) {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const rows = new Map<string, CallSnapshot[]>();

  for (const call of calls) {
    const activity = call.crmActivityId ? activityById.get(call.crmActivityId) : null;
    const dealId =
      activity?.ownerId ??
      (call.crmEntityType?.toUpperCase() === "DEAL" || call.crmEntityType === "2"
        ? call.crmEntityId ?? null
        : null);

    if (!dealId || !dealMap.has(dealId)) {
      continue;
    }

    const current = rows.get(dealId) ?? [];
    current.push(call);
    rows.set(dealId, current);
  }

  return rows;
}

function latestCallAt(calls: CallSnapshot[]) {
  return calls.reduce<number | null>((latest, call) => {
    const timestamp = toTimestamp(call.callStartDate);
    if (timestamp === null) {
      return latest;
    }

    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);
}

function latestActivityAt(activities: ActivitySnapshot[]) {
  return activities.reduce<number | null>((latest, activity) => {
    const timestamp = [
      activity.createdTime,
      activity.completedTime,
      activity.lastUpdated
    ].reduce<number | null>((current, value) => {
      const valueTimestamp = toTimestamp(value);
      if (valueTimestamp === null) {
        return current;
      }
      return current === null || valueTimestamp > current ? valueTimestamp : current;
    }, null);

    if (timestamp === null) {
      return latest;
    }

    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);
}

function hasOpenActivity(activities: ActivitySnapshot[]) {
  return activities.some((activity) => !activity.completed);
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

function createManagerAccumulator(managerId: string, managerName: string) {
  return {
    managerId,
    managerName,
    createdDeals: 0,
    meetingsBySlot: createSlotCounts(),
    wonDeals: 0,
    slaLateCount: 0,
    slaNoTouchCount: 0,
    openDeals: 0,
    riskDeals: 0
  };
}

function hasManagerData(row: OperationalManagerRow) {
  return (
    row.createdDeals > 0 ||
    row.wonDeals > 0 ||
    row.slaLateCount > 0 ||
    row.slaNoTouchCount > 0 ||
    row.openDeals > 0 ||
    row.riskDeals > 0 ||
    row.meetingsBySlot.some((slot) => slot.count > 0)
  );
}

function createRiskFlag(input: {
  rule: OperationalRiskRuleKey;
  label: string;
  severity?: "risk" | "critical";
}): OperationalRiskFlag {
  return {
    rule: input.rule,
    label: input.label,
    severity: input.severity ?? "risk"
  };
}

export function buildOperationalDashboardReport(
  input: BuildOperationalDashboardReportInput
): OperationalDashboardReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const nowMs = Date.parse(input.now);
  const effectiveNowMs = Number.isFinite(nowMs) ? nowMs : toMs;
  const generatedAt = new Date(effectiveNowMs).toISOString();
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const stageLookup = buildStageLookup(input.stageCatalog);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const wonStageIds = new Set(input.wonStageIds);
  const deals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => dealMap.has(row.ownerId))
  );
  const activitiesByDeal = buildActivitiesByDeal(input.activities);
  const callsByDeal = buildCallsByDeal(input.calls, input.activities, dealMap);
  const stageThresholdById = new Map(
    input.thresholds.stageAging.map((threshold) => [
      threshold.stageId,
      threshold
    ])
  );
  const managerRows = new Map<string, OperationalManagerRow>();
  const ensureManager = (managerId: string) => {
    const current = managerRows.get(managerId);
    if (current) {
      return current;
    }

    const row = createManagerAccumulator(
      managerId,
      resolveManagerName(managerId, managerDirectory)
    );
    managerRows.set(managerId, row);
    return row;
  };
  const meetingsHeld = createSlotCounts();
  const meetingsToday = createSlotCounts();
  const meetingsTomorrow = createSlotCounts();
  const todayKey = toMoscowDateKey(input.now) ?? generatedAt.slice(0, 10);
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const salesByClub = new Map<
    string,
    OperationalSaleByClub & { totalDaysToWin: number }
  >();
  const stageWip = new Map<string, OperationalStageWip>();
  const riskByRule = new Map<OperationalRiskRuleKey, number>();
  const riskByStage = new Map<string, number>();
  const allRisks: OperationalRiskDeal[] = [];
  let createdDeals = 0;
  let lostDeals = 0;
  let openDeals = 0;
  let tasksToday = 0;
  let tasksTomorrow = 0;

  for (const activity of input.activities) {
    if (
      activity.completed ||
      (activity.ownerTypeId !== "2" && activity.ownerTypeId.toUpperCase() !== "DEAL") ||
      !dealMap.has(activity.ownerId)
    ) {
      continue;
    }

    const deadlineKey = toMoscowDateKey(activity.deadline);
    if (deadlineKey === todayKey) {
      tasksToday += 1;
    } else if (deadlineKey === tomorrowKey) {
      tasksTomorrow += 1;
    }
  }

  for (const deal of deals) {
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const manager = ensureManager(managerId);
    const stageRows = stageHistoryMap.get(deal.id) ?? [];

    if (isWithinRange(deal.dateCreate, fromMs, toMs)) {
      createdDeals += 1;
      manager.createdDeals += 1;
    }

    for (const slot of deal.meetingSlots ?? []) {
      if (!SLOT_INDEXES.includes(slot.index)) {
        continue;
      }

      const slotDateMs = toTimestamp(slot.dateValue);
      if (
        slotDateMs !== null &&
        slotDateMs >= fromMs &&
        slotDateMs <= toMs &&
        slotDateMs <= effectiveNowMs
      ) {
        incrementSlotCount(meetingsHeld, slot.index);
        incrementSlotCount(manager.meetingsBySlot, slot.index);
      }

      const slotDateKey = toMoscowDateKey(slot.dateValue);
      if (slotDateKey === todayKey) {
        incrementSlotCount(meetingsToday, slot.index);
      } else if (slotDateKey === tomorrowKey) {
        incrementSlotCount(meetingsTomorrow, slot.index);
      }
    }

    const wonAt = resolveWonAt(deal, stageRows, wonStageIds);
    if (isWithinRange(wonAt, fromMs, toMs)) {
      const targetGroup = resolveTargetGroup(deal);
      const current = salesByClub.get(targetGroup.key) ?? {
        targetGroupKey: targetGroup.key,
        targetGroupLabel: targetGroup.label,
        wonDeals: 0,
        averageDaysToWin: 0,
        totalDaysToWin: 0
      };
      const wonAtMs = toTimestamp(wonAt) ?? effectiveNowMs;
      const createdAtMs = toTimestamp(deal.dateCreate) ?? wonAtMs;
      current.wonDeals += 1;
      current.totalDaysToWin += Math.max(0, (wonAtMs - createdAtMs) / MS_PER_DAY);
      current.averageDaysToWin = toRoundedNumber(
        current.totalDaysToWin / current.wonDeals
      );
      salesByClub.set(targetGroup.key, current);
      manager.wonDeals += 1;
    }

    if (isWithinRange(resolveLostAt(deal, stageRows), fromMs, toMs)) {
      lostDeals += 1;
    }

    if (!isOpenDeal(deal, wonStageIds)) {
      continue;
    }

    openDeals += 1;
    manager.openDeals += 1;
    const stageName = resolveStageName(deal.stageId, stageLookup);
    const stageEntry = stageWip.get(deal.stageId) ?? {
      stageId: deal.stageId,
      stageName,
      openDeals: 0,
      riskDeals: 0
    };
    stageEntry.openDeals += 1;
    stageWip.set(deal.stageId, stageEntry);

    const currentStageEnteredAt =
      findLatestStageTime(stageRows, (row) => row.stageId === deal.stageId) ??
      deal.dateCreate;
    const daysOnStage = toFloorDays(currentStageEnteredAt, effectiveNowMs);
    const stageThreshold = stageThresholdById.get(deal.stageId) ?? null;
    const flags: OperationalRiskFlag[] = [];

    if (stageThreshold && daysOnStage >= stageThreshold.maxDaysOnStage) {
      const severity =
        daysOnStage >= stageThreshold.maxDaysOnStage * 2 ? "critical" : "risk";
      flags.push(
        createRiskFlag({
          rule: "stage_aging",
          label: `застрял: ${daysOnStage} дн · порог ${stageThreshold.maxDaysOnStage}`,
          severity
        })
      );
    }

    const dealActivities = activitiesByDeal.get(deal.id) ?? [];
    if (!hasOpenActivity(dealActivities)) {
      flags.push(
        createRiskFlag({
          rule: "no_open_activity",
          label: "нет запланированных дел"
        })
      );
    }

    const createdAtMs = toTimestamp(deal.dateCreate) ?? effectiveNowMs;
    const recentCallBaseline = Math.max(
      latestCallAt(callsByDeal.get(deal.id) ?? []) ?? createdAtMs,
      createdAtMs
    );
    if (
      Math.floor((effectiveNowMs - recentCallBaseline) / MS_PER_DAY) >=
      input.thresholds.noCallsMaxDays
    ) {
      flags.push(
        createRiskFlag({
          rule: "no_recent_calls",
          label: `нет звонков ${input.thresholds.noCallsMaxDays}+ дн`
        })
      );
    }

    const recentActivityBaseline = Math.max(
      latestActivityAt(dealActivities) ?? createdAtMs,
      createdAtMs
    );
    if (
      Math.floor((effectiveNowMs - recentActivityBaseline) / MS_PER_DAY) >=
      input.thresholds.noActivityMaxDays
    ) {
      flags.push(
        createRiskFlag({
          rule: "no_recent_activity",
          label: `нет активностей ${input.thresholds.noActivityMaxDays}+ дн`
        })
      );
    }

    if (flags.length === 0) {
      continue;
    }

    manager.riskDeals += 1;
    stageEntry.riskDeals += 1;
    for (const flag of flags) {
      riskByRule.set(flag.rule, (riskByRule.get(flag.rule) ?? 0) + 1);
    }
    riskByStage.set(deal.stageId, (riskByStage.get(deal.stageId) ?? 0) + 1);

    const severity = flags.some((flag) => flag.severity === "critical")
      ? "critical"
      : "risk";
    const stageMaxDays = stageThreshold?.maxDaysOnStage ?? null;
    const sourceLabel = deal.sourceId
      ? sourceLabels.get(deal.sourceId) ?? deal.sourceId
      : "Без источника";
    allRisks.push({
      dealId: deal.id,
      dealUrl: input.dealUrlBuilder?.(deal.id) ?? null,
      managerId,
      managerName: manager.managerName,
      stageId: deal.stageId,
      stageName,
      daysOnStage,
      stageMaxDays,
      sourceLabel,
      customerClubLabel: resolveBusinessClubLabel(deal),
      flags,
      severity,
      overdueRatio:
        stageMaxDays && stageMaxDays > 0 ? toRoundedNumber(daysOnStage / stageMaxDays) : 0
    });
  }

  const slaMetricsByManager = buildSlaMetricsByManager({
    range: input.range,
    slaAsOf: input.now,
    deals,
    stageCatalog: input.stageCatalog,
    stageHistory: input.stageHistory,
    activities: input.activities,
    calls: input.calls,
    slaBusinessHours: input.thresholds.slaBusinessHours
  });
  const slaMetricsByKey = new Map(
    buildSlaSummaryMetrics({
      range: input.range,
      slaAsOf: input.now,
      deals,
      stageCatalog: input.stageCatalog,
      stageHistory: input.stageHistory,
      activities: input.activities,
      calls: input.calls,
      slaBusinessHours: input.thresholds.slaBusinessHours
    }).map((metric) => [metric.slaKey, metric])
  );
  for (const [managerId, slaMetrics] of slaMetricsByManager) {
    const manager = ensureManager(managerId);
    manager.slaLateCount += slaMetrics.reduce(
      (total, metric) => total + metric.lateCount,
      0
    );
    manager.slaNoTouchCount += slaMetrics.reduce(
      (total, metric) => total + metric.noTouchCount,
      0
    );
  }

  const severityCounts = allRisks.reduce(
    (total, risk) => ({
      critical: total.critical + (risk.severity === "critical" ? 1 : 0),
      risk: total.risk + (risk.severity === "risk" ? 1 : 0)
    }),
    { critical: 0, risk: 0 }
  );
  const sortedRisks = [...allRisks].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "critical" ? -1 : 1;
    }
    if (left.overdueRatio !== right.overdueRatio) {
      return right.overdueRatio - left.overdueRatio;
    }
    if (left.flags.length !== right.flags.length) {
      return right.flags.length - left.flags.length;
    }
    return left.dealId.localeCompare(right.dealId);
  });
  const returnedRisks =
    input.capRisks === undefined ? sortedRisks : sortedRisks.slice(0, input.capRisks);
  const stageOrder = new Map(
    Array.from(stageLookup.entries()).map(([stageId, stage], index) => [
      stageId,
      stage.sortOrder || index
    ])
  );

  return {
    range: input.range,
    generatedAt,
    createdDeals,
    meetingsHeld: {
      total: meetingsHeld.reduce((total, slot) => total + slot.count, 0),
      bySlot: meetingsHeld
    },
    sales: {
      total: Array.from(salesByClub.values()).reduce(
        (total, row) => total + row.wonDeals,
        0
      ),
      byClub: Array.from(salesByClub.values())
        .map(({ totalDaysToWin: _totalDaysToWin, ...row }) => row)
        .sort((left, right) => right.wonDeals - left.wonDeals)
    },
    lostDeals,
    openDeals,
    riskSummary: {
      total: allRisks.length,
      critical: severityCounts.critical,
      risk: severityCounts.risk,
      byRule: (Object.keys(RISK_RULE_LABELS) as OperationalRiskRuleKey[])
        .map((rule) => ({
          rule,
          label: RISK_RULE_LABELS[rule],
          count: riskByRule.get(rule) ?? 0
        }))
        .filter((row) => row.count > 0),
      byStage: Array.from(riskByStage.entries())
        .map(([stageId, count]) => ({
          stageId,
          stageName: resolveStageName(stageId, stageLookup),
          count
        }))
        .sort(
          (left, right) =>
            (stageOrder.get(left.stageId) ?? Number.MAX_SAFE_INTEGER) -
            (stageOrder.get(right.stageId) ?? Number.MAX_SAFE_INTEGER)
        )
    },
    stageWip: Array.from(stageWip.values()).sort(
      (left, right) =>
        (stageOrder.get(left.stageId) ?? Number.MAX_SAFE_INTEGER) -
        (stageOrder.get(right.stageId) ?? Number.MAX_SAFE_INTEGER)
    ),
    sla: (Object.keys(SLA_LABELS) as Array<keyof typeof SLA_LABELS>).map((slaKey) => {
      const metric = slaMetricsByKey.get(slaKey);
      return {
        slaKey,
        label: SLA_LABELS[slaKey],
        thresholdBusinessHours: input.thresholds.slaBusinessHours[slaKey],
        onTimeCount: metric?.onTimeCount ?? 0,
        lateCount: metric?.lateCount ?? 0,
        noTouchCount: metric?.noTouchCount ?? 0,
        medianHours: metric?.medianHours ?? 0
      };
    }),
    planned: {
      meetingsToday,
      meetingsTomorrow,
      tasksToday,
      tasksTomorrow
    },
    managers: Array.from(managerRows.values())
      .filter(hasManagerData)
      .sort((left, right) => left.managerName.localeCompare(right.managerName)),
    risks: returnedRisks,
    thresholdsUpdatedAt: input.thresholds.updatedAt
  };
}
