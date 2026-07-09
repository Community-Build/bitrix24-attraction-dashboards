import type {
  SourceCohortTrajectoryBreakdownRow,
  SourceCohortTrajectoryLossShape,
  SourceCohortTrajectoryLossShapeKey
} from "@bitrix24-reporting/contracts";

const LOSS_SHAPE_META: Record<
  SourceCohortTrajectoryLossShapeKey,
  {
    label: string;
    evidence: string;
    recommendedQuestion: string;
    priority: number;
  }
> = {
  contract_without_win: {
    label: "Контракт без продажи",
    evidence: "CRM-этап контракта достигнут, но продажи нет.",
    recommendedQuestion: "Что блокирует закрытие контракта?",
    priority: 0
  },
  event_without_contract: {
    label: "Событие без контракта",
    evidence: "Посещение события есть, но этап контракта не достигнут.",
    recommendedQuestion: "Почему после события не дошли до контракта?",
    priority: 1
  },
  meeting_fact_without_next_stage: {
    label: "Факт встречи без следующего этапа",
    evidence:
      "Факт встречи есть, но следующего CRM-этапа нет. В сигнале учитывается и зависание после встречи.",
    recommendedQuestion: "Почему после встречи нет следующего шага?",
    priority: 2
  },
  meeting_stage_without_fact: {
    label: "Этап встречи без факта",
    evidence: "CRM-этап встречи достигнут, но факта проведенной встречи нет.",
    recommendedQuestion: "Почему этап встречи не подтвержден фактом?",
    priority: 3
  },
  call_without_meeting_stage: {
    label: "Звонок без этапа встречи",
    evidence: "Прямой успешный звонок есть, но этап встречи не достигнут.",
    recommendedQuestion: "Почему после дозвона не назначили встречу?",
    priority: 4
  },
  not_reached_successful_call: {
    label: "Нет успешного звонка",
    evidence: "Нет прямого успешного исходящего звонка дольше 30 секунд.",
    recommendedQuestion: "Почему не довели до успешного дозвона?",
    priority: 5
  },
  terminal_loss: {
    label: "Терминальный проигрыш",
    evidence: "Сделка находится в проигрышном исходе.",
    recommendedQuestion: "Какая причина проигрыша повторяется?",
    priority: 6
  },
  open_wip: {
    label: "Открытые сделки",
    evidence: "Сделка открыта: нет продажи и нет проигрышного исхода.",
    recommendedQuestion: "Где нужен следующий управленческий шаг?",
    priority: 7
  }
};

function toRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function buildLossShape(
  row: Pick<
    SourceCohortTrajectoryBreakdownRow,
    | "totalDeals"
    | "noSuccessfulCallDeals"
    | "successfulCallWithoutMeetingStageDeals"
    | "meetingStageWithoutFactDeals"
    | "completedMeetingWithoutNextStageDeals"
    | "staleAfterCompletedMeetingDeals"
    | "attendedEventWithoutContractDeals"
    | "contractWithoutWinDeals"
    | "lostDeals"
    | "openDeals"
  >
): SourceCohortTrajectoryLossShape {
  const reasonCounts: Array<{
    shapeKey: SourceCohortTrajectoryLossShapeKey;
    deals: number;
  }> = [
    {
      shapeKey: "not_reached_successful_call",
      deals: row.noSuccessfulCallDeals
    },
    {
      shapeKey: "call_without_meeting_stage",
      deals: row.successfulCallWithoutMeetingStageDeals
    },
    {
      shapeKey: "meeting_stage_without_fact",
      deals: row.meetingStageWithoutFactDeals
    },
    {
      shapeKey: "meeting_fact_without_next_stage",
      deals: Math.max(
        row.completedMeetingWithoutNextStageDeals,
        row.staleAfterCompletedMeetingDeals
      )
    },
    {
      shapeKey: "event_without_contract",
      deals: row.attendedEventWithoutContractDeals
    },
    {
      shapeKey: "contract_without_win",
      deals: row.contractWithoutWinDeals
    },
    {
      shapeKey: "terminal_loss",
      deals: row.lostDeals
    },
    {
      shapeKey: "open_wip",
      deals: row.openDeals
    }
  ];

  const reasons = reasonCounts
    .filter((reason) => reason.deals > 0)
    .map((reason) => {
      const meta = LOSS_SHAPE_META[reason.shapeKey];
      return {
        shapeKey: reason.shapeKey,
        label: meta.label,
        deals: reason.deals,
        rate: toRate(reason.deals, row.totalDeals),
        evidence: meta.evidence,
        recommendedQuestion: meta.recommendedQuestion
      };
    })
    .sort((left, right) => {
      if (right.deals !== left.deals) {
        return right.deals - left.deals;
      }

      return (
        LOSS_SHAPE_META[left.shapeKey].priority -
        LOSS_SHAPE_META[right.shapeKey].priority
      );
    });
  const dominant = reasons[0] ?? null;
  const dominantShapeKey = dominant?.shapeKey ?? "open_wip";
  const dominantMeta = LOSS_SHAPE_META[dominantShapeKey];

  return {
    dominantShapeKey,
    dominantShapeLabel: dominant?.label ?? dominantMeta.label,
    dominantDeals: dominant?.deals ?? 0,
    dominantRate: dominant?.rate ?? 0,
    terminalLossDeals: row.lostDeals,
    openWipDeals: row.openDeals,
    reasons
  };
}
