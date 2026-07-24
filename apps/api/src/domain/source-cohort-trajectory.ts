import type {
  DealSnapshot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  SourceCohortTrajectoryActionKey,
  SourceCohortTrajectoryBreakdownRow,
  SourceCohortTrajectoryDataQuality,
  SourceCohortEventPerformance,
  SourceCohortEventPerformanceRow,
  SourceCohortConversionJourneyCoreStepKey,
  SourceCohortTrajectoryFactStepKey,
  SourceCohortTrajectoryManagerRow,
  SourceCohortTrajectoryQualityStatus,
  SourceCohortTrajectoryReport,
  SourceCohortTrajectorySignals,
  SourceCohortTrajectorySpeedStepKey,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  UNASSIGNED_MANAGER_ID,
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  resolveManagerName
} from "./report-dimensions.js";
import {
  buildSourceCohortConversionJourney,
  buildSourceCohortConversionJourneyDrilldown
} from "./source-cohort-conversion-journey.js";
import { buildSourceCohortConversionStageDrilldown } from "./source-cohort-conversion-stage-drilldown.js";
import { buildLossShape } from "./source-cohort-trajectory-loss-shape.js";
import { buildManagerDiagnostics } from "./source-cohort-trajectory-manager-diagnostics.js";

const LOW_SAMPLE_WARNING =
  "Разрезы с N < 10 нельзя использовать для жесткого ранжирования менеджеров, источников, заказчиков или качества.";
const CURRENT_MANAGER_ATTRIBUTION_WARNING =
  "Разрез менеджеров использует текущего ответственного сделки в снимке CRM; историческая атрибуция действий пока не считается.";
const FALLBACK_CALL_WARNING =
  "Есть успешные звонки только с косвенной связью по контакту; они показаны отдельно и не входят в основной показатель первого звонка.";
const DAY_MS = 86_400_000;
const LOW_SAMPLE_MIN_DEALS = 10;
const RELIABLE_SAMPLE_MIN_DEALS = 30;
const KNOWN_MEETING_STAGE_IDS = new Set(["C10:MEETING"]);
const KNOWN_CONTRACT_STAGE_IDS = new Set(["C10:CONTRACT"]);
const LOSS_STAGE_NAME_PATTERN = /корзин|возврат|неквал|проиг|отклон|отказ|утер/i;

type SpeedBucketDefinition = {
  bucketKey: string;
  label: string;
  minDays: number | null;
  maxDays: number | null;
};

type SpeedStepDefinition = {
  stepKey: SourceCohortTrajectorySpeedStepKey;
  label: string;
  slaDays: number;
  buckets: SpeedBucketDefinition[];
};

const FIRST_SUCCESSFUL_CALL_SLA_DAYS = 3;
const COMPLETED_MEETING_SLA_DAYS = 7;
const ATTENDED_EVENT_SLA_DAYS = 14;
const CONTRACT_STAGE_SLA_DAYS = 14;
const POST_MEETING_NEXT_STAGE_SLA_DAYS = 7;

const SPEED_STEP_DEFINITIONS = {
  firstSuccessfulCall: {
    stepKey: "first_successful_call",
    label: "Первый успешный звонок",
    slaDays: FIRST_SUCCESSFUL_CALL_SLA_DAYS,
    buckets: [
      { bucketKey: "0-1", label: "0-1 дн.", minDays: 0, maxDays: 1 },
      { bucketKey: "1-3", label: "1-3 дн.", minDays: 1, maxDays: 3 },
      { bucketKey: "3-7", label: "3-7 дн.", minDays: 3, maxDays: 7 },
      { bucketKey: "7+", label: "7+ дн.", minDays: 7, maxDays: null }
    ]
  },
  completedMeeting: {
    stepKey: "completed_meeting",
    label: "Факт встречи",
    slaDays: COMPLETED_MEETING_SLA_DAYS,
    buckets: [
      { bucketKey: "0-3", label: "0-3 дн.", minDays: 0, maxDays: 3 },
      { bucketKey: "3-7", label: "3-7 дн.", minDays: 3, maxDays: 7 },
      { bucketKey: "7-14", label: "7-14 дн.", minDays: 7, maxDays: 14 },
      { bucketKey: "14+", label: "14+ дн.", minDays: 14, maxDays: null }
    ]
  },
  attendedEvent: {
    stepKey: "attended_event",
    label: "Посещение события",
    slaDays: ATTENDED_EVENT_SLA_DAYS,
    buckets: [
      { bucketKey: "0-7", label: "0-7 дн.", minDays: 0, maxDays: 7 },
      { bucketKey: "7-14", label: "7-14 дн.", minDays: 7, maxDays: 14 },
      { bucketKey: "14-30", label: "14-30 дн.", minDays: 14, maxDays: 30 },
      { bucketKey: "30+", label: "30+ дн.", minDays: 30, maxDays: null }
    ]
  },
  contractStage: {
    stepKey: "contract_stage",
    label: "Контракт",
    slaDays: CONTRACT_STAGE_SLA_DAYS,
    buckets: [
      { bucketKey: "0-7", label: "0-7 дн.", minDays: 0, maxDays: 7 },
      { bucketKey: "7-14", label: "7-14 дн.", minDays: 7, maxDays: 14 },
      { bucketKey: "14-30", label: "14-30 дн.", minDays: 14, maxDays: 30 },
      { bucketKey: "30+", label: "30+ дн.", minDays: 30, maxDays: null }
    ]
  },
  postMeetingNextStage: {
    stepKey: "post_meeting_next_stage",
    label: "Следующий этап после встречи",
    slaDays: POST_MEETING_NEXT_STAGE_SLA_DAYS,
    buckets: [
      { bucketKey: "0-3", label: "0-3 дн.", minDays: 0, maxDays: 3 },
      { bucketKey: "3-7", label: "3-7 дн.", minDays: 3, maxDays: 7 },
      { bucketKey: "7-14", label: "7-14 дн.", minDays: 7, maxDays: 14 },
      { bucketKey: "14+", label: "14+ дн.", minDays: 14, maxDays: null }
    ]
  }
} satisfies Record<string, SpeedStepDefinition>;

interface SourceCohortTrajectoryInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory?: StageHistorySnapshot[];
  dealStageFacts?: DealStageFactSnapshot[];
  dealTouchpointFacts?: DealTouchpointFactSnapshot[];
  eventVisitFacts?: EventVisitFactSnapshot[];
  events?: EventSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
  now?: Date;
  journeyDrilldown?:
    | {
        drilldownKind?: "fact";
        stepKey: SourceCohortConversionJourneyCoreStepKey;
        dealUrlBuilder?: (dealId: string) => string | null;
      }
    | {
        drilldownKind: "crm_stage";
        stepKey: string;
        dealUrlBuilder?: (dealId: string) => string | null;
      };
}

interface StageSequenceEntry {
  stageId: string;
  stageName: string;
  sortOrder: number;
  semanticId: string | null;
}

interface DealTrajectoryFacts {
  deal: DealSnapshot;
  reachedStageIds: Set<string>;
  stageEnteredAt: Map<string, string>;
  stageEnteredAts: Map<string, string[]>;
  stageDurationMs: Map<string, number>;
  currentStageEnteredAt: string | null;
  stageTransitions: Array<{
    fromStageId: string | null;
    toStageId: string;
  }>;
  firstCallAt: string | null;
  firstSuccessfulCallAt: string | null;
  firstSuccessfulCallFallbackAt: string | null;
  meetingScheduledAt: string | null;
  completedMeetingAt: string | null;
  attendedEventAt: string | null;
  attendedEventAts: string[];
  journeyAttendedEventAts: string[];
  wonAt: string | null;
}

interface BreakdownAccumulator {
  key: string;
  label: string;
  totalDeals: number;
  noSuccessfulCallDeals: number;
  firstSuccessfulCallDeals: number;
  firstSuccessfulCallFallbackDeals: number;
  daysToFirstSuccessfulCall: number[];
  successfulCallWithoutMeetingStageDeals: number;
  meetingStageDeals: number;
  completedMeetingDeals: number;
  daysToCompletedMeeting: number[];
  attendedEventDeals: number;
  daysToAttendedEvent: number[];
  attendedEventWithoutContractDeals: number;
  repeatAttendedEventDeals: number;
  repeatAttendedEventVisits: number;
  contractStageDeals: number;
  contractWithoutWinDeals: number;
  slowFirstSuccessfulCallDeals: number;
  slowCompletedMeetingDeals: number;
  slowAttendedEventDeals: number;
  slowContractStageDeals: number;
  staleAfterCompletedMeetingDeals: number;
  staleOpenContractStageDeals: number;
  daysToContractStage: number[];
  daysOnContractStage: number[];
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  meetingStageWithoutFactDeals: number;
  completedMeetingWithoutNextStageDeals: number;
}

interface StageTimelineEntry {
  id: string;
  categoryId: string | null;
  stageId: string;
  stageSemanticId: string | null;
  enteredAt: string;
  leftAt: string | null;
}

function isWithinRange(value: string | null | undefined, fromMs: number, toMs: number) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
}

function toRate(numerator: number, denominator: number) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

function toDays(milliseconds: number) {
  return Number((milliseconds / DAY_MS).toFixed(2));
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle];
  if (right === undefined) {
    return null;
  }

  if (sorted.length % 2 === 1) {
    return toDays(right);
  }

  const left = sorted[middle - 1] ?? right;
  return toDays((left + right) / 2);
}

function isLossStage(
  stage: Pick<StageSequenceEntry, "stageName" | "semanticId"> & {
    stageId?: string | null;
  }
) {
  return stage.semanticId === "F" || LOSS_STAGE_NAME_PATTERN.test(stage.stageName);
}

function parsePayload(payloadJson: string | null) {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function payloadBoolean(payload: Record<string, unknown>, key: string) {
  return payload[key] === true;
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function isTrustedFact(fact: { dealId: string | null; linkConfidence: string }) {
  return Boolean(fact.dealId && fact.linkConfidence !== "low");
}

function isDirectTrustedFact(fact: { dealId: string | null; linkConfidence: string }) {
  return Boolean(fact.dealId && fact.linkConfidence === "high");
}

function isFallbackTrustedFact(fact: { dealId: string | null; linkConfidence: string }) {
  return Boolean(
    fact.dealId && fact.linkConfidence !== "high" && fact.linkConfidence !== "low"
  );
}

function getAllowedCategoryIds(stageCatalog: StageCatalogEntry[]) {
  return new Set(
    stageCatalog
      .filter((entry) => entry.entityType === "deal" && entry.categoryId)
      .map((entry) => normalizeCategoryId(entry.categoryId))
  );
}

function getStageSequence(stageCatalog: StageCatalogEntry[]): StageSequenceEntry[] {
  return stageCatalog
    .filter(
      (entry) =>
        entry.entityType === "deal" &&
        entry.statusId &&
        Number.isFinite(entry.sortOrder ?? Number.NaN)
    )
    .map((entry) => ({
      stageId: entry.statusId,
      stageName: entry.name,
      sortOrder: entry.sortOrder ?? 0,
      semanticId: entry.semanticId
    }))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.stageName.localeCompare(right.stageName, "ru");
    });
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
      const byTime = left.createdTime.localeCompare(right.createdTime);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
  }

  return map;
}

function buildStageFactMap(stageFacts: DealStageFactSnapshot[] | undefined) {
  const map = new Map<string, DealStageFactSnapshot[]>();

  for (const row of stageFacts ?? []) {
    const current = map.get(row.dealId) ?? [];
    current.push(row);
    map.set(row.dealId, current);
  }

  for (const rows of map.values()) {
    rows.sort((left, right) => {
      const byTime = left.enteredAt.localeCompare(right.enteredAt);
      return byTime !== 0 ? byTime : left.factId.localeCompare(right.factId);
    });
  }

  return map;
}

function groupFactsByDeal<T extends { dealId: string | null }>(facts: T[] | undefined) {
  const map = new Map<string, T[]>();

  for (const fact of facts ?? []) {
    if (!fact.dealId) {
      continue;
    }

    const current = map.get(fact.dealId) ?? [];
    current.push(fact);
    map.set(fact.dealId, current);
  }

  return map;
}

function getFirstTime(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right))[0] ?? null;
}

function isOnOrAfter(value: string | null | undefined, floor: string) {
  const valueMs = Date.parse(value ?? "");
  const floorMs = Date.parse(floor);
  return Number.isFinite(valueMs) && Number.isFinite(floorMs) && valueMs >= floorMs;
}

function resolveFirstSuccessfulCallAt(
  facts: DealTouchpointFactSnapshot[],
  dealCreatedAt: string
) {
  return getFirstTime(
    facts
      .filter((fact) => fact.kind === "call" && isDirectTrustedFact(fact))
      .filter((fact) => isOnOrAfter(fact.occurredAt, dealCreatedAt))
      .filter((fact) => {
        const payload = parsePayload(fact.payloadJson);
        const direction = payloadString(payload, "direction");
        return (
          direction === "outgoing" &&
          payloadBoolean(payload, "connected") &&
          payloadBoolean(payload, "overThirtySeconds")
        );
      })
      .map((fact) => fact.occurredAt)
  );
}

function resolveFirstCallAt(
  facts: DealTouchpointFactSnapshot[],
  dealCreatedAt: string
) {
  return getFirstTime(
    facts
      .filter((fact) => fact.kind === "call" && isDirectTrustedFact(fact))
      .filter((fact) => isOnOrAfter(fact.occurredAt, dealCreatedAt))
      .filter(
        (fact) =>
          payloadString(parsePayload(fact.payloadJson), "direction") === "outgoing"
      )
      .map((fact) => fact.occurredAt)
  );
}

function resolveFirstSuccessfulCallFallbackAt(
  facts: DealTouchpointFactSnapshot[],
  dealCreatedAt: string
) {
  return getFirstTime(
    facts
      .filter((fact) => fact.kind === "call" && isFallbackTrustedFact(fact))
      .filter((fact) => isOnOrAfter(fact.occurredAt, dealCreatedAt))
      .filter((fact) => {
        const payload = parsePayload(fact.payloadJson);
        const direction = payloadString(payload, "direction");
        return (
          direction === "outgoing" &&
          payloadBoolean(payload, "connected") &&
          payloadBoolean(payload, "overThirtySeconds")
        );
      })
      .map((fact) => fact.occurredAt)
  );
}

function resolveCompletedMeetingAt(
  facts: DealTouchpointFactSnapshot[],
  dealCreatedAt: string
) {
  return getFirstTime(
    facts
      .filter((fact) => fact.kind === "meeting" && isTrustedFact(fact))
      .filter((fact) => isOnOrAfter(fact.occurredAt, dealCreatedAt))
      .filter((fact) => payloadBoolean(parsePayload(fact.payloadJson), "completed"))
      .map((fact) => fact.occurredAt)
  );
}

function resolveMeetingScheduledAt(
  facts: DealTouchpointFactSnapshot[],
  dealCreatedAt: string
) {
  const candidates = facts
    .filter((fact) => isTrustedFact(fact))
    .flatMap((fact) => {
      const payload = parsePayload(fact.payloadJson);
      if (fact.kind === "meeting_date_changed") {
        const nextMeetingDate = payloadString(payload, "nextMeetingDate")?.trim();
        return nextMeetingDate ? [fact.occurredAt] : [];
      }

      if (fact.kind === "meeting") {
        const scheduledAt = payloadString(payload, "scheduledAt")?.trim();
        const createdTime = payloadString(payload, "createdTime")?.trim();
        return scheduledAt && createdTime ? [createdTime] : [];
      }

      return [];
    })
    .filter((value) => isOnOrAfter(value, dealCreatedAt));

  return getFirstTime(candidates);
}

function resolveAttendedEventAts(
  facts: EventVisitFactSnapshot[],
  dealCreatedAt: string
) {
  return facts
    .filter((fact) => fact.finalStatus === "attended" && isTrustedFact(fact))
    .map((fact) => fact.attendedAt ?? fact.eventDate)
    .filter((value): value is string => Boolean(value))
    .filter((value) => isOnOrAfter(value, dealCreatedAt))
    .sort((left, right) => left.localeCompare(right));
}

function resolveJourneyAttendedEventAts(
  facts: EventVisitFactSnapshot[],
  dealCreatedAt: string
) {
  const firstVisitByEvent = new Map<string, string>();

  for (const fact of facts) {
    if (fact.finalStatus !== "attended" || !isTrustedFact(fact)) {
      continue;
    }

    const occurredAt = fact.eventDate ?? fact.attendedAt;
    if (!occurredAt || !isOnOrAfter(occurredAt, dealCreatedAt)) {
      continue;
    }

    const eventKey = fact.eventId?.trim() || fact.visitId;
    const current = firstVisitByEvent.get(eventKey);
    if (!current || occurredAt.localeCompare(current) < 0) {
      firstVisitByEvent.set(eventKey, occurredAt);
    }
  }

  return Array.from(firstVisitByEvent.values()).sort((left, right) =>
    left.localeCompare(right)
  );
}

function firstWonAt(
  rows: StageTimelineEntry[],
  wonStageIds: Set<string>,
  deal: DealSnapshot
) {
  const historyWonAt =
    rows.find((row) => wonStageIds.has(row.stageId) || row.stageSemanticId === "S")
      ?.enteredAt ?? null;

  if (historyWonAt) {
    return historyWonAt;
  }

  return wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S"
    ? deal.dateClosed ?? deal.dateModify
    : null;
}

function buildTimelineFromHistory(
  deal: DealSnapshot,
  rows: StageHistorySnapshot[]
): StageTimelineEntry[] {
  const sourceRows =
    rows.length > 0
      ? rows
      : [
          {
            id: `current:${deal.id}:${deal.stageId}`,
            ownerId: deal.id,
            categoryId: deal.categoryId,
            stageId: deal.stageId,
            stageSemanticId: deal.stageSemanticId,
            typeId: null,
            createdTime: deal.dateCreate
          } satisfies StageHistorySnapshot
        ];

  return sourceRows.map((row, index) => ({
    id: row.id,
    categoryId: row.categoryId ?? deal.categoryId,
    stageId: row.stageId,
    stageSemanticId: row.stageSemanticId,
    enteredAt: row.createdTime,
    leftAt: sourceRows[index + 1]?.createdTime ?? null
  }));
}

function buildTimelineFromStageFacts(rows: DealStageFactSnapshot[]): StageTimelineEntry[] {
  return rows.map((row) => ({
    id: row.factId,
    categoryId: row.categoryId,
    stageId: row.stageId,
    stageSemanticId: row.stageSemanticId,
    enteredAt: row.enteredAt,
    leftAt: row.leftAt
  }));
}

function withInitialBaseStage(
  rows: StageTimelineEntry[],
  deal: DealSnapshot,
  baseStageId: string | null
) {
  if (!baseStageId) {
    return rows;
  }

  const first = rows[0];
  if (!first) {
    return [
      {
        id: `synthetic-base:${deal.id}:${baseStageId}`,
        categoryId: deal.categoryId,
        stageId: baseStageId,
        stageSemanticId: "P",
        enteredAt: deal.dateCreate,
        leftAt: null
      }
    ];
  }

  const dealCreatedMs = Date.parse(deal.dateCreate);
  const firstEnteredMs = Date.parse(first.enteredAt);
  if (!Number.isFinite(dealCreatedMs) || !Number.isFinite(firstEnteredMs)) {
    return rows;
  }

  if (first.stageId === baseStageId) {
    return firstEnteredMs > dealCreatedMs
      ? [{ ...first, enteredAt: deal.dateCreate }, ...rows.slice(1)]
      : rows;
  }

  if (firstEnteredMs < dealCreatedMs) {
    return rows;
  }

  return [
    {
      id: `synthetic-base:${deal.id}:${baseStageId}`,
      categoryId: deal.categoryId,
      stageId: baseStageId,
      stageSemanticId: "P",
      enteredAt: deal.dateCreate,
      leftAt: first.enteredAt
    },
    ...rows
  ];
}

function addStageDuration(
  durationsByStage: Map<string, number>,
  stageId: string,
  durationMs: number
) {
  durationsByStage.set(stageId, (durationsByStage.get(stageId) ?? 0) + durationMs);
}

function latestCurrentStageEntry(
  rows: StageTimelineEntry[],
  deal: DealSnapshot
) {
  return [...rows].reverse().find((row) => row.stageId === deal.stageId)?.enteredAt ?? null;
}

function buildStageTransitions(
  rows: StageTimelineEntry[],
  baseStageId: string | null
) {
  const visitedStageIds: string[] = [];
  const addVisitedStage = (stageId: string | null | undefined) => {
    if (!stageId || visitedStageIds.at(-1) === stageId) {
      return;
    }

    visitedStageIds.push(stageId);
  };

  addVisitedStage(baseStageId);
  rows.forEach((row) => addVisitedStage(row.stageId));

  const seenTransitionKeys = new Set<string>();
  const transitions: Array<{ fromStageId: string | null; toStageId: string }> = [];

  visitedStageIds.forEach((toStageId, index) => {
    const fromStageId = index === 0 ? null : visitedStageIds[index - 1] ?? null;
    if (fromStageId === toStageId) {
      return;
    }

    const key = `${fromStageId ?? "START"}->${toStageId}`;
    if (seenTransitionKeys.has(key)) {
      return;
    }

    seenTransitionKeys.add(key);
    transitions.push({ fromStageId, toStageId });
  });

  return transitions;
}

function buildDealTrajectoryFacts(input: {
  deal: DealSnapshot;
  baseStageId: string | null;
  wonStageIds: Set<string>;
  stageFactMap: Map<string, DealStageFactSnapshot[]>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  touchpointFactsByDeal: Map<string, DealTouchpointFactSnapshot[]>;
  eventVisitFactsByDeal: Map<string, EventVisitFactSnapshot[]>;
}): DealTrajectoryFacts {
  const stageFacts = input.stageFactMap.get(input.deal.id) ?? [];
  const sourceRows =
    stageFacts.length > 0
      ? buildTimelineFromStageFacts(stageFacts)
      : buildTimelineFromHistory(
          input.deal,
          input.stageHistoryMap.get(input.deal.id) ?? []
        );
  const timelineRows = withInitialBaseStage(
    sourceRows,
    input.deal,
    input.baseStageId
  );
  const reachedStageIds = new Set<string>();
  const stageEnteredAt = new Map<string, string>();
  const stageEnteredAts = new Map<string, string[]>();
  const stageDurationMs = new Map<string, number>();

  if (input.baseStageId) {
    reachedStageIds.add(input.baseStageId);
    stageEnteredAt.set(input.baseStageId, input.deal.dateCreate);
  }

  timelineRows.forEach((row, index) => {
    reachedStageIds.add(row.stageId);
    const enteredAts = stageEnteredAts.get(row.stageId) ?? [];
    enteredAts.push(row.enteredAt);
    stageEnteredAts.set(row.stageId, enteredAts);
    if (!stageEnteredAt.has(row.stageId)) {
      stageEnteredAt.set(row.stageId, row.enteredAt);
    }

    const next = timelineRows[index + 1];
    const leftAt = row.leftAt ?? next?.enteredAt ?? null;
    if (!leftAt) {
      return;
    }

    const durationMs = Date.parse(leftAt) - Date.parse(row.enteredAt);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    addStageDuration(stageDurationMs, row.stageId, durationMs);
  });

  const attendedEventAts = resolveAttendedEventAts(
    input.eventVisitFactsByDeal.get(input.deal.id) ?? [],
    input.deal.dateCreate
  );
  const journeyAttendedEventAts = resolveJourneyAttendedEventAts(
    input.eventVisitFactsByDeal.get(input.deal.id) ?? [],
    input.deal.dateCreate
  );
  const touchpointFacts = input.touchpointFactsByDeal.get(input.deal.id) ?? [];

  return {
    deal: input.deal,
    reachedStageIds,
    stageEnteredAt,
    stageEnteredAts,
    stageDurationMs,
    currentStageEnteredAt: latestCurrentStageEntry(timelineRows, input.deal),
    stageTransitions: buildStageTransitions(timelineRows, input.baseStageId),
    firstCallAt: resolveFirstCallAt(touchpointFacts, input.deal.dateCreate),
    firstSuccessfulCallAt: resolveFirstSuccessfulCallAt(
      touchpointFacts,
      input.deal.dateCreate
    ),
    firstSuccessfulCallFallbackAt: resolveFirstSuccessfulCallFallbackAt(
      touchpointFacts,
      input.deal.dateCreate
    ),
    meetingScheduledAt: resolveMeetingScheduledAt(
      touchpointFacts,
      input.deal.dateCreate
    ),
    completedMeetingAt: resolveCompletedMeetingAt(
      touchpointFacts,
      input.deal.dateCreate
    ),
    attendedEventAt: attendedEventAts[0] ?? null,
    attendedEventAts,
    journeyAttendedEventAts,
    wonAt: firstWonAt(timelineRows, input.wonStageIds, input.deal)
  };
}

function createBreakdownAccumulator(key: string, label: string): BreakdownAccumulator {
  return {
    key,
    label,
    totalDeals: 0,
    noSuccessfulCallDeals: 0,
    firstSuccessfulCallDeals: 0,
    firstSuccessfulCallFallbackDeals: 0,
    daysToFirstSuccessfulCall: [],
    successfulCallWithoutMeetingStageDeals: 0,
    meetingStageDeals: 0,
    completedMeetingDeals: 0,
    daysToCompletedMeeting: [],
    attendedEventDeals: 0,
    daysToAttendedEvent: [],
    attendedEventWithoutContractDeals: 0,
    repeatAttendedEventDeals: 0,
    repeatAttendedEventVisits: 0,
    contractStageDeals: 0,
    contractWithoutWinDeals: 0,
    slowFirstSuccessfulCallDeals: 0,
    slowCompletedMeetingDeals: 0,
    slowAttendedEventDeals: 0,
    slowContractStageDeals: 0,
    staleAfterCompletedMeetingDeals: 0,
    staleOpenContractStageDeals: 0,
    daysToContractStage: [],
    daysOnContractStage: [],
    wonDeals: 0,
    lostDeals: 0,
    openDeals: 0,
    meetingStageWithoutFactDeals: 0,
    completedMeetingWithoutNextStageDeals: 0
  };
}

function dataQualityStatus(totalDeals: number): SourceCohortTrajectoryQualityStatus {
  if (totalDeals >= RELIABLE_SAMPLE_MIN_DEALS) {
    return "reliable";
  }

  return totalDeals >= LOW_SAMPLE_MIN_DEALS ? "limited" : "low_sample";
}

function daysFromCreate(deal: DealSnapshot, value: string | null) {
  if (!value) {
    return null;
  }

  const durationMs = Date.parse(value) - Date.parse(deal.dateCreate);
  return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
}

function durationMsBetween(from: string | null, to: string | null) {
  const fromMs = Date.parse(from ?? "");
  const toMs = Date.parse(to ?? "");
  const durationMs = toMs - fromMs;
  return Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
}

function isSlowerThan(durationMs: number | null, slaDays: number) {
  return durationMs !== null && durationMs > slaDays * DAY_MS;
}

function bucketContainsDuration(bucket: SpeedBucketDefinition, durationMs: number) {
  const days = durationMs / DAY_MS;
  const minMatches = bucket.minDays === null || days >= bucket.minDays;
  const maxMatches = bucket.maxDays === null || days <= bucket.maxDays;
  return minMatches && maxMatches;
}

function isOpenDeal(facts: DealTrajectoryFacts, stageSequence: StageSequenceEntry[]) {
  const currentStage = stageSequence.find(
    (stage) => stage.stageId === facts.deal.stageId
  );

  return (
    !facts.wonAt &&
    facts.deal.stageSemanticId !== "F" &&
    (!currentStage || !isLossStage(currentStage))
  );
}

function toBreakdownRow(row: BreakdownAccumulator): SourceCohortTrajectoryBreakdownRow {
  const breakdownRow: Omit<SourceCohortTrajectoryBreakdownRow, "lossShape"> = {
    key: row.key,
    label: row.label,
    totalDeals: row.totalDeals,
    noSuccessfulCallDeals: row.noSuccessfulCallDeals,
    firstSuccessfulCallDeals: row.firstSuccessfulCallDeals,
    firstSuccessfulCallFallbackDeals: row.firstSuccessfulCallFallbackDeals,
    firstSuccessfulCallRate: toRate(
      row.firstSuccessfulCallDeals,
      row.totalDeals
    ),
    successfulCallWithoutMeetingStageDeals:
      row.successfulCallWithoutMeetingStageDeals,
    medianDaysToFirstSuccessfulCall: median(row.daysToFirstSuccessfulCall),
    meetingStageDeals: row.meetingStageDeals,
    meetingStageRate: toRate(row.meetingStageDeals, row.totalDeals),
    completedMeetingDeals: row.completedMeetingDeals,
    completedMeetingRate: toRate(row.completedMeetingDeals, row.totalDeals),
    medianDaysToCompletedMeeting: median(row.daysToCompletedMeeting),
    attendedEventDeals: row.attendedEventDeals,
    attendedEventRate: toRate(row.attendedEventDeals, row.totalDeals),
    medianDaysToAttendedEvent: median(row.daysToAttendedEvent),
    attendedEventWithoutContractDeals: row.attendedEventWithoutContractDeals,
    repeatAttendedEventDeals: row.repeatAttendedEventDeals,
    repeatAttendedEventVisits: row.repeatAttendedEventVisits,
    contractStageDeals: row.contractStageDeals,
    contractStageRate: toRate(row.contractStageDeals, row.totalDeals),
    contractWithoutWinDeals: row.contractWithoutWinDeals,
    slowFirstSuccessfulCallDeals: row.slowFirstSuccessfulCallDeals,
    slowCompletedMeetingDeals: row.slowCompletedMeetingDeals,
    slowAttendedEventDeals: row.slowAttendedEventDeals,
    slowContractStageDeals: row.slowContractStageDeals,
    staleAfterCompletedMeetingDeals: row.staleAfterCompletedMeetingDeals,
    staleOpenContractStageDeals: row.staleOpenContractStageDeals,
    medianDaysToContractStage: median(row.daysToContractStage),
    medianDaysOnContractStage: median(row.daysOnContractStage),
    wonDeals: row.wonDeals,
    wonRate: toRate(row.wonDeals, row.totalDeals),
    lostDeals: row.lostDeals,
    openDeals: row.openDeals,
    meetingStageWithoutFactDeals: row.meetingStageWithoutFactDeals,
    completedMeetingWithoutNextStageDeals:
      row.completedMeetingWithoutNextStageDeals,
    dataQualityStatus: dataQualityStatus(row.totalDeals)
  };

  return {
    ...breakdownRow,
    lossShape: buildLossShape(breakdownRow)
  };
}

function toManagerRow(
  row: BreakdownAccumulator,
  managerDirectory: Map<string, string>
): SourceCohortTrajectoryManagerRow {
  return {
    ...toBreakdownRow(row),
    managerId: row.key,
    managerName: resolveManagerName(row.key, managerDirectory)
  };
}

interface EventPerformanceObservation {
  eventKey: string;
  eventLabel: string;
  eventTypeKey: string;
  eventTypeLabel: string;
  eventDate: string;
  managerKey: string;
  managerLabel: string;
  attended: boolean;
  contractEligible: boolean;
  contractAfter: boolean;
  transferredAfter: boolean;
  contractDurationMs: number | null;
}

interface EventPerformanceAccumulator {
  key: string;
  label: string;
  eventDate: string | null;
  eventKeys: Set<string>;
  invitedVisits: number;
  attendedVisits: number;
  contractEligibleVisits: number;
  contractAfterVisits: number;
  transferredAfterVisits: number;
  contractDurationsMs: number[];
}

function createEventPerformanceAccumulator(
  key: string,
  label: string,
  eventDate: string | null = null
): EventPerformanceAccumulator {
  return {
    key,
    label,
    eventDate,
    eventKeys: new Set<string>(),
    invitedVisits: 0,
    attendedVisits: 0,
    contractEligibleVisits: 0,
    contractAfterVisits: 0,
    transferredAfterVisits: 0,
    contractDurationsMs: []
  };
}

function addEventPerformanceObservation(
  row: EventPerformanceAccumulator,
  observation: EventPerformanceObservation
) {
  row.eventKeys.add(observation.eventKey);
  row.invitedVisits += 1;
  if (!observation.attended) {
    return;
  }

  row.attendedVisits += 1;
  if (observation.contractEligible) {
    row.contractEligibleVisits += 1;
  }
  if (observation.contractAfter) {
    row.contractAfterVisits += 1;
  }
  if (observation.transferredAfter) {
    row.transferredAfterVisits += 1;
  }
  if (observation.contractDurationMs !== null) {
    row.contractDurationsMs.push(observation.contractDurationMs);
  }
}

function toEventPerformanceRow(
  row: EventPerformanceAccumulator
): SourceCohortEventPerformanceRow {
  return {
    key: row.key,
    label: row.label,
    eventDate: row.eventDate,
    eventCount: row.eventKeys.size,
    invitedVisits: row.invitedVisits,
    attendedVisits: row.attendedVisits,
    attendanceRate: toRate(row.attendedVisits, row.invitedVisits),
    contractEligibleVisits: row.contractEligibleVisits,
    contractAfterVisits: row.contractAfterVisits,
    contractRate:
      row.contractEligibleVisits > 0
        ? toRate(row.contractAfterVisits, row.contractEligibleVisits)
        : null,
    transferredAfterVisits: row.transferredAfterVisits,
    transferredRate:
      row.attendedVisits > 0
        ? toRate(row.transferredAfterVisits, row.attendedVisits)
        : null,
    medianDaysToContract: median(row.contractDurationsMs)
  };
}

function firstTimestamp(timestamps: string[]) {
  const candidates = timestamps
    .map((timestamp) => Date.parse(timestamp))
    .filter((timestampMs) => Number.isFinite(timestampMs));

  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function resolveEventPerformanceDate(
  fact: EventVisitFactSnapshot,
  eventById: Map<string, EventSnapshot>
) {
  const event = fact.eventId ? eventById.get(fact.eventId) ?? null : null;
  return fact.eventDate ?? event?.eventDate ?? fact.attendedAt;
}

function buildEventPerformance(input: {
  range: ReportRange;
  now: Date;
  eventVisitFacts: EventVisitFactSnapshot[];
  events: EventSnapshot[];
  dealFacts: DealTrajectoryFacts[];
  contractStageId: string | null;
  managerDirectory: Map<string, string>;
}): SourceCohortEventPerformance {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const nowMs = input.now.getTime();
  const eventById = new Map(input.events.map((event) => [event.eventId, event]));
  const factsByDeal = new Map(input.dealFacts.map((facts) => [facts.deal.id, facts]));
  const observations = new Map<string, EventPerformanceObservation>();

  for (const fact of input.eventVisitFacts) {
    if (!isTrustedFact(fact) || !fact.dealId) {
      continue;
    }

    const dealFacts = factsByDeal.get(fact.dealId);
    const event = fact.eventId ? eventById.get(fact.eventId) ?? null : null;
    const eventDate = resolveEventPerformanceDate(fact, eventById);
    const eventAtMs = Date.parse(eventDate ?? "");
    if (
      !dealFacts ||
      !eventDate ||
      !Number.isFinite(eventAtMs) ||
      eventAtMs < fromMs ||
      eventAtMs > toMs ||
      eventAtMs > nowMs
    ) {
      continue;
    }

    const payload = parsePayload(fact.payloadJson);
    const eventLabel =
      event?.title?.trim() ||
      payloadString(payload, "eventName")?.trim() ||
      "Мероприятие без названия";
    const eventKey = fact.eventId?.trim() || `${eventLabel}::${eventDate}`;
    const eventTypeKey = event?.eventTypeId?.trim() || "UNSPECIFIED_EVENT_TYPE";
    const eventTypeLabel = event?.eventTypeLabel?.trim() || "Без типа мероприятия";
    const managerKey = fact.managerId?.trim() || UNASSIGNED_MANAGER_ID;
    const managerLabel = resolveManagerName(managerKey, input.managerDirectory);
    const attended = fact.finalStatus === "attended";
    const firstContractAtMs = attended && input.contractStageId
      ? firstTimestamp(dealFacts.stageEnteredAts.get(input.contractStageId) ?? [])
      : null;
    const contractEligible =
      attended && (firstContractAtMs === null || firstContractAtMs >= eventAtMs);
    const contractAtMs =
      contractEligible &&
      firstContractAtMs !== null &&
      firstContractAtMs <= nowMs
        ? firstContractAtMs
        : null;
    const transferredAtMs = Date.parse(dealFacts.wonAt ?? "");
    const contractDurationMs =
      attended &&
      contractAtMs !== null
        ? contractAtMs - eventAtMs
        : null;
    const transferredAfter =
      attended &&
      Number.isFinite(transferredAtMs) &&
      transferredAtMs >= eventAtMs &&
      transferredAtMs <= nowMs;
    const observationKey = `${eventKey}:${fact.dealId}`;

    const observation: EventPerformanceObservation = {
      eventKey,
      eventLabel,
      eventTypeKey,
      eventTypeLabel,
      eventDate,
      managerKey,
      managerLabel,
      attended,
      contractEligible,
      contractAfter: contractDurationMs !== null,
      transferredAfter,
      contractDurationMs
    };
    const currentObservation = observations.get(observationKey);
    if (!currentObservation || (!currentObservation.attended && observation.attended)) {
      observations.set(observationKey, observation);
    }
  }

  const overall = createEventPerformanceAccumulator("overall", "Все мероприятия");
  const typeRows = new Map<string, EventPerformanceAccumulator>();
  const eventRows = new Map<string, EventPerformanceAccumulator>();
  const managerRows = new Map<string, EventPerformanceAccumulator>();

  for (const observation of observations.values()) {
    addEventPerformanceObservation(overall, observation);

    const typeRow =
      typeRows.get(observation.eventTypeKey) ??
      createEventPerformanceAccumulator(
        observation.eventTypeKey,
        observation.eventTypeLabel
      );
    addEventPerformanceObservation(typeRow, observation);
    typeRows.set(observation.eventTypeKey, typeRow);

    const eventRow =
      eventRows.get(observation.eventKey) ??
      createEventPerformanceAccumulator(
        observation.eventKey,
        observation.eventLabel,
        observation.eventDate
      );
    addEventPerformanceObservation(eventRow, observation);
    eventRows.set(observation.eventKey, eventRow);

    const managerRow =
      managerRows.get(observation.managerKey) ??
      createEventPerformanceAccumulator(
        observation.managerKey,
        observation.managerLabel
      );
    addEventPerformanceObservation(managerRow, observation);
    managerRows.set(observation.managerKey, managerRow);
  }

  const toRows = (rows: Map<string, EventPerformanceAccumulator>) =>
    Array.from(rows.values()).map(toEventPerformanceRow);
  const eventTypeRows = toRows(typeRows).sort(
    (left, right) =>
      right.attendedVisits - left.attendedVisits ||
      left.label.localeCompare(right.label, "ru")
  );
  const individualEventRows = toRows(eventRows).sort((left, right) => {
    const byDate = (right.eventDate ?? "").localeCompare(left.eventDate ?? "");
    return byDate !== 0 ? byDate : left.label.localeCompare(right.label, "ru");
  });
  const eventManagerRows = toRows(managerRows).sort(
    (left, right) =>
      right.attendedVisits - left.attendedVisits ||
      left.label.localeCompare(right.label, "ru")
  );
  const overallRow = toEventPerformanceRow(overall);
  const warnings = [
    "Конверсия после мероприятия — наблюдаемый результат после фактического посещения до текущего снимка, а не доказанный причинный эффект.",
    "Один контракт может учитываться после нескольких посещений; строки нельзя складывать между собой.",
    "Ответственный по мероприятию — текущий владелец записи посещения в снимке CRM."
  ];

  return {
    range: input.range,
    totalEvents: overallRow.eventCount,
    invitedVisits: overallRow.invitedVisits,
    attendedVisits: overallRow.attendedVisits,
    attendanceRate: overallRow.attendanceRate,
    contractEligibleVisits: overallRow.contractEligibleVisits,
    contractAfterVisits: overallRow.contractAfterVisits,
    transferredAfterVisits: overallRow.transferredAfterVisits,
    eventTypeRows,
    eventRows: individualEventRows,
    managerRows: eventManagerRows,
    warnings
  };
}

function addTrajectoryToBreakdown(input: {
  row: BreakdownAccumulator;
  facts: DealTrajectoryFacts;
  meetingStageId: string | null;
  contractStageId: string | null;
  hasCompletedMeetingWithoutNextStage: boolean;
  dealIsOpen: boolean;
  staleAfterCompletedMeeting: boolean;
  staleOpenContractStage: boolean;
}) {
  input.row.totalDeals += 1;

  const firstCallDuration = daysFromCreate(
    input.facts.deal,
    input.facts.firstSuccessfulCallAt
  );
  if (firstCallDuration !== null) {
    input.row.firstSuccessfulCallDeals += 1;
    input.row.daysToFirstSuccessfulCall.push(firstCallDuration);
    if (
      isSlowerThan(
        firstCallDuration,
        SPEED_STEP_DEFINITIONS.firstSuccessfulCall.slaDays
      )
    ) {
      input.row.slowFirstSuccessfulCallDeals += 1;
    }
  } else {
    input.row.noSuccessfulCallDeals += 1;
  }

  if (!input.facts.firstSuccessfulCallAt && input.facts.firstSuccessfulCallFallbackAt) {
    input.row.firstSuccessfulCallFallbackDeals += 1;
  }

  const reachedMeetingStage = Boolean(
    input.meetingStageId && input.facts.reachedStageIds.has(input.meetingStageId)
  );
  if (
    input.facts.firstSuccessfulCallAt &&
    input.meetingStageId &&
    !reachedMeetingStage
  ) {
    input.row.successfulCallWithoutMeetingStageDeals += 1;
  }

  if (reachedMeetingStage) {
    input.row.meetingStageDeals += 1;
  }

  const meetingDuration = daysFromCreate(
    input.facts.deal,
    input.facts.completedMeetingAt
  );
  if (meetingDuration !== null) {
    input.row.completedMeetingDeals += 1;
    input.row.daysToCompletedMeeting.push(meetingDuration);
    if (
      isSlowerThan(meetingDuration, SPEED_STEP_DEFINITIONS.completedMeeting.slaDays)
    ) {
      input.row.slowCompletedMeetingDeals += 1;
    }
  }

  const eventDuration = daysFromCreate(input.facts.deal, input.facts.attendedEventAt);
  if (eventDuration !== null) {
    input.row.attendedEventDeals += 1;
    input.row.daysToAttendedEvent.push(eventDuration);
    if (isSlowerThan(eventDuration, SPEED_STEP_DEFINITIONS.attendedEvent.slaDays)) {
      input.row.slowAttendedEventDeals += 1;
    }
  }

  if (input.facts.attendedEventAts.length > 1) {
    input.row.repeatAttendedEventDeals += 1;
    input.row.repeatAttendedEventVisits += input.facts.attendedEventAts.length - 1;
  }

  const contractStageId = input.contractStageId;
  const reachedContractStage = Boolean(
    contractStageId && input.facts.reachedStageIds.has(contractStageId)
  );
  if (contractStageId && reachedContractStage) {
    input.row.contractStageDeals += 1;
    const enteredAt = input.facts.stageEnteredAt.get(contractStageId) ?? null;
    const contractDuration = daysFromCreate(input.facts.deal, enteredAt);
    if (contractDuration !== null) {
      input.row.daysToContractStage.push(contractDuration);
      if (
        isSlowerThan(contractDuration, SPEED_STEP_DEFINITIONS.contractStage.slaDays)
      ) {
        input.row.slowContractStageDeals += 1;
      }
    }
    const durationMs = input.facts.stageDurationMs.get(contractStageId);
    if (durationMs !== undefined) {
      input.row.daysOnContractStage.push(durationMs);
    }
  }

  if (input.facts.attendedEventAts.length > 0 && !reachedContractStage) {
    input.row.attendedEventWithoutContractDeals += 1;
  }

  if (reachedContractStage && !input.facts.wonAt) {
    input.row.contractWithoutWinDeals += 1;
  }

  if (input.facts.wonAt) {
    input.row.wonDeals += 1;
  } else if (input.dealIsOpen) {
    input.row.openDeals += 1;
  } else {
    input.row.lostDeals += 1;
  }

  if (
    reachedMeetingStage &&
    !input.facts.completedMeetingAt
  ) {
    input.row.meetingStageWithoutFactDeals += 1;
  }

  if (input.hasCompletedMeetingWithoutNextStage) {
    input.row.completedMeetingWithoutNextStageDeals += 1;
  }

  if (input.staleAfterCompletedMeeting) {
    input.row.staleAfterCompletedMeetingDeals += 1;
  }

  if (input.staleOpenContractStage) {
    input.row.staleOpenContractStageDeals += 1;
  }
}

function collectStageEntryDurations(input: {
  dealFacts: DealTrajectoryFacts[];
  stageId: string | null;
}) {
  const stageId = input.stageId;
  if (!stageId) {
    return [];
  }

  return input.dealFacts
    .map((facts) => daysFromCreate(facts.deal, facts.stageEnteredAt.get(stageId) ?? null))
    .filter((duration): duration is number => duration !== null);
}

function collectWonDurations(dealFacts: DealTrajectoryFacts[]) {
  return dealFacts
    .map((facts) => daysFromCreate(facts.deal, facts.wonAt))
    .filter((duration): duration is number => duration !== null);
}

function buildSpeedStep(input: {
  definition: SpeedStepDefinition;
  totalDeals: number;
  durations: number[];
}) {
  const slowDeals = input.durations.filter((duration) =>
    isSlowerThan(duration, input.definition.slaDays)
  ).length;
  const bucketCounts = new Map<string, number>(
    input.definition.buckets.map((bucket) => [bucket.bucketKey, 0])
  );

  for (const duration of input.durations) {
    const bucket = input.definition.buckets.find((candidate) =>
      bucketContainsDuration(candidate, duration)
    );

    if (bucket) {
      bucketCounts.set(bucket.bucketKey, (bucketCounts.get(bucket.bucketKey) ?? 0) + 1);
    }
  }

  const buckets = input.definition.buckets.map((bucket) => {
    const deals = bucketCounts.get(bucket.bucketKey) ?? 0;
    return {
      ...bucket,
      deals,
      rate: toRate(deals, input.totalDeals)
    };
  });
  const factDeals = input.durations.length;
  const noFactDeals = Math.max(input.totalDeals - factDeals, 0);

  return {
    stepKey: input.definition.stepKey,
    label: input.definition.label,
    totalDeals: input.totalDeals,
    medianDays: median(input.durations),
    slaDays: input.definition.slaDays,
    slowDeals,
    slowRate: toRate(slowDeals, input.totalDeals),
    buckets: [
      ...buckets,
      {
        bucketKey: "no_fact",
        label: "Нет факта",
        minDays: null,
        maxDays: null,
        deals: noFactDeals,
        rate: toRate(noFactDeals, input.totalDeals)
      }
    ]
  };
}

function buildSpeedSteps(input: {
  dealFacts: DealTrajectoryFacts[];
  stageSequence: StageSequenceEntry[];
  meetingStage: StageSequenceEntry | null;
  contractStageId: string | null;
}) {
  const completedMeetingDealFacts = input.dealFacts.filter(
    (facts) => facts.completedMeetingAt
  );
  const postMeetingDurations = completedMeetingDealFacts
    .map((facts) =>
      durationMsBetween(
        facts.completedMeetingAt,
        firstForwardStageAfter({
          facts,
          after: facts.completedMeetingAt,
          stageSequence: input.stageSequence,
          currentStage: input.meetingStage
        })
      )
    )
    .filter((duration): duration is number => duration !== null);

  return [
    buildSpeedStep({
      definition: SPEED_STEP_DEFINITIONS.firstSuccessfulCall,
      totalDeals: input.dealFacts.length,
      durations: input.dealFacts
        .map((facts) => daysFromCreate(facts.deal, facts.firstSuccessfulCallAt))
        .filter((duration): duration is number => duration !== null)
    }),
    buildSpeedStep({
      definition: SPEED_STEP_DEFINITIONS.completedMeeting,
      totalDeals: input.dealFacts.length,
      durations: input.dealFacts
        .map((facts) => daysFromCreate(facts.deal, facts.completedMeetingAt))
        .filter((duration): duration is number => duration !== null)
    }),
    buildSpeedStep({
      definition: SPEED_STEP_DEFINITIONS.attendedEvent,
      totalDeals: input.dealFacts.length,
      durations: input.dealFacts
        .map((facts) => daysFromCreate(facts.deal, facts.attendedEventAt))
        .filter((duration): duration is number => duration !== null)
    }),
    buildSpeedStep({
      definition: SPEED_STEP_DEFINITIONS.contractStage,
      totalDeals: input.dealFacts.length,
      durations: collectStageEntryDurations({
        dealFacts: input.dealFacts,
        stageId: input.contractStageId
      })
    }),
    buildSpeedStep({
      definition: SPEED_STEP_DEFINITIONS.postMeetingNextStage,
      totalDeals: completedMeetingDealFacts.length,
      durations: postMeetingDurations
    })
  ];
}

function buildFactSteps(input: {
  dealFacts: DealTrajectoryFacts[];
  overall: BreakdownAccumulator;
  meetingStageId: string | null;
  contractStageId: string | null;
}): SourceCohortTrajectoryReport["factSteps"] {
  const totalDeals = input.overall.totalDeals;
  const rows: Array<{
    stepKey: SourceCohortTrajectoryFactStepKey;
    label: string;
    deals: number;
    medianDaysFromCreate: number | null;
    evidence: string;
  }> = [
    {
      stepKey: "created",
      label: "Создано",
      deals: totalDeals,
      medianDaysFromCreate: totalDeals > 0 ? 0 : null,
      evidence: "Сделка создана в выбранном месяце когорты."
    },
    {
      stepKey: "first_successful_call",
      label: "Первый успешный звонок",
      deals: input.overall.firstSuccessfulCallDeals,
      medianDaysFromCreate: median(input.overall.daysToFirstSuccessfulCall),
      evidence:
        "Первый прямой исходящий звонок после создания сделки: соединение есть, длительность больше 30 секунд."
    },
    {
      stepKey: "meeting_stage",
      label: "Этап встречи в CRM",
      deals: input.overall.meetingStageDeals,
      medianDaysFromCreate: median(
        collectStageEntryDurations({
          dealFacts: input.dealFacts,
          stageId: input.meetingStageId
        })
      ),
      evidence: "Сделка дошла до CRM-этапа встречи по истории стадий."
    },
    {
      stepKey: "completed_meeting",
      label: "Факт встречи",
      deals: input.overall.completedMeetingDeals,
      medianDaysFromCreate: median(input.overall.daysToCompletedMeeting),
      evidence: "В фактах сделки есть проведенная встреча после создания сделки."
    },
    {
      stepKey: "attended_event",
      label: "Посещение события",
      deals: input.overall.attendedEventDeals,
      medianDaysFromCreate: median(input.overall.daysToAttendedEvent),
      evidence: "Есть подтвержденное посещение мероприятия."
    },
    {
      stepKey: "contract_stage",
      label: "Контракт",
      deals: input.overall.contractStageDeals,
      medianDaysFromCreate: median(input.overall.daysToContractStage),
      evidence: "Сделка дошла до CRM-этапа контракта."
    },
    {
      stepKey: "won",
      label: "Продажа",
      deals: input.overall.wonDeals,
      medianDaysFromCreate: median(collectWonDurations(input.dealFacts)),
      evidence: "Сделка дошла до выигранного этапа или успешной семантики стадии."
    }
  ];

  const hasStep = (
    facts: DealTrajectoryFacts,
    stepKey: SourceCohortTrajectoryFactStepKey
  ) => {
    if (stepKey === "created") {
      return true;
    }
    if (stepKey === "first_successful_call") {
      return Boolean(facts.firstSuccessfulCallAt);
    }
    if (stepKey === "meeting_stage") {
      return Boolean(input.meetingStageId && facts.reachedStageIds.has(input.meetingStageId));
    }
    if (stepKey === "completed_meeting") {
      return Boolean(facts.completedMeetingAt);
    }
    if (stepKey === "attended_event") {
      return Boolean(facts.attendedEventAt);
    }
    if (stepKey === "contract_stage") {
      return Boolean(input.contractStageId && facts.reachedStageIds.has(input.contractStageId));
    }
    return Boolean(facts.wonAt);
  };
  const previousStepByKey: Record<
    SourceCohortTrajectoryFactStepKey,
    SourceCohortTrajectoryFactStepKey | null
  > = {
    created: null,
    first_successful_call: "created",
    meeting_stage: "first_successful_call",
    completed_meeting: "meeting_stage",
    attended_event: "completed_meeting",
    contract_stage: "attended_event",
    won: "contract_stage"
  };
  const stepDeals = new Map(rows.map((row) => [row.stepKey, row.deals]));

  return rows.map((row) => {
    const previousStep = previousStepByKey[row.stepKey];
    const previousDeals =
      previousStep === null ? totalDeals : stepDeals.get(previousStep) ?? 0;
    const conditionalDeals =
      previousStep === null
        ? row.deals
        : input.dealFacts.filter(
            (facts) => hasStep(facts, previousStep) && hasStep(facts, row.stepKey)
          ).length;

    return {
      ...row,
      rateFromCohort: toRate(row.deals, totalDeals),
      rateFromPrevious: toRate(conditionalDeals, previousDeals)
    };
  });
}

function buildConversionGaps(input: {
  overall: BreakdownAccumulator;
  factSteps: SourceCohortTrajectoryReport["factSteps"];
}): SourceCohortTrajectoryReport["conversionGaps"] {
  const stepDeals = new Map(
    input.factSteps.map((step) => [step.stepKey, step.deals])
  );
  const row = (value: {
    gapKey: SourceCohortTrajectoryReport["conversionGaps"][number]["gapKey"];
    label: string;
    deals: number;
    denominatorStepKey: SourceCohortTrajectoryFactStepKey;
    evidence: string;
    managementQuestion: string;
  }) => ({
    ...value,
    rate: toRate(value.deals, stepDeals.get(value.denominatorStepKey) ?? 0)
  });

  return [
    row({
      gapKey: "no_successful_call",
      label: "Нет успешного звонка",
      deals: input.overall.noSuccessfulCallDeals,
      denominatorStepKey: "created",
      evidence: "Нет прямого успешного исходящего звонка дольше 30 секунд после создания сделки.",
      managementQuestion: "Почему не довели до успешного дозвона?"
    }),
    row({
      gapKey: "successful_call_without_meeting_stage",
      label: "Звонок есть, этапа встречи нет",
      deals: input.overall.successfulCallWithoutMeetingStageDeals,
      denominatorStepKey: "first_successful_call",
      evidence: "Прямой успешный звонок есть, но CRM-этап встречи не достигнут.",
      managementQuestion: "Почему после дозвона не назначили встречу?"
    }),
    row({
      gapKey: "meeting_stage_without_fact",
      label: "Этап встречи без факта встречи",
      deals: input.overall.meetingStageWithoutFactDeals,
      denominatorStepKey: "meeting_stage",
      evidence: "CRM-этап встречи достигнут, но факта проведенной встречи нет.",
      managementQuestion: "Почему этап встречи не подтвержден фактом?"
    }),
    row({
      gapKey: "completed_meeting_without_next_stage",
      label: "Факт встречи без следующего этапа",
      deals: input.overall.completedMeetingWithoutNextStageDeals,
      denominatorStepKey: "completed_meeting",
      evidence: "Факт встречи есть, но следующего CRM-этапа после нее нет.",
      managementQuestion: "Почему после встречи нет следующего шага?"
    }),
    row({
      gapKey: "attended_event_without_contract",
      label: "Событие без контракта",
      deals: input.overall.attendedEventWithoutContractDeals,
      denominatorStepKey: "attended_event",
      evidence: "Посещение события есть, но CRM-этап контракта не достигнут.",
      managementQuestion: "Почему после события не дошли до контракта?"
    }),
    row({
      gapKey: "contract_without_win",
      label: "Контракт без продажи",
      deals: input.overall.contractWithoutWinDeals,
      denominatorStepKey: "contract_stage",
      evidence: "CRM-этап контракта достигнут, но выигранного этапа нет.",
      managementQuestion: "Что блокирует закрытие контракта?"
    })
  ];
}

function resolveMeetingStage(stageSequence: StageSequenceEntry[]) {
  return (
    stageSequence.find((stage) => KNOWN_MEETING_STAGE_IDS.has(stage.stageId)) ??
    stageSequence.find((stage) =>
      stage.stageName.toLocaleLowerCase("ru").includes("встреч")
    ) ?? null
  );
}

function resolveContractStage(stageSequence: StageSequenceEntry[]) {
  return (
    stageSequence.find((stage) => KNOWN_CONTRACT_STAGE_IDS.has(stage.stageId)) ??
    stageSequence.find((stage) =>
      /контракт|договор|сч[её]т/i.test(stage.stageName)
    ) ?? null
  );
}

function firstForwardStageAfter(input: {
  facts: DealTrajectoryFacts;
  after: string | null;
  stageSequence: StageSequenceEntry[];
  currentStage: StageSequenceEntry | null;
}) {
  if (!input.after || !input.currentStage) {
    return null;
  }
  const currentStage = input.currentStage;

  const afterMs = Date.parse(input.after);
  if (!Number.isFinite(afterMs)) {
    return null;
  }

  return input.stageSequence
    .flatMap((stage) =>
      (input.facts.stageEnteredAts.get(stage.stageId) ?? []).map((enteredAt) => ({
        stage,
        enteredAt
      }))
    )
    .filter((entry) => {
      const enteredMs = Date.parse(entry.enteredAt);
      return (
        Number.isFinite(enteredMs) &&
        enteredMs > afterMs &&
        entry.stage.sortOrder > currentStage.sortOrder &&
        !isLossStage(entry.stage)
      );
    })
    .sort((left, right) => left.enteredAt.localeCompare(right.enteredAt))[0]?.enteredAt ?? null;
}

function buildDataQuality(input: {
  totalDeals: number;
  scopedDeals: DealSnapshot[];
  stageFactMap: Map<string, DealStageFactSnapshot[]>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  touchpointFactsByDeal: Map<string, DealTouchpointFactSnapshot[]>;
  eventVisitFactsByDeal: Map<string, EventVisitFactSnapshot[]>;
  firstSuccessfulCallFallbackDeals: number;
}): SourceCohortTrajectoryDataQuality {
  const dealIds = new Set(input.scopedDeals.map((deal) => deal.id));
  const stageHistoryDeals = input.scopedDeals.filter(
    (deal) =>
      (input.stageFactMap.get(deal.id) ?? []).length > 0 ||
      (input.stageHistoryMap.get(deal.id) ?? []).length > 0
  ).length;
  const touchpointDeals = Array.from(input.touchpointFactsByDeal.keys()).filter(
    (dealId) => dealIds.has(dealId)
  ).length;
  const eventVisitDeals = Array.from(input.eventVisitFactsByDeal.keys()).filter(
    (dealId) => dealIds.has(dealId)
  ).length;
  const businessClubDeals = input.scopedDeals.filter((deal) =>
    Boolean(deal.businessClubValue?.trim())
  ).length;
  const businessClubMissingDeals = Math.max(input.totalDeals - businessClubDeals, 0);
  const warnings = [LOW_SAMPLE_WARNING, CURRENT_MANAGER_ATTRIBUTION_WARNING];

  if (input.totalDeals > 0 && stageHistoryDeals < input.totalDeals) {
    warnings.push(
      "У части сделок нет истории стадий; для них используется текущая стадия из снимка CRM."
    );
  }

  if (input.firstSuccessfulCallFallbackDeals > 0) {
    warnings.push(FALLBACK_CALL_WARNING);
  }

  if (input.totalDeals > 0 && businessClubMissingDeals / input.totalDeals > 0.5) {
    warnings.push(
      "У большинства сделок не заполнен бизнес-клуб заказчика; разрез по заказчикам нельзя использовать как рейтинг."
    );
  }

  return {
    totalDeals: input.totalDeals,
    stageHistoryDeals,
    stageHistoryCoverageRate: toRate(stageHistoryDeals, input.totalDeals),
    touchpointDeals,
    touchpointCoverageRate: toRate(touchpointDeals, input.totalDeals),
    eventVisitDeals,
    eventVisitCoverageRate: toRate(eventVisitDeals, input.totalDeals),
    businessClubDeals,
    businessClubCoverageRate: toRate(businessClubDeals, input.totalDeals),
    businessClubMissingDeals,
    warnings
  };
}

function buildStageTransitionRows(input: {
  dealFacts: DealTrajectoryFacts[];
  stageSequence: StageSequenceEntry[];
  stageNodes: SourceCohortTrajectoryReport["stageNodes"];
}) {
  const stageMetaById = new Map(
    input.stageSequence.map((stage) => [stage.stageId, stage])
  );
  const stageNodeById = new Map(
    input.stageNodes.map((stage) => [stage.stageId, stage])
  );
  const transitionCounts = new Map<
    string,
    { fromStageId: string | null; toStageId: string; deals: number }
  >();

  for (const facts of input.dealFacts) {
    for (const transition of facts.stageTransitions) {
      if (!stageMetaById.has(transition.toStageId)) {
        continue;
      }

      if (transition.fromStageId && !stageMetaById.has(transition.fromStageId)) {
        continue;
      }

      const key = `${transition.fromStageId ?? "START"}->${transition.toStageId}`;
      const current = transitionCounts.get(key) ?? {
        fromStageId: transition.fromStageId,
        toStageId: transition.toStageId,
        deals: 0
      };
      current.deals += 1;
      transitionCounts.set(key, current);
    }
  }

  return Array.from(transitionCounts.values())
    .map((transition) => {
      const fromStage = transition.fromStageId
        ? stageMetaById.get(transition.fromStageId) ?? null
        : null;
      const toStage = stageMetaById.get(transition.toStageId);
      if (!toStage) {
        return null;
      }

      const denominator = transition.fromStageId
        ? stageNodeById.get(transition.fromStageId)?.reachedDeals ?? 0
        : input.dealFacts.length;

      return {
        id: `stage-transition-${transition.fromStageId ?? "START"}-${transition.toStageId}`,
        fromStageId: transition.fromStageId,
        fromStageName: fromStage?.stageName ?? null,
        fromSortOrder: fromStage?.sortOrder ?? null,
        toStageId: transition.toStageId,
        toStageName: toStage.stageName,
        toSortOrder: toStage.sortOrder,
        deals: transition.deals,
        conversionRate: toRate(transition.deals, denominator)
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => {
      const leftFromSort = left.fromSortOrder ?? Number.NEGATIVE_INFINITY;
      const rightFromSort = right.fromSortOrder ?? Number.NEGATIVE_INFINITY;
      if (leftFromSort !== rightFromSort) {
        return leftFromSort - rightFromSort;
      }

      if (left.toSortOrder !== right.toSortOrder) {
        return left.toSortOrder - right.toSortOrder;
      }

      return left.toStageName.localeCompare(right.toStageName, "ru");
    });
}

export function buildSourceCohortTrajectoryReport(
  input: SourceCohortTrajectoryInput
): SourceCohortTrajectoryReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const reportNow = input.now ?? new Date();
  const reportNowIso = reportNow.toISOString();
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const stageSequence = getStageSequence(input.stageCatalog);
  const meetingStage = resolveMeetingStage(stageSequence);
  const contractStage = resolveContractStage(stageSequence);
  const baseStageId = stageSequence[0]?.stageId ?? null;
  const wonStageIds = new Set(input.wonStageIds);
  const stageFactMap = buildStageFactMap(input.dealStageFacts);
  const stageHistoryMap = buildStageHistoryMap(input.stageHistory ?? []);
  const touchpointFactsByDeal = groupFactsByDeal(input.dealTouchpointFacts);
  const eventVisitFactsByDeal = groupFactsByDeal(input.eventVisitFacts);
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const eventById = new Map(
    (input.events ?? []).map((event) => [event.eventId, event])
  );
  const scopedDeals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const cohortDeals = scopedDeals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const cohortDealIds = new Set(cohortDeals.map((deal) => deal.id));
  const eventDealIds = new Set(
    (input.eventVisitFacts ?? [])
      .filter(
        (fact) =>
          isTrustedFact(fact) &&
          isWithinRange(
            resolveEventPerformanceDate(fact, eventById),
            fromMs,
            toMs
          )
      )
      .map((fact) => fact.dealId)
      .filter((dealId): dealId is string => Boolean(dealId))
  );
  const candidateDeals = scopedDeals.filter(
    (deal) => cohortDealIds.has(deal.id) || eventDealIds.has(deal.id)
  );
  const candidateDealFacts = candidateDeals.map((deal) =>
    buildDealTrajectoryFacts({
      deal,
      baseStageId,
      wonStageIds,
      stageFactMap,
      stageHistoryMap,
      touchpointFactsByDeal,
      eventVisitFactsByDeal
    })
  );
  const dealFacts = candidateDealFacts.filter((facts) =>
    cohortDealIds.has(facts.deal.id)
  );
  const managerRows = new Map<string, BreakdownAccumulator>();
  const sourceRows = new Map<string, BreakdownAccumulator>();
  const customerRows = new Map<string, BreakdownAccumulator>();
  const qualityRows = new Map<string, BreakdownAccumulator>();
  const overall = createBreakdownAccumulator("overall", "Все сделки");

  for (const facts of dealFacts) {
    const managerId = facts.deal.assignedById ?? UNASSIGNED_MANAGER_ID;
    const source = resolveDealSource(facts.deal, sourceLabels);
    const customerLabel =
      facts.deal.businessClubValue?.trim() || "Без бизнес-клуба заказчика";
    const qualityLabel =
      facts.deal.qualityValue?.trim() || "Без итогового качества";
    const currentStage = meetingStage;
    const nextStageAfterCompletedMeetingAt = firstForwardStageAfter({
      facts,
      after: facts.completedMeetingAt,
      stageSequence,
      currentStage
    });
    const hasCompletedMeetingWithoutNextStage =
      Boolean(facts.completedMeetingAt) && !nextStageAfterCompletedMeetingAt;
    const dealIsOpen = isOpenDeal(facts, stageSequence);
    const staleAfterCompletedMeeting =
      hasCompletedMeetingWithoutNextStage &&
      dealIsOpen &&
      isSlowerThan(
        durationMsBetween(facts.completedMeetingAt, reportNowIso),
        SPEED_STEP_DEFINITIONS.postMeetingNextStage.slaDays
      );
    const staleOpenContractStage =
      Boolean(contractStage && facts.deal.stageId === contractStage.stageId) &&
      dealIsOpen &&
      isSlowerThan(
        durationMsBetween(facts.currentStageEnteredAt, reportNowIso),
        SPEED_STEP_DEFINITIONS.contractStage.slaDays
      );

    addTrajectoryToBreakdown({
      row: overall,
      facts,
      meetingStageId: meetingStage?.stageId ?? null,
      contractStageId: contractStage?.stageId ?? null,
      hasCompletedMeetingWithoutNextStage,
      dealIsOpen,
      staleAfterCompletedMeeting,
      staleOpenContractStage
    });

    const managerRow =
      managerRows.get(managerId) ??
      createBreakdownAccumulator(managerId, resolveManagerName(managerId, managerDirectory));
    addTrajectoryToBreakdown({
      row: managerRow,
      facts,
      meetingStageId: meetingStage?.stageId ?? null,
      contractStageId: contractStage?.stageId ?? null,
      hasCompletedMeetingWithoutNextStage,
      dealIsOpen,
      staleAfterCompletedMeeting,
      staleOpenContractStage
    });
    managerRows.set(managerId, managerRow);

    const sourceRow =
      sourceRows.get(source.key) ??
      createBreakdownAccumulator(source.key, source.label);
    addTrajectoryToBreakdown({
      row: sourceRow,
      facts,
      meetingStageId: meetingStage?.stageId ?? null,
      contractStageId: contractStage?.stageId ?? null,
      hasCompletedMeetingWithoutNextStage,
      dealIsOpen,
      staleAfterCompletedMeeting,
      staleOpenContractStage
    });
    sourceRows.set(source.key, sourceRow);

    const customerRow =
      customerRows.get(customerLabel) ??
      createBreakdownAccumulator(customerLabel, customerLabel);
    addTrajectoryToBreakdown({
      row: customerRow,
      facts,
      meetingStageId: meetingStage?.stageId ?? null,
      contractStageId: contractStage?.stageId ?? null,
      hasCompletedMeetingWithoutNextStage,
      dealIsOpen,
      staleAfterCompletedMeeting,
      staleOpenContractStage
    });
    customerRows.set(customerLabel, customerRow);

    const qualityRow =
      qualityRows.get(qualityLabel) ??
      createBreakdownAccumulator(qualityLabel, qualityLabel);
    addTrajectoryToBreakdown({
      row: qualityRow,
      facts,
      meetingStageId: meetingStage?.stageId ?? null,
      contractStageId: contractStage?.stageId ?? null,
      hasCompletedMeetingWithoutNextStage,
      dealIsOpen,
      staleAfterCompletedMeeting,
      staleOpenContractStage
    });
    qualityRows.set(qualityLabel, qualityRow);
  }

  const stageNodes = stageSequence.map((stage) => {
    const daysFromCreate: number[] = [];
    const durations: number[] = [];
    let reachedDeals = 0;

    for (const facts of dealFacts) {
      const enteredAt = facts.stageEnteredAt.get(stage.stageId);
      if (!enteredAt || !facts.reachedStageIds.has(stage.stageId)) {
        continue;
      }

      reachedDeals += 1;
      const fromCreateMs = Date.parse(enteredAt) - Date.parse(facts.deal.dateCreate);
      if (Number.isFinite(fromCreateMs) && fromCreateMs >= 0) {
        daysFromCreate.push(fromCreateMs);
      }
      const durationMs = facts.stageDurationMs.get(stage.stageId);
      if (durationMs !== undefined) {
        durations.push(durationMs);
      }
    }

    return {
      stageId: stage.stageId,
      stageName: stage.stageName,
      sortOrder: stage.sortOrder,
      reachedDeals,
      reachedRate: toRate(reachedDeals, dealFacts.length),
      medianDaysFromCreate: median(daysFromCreate),
      medianDaysOnStage: isLossStage(stage) ? null : median(durations)
    };
  });
  const stageTransitions = buildStageTransitionRows({
    dealFacts,
    stageSequence,
    stageNodes
  });

  const actionDefinitions: Array<{
    actionKey: SourceCohortTrajectoryActionKey;
    label: string;
    evidence: string;
    getDate: (facts: DealTrajectoryFacts) => string | null;
  }> = [
    {
      actionKey: "first_successful_call",
      label: "Первый успешный исходящий звонок",
      evidence:
        "Прямой исходящий звонок после создания сделки: есть соединение и длительность больше 30 секунд.",
      getDate: (facts) => facts.firstSuccessfulCallAt
    },
    {
      actionKey: "completed_meeting",
      label: "Факт проведенной встречи",
      evidence: "В фактах сделки есть проведенная встреча после создания сделки.",
      getDate: (facts) => facts.completedMeetingAt
    },
    {
      actionKey: "attended_event",
      label: "Факт посещения события",
      evidence: "Есть подтвержденное посещение мероприятия.",
      getDate: (facts) => facts.attendedEventAt
    }
  ];

  const actionNodes = actionDefinitions.map((definition) => {
    const durations: number[] = [];
    let reachedDeals = 0;

    for (const facts of dealFacts) {
      const duration = daysFromCreate(facts.deal, definition.getDate(facts));
      if (duration === null) {
        continue;
      }

      reachedDeals += 1;
      durations.push(duration);
    }

    return {
      actionKey: definition.actionKey,
      label: definition.label,
      reachedDeals,
      reachedRate: toRate(reachedDeals, dealFacts.length),
      medianDaysFromCreate: median(durations),
      evidence: definition.evidence
    };
  });

  const signals: SourceCohortTrajectorySignals = {
    noSuccessfulCallDeals: overall.noSuccessfulCallDeals,
    firstSuccessfulCallDeals: overall.firstSuccessfulCallDeals,
    firstSuccessfulCallFallbackDeals: overall.firstSuccessfulCallFallbackDeals,
    successfulCallWithoutMeetingStageDeals:
      overall.successfulCallWithoutMeetingStageDeals,
    meetingStageDeals: overall.meetingStageDeals,
    meetingStageWithoutFactDeals: overall.meetingStageWithoutFactDeals,
    completedMeetingDeals: overall.completedMeetingDeals,
    completedMeetingWithoutNextStageDeals:
      overall.completedMeetingWithoutNextStageDeals,
    attendedEventDeals: overall.attendedEventDeals,
    attendedEventWithoutContractDeals: overall.attendedEventWithoutContractDeals,
    contractWithoutWinDeals: overall.contractWithoutWinDeals,
    slowFirstSuccessfulCallDeals: overall.slowFirstSuccessfulCallDeals,
    slowCompletedMeetingDeals: overall.slowCompletedMeetingDeals,
    slowAttendedEventDeals: overall.slowAttendedEventDeals,
    slowContractStageDeals: overall.slowContractStageDeals,
    staleAfterCompletedMeetingDeals: overall.staleAfterCompletedMeetingDeals,
    staleOpenContractStageDeals: overall.staleOpenContractStageDeals,
    repeatAttendedEventDeals: overall.repeatAttendedEventDeals,
    repeatAttendedEventVisits: overall.repeatAttendedEventVisits,
    contractStageDeals: overall.contractStageDeals,
    contractStageRate: toRate(overall.contractStageDeals, overall.totalDeals),
    medianDaysToContractStage: median(overall.daysToContractStage),
    medianDaysOnContractStage: median(overall.daysOnContractStage),
    wonDeals: overall.wonDeals,
    lostDeals: overall.lostDeals,
    openDeals: overall.openDeals
  };
  const factSteps = buildFactSteps({
    dealFacts,
    overall,
    meetingStageId: meetingStage?.stageId ?? null,
    contractStageId: contractStage?.stageId ?? null
  });
  const conversionGaps = buildConversionGaps({
    overall,
    factSteps
  });
  const speedSteps = buildSpeedSteps({
    dealFacts,
    stageSequence,
    meetingStage,
    contractStageId: contractStage?.stageId ?? null
  });
  const overallRow = toBreakdownRow(overall);
  const managerReportRows = Array.from(managerRows.values())
    .sort((left, right) => {
      if (right.totalDeals !== left.totalDeals) {
        return right.totalDeals - left.totalDeals;
      }

      return left.label.localeCompare(right.label, "ru");
    })
    .map((row) => toManagerRow(row, managerDirectory));
  const managerDiagnostics = buildManagerDiagnostics({
    managerRows: managerReportRows,
    overallRow
  });
  const conversionJourney = buildSourceCohortConversionJourney({
    dealFacts: dealFacts.map((facts) => ({
      dealId: facts.deal.id,
      createdAt: facts.deal.dateCreate,
      firstCallAt: facts.firstCallAt,
      confirmedConversationAt: facts.firstSuccessfulCallAt,
      meetingScheduledAt: facts.meetingScheduledAt,
      meetingCompletedAt: facts.completedMeetingAt,
      attendedEventAts: facts.journeyAttendedEventAts,
      contractAt: contractStage
        ? facts.stageEnteredAt.get(contractStage.stageId) ?? null
        : null,
      transferredAt: facts.wonAt
    })),
    asOf: reportNowIso
  });
  const journeyDrilldownDealFacts = input.journeyDrilldown
    ? dealFacts.map((facts) => {
        const managerId = facts.deal.assignedById ?? UNASSIGNED_MANAGER_ID;
        const currentStageName =
          stageSequence.find((stage) => stage.stageId === facts.deal.stageId)
            ?.stageName ?? facts.deal.stageId;
        const outcome = facts.wonAt
          ? "won" as const
          : isOpenDeal(facts, stageSequence)
            ? "open" as const
            : "lost" as const;

        return {
          facts,
          managerId,
          currentStageName,
          outcome
        };
      })
    : [];
  const journeyDrilldown = input.journeyDrilldown
    ? input.journeyDrilldown.drilldownKind === "crm_stage"
      ? buildSourceCohortConversionStageDrilldown({
          range: input.range,
          stageId: input.journeyDrilldown.stepKey,
          asOf: reportNowIso,
          stages: stageSequence.map((stage) => ({
            stageId: stage.stageId,
            stageName: stage.stageName,
            sortOrder: stage.sortOrder,
            terminalKind: wonStageIds.has(stage.stageId)
              ? "won"
              : isLossStage(stage)
                ? "lost"
                : null
          })),
          dealFacts: journeyDrilldownDealFacts.map(
            ({ facts, managerId, currentStageName, outcome }) => ({
              dealId: facts.deal.id,
              dealUrl:
                input.journeyDrilldown?.dealUrlBuilder?.(facts.deal.id) ?? null,
              managerId,
              managerName: resolveManagerName(managerId, managerDirectory),
              currentStageId: facts.deal.stageId,
              currentStageName,
              currentStageEnteredAt: facts.currentStageEnteredAt,
              outcome,
              createdAt: facts.deal.dateCreate,
              stageEnteredAts: facts.stageEnteredAts
            })
          )
        })
      : buildSourceCohortConversionJourneyDrilldown({
          range: input.range,
          stepKey: input.journeyDrilldown.stepKey,
          asOf: reportNowIso,
          dealFacts: journeyDrilldownDealFacts.map(
            ({ facts, managerId, currentStageName, outcome }) => ({
              dealId: facts.deal.id,
              dealUrl:
                input.journeyDrilldown?.dealUrlBuilder?.(facts.deal.id) ?? null,
              managerId,
              managerName: resolveManagerName(managerId, managerDirectory),
              currentStageId: facts.deal.stageId,
              currentStageName,
              outcome,
              createdAt: facts.deal.dateCreate,
              firstCallAt: facts.firstCallAt,
              confirmedConversationAt: facts.firstSuccessfulCallAt,
              meetingScheduledAt: facts.meetingScheduledAt,
              meetingCompletedAt: facts.completedMeetingAt,
              attendedEventAts: facts.journeyAttendedEventAts,
              contractAt: contractStage
                ? facts.stageEnteredAt.get(contractStage.stageId) ?? null
                : null,
              transferredAt: facts.wonAt
            })
          )
        })
    : null;
  const eventPerformance = buildEventPerformance({
    range: input.range,
    now: reportNow,
    eventVisitFacts: input.eventVisitFacts ?? [],
    events: input.events ?? [],
    dealFacts: candidateDealFacts,
    contractStageId: contractStage?.stageId ?? null,
    managerDirectory
  });

  return {
    range: input.range,
    totalDeals: dealFacts.length,
    conversionJourney,
    ...(journeyDrilldown ? { journeyDrilldown } : {}),
    stageNodes,
    stageTransitions,
    actionNodes,
    factSteps,
    conversionGaps,
    speedSteps,
    overallSignals: signals,
    managerDiagnostics,
    managerRows: managerReportRows,
    sourceRows: Array.from(sourceRows.values())
      .sort((left, right) => right.totalDeals - left.totalDeals)
      .map(toBreakdownRow),
    customerRows: Array.from(customerRows.values())
      .sort((left, right) => right.totalDeals - left.totalDeals)
      .map(toBreakdownRow),
    qualityRows: Array.from(qualityRows.values())
      .sort((left, right) => right.totalDeals - left.totalDeals)
      .map(toBreakdownRow),
    eventPerformance,
    dataQuality: buildDataQuality({
      totalDeals: dealFacts.length,
      scopedDeals: cohortDeals,
      stageFactMap,
      stageHistoryMap,
      touchpointFactsByDeal,
      eventVisitFactsByDeal,
      firstSuccessfulCallFallbackDeals: overall.firstSuccessfulCallFallbackDeals
    })
  };
}
