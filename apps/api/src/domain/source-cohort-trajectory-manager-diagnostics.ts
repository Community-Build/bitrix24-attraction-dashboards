import type {
  SourceCohortTrajectoryBreakdownRow,
  SourceCohortTrajectoryDiagnosticStatus,
  SourceCohortTrajectoryManagerDiagnostic,
  SourceCohortTrajectoryManagerRow
} from "@bitrix24-reporting/contracts";

const MANAGER_DIAGNOSTIC_MIN_SAMPLE = 10;
const MANAGER_DIAGNOSTIC_RATE_DELTA_PP = 10;
const MANAGER_DIAGNOSTIC_CALL_MEDIAN_DELTA_DAYS = 2;

function toRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function ratioPercent(numerator: number, denominator: number) {
  return denominator > 0 ? toRate(numerator, denominator) : 0;
}

function deltaValue(value: number, benchmarkValue: number | null) {
  return benchmarkValue === null
    ? null
    : Number((value - benchmarkValue).toFixed(2));
}

function diagnosticSignal(input: {
  signalKey: string;
  label: string;
  value: number;
  benchmarkValue: number | null;
  unit: string;
  severity: "positive" | "warning" | "neutral";
}): SourceCohortTrajectoryManagerDiagnostic["strengths"][number] {
  return {
    signalKey: input.signalKey,
    label: input.label,
    value: input.value,
    benchmarkValue: input.benchmarkValue,
    delta: deltaValue(input.value, input.benchmarkValue),
    unit: input.unit,
    severity: input.severity
  };
}

function firstManagerFocus(signalKey: string | undefined) {
  if (signalKey === "slow_first_successful_call") {
    return "Проверить дозвон: мало успешных звонков или они поздние.";
  }

  if (signalKey === "meeting_stage_without_fact") {
    return "Проверить назначение встреч: этап встречи есть, факта встречи нет.";
  }

  if (signalKey === "after_meeting_stall") {
    return "Проверить следующий шаг после встречи: факт есть, движения дальше нет.";
  }

  if (signalKey === "contract_bottleneck") {
    return "Проверить контрактный блок: дошли до контракта, но не закрылись.";
  }

  return "Проверить объем выборки, сроки и следующие действия.";
}

function managerHeadlineSignalLabel(label: string) {
  if (label === "Дозвон позже нормы") {
    return "дозвон позже нормы";
  }

  if (label.startsWith("CRM-")) {
    return label;
  }

  return label.toLocaleLowerCase("ru");
}

export function buildManagerDiagnostics(input: {
  managerRows: SourceCohortTrajectoryManagerRow[];
  overallRow: SourceCohortTrajectoryBreakdownRow;
}): SourceCohortTrajectoryManagerDiagnostic[] {
  const cohort = input.overallRow;
  const cohortSlowCallRate = ratioPercent(
    cohort.slowFirstSuccessfulCallDeals,
    cohort.totalDeals
  );
  const cohortMeetingStageWithoutFactRate = ratioPercent(
    cohort.meetingStageWithoutFactDeals,
    cohort.meetingStageDeals
  );
  const cohortAfterMeetingStallRate = Math.max(
    ratioPercent(
      cohort.completedMeetingWithoutNextStageDeals,
      cohort.completedMeetingDeals
    ),
    ratioPercent(cohort.staleAfterCompletedMeetingDeals, cohort.completedMeetingDeals)
  );
  const cohortContractBottleneckRate = Math.max(
    ratioPercent(cohort.contractWithoutWinDeals, cohort.contractStageDeals),
    ratioPercent(cohort.staleOpenContractStageDeals, cohort.contractStageDeals)
  );

  const rows = input.managerRows.map((row) => {
    const strengths: SourceCohortTrajectoryManagerDiagnostic["strengths"] = [];
    const bottlenecks: SourceCohortTrajectoryManagerDiagnostic["bottlenecks"] = [];
    const sampleWarning =
      row.totalDeals < MANAGER_DIAGNOSTIC_MIN_SAMPLE
        ? `N=${row.totalDeals}. Строка только для описания, не для рейтинга.`
        : null;

    if (sampleWarning) {
      return {
        managerId: row.managerId,
        managerName: row.managerName,
        totalDeals: row.totalDeals,
        status: "low_sample" as const,
        headline: `${row.managerName}: маленькая выборка, выводы только описательные.`,
        strengths,
        bottlenecks,
        recommendedFocus: "Смотреть факты по сделкам, но не сравнивать менеджера в рейтинге.",
        sampleWarning
      };
    }

    const callMedianOk =
      row.medianDaysToFirstSuccessfulCall !== null &&
      cohort.medianDaysToFirstSuccessfulCall !== null &&
      row.medianDaysToFirstSuccessfulCall <= cohort.medianDaysToFirstSuccessfulCall;
    if (
      row.firstSuccessfulCallRate >=
        cohort.firstSuccessfulCallRate + MANAGER_DIAGNOSTIC_RATE_DELTA_PP &&
      callMedianOk
    ) {
      strengths.push(
        diagnosticSignal({
          signalKey: "strong_first_successful_call",
          label: "Сильный дозвон",
          value: row.firstSuccessfulCallRate,
          benchmarkValue: cohort.firstSuccessfulCallRate,
          unit: "%",
          severity: "positive"
        })
      );
    }

    const slowCallRate = ratioPercent(
      row.slowFirstSuccessfulCallDeals,
      row.totalDeals
    );
    const slowCallByRate =
      row.slowFirstSuccessfulCallDeals > 0 &&
      slowCallRate >= cohortSlowCallRate + MANAGER_DIAGNOSTIC_RATE_DELTA_PP;
    const slowCallByMedian =
      row.medianDaysToFirstSuccessfulCall !== null &&
      cohort.medianDaysToFirstSuccessfulCall !== null &&
      row.medianDaysToFirstSuccessfulCall >=
        cohort.medianDaysToFirstSuccessfulCall +
          MANAGER_DIAGNOSTIC_CALL_MEDIAN_DELTA_DAYS;
    if (slowCallByRate || slowCallByMedian) {
      bottlenecks.push(
        diagnosticSignal({
          signalKey: "slow_first_successful_call",
          label: slowCallByMedian ? "Медленный дозвон" : "Дозвон позже нормы",
          value: slowCallByMedian
            ? row.medianDaysToFirstSuccessfulCall ?? 0
            : slowCallRate,
          benchmarkValue: slowCallByMedian
            ? cohort.medianDaysToFirstSuccessfulCall
            : cohortSlowCallRate,
          unit: slowCallByMedian ? "дн." : "%",
          severity: "warning"
        })
      );
    }

    const meetingStageWithoutFactRate = ratioPercent(
      row.meetingStageWithoutFactDeals,
      row.meetingStageDeals
    );
    if (
      row.meetingStageWithoutFactDeals >= 3 &&
      meetingStageWithoutFactRate >=
        cohortMeetingStageWithoutFactRate + MANAGER_DIAGNOSTIC_RATE_DELTA_PP
    ) {
      bottlenecks.push(
        diagnosticSignal({
          signalKey: "meeting_stage_without_fact",
          label: "CRM-встреча без факта",
          value: meetingStageWithoutFactRate,
          benchmarkValue: cohortMeetingStageWithoutFactRate,
          unit: "%",
          severity: "warning"
        })
      );
    }

    const afterMeetingStallCount = Math.max(
      row.completedMeetingWithoutNextStageDeals,
      row.staleAfterCompletedMeetingDeals
    );
    const afterMeetingStallRate = Math.max(
      ratioPercent(
        row.completedMeetingWithoutNextStageDeals,
        row.completedMeetingDeals
      ),
      ratioPercent(row.staleAfterCompletedMeetingDeals, row.completedMeetingDeals)
    );
    if (
      afterMeetingStallCount >= 3 &&
      afterMeetingStallRate >=
        cohortAfterMeetingStallRate + MANAGER_DIAGNOSTIC_RATE_DELTA_PP
    ) {
      bottlenecks.push(
        diagnosticSignal({
          signalKey: "after_meeting_stall",
          label: "После встречи нет движения",
          value: afterMeetingStallRate,
          benchmarkValue: cohortAfterMeetingStallRate,
          unit: "%",
          severity: "warning"
        })
      );
    }

    const contractBottleneckCount = Math.max(
      row.contractWithoutWinDeals,
      row.staleOpenContractStageDeals
    );
    const contractBottleneckRate = Math.max(
      ratioPercent(row.contractWithoutWinDeals, row.contractStageDeals),
      ratioPercent(row.staleOpenContractStageDeals, row.contractStageDeals)
    );
    if (
      contractBottleneckCount >= 2 &&
      contractBottleneckRate >=
        cohortContractBottleneckRate + MANAGER_DIAGNOSTIC_RATE_DELTA_PP
    ) {
      bottlenecks.push(
        diagnosticSignal({
          signalKey: "contract_bottleneck",
          label: "Контрактный блок",
          value: contractBottleneckRate,
          benchmarkValue: cohortContractBottleneckRate,
          unit: "%",
          severity: "warning"
        })
      );
    }

    const status: SourceCohortTrajectoryDiagnosticStatus =
      strengths.length > 0 && bottlenecks.length > 0
        ? "mixed"
        : bottlenecks.length > 0
          ? "bottleneck"
          : strengths.length > 0
            ? "strength"
            : "mixed";
    const headline =
      status === "bottleneck"
        ? `${row.managerName}: главное узкое место: ${managerHeadlineSignalLabel(bottlenecks[0]?.label ?? "узкое место")}.`
        : status === "strength"
          ? `${row.managerName}: сильный участок без явных узких мест.`
          : strengths.length > 0 && bottlenecks.length > 0
            ? `${row.managerName}: есть сильная сторона и узкое место.`
            : `${row.managerName}: явного отклонения от когорты не видно.`;

    return {
      managerId: row.managerId,
      managerName: row.managerName,
      totalDeals: row.totalDeals,
      status,
      headline,
      strengths,
      bottlenecks,
      recommendedFocus:
        bottlenecks.length > 0
          ? firstManagerFocus(bottlenecks[0]?.signalKey)
          : strengths.length > 0
            ? "Сохранить практику менеджера и сравнить с командами с похожей когортой."
            : "Проверить объем выборки, сроки и следующие действия.",
      sampleWarning: null
    };
  });

  const statusRank: Record<SourceCohortTrajectoryManagerDiagnostic["status"], number> = {
    bottleneck: 0,
    mixed: 1,
    strength: 2,
    low_sample: 3
  };

  return rows.sort((left, right) => {
    const byStatus = statusRank[left.status] - statusRank[right.status];
    if (byStatus !== 0) {
      return byStatus;
    }

    const byBottlenecks = right.bottlenecks.length - left.bottlenecks.length;
    if (byBottlenecks !== 0) {
      return byBottlenecks;
    }

    return right.totalDeals - left.totalDeals;
  });
}
