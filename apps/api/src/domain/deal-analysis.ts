import type {
  ActivitySnapshot,
  CallSnapshot,
  DealActivityMarker,
  DealAnalysisReport,
  DealAnalysisRisk,
  DealAnalysisRow,
  DealAnalysisScope,
  DealAnalysisTimelineItem,
  DealHealthBand,
  DealSnapshot,
  DealTouchpointFactSnapshot,
  ManagerDirectoryEntry,
  OperationalCurrentScope,
  OperationalThresholdSettings,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import { OPERATIONAL_LOST_STAGE_IDS } from "./operational-dashboard.js";
import {
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  resolveManagerName
} from "./report-dimensions.js";

const MS_PER_DAY = 86_400_000;
const STALLED_AFTER_MILESTONE_DAYS = 7;
const MARKER_LIMIT = 24;

export interface BuildDealAnalysisReportInput {
  range: ReportRange;
  now: string;
  scope: DealAnalysisScope;
  deals: DealSnapshot[];
  currentDealIds: ReadonlySet<string>;
  currentScope: OperationalCurrentScope;
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  touchpoints: DealTouchpointFactSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
  thresholds: OperationalThresholdSettings;
  wonStageIds: string[];
  dealUrlBuilder?: (dealId: string) => string | null;
}

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function floorDays(from: number, to: number) {
  return Math.max(0, Math.floor((to - from) / MS_PER_DAY));
}

function dealScope(deal: DealSnapshot, wonStageIds: ReadonlySet<string>): DealAnalysisScope {
  if (wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S") return "won";
  if (OPERATIONAL_LOST_STAGE_IDS.has(deal.stageId) || deal.stageSemanticId === "F") {
    return "lost";
  }
  return "open";
}

function healthBand(score: number): DealHealthBand {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 30) return "risk";
  return "critical";
}

function buildGroups<T>(rows: T[], key: (row: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    if (!value) continue;
    const current = groups.get(value) ?? [];
    current.push(row);
    groups.set(value, current);
  }
  return groups;
}

function isDealActivity(activity: ActivitySnapshot) {
  return activity.ownerTypeId === "2" || activity.ownerTypeId.toUpperCase() === "DEAL";
}

function resolveCallsByDeal(calls: CallSnapshot[], activities: ActivitySnapshot[]) {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  return buildGroups(calls, (call) => {
    const activity = call.crmActivityId ? activityById.get(call.crmActivityId) : null;
    if (activity && isDealActivity(activity)) return activity.ownerId;
    return call.crmEntityType?.toUpperCase() === "DEAL" || call.crmEntityType === "2"
      ? call.crmEntityId
      : null;
  });
}

function latestIso(values: Array<string | null | undefined>) {
  let latest: { value: string; time: number } | null = null;
  for (const value of values) {
    const time = timestamp(value);
    if (value && time !== null && (!latest || time > latest.time)) latest = { value, time };
  }
  return latest?.value ?? null;
}

function createRisk(input: DealAnalysisRisk): DealAnalysisRisk {
  return input;
}

function payload(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildDealAnalysisTimeline(
  facts: DealTouchpointFactSnapshot[]
): DealAnalysisTimelineItem[] {
  const visibleFacts = facts.filter(
    (fact) => fact.kind !== "message_count" && fact.kind !== "comment_quality_signal"
  );
  const taskFacts = buildGroups(
    visibleFacts.filter(
      (fact) => fact.kind === "task_created" || fact.kind === "task_completed"
    ),
    (fact) => fact.sourceEntityId
  );
  const timeline = visibleFacts
    .filter((fact) => fact.kind !== "task_created" && fact.kind !== "task_completed")
    .map((fact): DealAnalysisTimelineItem => {
      const data = payload(fact.payloadJson);
      const direction: DealAnalysisTimelineItem["direction"] =
        data?.direction === "incoming" || data?.direction === "outgoing"
          ? data.direction
          : data?.direction === "unknown"
            ? "unknown"
            : null;
      const eventName = textValue(data?.eventName);
      const subject = textValue(data?.subject);
      const titles: Record<string, string> = {
        call: "Звонок",
        meeting: "Встреча",
        meeting_date_changed: "Дата встречи изменена",
        conversion_event_visit: "Мероприятие"
      };

      return {
        id: fact.factId,
        sourceEntityId: fact.sourceEntityId,
        kind: fact.kind as DealAnalysisTimelineItem["kind"],
        occurredAt: fact.occurredAt,
        title: subject ?? eventName ?? titles[fact.kind] ?? fact.kind,
        detail: textValue(data?.status),
        subject,
        comment: textValue(data?.description),
        createdAt: textValue(data?.createdTime),
        deadlineAt: textValue(data?.deadline) ?? textValue(data?.scheduledAt),
        completedAt: textValue(data?.completedTime),
        eventName,
        direction,
        durationSeconds: numberValue(data?.durationSeconds),
        successful: typeof data?.connected === "boolean" ? data.connected : null,
        stageId: fact.stageIdAtEvent,
        stageName: fact.stageNameAtEvent
      };
    });

  for (const [sourceEntityId, rows] of taskFacts) {
    const created = rows.find((fact) => fact.kind === "task_created") ?? null;
    const completed = rows.find((fact) => fact.kind === "task_completed") ?? null;
    const createdData = payload(created?.payloadJson ?? null);
    const completedData = payload(completed?.payloadJson ?? null);
    const subject = textValue(completedData?.subject) ?? textValue(createdData?.subject);
    const comment =
      textValue(completedData?.description) ?? textValue(createdData?.description);
    const createdAt =
      textValue(completedData?.createdTime) ??
      textValue(createdData?.createdTime) ??
      created?.occurredAt ??
      null;
    const completedAt =
      textValue(completedData?.completedTime) ??
      textValue(createdData?.completedTime) ??
      completed?.occurredAt ??
      null;
    const deadlineAt =
      textValue(completedData?.deadline) ?? textValue(createdData?.deadline);
    const latestFact = completed ?? created;
    if (!latestFact) continue;

    timeline.push({
      id: `task:${sourceEntityId}`,
      sourceEntityId,
      kind: completedAt ? "task_completed" : "task_created",
      occurredAt: completedAt ?? createdAt ?? latestFact.occurredAt,
      title: subject ?? "Задача",
      detail: null,
      subject,
      comment,
      createdAt,
      deadlineAt,
      completedAt,
      eventName: null,
      direction: null,
      durationSeconds: null,
      successful: completedAt ? true : null,
      stageId: latestFact.stageIdAtEvent,
      stageName: latestFact.stageNameAtEvent
    });
  }

  return timeline.sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
  );
}

function isCompletedMilestone(fact: DealTouchpointFactSnapshot) {
  const data = payload(fact.payloadJson);
  if (fact.kind === "meeting") return data?.completed === true;
  return fact.kind === "conversion_event_visit" && data?.status === "attended";
}

function activityMarkers(
  rows: DealTouchpointFactSnapshot[],
  range: ReportRange
): { markers: DealActivityMarker[]; count: number } {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);
  const allowed = new Set<DealActivityMarker["kind"]>([
    "call",
    "task_created",
    "task_completed",
    "meeting",
    "meeting_date_changed",
    "conversion_event_visit",
    "message_count"
  ]);
  const matching = rows
    .filter((row) => {
      const at = timestamp(row.occurredAt);
      return allowed.has(row.kind as DealActivityMarker["kind"]) && at !== null && at >= from && at <= to;
    })
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  return {
    count: matching.length,
    markers: matching.slice(0, MARKER_LIMIT).map((row) => ({
      id: row.factId,
      kind: row.kind as DealActivityMarker["kind"],
      occurredAt: row.occurredAt,
      linkConfidence: row.linkConfidence
    }))
  };
}

export function buildDealAnalysisReport(input: BuildDealAnalysisReportInput): DealAnalysisReport {
  const nowMs = timestamp(input.now) ?? Date.now();
  const stageLookup = new Map(
    input.stageCatalog
      .filter((entry) => entry.entityType === "deal")
      .map((entry) => [entry.statusId, entry.name])
  );
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const managers = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const stageThresholds = new Map(
    input.thresholds.stageAging.map((row) => [row.stageId, row.maxDaysOnStage])
  );
  const wonStageIds = new Set(input.wonStageIds);
  const historyByDeal = buildGroups(input.stageHistory, (row) => row.ownerId);
  const activitiesByDeal = buildGroups(input.activities.filter(isDealActivity), (row) => row.ownerId);
  const callsByDeal = resolveCallsByDeal(input.calls, input.activities);
  const touchpointsByDeal = buildGroups(input.touchpoints, (row) => row.dealId);

  const rows: DealAnalysisRow[] = [];
  for (const deal of input.deals) {
    if (!input.currentDealIds.has(deal.id)) continue;
    const scope = dealScope(deal, wonStageIds);
    if (scope !== input.scope) continue;

    const history = [...(historyByDeal.get(deal.id) ?? [])].sort(
      (left, right) => Date.parse(left.createdTime) - Date.parse(right.createdTime)
    );
    const currentStageEnteredAt =
      [...history].reverse().find((row) => row.stageId === deal.stageId)?.createdTime ??
      deal.dateCreate;
    const enteredMs = timestamp(currentStageEnteredAt) ?? nowMs;
    const daysOnStage = floorDays(enteredMs, nowMs);
    const stageMaxDays = stageThresholds.get(deal.stageId) ?? null;
    const stageOverdueDays = stageMaxDays === null ? 0 : Math.max(0, daysOnStage - stageMaxDays);
    const activities = activitiesByDeal.get(deal.id) ?? [];
    const calls = callsByDeal.get(deal.id) ?? [];
    const facts = touchpointsByDeal.get(deal.id) ?? [];
    const openDated = activities
      .filter((activity) => !activity.completed && timestamp(activity.deadline) !== null)
      .sort((left, right) => Date.parse(left.deadline ?? "") - Date.parse(right.deadline ?? ""));
    const next = openDated[0] ?? null;
    const nextDeadlineMs = timestamp(next?.deadline);
    const nextAction = nextDeadlineMs === null
      ? { status: "missing" as const, activityId: null, deadline: null, overdueDays: 0 }
      : nextDeadlineMs < nowMs
        ? {
            status: "overdue" as const,
            activityId: next?.id ?? null,
            deadline: next?.deadline ?? null,
            overdueDays: floorDays(nextDeadlineMs, nowMs)
          }
        : {
            status: floorDays(nowMs, nextDeadlineMs) === 0 ? "today" as const : "scheduled" as const,
            activityId: next?.id ?? null,
            deadline: next?.deadline ?? null,
            overdueDays: 0
          };
    const lastActivityAt = latestIso(
      activities.flatMap((activity) => [activity.createdTime, activity.completedTime, activity.lastUpdated])
    );
    const lastCallAt = latestIso(calls.map((call) => call.callStartDate));
    const baseline = timestamp(deal.dateCreate) ?? nowMs;
    const lastActivityDays = floorDays(timestamp(lastActivityAt) ?? baseline, nowMs);
    const lastCallDays = floorDays(timestamp(lastCallAt) ?? baseline, nowMs);
    const risks: DealAnalysisRisk[] = [];

    if (scope === "open") {
      if (nextAction.status === "missing") {
        risks.push(createRisk({
          key: "missing_next_action",
          label: "Нет следующего действия",
          evidence: "У сделки нет открытой активности с датой",
          recommendation: "Назначить задачу с целью и датой",
          deduction: 30,
          observedDays: null,
          thresholdDays: null
        }));
      } else if (nextAction.status === "overdue") {
        risks.push(createRisk({
          key: "overdue_next_action",
          label: "Следующее действие просрочено",
          evidence: `Просрочка ${nextAction.overdueDays} дн.`,
          recommendation: "Проверить результат и назначить следующее действие",
          deduction: 25,
          observedDays: nextAction.overdueDays,
          thresholdDays: 0
        }));
      }
      if (stageMaxDays !== null && daysOnStage >= stageMaxDays) {
        const deduction = daysOnStage >= stageMaxDays * 2 ? 25 : 15;
        risks.push(createRisk({
          key: "stage_aging",
          label: "Сделка застряла на этапе",
          evidence: `${daysOnStage} дн. на этапе при пороге ${stageMaxDays} дн.`,
          recommendation: "Решить: продвинуть, вернуть или закрыть",
          deduction,
          observedDays: daysOnStage,
          thresholdDays: stageMaxDays
        }));
      }
      if (lastActivityDays >= input.thresholds.noActivityMaxDays) {
        risks.push(createRisk({
          key: "no_recent_activity",
          label: "Нет свежей активности",
          evidence: `Последняя активность ${lastActivityDays} дн. назад`,
          recommendation: "Восстановить контакт и зафиксировать результат",
          deduction: 15,
          observedDays: lastActivityDays,
          thresholdDays: input.thresholds.noActivityMaxDays
        }));
      }
      if (lastCallDays >= input.thresholds.noCallsMaxDays) {
        risks.push(createRisk({
          key: "no_recent_calls",
          label: "Нет свежего звонка",
          evidence: `Последний звонок ${lastCallDays} дн. назад`,
          recommendation: "Оценить необходимость звонка",
          deduction: 10,
          observedDays: lastCallDays,
          thresholdDays: input.thresholds.noCallsMaxDays
        }));
      }
      const milestone = facts
        .filter(isCompletedMilestone)
        .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))[0];
      if (milestone) {
        const milestoneMs = timestamp(milestone.occurredAt) ?? nowMs;
        const stalledDays = floorDays(milestoneMs, nowMs);
        const movedAfter = history.some((row) => (timestamp(row.createdTime) ?? 0) > milestoneMs);
        if (stalledDays >= STALLED_AFTER_MILESTONE_DAYS && !movedAfter) {
          risks.push(createRisk({
            key: "stalled_after_milestone",
            label: "Нет движения после встречи или события",
            evidence: `${stalledDays} дн. без смены этапа после контрольной точки`,
            recommendation: "Зафиксировать результат и следующий переход",
            deduction: 20,
            observedDays: stalledDays,
            thresholdDays: STALLED_AFTER_MILESTONE_DAYS
          }));
        }
      }
    }

    const score = scope === "open"
      ? Math.max(0, 100 - risks.reduce((total, risk) => total + risk.deduction, 0))
      : null;
    const markers = activityMarkers(facts, input.range);
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const sourceKey = deal.sourceId?.trim() || "UNATTRIBUTED";
    rows.push({
      dealId: deal.id,
      dealUrl: input.dealUrlBuilder?.(deal.id) ?? null,
      scope,
      managerId,
      managerName: resolveManagerName(managerId, managers),
      stageId: deal.stageId,
      stageName: stageLookup.get(deal.stageId) ?? deal.stageId,
      sourceKey,
      sourceLabel: sourceLabels.get(sourceKey) ?? (sourceKey === "UNATTRIBUTED" ? "Без источника" : sourceKey),
      amount: deal.opportunity ?? 0,
      dateCreate: deal.dateCreate,
      dateModify: deal.dateModify,
      dateClosed: deal.dateClosed,
      currentStageEnteredAt,
      daysOnStage,
      stageMaxDays,
      stageOverdueDays,
      lastActivityAt,
      lastCallAt,
      nextAction,
      healthScore: score,
      healthBand: score === null ? null : healthBand(score),
      risks,
      activityMarkers: markers.markers,
      activityMarkerCount: markers.count
    });
  }

  rows.sort((left, right) =>
    (left.healthScore ?? 101) - (right.healthScore ?? 101) ||
    right.nextAction.overdueDays - left.nextAction.overdueDays ||
    right.stageOverdueDays - left.stageOverdueDays ||
    right.amount - left.amount ||
    left.dealId.localeCompare(right.dealId)
  );

  return {
    range: input.range,
    generatedAt: new Date(nowMs).toISOString(),
    scope: input.scope,
    currentScope: input.currentScope,
    rows,
    thresholdsUpdatedAt: input.thresholds.updatedAt
  };
}
