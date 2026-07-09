import type {
  DealSnapshot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  EventVisitFactSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  SourceCohortConversionManagerRow,
  SourceCohortConversionOpenStageRow,
  SourceCohortConversionReportSnapshot,
  SourceCohortConversionRow,
  SourceCohortConversionTargetGroupRow,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import { buildSourceCohortTrajectoryReport } from "./source-cohort-trajectory.js";
import {
  UNASSIGNED_MANAGER_ID,
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  resolveManagerName,
  toMonthBucket
} from "./report-dimensions.js";

const UNSPECIFIED_BUSINESS_CLUB = "UNSPECIFIED";
const UNSPECIFIED_BUSINESS_CLUB_LABEL = "Без бизнес-клуба заказчика";
const UNSPECIFIED_TARGET_GROUP = "UNSPECIFIED";
const UNSPECIFIED_TARGET_GROUP_LABEL = "Без таргет-группы";

export interface SourceCohortConversionInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  dealStageFacts?: DealStageFactSnapshot[];
  dealTouchpointFacts?: DealTouchpointFactSnapshot[];
  eventVisitFacts?: EventVisitFactSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
  includeTrajectory?: boolean;
  now?: Date;
}

type SourceCohortDealOutcome = {
  deal: DealSnapshot;
  sourceKey: string;
  sourceLabel: string;
  qualityKey: string;
  qualityLabel: string;
  customerKey: string;
  customerLabel: string;
  managerId: string;
  managerName: string;
  currentStageId: string;
  currentStageName: string;
  outcome: "won" | "lost" | "open";
  wonAt: string | null;
  targetGroupKey: string;
  targetGroupLabel: string;
};

type SourceCohortBaseAccumulator = {
  createdDeals: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  totalWinDurationMs: number;
  winDurationCount: number;
  openStageBreakdown: Map<string, SourceCohortConversionOpenStageRow>;
};

type SourceCohortManagerAccumulator = SourceCohortBaseAccumulator & {
  managerId: string;
  managerName: string;
};

type SourceCohortTargetGroupAccumulator = {
  targetGroupKey: string;
  targetGroupLabel: string;
  wonDeals: number;
  totalWinDurationMs: number;
  winDurationCount: number;
};

type SourceCohortRowAccumulator = SourceCohortBaseAccumulator & {
  id: string;
  sourceKey: string;
  sourceLabel: string;
  qualityKey: string;
  qualityLabel: string;
  customerKey: string;
  customerLabel: string;
  managerBreakdown: Map<string, SourceCohortManagerAccumulator>;
  targetGroupBreakdown: Map<string, SourceCohortTargetGroupAccumulator>;
};

function isWithinRange(value: string | null, fromMs: number, toMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
}

function toRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function toAverageDays(totalMilliseconds: number, count: number) {
  if (count === 0) {
    return 0;
  }

  return Number((totalMilliseconds / count / 86_400_000).toFixed(2));
}

function getAllowedCategoryIds(stageCatalog: StageCatalogEntry[]) {
  return new Set(
    stageCatalog
      .filter((entry) => entry.entityType === "deal" && entry.categoryId)
      .map((entry) => normalizeCategoryId(entry.categoryId))
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
      const leftTime = Date.parse(left.createdTime);
      const rightTime = Date.parse(right.createdTime);

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.id.localeCompare(right.id);
    });
  }

  return map;
}

function getFirstStageHistoryTime(
  stageHistoryRows: StageHistorySnapshot[],
  matcher: (row: StageHistorySnapshot) => boolean
) {
  for (const row of stageHistoryRows) {
    if (matcher(row)) {
      return row.createdTime;
    }
  }

  return null;
}

function getLatestStageHistoryTime(
  stageHistoryRows: StageHistorySnapshot[],
  matcher: (row: StageHistorySnapshot) => boolean
) {
  for (let index = stageHistoryRows.length - 1; index >= 0; index -= 1) {
    const row = stageHistoryRows[index];
    if (row && matcher(row)) {
      return row.createdTime;
    }
  }

  return null;
}

function resolveWonAt(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>,
  wonStageIds: Set<string>
) {
  const wonAt = getLatestStageHistoryTime(
    stageHistoryMap.get(deal.id) ?? [],
    (row) => wonStageIds.has(row.stageId) || row.stageSemanticId === "S"
  );

  return wonAt ?? deal.dateClosed ?? deal.dateModify;
}

function resolveQualityValue(deal: DealSnapshot) {
  return deal.qualityValue ?? "UNQUALIFIED";
}

function resolveQualityLabel(value: string) {
  return value === "UNQUALIFIED" ? "Без итогового качества" : value;
}

function resolveBusinessClubValue(deal: DealSnapshot) {
  const value = deal.businessClubValue?.trim();
  return value && value.length > 0 ? value : UNSPECIFIED_BUSINESS_CLUB;
}

function resolveBusinessClubLabel(value: string) {
  return value === UNSPECIFIED_BUSINESS_CLUB
    ? UNSPECIFIED_BUSINESS_CLUB_LABEL
    : value;
}

function resolveTargetGroupValue(deal: DealSnapshot) {
  const value = deal.targetGroupValue?.trim();
  if (!value || value.length === 0) {
    return UNSPECIFIED_TARGET_GROUP;
  }

  return /^\d+$/.test(value) || value === "Неизвестная таргет-группа"
    ? UNSPECIFIED_TARGET_GROUP
    : value;
}

function resolveTargetGroupLabel(value: string) {
  return value === UNSPECIFIED_TARGET_GROUP
    ? UNSPECIFIED_TARGET_GROUP_LABEL
    : value;
}

function createSourceCohortBaseAccumulator(): SourceCohortBaseAccumulator {
  return {
    createdDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    openDeals: 0,
    totalWinDurationMs: 0,
    winDurationCount: 0,
    openStageBreakdown: new Map()
  };
}

function addSourceCohortOutcome(
  accumulator: SourceCohortBaseAccumulator,
  outcome: SourceCohortDealOutcome
) {
  accumulator.createdDeals += 1;

  if (outcome.outcome === "won") {
    accumulator.wonDeals += 1;

    if (outcome.wonAt) {
      const durationMs = Date.parse(outcome.wonAt) - Date.parse(outcome.deal.dateCreate);
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        accumulator.totalWinDurationMs += durationMs;
        accumulator.winDurationCount += 1;
      }
    }
  } else if (outcome.outcome === "lost") {
    accumulator.lostDeals += 1;
  } else {
    accumulator.openDeals += 1;
    const current = accumulator.openStageBreakdown.get(outcome.currentStageId) ?? {
      stageId: outcome.currentStageId,
      stageName: outcome.currentStageName,
      openDeals: 0
    };
    current.openDeals += 1;
    accumulator.openStageBreakdown.set(outcome.currentStageId, current);
  }
}

function toSourceCohortOpenStageRows(
  rows: Map<string, SourceCohortConversionOpenStageRow>
) {
  return Array.from(rows.values()).sort((left, right) => {
    if (right.openDeals !== left.openDeals) {
      return right.openDeals - left.openDeals;
    }

    return left.stageName.localeCompare(right.stageName, "ru");
  });
}

function toSourceCohortManagerRow(
  row: SourceCohortManagerAccumulator
): SourceCohortConversionManagerRow {
  return {
    managerId: row.managerId,
    managerName: row.managerName,
    createdDeals: row.createdDeals,
    wonDeals: row.wonDeals,
    lostDeals: row.lostDeals,
    openDeals: row.openDeals,
    winRate: toRate(row.wonDeals, row.createdDeals),
    averageDaysToWin: toAverageDays(row.totalWinDurationMs, row.winDurationCount),
    openStageBreakdown: toSourceCohortOpenStageRows(row.openStageBreakdown)
  };
}

function toSourceCohortTargetGroupRow(
  row: SourceCohortTargetGroupAccumulator
): SourceCohortConversionTargetGroupRow {
  return {
    targetGroupKey: row.targetGroupKey,
    targetGroupLabel: row.targetGroupLabel,
    wonDeals: row.wonDeals,
    averageDaysToWin: toAverageDays(row.totalWinDurationMs, row.winDurationCount)
  };
}

function toSourceCohortRow(
  row: SourceCohortRowAccumulator
): SourceCohortConversionRow {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    sourceLabel: row.sourceLabel,
    qualityKey: row.qualityKey,
    qualityLabel: row.qualityLabel,
    customerKey: row.customerKey,
    customerLabel: row.customerLabel,
    createdDeals: row.createdDeals,
    wonDeals: row.wonDeals,
    lostDeals: row.lostDeals,
    openDeals: row.openDeals,
    winRate: toRate(row.wonDeals, row.createdDeals),
    averageDaysToWin: toAverageDays(row.totalWinDurationMs, row.winDurationCount),
    managerBreakdown: Array.from(row.managerBreakdown.values())
      .sort((left, right) => {
        if (right.createdDeals !== left.createdDeals) {
          return right.createdDeals - left.createdDeals;
        }

        return left.managerName.localeCompare(right.managerName, "ru");
      })
      .map(toSourceCohortManagerRow),
    openStageBreakdown: toSourceCohortOpenStageRows(row.openStageBreakdown),
    targetGroupBreakdown: Array.from(row.targetGroupBreakdown.values())
      .sort((left, right) => {
        if (right.wonDeals !== left.wonDeals) {
          return right.wonDeals - left.wonDeals;
        }

        return left.targetGroupLabel.localeCompare(right.targetGroupLabel, "ru");
      })
      .map(toSourceCohortTargetGroupRow)
  };
}

function resolveSourceCohortWonAt(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>,
  wonStageIds: Set<string>
) {
  const historyWonAt = getFirstStageHistoryTime(
    stageHistoryMap.get(deal.id) ?? [],
    (row) => wonStageIds.has(row.stageId) || row.stageSemanticId === "S"
  );

  if (historyWonAt) {
    return historyWonAt;
  }

  return wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S"
    ? resolveWonAt(deal, stageHistoryMap, wonStageIds)
    : null;
}

function formatSourceCohortMonthLabel(month: string) {
  const monthParts = month.split("-");
  const year = Number(monthParts[0]);
  const monthNumber = Number(monthParts[1]);

  if (
    monthParts.length !== 2 ||
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return month;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)))
    .replace(/\s*г\.$/, "")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function buildSourceCohortMonthOptions(deals: DealSnapshot[]) {
  const counts = new Map<string, number>();

  for (const deal of deals) {
    const month = toMonthBucket(deal.dateCreate);
    if (!month) {
      continue;
    }

    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cohortMonth, totalCreatedDeals]) => ({
      cohortMonth,
      cohortLabel: formatSourceCohortMonthLabel(cohortMonth),
      totalCreatedDeals
    }));
}

export function buildSourceCohortConversionReport(
  input: SourceCohortConversionInput
): SourceCohortConversionReportSnapshot {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const stageLabels = new Map(
    input.stageCatalog
      .filter((entry) => entry.entityType === "deal")
      .map((entry) => [entry.statusId, entry.name])
  );
  const scopedDeals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => scopedDealIds.has(row.ownerId))
  );
  const cohortDeals = scopedDeals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const totals = createSourceCohortBaseAccumulator();
  const rows = new Map<string, SourceCohortRowAccumulator>();

  for (const deal of cohortDeals) {
    const source = resolveDealSource(deal, sourceLabels);
    const qualityKey = resolveQualityValue(deal);
    const customerKey = resolveBusinessClubValue(deal);
    const managerId = deal.assignedById ?? UNASSIGNED_MANAGER_ID;
    const wonAt = resolveSourceCohortWonAt(deal, stageHistoryMap, wonStageIds);
    const outcome: SourceCohortDealOutcome["outcome"] = wonAt
      ? "won"
      : deal.stageSemanticId === "F"
        ? "lost"
        : "open";
    const targetGroupKey = resolveTargetGroupValue(deal);
    const outcomeRow: SourceCohortDealOutcome = {
      deal,
      sourceKey: source.key,
      sourceLabel: source.label,
      qualityKey,
      qualityLabel: resolveQualityLabel(qualityKey),
      customerKey,
      customerLabel: resolveBusinessClubLabel(customerKey),
      managerId,
      managerName: resolveManagerName(managerId, managerDirectory),
      currentStageId: deal.stageId,
      currentStageName: stageLabels.get(deal.stageId) ?? deal.stageId,
      outcome,
      wonAt,
      targetGroupKey,
      targetGroupLabel: resolveTargetGroupLabel(targetGroupKey)
    };

    addSourceCohortOutcome(totals, outcomeRow);

    const rowKey = [
      outcomeRow.sourceKey,
      outcomeRow.qualityKey,
      outcomeRow.customerKey
    ].join("|");
    const currentRow = rows.get(rowKey) ?? {
      ...createSourceCohortBaseAccumulator(),
      id: rowKey,
      sourceKey: outcomeRow.sourceKey,
      sourceLabel: outcomeRow.sourceLabel,
      qualityKey: outcomeRow.qualityKey,
      qualityLabel: outcomeRow.qualityLabel,
      customerKey: outcomeRow.customerKey,
      customerLabel: outcomeRow.customerLabel,
      managerBreakdown: new Map<string, SourceCohortManagerAccumulator>(),
      targetGroupBreakdown: new Map<string, SourceCohortTargetGroupAccumulator>()
    };
    addSourceCohortOutcome(currentRow, outcomeRow);

    const managerRow = currentRow.managerBreakdown.get(outcomeRow.managerId) ?? {
      ...createSourceCohortBaseAccumulator(),
      managerId: outcomeRow.managerId,
      managerName: outcomeRow.managerName
    };
    addSourceCohortOutcome(managerRow, outcomeRow);
    currentRow.managerBreakdown.set(outcomeRow.managerId, managerRow);

    if (outcomeRow.outcome === "won" && outcomeRow.wonAt) {
      const targetRow = currentRow.targetGroupBreakdown.get(outcomeRow.targetGroupKey) ?? {
        targetGroupKey: outcomeRow.targetGroupKey,
        targetGroupLabel: outcomeRow.targetGroupLabel,
        wonDeals: 0,
        totalWinDurationMs: 0,
        winDurationCount: 0
      };
      const durationMs = Date.parse(outcomeRow.wonAt) - Date.parse(deal.dateCreate);

      targetRow.wonDeals += 1;
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        targetRow.totalWinDurationMs += durationMs;
        targetRow.winDurationCount += 1;
      }
      currentRow.targetGroupBreakdown.set(outcomeRow.targetGroupKey, targetRow);
    }

    rows.set(rowKey, currentRow);
  }

  const snapshot: SourceCohortConversionReportSnapshot = {
    range: input.range,
    totalCreatedDeals: totals.createdDeals,
    totalWonDeals: totals.wonDeals,
    totalLostDeals: totals.lostDeals,
    totalOpenDeals: totals.openDeals,
    winRate: toRate(totals.wonDeals, totals.createdDeals),
    averageDaysToWin: toAverageDays(
      totals.totalWinDurationMs,
      totals.winDurationCount
    ),
    cohortMonths: buildSourceCohortMonthOptions(scopedDeals),
    rows: Array.from(rows.values())
      .sort((left, right) => {
        if (right.createdDeals !== left.createdDeals) {
          return right.createdDeals - left.createdDeals;
        }

        const leftLabel = [left.sourceLabel, left.qualityLabel, left.customerLabel].join(
          " "
        );
        const rightLabel = [
          right.sourceLabel,
          right.qualityLabel,
          right.customerLabel
        ].join(" ");

        return leftLabel.localeCompare(rightLabel, "ru");
      })
      .map(toSourceCohortRow),
    trajectoryStatus: "unavailable",
    trajectoryUnavailableReason:
      "Траектория конверсии не рассчитана для этого ответа."
  };

  return input.includeTrajectory
    ? {
        ...snapshot,
        trajectoryStatus: "available",
        trajectoryUnavailableReason: null,
        trajectory: buildSourceCohortTrajectoryReport({
          range: input.range,
          wonStageIds: input.wonStageIds,
          deals: input.deals,
          stageCatalog: input.stageCatalog,
          stageHistory: input.stageHistory,
          dealStageFacts: input.dealStageFacts ?? [],
          dealTouchpointFacts: input.dealTouchpointFacts ?? [],
          eventVisitFacts: input.eventVisitFacts ?? [],
          managerDirectory: input.managerDirectory ?? [],
          ...(input.now ? { now: input.now } : {})
        })
      }
    : snapshot;
}
