import type {
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  DashboardQuery,
  ReportRange,
  TocFlowReport,
  TocFlowReportSnapshot,
} from '@/lib/dashboard-types'
import type {
  ActivitiesCallsSceneData,
  ActivityMatrixRow,
  ActivitySummaryRow,
  CohortBreakdownRow,
  CohortDistributionRow,
  CohortSceneData,
  CohortMatrixRow,
  FlowStageMetric,
  ProtoFilterState,
  ProtoKpi,
  TocManagerConversionRow,
  TocFlowSceneData,
  TocStableLeaderRow,
  TocStageDistribution,
} from '@/proto/types'

type ManagerCohortBreakdown = {
  key: string
  label: string
  report: Pick<
    CohortConversionReportSnapshot,
    'totalCreatedDeals' | 'totalClosedDeals' | 'totalWonDeals' | 'rows'
  >
}

type SourceCohortBreakdown = ManagerCohortBreakdown

type ManagerTocBreakdown = {
  key: string
  label: string
  report: Pick<TocFlowReport, 'rows' | 'comparisons'>
}

const STABLE_LEADER_RATE_THRESHOLD = 0.85
const MOSCOW_TIMEZONE_OFFSET = '+03:00'

const cohortBucketOrder = ['month_1', 'month_2', 'month_3', 'month_4_plus'] as const

const cohortBucketLabels = new Map<
  (typeof cohortBucketOrder)[number],
  string
>([
  ['month_1', 'В 1 месяц'],
  ['month_2', 'Во 2 месяц'],
  ['month_3', 'В 3 месяц'],
  ['month_4_plus', 'В 4+ месяц'],
])

function toMoscowRangeBoundary(date: string, boundary: 'start' | 'end') {
  return boundary === 'start'
    ? `${date}T00:00:00.000${MOSCOW_TIMEZONE_OFFSET}`
    : `${date}T23:59:59.999${MOSCOW_TIMEZONE_OFFSET}`
}

function formatSignedValue(value: number, suffix = '') {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix}`
  }

  const rounded = Math.round(value * 10) / 10
  const normalized = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1)

  return `${rounded > 0 ? '+' : ''}${normalized}${suffix}`
}

function formatSignedInteger(value: number, suffix = '') {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix}`
  }

  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return '0.0'
  }

  return (Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1)
}

function formatPercentDisplay(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%'
  }

  if (value < 1) {
    return '<1%'
  }

  return `${Math.floor(value)}%`
}

function formatPercentDelta(current: number, compare: number) {
  if (!Number.isFinite(compare) || compare === 0) {
    if (current === 0) {
      return '0%'
    }

    return '—'
  }

  const delta = ((current - compare) / compare) * 100
  return `${formatSignedInteger(delta)}%`
}

function normalizeKpiTone(
  delta: string,
  positiveIsGood: boolean,
): ProtoKpi['deltaTone'] {
  if (
    !delta ||
    delta === '—' ||
    delta === '0' ||
    delta === '0%' ||
    delta === '0 п.п.' ||
    delta === '0 дн.'
  ) {
    return 'neutral'
  }

  const isPositive = delta.startsWith('+')
  if (positiveIsGood) {
    return isPositive ? 'positive' : 'negative'
  }

  return isPositive ? 'negative' : 'positive'
}

function buildKpi(input: {
  label: string
  value: string
  note: string
  compare?: string | undefined
  delta?: string | undefined
  deltaTone?: ProtoKpi['deltaTone'] | undefined
}): ProtoKpi {
  const kpi: ProtoKpi = {
    label: input.label,
    value: input.value,
    note: input.note,
  }

  if (input.compare !== undefined) {
    kpi.compare = input.compare
  }

  if (input.delta !== undefined) {
    kpi.delta = input.delta
  }

  if (input.deltaTone !== undefined) {
    kpi.deltaTone = input.deltaTone
  }

  return kpi
}

function formatCompareValue(prefix: string, value: string) {
  return `${prefix}: ${value}`
}

function formatOptionalCompareValue(
  prefix: string,
  value: number | null | undefined,
  formatter: (input: number) => string,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return formatCompareValue(prefix, formatter(value))
}

function getFirstComparison<TSnapshot extends { range: ReportRange }>(
  report: { comparisons?: Array<{ snapshot: TSnapshot }> },
) {
  return report.comparisons?.[0]?.snapshot ?? null
}

function getStageOrder(
  activities: ActivitiesWorkloadReport,
  calls: CallsWorkloadReport,
) {
  const seen = new Set<string>()
  const order: string[] = []

  for (const row of activities.managerRows) {
    for (const stage of row.stageBreakdown) {
      if (!seen.has(stage.stageName)) {
        seen.add(stage.stageName)
        order.push(stage.stageName)
      }
    }
  }

  for (const row of calls.managerRows) {
    for (const stage of row.stageBreakdown) {
      if (!seen.has(stage.stageName)) {
        seen.add(stage.stageName)
        order.push(stage.stageName)
      }
    }
  }

  return order
}

function createActivityLevel(
  currentCallsPerDeal: number,
  currentClosedPerDeal: number,
  maxCallsPerDeal: number,
  maxClosedPerDeal: number,
) {
  const callsRatio = maxCallsPerDeal > 0 ? currentCallsPerDeal / maxCallsPerDeal : 0
  const closedRatio =
    maxClosedPerDeal > 0 ? currentClosedPerDeal / maxClosedPerDeal : 0
  const ratio = Math.max(callsRatio, closedRatio)

  return Math.max(1, Math.min(5, Math.ceil(ratio * 5)))
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .replace(/\s*г\.$/, '')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function getRelativeClosureBucket(
  row: Pick<CohortConversionReportSnapshot['rows'][number], 'relativeClosureBuckets'>,
  bucketKey: (typeof cohortBucketOrder)[number],
) {
  return (
    row.relativeClosureBuckets.find((bucket) => bucket.bucketKey === bucketKey) ?? {
      bucketKey,
      label: cohortBucketLabels.get(bucketKey) ?? bucketKey,
      closedDeals: 0,
      wonDeals: 0,
      closedRate: 0,
      wonConversionRate: 0,
    }
  )
}

function createHeatLevel(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return 1
  }

  return Math.max(1, Math.min(5, Math.ceil((value / maxValue) * 5)))
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function averageCohortRowRate(
  rows: CohortConversionReportSnapshot['rows'],
  getRate: (row: CohortConversionReportSnapshot['rows'][number]) => number,
) {
  return average(rows.map((row) => getRate(row)).filter(Number.isFinite))
}

function averageRelativeBucketRate(
  rows: CohortConversionReportSnapshot['rows'],
  bucketKey: (typeof cohortBucketOrder)[number],
) {
  return averageCohortRowRate(rows, (row) =>
    getRelativeClosureBucket(row, bucketKey).wonConversionRate,
  )
}

function recentCohortRows(
  rows: CohortConversionReportSnapshot['rows'],
  limit: number,
) {
  return [...rows]
    .filter((row) => Number.isFinite(row.wonConversionRate))
    .sort((left, right) => left.createdMonth.localeCompare(right.createdMonth))
    .slice(-limit)
}

function weightedAverageCohortCycleDays(rows: CohortConversionReportSnapshot['rows']) {
  const totals = rows.reduce(
    (accumulator, row) => {
      if (row.wonDeals <= 0 || row.averageDaysToWin <= 0) {
        return accumulator
      }

      return {
        weightedDays: accumulator.weightedDays + row.averageDaysToWin * row.wonDeals,
        wonDeals: accumulator.wonDeals + row.wonDeals,
      }
    },
    { weightedDays: 0, wonDeals: 0 },
  )

  return totals.wonDeals > 0 ? totals.weightedDays / totals.wonDeals : 0
}

function widthFromPercent(value: number) {
  return Math.max(12, Math.min(100, Math.round(value * 3.2)))
}

function formatSignedTenthsTrunc(value: number, suffix = '') {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix}`
  }

  const truncated = Math.trunc(value * 10) / 10
  const normalized = Number.isInteger(truncated)
    ? String(truncated)
    : truncated.toFixed(1)

  return `${truncated > 0 ? '+' : ''}${normalized}${suffix}`
}

function mapDistributionRow(
  label: string,
  report: Pick<CohortConversionReportSnapshot, 'totalCreatedDeals' | 'rows'>,
): CohortDistributionRow {
  const month1 = averageRelativeBucketRate(report.rows, 'month_1')
  const month2 = averageRelativeBucketRate(report.rows, 'month_2')
  const month3 = averageRelativeBucketRate(report.rows, 'month_3')
  const tail = averageRelativeBucketRate(report.rows, 'month_4_plus')

  return {
    manager: label,
    month1: formatPercentDisplay(month1),
    month2: formatPercentDisplay(month2),
    month3: formatPercentDisplay(month3),
    tail: formatPercentDisplay(tail),
    width: widthFromPercent(Math.max(month1, month2, month3, tail)),
  }
}

function mapSourceDistributionFromBreakdownRows(
  rows: CohortConversionReportSnapshot['breakdownRows'],
): CohortDistributionRow[] {
  const sourceRows = rows.filter((row) => row.level === 'source' && row.createdDeals > 0)
  const aggregates = new Map<
    string,
    {
      label: string
      createdDeals: number
      buckets: Map<(typeof cohortBucketOrder)[number], number>
    }
  >()

  for (const row of sourceRows) {
    const key = row.sourceKey ?? row.id
    const current = aggregates.get(key) ?? {
      label: row.sourceLabel ?? 'Без источника',
      createdDeals: 0,
      buckets: new Map(cohortBucketOrder.map((bucketKey) => [bucketKey, 0])),
    }

    current.createdDeals += row.createdDeals
    for (const bucketKey of cohortBucketOrder) {
      current.buckets.set(
        bucketKey,
        (current.buckets.get(bucketKey) ?? 0) +
          getRelativeClosureBucket(row, bucketKey).wonDeals,
      )
    }
    aggregates.set(key, current)
  }

  return Array.from(aggregates.values())
    .sort((left, right) => {
      if (right.createdDeals !== left.createdDeals) {
        return right.createdDeals - left.createdDeals
      }

      return left.label.localeCompare(right.label, 'ru')
    })
    .map((row) => {
      const month1 = row.createdDeals > 0
        ? ((row.buckets.get('month_1') ?? 0) / row.createdDeals) * 100
        : 0
      const month2 = row.createdDeals > 0
        ? ((row.buckets.get('month_2') ?? 0) / row.createdDeals) * 100
        : 0
      const month3 = row.createdDeals > 0
        ? ((row.buckets.get('month_3') ?? 0) / row.createdDeals) * 100
        : 0
      const tail = row.createdDeals > 0
        ? ((row.buckets.get('month_4_plus') ?? 0) / row.createdDeals) * 100
        : 0

      return {
        manager: row.label,
        month1: formatPercentDisplay(month1),
        month2: formatPercentDisplay(month2),
        month3: formatPercentDisplay(month3),
        tail: formatPercentDisplay(tail),
        width: widthFromPercent(Math.max(month1, month2, month3, tail)),
      }
    })
}

function mapCohortBreakdownRows(
  rows: CohortConversionReportSnapshot['breakdownRows'],
): CohortBreakdownRow[] {
  const rowsBase = rows.map((row) => {
    const matrixBuckets = cohortBucketOrder.map((bucketKey) =>
      getRelativeClosureBucket(row, bucketKey),
    )
    const rawValues = matrixBuckets.map((bucket) => bucket.wonDeals)

    return {
      id: row.id,
      parentId: row.parentId,
      level: row.level,
      label: row.level === 'cohort'
        ? monthLabel(row.cohortMonth ?? row.cohortLabel ?? row.id)
        : row.customerLabel ?? row.qualityLabel ?? row.sourceLabel ?? 'Без значения',
      createdDeals: formatCount(row.createdDeals),
      rawValues,
      cells: matrixBuckets.map((bucket) => ({
        value: formatCount(bucket.wonDeals),
        subvalue: formatPercentDisplay(bucket.wonConversionRate),
        level: 1,
      })),
      conversion: formatPercentDisplay(row.wonConversionRate),
      cycle:
        row.wonDeals > 0 && row.averageDaysToWin > 0
          ? `${Math.round(row.averageDaysToWin)} дн.`
          : '—',
    }
  })
  const maxMatrixValue = Math.max(0, ...rowsBase.flatMap((row) => row.rawValues))

  return rowsBase.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    level: row.level,
    label: row.label,
    createdDeals: row.createdDeals,
    conversion: row.conversion,
    cycle: row.cycle,
    cells: row.cells.map((cell, index) => ({
      ...cell,
      level: createHeatLevel(row.rawValues[index] ?? 0, maxMatrixValue),
    })),
  }))
}

function sortBreakdowns<T extends { label: string; report: { totalCreatedDeals: number } }>(
  rows: T[],
) {
  return [...rows]
    .filter((row) => row.report.totalCreatedDeals > 0)
    .sort((left, right) => right.report.totalCreatedDeals - left.report.totalCreatedDeals)
}

type TocStageRow = TocFlowReportSnapshot['rows'][number]

function isTerminalTocStage(row: Pick<TocStageRow, 'stageName' | 'stageSemanticId'>) {
  if (row.stageSemanticId === 'S' || row.stageSemanticId === 'F') {
    return true
  }

  return /передано\s+в\s+клуб|корзин|возврат\s+в\s+лидген/i.test(row.stageName)
}

function sortActiveTocRows(rows: TocStageRow[]) {
  return rows
    .filter((row) => !isTerminalTocStage(row))
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

function resolveTocBottleneckRow(
  rows: TocStageRow[],
  preferred: Pick<TocStageRow, 'stageId'> | null | undefined,
) {
  const preferredRow = preferred
    ? rows.find((row) => row.stageId === preferred.stageId) ?? null
    : null

  if (preferredRow) {
    return preferredRow
  }

  if (rows.length === 0) {
    return null
  }

  return rows.reduce((best, row) => {
    if (row.throughputPerDay !== best.throughputPerDay) {
      return row.throughputPerDay < best.throughputPerDay ? row : best
    }

    return row.queueEnd > best.queueEnd ? row : best
  })
}

function resolveDisplayCallSummary(
  callRow: CallsWorkloadReportSnapshot['managerRows'][number] | null,
) {
  return callRow?.callAttributionPolicy === 'direct_only'
    ? (callRow.linkedDealCalls ?? null)
    : callRow
}

function formatActivitySummaryValues(
  activityRow: ActivitiesWorkloadReportSnapshot['managerRows'][number] | null,
  callRow: CallsWorkloadReportSnapshot['managerRows'][number] | null,
) {
  const callSummary = resolveDisplayCallSummary(callRow)
  const rawValues = [
    activityRow?.createdCount ?? 0,
    activityRow?.closedCount ?? 0,
    callSummary?.outgoingCalls ?? 0,
    callSummary?.connectedCallsOverThirtySeconds ?? 0,
    callSummary?.otherOutgoingCalls ?? 0,
    callSummary?.failedCalls ?? 0,
    callSummary?.missedIncomingCalls ?? 0,
    callSummary?.incomingCalls ?? 0,
  ]

  return {
    rawValues,
    values: rawValues.map(formatCount),
  }
}

function conversionLevel(rate: number) {
  if (rate >= 70) {
    return 4
  }

  if (rate >= 50) {
    return 3
  }

  if (rate >= 25) {
    return 2
  }

  return rate > 0 ? 1 : 0
}

function mapTocManagerConversionRow(entry: ManagerTocBreakdown): TocManagerConversionRow & { averageRate: number } {
  const rows = sortActiveTocRows(entry.report.rows)
  const totalEntered = rows.reduce((total, row) => total + row.enteredDeals, 0)
  const totalMovedNext = rows.reduce((total, row) => total + row.movedNextDeals, 0)
  const averageRate = totalEntered > 0 ? (totalMovedNext / totalEntered) * 100 : 0

  return {
    manager: entry.label,
    averageConversion: formatPercentDisplay(averageRate),
    averageRate,
    stages: rows.map((row) => {
      const rate = row.enteredDeals > 0 ? (row.movedNextDeals / row.enteredDeals) * 100 : 0

      return {
        stage: row.stageName,
        conversion: formatPercentDisplay(rate),
        volume: `${formatCount(row.movedNextDeals)} / ${formatCount(row.enteredDeals)}`,
        level: conversionLevel(rate),
      }
    }),
  }
}

function buildStableLeaderRows(managerBreakdowns: ManagerTocBreakdown[]): TocStableLeaderRow[] {
  const stageIds = Array.from(
    new Set(
      managerBreakdowns.flatMap((entry) =>
        entry.report.rows
          .filter((row) => !isTerminalTocStage(row))
          .map((row) => row.stageId),
      ),
    ),
  )

  return stageIds
    .map((stageId) => {
      const currentEntries = managerBreakdowns
        .map((entry) => {
          const row = entry.report.rows.find(
            (item) => item.stageId === stageId && !isTerminalTocStage(item),
          )
          if (!row || row.enteredDeals === 0) {
            return null
          }

          return {
            key: entry.key,
            manager: entry.label,
            stage: row.stageName,
            conversionRate: row.enteredDeals > 0 ? row.movedNextDeals / row.enteredDeals : 0,
            movedNextDeals: row.movedNextDeals,
            enteredDeals: row.enteredDeals,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((left, right) => {
          if (right.conversionRate !== left.conversionRate) {
            return right.conversionRate - left.conversionRate
          }

          if (right.enteredDeals !== left.enteredDeals) {
            return right.enteredDeals - left.enteredDeals
          }

          return left.manager.localeCompare(right.manager, 'ru-RU')
        })

      const leader = currentEntries[0]
      if (!leader) {
        return null
      }

      const compareEntries = managerBreakdowns
        .map((entry) => {
          const row = entry.report.comparisons?.[0]?.snapshot.rows.find(
            (item) => item.stageId === stageId && !isTerminalTocStage(item),
          )
          if (!row || row.enteredDeals === 0) {
            return null
          }

          return {
            key: entry.key,
            conversionRate: row.enteredDeals > 0 ? row.movedNextDeals / row.enteredDeals : 0,
            movedNextDeals: row.movedNextDeals,
            enteredDeals: row.enteredDeals,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((left, right) => {
          if (right.conversionRate !== left.conversionRate) {
            return right.conversionRate - left.conversionRate
          }

          if (right.enteredDeals !== left.enteredDeals) {
            return right.enteredDeals - left.enteredDeals
          }

          return left.key.localeCompare(right.key)
        })

      const compareEntry = compareEntries.find((entry) => entry.key === leader.key) ?? null
      const compareRank = compareEntry ? compareEntries.indexOf(compareEntry) : -1
      const isStable =
        compareEntry !== null &&
        compareRank <= 1 &&
        (compareEntry.conversionRate === 0
          ? leader.conversionRate === 0
          : leader.conversionRate >= compareEntry.conversionRate * STABLE_LEADER_RATE_THRESHOLD)
      const stabilityTone: TocStableLeaderRow['stabilityTone'] =
        compareEntries.length === 0
          ? 'neutral'
          : isStable
            ? 'positive'
            : compareEntry
              ? 'negative'
              : 'neutral'

      return {
        stage: leader.stage,
        manager: leader.manager,
        conversion: formatPercentDisplay(leader.conversionRate * 100),
        volume: `${formatCount(leader.movedNextDeals)} / ${formatCount(leader.enteredDeals)}`,
        compareConversion:
          compareEntry !== null
            ? formatPercentDisplay(compareEntry.conversionRate * 100)
            : '—',
        compareVolume:
          compareEntry !== null
            ? `${formatCount(compareEntry.movedNextDeals)} / ${formatCount(compareEntry.enteredDeals)}`
            : '—',
        stabilityLabel:
          compareEntries.length === 0
            ? 'Без сравнения'
            : isStable
              ? 'Устойчив'
              : compareEntry
                ? 'Нужно проверить'
                : 'Новый лидер',
        stabilityTone,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
}

export function buildDashboardQueryFromProtoFilters(
  filters: ProtoFilterState,
): DashboardQuery {
  return {
    preset: 'custom',
    from: toMoscowRangeBoundary(filters.rangeStart, 'start'),
    to: toMoscowRangeBoundary(filters.rangeEnd, 'end'),
    managerIds: filters.managers,
    sourceKeys: filters.sources,
    businessClubKeys: filters.businessClubs,
    targetGroupKeys: filters.targetGroups,
    compareRanges: filters.compareRanges.map((range) => ({
      from: toMoscowRangeBoundary(range.start, 'start'),
      to: toMoscowRangeBoundary(range.end, 'end'),
    })),
  }
}

export function mapActivitiesCallsSceneData(input: {
  activities: ActivitiesWorkloadReport
  calls: CallsWorkloadReport
}): ActivitiesCallsSceneData {
  const { activities, calls } = input
  const compareActivities = getFirstComparison<ActivitiesWorkloadReportSnapshot>(activities)
  const compareCalls = getFirstComparison<CallsWorkloadReportSnapshot>(calls)

  const managerNames = new Set<string>()
  for (const row of activities.managerRows) {
    managerNames.add(row.managerName)
  }
  for (const row of calls.managerRows) {
    managerNames.add(row.managerName)
  }

  const orderedManagers = Array.from(managerNames).sort((left, right) =>
    left.localeCompare(right, 'ru-RU'),
  )
  const stageOrder = getStageOrder(activities, calls)

  const maxCallsPerDeal = Math.max(
    0,
    ...calls.managerRows.flatMap((row) =>
      row.stageBreakdown.map((stage) => stage.averageCallsPerDeal),
    ),
  )
  const maxClosedPerDeal = Math.max(
    0,
    ...activities.managerRows.flatMap((row) =>
      row.stageBreakdown.map((stage) => stage.averageClosedPerDeal),
    ),
  )

  const summaryRows: ActivitySummaryRow[] = orderedManagers.map((managerName) => {
    const activityRow =
      activities.managerRows.find((row) => row.managerName === managerName) ?? null
    const callRow = calls.managerRows.find((row) => row.managerName === managerName) ?? null
    const currentSummary = formatActivitySummaryValues(activityRow, callRow)
    const comparePoints = Array.from(
      {
        length: Math.max(
          activities.comparisons?.length ?? 0,
          calls.comparisons?.length ?? 0,
        ),
      },
      (_item, index) => {
        const compareActivityRow =
          activities.comparisons?.[index]?.snapshot.managerRows.find(
            (row) => row.managerName === managerName,
          ) ?? null
        const compareCallRow =
          calls.comparisons?.[index]?.snapshot.managerRows.find(
            (row) => row.managerName === managerName,
          ) ?? null
        const compareSummary = formatActivitySummaryValues(compareActivityRow, compareCallRow)

        return {
          label: `С${index + 1}`,
          values: compareSummary.values,
          deltas: currentSummary.rawValues.map((value, metricIndex) =>
            formatPercentDelta(value, compareSummary.rawValues[metricIndex] ?? 0),
          ),
        }
      },
    )
    const firstCompareDeltas =
      comparePoints[0]?.deltas ??
      currentSummary.rawValues.map((value) => formatPercentDelta(value, 0))

    return {
      manager: managerName,
      sortValues: currentSummary.rawValues,
      createdTasks: currentSummary.values[0]!,
      closedTasks: currentSummary.values[1]!,
      outgoing: currentSummary.values[2]!,
      successfulCalls: currentSummary.values[3]!,
      otherOutgoing: currentSummary.values[4]!,
      noAnswer: currentSummary.values[5]!,
      missedIncoming: currentSummary.values[6]!,
      incoming: currentSummary.values[7]!,
      ...(callRow?.callsHourlyHeatmap
        ? { callsHourlyHeatmap: callRow.callsHourlyHeatmap }
        : {}),
      ...(activityRow?.tasksHourlyHeatmap
        ? { tasksHourlyHeatmap: activityRow.tasksHourlyHeatmap }
        : {}),
      ...(activityRow?.createdTasksHourlyHeatmap
        ? { createdTasksHourlyHeatmap: activityRow.createdTasksHourlyHeatmap }
        : {}),
      ...(activityRow?.closedTasksHourlyHeatmap
        ? { closedTasksHourlyHeatmap: activityRow.closedTasksHourlyHeatmap }
        : {}),
      deltas: firstCompareDeltas,
      comparePoints,
    }
  })

  const matrixRows: ActivityMatrixRow[] = orderedManagers.map((managerName) => {
    const activityRow =
      activities.managerRows.find((row) => row.managerName === managerName) ?? null
    const callRow = calls.managerRows.find((row) => row.managerName === managerName) ?? null
    const compareActivityRow =
      compareActivities?.managerRows.find((row) => row.managerName === managerName) ?? null
    const compareCallRow =
      compareCalls?.managerRows.find((row) => row.managerName === managerName) ?? null
    const displayCallSummary = resolveDisplayCallSummary(callRow)

    return {
      manager: managerName,
      totalCalls: formatCount(displayCallSummary?.totalCalls ?? 0),
      avgCalls: formatDecimal(callRow?.averageCallsPerDeal ?? 0),
      totalClosedTasks: formatCount(activityRow?.closedCount ?? 0),
      avgClosedTasks: formatDecimal(activityRow?.averageClosedPerDeal ?? 0),
      avgCallsDelta: formatPercentDelta(
        callRow?.averageCallsPerDeal ?? 0,
        compareCallRow?.averageCallsPerDeal ?? 0,
      ),
      avgClosedTasksDelta: formatPercentDelta(
        activityRow?.averageClosedPerDeal ?? 0,
        compareActivityRow?.averageClosedPerDeal ?? 0,
      ),
      stages: stageOrder.map((stageName) => {
        const activityStage =
          activityRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ?? null
        const callStage =
          callRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ?? null
        const compareActivityStage =
          compareActivityRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ??
          null
        const compareCallStage =
          compareCallRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ?? null

        const currentCallsPerDeal = callStage?.averageCallsPerDeal ?? 0
        const currentClosedPerDeal = activityStage?.averageClosedPerDeal ?? 0

        return {
          label: stageName,
          totalCalls: formatCount(callStage?.totalCalls ?? 0),
          callsPerDeal: formatDecimal(currentCallsPerDeal),
          totalClosedTasks: formatCount(activityStage?.closedCount ?? 0),
          closedTasksAvg: formatDecimal(currentClosedPerDeal),
          level: createActivityLevel(
            currentCallsPerDeal,
            currentClosedPerDeal,
            maxCallsPerDeal,
            maxClosedPerDeal,
          ),
          callsDelta: formatPercentDelta(
            currentCallsPerDeal,
            compareCallStage?.averageCallsPerDeal ?? 0,
          ),
          closedTasksDelta: formatPercentDelta(
            currentClosedPerDeal,
            compareActivityStage?.averageClosedPerDeal ?? 0,
          ),
        }
      }),
    }
  })

  const callsPerDealCallCount = calls.linkedDealCalls?.totalCalls ?? calls.totalCalls
  const callsPerDealDealCount =
    calls.linkedDealCalls?.totalDealCount ?? calls.totalDealCount
  const compareCallsPerDealCallCount =
    compareCalls?.linkedDealCalls?.totalCalls ?? compareCalls?.totalCalls ?? 0
  const compareCallsPerDealDealCount =
    compareCalls?.linkedDealCalls?.totalDealCount ?? compareCalls?.totalDealCount ?? 0
  const hasCallsPerDealBase = callsPerDealDealCount > 0
  const totalCallsPerDeal =
    hasCallsPerDealBase ? callsPerDealCallCount / callsPerDealDealCount : 0
  const compareCallsPerDeal =
    compareCalls && compareCallsPerDealDealCount > 0
      ? compareCallsPerDealCallCount / compareCallsPerDealDealCount
      : null
  const totalTasksPerDeal =
    activities.totalDealCount > 0
      ? activities.totalCreatedCount / activities.totalDealCount
      : 0
  const compareTasksPerDeal =
    compareActivities && compareActivities.totalDealCount > 0
      ? compareActivities.totalCreatedCount / compareActivities.totalDealCount
      : null

  const createdDelta = formatPercentDelta(
    activities.totalCreatedCount,
    compareActivities?.totalCreatedCount ?? 0,
  )
  const closedDelta = formatPercentDelta(
    activities.totalClosedCount,
    compareActivities?.totalClosedCount ?? 0,
  )
  const callsPerDealDelta = hasCallsPerDealBase
    ? compareCallsPerDeal === null
      ? '—'
      : formatPercentDelta(totalCallsPerDeal, compareCallsPerDeal)
    : calls.totalCalls > 0
      ? 'нет привязки'
      : 'нет базы'
  const excludedByPolicyCalls = calls.linkedDealCalls?.excludedByPolicyCalls?.totalCalls ?? 0
  const callsPerDealNote = (() => {
    if (hasCallsPerDealBase) {
      return excludedByPolicyCalls > 0
        ? `звонки по сделкам / сделки в выборке; исключено по direct-only: ${formatCount(excludedByPolicyCalls)}`
        : 'звонки по сделкам / сделки в выборке'
    }

    if (excludedByPolicyCalls > 0) {
      return `нет прямых связей; исключено по direct-only: ${formatCount(excludedByPolicyCalls)}`
    }

    return calls.totalCalls > 0
      ? 'есть звонки, но они не привязаны к сделкам'
      : 'нет связанных сделок для расчета'
  })()
  const tasksPerDealDelta =
    compareTasksPerDeal === null
      ? '—'
      : formatPercentDelta(totalTasksPerDeal, compareTasksPerDeal)

  return {
    kpis: [
      buildKpi({
        label: 'Создано задач',
        value: formatCount(activities.totalCreatedCount),
        note: 'за активный диапазон',
        compare: compareActivities
          ? formatCompareValue('пред. период', formatCount(compareActivities.totalCreatedCount))
          : undefined,
        delta: createdDelta,
        deltaTone: normalizeKpiTone(createdDelta, true),
      }),
      buildKpi({
        label: 'Перенесён дедлайн',
        value: formatCount(activities.totalRescheduledCount),
        note: 'метрика пока выключена',
        compare: 'недостоверная история отсутствует',
        delta: '—',
        deltaTone: 'neutral',
      }),
      buildKpi({
        label: 'Закрыто задач',
        value: formatCount(activities.totalClosedCount),
        note:
          activities.totalCreatedCount > 0
            ? `${Math.round((activities.totalClosedCount / activities.totalCreatedCount) * 100)}% от созданных`
            : '0% от созданных',
        compare: compareActivities
          ? formatCompareValue('пред. период', formatCount(compareActivities.totalClosedCount))
          : undefined,
        delta: closedDelta,
        deltaTone: normalizeKpiTone(closedDelta, true),
      }),
      buildKpi({
        label: 'Звонков на сделку',
        value: hasCallsPerDealBase ? formatDecimal(totalCallsPerDeal) : '—',
        note: callsPerDealNote,
        compare:
          hasCallsPerDealBase && compareCallsPerDeal !== null
            ? formatCompareValue('пред. период', formatDecimal(compareCallsPerDeal))
            : undefined,
        delta: callsPerDealDelta,
        deltaTone: hasCallsPerDealBase
          ? normalizeKpiTone(callsPerDealDelta, true)
          : 'neutral',
      }),
      buildKpi({
        label: 'Задач на сделку',
        value: formatDecimal(totalTasksPerDeal),
        note: 'созданные задачи / сделки в выборке',
        compare: formatOptionalCompareValue(
          'пред. период',
          compareTasksPerDeal,
          formatDecimal,
        ),
        delta: tasksPerDealDelta,
        deltaTone: tasksPerDealDelta === '0%' ? 'neutral' : normalizeKpiTone(tasksPerDealDelta, true),
      }),
    ],
    warnings: Array.from(new Set([...activities.warnings, ...calls.warnings])),
    managerCount: orderedManagers.length,
    stageCount: stageOrder.length,
    summaryRows,
    matrixRows,
  }
}

export function mapCohortSceneData(input: {
  report: CohortConversionReport
  managerBreakdowns: ManagerCohortBreakdown[]
  sourceBreakdowns: SourceCohortBreakdown[]
}): CohortSceneData {
  const { report, managerBreakdowns, sourceBreakdowns } = input
  const sourceBreakdownDistributionRows = mapSourceDistributionFromBreakdownRows(
    report.breakdownRows ?? [],
  )

  const matrixRowsBase: Array<
    CohortMatrixRow & {
      rawValues: number[]
    }
  > = report.rows.map((row) => {
    const matrixBuckets = cohortBucketOrder.map((bucketKey) =>
      getRelativeClosureBucket(row, bucketKey),
    )
    const rawValues = matrixBuckets.map((bucket) => bucket.wonDeals)

    return {
      month: monthLabel(row.createdMonth),
      createdDeals: formatCount(row.createdDeals),
      rawValues,
      cells: matrixBuckets.map((bucket) => ({
        value: formatCount(bucket.wonDeals),
        subvalue: formatPercentDisplay(bucket.wonConversionRate),
        level: 1,
      })),
      conversion: formatPercentDisplay(row.wonConversionRate),
      cycle: `${Math.round(row.averageDaysToWin)} дн.`,
    }
  })

  const maxMatrixValue = Math.max(
    0,
    ...matrixRowsBase.flatMap((row) => row.rawValues),
  )

  const matrixRows: CohortMatrixRow[] = matrixRowsBase.map((row) => ({
    month: row.month,
    createdDeals: row.createdDeals,
    conversion: row.conversion,
    cycle: row.cycle,
    cells: row.cells.map((cell, index) => ({
      ...cell,
      level: createHeatLevel(row.rawValues[index] ?? 0, maxMatrixValue),
    })),
  }))

  const currentAverageConversion = averageCohortRowRate(
    report.rows,
    (row) => row.wonConversionRate,
  )
  const recentThreeRows = recentCohortRows(report.rows, 3)
  const recentThreeAverageConversion = averageCohortRowRate(
    recentThreeRows,
    (row) => row.wonConversionRate,
  )
  const currentAverageCycle = weightedAverageCohortCycleDays(report.rows)

  const distributionBuckets = cohortBucketOrder.map((bucketKey) => {
    const label = cohortBucketLabels.get(bucketKey) ?? bucketKey
    const currentExact = averageRelativeBucketRate(report.rows, bucketKey)

    return {
      label,
      value: formatPercentDisplay(currentExact),
      width: widthFromPercent(currentExact),
    }
  })

  return {
    range: report.range,
    kpis: [
      buildKpi({
        label: 'Средняя когортная конверсия',
        value: formatPercentDisplay(currentAverageConversion),
        note: 'среднее по когортам за год',
      }),
      ...(recentThreeRows.length === 3
        ? [
            buildKpi({
              label: 'Средняя за 3 месяца',
              value: formatPercentDisplay(recentThreeAverageConversion),
              note: 'последние 3 когорты',
            }),
          ]
        : []),
      ...distributionBuckets.map((bucket) => buildKpi({
        label: bucket.label,
        value: bucket.value,
        note: 'среднее по когортам за год',
      })),
      buildKpi({
        label: 'Средний цикл',
        value: `${Math.round(currentAverageCycle)} дн.`,
        note: 'среднее по выигранным сделкам за год',
      }),
    ],
    matrixRows,
    distributionBuckets,
    managerDistribution: sortBreakdowns(managerBreakdowns)
      .slice(0, 5)
      .map((entry) => mapDistributionRow(entry.label, entry.report)),
    sourceDistribution: sourceBreakdownDistributionRows.length > 0
      ? sourceBreakdownDistributionRows
      : sortBreakdowns(sourceBreakdowns)
        .map((entry) => mapDistributionRow(entry.label, entry.report)),
    sourceBreakdownRows: mapCohortBreakdownRows(report.breakdownRows ?? []),
  }
}

function mapStageDistribution(
  report: TocFlowReport,
): TocStageDistribution {
  const distribution = report.stageDistribution

  if (!distribution) {
    return {
      totalCreatedDeals: 0,
      nodes: [],
      edges: [],
    }
  }

  return {
    totalCreatedDeals: distribution.totalCreatedDeals,
    nodes: distribution.nodes
      .map((node) => ({
        stageId: node.stageId,
        stage: node.stageName,
        sortOrder: node.sortOrder,
        count: node.dealCount,
        shareOfCreatedDeals: node.shareOfCreatedDeals,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    edges: distribution.edges.map((edge, index) => ({
      id: `${edge.fromStageId ?? 'created'}-${edge.toStageId}-${index}`,
      fromStageId: edge.fromStageId,
      fromStage: edge.fromStageName ?? 'Создано',
      toStageId: edge.toStageId,
      toStage: edge.toStageName,
      count: edge.dealCount,
      conversionRate: edge.conversionRate,
    })),
    routeNodes: (distribution.routeNodes ?? []).map((node) => ({
      id: `step-${node.step}-${node.stageId}`,
      step: node.step,
      stageId: node.stageId,
      stage: node.stageName,
      sortOrder: node.sortOrder,
      count: node.dealCount,
      shareOfCreatedDeals: node.shareOfCreatedDeals,
    })),
    routeEdges: (distribution.routeEdges ?? []).map((edge, index) => ({
      id: `step-${edge.fromStep}-${edge.fromStageId}-${edge.toStep}-${edge.toStageId}-${index}`,
      fromStep: edge.fromStep,
      fromStageId: edge.fromStageId,
      fromStage: edge.fromStageName,
      toStep: edge.toStep,
      toStageId: edge.toStageId,
      toStage: edge.toStageName,
      count: edge.dealCount,
      conversionRate: edge.conversionRate,
    })),
  }
}

export function mapTocFlowSceneData(input: {
  report: TocFlowReport
  managerBreakdowns?: ManagerTocBreakdown[]
}): TocFlowSceneData {
  const { report, managerBreakdowns = [] } = input
  const compare = getFirstComparison<TocFlowReportSnapshot>(report)
  const currentRows = sortActiveTocRows(report.rows)
  const compareRows = sortActiveTocRows(compare?.rows ?? [])
  const bottleneckRow = resolveTocBottleneckRow(currentRows, report.bottleneck)
  const compareBottleneckRow = resolveTocBottleneckRow(compareRows, compare?.bottleneck)
  const compareByStageId = new Map(compareRows.map((row) => [row.stageId, row]))

  const currentStages: FlowStageMetric[] = currentRows.map((row) => ({
    stage: row.stageName,
    entered: row.enteredDeals,
    throughputPerDay: row.throughputPerDay,
    queueEnd: row.queueEnd,
    avgCycleDays: row.averageStageDurationDays,
    note:
      bottleneckRow?.stageId === row.stageId
        ? 'Главное ограничение периода'
        : row.queueBufferDays
          ? `Буфер ${row.queueBufferDays.toFixed(1)} дн.`
          : 'Буфер не определен',
  }))

  const compareStages: FlowStageMetric[] = compareRows.map((row) => ({
    stage: row.stageName,
    entered: row.enteredDeals,
    throughputPerDay: row.throughputPerDay,
    queueEnd: row.queueEnd,
    avgCycleDays: row.averageStageDurationDays,
    note:
      compareBottleneckRow?.stageId === row.stageId
        ? 'Ограничение сравнения'
        : row.queueBufferDays
          ? `Буфер ${row.queueBufferDays.toFixed(1)} дн.`
          : 'Буфер не определен',
  }))

  const totalQueue = currentRows.reduce((total, row) => total + row.queueEnd, 0)
  const compareTotalQueue = compareRows.reduce((total, row) => total + row.queueEnd, 0)
  const totalMovedNext = currentRows.reduce((total, row) => total + row.movedNextDeals, 0)
  const compareTotalMovedNext = compareRows.reduce(
    (total, row) => total + row.movedNextDeals,
    0,
  )
  const averageWip = currentRows.length > 0 ? totalQueue / currentRows.length : 0
  const compareAverageWip = compareRows.length > 0 ? compareTotalQueue / compareRows.length : 0
  const averageCycle = average(currentRows.map((row) => row.averageStageDurationDays))
  const compareAverageCycle = average(compareRows.map((row) => row.averageStageDurationDays))

  const throughputDropStage =
    currentRows.reduce(
      (worst, row) => {
        const compareRow = compareByStageId.get(row.stageId)
        const delta = row.throughputPerDay - (compareRow?.throughputPerDay ?? 0)

        if (delta < worst.delta) {
          return { stage: row.stageName, delta }
        }

        return worst
      },
      {
        stage: currentRows[0]?.stageName ?? '—',
        delta: Number.POSITIVE_INFINITY,
      },
    ).stage ?? '—'

  const totalQueueDelta = formatPercentDelta(totalQueue, compareTotalQueue)
  const totalMovedNextDelta = formatPercentDelta(totalMovedNext, compareTotalMovedNext)
  const averageCycleDelta = `${formatSignedTenthsTrunc(averageCycle - compareAverageCycle)} дн.`
  const managerConversionRows = managerBreakdowns
    .map(mapTocManagerConversionRow)
    .filter((row) => row.stages.length > 0)
    .sort((left, right) => right.averageRate - left.averageRate)
    .map(
      (row): TocManagerConversionRow => ({
        manager: row.manager,
        averageConversion: row.averageConversion,
        stages: row.stages,
      }),
    )

  return {
    kpis: [
      buildKpi({
        label: 'Сделок в работе',
        value: formatCount(totalQueue),
        note: 'вся очередь на конец периода',
        compare: compare ? `пред. период: ${formatCount(compareTotalQueue)}` : undefined,
        delta: totalQueueDelta,
        deltaTone: normalizeKpiTone(totalQueueDelta, false),
      }),
      buildKpi({
        label: 'Выход за период',
        value: formatCount(totalMovedNext),
        note: 'перешло на следующий этап в периоде',
        compare: compare
          ? `пред. период: ${formatCount(compareTotalMovedNext)}`
          : undefined,
        delta: totalMovedNextDelta,
        deltaTone: normalizeKpiTone(totalMovedNextDelta, true),
      }),
      buildKpi({
        label: 'Главное ограничение',
        value: bottleneckRow?.stageName ?? '—',
        note: 'самый плотный этап',
        compare: bottleneckRow
          ? `${formatCount(bottleneckRow.queueEnd)} сделок в очереди`
          : undefined,
      }),
      buildKpi({
        label: 'Средний WIP',
        value: formatCount(averageWip),
        note: 'на один активный этап',
        compare: compare ? `пред. период: ${formatCount(compareAverageWip)}` : undefined,
        delta: formatSignedValue(averageWip - compareAverageWip),
        deltaTone: normalizeKpiTone(
          formatSignedValue(averageWip - compareAverageWip),
          false,
        ),
      }),
      buildKpi({
        label: 'Средний цикл этапа',
        value: `${formatDecimal(averageCycle)} дн.`,
        note: 'по этапам с накоплением',
        compare: compare
          ? `пред. период: ${formatDecimal(compareAverageCycle)} дн.`
          : undefined,
        delta: averageCycleDelta,
        deltaTone: normalizeKpiTone(averageCycleDelta, false),
      }),
    ],
    warnings: report.warnings,
    currentStages,
    compareStages,
    managerConversionRows,
    stableLeaders: buildStableLeaderRows(managerBreakdowns),
    stageDistribution: mapStageDistribution(report),
    focus: {
      bottleneckStage: bottleneckRow?.stageName ?? '—',
      compareBottleneckStage: compareBottleneckRow?.stageName ?? '—',
      maxQueueStage:
        currentRows.length > 0
          ? currentRows.reduce((best, row) => (row.queueEnd > best.queueEnd ? row : best)).stageName
          : '—',
      throughputDropStage,
    },
  }
}
