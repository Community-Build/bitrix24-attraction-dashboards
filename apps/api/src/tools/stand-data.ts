import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import type {
  ActivityBindingSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventVisitSnapshot,
  DealSnapshot,
  EventSnapshot,
  EventVisitStageHistorySnapshot,
  ManagerDirectoryEntry,
  StageCatalogEntry,
  StageHistorySnapshot,
  UnitEconomicsCostFact,
  UnitEconomicsCostRule
} from "@bitrix24-reporting/contracts";

import {
  buildConversionEventTouchpointFacts,
  buildDealStageFacts,
  buildDealTouchpointFacts,
  buildEventVisitFacts,
  buildIdentityLinks
} from "../domain/analytics-facts.js";
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
  FULL_COVERAGE_FROM
} from "../domain/sync.js";
import { readEnv } from "../config/env.js";
import {
  createSqliteRepository,
  type SqliteRepository
} from "../server/sqlite-repository.js";

interface SeedStandDataInput {
  repository: SqliteRepository;
  now?: Date;
  months?: number;
  dealsPerMonth?: number;
}

const CATEGORY_ID = "10";
const WON_STAGE_ID = "C10:WON";
const STAGES: StageCatalogEntry[] = [
  {
    entityType: "deal",
    categoryId: CATEGORY_ID,
    statusId: "C10:NEW",
    name: "Новая заявка",
    semanticId: "P",
    sortOrder: 10
  },
  {
    entityType: "deal",
    categoryId: CATEGORY_ID,
    statusId: "C10:QUALIFY",
    name: "Квалификация",
    semanticId: "P",
    sortOrder: 20
  },
  {
    entityType: "deal",
    categoryId: CATEGORY_ID,
    statusId: "C10:MEETING",
    name: "Встреча назначена",
    semanticId: "P",
    sortOrder: 30
  },
  {
    entityType: "deal",
    categoryId: CATEGORY_ID,
    statusId: "C10:CONTRACT",
    name: "Согласование договора",
    semanticId: "P",
    sortOrder: 40
  },
  {
    entityType: "deal",
    categoryId: CATEGORY_ID,
    statusId: WON_STAGE_ID,
    name: "Продажа",
    semanticId: "S",
    sortOrder: 50
  },
  {
    entityType: "deal",
    categoryId: CATEGORY_ID,
    statusId: "C10:LOSE",
    name: "Отказ",
    semanticId: "F",
    sortOrder: 60
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "ADS",
    name: "Реклама",
    semanticId: null,
    sortOrder: 10
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "EVENT",
    name: "Мероприятия",
    semanticId: null,
    sortOrder: 20
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "PARTNER",
    name: "Партнеры",
    semanticId: null,
    sortOrder: 30
  },
  {
    entityType: "source",
    categoryId: null,
    statusId: "CALL",
    name: "Входящие звонки",
    semanticId: null,
    sortOrder: 40
  }
];

const MANAGERS: ManagerDirectoryEntry[] = [
  { id: "78", name: "Анна Петрова" },
  { id: "13020", name: "Михаил Соколов" },
  { id: "11234", name: "Екатерина Волкова" },
  { id: "8244", name: "Илья Морозов" },
  { id: "9350", name: "Ольга Кузнецова" },
  { id: "10442", name: "Дмитрий Орлов" },
  { id: "11806", name: "Марина Лебедева" },
  { id: "12140", name: "Сергей Ковалев" }
];

const SOURCE_IDS = ["ADS", "EVENT", "PARTNER", "CALL"] as const;
const QUALITIES = ["Целевой", "Теплый", "Повторный"] as const;
const CLUBS = ["Клуб 500", "Клуб 1000", "Клуб 2500"] as const;
const TARGET_GROUPS = [
  "ClubFirst Russia / One",
  "ClubFirst GlobAll",
  "ClubFirst Future"
] as const;
const MEETING_TYPES = ["Онлайн", "Офис", "Выездная"] as const;
const REFUSAL_REASONS = [
  "Неактуально сейчас",
  "Выбрали другой формат",
  "Нет бюджета",
  "Перенесли решение"
] as const;

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addMinutes(date: Date, minutes: number) {
  const copy = new Date(date);
  copy.setUTCMinutes(copy.getUTCMinutes() + minutes);
  return copy;
}

function iso(date: Date) {
  return date.toISOString();
}

function monthStart(input: Date, monthsBack: number) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth() - monthsBack, 1, 9));
}

function select<T>(items: readonly T[], index: number) {
  return items[index % items.length] as T;
}

function resolveFinalState(index: number) {
  const bucket = index % 12;
  if (bucket < 6) {
    return {
      stageId: WON_STAGE_ID,
      semanticId: "S" as const,
      closed: true,
      won: true
    };
  }

  if (bucket < 9) {
    return {
      stageId: "C10:LOSE",
      semanticId: "F" as const,
      closed: true,
      won: false
    };
  }

  return {
    stageId: index % 2 === 0 ? "C10:CONTRACT" : "C10:MEETING",
    semanticId: "P" as const,
    closed: false,
    won: false
  };
}

function resolveTariff(targetGroup: string, index: number) {
  if (targetGroup === "ClubFirst GlobAll") {
    return "Цифровой / GlobAll";
  }

  if (targetGroup === "ClubFirst Future") {
    return index % 2 === 0 ? "CFF / Федеральный" : "Федеральный";
  }

  return index % 2 === 0 ? "Федеральный" : "Региональный";
}

function buildRows(input: Required<Omit<SeedStandDataInput, "repository">>) {
  const deals: DealSnapshot[] = [];
  const stageHistory: StageHistorySnapshot[] = [];
  const activities: ActivitySnapshot[] = [];
  const activityBindings: ActivityBindingSnapshot[] = [];
  const calls: CallSnapshot[] = [];
  const events: EventSnapshot[] = [];
  const visits: ConversionEventVisitSnapshot[] = [];
  const visitStageHistory: EventVisitStageHistorySnapshot[] = [];
  let dealCounter = 0;
  let activityCounter = 0;
  let callCounter = 0;

  for (let monthOffset = input.months - 1; monthOffset >= 0; monthOffset -= 1) {
    const baseMonth = monthStart(input.now, monthOffset);
    const eventId = `70${String(monthOffset + 1).padStart(2, "0")}`;
    const eventDate = addDays(baseMonth, 14);
    events.push({
      eventId,
      entityTypeId: 200,
      categoryId: 10,
      title: `Бизнес-завтрак ${baseMonth.toLocaleString("ru-RU", { month: "long", timeZone: "UTC" })}`,
      eventDate: iso(eventDate),
      startAt: iso(eventDate),
      endAt: iso(addMinutes(eventDate, 120)),
      stageId: "EVENT:COMPLETED",
      stageName: "Проведено",
      status: "completed",
      eventTypeId: "breakfast",
      eventTypeLabel: "Бизнес-завтрак",
      formatId: "offline",
      createdTime: iso(addDays(baseMonth, -8)),
      updatedTime: iso(addDays(eventDate, 1))
    });

    for (let monthDealIndex = 0; monthDealIndex < input.dealsPerMonth; monthDealIndex += 1) {
      const globalIndex = dealCounter;
      const manager = select(MANAGERS, globalIndex);
      const sourceId = select(SOURCE_IDS, globalIndex);
      const finalState = resolveFinalState(globalIndex);
      const createdDayOffset = 1 + Math.floor((monthDealIndex * 24) / input.dealsPerMonth);
      const createdAt = addMinutes(
        addDays(baseMonth, createdDayOffset),
        (monthDealIndex % 6) * 95
      );
      const closedAt = finalState.closed
        ? addDays(createdAt, 8 + (globalIndex % 12))
        : null;
      const modifiedAt = finalState.closed ? closedAt : addDays(createdAt, 18);
      const dealId = String(810000 + globalIndex + 1);
      const contactId = String(510000 + globalIndex + 1);
      const leadId = String(610000 + globalIndex + 1);
      const club = select(CLUBS, globalIndex);
      const targetGroup = select(TARGET_GROUPS, globalIndex);
      const tariff = resolveTariff(targetGroup, globalIndex);
      const opportunity = finalState.won
        ? 650_000 + (globalIndex % 9) * 85_000
        : finalState.closed
          ? 0
          : 420_000 + (globalIndex % 6) * 60_000;

      deals.push({
        id: dealId,
        title: null,
        contactId,
        leadId,
        categoryId: CATEGORY_ID,
        stageId: finalState.stageId,
        stageSemanticId: finalState.semanticId,
        opportunity,
        assignedById: manager.id,
        sourceId,
        qualityValue: select(QUALITIES, globalIndex),
        businessClubValue: club,
        targetGroupValue: targetGroup,
        meetingTypeValue: select(MEETING_TYPES, globalIndex),
        meetingDateValue: iso(addDays(createdAt, 5)),
        tariffValue: tariff,
        conversionEventValue: eventId,
        refusalReasonValue: finalState.semanticId === "F" ? select(REFUSAL_REASONS, globalIndex) : null,
        refusalReasonDetail: null,
        dateCreate: iso(createdAt),
        dateModify: iso(modifiedAt ?? createdAt),
        dateClosed: closedAt ? iso(closedAt) : null,
        utmSource: sourceId === "ADS" ? "yandex" : null,
        utmMedium: sourceId === "ADS" ? "cpc" : null,
        utmCampaign: sourceId === "ADS" ? "brand-attraction" : null,
        utmContent: null,
        utmTerm: null
      });

      const stageRows = [
        { id: `${dealId}-new`, stageId: "C10:NEW", semanticId: "P", at: createdAt },
        {
          id: `${dealId}-qualify`,
          stageId: "C10:QUALIFY",
          semanticId: "P",
          at: addDays(createdAt, 1)
        },
        {
          id: `${dealId}-meeting`,
          stageId: "C10:MEETING",
          semanticId: "P",
          at: addDays(createdAt, 4)
        }
      ];
      if (finalState.stageId === "C10:CONTRACT" || finalState.won) {
        stageRows.push({
          id: `${dealId}-contract`,
          stageId: "C10:CONTRACT",
          semanticId: "P",
          at: addDays(createdAt, 7)
        });
      }
      if (closedAt) {
        stageRows.push({
          id: `${dealId}-final`,
          stageId: finalState.stageId,
          semanticId: finalState.semanticId,
          at: closedAt
        });
      }
      stageHistory.push(
        ...stageRows.map((row) => ({
          id: row.id,
          ownerId: dealId,
          categoryId: CATEGORY_ID,
          stageId: row.stageId,
          stageSemanticId: row.semanticId,
          typeId: null,
          createdTime: iso(row.at)
        }))
      );

      const taskActivityId = String(720000 + activityCounter + 1);
      activityCounter += 1;
      activities.push({
        id: taskActivityId,
        ownerTypeId: "2",
        ownerId: dealId,
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: manager.id,
        createdTime: iso(addDays(createdAt, 1)),
        deadline: iso(addDays(createdAt, 2)),
        lastUpdated: iso(addDays(createdAt, 2)),
        completed: true,
        completedTime: iso(addDays(createdAt, 2))
      });
      activityBindings.push({
        activityId: taskActivityId,
        ownerTypeId: "2",
        ownerId: dealId
      });

      const meetingActivityId = String(730000 + activityCounter + 1);
      activityCounter += 1;
      activities.push({
        id: meetingActivityId,
        ownerTypeId: "2",
        ownerId: dealId,
        typeId: "1",
        providerId: "CRM_MEETING",
        responsibleId: manager.id,
        createdTime: iso(addDays(createdAt, 3)),
        deadline: iso(addDays(createdAt, 5)),
        lastUpdated: iso(addDays(createdAt, 5)),
        completed: globalIndex % 5 !== 0,
        completedTime: globalIndex % 5 !== 0 ? iso(addDays(createdAt, 5)) : null
      });
      activityBindings.push({
        activityId: meetingActivityId,
        ownerTypeId: "2",
        ownerId: dealId
      });

      const callsPerDeal = 10 + (globalIndex % 4);
      for (let callIndex = 0; callIndex < callsPerDeal; callIndex += 1) {
        const callActivityId = String(740000 + activityCounter + 1);
        activityCounter += 1;
        const callAt = addMinutes(
          addDays(createdAt, 1 + Math.floor(callIndex / 2)),
          45 + (callIndex % 2) * 180
        );
        activities.push({
          id: callActivityId,
          ownerTypeId: "2",
          ownerId: dealId,
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: manager.id,
          createdTime: iso(callAt),
          deadline: iso(callAt),
          lastUpdated: iso(callAt),
          completed: true,
          completedTime: iso(callAt)
        });
        activityBindings.push({
          activityId: callActivityId,
          ownerTypeId: "2",
          ownerId: dealId
        });
        calls.push({
          id: String(910000 + callCounter + 1),
          crmActivityId: callActivityId,
          portalUserId: manager.id,
          callType: callIndex % 2 === 0 ? "1" : "2",
          callStartDate: iso(callAt),
          callDurationSeconds: 65 + ((globalIndex + callIndex) % 8) * 35,
          crmEntityType: "DEAL",
          crmEntityId: dealId,
          callFailedCode: callIndex % 11 === 10 ? "304" : null
        });
        callCounter += 1;
      }

      {
        const visitId = String(860000 + globalIndex + 1);
        const status =
          globalIndex % 3 === 0
            ? "attended"
            : globalIndex % 3 === 1
              ? "confirmed"
              : "invited";
        visits.push({
          id: visitId,
          eventId,
          eventName: `Бизнес-завтрак ${baseMonth.toLocaleString("ru-RU", { month: "long", timeZone: "UTC" })}`,
          eventDate: iso(eventDate),
          status,
          stageId: "EVENT:INVITED",
          stageName: "Приглашен",
          dealId,
          contactId,
          managerId: manager.id,
          sourceId,
          createdTime: iso(addDays(eventDate, -7)),
          updatedTime: iso(addDays(eventDate, status === "attended" ? 1 : -1))
        });
        visitStageHistory.push({
          historyId: `${visitId}-invited`,
          visitId,
          entityTypeId: 200,
          categoryId: 10,
          stageId: "EVENT:INVITED",
          stageName: "Приглашен",
          typeId: null,
          changedAt: iso(addDays(eventDate, -7))
        });
        if (status === "confirmed" || status === "attended") {
          visitStageHistory.push({
            historyId: `${visitId}-confirmed`,
            visitId,
            entityTypeId: 200,
            categoryId: 10,
            stageId: "EVENT:CONFIRMED",
            stageName: "Подтвердил",
            typeId: null,
            changedAt: iso(addDays(eventDate, -2))
          });
        }
        if (status === "attended") {
          visitStageHistory.push({
            historyId: `${visitId}-attended`,
            visitId,
            entityTypeId: 200,
            categoryId: 10,
            stageId: "EVENT:ATTENDED",
            stageName: "Посетил",
            typeId: null,
            changedAt: iso(addDays(eventDate, 1))
          });
        }
      }

      dealCounter += 1;
    }
  }

  return {
    deals,
    stageHistory,
    activities,
    activityBindings,
    calls,
    events,
    visits,
    visitStageHistory
  };
}

function monthPeriods(now: Date, months: number) {
  return Array.from({ length: months }, (_value, index) => {
    const month = monthStart(now, months - index - 1);
    const year = month.getUTCFullYear();
    const monthNumber = month.getUTCMonth() + 1;
    const monthPart = String(monthNumber).padStart(2, "0");
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const lastDayPart = String(lastDay).padStart(2, "0");

    return {
      periodStart: `${year}-${monthPart}-01T00:00:00.000+03:00`,
      periodEnd: `${year}-${monthPart}-${lastDayPart}T23:59:59.999+03:00`
    };
  });
}

function buildSalesPlan(now: Date, months: number) {
  const updatedAt = iso(now);
  return {
    updatedAt,
    periods: monthPeriods(now, months).map((period) => ({
      ...period,
      rows: MANAGERS.flatMap((manager, managerIndex) =>
        TARGET_GROUPS.map((targetGroup, targetIndex) => ({
          managerId: manager.id,
          managerName: manager.name,
          targetGroupKey: targetGroup,
          targetGroupLabel: targetGroup,
          plannedDeals: 2 + ((managerIndex + targetIndex) % 2),
          plannedAmount: 1_250_000 + managerIndex * 95_000 + targetIndex * 140_000
        }))
      )
    }))
  };
}

function buildPricingRules(updatedAt: string) {
  return [
    {
      id: "clubfirst-federal",
      customerLabel: "ClubFirst Russia / One",
      tariffLabel: "Федеральный",
      attractionRevenueAmount: 620_000,
      enabled: true,
      sortOrder: 10,
      updatedAt
    },
    {
      id: "clubfirst-regional",
      customerLabel: "ClubFirst Russia / One",
      tariffLabel: "Региональный",
      attractionRevenueAmount: 480_000,
      enabled: true,
      sortOrder: 20,
      updatedAt
    },
    {
      id: "clubfirst-globall",
      customerLabel: "ClubFirst GlobAll",
      tariffLabel: "Цифровой / GlobAll",
      attractionRevenueAmount: 430_000,
      enabled: true,
      sortOrder: 30,
      updatedAt
    },
    {
      id: "clubfirst-future",
      customerLabel: "ClubFirst Future",
      tariffLabel: "CFF / Федеральный",
      attractionRevenueAmount: 560_000,
      enabled: true,
      sortOrder: 40,
      updatedAt
    }
  ];
}

function buildCostRules(): UnitEconomicsCostRule[] {
  return [
    {
      id: "lead-purchase-ads",
      articleId: "lead_purchase",
      pnlLevel: "variable_contribution",
      costBehavior: "variable",
      calculationMethod: "amount_per_lead",
      unitPrice: 1200,
      percent: null,
      amount: null,
      sourceKey: "ADS",
      qualityValue: null,
      eventNamePattern: null,
      enabled: true,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      sortOrder: 10
    },
    {
      id: "contractation-standard",
      articleId: "contractation",
      pnlLevel: "variable_contribution",
      costBehavior: "variable",
      calculationMethod: "amount_per_contract",
      unitPrice: 6500,
      percent: null,
      amount: null,
      sourceKey: null,
      qualityValue: null,
      eventNamePattern: null,
      enabled: true,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      sortOrder: 20
    },
    {
      id: "sales-bonus-club",
      articleId: "sales_bonus",
      pnlLevel: "variable_contribution",
      costBehavior: "variable",
      calculationMethod: "percent_of_club_membership",
      unitPrice: null,
      percent: 0.015,
      amount: null,
      sourceKey: null,
      qualityValue: null,
      eventNamePattern: null,
      enabled: true,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      sortOrder: 30
    },
    {
      id: "event-breakfast",
      articleId: "event_participants",
      pnlLevel: "variable_contribution",
      costBehavior: "variable",
      calculationMethod: "amount_per_participant",
      unitPrice: 650,
      percent: null,
      amount: null,
      sourceKey: null,
      qualityValue: null,
      eventNamePattern: "Бизнес-завтрак",
      enabled: true,
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      sortOrder: 40
    }
  ];
}

function buildCostFacts(now: Date, months: number): UnitEconomicsCostFact[] {
  return monthPeriods(now, months).flatMap((period, index) => [
    {
      id: `agency-${index + 1}`,
      articleId: "agency_retainers",
      pnlLevel: "above_ebitda",
      costBehavior: "fixed",
      calculationMethod: "manual_amount",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amount: 65_000,
      currency: "RUB",
      quantity: null,
      sourceSystem: "finance_upload",
      sourceReference: `monthly-marketing-${index + 1}`,
      confidence: "manual",
      status: "active",
      comment: null
    },
    {
      id: `event-space-${index + 1}`,
      articleId: "event_space",
      pnlLevel: "variable_contribution",
      costBehavior: "variable",
      calculationMethod: "imported_fact",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amount: 35_000,
      currency: "RUB",
      quantity: 1,
      sourceSystem: "finance_upload",
      sourceReference: `event-space-${index + 1}`,
      confidence: "imported",
      status: "active",
      comment: null
    }
  ]);
}

async function seedCallAnalysis(repository: SqliteRepository, calls: CallSnapshot[], now: Date) {
  const selectedCalls = calls;
  for (const [index, call] of selectedCalls.entries()) {
    const runId = `analysis-${randomUUID()}`;
    await repository.startCallAnalysisRun({
      id: runId,
      callId: call.id,
      crmActivityId: call.crmActivityId,
      triggerMode: "automatic",
      status: "analyzing",
      startedAt: iso(addMinutes(new Date(call.callStartDate), 10)),
      recordingSource: null,
      recordingFileId: null,
      model: null,
      promptVersion: null
    });
    await repository.saveCallAnalysisResult({
      callId: call.id,
      runId,
      status: "ready",
      transcriptByRoles: [
        {
          role: "manager",
          start: 0,
          end: 7,
          text: "Добрый день, уточню задачу и формат участия."
        },
        {
          role: "client",
          start: 8,
          end: 14,
          text: "Нам интересен формат для руководителей."
        },
        {
          role: "manager",
          start: 15,
          end: 25,
          text: "Зафиксирую следующий шаг и отправлю варианты времени."
        }
      ],
      fullTranscriptText:
        "Менеджер: Добрый день, уточню задачу и формат участия.\nКлиент: Нам интересен формат для руководителей.\nМенеджер: Зафиксирую следующий шаг и отправлю варианты времени.",
      aiEvaluation: {
        score: 76 + (index % 5) * 4,
        summary: "Менеджер выявил потребность, подтвердил интерес и согласовал следующий шаг.",
        risks: index % 3 === 0 ? ["Следует быстрее фиксировать бюджет."] : [],
        nextStepQuality: index % 4 === 0 ? "ok" : "good",
        classification: "qualification"
      },
      rawAiEvaluation: {
        score: 76 + (index % 5) * 4,
        summary: "Менеджер выявил потребность, подтвердил интерес и согласовал следующий шаг.",
        risks: index % 3 === 0 ? ["Следует быстрее фиксировать бюджет."] : []
      },
      attributes: {
        dealId: call.crmEntityId,
        callType: call.callType,
        durationSeconds: call.callDurationSeconds
      },
      model: "quality-review-v2",
      promptVersion: "calls-v2",
      analyzedAt: iso(addMinutes(new Date(call.callStartDate), 12)),
      updatedAt: iso(now)
    });
    await repository.finishCallAnalysisRun({
      runId,
      finishedAt: iso(addMinutes(new Date(call.callStartDate), 12)),
      status: "ready",
      model: "quality-review-v2",
      promptVersion: "calls-v2",
      recordingSource: "call_record_url",
      recordingFileId: null
    });
  }
}

async function seedCoverage(
  repository: SqliteRepository,
  now: Date,
  dealIds: string[]
) {
  const managerIds = MANAGERS.map((manager) => manager.id);
  const scopeKey = buildCategoryScopeKey([CATEGORY_ID], managerIds);
  const syncedAt = iso(now);
  const coverageRows = [
    ...["CRM_TODO", "CRM_TASKS_TASK", "VOXIMPLANT_CALL", "CRM_MEETING"].map(
      (providerId) => ({
        scopeKey,
        stream: "activity_history",
        providerId,
        algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION
      })
    ),
    {
      scopeKey,
      stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
      providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
      algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION
    },
    {
      scopeKey,
      stream: CALL_STATS_COVERAGE_STREAM,
      providerId: CALL_STATS_COVERAGE_PROVIDER,
      algorithmVersion: CALL_STATS_COVERAGE_VERSION
    },
    {
      scopeKey,
      stream: CONVERSION_EVENT_VISITS_COVERAGE_STREAM,
      providerId: CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER,
      algorithmVersion: CONVERSION_EVENT_VISITS_COVERAGE_VERSION
    },
    {
      scopeKey,
      stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
      providerId: "UF_CRM_1669784197394",
      algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION
    }
  ];

  for (const row of coverageRows) {
    await repository.upsertSyncCoverage({
      ...row,
      coveredFrom: FULL_COVERAGE_FROM,
      coveredTo: null,
      syncedAt
    });
  }

  const syncRunId = await repository.createSyncRun({
    startedAt: iso(addMinutes(now, -3)),
    mode: "full",
    modifiedAfter: null,
    scopeKey
  });
  await repository.replaceCurrentAttractionScope({
    scopeKey,
    dealIds,
    reconciledAt: syncedAt
  });
  await repository.finishSyncRun({
    syncRunId,
    finishedAt: syncedAt,
    status: "success",
    leadsSynced: 0,
    dealsSynced: dealIds.length,
    dealBreakdown: {
      total: dealIds.length,
      created: dealIds.length,
      updated: 0,
      closed: 0,
      reopened: 0,
      unchanged: 0
    },
    diagnostics: [],
    modifiedAfter: null
  });
}

export async function seedStandData(input: SeedStandDataInput) {
  const now = input.now ?? new Date();
  const months = input.months ?? 8;
  const dealsPerMonth = input.dealsPerMonth ?? 32;
  const built = buildRows({ now, months, dealsPerMonth });

  await input.repository.replaceStageCatalog(STAGES);
  await input.repository.upsertManagerDirectory(MANAGERS);
  await input.repository.replaceManagerWhitelistSettings({
    moduleKey: "attraction",
    managerIds: MANAGERS.map((manager) => manager.id),
    teams: [
      {
        id: "core",
        name: "Основная группа",
        managerIds: MANAGERS.slice(0, 2).map((manager) => manager.id)
      },
      {
        id: "events",
        name: "Мероприятия",
        managerIds: MANAGERS.slice(2).map((manager) => manager.id)
      }
    ],
    updatedAt: iso(now)
  });
  await input.repository.setWonStageIds([WON_STAGE_ID]);
  await input.repository.upsertDeals(built.deals);
  await input.repository.upsertStageHistory(built.stageHistory);
  await input.repository.upsertActivities(built.activities);
  await input.repository.upsertActivityBindings(built.activityBindings);
  await input.repository.upsertCalls(built.calls);
  await input.repository.upsertEventSnapshots(built.events);
  await input.repository.upsertConversionEventVisits(built.visits);
  await input.repository.upsertEventVisitStageHistory(built.visitStageHistory);
  await input.repository.replaceConversionEventTypeOptions([
    {
      id: "breakfast",
      title: "Бизнес-завтрак",
      categoryId: 10,
      stageId: "EVENT:COMPLETED",
      selectedForPlannedInventory: true
    }
  ]);
  await input.repository.replaceModuleEventTypeSettings({
    moduleKey: "attraction",
    rows: [
      {
        moduleKey: "attraction",
        eventTypeId: "breakfast",
        eventTypeLabel: "Бизнес-завтрак",
        enabled: true,
        updatedAt: iso(now)
      }
    ]
  });

  const stageFacts = buildDealStageFacts({
    deals: built.deals,
    stageHistory: built.stageHistory,
    stageCatalog: STAGES
  });
  const eventVisitFacts = buildEventVisitFacts({
    visits: built.visits,
    events: built.events,
    visitStageHistory: built.visitStageHistory,
    deals: built.deals,
    stageFacts
  });
  const touchpoints = [
    ...buildDealTouchpointFacts({
      deals: built.deals,
      stageFacts,
      activities: built.activities,
      activityBindings: built.activityBindings,
      calls: built.calls,
      conversionEventVisits: built.visits
    }).filter((fact) => fact.kind !== "conversion_event_visit"),
    ...buildConversionEventTouchpointFacts({
      eventVisitFacts,
      stageFacts
    })
  ];
  await input.repository.replaceAnalyticsFacts({
    identityLinks: buildIdentityLinks({
      moduleKey: "attraction",
      deals: built.deals
    }),
    dealStageFacts: stageFacts,
    dealTouchpointFacts: touchpoints,
    eventVisitFacts
  });

  await input.repository.replaceSalesPlanPeriods(buildSalesPlan(now, months));
  await input.repository.replacePricingRules({
    updatedAt: iso(now),
    rules: buildPricingRules(iso(now))
  });
  await input.repository.replaceUnitEconomicsCostRules({
    updatedAt: iso(now),
    eventParticipantMode: "attended",
    rules: buildCostRules()
  });
  await input.repository.upsertUnitEconomicsCostFacts(buildCostFacts(now, months));
  await seedCallAnalysis(input.repository, built.calls, now);
  await seedCoverage(
    input.repository,
    now,
    built.deals.map((deal) => deal.id)
  );

  return {
    deals: built.deals.length,
    activities: built.activities.length,
    calls: built.calls.length,
    events: built.events.length,
    visits: built.visits.length
  };
}

export async function runStandDataCli() {
  const env = readEnv();
  const repository = createSqliteRepository({
    databaseUrl: env.attractionDatabaseUrl,
    defaultWonStageIds: env.reportWonStageIds
  });

  try {
    const result = await seedStandData({ repository });
    console.log(
      `Stand data seeded: ${result.deals} deals, ${result.calls} calls, ${result.visits} event visits.`
    );
  } finally {
    repository.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runStandDataCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
