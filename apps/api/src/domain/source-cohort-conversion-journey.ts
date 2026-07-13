import type {
  SourceCohortConversionEventDepthKey,
  SourceCohortConversionJourney,
  SourceCohortConversionJourneyCoreStepKey,
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
    label: "Первый звонок",
    evidence:
      "Первая прямая доверенная исходящая попытка звонка после создания, независимо от результата.",
    getDate: (facts) => facts.firstCallAt
  },
  {
    stepKey: "confirmed_conversation",
    label: "Подтвержденный разговор",
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
