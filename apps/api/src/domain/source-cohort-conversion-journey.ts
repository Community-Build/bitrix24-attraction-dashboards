import type {
  ReportRange,
  SourceCohortConversionEventDepthKey,
  SourceCohortConversionJourney,
  SourceCohortConversionJourneyCoreStepKey,
  SourceCohortConversionJourneyDealRow,
  SourceCohortConversionJourneyDealStatus,
  SourceCohortConversionJourneyDrilldown,
  SourceCohortConversionJourneyEventStepKey
} from "@bitrix24-reporting/contracts";

const DAY_MS = 86_400_000;

export interface SourceCohortConversionJourneyDealFacts {
  dealId: string;
  createdAt: string;
  firstCallAt: string | null;
  confirmedConversationAt: string | null;
  meetingScheduledAt: string | null;
  meetingCompletedAt: string | null;
  attendedEventAts: string[];
  contractAt: string | null;
  transferredAt: string | null;
}

export interface SourceCohortConversionJourneyDrilldownDealFacts
  extends SourceCohortConversionJourneyDealFacts {
  dealUrl: string | null;
  managerId: string;
  managerName: string;
  currentStageId: string;
  currentStageName: string;
  outcome: "open" | "lost" | "won";
}

type CoreStepDefinition = {
  stepKey: SourceCohortConversionJourneyCoreStepKey;
  label: string;
  evidence: string;
  getDate: (facts: SourceCohortConversionJourneyDealFacts) => string | null;
};

const CORE_STEP_DEFINITIONS: CoreStepDefinition[] = [
  {
    stepKey: "created",
    label: "Создана",
    evidence: "Дата создания сделки в когорте; это вход в «Базу входящую».",
    getDate: (facts) => facts.createdAt
  },
  {
    stepKey: "first_call",
    label: "Первая попытка",
    evidence:
      "Первая прямая доверенная исходящая попытка звонка после создания, независимо от результата.",
    getDate: (facts) => facts.firstCallAt
  },
  {
    stepKey: "confirmed_conversation",
    label: "Успешный разговор",
    evidence:
      "Первый прямой исходящий звонок после создания: есть соединение и разговор дольше 30 секунд.",
    getDate: (facts) => facts.confirmedConversationAt
  },
  {
    stepKey: "meeting_scheduled",
    label: "Встреча назначена",
    evidence:
      "Зафиксирована дата встречи: изменение даты в сделке или создание связанной встречи в CRM.",
    getDate: (facts) => facts.meetingScheduledAt
  },
  {
    stepKey: "meeting_completed",
    label: "Встреча состоялась",
    evidence: "Связанная со сделкой встреча отмечена проведенной.",
    getDate: (facts) => facts.meetingCompletedAt
  },
  {
    stepKey: "contract",
    label: "Контракт",
    evidence:
      "Сделка вошла в CRM-этап контракта после состоявшейся встречи; посещение события не обязательно.",
    getDate: (facts) => facts.contractAt
  },
  {
    stepKey: "transferred",
    label: "Передано в клуб",
    evidence: "Сделка вошла в успешный этап после этапа контракта.",
    getDate: (facts) => facts.transferredAt
  }
];

const VISIBLE_CORE_STEP_KEYS: SourceCohortConversionJourneyCoreStepKey[] = [
  "created",
  "first_call",
  "confirmed_conversation",
  "meeting_completed",
  "contract",
  "transferred"
];

const STEP_SLA = {
  first_call: { days: 3, basis: "created" },
  confirmed_conversation: { days: 3, basis: "created" },
  meeting_scheduled: { days: 7, basis: "created" },
  meeting_completed: { days: 7, basis: "created" },
  contract: { days: 7, basis: "previous" },
  transferred: { days: 14, basis: "previous" }
} satisfies Record<
  Exclude<SourceCohortConversionJourneyCoreStepKey, "created">,
  { days: number; basis: "created" | "previous" }
>;

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function toRate(numerator: number, denominator: number) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

function medianDays(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const right = sorted[middle];
  if (right === undefined) {
    return null;
  }

  const medianMs =
    sorted.length % 2 === 1 ? right : ((sorted[middle - 1] ?? right) + right) / 2;
  return Number((medianMs / DAY_MS).toFixed(2));
}

function durationMs(from: string | null, to: string | null) {
  const fromMs = timestamp(from);
  const toMs = timestamp(to);
  if (fromMs === null || toMs === null || toMs < fromMs) {
    return null;
  }

  return toMs - fromMs;
}

function isReachedAfterCreation(
  facts: SourceCohortConversionJourneyDealFacts,
  value: string | null
) {
  return durationMs(facts.createdAt, value) !== null;
}

function buildCoreSteps(dealFacts: SourceCohortConversionJourneyDealFacts[]) {
  const totalDeals = dealFacts.length;
  const reachedByStep = new Map<
    SourceCohortConversionJourneyCoreStepKey,
    SourceCohortConversionJourneyDealFacts[]
  >();

  for (const definition of CORE_STEP_DEFINITIONS) {
    reachedByStep.set(
      definition.stepKey,
      definition.stepKey === "created"
        ? dealFacts
        : dealFacts.filter((facts) =>
            isReachedAfterCreation(facts, definition.getDate(facts))
          )
    );
  }

  return CORE_STEP_DEFINITIONS.map((definition, index) => {
    const reachedFacts = reachedByStep.get(definition.stepKey) ?? [];
    const previousDefinition =
      definition.stepKey === "meeting_completed"
        ? CORE_STEP_DEFINITIONS.find(
            (candidate) => candidate.stepKey === "confirmed_conversation"
          ) ?? null
        : CORE_STEP_DEFINITIONS[index - 1] ?? null;
    const previousFacts = previousDefinition
      ? reachedByStep.get(previousDefinition.stepKey) ?? []
      : dealFacts;
    const transitionedFacts = previousDefinition
      ? dealFacts.filter((facts) => {
          const previousAt = previousDefinition.getDate(facts);
          const currentAt = definition.getDate(facts);
          return durationMs(previousAt, currentAt) !== null;
        })
      : reachedFacts;
    const fromCreateDurations = reachedFacts
      .map((facts) => durationMs(facts.createdAt, definition.getDate(facts)))
      .filter((value): value is number => value !== null);
    const fromPreviousDurations = previousDefinition
      ? transitionedFacts
          .map((facts) =>
            durationMs(
              previousDefinition.getDate(facts),
              definition.getDate(facts)
            )
          )
          .filter((value): value is number => value !== null)
      : [];

    return {
      stepKey: definition.stepKey,
      label: definition.label,
      deals: reachedFacts.length,
      rateFromCohort: toRate(reachedFacts.length, totalDeals),
      transitionDeals: transitionedFacts.length,
      rateFromPrevious:
        previousDefinition === null
          ? totalDeals > 0
            ? 100
            : 0
          : toRate(transitionedFacts.length, previousFacts.length),
      dropoffDeals:
        previousDefinition === null
          ? 0
          : Math.max(previousFacts.length - transitionedFacts.length, 0),
      medianDaysFromCreate:
        definition.stepKey === "created"
          ? totalDeals > 0
            ? 0
            : null
          : medianDays(fromCreateDurations),
      medianDaysFromPrevious:
        previousDefinition === null
          ? totalDeals > 0
            ? 0
            : null
          : medianDays(fromPreviousDurations),
      evidence: definition.evidence
    };
  });
}

function eventDatesBetweenMeetingAndContract(
  facts: SourceCohortConversionJourneyDealFacts,
  asOf: string
) {
  const meetingAtMs = timestamp(facts.meetingCompletedAt);
  if (meetingAtMs === null) {
    return [];
  }

  const contractAtMs = timestamp(facts.contractAt);
  const asOfMs = timestamp(asOf) ?? Number.POSITIVE_INFINITY;
  const ceilingMs =
    contractAtMs !== null && contractAtMs >= meetingAtMs ? contractAtMs : asOfMs;

  return facts.attendedEventAts
    .filter((value) => {
      const valueMs = timestamp(value);
      return valueMs !== null && valueMs >= meetingAtMs && valueMs <= ceilingMs;
    })
    .sort((left, right) => left.localeCompare(right));
}

function buildEventSteps(
  dealFacts: SourceCohortConversionJourneyDealFacts[],
  asOf: string
) {
  const eventDatesByDeal = new Map(
    dealFacts.map((facts) => [
      facts.dealId,
      eventDatesBetweenMeetingAndContract(facts, asOf)
    ])
  );
  const definitions: Array<{
    stepKey: SourceCohortConversionJourneyEventStepKey;
    label: string;
    eventIndex: number;
    evidence: string;
  }> = [
    {
      stepKey: "event_1",
      label: "Посетил событие №1",
      eventIndex: 0,
      evidence:
        "Первое уникальное подтвержденное посещение после состоявшейся встречи и до контракта."
    },
    {
      stepKey: "event_2",
      label: "Посетил событие №2",
      eventIndex: 1,
      evidence:
        "Второе уникальное подтвержденное посещение после состоявшейся встречи и до контракта."
    },
    {
      stepKey: "event_3_plus",
      label: "Посетил событие №3+",
      eventIndex: 2,
      evidence:
        "Третье или последующее уникальное подтвержденное посещение до контракта."
    }
  ];
  const completedMeetingFacts = dealFacts.filter((facts) =>
    isReachedAfterCreation(facts, facts.meetingCompletedAt)
  );

  return definitions.map((definition, index) => {
    const reachedFacts = completedMeetingFacts.filter(
      (facts) => (eventDatesByDeal.get(facts.dealId)?.length ?? 0) > definition.eventIndex
    );
    const previousFacts =
      index === 0
        ? completedMeetingFacts
        : completedMeetingFacts.filter(
            (facts) =>
              (eventDatesByDeal.get(facts.dealId)?.length ?? 0) >
              definition.eventIndex - 1
          );
    const fromCreateDurations = reachedFacts
      .map((facts) =>
        durationMs(
          facts.createdAt,
          eventDatesByDeal.get(facts.dealId)?.[definition.eventIndex] ?? null
        )
      )
      .filter((value): value is number => value !== null);
    const fromPreviousDurations = reachedFacts
      .map((facts) => {
        const eventDates = eventDatesByDeal.get(facts.dealId) ?? [];
        const previousAt =
          definition.eventIndex === 0
            ? facts.meetingCompletedAt
            : eventDates[definition.eventIndex - 1] ?? null;
        return durationMs(previousAt, eventDates[definition.eventIndex] ?? null);
      })
      .filter((value): value is number => value !== null);

    return {
      stepKey: definition.stepKey,
      label: definition.label,
      deals: reachedFacts.length,
      rateFromCohort: toRate(reachedFacts.length, dealFacts.length),
      transitionDeals: reachedFacts.length,
      rateFromPrevious: toRate(reachedFacts.length, previousFacts.length),
      dropoffDeals: Math.max(previousFacts.length - reachedFacts.length, 0),
      medianDaysFromCreate: medianDays(fromCreateDurations),
      medianDaysFromPrevious: medianDays(fromPreviousDurations),
      evidence: definition.evidence
    };
  });
}

function depthKeyForEventCount(count: number): SourceCohortConversionEventDepthKey {
  if (count >= 3) {
    return "3_plus";
  }

  return String(count) as SourceCohortConversionEventDepthKey;
}

function buildEventDepthRows(
  dealFacts: SourceCohortConversionJourneyDealFacts[],
  asOf: string
) {
  const completedMeetingFacts = dealFacts.filter((facts) =>
    isReachedAfterCreation(facts, facts.meetingCompletedAt)
  );
  const definitions: Array<{
    depthKey: SourceCohortConversionEventDepthKey;
    label: string;
  }> = [
    { depthKey: "0", label: "Без события" },
    { depthKey: "1", label: "1 событие" },
    { depthKey: "2", label: "2 события" },
    { depthKey: "3_plus", label: "3+ события" }
  ];

  return definitions.map((definition) => {
    const factsAtDepth = completedMeetingFacts.filter(
      (facts) =>
        depthKeyForEventCount(
          eventDatesBetweenMeetingAndContract(facts, asOf).length
        ) === definition.depthKey
    );
    const contractFacts = factsAtDepth.filter(
      (facts) => durationMs(facts.meetingCompletedAt, facts.contractAt) !== null
    );
    const transferredFacts = contractFacts.filter(
      (facts) => durationMs(facts.contractAt, facts.transferredAt) !== null
    );

    return {
      depthKey: definition.depthKey,
      label: definition.label,
      deals: factsAtDepth.length,
      rateFromCompletedMeeting: toRate(
        factsAtDepth.length,
        completedMeetingFacts.length
      ),
      contractDeals: contractFacts.length,
      contractRate: toRate(contractFacts.length, factsAtDepth.length),
      transferredDeals: transferredFacts.length,
      transferredRate: toRate(transferredFacts.length, factsAtDepth.length),
      medianDaysToContract: medianDays(
        contractFacts
          .map((facts) => durationMs(facts.meetingCompletedAt, facts.contractAt))
          .filter((value): value is number => value !== null)
      )
    };
  });
}

type DealClassification = Pick<
  SourceCohortConversionJourneyDealRow,
  "status" | "statusLabel" | "reason" | "ageFromAt" | "ageDays" | "slaDays"
>;

const STATUS_LABELS: Record<SourceCohortConversionJourneyDealStatus, string> = {
  advanced: "Перешла дальше",
  within_sla: "В пределах SLA",
  stuck: "Застряла",
  lost: "Завершена потерей",
  data_gap: "Проверить данные"
};

const STATUS_SORT_ORDER: Record<SourceCohortConversionJourneyDealStatus, number> = {
  stuck: 0,
  lost: 1,
  data_gap: 2,
  within_sla: 3,
  advanced: 4
};

function visibleCoreStepDefinitions() {
  const byKey = new Map(
    CORE_STEP_DEFINITIONS.map((definition) => [definition.stepKey, definition])
  );

  return VISIBLE_CORE_STEP_KEYS.map((stepKey) => byKey.get(stepKey)).filter(
    (definition): definition is CoreStepDefinition => Boolean(definition)
  );
}

function toDaysFromDuration(value: number | null) {
  return value === null ? null : Number((value / DAY_MS).toFixed(1));
}

function formatDaysForReason(value: number | null) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1
  }).format(value ?? 0);
}

function dataGap(reason: string): DealClassification {
  return {
    status: "data_gap",
    statusLabel: STATUS_LABELS.data_gap,
    reason,
    ageFromAt: null,
    ageDays: null,
    slaDays: null
  };
}

function classifyMissingTarget(input: {
  facts: SourceCohortConversionJourneyDrilldownDealFacts;
  previous: CoreStepDefinition;
  target: CoreStepDefinition;
  asOf: string;
}): DealClassification {
  const previousAt = input.previous.getDate(input.facts);
  const targetAt = input.target.getDate(input.facts);

  if (targetAt) {
    return dataGap(
      `Факт «${input.target.label}» есть, но его время не следует за шагом «${input.previous.label}». Проверьте хронологию и привязку факта.`
    );
  }

  if (input.facts.outcome === "lost") {
    return {
      status: "lost",
      statusLabel: STATUS_LABELS.lost,
      reason: `Текущий итог — «${input.facts.currentStageName}»; подтвержденного шага «${input.target.label}» нет.`,
      ageFromAt: previousAt,
      ageDays: toDaysFromDuration(durationMs(previousAt, input.asOf)),
      slaDays: null
    };
  }

  if (input.facts.outcome === "won") {
    return dataGap(
      `Сделка уже передана в клуб, но подтвержденного шага «${input.target.label}» в траектории нет.`
    );
  }

  if (input.target.stepKey === "created") {
    return dataGap("У сделки нет корректной даты создания внутри выбранной когорты.");
  }

  const sla = STEP_SLA[input.target.stepKey];
  const ageFromAt = sla.basis === "created" ? input.facts.createdAt : previousAt;
  const ageDuration = durationMs(ageFromAt, input.asOf);
  if (ageDuration === null) {
    return dataGap(
      `Нельзя рассчитать срок до шага «${input.target.label}»: отсутствует корректная опорная дата.`
    );
  }

  const ageDays = toDaysFromDuration(ageDuration);
  const isStuck = ageDuration > sla.days * DAY_MS;

  return {
    status: isStuck ? "stuck" : "within_sla",
    statusLabel: STATUS_LABELS[isStuck ? "stuck" : "within_sla"],
    reason: isStuck
      ? `Подтвержденного шага «${input.target.label}» нет: прошло ${formatDaysForReason(ageDays)} дн. при SLA ${sla.days} дн.`
      : `Подтвержденного шага «${input.target.label}» пока нет: прошло ${formatDaysForReason(ageDays)} дн. из SLA ${sla.days} дн.`,
    ageFromAt,
    ageDays,
    slaDays: sla.days
  };
}

function classifyReachedDeal(input: {
  facts: SourceCohortConversionJourneyDrilldownDealFacts;
  previous: CoreStepDefinition | null;
  selected: CoreStepDefinition;
  next: CoreStepDefinition | null;
  asOf: string;
}): DealClassification {
  const selectedAt = input.selected.getDate(input.facts);

  if (
    input.previous &&
    durationMs(input.previous.getDate(input.facts), selectedAt) === null
  ) {
    return dataGap(
      `Факт «${input.selected.label}» найден, но строгий переход после «${input.previous.label}» не подтвержден по времени.`
    );
  }

  if (!input.next) {
    return {
      status: "advanced",
      statusLabel: "Результат достигнут",
      reason: "Финальный шаг «Передано в клуб» подтвержден.",
      ageFromAt: selectedAt,
      ageDays: 0,
      slaDays: null
    };
  }

  if (durationMs(selectedAt, input.next.getDate(input.facts)) !== null) {
    return {
      status: "advanced",
      statusLabel: STATUS_LABELS.advanced,
      reason: `Следующий шаг «${input.next.label}» подтвержден после выбранного шага.`,
      ageFromAt: selectedAt,
      ageDays: toDaysFromDuration(
        durationMs(selectedAt, input.next.getDate(input.facts))
      ),
      slaDays:
        input.next.stepKey === "created" ? null : STEP_SLA[input.next.stepKey].days
    };
  }

  return classifyMissingTarget({
    facts: input.facts,
    previous: input.selected,
    target: input.next,
    asOf: input.asOf
  });
}

function toDrilldownDealRow(input: {
  facts: SourceCohortConversionJourneyDrilldownDealFacts;
  previous: CoreStepDefinition | null;
  selected: CoreStepDefinition;
  next: CoreStepDefinition | null;
  classification: DealClassification;
}): SourceCohortConversionJourneyDealRow {
  return {
    dealId: input.facts.dealId,
    dealUrl: input.facts.dealUrl,
    managerId: input.facts.managerId,
    managerName: input.facts.managerName,
    currentStageId: input.facts.currentStageId,
    currentStageName: input.facts.currentStageName,
    outcome: input.facts.outcome,
    ...input.classification,
    createdAt: input.facts.createdAt,
    previousStepAt: input.previous?.getDate(input.facts) ?? null,
    selectedStepAt: input.selected.getDate(input.facts),
    nextStepAt: input.next?.getDate(input.facts) ?? null
  };
}

function sortDrilldownDeals(rows: SourceCohortConversionJourneyDealRow[]) {
  return rows.sort((left, right) => {
    const byStatus = STATUS_SORT_ORDER[left.status] - STATUS_SORT_ORDER[right.status];
    if (byStatus !== 0) {
      return byStatus;
    }

    const byAge = (right.ageDays ?? -1) - (left.ageDays ?? -1);
    return byAge !== 0
      ? byAge
      : left.dealId.localeCompare(right.dealId, "ru", { numeric: true });
  });
}

export function buildSourceCohortConversionJourneyDrilldown(input: {
  range: ReportRange;
  dealFacts: SourceCohortConversionJourneyDrilldownDealFacts[];
  stepKey: SourceCohortConversionJourneyCoreStepKey;
  asOf: string;
}): SourceCohortConversionJourneyDrilldown {
  const definitions = visibleCoreStepDefinitions();
  const selectedIndex = definitions.findIndex(
    (definition) => definition.stepKey === input.stepKey
  );
  const selected = definitions[selectedIndex];
  if (!selected) {
    throw new Error(`Unsupported conversion journey step: ${input.stepKey}`);
  }

  const previous = definitions[selectedIndex - 1] ?? null;
  const next = definitions[selectedIndex + 1] ?? null;
  const reached = input.dealFacts.filter((facts) =>
    isReachedAfterCreation(facts, selected.getDate(facts))
  );
  const missed = previous
    ? input.dealFacts.filter(
        (facts) =>
          isReachedAfterCreation(facts, previous.getDate(facts)) &&
          durationMs(previous.getDate(facts), selected.getDate(facts)) === null
      )
    : [];
  const notAdvanced = next
    ? input.dealFacts.filter(
        (facts) =>
          isReachedAfterCreation(facts, selected.getDate(facts)) &&
          durationMs(selected.getDate(facts), next.getDate(facts)) === null
      )
    : [];

  const reachedRows = sortDrilldownDeals(
    reached.map((facts) =>
      toDrilldownDealRow({
        facts,
        previous,
        selected,
        next,
        classification: classifyReachedDeal({
          facts,
          previous,
          selected,
          next,
          asOf: input.asOf
        })
      })
    )
  );
  const missedRows = previous
    ? sortDrilldownDeals(
        missed.map((facts) =>
          toDrilldownDealRow({
            facts,
            previous,
            selected,
            next,
            classification: classifyMissingTarget({
              facts,
              previous,
              target: selected,
              asOf: input.asOf
            })
          })
        )
      )
    : [];
  const notAdvancedRows = next
    ? sortDrilldownDeals(
        notAdvanced.map((facts) =>
          toDrilldownDealRow({
            facts,
            previous,
            selected,
            next,
            classification: classifyMissingTarget({
              facts,
              previous: selected,
              target: next,
              asOf: input.asOf
            })
          })
        )
      )
    : [];

  return {
    range: input.range,
    drilldownKind: "fact",
    stepKey: selected.stepKey,
    stepLabel: selected.label,
    previousStepKey: previous?.stepKey ?? null,
    previousStepLabel: previous?.label ?? null,
    nextStepKey: next?.stepKey ?? null,
    nextStepLabel: next?.label ?? null,
    asOf: input.asOf,
    views: {
      reached: {
        viewKey: "reached",
        label: "Дошли сюда",
        count: reachedRows.length,
        deals: reachedRows
      },
      missed: {
        viewKey: "missed",
        label: previous ? `Не дошли из «${previous.label}»` : "Нет предыдущего шага",
        count: missedRows.length,
        deals: missedRows
      },
      notAdvanced: {
        viewKey: "not_advanced",
        label: next ? `Не перешли к «${next.label}»` : "Финальный шаг",
        count: notAdvancedRows.length,
        deals: notAdvancedRows
      }
    }
  };
}

export function buildSourceCohortConversionJourney(input: {
  dealFacts: SourceCohortConversionJourneyDealFacts[];
  asOf: string;
}): SourceCohortConversionJourney {
  return {
    coreSteps: buildCoreSteps(input.dealFacts),
    eventSteps: buildEventSteps(input.dealFacts, input.asOf),
    eventDepthRows: buildEventDepthRows(input.dealFacts, input.asOf)
  };
}
