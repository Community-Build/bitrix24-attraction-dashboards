import type {
  ReportRange,
  SourceCohortConversionJourneyDealRow,
  SourceCohortConversionJourneyDealStatus,
  SourceCohortConversionJourneyDrilldown
} from "@bitrix24-reporting/contracts";

const DAY_MS = 86_400_000;

export const SOURCE_COHORT_CRM_STAGE_NOT_FOUND_ERROR_CODE =
  "SOURCE_COHORT_CRM_STAGE_NOT_FOUND";

export class SourceCohortConversionStageNotFoundError extends Error {
  readonly code = SOURCE_COHORT_CRM_STAGE_NOT_FOUND_ERROR_CODE;

  constructor(readonly stageId: string) {
    super(`Unsupported CRM stage: ${stageId}`);
    this.name = "SourceCohortConversionStageNotFoundError";
  }
}

export type SourceCohortConversionStageDrilldownStageKind =
  | "productive"
  | "won"
  | "lost"
  | "return";

export interface SourceCohortConversionStageDrilldownStage {
  stageId: string;
  stageName: string;
  sortOrder: number;
  stageKind: SourceCohortConversionStageDrilldownStageKind;
}

export interface SourceCohortConversionStageDrilldownDealFacts {
  dealId: string;
  dealUrl: string | null;
  managerId: string;
  managerName: string;
  currentStageId: string;
  currentStageName: string;
  currentStageEnteredAt: string | null;
  outcome: "open" | "lost" | "won";
  createdAt: string;
  stageEnteredAts: ReadonlyMap<string, readonly string[]>;
}

type StageClassification = Pick<
  SourceCohortConversionJourneyDealRow,
  "status" | "statusLabel" | "reason" | "ageFromAt" | "ageDays" | "slaDays"
>;

const STATUS_SORT_ORDER: Record<SourceCohortConversionJourneyDealStatus, number> = {
  stuck: 0,
  lost: 1,
  returned: 2,
  data_gap: 3,
  within_sla: 4,
  advanced: 5
};

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function durationMs(from: string | null, to: string | null) {
  const fromMs = timestamp(from);
  const toMs = timestamp(to);
  if (fromMs === null || toMs === null || toMs < fromMs) {
    return null;
  }

  return toMs - fromMs;
}

function toDays(value: number | null) {
  return value === null ? null : Number((value / DAY_MS).toFixed(1));
}

function formatDays(value: number | null) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1
  }).format(value ?? 0);
}

function firstStageAt(
  facts: SourceCohortConversionStageDrilldownDealFacts,
  stageId: string,
  after: string | null = facts.createdAt
) {
  const afterMs = timestamp(after);
  if (afterMs === null) {
    return null;
  }

  return (
    [...(facts.stageEnteredAts.get(stageId) ?? [])]
      .filter((value) => {
        const valueMs = timestamp(value);
        return valueMs !== null && valueMs >= afterMs;
      })
      .sort(
        (left, right) =>
          (timestamp(left) ?? Number.POSITIVE_INFINITY) -
          (timestamp(right) ?? Number.POSITIVE_INFINITY)
      )[0] ?? null
  );
}

function firstLaterProductiveStage(input: {
  facts: SourceCohortConversionStageDrilldownDealFacts;
  selected: SourceCohortConversionStageDrilldownStage;
  stages: SourceCohortConversionStageDrilldownStage[];
  after: string | null;
}) {
  return input.stages
    .filter(
      (stage) =>
        stage.sortOrder > input.selected.sortOrder &&
        stage.stageKind !== "lost" &&
        stage.stageKind !== "return"
    )
    .flatMap((stage) => {
      const enteredAt = firstStageAt(input.facts, stage.stageId, input.after);
      return enteredAt ? [{ stage, enteredAt }] : [];
    })
    .sort(
      (left, right) =>
        (timestamp(left.enteredAt) ?? Number.POSITIVE_INFINITY) -
        (timestamp(right.enteredAt) ?? Number.POSITIVE_INFINITY)
    )[0] ?? null;
}

function dataGap(statusLabel: string, reason: string): StageClassification {
  return {
    status: "data_gap",
    statusLabel,
    reason,
    ageFromAt: null,
    ageDays: null,
    slaDays: null
  };
}

function advanced(input: {
  statusLabel?: string;
  reason: string;
  fromAt: string | null;
  toAt: string | null;
}): StageClassification {
  return {
    status: "advanced",
    statusLabel: input.statusLabel ?? "Перешла дальше",
    reason: input.reason,
    ageFromAt: input.fromAt,
    ageDays: toDays(durationMs(input.fromAt, input.toAt)),
    slaDays: null
  };
}

function lost(reason: string): StageClassification {
  return {
    status: "lost",
    statusLabel: "Завершена потерей",
    reason,
    ageFromAt: null,
    ageDays: null,
    slaDays: null
  };
}

function returned(reason: string): StageClassification {
  return {
    status: "returned",
    statusLabel: "Возвращена в лидген",
    reason,
    ageFromAt: null,
    ageDays: null,
    slaDays: null
  };
}

function classifyReached(input: {
  facts: SourceCohortConversionStageDrilldownDealFacts;
  selected: SourceCohortConversionStageDrilldownStage;
  next: SourceCohortConversionStageDrilldownStage | null;
  selectedAt: string;
  nextAt: string | null;
  stages: SourceCohortConversionStageDrilldownStage[];
  asOf: string;
}): StageClassification {
  const currentStage = input.stages.find(
    (stage) => stage.stageId === input.facts.currentStageId
  );

  if (input.selected.stageKind === "lost") {
    if (currentStage?.stageKind === "return") {
      return returned(
        `После CRM-этапа «${input.selected.stageName}» сделка переведена в отдельный маршрут «${currentStage.stageName}».`
      );
    }

    if (input.facts.outcome === "won") {
      return advanced({
        statusLabel: "Возвращена в работу и передана",
        reason: `После CRM-этапа «${input.selected.stageName}» сделка была возобновлена и передана в клуб.`,
        fromAt: input.selectedAt,
        toAt: input.asOf
      });
    }

    if (input.facts.outcome === "open") {
      return advanced({
        statusLabel: "Снова в работе",
        reason: `После CRM-этапа «${input.selected.stageName}» сделка возвращена в работу; текущий этап — «${input.facts.currentStageName}».`,
        fromAt: input.selectedAt,
        toAt: input.facts.currentStageEnteredAt
      });
    }

    return lost(
      `Сделка завершена на CRM-этапе «${input.selected.stageName}».`
    );
  }

  if (input.selected.stageKind === "return") {
    if (
      input.facts.currentStageId === input.selected.stageId &&
      input.facts.outcome === "lost"
    ) {
      return returned(
        `Сделка возвращена поставщику на CRM-этапе «${input.selected.stageName}»; это отдельный маршрут, а не «Корзина».`
      );
    }

    if (input.facts.outcome === "won") {
      return advanced({
        statusLabel: "Возвращена в работу и передана",
        reason: `После возврата в лидген сделка была возобновлена и передана в клуб.`,
        fromAt: input.selectedAt,
        toAt: input.asOf
      });
    }

    if (input.facts.outcome === "open") {
      return advanced({
        statusLabel: "Снова в работе",
        reason: `После возврата в лидген сделка снова находится в работе; текущий этап — «${input.facts.currentStageName}».`,
        fromAt: input.selectedAt,
        toAt: input.facts.currentStageEnteredAt
      });
    }

    return lost(
      `После возврата в лидген сделка завершена на этапе «${input.facts.currentStageName}».`
    );
  }

  if (input.selected.stageKind === "won") {
    return advanced({
      statusLabel: "Результат достигнут",
      reason: "Финальный CRM-этап «Передано в клуб» подтвержден.",
      fromAt: input.selectedAt,
      toAt: input.selectedAt
    });
  }

  if (input.next && input.nextAt) {
    return advanced({
      reason: `Переход к следующему CRM-этапу «${input.next.stageName}» подтвержден.`,
      fromAt: input.selectedAt,
      toAt: input.nextAt
    });
  }

  const laterStage = firstLaterProductiveStage({
    facts: input.facts,
    selected: input.selected,
    stages: input.stages,
    after: input.selectedAt
  });
  if (laterStage) {
    return advanced({
      statusLabel: "Продвинулась дальше",
      reason: input.next
        ? `После «${input.selected.stageName}» сделка вошла в «${laterStage.stage.stageName}»; вход в «${input.next.stageName}» в истории не зафиксирован.`
        : `После «${input.selected.stageName}» сделка вошла в «${laterStage.stage.stageName}».`,
      fromAt: input.selectedAt,
      toAt: laterStage.enteredAt
    });
  }

  if (input.facts.outcome === "lost") {
    if (currentStage?.stageKind === "return") {
      return returned(
        input.next
          ? `После «${input.selected.stageName}» сделка возвращена в лидген; перехода к «${input.next.stageName}» нет.`
          : `После «${input.selected.stageName}» сделка возвращена в лидген.`
      );
    }

    return lost(
      input.next
        ? `После «${input.selected.stageName}» сделка завершена на этапе «${input.facts.currentStageName}»; перехода к «${input.next.stageName}» нет.`
        : `Сделка завершена на этапе «${input.facts.currentStageName}».`
    );
  }

  if (input.facts.outcome === "won") {
    return advanced({
      statusLabel: "Результат достигнут",
      reason: input.next
        ? `Сделка уже передана в клуб; вход в «${input.next.stageName}» в истории не зафиксирован.`
        : "Сделка уже передана в клуб.",
      fromAt: input.selectedAt,
      toAt: input.asOf
    });
  }

  if (input.facts.currentStageId === input.selected.stageId) {
    const ageDays = toDays(
      durationMs(input.facts.currentStageEnteredAt ?? input.selectedAt, input.asOf)
    );
    return {
      status: "within_sla",
      statusLabel: "Сейчас на этапе",
      reason: input.next
        ? `Сделка остается на CRM-этапе «${input.selected.stageName}» ${formatDays(ageDays)} дн.; перехода к «${input.next.stageName}» пока нет.`
        : `Сделка остается на CRM-этапе «${input.selected.stageName}» ${formatDays(ageDays)} дн.`,
      ageFromAt: input.facts.currentStageEnteredAt ?? input.selectedAt,
      ageDays,
      slaDays: null
    };
  }

  if (currentStage && currentStage.sortOrder < input.selected.sortOrder) {
    return dataGap(
      "Вернулась назад",
      `После «${input.selected.stageName}» сделка вернулась на CRM-этап «${currentStage.stageName}».`
    );
  }

  if (currentStage && currentStage.sortOrder > input.selected.sortOrder) {
    return advanced({
      statusLabel: "Продвинулась дальше",
      reason: input.next
        ? `Текущий этап — «${currentStage.stageName}»; вход в «${input.next.stageName}» в истории не зафиксирован.`
        : `Текущий этап — «${currentStage.stageName}».`,
      fromAt: input.selectedAt,
      toAt: input.facts.currentStageEnteredAt
    });
  }

  return dataGap(
    "Проверить маршрут",
    `CRM-история после этапа «${input.selected.stageName}» не объясняет текущий этап «${input.facts.currentStageName}».`
  );
}

function classifyMissed(input: {
  facts: SourceCohortConversionStageDrilldownDealFacts;
  previous: SourceCohortConversionStageDrilldownStage;
  selected: SourceCohortConversionStageDrilldownStage;
  previousAt: string;
  stages: SourceCohortConversionStageDrilldownStage[];
  asOf: string;
}): StageClassification {
  const currentStage = input.stages.find(
    (stage) => stage.stageId === input.facts.currentStageId
  );
  const laterStage = firstLaterProductiveStage({
    facts: input.facts,
    selected: input.selected,
    stages: input.stages,
    after: input.previousAt
  });
  if (laterStage) {
    return advanced({
      statusLabel: "Этап пропущен",
      reason: `После «${input.previous.stageName}» сделка вошла в «${laterStage.stage.stageName}», не заходя в «${input.selected.stageName}».`,
      fromAt: input.previousAt,
      toAt: laterStage.enteredAt
    });
  }

  if (input.facts.outcome === "lost") {
    if (currentStage?.stageKind === "return") {
      return returned(
        `После «${input.previous.stageName}» сделка возвращена в лидген, не дойдя до «${input.selected.stageName}».`
      );
    }

    return lost(
      `После «${input.previous.stageName}» сделка завершена на этапе «${input.facts.currentStageName}», не дойдя до «${input.selected.stageName}».`
    );
  }

  if (input.facts.outcome === "won") {
    return advanced({
      statusLabel: "Этап пропущен",
      reason: `Сделка передана в клуб без зафиксированного входа в «${input.selected.stageName}».`,
      fromAt: input.previousAt,
      toAt: input.asOf
    });
  }

  if (input.facts.currentStageId === input.previous.stageId) {
    const ageDays = toDays(
      durationMs(input.facts.currentStageEnteredAt ?? input.previousAt, input.asOf)
    );
    return {
      status: "within_sla",
      statusLabel: "На прошлом этапе",
      reason: `Сделка остается на CRM-этапе «${input.previous.stageName}» ${formatDays(ageDays)} дн. и пока не вошла в «${input.selected.stageName}».`,
      ageFromAt: input.facts.currentStageEnteredAt ?? input.previousAt,
      ageDays,
      slaDays: null
    };
  }

  return dataGap(
    "Проверить маршрут",
    `После «${input.previous.stageName}» вход в «${input.selected.stageName}» не найден; текущий этап — «${input.facts.currentStageName}».`
  );
}

function toDealRow(input: {
  facts: SourceCohortConversionStageDrilldownDealFacts;
  previousAt: string | null;
  selectedAt: string | null;
  nextAt: string | null;
  classification: StageClassification;
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
    previousStepAt: input.previousAt,
    selectedStepAt: input.selectedAt,
    nextStepAt: input.nextAt
  };
}

function sortDeals(rows: SourceCohortConversionJourneyDealRow[]) {
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

export function buildSourceCohortConversionStageDrilldown(input: {
  range: ReportRange;
  stages: SourceCohortConversionStageDrilldownStage[];
  dealFacts: SourceCohortConversionStageDrilldownDealFacts[];
  stageId: string;
  asOf: string;
}): SourceCohortConversionJourneyDrilldown {
  const stages = [...input.stages].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.stageName.localeCompare(right.stageName, "ru")
  );
  const selected = stages.find((stage) => stage.stageId === input.stageId);
  if (!selected) {
    throw new SourceCohortConversionStageNotFoundError(input.stageId);
  }

  const productiveStages = stages.filter(
    (stage) => stage.stageKind !== "lost" && stage.stageKind !== "return"
  );
  const selectedProductiveIndex = productiveStages.findIndex(
    (stage) => stage.stageId === selected.stageId
  );
  const selectedIsTerminalRoute =
    selected.stageKind === "lost" || selected.stageKind === "return";
  const previous =
    selectedIsTerminalRoute
      ? null
      : productiveStages[selectedProductiveIndex - 1] ?? null;
  const next =
    selectedIsTerminalRoute
      ? null
      : productiveStages[selectedProductiveIndex + 1] ?? null;

  const reachedRows = sortDeals(
    input.dealFacts.flatMap((facts) => {
      const selectedAt = firstStageAt(facts, selected.stageId);
      if (!selectedAt) {
        return [];
      }
      const previousAt = previous
        ? firstStageAt(facts, previous.stageId)
        : null;
      const nextAt = next
        ? firstStageAt(facts, next.stageId, selectedAt)
        : null;

      return [
        toDealRow({
          facts,
          previousAt,
          selectedAt,
          nextAt,
          classification: classifyReached({
            facts,
            selected,
            next,
            selectedAt,
            nextAt,
            stages,
            asOf: input.asOf
          })
        })
      ];
    })
  );

  const missedRows = previous
    ? sortDeals(
        input.dealFacts.flatMap((facts) => {
          const previousAt = firstStageAt(facts, previous.stageId);
          if (
            !previousAt ||
            firstStageAt(facts, selected.stageId, previousAt)
          ) {
            return [];
          }

          return [
            toDealRow({
              facts,
              previousAt,
              selectedAt: firstStageAt(facts, selected.stageId),
              nextAt: null,
              classification: classifyMissed({
                facts,
                previous,
                selected,
                previousAt,
                stages,
                asOf: input.asOf
              })
            })
          ];
        })
      )
    : [];

  const notAdvancedRows = next
    ? sortDeals(
        input.dealFacts.flatMap((facts) => {
          const selectedAt = firstStageAt(facts, selected.stageId);
          if (
            !selectedAt ||
            firstStageAt(facts, next.stageId, selectedAt)
          ) {
            return [];
          }

          return [
            toDealRow({
              facts,
              previousAt: previous
                ? firstStageAt(facts, previous.stageId)
                : null,
              selectedAt,
              nextAt: null,
              classification: classifyReached({
                facts,
                selected,
                next,
                selectedAt,
                nextAt: null,
                stages,
                asOf: input.asOf
              })
            })
          ];
        })
      )
    : [];

  return {
    range: input.range,
    drilldownKind: "crm_stage",
    stepKey: selected.stageId,
    stepLabel: selected.stageName,
    previousStepKey: previous?.stageId ?? null,
    previousStepLabel: previous?.stageName ?? null,
    nextStepKey: next?.stageId ?? null,
    nextStepLabel: next?.stageName ?? null,
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
        label:
          selectedIsTerminalRoute
            ? "Не применяется"
            : previous
              ? `Не дошли сюда из «${previous.stageName}»`
              : "Нет предыдущего этапа",
        count: missedRows.length,
        deals: missedRows
      },
      notAdvanced: {
        viewKey: "not_advanced",
        label:
          selectedIsTerminalRoute
            ? "Не применяется"
            : next
              ? `Не дошли до «${next.stageName}»`
              : "Финальный этап",
        count: notAdvancedRows.length,
        deals: notAdvancedRows
      }
    }
  };
}
