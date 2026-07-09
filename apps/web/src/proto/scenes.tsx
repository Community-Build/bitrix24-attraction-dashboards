import { Fragment, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowDown01Icon, ArrowRight01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type {
  ActivitiesWorkloadReport,
  AcquisitionOutcomesReport,
  DashboardQuery,
  ConversionEventsReport,
  DashboardData,
  DealEventSummary,
  DealLifecycleStageTimelineEntry,
  DealSaleEconomics,
  DealStageTimelineEntry,
  DealTimelineEvent,
  HourlyWeekdayWorkloadHeatmap,
  ManagerActionOutcomeDealDetail,
  ManagerActionOutcomeReport,
  OperationalDashboardReport,
  OperationalMeetingSlotCount,
  OperationalRiskDeal,
  OperationalRiskRuleKey,
  RevenueVelocityDimension,
  RevenueVelocityFormulaBreakdown,
  RevenueVelocityReport,
  RevenueVelocityRow,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanQuarterData,
  SalesPlanQuarterDraftRow,
  SalesDealRow,
  SalesManagerGroup,
  SourceCohortConversionManagerRow,
  SourceCohortConversionOpenStageRow,
  SourceCohortConversionReport,
  SourceCohortConversionRow,
  TargetGroupConversionReport,
  UnitEconomicsManagerCostDetailRow,
  UnitEconomicsManagerRow,
  UnitEconomicsEventParticipantMode,
  UnitEconomicsReport,
} from '@/lib/dashboard-types'
import { apiClient } from '@/lib/api-client'
import {
  formatAmount,
  formatInteger,
  formatPercent,
  formatShortDate,
} from '@/lib/formatters'
import { revenueVelocityTooltips } from '@/lib/revenue-velocity-tooltips'
import { cn } from '@/lib/utils'
import { buildDashboardQueryFromProtoFilters } from '@/proto/live-reporting'
import { FunnelStageDistributionChart } from '@/proto/funnel-stage-distribution-chart'
import { SourceCohortStageConversionSection } from '@/proto/source-cohort-trajectory-section'
import { managerOptions, sceneMetadata, sourceOptions } from '@/proto/scene-registry'
import type {
  ActivityMatrixRow,
  ActivityMatrixStageRow,
  ActivitySummaryRow,
  CohortBreakdownRow,
  CohortDistributionBucket,
  CohortDistributionRow,
  CohortMatrixRow,
  FlowStageMetric,
  PickerOption,
  ProtoFilterState,
  ProtoScene,
  SceneComponentProps,
  TocStageDistribution,
} from '@/proto/types'

export {
  createDefaultFilters,
  defaultFilters,
  managerOptions,
  sceneMetadata,
  sourceOptions,
} from '@/proto/scene-registry'

type SalesRow = {
  source: string
  created: string
  quality: string
  ready: string
  intro: string
  won: string
  cycle: string
}

type Tone = 'positive' | 'negative' | 'neutral'
type ActivitySummarySort = {
  index: number
  direction: 'asc' | 'desc'
}
type StaticActivityMatrixRow = Omit<ActivityMatrixRow, 'totalCalls' | 'totalClosedTasks' | 'stages'> & {
  stages: Array<Omit<ActivityMatrixStageRow, 'totalCalls' | 'totalClosedTasks'>>
}

const SHOW_ACTIVITY_MATRIX = false
const SHOW_TARGET_GROUP_CONVERSION = false
const SHOW_ACTION_OUTCOME_WIP = true
const SHOW_SALES_SECONDARY_REPORTS = false

const attachActivityMatrixTotals = (rows: StaticActivityMatrixRow[]): ActivityMatrixRow[] =>
  rows.map((row) => ({
    ...row,
    totalCalls: '0',
    totalClosedTasks: '0',
    stages: row.stages.map((stage) => ({
      ...stage,
      totalCalls: '0',
      totalClosedTasks: '0',
    })),
  }))

const salesRows: SalesRow[] = [
  { source: 'Платный поиск', created: '68', quality: '41', ready: '33', intro: '24', won: '12', cycle: '26 дн.' },
  { source: 'Партнёры', created: '54', quality: '38', ready: '29', intro: '21', won: '14', cycle: '22 дн.' },
  { source: 'Вебинары', created: '37', quality: '19', ready: '14', intro: '9', won: '5', cycle: '34 дн.' },
  { source: 'Органика', created: '23', quality: '12', ready: '9', intro: '7', won: '3', cycle: '31 дн.' },
]

const activityRows: ActivitySummaryRow[] = [
  { manager: 'Анна Петрова', createdTasks: '118', outgoing: '88', successfulCalls: '57', otherOutgoing: '12', missedIncoming: '3', incoming: '42', noAnswer: '19', closedTasks: '104' },
  { manager: 'Илья Ковалёв', createdTasks: '96', outgoing: '72', successfulCalls: '41', otherOutgoing: '20', missedIncoming: '2', incoming: '37', noAnswer: '11', closedTasks: '79' },
  { manager: 'Марина Орлова', createdTasks: '103', outgoing: '91', successfulCalls: '63', otherOutgoing: '18', missedIncoming: '1', incoming: '28', noAnswer: '10', closedTasks: '84' },
  { manager: 'Ольга Лунёва', createdTasks: '88', outgoing: '63', successfulCalls: '39', otherOutgoing: '15', missedIncoming: '2', incoming: '24', noAnswer: '9', closedTasks: '77' },
]

const activityStages = [
  'База входящая',
  'Звонок-знакомство',
  'Встреча-знакомство',
  'Активация',
  'Проблематизация',
  'Демонстрация',
  'Адмиссия',
  'Контрактация',
  'На передаче',
]

const activityMatrixRows = attachActivityMatrixTotals([
  {
    manager: 'Анна Петрова',
    avgCalls: '2.9',
    avgClosedTasks: '4.8',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.4', closedTasksAvg: '0.9', level: 1 },
      { label: 'Звонок-знакомство', callsPerDeal: '1.9', closedTasksAvg: '1.6', level: 5 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.8', closedTasksAvg: '1.1', level: 3 },
      { label: 'Активация', callsPerDeal: '0.7', closedTasksAvg: '1.0', level: 3 },
      { label: 'Проблематизация', callsPerDeal: '0.6', closedTasksAvg: '0.9', level: 2 },
      { label: 'Демонстрация', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'Адмиссия', callsPerDeal: '0.4', closedTasksAvg: '0.7', level: 1 },
      { label: 'Контрактация', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'На передаче', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
    ],
  },
  {
    manager: 'Илья Ковалёв',
    avgCalls: '2.5',
    avgClosedTasks: '4.2',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'Звонок-знакомство', callsPerDeal: '1.7', closedTasksAvg: '1.4', level: 5 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.7', closedTasksAvg: '1.0', level: 3 },
      { label: 'Активация', callsPerDeal: '0.6', closedTasksAvg: '0.8', level: 2 },
      { label: 'Проблематизация', callsPerDeal: '0.5', closedTasksAvg: '0.7', level: 2 },
      { label: 'Демонстрация', callsPerDeal: '0.4', closedTasksAvg: '0.7', level: 1 },
      { label: 'Адмиссия', callsPerDeal: '0.4', closedTasksAvg: '0.6', level: 1 },
      { label: 'Контрактация', callsPerDeal: '0.3', closedTasksAvg: '0.6', level: 1 },
      { label: 'На передаче', callsPerDeal: '0.2', closedTasksAvg: '0.4', level: 1 },
    ],
  },
  {
    manager: 'Марина Орлова',
    avgCalls: '3.1',
    avgClosedTasks: '4.9',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.3', closedTasksAvg: '0.8', level: 1 },
      { label: 'Звонок-знакомство', callsPerDeal: '2.1', closedTasksAvg: '1.8', level: 5 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.9', closedTasksAvg: '1.2', level: 4 },
      { label: 'Активация', callsPerDeal: '0.8', closedTasksAvg: '1.1', level: 3 },
      { label: 'Проблематизация', callsPerDeal: '0.7', closedTasksAvg: '0.9', level: 3 },
      { label: 'Демонстрация', callsPerDeal: '0.6', closedTasksAvg: '0.8', level: 2 },
      { label: 'Адмиссия', callsPerDeal: '0.5', closedTasksAvg: '0.7', level: 2 },
      { label: 'Контрактация', callsPerDeal: '0.4', closedTasksAvg: '0.7', level: 1 },
      { label: 'На передаче', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
    ],
  },
  {
    manager: 'Ольга Лунёва',
    avgCalls: '2.2',
    avgClosedTasks: '3.9',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.3', closedTasksAvg: '0.7', level: 1 },
      { label: 'Звонок-знакомство', callsPerDeal: '1.5', closedTasksAvg: '1.3', level: 4 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.6', closedTasksAvg: '0.9', level: 2 },
      { label: 'Активация', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'Проблематизация', callsPerDeal: '0.5', closedTasksAvg: '0.7', level: 2 },
      { label: 'Демонстрация', callsPerDeal: '0.4', closedTasksAvg: '0.6', level: 1 },
      { label: 'Адмиссия', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
      { label: 'Контрактация', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
      { label: 'На передаче', callsPerDeal: '0.2', closedTasksAvg: '0.4', level: 1 },
    ],
  },
])

const cohortRows: CohortMatrixRow[] = [
  {
    month: 'Октябрь 2025',
    createdDeals: '92',
    cells: [
      { value: '6', subvalue: '7%', level: 3 },
      { value: '11', subvalue: '12%', level: 5 },
      { value: '7', subvalue: '8%', level: 4 },
      { value: '4', subvalue: '4%', level: 2 },
    ],
    conversion: '31%',
    cycle: '59 дн.',
  },
  {
    month: 'Ноябрь 2025',
    createdDeals: '101',
    cells: [
      { value: '5', subvalue: '5%', level: 2 },
      { value: '13', subvalue: '13%', level: 5 },
      { value: '8', subvalue: '8%', level: 4 },
      { value: '6', subvalue: '6%', level: 2 },
    ],
    conversion: '29%',
    cycle: '63 дн.',
  },
  {
    month: 'Декабрь 2025',
    createdDeals: '108',
    cells: [
      { value: '4', subvalue: '4%', level: 2 },
      { value: '10', subvalue: '9%', level: 4 },
      { value: '9', subvalue: '8%', level: 4 },
      { value: '9', subvalue: '8%', level: 3 },
    ],
    conversion: '26%',
    cycle: '67 дн.',
  },
  {
    month: 'Январь 2026',
    createdDeals: '114',
    cells: [
      { value: '3', subvalue: '3%', level: 1 },
      { value: '9', subvalue: '8%', level: 4 },
      { value: '11', subvalue: '10%', level: 5 },
      { value: '10', subvalue: '9%', level: 3 },
    ],
    conversion: '24%',
    cycle: '71 дн.',
  },
]

const stagePressure = [
  { label: 'Качество “Готов ко встрече”', value: 77, note: '74 сделки в статусе качества' },
  { label: 'Звонок-знакомство', value: 58, note: '51 сделка перешла в первый звонок' },
  { label: 'Встреча проведена', value: 39, note: '34 сделки дошли до встречи' },
  { label: 'Коммерческое предложение', value: 28, note: '25 сделок дошли до оффера' },
  { label: 'Выиграно', value: 21, note: '18 успешных закрытий' },
]

const cycleBuckets: CohortDistributionBucket[] = [
  { label: 'В 1 месяц', value: '8%', width: 32 },
  { label: 'Во 2 месяц', value: '9%', width: 44 },
  { label: 'В 3 месяц', value: '5%', width: 24 },
  { label: 'В 4+ месяц', value: '2%', width: 14 },
]

const activitySummaryDeltas: Record<string, string[]> = {
  'Анна Петрова': ['+9%', '+8%', '+6%', '+12%', '+3%', '-5%', '+4%'],
  'Илья Ковалёв': ['-3%', '-2%', '+2%', '+7%', '+5%', '+4%', '+1%'],
  'Марина Орлова': ['+14%', '+10%', '+11%', '+15%', '+4%', '-8%', '-6%'],
  'Ольга Лунёва': ['+4%', '+6%', '-2%', '+5%', '+1%', '-11%', '+3%'],
}

const cohortManagerDistribution: CohortDistributionRow[] = [
  { manager: 'Анна Петрова', month1: '7%', month2: '12%', month3: '6%', tail: '2%', width: 82 },
  { manager: 'Марина Орлова', month1: '9%', month2: '10%', month3: '5%', tail: '3%', width: 76 },
  { manager: 'Илья Ковалёв', month1: '6%', month2: '8%', month3: '4%', tail: '2%', width: 62 },
  { manager: 'Ольга Лунёва', month1: '5%', month2: '7%', month3: '4%', tail: '1%', width: 54 },
]

const cohortSourceDistribution: CohortDistributionRow[] = [
  { manager: 'Платный поиск', month1: '8%', month2: '11%', month3: '4%', tail: '1%' },
  { manager: 'Партнёры', month1: '10%', month2: '9%', month3: '5%', tail: '2%' },
  { manager: 'Вебинары', month1: '4%', month2: '7%', month3: '6%', tail: '3%' },
  { manager: 'Органика', month1: '3%', month2: '6%', month3: '5%', tail: '4%' },
]

const funnelFlowCurrent: FlowStageMetric[] = [
  { stage: 'База входящая', entered: 128, throughputPerDay: 23, queueEnd: 84, avgCycleDays: 3.6, note: 'Новый приток без дефицита слотов' },
  { stage: 'Звонок-знакомство', entered: 112, throughputPerDay: 18, queueEnd: 61, avgCycleDays: 4.2, note: 'Нагрузка на первый каскад касаний' },
  { stage: 'Встреча-знакомство', entered: 86, throughputPerDay: 14, queueEnd: 42, avgCycleDays: 5.4, note: 'Календарь встреч уже плотный' },
  { stage: 'Активация', entered: 61, throughputPerDay: 11, queueEnd: 35, avgCycleDays: 6.1, note: 'Много ручного follow-up' },
  { stage: 'Проблематизация', entered: 48, throughputPerDay: 7, queueEnd: 33, avgCycleDays: 8.8, note: 'Главный затор недели' },
  { stage: 'Демонстрация', entered: 31, throughputPerDay: 6, queueEnd: 20, avgCycleDays: 7.1, note: 'Упираемся в слоты демонстраций' },
  { stage: 'Контрактация', entered: 19, throughputPerDay: 4, queueEnd: 12, avgCycleDays: 5.9, note: 'Финальная юридическая обработка' },
  { stage: 'На передаче', entered: 14, throughputPerDay: 3, queueEnd: 9, avgCycleDays: 4.3, note: 'Передача в производство' },
]

const funnelFlowCompare: FlowStageMetric[] = [
  { stage: 'База входящая', entered: 121, throughputPerDay: 21, queueEnd: 73, avgCycleDays: 3.2, note: 'Прошлый период' },
  { stage: 'Звонок-знакомство', entered: 101, throughputPerDay: 19, queueEnd: 52, avgCycleDays: 3.8, note: 'Прошлый период' },
  { stage: 'Встреча-знакомство', entered: 79, throughputPerDay: 17, queueEnd: 31, avgCycleDays: 4.6, note: 'Прошлый период' },
  { stage: 'Активация', entered: 58, throughputPerDay: 12, queueEnd: 29, avgCycleDays: 5.2, note: 'Прошлый период' },
  { stage: 'Проблематизация', entered: 44, throughputPerDay: 9, queueEnd: 24, avgCycleDays: 6.1, note: 'Прошлый период' },
  { stage: 'Демонстрация', entered: 28, throughputPerDay: 7, queueEnd: 18, avgCycleDays: 6.5, note: 'Прошлый период' },
  { stage: 'Контрактация', entered: 17, throughputPerDay: 5, queueEnd: 10, avgCycleDays: 5.2, note: 'Прошлый период' },
  { stage: 'На передаче', entered: 12, throughputPerDay: 3, queueEnd: 8, avgCycleDays: 4.0, note: 'Прошлый период' },
]

const emptyStageDistribution: TocStageDistribution = {
  totalCreatedDeals: 0,
  nodes: [],
  edges: [],
}

const funnelStageDistribution: TocStageDistribution = {
  totalCreatedDeals: 128,
  nodes: [
    { stageId: 'BASE', stage: 'База входящая', sortOrder: 1, count: 128, shareOfCreatedDeals: 100 },
    { stageId: 'CALL', stage: 'Звонок-знакомство', sortOrder: 2, count: 112, shareOfCreatedDeals: 88 },
    { stageId: 'MEETING', stage: 'Встреча-знакомство', sortOrder: 3, count: 86, shareOfCreatedDeals: 67 },
    { stageId: 'ACTIVATION', stage: 'Активация', sortOrder: 4, count: 61, shareOfCreatedDeals: 48 },
    { stageId: 'DEMO', stage: 'Демонстрация', sortOrder: 5, count: 43, shareOfCreatedDeals: 34 },
    { stageId: 'CONTRACT', stage: 'Контрактация', sortOrder: 6, count: 27, shareOfCreatedDeals: 21 },
    { stageId: 'HANDOFF', stage: 'На передаче', sortOrder: 7, count: 14, shareOfCreatedDeals: 11 },
    { stageId: 'BASKET', stage: 'Корзина', sortOrder: 8, count: 28, shareOfCreatedDeals: 22 },
    { stageId: 'RETURN', stage: 'Возврат в лидген', sortOrder: 9, count: 16, shareOfCreatedDeals: 13 },
  ],
  edges: [
    { id: 'created-BASE-0', fromStageId: null, fromStage: 'Создано', toStageId: 'BASE', toStage: 'База входящая', count: 128, conversionRate: 100 },
    { id: 'BASE-CALL-1', fromStageId: 'BASE', fromStage: 'База входящая', toStageId: 'CALL', toStage: 'Звонок-знакомство', count: 112, conversionRate: 88 },
    { id: 'BASE-RETURN-2', fromStageId: 'BASE', fromStage: 'База входящая', toStageId: 'RETURN', toStage: 'Возврат в лидген', count: 16, conversionRate: 13 },
    { id: 'CALL-MEETING-3', fromStageId: 'CALL', fromStage: 'Звонок-знакомство', toStageId: 'MEETING', toStage: 'Встреча-знакомство', count: 86, conversionRate: 77 },
    { id: 'CALL-BASKET-4', fromStageId: 'CALL', fromStage: 'Звонок-знакомство', toStageId: 'BASKET', toStage: 'Корзина', count: 18, conversionRate: 16 },
    { id: 'CALL-CONTRACT-5', fromStageId: 'CALL', fromStage: 'Звонок-знакомство', toStageId: 'CONTRACT', toStage: 'Контрактация', count: 8, conversionRate: 7 },
    { id: 'MEETING-ACTIVATION-6', fromStageId: 'MEETING', fromStage: 'Встреча-знакомство', toStageId: 'ACTIVATION', toStage: 'Активация', count: 61, conversionRate: 71 },
    { id: 'MEETING-DEMO-7', fromStageId: 'MEETING', fromStage: 'Встреча-знакомство', toStageId: 'DEMO', toStage: 'Демонстрация', count: 12, conversionRate: 14 },
    { id: 'ACTIVATION-DEMO-8', fromStageId: 'ACTIVATION', fromStage: 'Активация', toStageId: 'DEMO', toStage: 'Демонстрация', count: 31, conversionRate: 51 },
    { id: 'ACTIVATION-BASKET-9', fromStageId: 'ACTIVATION', fromStage: 'Активация', toStageId: 'BASKET', toStage: 'Корзина', count: 10, conversionRate: 16 },
    { id: 'DEMO-CONTRACT-10', fromStageId: 'DEMO', fromStage: 'Демонстрация', toStageId: 'CONTRACT', toStage: 'Контрактация', count: 19, conversionRate: 44 },
    { id: 'CONTRACT-HANDOFF-11', fromStageId: 'CONTRACT', fromStage: 'Контрактация', toStageId: 'HANDOFF', toStage: 'На передаче', count: 14, conversionRate: 52 },
  ],
}

function getManagerPickerOptions(runtimeData?: SceneComponentProps['runtimeData']) {
  return runtimeData?.managerOptions.length ? runtimeData.managerOptions : managerOptions
}

function getSourcePickerOptions(runtimeData?: SceneComponentProps['runtimeData']) {
  return runtimeData?.sourceOptions.length ? runtimeData.sourceOptions : sourceOptions
}

function getActivitiesSceneData(runtimeData?: SceneComponentProps['runtimeData']) {
  if (runtimeData?.activitiesCalls) {
    return runtimeData.activitiesCalls
  }

  if (runtimeData && runtimeData.operationalStatus !== 'ready') {
    return {
      kpis: [],
      warnings: [],
      managerCount: 0,
      stageCount: 0,
      summaryRows: [],
      matrixRows: [],
    }
  }

  return (
    {
      kpis: [],
      warnings: [],
      managerCount: activityRows.length,
      stageCount: activityStages.length,
      summaryRows: activityRows,
      matrixRows: activityMatrixRows,
    }
  )
}

function isVisibleActivityWarning(warning: string) {
  return !warning.toLowerCase().includes('deadline reschedule counts are disabled')
}

const activitySummaryColumns = [
  { index: 0, label: 'Создано задач' },
  { index: 1, label: 'Закрыто задач' },
  { index: 2, label: 'Исходящие', hint: 'успешные + прочие + недозвоны' },
  { index: 3, label: 'Успешные >30 сек' },
  { index: 4, label: 'Прочие исходящие' },
  { index: 5, label: 'Недозвоны' },
  { index: 6, label: 'Пропущенные' },
  { index: 7, label: 'Входящие' },
]

function getActivitySummaryCells(row: ActivitySummaryRow) {
  return [
    { key: 'created', value: row.createdTasks },
    { key: 'closed', value: row.closedTasks },
    {
      key: 'outgoing',
      value: row.outgoing,
      helper: `= ${row.successfulCalls} + ${row.otherOutgoing} + ${row.noAnswer}`,
    },
    { key: 'successful', value: row.successfulCalls },
    { key: 'other', value: row.otherOutgoing },
    { key: 'no-answer', value: row.noAnswer },
    { key: 'missed-incoming', value: row.missedIncoming },
    { key: 'incoming', value: row.incoming },
  ]
}

function sortActivitySummaryRows(rows: ActivitySummaryRow[], sort: ActivitySummarySort) {
  return [...rows].sort((left, right) => {
    const leftValue = left.sortValues?.[sort.index] ?? 0
    const rightValue = right.sortValues?.[sort.index] ?? 0
    const result = leftValue === rightValue
      ? left.manager.localeCompare(right.manager, 'ru-RU')
      : leftValue - rightValue

    return sort.direction === 'asc' ? result : -result
  })
}

type WorkloadHeatmapTone = 'calls' | 'tasks' | 'meetings'

const workloadHeatmapToneStyles: Record<
  WorkloadHeatmapTone,
  {
    label: string
    border: string
    header: string
    levels: string[]
  }
> = {
  calls: {
    label: 'text-blue-700',
    border: 'border-blue-100',
    header: 'bg-blue-50 text-blue-800',
    levels: ['#f8fafc', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#2563eb'],
  },
  tasks: {
    label: 'text-teal-700',
    border: 'border-teal-100',
    header: 'bg-teal-50 text-teal-800',
    levels: ['#f8fafc', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#0f766e'],
  },
  meetings: {
    label: 'text-sky-700',
    border: 'border-sky-100',
    header: 'bg-sky-50 text-sky-800',
    levels: ['#f8fafc', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0284c7'],
  },
}

function formatHeatmapHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function findHeatmapCell(
  heatmap: HourlyWeekdayWorkloadHeatmap,
  weekday: HourlyWeekdayWorkloadHeatmap['weekdays'][number]['weekday'],
  hour: number,
): HourlyWeekdayWorkloadHeatmap['cells'][number] {
  return heatmap.cells.find((cell) => cell.weekday === weekday && cell.hour === hour) ?? {
    weekday,
    weekdayLabel: heatmap.weekdays.find((column) => column.weekday === weekday)?.label ?? '',
    hour,
    count: 0,
    intensity: 0,
  }
}

const workloadHeatmapSegmentColors: Record<string, string> = {
  created_tasks: '#14b8a6',
  closed_tasks: '#4f46e5',
  successful_outgoing_calls: '#16a34a',
  other_outgoing_calls: '#f59e0b',
  no_answer_outgoing_calls: '#e11d48',
  meeting_slot_1: '#0284c7',
  meeting_slot_2: '#14b8a6',
  meeting_slot_3: '#6366f1',
}

function formatHeatmapCellLabel(
  weekdayLabel: string,
  hour: number,
  cell: HourlyWeekdayWorkloadHeatmap['cells'][number],
) {
  const segments = cell.segments?.filter((segment) => segment.count > 0) ?? []
  if (segments.length === 0) {
    return `${weekdayLabel} ${formatHeatmapHour(hour)}: ${formatInteger(cell.count)}`
  }

  return `${weekdayLabel} ${formatHeatmapHour(hour)}: ${segments
    .map((segment) => `${segment.label.toLowerCase()} ${formatInteger(segment.count)}`)
    .join(', ')}`
}

function collectHeatmapSegments(heatmap: HourlyWeekdayWorkloadHeatmap) {
  const segments = new Map<string, { label: string; color: string }>()

  for (const cell of heatmap.cells) {
    for (const segment of cell.segments ?? []) {
      if (!segments.has(segment.key)) {
        segments.set(segment.key, {
          label: segment.label,
          color: workloadHeatmapSegmentColors[segment.key] ?? '#64748b',
        })
      }
    }
  }

  return [...segments.entries()].map(([key, value]) => ({ key, ...value }))
}

function renderSegmentedHeatmapCell(
  cell: HourlyWeekdayWorkloadHeatmap['cells'][number],
  basisKey: string,
  weekday: HourlyWeekdayWorkloadHeatmap['weekdays'][number]['weekday'],
  hour: number,
) {
  const visibleSegments = (cell.segments ?? []).filter((segment) => segment.count > 0)

  if (visibleSegments.length === 0) {
    return null
  }

  return (
    <div className="absolute inset-0 flex overflow-hidden rounded-md">
      {visibleSegments.map((segment) => (
        <div
          key={segment.key}
          className="relative min-w-[5px]"
          style={{
            flexGrow: segment.count,
            backgroundColor: workloadHeatmapSegmentColors[segment.key] ?? '#64748b',
            opacity: 0.58 + Math.max(0, Math.min(5, segment.intensity)) * 0.08,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 tabular-nums text-[0.5rem] font-extrabold leading-none text-white/95 drop-shadow-sm"
            data-testid={`heatmap-segment-count-${basisKey}-${weekday}-${hour}-${segment.key}`}
          >
            {formatInteger(segment.count)}
          </span>
        </div>
      ))}
    </div>
  )
}

function HourlyWeekdayHeatmap({
  title,
  heatmap,
  tone,
}: {
  title: string
  heatmap: HourlyWeekdayWorkloadHeatmap | undefined
  tone: WorkloadHeatmapTone
}) {
  if (!heatmap) {
    return null
  }

  const toneStyle = workloadHeatmapToneStyles[tone]
  const peakLabel = heatmap.peak
    ? `${heatmap.peak.weekdayLabel} ${formatHeatmapHour(heatmap.peak.hour)} · ${formatInteger(heatmap.peak.count)}`
    : 'нет событий'
  const hasOutsideGridEvents = heatmap.outsideGridTotal > 0
  const legendSegments = collectHeatmapSegments(heatmap)

  return (
    <div className={`min-w-0 rounded-xl border bg-white ${toneStyle.border}`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <div className={`text-sm font-bold ${toneStyle.label}`}>{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">Пик: {peakLabel}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
          {legendSegments.map((segment) => (
            <span
              key={segment.key}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              {segment.label}
            </span>
          ))}
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            всего {formatInteger(heatmap.total)}
          </span>
          {hasOutsideGridEvents ? (
            <>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                в сетке {formatInteger(heatmap.gridTotal)}
              </span>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                вне 09-21 {formatInteger(heatmap.outsideGridTotal)}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="max-w-full overflow-x-auto p-3">
        <table className="min-w-[520px] w-full table-fixed text-xs" aria-label={title}>
          <thead>
            <tr>
              <th className="w-14 px-1 py-1 text-left font-semibold text-slate-400">Час</th>
              {heatmap.weekdays.map((weekday) => (
                <th
                  key={weekday.weekday}
                  className={`px-1 py-1 text-center font-bold ${toneStyle.header}`}
                >
                  {weekday.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.hours.map((hour) => (
              <tr key={hour} className="border-t border-slate-100">
                <th className="px-1 py-1 text-left font-semibold text-slate-500">
                  {formatHeatmapHour(hour)}
                </th>
                {heatmap.weekdays.map((weekday) => {
                  const cell = findHeatmapCell(heatmap, weekday.weekday, hour)
                  const intensity = Math.max(0, Math.min(5, Math.round(cell.intensity)))
                  const color = toneStyle.levels[intensity] ?? toneStyle.levels[0]
                  const isDark = intensity >= 5
                  const hasSegments = (cell.segments ?? []).some((segment) => segment.count > 0)
                  const cellLabel = formatHeatmapCellLabel(weekday.label, hour, cell)

                  return (
                    <td key={`${weekday.weekday}-${hour}`} className="px-1 py-1">
                      <div
                        className={[
                          'relative flex h-10 min-w-10 flex-col items-center justify-center overflow-hidden rounded-md border text-[0.7rem] font-bold',
                          intensity > 0 ? 'border-transparent shadow-sm' : 'border-slate-100 text-slate-300',
                          isDark || hasSegments ? 'text-white' : 'text-slate-700',
                        ].join(' ')}
                        style={{ backgroundColor: hasSegments ? '#f8fafc' : color }}
                        aria-label={cellLabel}
                        title={cellLabel}
                      >
                        {renderSegmentedHeatmapCell(cell, heatmap.basis.key, weekday.weekday, hour)}
                        <span
                          className={
                            hasSegments
                              ? 'absolute inset-0 z-20 flex items-center justify-center text-[0.72rem] leading-none text-white drop-shadow-sm'
                              : 'relative z-10 leading-none drop-shadow-sm'
                          }
                          data-testid={`heatmap-cell-total-${heatmap.basis.key}-${weekday.weekday}-${hour}`}
                        >
                          {cell.count > 0 ? formatInteger(cell.count) : ''}
                        </span>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: ActivitySummarySort['direction']
}) {
  return (
    <span
      className={[
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition',
        active
          ? 'border-slate-300 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-slate-50 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600',
      ].join(' ')}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        {active ? (
          <path
            d={direction === 'desc' ? 'M4 6.5 8 10.5 12 6.5' : 'M4 9.5 8 5.5 12 9.5'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path d="M5 6.25 8 3.25 11 6.25" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 9.75 8 12.75 11 9.75" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  )
}

function DisclosureIndicator({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={[
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition',
        expanded
          ? 'border-slate-300 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600',
      ].join(' ')}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        className={['size-3.5 transition-transform duration-150', expanded ? 'rotate-90' : ''].join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 4.5 10 8 6 11.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function ActivityStageMetricCard({
  label,
  value,
  unit,
  average,
  delta,
}: {
  label: string
  value: string
  unit: string
  average: string
  delta?: string
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/70 bg-white/65 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        <DeltaPill value={delta ?? '—'} />
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <strong className="text-lg leading-none text-slate-950 tabular-nums">{value}</strong>
        <span className="truncate text-[0.68rem] font-semibold text-slate-500">{unit}</span>
      </div>
      <div className="mt-1 truncate text-[0.68rem] font-medium text-slate-500">
        ср. {average} / сделку
      </div>
    </div>
  )
}

function getCohortSceneData(runtimeData?: SceneComponentProps['runtimeData']) {
  if (runtimeData?.cohorts) {
    return runtimeData.cohorts
  }

  if (runtimeData && runtimeData.operationalStatus !== 'ready') {
    return {
      range: undefined,
      kpis: [],
      matrixRows: [],
      distributionBuckets: [],
      managerDistribution: [],
      sourceDistribution: [],
      sourceBreakdownRows: [],
    }
  }

  return (
    {
      range: undefined,
      kpis: [],
      matrixRows: cohortRows,
      distributionBuckets: cycleBuckets,
      managerDistribution: cohortManagerDistribution,
      sourceDistribution: cohortSourceDistribution,
      sourceBreakdownRows: [],
    }
  )
}

function getCohortBreakdownLevelLabel(level: CohortBreakdownRow['level']) {
  if (level === 'cohort') {
    return 'Когорта'
  }

  if (level === 'source') {
    return 'Источник'
  }

  if (level === 'quality') {
    return 'Качество'
  }

  return 'Клуб / заказчик'
}

function getCohortBreakdownIndent(level: CohortBreakdownRow['level']) {
  if (level === 'source') {
    return 20
  }

  if (level === 'quality') {
    return 40
  }

  if (level === 'customer') {
    return 60
  }

  return 0
}

function getTocSceneData(runtimeData?: SceneComponentProps['runtimeData']) {
  if (runtimeData?.tocFlow) {
    return runtimeData.tocFlow
  }

  if (runtimeData && runtimeData.operationalStatus !== 'ready') {
    return {
      kpis: [],
      warnings: [],
      currentStages: [],
      compareStages: [],
      managerConversionRows: [],
      stableLeaders: [],
      stageDistribution: emptyStageDistribution,
      focus: {
        bottleneckStage: '',
        compareBottleneckStage: '',
        maxQueueStage: '',
        throughputDropStage: '',
      },
    }
  }

  return (
    {
      kpis: [],
      warnings: [],
      currentStages: funnelFlowCurrent,
      compareStages: funnelFlowCompare,
      managerConversionRows: [],
      stableLeaders: [],
      stageDistribution: funnelStageDistribution,
      focus: {
        bottleneckStage: 'Проблематизация',
        compareBottleneckStage: 'Проблематизация',
        maxQueueStage: 'База входящая',
        throughputDropStage: 'Звонок-знакомство',
      },
    }
  )
}

function formatFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatSignedNumber(value: number) {
  if (value === 0) {
    return '0'
  }

  return `${value > 0 ? '+' : '-'}${formatNumber(Math.abs(value))}`
}

function queueBufferDays(queue: number, throughputPerDay: number) {
  if (throughputPerDay <= 0) {
    return null
  }

  return queue / throughputPerDay
}

function conversionHeatColor(level: number) {
  if (level >= 4) {
    return 'rgba(22,163,74,0.16)'
  }

  if (level === 3) {
    return 'rgba(77,124,255,0.16)'
  }

  if (level === 2) {
    return 'rgba(245,158,11,0.15)'
  }

  if (level === 1) {
    return 'rgba(244,63,94,0.11)'
  }

  return 'rgba(148,163,184,0.1)'
}

function getCompareLabel(filters: ProtoFilterState) {
  const range = filters.compareRanges[0]

  if (!range) {
    return 'Сравнение: mock-период не выбран'
  }

  return `Сравнение: ${formatFilterDate(range.start)} - ${formatFilterDate(range.end)}`
}

function getCompareRangeLabel(filters: ProtoFilterState) {
  const range = filters.compareRanges[0]

  if (!range) {
    return '01.02.26 - 28.02.26'
  }

  return `${formatFilterDate(range.start)} - ${formatFilterDate(range.end)}`
}

function getFilterScopeLabel(filters: ProtoFilterState) {
  const managers = filters.managers.length === 0 ? 'все менеджеры' : `${filters.managers.length} менедж.`
  const sources = filters.sources.length === 0 ? 'все источники' : `${filters.sources.length} источн.`

  return `Срез: ${managers} / ${sources}`
}

function summarizeFilterSelection(
  selected: string[],
  options: PickerOption[],
  fallback: string,
) {
  if (selected.length === 0) {
    return fallback
  }

  const labels = options
    .filter((option) => selected.includes(option.id))
    .map((option) => option.label)

  return labels.length <= 2 ? labels.join(', ') : `${labels.length} выбрано`
}

function getStageDelta(level: number) {
  if (level >= 5) {
    return '+18%'
  }
  if (level === 4) {
    return '+11%'
  }
  if (level === 3) {
    return '+6%'
  }
  if (level === 2) {
    return '-3%'
  }

  return '-8%'
}

function getDeltaTone(value: string): Tone {
  if (value.startsWith('+')) {
    return 'positive'
  }
  if (value.startsWith('-')) {
    return 'negative'
  }

  return 'neutral'
}

function DeltaPill({ value }: { value: string }) {
  const tone = getDeltaTone(value)

  return (
    <span
      className={
        tone === 'positive'
          ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-700'
          : tone === 'negative'
            ? 'rounded-full bg-rose-50 px-2 py-0.5 text-[0.68rem] font-bold text-rose-700'
            : 'rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-bold text-slate-600'
      }
    >
      {value}
    </span>
  )
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function FunnelTocChart({
  current,
  compare,
  currentLabel,
  compareLabel,
}: {
  current: FlowStageMetric[]
  compare: FlowStageMetric[]
  currentLabel: string
  compareLabel: string
}) {
  const [hovered, setHovered] = useState<{
    x: number
    y: number
    title: string
    rows: string[]
  } | null>(null)
  const width = 920
  const height = 336
  const margin = { top: 28, right: 56, bottom: 92, left: 56 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const stageCount = current.length
  const slot = plotWidth / stageCount
  const barWidth = Math.min(22, slot * 0.2)
  const hasCompare = compare.length > 0
  const maxThroughput = Math.max(...current.map((stage) => stage.throughputPerDay), ...compare.map((stage) => stage.throughputPerDay), 1)
  const maxQueue = Math.max(...current.map((stage) => stage.queueEnd), ...compare.map((stage) => stage.queueEnd), 1)
  const throughputTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round(maxThroughput * step))
  const queueTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round(maxQueue * step))

  const barTop = (value: number) => margin.top + plotHeight - (value / maxThroughput) * plotHeight
  const lineY = (value: number) => margin.top + plotHeight - (value / maxQueue) * plotHeight

  const currentLinePoints = current.map((stage, index) => ({
    x: margin.left + slot * index + slot * 0.5,
    y: lineY(stage.queueEnd),
  }))

  const compareLinePoints = compare.map((stage, index) => ({
    x: margin.left + slot * index + slot * 0.5,
    y: lineY(stage.queueEnd),
  }))
  return (
    <section
      className="panel relative p-4"
      data-comment-block-id="attraction-funnel-flow"
      data-comment-block-label="Привлечение: поток стадий"
      id="attraction-funnel-flow"
      onMouseLeave={() => setHovered(null)}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Пропускная способность и очереди
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            ПС/день показывает, сколько сделок этап реально проводит дальше. Очередь показывает, сколько осталось на этапе к концу периода.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="inline-flex h-4 w-3 rounded-[4px] bg-slate-900" />
            Текущий ПС
          </span>
          {hasCompare ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
              <span className="inline-flex h-4 w-3 rounded-[4px] bg-[rgba(77,124,255,0.18)] ring-1 ring-inset ring-blue-200" />
              ПС сравнение
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="relative inline-flex h-4 w-8 items-center">
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-blue-600" />
            </span>
            Очередь текущая
          </span>
          {hasCompare ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
              <span className="relative inline-flex h-4 w-8 items-center">
                <span
                  className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #93c5fd 60%, transparent 60%)',
                    backgroundSize: '10px 3px',
                    backgroundRepeat: 'repeat-x',
                  }}
                />
              </span>
              Очередь сравнение
            </span>
          ) : null}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full">
        {throughputTicks.map((tick, index) => {
          const y = margin.top + (plotHeight / (throughputTicks.length - 1)) * index

          return (
            <g key={`grid-${index}-${tick}`}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {formatNumber(throughputTicks[throughputTicks.length - 1 - index] ?? 0)}
              </text>
              <text x={width - margin.right + 10} y={y + 4} fontSize="11" fill="#64748b">
                {formatNumber(queueTicks[queueTicks.length - 1 - index] ?? 0)}
              </text>
            </g>
          )
        })}

        {current.map((stage, index) => {
          const baseX = margin.left + slot * index
          const currentBarX = hasCompare
            ? baseX + slot * 0.24
            : baseX + slot * 0.5 - barWidth * 0.5
          const compareBarX = currentBarX + barWidth + 6

          return (
            <g key={stage.stage}>
              {hasCompare ? (
                <rect
                  x={compareBarX}
                  y={barTop(compare[index]?.throughputPerDay ?? 0)}
                  width={barWidth}
                  height={margin.top + plotHeight - barTop(compare[index]?.throughputPerDay ?? 0)}
                  rx={8}
                  fill="rgba(77,124,255,0.18)"
                  data-testid={`toc-compare-bar-${index}`}
                  onMouseEnter={() =>
                    setHovered({
                      x: compareBarX + barWidth * 0.5,
                      y: barTop(compare[index]?.throughputPerDay ?? 0),
                      title: stage.stage,
                      rows: [
                        `${compareLabel}: ПС ${formatNumber(compare[index]?.throughputPerDay ?? 0)} / день`,
                        `${compareLabel}: очередь ${formatNumber(compare[index]?.queueEnd ?? 0)}`,
                      ],
                    })
                  }
                />
              ) : null}
              <rect
                x={currentBarX}
                y={barTop(stage.throughputPerDay)}
                width={barWidth}
                height={margin.top + plotHeight - barTop(stage.throughputPerDay)}
                rx={8}
                fill="#0f172a"
                data-testid={`toc-current-bar-${index}`}
                onMouseEnter={() =>
                  setHovered({
                    x: currentBarX + barWidth * 0.5,
                    y: barTop(stage.throughputPerDay),
                    title: stage.stage,
                    rows: [
                      `${currentLabel}: ПС ${formatNumber(stage.throughputPerDay)} / день`,
                      `${currentLabel}: очередь ${formatNumber(stage.queueEnd)}`,
                      `Буфер: ${queueBufferDays(stage.queueEnd, stage.throughputPerDay)?.toFixed(1) ?? '—'} дн.`,
                    ],
                  })
                }
              />
              <text
                x={baseX + slot * 0.5}
                y={height - margin.bottom + 24}
                transform={`rotate(20 ${baseX + slot * 0.5} ${height - margin.bottom + 24})`}
                fontSize="11"
                fill="#475569"
              >
                {stage.stage}
              </text>
            </g>
          )
        })}

        {hasCompare ? (
          <path d={buildLinePath(compareLinePoints)} fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeDasharray="8 6" />
        ) : null}
        <path d={buildLinePath(currentLinePoints)} fill="none" stroke="#2563eb" strokeWidth="3" />

        {hasCompare ? compareLinePoints.map((point, index) => (
          <circle
            key={`compare-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={5}
            fill="#93c5fd"
            data-testid={`toc-compare-point-${index}`}
            onMouseEnter={() =>
              setHovered({
                x: point.x,
                y: point.y,
                title: compare[index]?.stage ?? '',
                rows: [
                  `${compareLabel}: очередь ${formatNumber(compare[index]?.queueEnd ?? 0)}`,
                  `${compareLabel}: ПС ${formatNumber(compare[index]?.throughputPerDay ?? 0)} / день`,
                ],
              })
            }
          />
        )) : null}
        {currentLinePoints.map((point, index) => (
          <circle
            key={`current-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={5.5}
            fill="#2563eb"
            data-testid={`toc-current-point-${index}`}
            onMouseEnter={() =>
              setHovered({
                x: point.x,
                y: point.y,
                title: current[index]?.stage ?? '',
                rows: [
                  `${currentLabel}: очередь ${formatNumber(current[index]?.queueEnd ?? 0)}`,
                  `${currentLabel}: ПС ${formatNumber(current[index]?.throughputPerDay ?? 0)} / день`,
                  `Буфер: ${queueBufferDays(current[index]?.queueEnd ?? 0, current[index]?.throughputPerDay ?? 0)?.toFixed(1) ?? '—'} дн.`,
                ],
              })
            }
          />
        ))}

        <text x={margin.left} y={16} fontSize="11" fill="#64748b">ПС/день</text>
        <text x={width - margin.right + 8} y={16} fontSize="11" fill="#64748b">Очередь</text>
      </svg>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <div className="subtle-label">ПС/день</div>
          <div className="mt-1 text-sm text-slate-600">Сколько сделок этап проводит дальше за 1 рабочий день.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <div className="subtle-label">Очередь</div>
          <div className="mt-1 text-sm text-slate-600">Сколько сделок осталось на этапе к концу выбранного периода.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <div className="subtle-label">Буфер очереди</div>
          <div className="mt-1 text-sm text-slate-600">Очередь / ПС в днях. Вынесен ниже по каждому этапу, а в hover виден в контексте точки.</div>
        </div>
      </div>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-20 min-w-[220px] rounded-2xl border border-slate-200 bg-white/96 px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${(hovered.y / height) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 14px))',
          }}
        >
          <div className="text-sm font-semibold text-slate-900">{hovered.title}</div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {hovered.rows.map((row) => (
              <div key={row}>{row}</div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function PanelHeading({
  id,
  title,
  description,
  hint,
  right,
}: {
  id?: string
  title: string
  description?: string
  hint?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 id={id} className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
          {hint ? <CalculationHint text={hint} /> : null}
        </div>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {right}
    </div>
  )
}

function CalculationHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Как считается: ${text}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
      >
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-60 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold leading-relaxed text-slate-600 shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  )
}

function formatSalesDays(value: number) {
  return `${formatInteger(value)} д`
}

function formatOneDecimal(value: number) {
  return Number(value).toFixed(1).replace('.', ',')
}

function formatSalesHours(value: number) {
  return `${formatInteger(value)} ч`
}

function formatMeetingCount(value: number) {
  return `${formatInteger(value)} встреч`
}

function formatRatioPercent(value: number) {
  return `${formatPercent((value ?? 0) * 100)}%`
}

function resolveDealAttractionRevenue(deal: SalesDealRow) {
  return deal.attractionRevenueAmount ?? deal.amount
}

function resolveDealMembershipAmount(deal: SalesDealRow) {
  return Number.isFinite(deal.membershipAmount) ? deal.membershipAmount : deal.amount
}

function formatPricingStatus(value: SalesDealRow['pricingStatus']) {
  if (value === 'missingContractFields') {
    return 'нет договорных полей'
  }

  if (value === 'missingPricingRule') {
    return 'нет правила цены'
  }

  if (value === 'conflict') {
    return 'конфликт'
  }

  return 'рассчитано'
}

function formatCompareDelta(current: number, previous: number, kind: 'count' | 'amount' | 'rate' | 'days' = 'count') {
  if (!Number.isFinite(previous)) {
    return '—'
  }

  if (kind === 'rate') {
    return `${formatSignedNumber((current - previous) * 100)} п.п.`
  }

  if (kind === 'days') {
    return `${formatSignedNumber(current - previous)} дн.`
  }

  if (kind === 'amount') {
    return formatSignedNumber(current - previous)
  }

  return formatSignedNumber(current - previous)
}

type StageMeetingBadge = {
  key: string
  dateValue: string
  slotIndex: 1 | 2 | 3 | null
  typeValue: string | null
  placeValue: string | null
}

type MeetingDateTimelineResolution =
  | { kind: 'badge'; stageIndex: number }
  | { kind: 'beforeTimeline' }
  | { kind: 'none' }

function parseTimelineTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function getTimelineCalendarKey(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  const isoDateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  if (isoDateMatch) {
    return isoDateMatch[1] ?? null
  }

  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type DealTimelineStageForUi = DealStageTimelineEntry | DealLifecycleStageTimelineEntry
type DealDetailForUi = SalesDealRow | ManagerActionOutcomeDealDetail

function isSalesDealRow(deal: DealDetailForUi): deal is SalesDealRow {
  return 'pricingStatus' in deal
}

function isDateInsideStageInterval(
  stage: DealTimelineStageForUi,
  dateValue: string | null | undefined,
  isLastStage: boolean,
) {
  const meetingAt = parseTimelineTimestamp(dateValue)
  const enteredAt = parseTimelineTimestamp(stage.enteredAt)
  const leftAt = parseTimelineTimestamp(stage.leftAt)

  if (meetingAt === null || enteredAt === null || leftAt === null) {
    return false
  }

  return meetingAt >= enteredAt && (isLastStage ? meetingAt <= leftAt : meetingAt < leftAt)
}

function resolveMeetingDateTimeline(
  stageTimeline: DealTimelineStageForUi[],
  meetingDateValue: string | null | undefined,
  dealCreatedAt?: string | null,
): MeetingDateTimelineResolution {
  const meetingAt = parseTimelineTimestamp(meetingDateValue)

  if (meetingAt === null) {
    return { kind: 'none' }
  }

  const meetingDay = getTimelineCalendarKey(meetingDateValue)
  const createdDay = getTimelineCalendarKey(dealCreatedAt)
  const firstStageEnteredDay = getTimelineCalendarKey(stageTimeline[0]?.enteredAt)

  if (
    (meetingDay !== null && createdDay !== null && meetingDay < createdDay) ||
    (meetingDay !== null &&
      firstStageEnteredDay !== null &&
      meetingDay < firstStageEnteredDay)
  ) {
    return { kind: 'beforeTimeline' }
  }

  const stageIndex = stageTimeline.findIndex((stage, index) =>
    isDateInsideStageInterval(stage, meetingDateValue, index === stageTimeline.length - 1),
  )

  return stageIndex === -1 ? { kind: 'none' } : { kind: 'badge', stageIndex }
}

function getStageMeetingBadges(
  stage: DealTimelineStageForUi,
  meetingDateValue: string | null | undefined,
  includeMeetingDateFallback: boolean,
) {
  const badges: StageMeetingBadge[] = (stage.meetingEvents ?? []).map((meeting) => ({
    key: meeting.activityId,
    dateValue: meeting.timelineAt,
    slotIndex: meeting.slotIndex ?? null,
    typeValue: meeting.typeValue ?? null,
    placeValue: meeting.placeValue ?? null,
  }))
  const renderedDates = new Set(badges.map((badge) => formatShortDate(badge.dateValue)))

  if (meetingDateValue && includeMeetingDateFallback) {
    const fallbackDate = formatShortDate(meetingDateValue)

    if (!renderedDates.has(fallbackDate)) {
      badges.push({
        key: `meeting-date-${stage.stageId}-${meetingDateValue}`,
        dateValue: meetingDateValue,
        slotIndex: null,
        typeValue: null,
        placeValue: null,
      })
    }
  }

  return badges
}

function formatStageMeetingBadgeLabel(meeting: StageMeetingBadge) {
  const title =
    meeting.slotIndex && meeting.slotIndex > 1 ? `Встреча ${meeting.slotIndex}` : 'Встреча'
  const detailParts = [meeting.typeValue, meeting.placeValue].filter(
    (part): part is string => Boolean(part?.trim()),
  )
  const baseLabel = `${title} ${formatShortDate(meeting.dateValue)}`

  return detailParts.length > 0 ? `${baseLabel} · ${detailParts.join(' · ')}` : baseLabel
}

function normalizeMeetingSlotToneIndex(slotIndex: 1 | 2 | 3 | null | undefined): 1 | 2 | 3 {
  return slotIndex ?? 1
}

function getStageMeetingBadgeClass(slotIndex: 1 | 2 | 3 | null | undefined) {
  const baseClass =
    'inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full border bg-white px-2 py-1 text-[11px] font-semibold leading-tight shadow-[0_1px_0_rgba(15,23,42,0.03)]'

  switch (normalizeMeetingSlotToneIndex(slotIndex)) {
    case 2:
      return `${baseClass} border-violet-100 text-violet-700`
    case 3:
      return `${baseClass} border-rose-100 text-rose-700`
    default:
      return `${baseClass} border-amber-100 text-amber-700`
  }
}

function hasStageCallSummary(summary: DealStageTimelineEntry['callSummary']) {
  return Boolean(
    summary &&
      (summary.total > 0 ||
        summary.incoming > 0 ||
        summary.outgoing > 0 ||
        summary.successful > 0 ||
        summary.failed > 0 ||
        summary.connectedOverThirtySeconds > 0),
  )
}

function hasStageTaskSummary(summary: DealStageTimelineEntry['taskSummary']) {
  return Boolean(summary && (summary.created > 0 || summary.closed > 0))
}

function getStageTimelineEvents(stage: DealTimelineStageForUi): DealTimelineEvent[] {
  return 'events' in stage ? stage.events : []
}

function formatTimelineEventLabel(event: DealTimelineEvent) {
  if (event.badgeLabel) {
    return event.badgeLabel
  }

  return event.detail ? `${event.title} · ${event.detail}` : event.title
}

function getTimelineEventBadgeClass(kind: DealTimelineEvent['kind']) {
  if (kind === 'call') {
    return 'inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold leading-tight text-sky-800 ring-1 ring-sky-100'
  }

  if (kind === 'task_created' || kind === 'task_completed') {
    return 'inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold leading-tight text-emerald-800 ring-1 ring-emerald-100'
  }

  if (kind === 'meeting' || kind === 'meeting_date_changed') {
    return 'inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold leading-tight text-amber-800'
  }

  return 'inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold leading-tight text-violet-800 ring-1 ring-violet-100'
}

function StageTimelineInteractionBadges({
  stage,
  meetingBadges,
}: {
  stage: DealTimelineStageForUi
  meetingBadges: StageMeetingBadge[]
}) {
  const callSummary = stage.callSummary
  const taskSummary = stage.taskSummary
  const conversionEventBadges = getStageTimelineEvents(stage).filter(
    (event) => event.kind === 'conversion_event_visit',
  )
  const hasLifecycleEventSlot = 'events' in stage
  const showCalls = hasStageCallSummary(callSummary)
  const showTasks = hasStageTaskSummary(taskSummary)

  return (
    <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
      {meetingBadges.map((meeting) => (
        <span
          key={meeting.key}
          data-meeting-slot-index={normalizeMeetingSlotToneIndex(meeting.slotIndex)}
          className={getStageMeetingBadgeClass(meeting.slotIndex)}
        >
          {formatStageMeetingBadgeLabel(meeting)}
        </span>
      ))}
      {showCalls && callSummary ? (
        <span className="inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold leading-tight text-sky-800 ring-1 ring-sky-100">
          Звонки {formatInteger(callSummary.total)} · {formatInteger(callSummary.incoming)} вход. ·{' '}
          {formatInteger(callSummary.outgoing)} исход. ·{' '}
          {formatInteger(callSummary.connectedOverThirtySeconds)} &gt;30с
        </span>
      ) : null}
      {showTasks && taskSummary ? (
        <span className="inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold leading-tight text-emerald-800 ring-1 ring-emerald-100">
          Дела {formatInteger(taskSummary.created)} / {formatInteger(taskSummary.closed)}
        </span>
      ) : null}
      {conversionEventBadges.map((event) => (
        <span key={event.id} className={getTimelineEventBadgeClass(event.kind)}>
          {formatTimelineEventLabel(event)}
        </span>
      ))}
      {!hasLifecycleEventSlot ? (
        <>
          <span className="inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold leading-tight text-slate-400">
            Мероприятия недоступны
          </span>
          <span className="inline-flex min-w-0 max-w-full items-center whitespace-normal break-words rounded-full border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold leading-tight text-slate-400">
            Сообщения недоступны
          </span>
        </>
      ) : null}
    </div>
  )
}

function getDealDetailFields(deal: DealDetailForUi, businessClubLabel: string) {
  const lifecycleCard = deal.lifecycleCard
  const meetingDateValue = lifecycleCard?.meetingDateValue ?? deal.meetingDateValue

  return [
    { label: 'Итоговое качество', value: lifecycleCard?.qualityValue ?? deal.qualityValue ?? '—' },
    { label: 'Источник', value: lifecycleCard?.sourceLabel ?? deal.sourceLabel ?? '—' },
    { label: businessClubLabel, value: lifecycleCard?.businessClubValue ?? deal.businessClubValue ?? '—' },
    { label: 'Таргет-группа', value: lifecycleCard?.targetGroupValue ?? deal.targetGroupValue ?? '—' },
    { label: 'Тип встречи', value: lifecycleCard?.meetingTypeValue ?? deal.meetingTypeValue ?? '—' },
    { label: 'Дата встречи', value: meetingDateValue ? formatShortDate(meetingDateValue) : '—' },
    { label: 'Тариф', value: lifecycleCard?.tariffValue ?? deal.tariffValue ?? '—' },
  ]
}

function getDealEventSummary(deal: DealDetailForUi): DealEventSummary {
  return (
    deal.lifecycleCard?.eventSummary ?? {
      callSummary: deal.callSummary,
      taskSummary: deal.taskSummary,
      meetingSummary: deal.meetingSummary ?? { total: 0 },
      conversionEventVisits: 0,
    }
  )
}

function formatNullableAmount(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : formatAmount(value)
}

function resolveDealProfitAmount(deal: SalesDealRow) {
  const value = deal.lifecycleCard?.economics.fullyLoadedMarginAmount
  return value === null || value === undefined || !Number.isFinite(value) ? null : value
}

function getProfitAmountClass(value: number | null) {
  if (value === null) {
    return 'text-slate-400'
  }

  if (value < 0) {
    return 'text-rose-700'
  }

  if (value > 0) {
    return 'text-emerald-700'
  }

  return 'text-slate-950'
}

function formatExpenseAmount(value: number) {
  return value === 0 ? formatAmount(value) : `-${formatAmount(Math.abs(value))}`
}

function DealEconomicsPanel({
  deal,
  surfaceClass,
}: {
  deal: DealDetailForUi
  surfaceClass: string
}) {
  const economics: DealSaleEconomics | undefined = deal.lifecycleCard?.economics

  if (economics) {
    const costRows = [
      ...economics.costRows,
      ...economics.allocatedFixedCostRows,
    ]

    return (
      <div className={`rounded-xl border border-slate-200 ${surfaceClass} p-4`}>
        <div className="subtle-label">Экономика</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="subtle-label">Доход Привлечения</div>
            <div className="mt-1 text-lg font-bold text-slate-950">
              {formatNullableAmount(economics.attractionRevenueAmount)}
            </div>
          </div>
          <div>
            <div className="subtle-label">Стоимость членства</div>
            <div className="mt-1 text-lg font-bold text-slate-950">
              {formatAmount(economics.membershipAmount)}
            </div>
          </div>
          <div>
            <div className="subtle-label">Маржинальная себестоимость</div>
            <div className="mt-1 text-lg font-bold text-rose-700">
              {formatExpenseAmount(economics.saleCostAmount)}
            </div>
          </div>
          <div>
            <div className="subtle-label">Маржинальный результат</div>
            <div className="mt-1 text-lg font-bold text-slate-950">
              {formatNullableAmount(economics.marginAmount)}
            </div>
          </div>
          <div>
            <div className="subtle-label">Доля постоянных</div>
            <div className="mt-1 text-lg font-bold text-rose-700">
              {formatExpenseAmount(economics.allocatedFixedCostAmount)}
            </div>
          </div>
          <div>
            <div className="subtle-label">Полная себестоимость</div>
            <div className="mt-1 text-lg font-bold text-rose-700">
              {formatExpenseAmount(economics.fullyLoadedCostAmount)}
            </div>
          </div>
          <div>
            <div className="subtle-label">Полный результат</div>
            <div className="mt-1 text-lg font-bold text-slate-950">
              {formatNullableAmount(economics.fullyLoadedMarginAmount)}
            </div>
          </div>
        </div>
        {costRows.length > 0 ? (
          <div className="mt-3 space-y-2">
            {costRows.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{row.label}</span>
                  <span className="text-sm font-bold text-rose-700">
                    {formatExpenseAmount(row.amount)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">{row.basis}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (!isSalesDealRow(deal)) {
    return null
  }

  return (
    <div className={`rounded-xl border border-slate-200 ${surfaceClass} p-4`}>
      <div className="subtle-label">Экономика</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="subtle-label">Доход Привлечения</div>
          <div className="mt-1 text-lg font-bold text-slate-950">
            {formatAmount(resolveDealAttractionRevenue(deal))}
          </div>
        </div>
        <div>
          <div className="subtle-label">Стоимость членства</div>
          <div className="mt-1 text-lg font-bold text-slate-950">
            {formatAmount(resolveDealMembershipAmount(deal))}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs font-medium text-slate-500">
        {formatPricingStatus(deal.pricingStatus)}
      </div>
      {(deal.pricingWarnings?.length ?? 0) > 0 ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {deal.pricingWarnings?.[0]}
        </div>
      ) : null}
    </div>
  )
}

function DealAttributesPanel({
  title,
  fields,
  surfaceClass,
}: {
  title: string
  fields: Array<{ label: string; value: string }>
  surfaceClass: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 ${surfaceClass} p-4`}>
      <div className="subtle-label">{title}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="subtle-label">{field.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{field.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DealCohortPanel({
  cohortContext,
  surfaceClass,
}: {
  cohortContext: SalesDealRow['cohortContext']
  surfaceClass: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 ${surfaceClass} p-4`}>
      <div className="subtle-label">Когорта {cohortContext.createdMonth || '—'}</div>
      <div className="mt-2 text-sm text-slate-700">
        <strong className="text-slate-950">
          {formatInteger(cohortContext.cohortCreatedDeals)}
        </strong>{' '}
        создано в месяце сделки
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {formatInteger(cohortContext.cohortWonDeals)} выиграно ·{' '}
        {formatPercent(cohortContext.cohortWonConversionRate)}% конверсия
      </div>
    </div>
  )
}

function DealActivitySummaryPanel({
  summary,
  surfaceClass,
}: {
  summary: DealEventSummary
  surfaceClass: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 ${surfaceClass} p-4`}>
      <div className="subtle-label">Дела, звонки и встречи</div>
      <div className="mt-2 text-sm text-slate-700">
        <strong className="text-slate-950">{formatInteger(summary.taskSummary.created)}</strong>{' '}
        создано дел · {formatInteger(summary.taskSummary.closed)} закрыто
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {formatInteger(summary.callSummary.incoming)} вход. ·{' '}
        {formatInteger(summary.callSummary.outgoing)} исход. ·{' '}
        {formatInteger(summary.callSummary.connectedOverThirtySeconds)} успешных &gt;30 сек
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {formatMeetingCount(summary.meetingSummary.total)}
        {summary.conversionEventVisits > 0
          ? ` · ${formatInteger(summary.conversionEventVisits)} участий в мероприятиях`
          : ''}
      </div>
    </div>
  )
}

function DealSlaPanel({
  sla,
  surfaceClass,
}: {
  sla: ManagerActionOutcomeDealDetail['sla']
  surfaceClass: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 ${surfaceClass} p-4`}>
      <div className="subtle-label">SLA по сделке</div>
      <div className="mt-3 grid gap-2 text-sm text-slate-700">
        <div>1: {formatDealSlaStatus(sla.sla1)}</div>
        <div>2: {formatDealSlaStatus(sla.sla2)}</div>
        <div>3: {formatDealSlaStatus(sla.sla3)}</div>
      </div>
    </div>
  )
}

function DealStageTimelinePanel({
  dealId,
  stageTimeline,
  meetingDateValue,
  dateCreate,
  surfaceClass,
}: {
  dealId: string
  stageTimeline: DealTimelineStageForUi[]
  meetingDateValue: string | null | undefined
  dateCreate: string
  surfaceClass: string
}) {
  const meetingDateResolution = resolveMeetingDateTimeline(
    stageTimeline,
    meetingDateValue,
    dateCreate,
  )

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 ${surfaceClass}`}>
      <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 sm:grid">
        <span>Этап</span>
        <span>Вход</span>
        <span className="text-right">Время</span>
      </div>
      <div className="divide-y divide-slate-100">
        {meetingDateResolution.kind === 'beforeTimeline' ? (
          <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-2 text-xs font-semibold text-amber-800">
            Дата встречи раньше создания сделки
          </div>
        ) : null}
        {stageTimeline.length > 0 ? (
          stageTimeline.map((stage, stageIndex) => {
            const meetingBadges = getStageMeetingBadges(
              stage,
              meetingDateValue,
              meetingDateResolution.kind === 'badge' &&
                stageIndex === meetingDateResolution.stageIndex,
            )

            return (
              <div
                key={`${dealId}-${stage.stageId}-${stage.enteredAt}`}
                data-stage-timeline-row
                className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_6rem] sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{stage.stageName}</div>
                  <StageTimelineInteractionBadges
                    stage={stage}
                    meetingBadges={meetingBadges}
                  />
                  <div className="truncate text-xs text-slate-500">
                    до {formatShortDate(stage.leftAt)}
                  </div>
                </div>
                <span className="text-slate-500">{formatShortDate(stage.enteredAt)}</span>
                <span className="text-left font-semibold text-slate-900 sm:text-right">
                  {formatSalesHours(stage.durationHours)}
                </span>
              </div>
            )
          })
        ) : (
          <div className="px-4 py-5 text-sm text-slate-500">
            История этапов по сделке пока не подтянута.
          </div>
        )}
      </div>
    </div>
  )
}

function DealLifecycleDetails({
  deal,
  variant,
}: {
  deal: DealDetailForUi
  variant: 'sales' | 'managerAction'
}) {
  const lifecycleCard = deal.lifecycleCard
  const surfaceClass = variant === 'managerAction' ? 'bg-white/80' : 'bg-white/75'
  const stageTimeline = lifecycleCard?.stageTimeline ?? deal.stageTimeline
  const meetingDateValue = lifecycleCard?.meetingDateValue ?? deal.meetingDateValue
  const dateCreate = lifecycleCard?.dateCreate ?? deal.dateCreate
  const eventSummary = getDealEventSummary(deal)
  const cohortContext = lifecycleCard?.cohortContext ?? (isSalesDealRow(deal) ? deal.cohortContext : undefined)
  const sla = lifecycleCard?.sla ?? (isSalesDealRow(deal) ? undefined : deal.sla)

  return (
    <div className={`${variant === 'managerAction' ? 'mt-3' : 'mt-4'} grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <DealEconomicsPanel deal={deal} surfaceClass={surfaceClass} />
        <DealAttributesPanel
          title={variant === 'managerAction' ? 'Атрибуты сделки' : 'Атрибуты продажи'}
          fields={getDealDetailFields(
            deal,
            variant === 'managerAction' ? 'Бизнес-клуб заказчика' : 'Business club',
          )}
          surfaceClass={surfaceClass}
        />
        {cohortContext ? <DealCohortPanel cohortContext={cohortContext} surfaceClass={surfaceClass} /> : null}
        <DealActivitySummaryPanel summary={eventSummary} surfaceClass={surfaceClass} />
        {sla ? <DealSlaPanel sla={sla} surfaceClass={surfaceClass} /> : null}
      </div>

      <DealStageTimelinePanel
        dealId={deal.dealId}
        stageTimeline={stageTimeline}
        meetingDateValue={meetingDateValue}
        dateCreate={dateCreate}
        surfaceClass={surfaceClass}
      />
    </div>
  )
}

function SalesDealDetails({ deal }: { deal: SalesDealRow }) {
  return <DealLifecycleDetails deal={deal} variant="sales" />
}

function SalesManagerBlock({
  group,
  expandedDeals,
  onToggleDeal,
}: {
  group: SalesManagerGroup
  expandedDeals: Set<string>
  onToggleDeal: (dealId: string) => void
}) {
  const totalAttractionRevenue = Number.isFinite(group.totalAttractionRevenueAmount)
    ? group.totalAttractionRevenueAmount
    : group.totalSalesAmount
  const totalMembershipAmount = Number.isFinite(group.totalMembershipAmount)
    ? group.totalMembershipAmount
    : group.totalSalesAmount

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div>
          <h4 className="text-base font-bold text-slate-950">{group.managerName}</h4>
          <p className="text-sm text-slate-500">
            {formatInteger(group.totalWonDeals)} продаж · {formatAmount(totalAttractionRevenue)} доход
          </p>
          <p className="text-xs text-slate-500">
            {formatAmount(totalMembershipAmount)} стоимость членства
          </p>
        </div>
        <span className="badge-chip badge-neutral">
          средний доход{' '}
          {formatAmount(group.totalWonDeals === 0 ? 0 : totalAttractionRevenue / group.totalWonDeals)}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {group.deals.map((deal) => {
          const isExpanded = expandedDeals.has(deal.dealId)
          const profitAmount = resolveDealProfitAmount(deal)

          return (
            <article key={deal.dealId} className="px-4 py-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(12rem,1.1fr)_7rem_7rem_7rem_6rem_8rem_11rem_7rem_auto] xl:items-center">
                <div className="min-w-0">
                  <h5 className="truncate text-base font-bold text-slate-950">{deal.dealId}</h5>
                  <p className="text-sm text-slate-500">
                    Передана {formatShortDate(deal.dateClosed)} · создана{' '}
                    {formatShortDate(deal.dateCreate)}
                  </p>
                </div>

                <div>
                  <div className="subtle-label">Доход</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {formatAmount(resolveDealAttractionRevenue(deal))}
                  </div>
                </div>

                <div>
                  <div className="subtle-label">Прибыль</div>
                  <div className={`mt-1 font-bold ${getProfitAmountClass(profitAmount)}`}>
                    {formatNullableAmount(profitAmount)}
                  </div>
                </div>

                <div>
                  <div className="subtle-label">Членство</div>
                  <div className="mt-1 font-bold text-slate-950">{formatAmount(resolveDealMembershipAmount(deal))}</div>
                </div>

                <div>
                  <div className="subtle-label">Цикл</div>
                  <div className="mt-1 font-bold text-slate-950">{formatSalesDays(deal.cycleDays)}</div>
                </div>

                <div>
                  <div className="subtle-label">Когорта</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {deal.cohortContext.createdMonth || '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(deal.cohortContext.cohortWonConversionRate)}% win
                  </div>
                </div>

                <div>
                  <div className="subtle-label">Звонки</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {formatInteger(deal.callSummary.total)} всего
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatInteger(deal.callSummary.successful)} успешных ·{' '}
                    {formatInteger(deal.callSummary.failed)} недозвона
                  </div>
                </div>

                <div>
                  <div className="subtle-label">Дела</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {formatInteger(deal.taskSummary.created)} / {formatInteger(deal.taskSummary.closed)}
                  </div>
                  <div className="text-xs text-slate-500">создано / закрыто</div>
                </div>

                <button
                  type="button"
                  className={isExpanded ? 'btn btn-dark' : 'btn btn-ghost'}
                  onClick={() => onToggleDeal(deal.dealId)}
                >
                  Подробнее
                </button>
              </div>

              {isExpanded ? <SalesDealDetails deal={deal} /> : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function SalesManagersReport({
  dashboard,
  status,
  error,
}: {
  dashboard: DashboardData | undefined
  status: NonNullable<SceneComponentProps['runtimeData']>['operationalStatus'] | undefined
  error?: string | null | undefined
}) {
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(() => new Set())
  const groups = dashboard?.managerGroups ?? []
  const salesSummary = dashboard?.salesSummary
  const totalDeals = salesSummary?.salesCount ?? groups.reduce((total, group) => total + group.totalWonDeals, 0)

  function toggleDeal(dealId: string) {
    setExpandedDeals((current) => {
      const next = new Set(current)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }

      return next
    })
  }

  return (
    <section className="panel p-5" aria-labelledby="sales-by-manager-title">
      <PanelHeading
        id="sales-by-manager-title"
        title="Продажи по менеджерам"
        description="Каждая строка - отдельная выигранная сделка с экономикой, циклом, когортой, звонками, делами и историей этапов."
        right={<span className="badge-chip badge-neutral">{formatInteger(totalDeals)} продаж</span>}
      />

      {status === 'loading' && !dashboard ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
          Загружаю продажи из локальной базы.
        </div>
      ) : status === 'error' ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800"
        >
          {error ?? 'Не удалось загрузить продажи из локальной базы.'}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
          В выбранном периоде нет выигранных сделок.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <SalesManagerBlock
              key={group.managerId}
              group={group}
              expandedDeals={expandedDeals}
              onToggleDeal={toggleDeal}
            />
          ))}
        </div>
      )}
    </section>
  )
}

type SalesPlanFactRow = {
  key: string
  managerId: string
  managerName: string
  targetGroupKey: string
  targetGroupLabel: string
  plannedDeals: number
  plannedAmount: number
  actualDeals: number
  actualAmount: number
}

type EditableSalesPlanMonth = {
  month: string
  label: string
  plannedDeals: number
  plannedAmount: number
}

type EditableSalesPlanRow = {
  localId: string
  managerId: string
  managerName?: string | null
  targetGroupKey: string
  targetGroupLabel?: string | null
  quarterPlannedDeals: number
  quarterPlannedAmount: number
  months: EditableSalesPlanMonth[]
}

const SALES_PLAN_AMOUNT_UNIT = 1_000_000

const defaultSalesPlanTargetGroups = [
  'ClubFirst Russia',
  'ClubFirst Future',
  'ClubFirst One',
  'ClubFirst Guest',
  'ClubFirst Ladies',
  'ClubFirst GlobAll',
  'ClubFirst Kazakstan',
  'Атланты',
  'Маркетплейсы',
  'CTU',
].map((label) => ({ key: label, label }))

function addSalesPlanTargetGroupOption(
  options: Map<string, string>,
  key: string | null | undefined,
  label = key,
) {
  const normalizedKey = key?.trim()
  const normalizedLabel = label?.trim()
  if (!normalizedKey || !normalizedLabel) {
    return
  }

  options.set(normalizedKey, normalizedLabel)
}

function resolveDealTargetGroup(deal: SalesDealRow) {
  const value = deal.targetGroupValue?.trim() || deal.businessClubValue?.trim()

  return {
    key: value || 'Без таргет-группы',
    label: value || 'Без таргет-группы',
  }
}

function buildSalesPlanFactRows(
  dashboard: DashboardData | undefined,
  salesPlan: SalesPlanData | undefined,
) {
  const rows = new Map<string, SalesPlanFactRow>()

  function getOrCreateRow(input: {
    managerId: string
    managerName: string
    targetGroupKey: string
    targetGroupLabel: string
  }) {
    const key = `${input.managerId}::${input.targetGroupKey}`
    const existing = rows.get(key)
    if (existing) {
      if (input.managerName && existing.managerName === input.managerId) {
        existing.managerName = input.managerName
      }
      if (input.targetGroupLabel && existing.targetGroupLabel === input.targetGroupKey) {
        existing.targetGroupLabel = input.targetGroupLabel
      }
      return existing
    }

    const row: SalesPlanFactRow = {
      key,
      managerId: input.managerId,
      managerName: input.managerName || input.managerId,
      targetGroupKey: input.targetGroupKey,
      targetGroupLabel: input.targetGroupLabel || input.targetGroupKey,
      plannedDeals: 0,
      plannedAmount: 0,
      actualDeals: 0,
      actualAmount: 0,
    }
    rows.set(key, row)
    return row
  }

  for (const planRow of salesPlan?.rows ?? []) {
    const row = getOrCreateRow({
      managerId: planRow.managerId,
      managerName: planRow.managerName ?? planRow.managerId,
      targetGroupKey: planRow.targetGroupKey,
      targetGroupLabel: planRow.targetGroupLabel,
    })
    row.plannedDeals += planRow.plannedDeals
    row.plannedAmount += planRow.plannedAmount
  }

  for (const group of dashboard?.managerGroups ?? []) {
    for (const deal of group.deals) {
      const targetGroup = resolveDealTargetGroup(deal)
      const row = getOrCreateRow({
        managerId: group.managerId,
        managerName: group.managerName,
        targetGroupKey: targetGroup.key,
        targetGroupLabel: targetGroup.label,
      })
      row.actualDeals += 1
      row.actualAmount += resolveDealAttractionRevenue(deal)
    }
  }

  return Array.from(rows.values()).sort((left, right) => {
    const byManager = left.managerName.localeCompare(right.managerName, 'ru-RU')
    return byManager !== 0
      ? byManager
      : left.targetGroupLabel.localeCompare(right.targetGroupLabel, 'ru-RU')
  })
}

function sumSalesPlanFactRows(rows: SalesPlanFactRow[]) {
  return rows.reduce(
    (total, row) => ({
      plannedDeals: total.plannedDeals + row.plannedDeals,
      plannedAmount: total.plannedAmount + row.plannedAmount,
      actualDeals: total.actualDeals + row.actualDeals,
      actualAmount: total.actualAmount + row.actualAmount,
    }),
    {
      plannedDeals: 0,
      plannedAmount: 0,
      actualDeals: 0,
      actualAmount: 0,
    },
  )
}

function formatPlanCompletion(actual: number, planned: number) {
  if (planned <= 0) {
    return actual > 0 ? 'вне плана' : '—'
  }

  return `${formatInteger(Math.round((actual / planned) * 100))}%`
}

function formatPlanCompletionNote(actual: number, planned: number) {
  return `${formatInteger(actual)} / ${formatInteger(planned)} продаж`
}

function getDashboardSalesCount(dashboard: DashboardData | undefined) {
  return (
    dashboard?.salesSummary?.salesCount ??
    dashboard?.managerGroups.reduce((total, group) => total + group.totalWonDeals, 0) ??
    0
  )
}

function sumSalesPlanDeals(salesPlan: SalesPlanData | undefined) {
  return (salesPlan?.rows ?? []).reduce((total, row) => total + row.plannedDeals, 0)
}

function sumQuarterSalesPlanDeals(salesPlan: SalesPlanQuarterData | undefined) {
  return (salesPlan?.rows ?? []).reduce((total, row) => total + row.quarterPlannedDeals, 0)
}

function SalesPlanFactSection({
  dashboard,
  salesPlan,
}: {
  dashboard: DashboardData | undefined
  salesPlan: SalesPlanData | undefined
}) {
  const rows = buildSalesPlanFactRows(dashboard, salesPlan)
  const totals = sumSalesPlanFactRows(rows)

  return (
    <section className="panel p-5">
      <PanelHeading
        title="План / факт продаж"
        description="Сверка плана, пересчитанного под выбранный диапазон отчета, с выигранными сделками периода в разрезе менеджеров и таргет-группы/клуба заказчика."
        right={
          <span className="badge-chip badge-neutral">
            {formatInteger(totals.actualDeals)} / {formatInteger(totals.plannedDeals)} сделок
          </span>
        }
      />

      {rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Таргет-группа / клуб</th>
                <th className="px-3 py-3">План сделок</th>
                <th className="px-3 py-3">Факт сделок</th>
                <th className="px-3 py-3">% выполнения</th>
                <th className="px-3 py-3">План дохода</th>
                <th className="px-3 py-3">Факт дохода</th>
                <th className="px-3 py-3">Разрыв</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.managerName}</td>
                  <td className="px-3 py-3">{row.targetGroupLabel}</td>
                  <td className="px-3 py-3">{formatInteger(row.plannedDeals)}</td>
                  <td className="px-3 py-3">{formatInteger(row.actualDeals)}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {formatPlanCompletion(row.actualDeals, row.plannedDeals)}
                  </td>
                  <td className="px-3 py-3">{formatAmount(row.plannedAmount)}</td>
                  <td className="px-3 py-3">{formatAmount(row.actualAmount)}</td>
                  <td className="px-3 py-3">{formatAmount(row.actualAmount - row.plannedAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-3 py-3" colSpan={2}>Итого</td>
                <td className="px-3 py-3">{formatInteger(totals.plannedDeals)}</td>
                <td className="px-3 py-3">{formatInteger(totals.actualDeals)}</td>
                <td className="px-3 py-3">
                  {formatPlanCompletion(totals.actualDeals, totals.plannedDeals)}
                </td>
                <td className="px-3 py-3">{formatAmount(totals.plannedAmount)}</td>
                <td className="px-3 py-3">{formatAmount(totals.actualAmount)}</td>
                <td className="px-3 py-3">{formatAmount(totals.actualAmount - totals.plannedAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="План продаж еще не заполнен, и фактических продаж в выбранном периоде нет." />
      )}
    </section>
  )
}

function buildEditableMonths(plan: SalesPlanQuarterData | undefined): EditableSalesPlanMonth[] {
  return (plan?.months ?? []).map((month) => ({
    month: month.month,
    label: month.label,
    plannedDeals: 0,
    plannedAmount: 0,
  }))
}

function toEditableSalesPlanRows(
  salesPlan: SalesPlanQuarterData | undefined,
  managers: PickerOption[],
  targetGroups: Array<{ key: string; label: string }> = [],
): EditableSalesPlanRow[] {
  if (!salesPlan) {
    return []
  }

  if (salesPlan.rows.length) {
    return salesPlan.rows.map((row, index) => ({
      localId: `${row.managerId}-${row.targetGroupKey}-${index}`,
      managerId: row.managerId,
      managerName: row.managerName,
      targetGroupKey: row.targetGroupKey,
      targetGroupLabel: row.targetGroupLabel,
      quarterPlannedDeals: row.quarterPlannedDeals,
      quarterPlannedAmount: row.quarterPlannedAmount,
      months: salesPlan.months.map((month) => {
        const savedMonth = row.months.find((entry) => entry.month === month.month)
        return {
          month: month.month,
          label: month.label,
          plannedDeals: savedMonth?.plannedDeals ?? 0,
          plannedAmount: savedMonth?.plannedAmount ?? 0,
        }
      }),
    }))
  }

  const firstManager = managers[0]
  const firstTargetGroup = targetGroups[0]
  return [
    {
      localId: crypto.randomUUID(),
      managerId: firstManager?.id ?? '',
      managerName: firstManager?.label ?? null,
      targetGroupKey: firstTargetGroup?.key ?? '',
      targetGroupLabel: firstTargetGroup?.label ?? '',
      quarterPlannedDeals: 0,
      quarterPlannedAmount: 0,
      months: buildEditableMonths(salesPlan),
    },
  ]
}

function collectTargetGroupOptions(
  dashboard: DashboardData | undefined,
  effectiveSalesPlan: SalesPlanData | undefined,
  salesPlanQuarter: SalesPlanQuarterData | undefined,
  acquisitionOutcomes: AcquisitionOutcomesReport | undefined,
  targetGroupConversion: TargetGroupConversionReport | undefined,
) {
  const options = new Map<string, string>()

  for (const targetGroup of defaultSalesPlanTargetGroups) {
    addSalesPlanTargetGroupOption(options, targetGroup.key, targetGroup.label)
  }

  for (const planRow of effectiveSalesPlan?.rows ?? []) {
    addSalesPlanTargetGroupOption(options, planRow.targetGroupKey, planRow.targetGroupLabel)
  }

  for (const planRow of salesPlanQuarter?.rows ?? []) {
    addSalesPlanTargetGroupOption(options, planRow.targetGroupKey, planRow.targetGroupLabel)
  }

  for (const group of dashboard?.managerGroups ?? []) {
    for (const deal of group.deals) {
      const targetGroup = resolveDealTargetGroup(deal)
      addSalesPlanTargetGroupOption(options, targetGroup.key, targetGroup.label)
    }
  }

  for (const managerRow of acquisitionOutcomes?.businessClubByManager ?? []) {
    for (const club of managerRow.businessClubs) {
      addSalesPlanTargetGroupOption(options, club.businessClubKey, club.businessClubLabel)
    }
    for (const targetGroup of managerRow.targetGroups) {
      addSalesPlanTargetGroupOption(options, targetGroup.targetGroupKey, targetGroup.targetGroupLabel)
    }
  }

  for (const row of targetGroupConversion?.rows ?? []) {
    addSalesPlanTargetGroupOption(options, row.targetGroupKey, row.targetGroupLabel)
  }

  return Array.from(options.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ru-RU'))
}

function getSalesPlanRowMismatch(row: EditableSalesPlanRow) {
  const monthDeals = row.months.reduce((total, month) => total + month.plannedDeals, 0)
  const monthAmount = row.months.reduce((total, month) => total + month.plannedAmount, 0)
  const dealDiff = monthDeals - row.quarterPlannedDeals
  const amountDiff = monthAmount - row.quarterPlannedAmount

  if (dealDiff === 0 && amountDiff === 0) {
    return null
  }

  return { dealDiff, amountDiff }
}

function formatPlanMismatch(mismatch: NonNullable<ReturnType<typeof getSalesPlanRowMismatch>>) {
  const parts = []
  if (mismatch.dealDiff !== 0) {
    parts.push(`сделки ${mismatch.dealDiff > 0 ? '+' : ''}${formatInteger(mismatch.dealDiff)}`)
  }
  if (mismatch.amountDiff !== 0) {
    parts.push(`доход ${mismatch.amountDiff > 0 ? '+' : ''}${formatAmount(mismatch.amountDiff)}`)
  }

  return `Сумма месяцев не равна квартальному плану: ${parts.join(', ')}`
}

function formatSalesPlanAmountMillions(value: number) {
  const millions = value / SALES_PLAN_AMOUNT_UNIT
  return Number.isInteger(millions) ? String(millions) : String(Number(millions.toFixed(2)))
}

function parseSalesPlanAmountMillions(value: string) {
  if (!value.trim()) {
    return 0
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * SALES_PLAN_AMOUNT_UNIT)
}

function SalesPlanAmountInput({
  ariaLabel,
  disabled,
  value,
  onChange,
}: {
  ariaLabel: string
  disabled: boolean
  value: number
  onChange: (value: number) => void
}) {
  const formattedValue = formatSalesPlanAmountMillions(value)
  const [draftValue, setDraftValue] = useState(formattedValue)

  useEffect(() => {
    setDraftValue(formattedValue)
  }, [formattedValue])

  return (
    <input
      className="field h-10 w-full"
      type="number"
      min={0}
      step={0.1}
      aria-label={ariaLabel}
      value={draftValue}
      disabled={disabled}
      onChange={(event) => {
        const nextValue = event.target.value
        setDraftValue(nextValue)
        const parsedValue = parseSalesPlanAmountMillions(nextValue)
        if (parsedValue !== null) {
          onChange(parsedValue)
        }
      }}
      onBlur={() => setDraftValue(formatSalesPlanAmountMillions(value))}
    />
  )
}

function shiftQuarterSelection(input: { year: number; quarter: number }, delta: number) {
  const zeroBased = input.year * 4 + (input.quarter - 1) + delta
  const year = Math.floor(zeroBased / 4)
  const quarterIndex = ((zeroBased % 4) + 4) % 4

  return { year, quarter: quarterIndex + 1 }
}

function distributeSalesPlanValue(total: number, parts: number) {
  if (parts <= 0) {
    return []
  }

  const normalizedTotal = Math.max(0, Math.round(total))
  const baseValue = Math.floor(normalizedTotal / parts)
  const remainder = normalizedTotal - baseValue * parts

  return Array.from({ length: parts }, (_, index) =>
    baseValue + (index < remainder ? 1 : 0),
  )
}

function distributeSalesPlanMonths(
  months: EditableSalesPlanMonth[],
  key: 'plannedDeals' | 'plannedAmount',
  total: number,
) {
  const values = distributeSalesPlanValue(total, months.length)

  return months.map((month, index) => ({
    ...month,
    [key]: values[index] ?? 0,
  }))
}

export function SalesPlanScene({
  runtimeData,
  salesPlanQuarter,
  salesPlanLoading,
  salesPlanSaving,
  salesPlanSaveError,
  onSalesPlanQuarterChange,
  onSalesPlanSave,
}: SceneComponentProps) {
  const managers =
    runtimeData?.managerOptions.length ? runtimeData.managerOptions : managerOptions
  const effectiveSalesPlan = runtimeData?.salesPlan
  const savedQuarterPlan = runtimeData?.salesPlanQuarter
  const selectedQuarter = salesPlanQuarter ?? {
    year: savedQuarterPlan?.year ?? new Date().getFullYear(),
    quarter: savedQuarterPlan?.quarter ?? 1,
  }
  const isPlanLocked = Boolean(salesPlanLoading || salesPlanSaving)
  const targetGroups = useMemo(
    () =>
      collectTargetGroupOptions(
        runtimeData?.salesDashboard,
        effectiveSalesPlan,
        savedQuarterPlan,
        runtimeData?.acquisitionOutcomes,
        runtimeData?.targetGroupConversion,
      ),
    [
      runtimeData?.salesDashboard,
      runtimeData?.acquisitionOutcomes,
      runtimeData?.targetGroupConversion,
      effectiveSalesPlan,
      savedQuarterPlan,
    ],
  )
  const [rows, setRows] = useState<EditableSalesPlanRow[]>(() =>
    toEditableSalesPlanRows(savedQuarterPlan, managers, targetGroups),
  )
  const hasMismatches = rows.some((row) => getSalesPlanRowMismatch(row) !== null)

  useEffect(() => {
    setRows(toEditableSalesPlanRows(savedQuarterPlan, managers, targetGroups))
  }, [savedQuarterPlan, managers, targetGroups])

  function patchRow(localId: string, patch: Partial<EditableSalesPlanRow>) {
    setRows((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    )
  }

  function patchMonth(
    localId: string,
    monthKey: string,
    patch: Partial<EditableSalesPlanMonth>,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.localId === localId
          ? {
              ...row,
              months: row.months.map((month) =>
                month.month === monthKey ? { ...month, ...patch } : month,
              ),
            }
          : row,
      ),
    )
  }

  function addRow() {
    const firstManager = managers[0]
    const firstTargetGroup = targetGroups[0]
    setRows((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        managerId: firstManager?.id ?? '',
        managerName: firstManager?.label ?? null,
        targetGroupKey: firstTargetGroup?.key ?? '',
        targetGroupLabel: firstTargetGroup?.label ?? '',
        quarterPlannedDeals: 0,
        quarterPlannedAmount: 0,
        months: buildEditableMonths(savedQuarterPlan),
      },
    ])
  }

  function removeRow(localId: string) {
    setRows((current) => current.filter((row) => row.localId !== localId))
  }

  async function saveRows() {
    if (!onSalesPlanSave || hasMismatches) {
      return
    }

    await onSalesPlanSave(
      rows
        .map((row): SalesPlanQuarterDraftRow => {
          const selectedTargetGroup = targetGroups.find(
            (targetGroup) => targetGroup.key === row.targetGroupKey,
          )
          const targetGroupLabel = (
            selectedTargetGroup?.label ??
            row.targetGroupLabel ??
            row.targetGroupKey
          ).trim()
          const managerName =
            managers.find((manager) => manager.id === row.managerId)?.label ??
            row.managerName ??
            row.managerId

          return {
            managerId: row.managerId,
            managerName,
            targetGroupKey: (row.targetGroupKey || targetGroupLabel).trim(),
            targetGroupLabel,
            quarterPlannedDeals: Number.isFinite(row.quarterPlannedDeals)
              ? row.quarterPlannedDeals
              : 0,
            quarterPlannedAmount: Number.isFinite(row.quarterPlannedAmount)
              ? row.quarterPlannedAmount
              : 0,
            months: row.months.map((month) => ({
              month: month.month,
              plannedDeals: Number.isFinite(month.plannedDeals) ? month.plannedDeals : 0,
              plannedAmount: Number.isFinite(month.plannedAmount) ? month.plannedAmount : 0,
            })),
          }
        })
        .filter(
          (row) =>
            row.managerId &&
            row.targetGroupKey &&
            (row.quarterPlannedDeals > 0 ||
              row.quarterPlannedAmount > 0 ||
              row.months.some((month) => month.plannedDeals > 0 || month.plannedAmount > 0)),
        ),
    )
  }

  return (
    <section className="panel p-5">
      <PanelHeading
        title="План продаж"
        description="Квартальный контрольный план и распределение по месяцам. Сохранение доступно только когда три месяца сходятся с кварталом."
        right={
          <span className="badge-chip badge-neutral">
            {salesPlanLoading
              ? 'загрузка плана'
              : savedQuarterPlan?.updatedAt
                ? `сохранено ${formatShortDate(savedQuarterPlan.updatedAt)}`
                : 'план не сохранен'}
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            onSalesPlanQuarterChange?.(
              shiftQuarterSelection(selectedQuarter, -1),
            )
          }
          disabled={isPlanLocked}
        >
          Предыдущий квартал
        </button>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
          <span className="subtle-label">Квартал плана</span>
          <div className="text-base font-bold text-slate-900">
            {selectedQuarter.quarter} квартал {selectedQuarter.year}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            onSalesPlanQuarterChange?.(
              shiftQuarterSelection(selectedQuarter, 1),
            )
          }
          disabled={isPlanLocked}
        >
          Следующий квартал
        </button>
      </div>

      {salesPlanSaveError ? (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {salesPlanSaveError}
        </div>
      ) : null}

      <div className="overflow-auto">
        <table className="min-w-[1440px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
              <th className="px-3 py-3">Менеджер</th>
              <th className="px-3 py-3">Таргет-группа / клуб</th>
              <th className="px-3 py-3">Квартал</th>
              {(savedQuarterPlan?.months ?? []).map((month) => (
                <th key={month.month} className="px-3 py-3">{month.label}</th>
              ))}
              <th className="px-3 py-3">Сверка</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const managerName =
                managers.find((manager) => manager.id === row.managerId)?.label ??
                row.managerName ??
                row.managerId
              const targetGroupOption = targetGroups.find(
                (targetGroup) => targetGroup.key === row.targetGroupKey,
              )
              const targetGroupLabel =
                targetGroupOption?.label ?? row.targetGroupLabel ?? row.targetGroupKey
              const fieldSuffix = `${managerName} ${targetGroupLabel}`.trim()
              const mismatch = getSalesPlanRowMismatch(row)

              return (
                <tr
                  key={row.localId}
                  className={`border-b border-slate-100 last:border-b-0${mismatch ? ' bg-rose-50/70' : ''}`}
                  data-plan-mismatch={mismatch ? 'true' : undefined}
                >
                  <td className="px-3 py-3">
                    <select
                      className="field min-w-[210px]"
                      aria-label={`Менеджер ${index + 1}`}
                      value={row.managerId}
                      disabled={isPlanLocked}
                      onChange={(event) => {
                        const manager = managers.find((entry) => entry.id === event.target.value)
                        patchRow(row.localId, {
                          managerId: event.target.value,
                          managerName: manager?.label ?? event.target.value,
                        })
                      }}
                    >
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="field min-w-[240px]"
                      aria-label={`Таргет-группа ${index + 1}`}
                      value={row.targetGroupKey}
                      disabled={isPlanLocked}
                      onChange={(event) => {
                        const targetGroup = targetGroups.find(
                          (entry) => entry.key === event.target.value,
                        )
                        patchRow(row.localId, {
                          targetGroupKey: event.target.value,
                          targetGroupLabel: targetGroup?.label ?? event.target.value,
                        })
                      }}
                    >
                      {targetGroups.length === 0 ? (
                        <option value="">Нет таргет-групп</option>
                      ) : (
                        <option value="" disabled>
                          Выберите таргет-группу
                        </option>
                      )}
                      {targetGroups.map((targetGroup) => (
                        <option key={targetGroup.key} value={targetGroup.key}>
                          {targetGroup.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="min-w-[150px] space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                      <label className="block">
                        <span className="mb-1 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Сделки
                        </span>
                        <input
                          className="field h-10 w-full"
                          type="number"
                          min={0}
                          aria-label={`Квартальный план сделок ${fieldSuffix}`}
                          value={row.quarterPlannedDeals}
                          disabled={isPlanLocked}
                          onChange={(event) => {
                            const quarterPlannedDeals = Math.max(0, Number(event.target.value) || 0)
                            patchRow(row.localId, {
                              quarterPlannedDeals,
                              months: distributeSalesPlanMonths(
                                row.months,
                                'plannedDeals',
                                quarterPlannedDeals,
                              ),
                            })
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                          Доход, млн ₽
                        </span>
                        <SalesPlanAmountInput
                          ariaLabel={`Квартальный план дохода, млн ₽ ${fieldSuffix}`}
                          value={row.quarterPlannedAmount}
                          disabled={isPlanLocked}
                          onChange={(value) =>
                            patchRow(row.localId, {
                              quarterPlannedAmount: value,
                              months: distributeSalesPlanMonths(
                                row.months,
                                'plannedAmount',
                                value,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  </td>
                  {row.months.map((month) => (
                    <td key={`${row.localId}-${month.month}`} className="px-3 py-3 align-top">
                      <div className="min-w-[150px] space-y-2 rounded-xl border border-slate-100 bg-white p-2 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                        <label className="block">
                          <span className="mb-1 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                            Сделки
                          </span>
                          <input
                            className="field h-10 w-full"
                            type="number"
                            min={0}
                            aria-label={`План сделок ${month.label} ${fieldSuffix}`}
                            value={month.plannedDeals}
                            disabled={isPlanLocked}
                            onChange={(event) =>
                              patchMonth(row.localId, month.month, {
                                plannedDeals: Math.max(0, Number(event.target.value) || 0),
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-500">
                            Доход, млн ₽
                          </span>
                          <SalesPlanAmountInput
                            ariaLabel={`План дохода, млн ₽ ${month.label} ${fieldSuffix}`}
                            value={month.plannedAmount}
                            disabled={isPlanLocked}
                            onChange={(value) =>
                              patchMonth(row.localId, month.month, {
                                plannedAmount: value,
                              })
                            }
                          />
                        </label>
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-3 align-top">
                    <div className="min-w-[210px] pt-3">
                      {mismatch ? (
                        <span className="font-semibold text-rose-700">
                          {formatPlanMismatch(mismatch)}
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-700">Сходится</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeRow(row.localId)}
                      disabled={isPlanLocked || rows.length === 1}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={addRow} disabled={isPlanLocked || !savedQuarterPlan}>
          Добавить строку
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void saveRows()}
          disabled={isPlanLocked || hasMismatches || !savedQuarterPlan}
        >
          {salesPlanLoading ? 'Загружаю план...' : salesPlanSaving ? 'Сохраняю...' : 'Сохранить план'}
        </button>
      </div>
    </section>
  )
}

function TargetGroupConversionSection({
  report,
  filters,
}: {
  report: TargetGroupConversionReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const compareByTargetGroup = new Map(
    (report.comparisons?.[0]?.snapshot.rows ?? []).map((row) => [row.targetGroupKey, row]),
  )

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Конверсия по таргет-группам"
        description="Срез по customer target group: новые заказы в период, победы в период, доля побед среди закрытых исходов, доход Привлечения и средний цикл по выигранным."
        right={<span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>}
      />

      {report.rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Target group</th>
                <th className="px-3 py-3">Создано</th>
                <th className="px-3 py-3">Выиграно</th>
                <th className="px-3 py-3">Win-rate</th>
                <th className="px-3 py-3">Доход</th>
                <th className="px-3 py-3">Средний доход</th>
                <th className="px-3 py-3">Средний цикл</th>
                <th className="px-3 py-3">Сравнение 1</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => {
                const compareRow = compareByTargetGroup.get(row.targetGroupKey)
                return (
                  <tr key={row.targetGroupKey} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.targetGroupLabel}</td>
                    <td className="px-3 py-3">{formatInteger(row.createdDeals)}</td>
                    <td className="px-3 py-3">{formatInteger(row.wonDeals)}</td>
                    <td className="px-3 py-3">{formatRatioPercent(row.winRate)}</td>
                    <td className="px-3 py-3">{formatAmount(row.salesAmount)}</td>
                    <td className="px-3 py-3">{formatAmount(row.averageSaleAmount)}</td>
                    <td className="px-3 py-3">{formatSalesDays(row.averageCycleDays)}</td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-slate-700">
                        {compareRow ? `${formatInteger(compareRow.wonDeals)} выигр. · ${formatRatioPercent(compareRow.winRate)}` : '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {compareRow
                          ? `${formatCompareDelta(row.wonDeals, compareRow.wonDeals)} · ${formatCompareDelta(
                              row.winRate,
                              compareRow.winRate,
                              'rate',
                            )}`
                          : 'без базы'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="Конверсия по таргет-группам в выбранном окне пустая." />
      )}
    </section>
  )
}

type ManagerActionSortKey =
  | 'dealCount'
  | 'statusShare'
  | 'createdTasksPerDeal'
  | 'totalCallsPerDeal'
  | 'meetingsPerDeal'
  | 'sla1OnTimeRate'
  | 'financialAmount'
  | 'averageFinancialAmount'

const managerActionStatusOrder = ['won', 'lost', 'wip'] as const
type ManagerActionStatusKey = (typeof managerActionStatusOrder)[number]
type ManagerActionStatusRow = NonNullable<ManagerActionOutcomeReport['cohortStatusRows']>[number]
type ManagerActionDisplayRow = ManagerActionStatusRow & { isSynthetic?: boolean }

const managerActionStatusLabels: Record<ManagerActionStatusKey, string> = {
  won: 'Выиграно',
  lost: 'Проиграно',
  wip: 'В работе сейчас',
}

function getManagerActionStatusClass(statusKey: string) {
  if (statusKey === 'won') {
    return 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700'
  }

  if (statusKey === 'lost') {
    return 'rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700'
  }

  return 'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600'
}

function getManagerActionRowKey(row: Pick<ManagerActionStatusRow, 'managerId' | 'cohortMonth' | 'statusKey'>) {
  return `${row.managerId}-${row.cohortMonth ?? 'all'}-${row.statusKey}`
}

function getManagerActionDealKey(
  row: Pick<ManagerActionStatusRow, 'managerId' | 'cohortMonth' | 'statusKey'>,
  dealId: string,
) {
  return `${getManagerActionRowKey(row)}-${dealId}`
}

function formatDealSlaStatus(value: ManagerActionOutcomeDealDetail['sla']['sla1']) {
  const hours = value.hours === null ? '—' : `${formatOneDecimal(value.hours)} ч`

  if (value.status === 'onTime') {
    return `в срок · ${hours}`
  }

  if (value.status === 'late') {
    return `поздно · ${hours}`
  }

  return `нет касания · ${hours}`
}

function ManagerActionDealDetails({ deal }: { deal: ManagerActionOutcomeDealDetail }) {
  return <DealLifecycleDetails deal={deal} variant="managerAction" />
}

function createEmptyManagerActionStatusRow(
  referenceRow: ManagerActionStatusRow,
  statusKey: ManagerActionStatusKey,
  selectedCohortMonth: string | null,
): ManagerActionDisplayRow {
  return {
    managerId: referenceRow.managerId,
    managerName: referenceRow.managerName,
    cohortMonth: selectedCohortMonth,
    statusKey,
    statusLabel: managerActionStatusLabels[statusKey],
    cohortCreatedDeals: referenceRow.cohortCreatedDeals,
    dealCount: 0,
    statusShare: 0,
    createdTasksPerDeal: 0,
    closedTasksPerDeal: 0,
    totalCallsPerDeal: 0,
    successfulCallsOverThirtySecondsPerDeal: 0,
    meetingsPerDeal: 0,
    sla1OnTimeRate: 0,
    sla2OnTimeRate: 0,
    sla3OnTimeRate: 0,
    financialAmount: 0,
    averageFinancialAmount: 0,
    dealDetails: [],
    isSynthetic: true,
  }
}

function getManagerActionGroupSortValue(
  rows: ManagerActionDisplayRow[],
  sortKey: ManagerActionSortKey,
) {
  const dealCount = rows.reduce((total, row) => total + row.dealCount, 0)

  if (sortKey === 'dealCount') {
    return dealCount
  }

  if (sortKey === 'statusShare') {
    const cohortCreatedDeals = rows[0]?.cohortCreatedDeals ?? 0
    return cohortCreatedDeals === 0 ? 0 : dealCount / cohortCreatedDeals
  }

  if (sortKey === 'financialAmount') {
    return rows.reduce((total, row) => total + row.financialAmount, 0)
  }

  if (sortKey === 'averageFinancialAmount') {
    const financialAmount = rows.reduce((total, row) => total + row.financialAmount, 0)
    return dealCount === 0 ? 0 : financialAmount / dealCount
  }

  return dealCount === 0
    ? 0
    : rows.reduce((total, row) => total + Number(row[sortKey]) * row.dealCount, 0) / dealCount
}

function ManagerActionOutcomeSection({
  report,
  status = 'idle',
  error,
}: {
  report: ManagerActionOutcomeReport | undefined
  status?: 'idle' | 'loading' | 'ready' | 'error' | undefined
  error?: string | null | undefined
}) {
  const [sortState, setSortState] = useState<{
    key: ManagerActionSortKey
    direction: 'asc' | 'desc'
  }>({
    key: 'financialAmount',
    direction: 'desc',
  })
  const [selectedCohortMonth, setSelectedCohortMonth] = useState<string | null>(null)
  const [expandedStatusRows, setExpandedStatusRows] = useState<Set<string>>(() => new Set())
  const [expandedDealDetails, setExpandedDealDetails] = useState<Set<string>>(() => new Set())

  if (!report) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Действия → результат"
          description="Детализация по сделкам и действиям считается отдельно от когортной матрицы, чтобы не блокировать открытие отчета."
          right={
            <span
              className={
                status === 'error'
                  ? 'badge-chip bg-rose-50 text-rose-700'
                  : 'badge-chip badge-neutral'
              }
            >
              {status === 'loading'
                ? 'загружается'
                : status === 'error'
                  ? 'ошибка'
                  : 'не загружено'}
            </span>
          }
        />
        {status === 'loading' ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            <span className="btn-spinner" aria-hidden="true" />
            <span>Считаю тяжелую детализацию, основной когортный отчет уже доступен.</span>
          </div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </section>
    )
  }

  const columns: Array<{
    key: string
    label: string
    sortKey: ManagerActionSortKey
    render: (row: ManagerActionDisplayRow) => ReactNode
  }> = [
    {
      key: 'deals',
      label: 'Сделки',
      sortKey: 'dealCount',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatInteger(row.dealCount)}</div>
          <div className="text-xs text-slate-500">
            из {formatInteger(row.cohortCreatedDeals)} · {formatRatioPercent(row.statusShare)}
          </div>
        </div>
      ),
    },
    {
      key: 'tasks',
      label: 'Дела / сделку',
      sortKey: 'createdTasksPerDeal',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatOneDecimal(row.createdTasksPerDeal)}</div>
          <div className="text-xs text-slate-500">закр. {formatOneDecimal(row.closedTasksPerDeal)}</div>
        </div>
      ),
    },
    {
      key: 'calls',
      label: 'Звонки / сделку',
      sortKey: 'totalCallsPerDeal',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatOneDecimal(row.totalCallsPerDeal)}</div>
          <div className="text-xs text-slate-500">
            &gt;30с {formatOneDecimal(row.successfulCallsOverThirtySecondsPerDeal)}
          </div>
        </div>
      ),
    },
    {
      key: 'meetings',
      label: 'Встречи / сделку',
      sortKey: 'meetingsPerDeal',
      render: (row) => (
        <div className="font-semibold text-slate-900">{formatOneDecimal(row.meetingsPerDeal)}</div>
      ),
    },
    {
      key: 'sla',
      label: 'SLA on-time',
      sortKey: 'sla1OnTimeRate',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-700">1: {formatRatioPercent(row.sla1OnTimeRate)}</span>
          <span className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-700">2: {formatRatioPercent(row.sla2OnTimeRate)}</span>
          <span className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-700">3: {formatRatioPercent(row.sla3OnTimeRate)}</span>
        </div>
      ),
    },
    {
      key: 'finance',
      label: 'Финансы',
      sortKey: 'financialAmount',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatAmount(row.financialAmount)}</div>
          <div className="text-xs text-slate-500">ср. {formatAmount(row.averageFinancialAmount)}</div>
        </div>
      ),
    },
  ]

  const cohortStatusRows = report.cohortStatusRows ?? []
  const cohortMonths = report.cohortMonths ?? []
  const selectedRows = cohortStatusRows.filter(
    (row) =>
      row.cohortMonth === selectedCohortMonth &&
      (SHOW_ACTION_OUTCOME_WIP || row.statusKey !== 'wip'),
  )
  const visibleStatusKeys = managerActionStatusOrder.filter(
    (statusKey) => SHOW_ACTION_OUTCOME_WIP || statusKey !== 'wip',
  )
  const totalCohortDeals = selectedCohortMonth
    ? (cohortMonths.find((cohort) => cohort.cohortMonth === selectedCohortMonth)?.totalCreatedDeals ?? 0)
    : Array.from(
        new Map(selectedRows.map((row) => [row.managerId, row.cohortCreatedDeals])).values(),
      ).reduce((total, value) => total + value, 0)
  const statusSummary = managerActionStatusOrder
    .filter((statusKey) => SHOW_ACTION_OUTCOME_WIP || statusKey !== 'wip')
    .map((statusKey) => {
      const rows = selectedRows.filter((row) => row.statusKey === statusKey)
      const dealCount = rows.reduce((total, row) => total + row.dealCount, 0)
      const financialAmount = rows.reduce((total, row) => total + row.financialAmount, 0)
      const callsPerDeal =
        dealCount === 0
          ? 0
          : rows.reduce((total, row) => total + row.totalCallsPerDeal * row.dealCount, 0) / dealCount
      const meetingsPerDeal =
        dealCount === 0
          ? 0
          : rows.reduce((total, row) => total + row.meetingsPerDeal * row.dealCount, 0) / dealCount
      const label = rows[0]?.statusLabel ?? (statusKey === 'won' ? 'Выиграно' : statusKey === 'lost' ? 'Проиграно' : 'В работе сейчас')

      return {
        statusKey,
        label,
        dealCount,
        financialAmount,
        callsPerDeal,
        meetingsPerDeal,
      }
    })
  const managerGroups = Array.from(
    selectedRows.reduce((groups, row) => {
      const current = groups.get(row.managerId) ?? []
      current.push(row)
      groups.set(row.managerId, current)
      return groups
    }, new Map<string, ManagerActionStatusRow[]>()),
  ).map(([managerId, rows]) => {
    const referenceRow = rows[0]
    const rowsByStatus = new Map(rows.map((row) => [row.statusKey, row]))
    const displayRows: ManagerActionDisplayRow[] = referenceRow
      ? visibleStatusKeys.map((statusKey) => {
          const existingRow = rowsByStatus.get(statusKey)
          return existingRow
            ? { ...existingRow, isSynthetic: false }
            : createEmptyManagerActionStatusRow(referenceRow, statusKey, selectedCohortMonth)
        })
      : []

    return {
      managerId,
      managerName: referenceRow?.managerName ?? managerId,
      rows: displayRows,
    }
  })

  const sortedGroups = [...managerGroups].sort((left, right) => {
    const leftValue = getManagerActionGroupSortValue(left.rows, sortState.key)
    const rightValue = getManagerActionGroupSortValue(right.rows, sortState.key)
    const result = leftValue === rightValue
      ? left.managerName.localeCompare(right.managerName, 'ru-RU')
      : leftValue - rightValue

    return sortState.direction === 'asc' ? result : -result
  })

  function toggleSort(key: ManagerActionSortKey) {
    setSortState((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  function toggleStatusRow(row: ManagerActionDisplayRow) {
    if (row.dealDetails.length === 0) {
      return
    }

    const rowKey = getManagerActionRowKey(row)
    setExpandedStatusRows((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }

      return next
    })
  }

  function toggleDealDetails(row: ManagerActionDisplayRow, dealId: string) {
    const dealKey = getManagerActionDealKey(row, dealId)
    setExpandedDealDetails((current) => {
      const next = new Set(current)
      if (next.has(dealKey)) {
        next.delete(dealKey)
      } else {
        next.add(dealKey)
      }

      return next
    })
  }

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Действия → результат"
        description="Средний объём действий на сделку по когорте создания и статусу: выиграно, проиграно, в работе сейчас."
        right={<span className="badge-chip badge-neutral">{cohortMonths.length || 12} когорт · годовой период</span>}
      />

      <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
        <div className="flex min-w-max items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSelectedCohortMonth(null)}
            className={
              selectedCohortMonth === null
                ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
            }
          >
            Все когорты
          </button>
          {cohortMonths.map((cohort) => (
            <button
              key={cohort.cohortMonth}
              type="button"
              onClick={() => setSelectedCohortMonth(cohort.cohortMonth)}
              className={
                selectedCohortMonth === cohort.cohortMonth
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
              }
            >
              {cohort.cohortLabel}
            </button>
          ))}
          <span className="ml-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
            создано сделок: {formatInteger(totalCohortDeals)}
          </span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {statusSummary.map((status) => (
          <article key={status.statusKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={getManagerActionStatusClass(status.statusKey)}>{status.label}</span>
              <span className="text-xs font-semibold text-slate-500">{formatRatioPercent(totalCohortDeals === 0 ? 0 : status.dealCount / totalCohortDeals)}</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{formatInteger(status.dealCount)}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
              <span>фин. {formatAmount(status.financialAmount)}</span>
              <span>звонки {formatOneDecimal(status.callsPerDeal)}</span>
              <span>встречи {formatOneDecimal(status.meetingsPerDeal)}</span>
            </div>
          </article>
        ))}
      </div>

      {sortedGroups.length > 0 ? (
        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Статус</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-slate-100"
                      onClick={() => toggleSort(column.sortKey)}
                    >
                      <span>{column.label}</span>
                      <SortIndicator
                        active={sortState.key === column.sortKey}
                        direction={sortState.direction}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGroups.flatMap((group) => {
                const expandedRowsInGroup = group.rows.filter(
                  (row) => expandedStatusRows.has(getManagerActionRowKey(row)) && row.dealDetails.length > 0,
                ).length
                const managerRowSpan = group.rows.length + expandedRowsInGroup

                return group.rows.flatMap((row, rowIndex) => {
                  const rowKey = getManagerActionRowKey(row)
                  const isExpanded = expandedStatusRows.has(rowKey) && row.dealDetails.length > 0
                  const canExpand = row.dealDetails.length > 0
                  const baseRow = (
                    <tr
                      key={rowKey}
                      className={`border-b border-slate-100 last:border-b-0 ${rowIndex === 0 ? 'border-t border-t-slate-200' : ''}`}
                    >
                      {rowIndex === 0 ? (
                        <td
                          rowSpan={managerRowSpan}
                          className="bg-white px-3 py-3 align-top font-semibold text-slate-900"
                        >
                          <div>{group.managerName}</div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {formatInteger(group.rows[0]?.cohortCreatedDeals ?? 0)} сделок в когорте
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          disabled={!canExpand}
                          onClick={() => toggleStatusRow(row)}
                          aria-expanded={canExpand ? isExpanded : undefined}
                          aria-label={
                            canExpand
                              ? `${isExpanded ? 'Свернуть' : 'Раскрыть'} статус ${row.statusLabel}`
                              : row.statusLabel
                          }
                          title={canExpand ? `${isExpanded ? 'Свернуть' : 'Раскрыть'} сделки` : undefined}
                          className="group inline-flex items-center gap-2 rounded-full px-1 py-1 text-left transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <span className={getManagerActionStatusClass(row.statusKey)}>
                            {row.statusLabel}
                          </span>
                          {canExpand ? <DisclosureIndicator expanded={isExpanded} /> : null}
                        </button>
                      </td>
                      {columns.map((column) => (
                        <td
                          key={`${rowKey}-${column.key}`}
                          className={`px-3 py-3 ${row.isSynthetic ? 'text-slate-400' : ''}`}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  )

                  if (!isExpanded) {
                    return [baseRow]
                  }

                  const detailRow = (
                    <tr key={`${rowKey}-details`} className="border-b border-slate-100 bg-slate-50/70">
                      <td colSpan={columns.length + 1} className="px-3 py-4">
                        <div className="space-y-3">
                          {row.dealDetails.map((deal) => {
                            const dealKey = getManagerActionDealKey(row, deal.dealId)
                            const isDealExpanded = expandedDealDetails.has(dealKey)

                            return (
                              <article
                                key={deal.dealId}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                              >
                                <div className="grid gap-3 xl:grid-cols-[minmax(8rem,1fr)_8rem_8rem_8rem_9rem_auto] xl:items-center">
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-950">ID {deal.dealId}</div>
                                    <div className="text-xs text-slate-500">
                                      создана {formatShortDate(deal.dateCreate)} · {deal.stageName}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Доход</div>
                                    <div className="font-semibold text-slate-900">{formatAmount(deal.amount)}</div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Дела</div>
                                    <div className="font-semibold text-slate-900">
                                      {formatInteger(deal.taskSummary.created)} / {formatInteger(deal.taskSummary.closed)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Звонки</div>
                                    <div className="font-semibold text-slate-900">{formatInteger(deal.callSummary.total)}</div>
                                    <div className="text-xs text-slate-500">
                                      &gt;30с {formatInteger(deal.callSummary.connectedOverThirtySeconds)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Встречи</div>
                                    <div className="font-semibold text-slate-900">{formatInteger(deal.meetingSummary.total)}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className={isDealExpanded ? 'btn btn-dark' : 'btn btn-ghost'}
                                    onClick={() => toggleDealDetails(row, deal.dealId)}
                                  >
                                    Подробнее
                                  </button>
                                </div>
                                {isDealExpanded ? <ManagerActionDealDetails deal={deal} /> : null}
                              </article>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )

                  return [baseRow, detailRow]
                })
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="По выбранной когорте пока нет данных для блока «действия → результат»." />
      )}
    </section>
  )
}

function SalesKpiCards({
  dashboard,
  salesPlanMonth,
  salesPlanMonthDashboard,
  salesPlanQuarter,
  salesPlanQuarterDashboard,
  status,
}: {
  dashboard: DashboardData | undefined
  salesPlanMonth: SalesPlanData | undefined
  salesPlanMonthDashboard: DashboardData | undefined
  salesPlanQuarter: SalesPlanQuarterData | undefined
  salesPlanQuarterDashboard: DashboardData | undefined
  status: NonNullable<SceneComponentProps['runtimeData']>['operationalStatus'] | undefined
}) {
  const pendingState = !dashboard && status !== 'ready'
  const groups = dashboard?.managerGroups ?? []
  const salesSummary = dashboard?.salesSummary
  const totalDeals = salesSummary?.salesCount ?? groups.reduce((total, group) => total + group.totalWonDeals, 0)
  const totalAttractionRevenue =
    salesSummary?.attractionRevenueAmount ??
    groups.reduce(
      (total, group) =>
        total +
        (Number.isFinite(group.totalAttractionRevenueAmount)
          ? group.totalAttractionRevenueAmount
          : group.totalSalesAmount),
      0,
    )
  const averageAttractionRevenue =
    salesSummary?.averageAttractionRevenueAmount ??
    (totalDeals === 0 ? 0 : totalAttractionRevenue / totalDeals)
  const averageMembershipAmount =
    salesSummary?.averageMembershipAmount ??
    (totalDeals === 0
      ? 0
      : groups.reduce(
          (total, group) =>
            total +
            (Number.isFinite(group.totalMembershipAmount)
              ? group.totalMembershipAmount
              : group.totalSalesAmount),
          0,
        ) / totalDeals)
  const pendingValue = status === 'loading' ? '…' : '—'
  const pendingNote =
    status === 'loading' ? 'ожидаем live-данные' : 'live-данные недоступны'
  const monthActualDeals = getDashboardSalesCount(salesPlanMonthDashboard)
  const monthPlannedDeals = sumSalesPlanDeals(salesPlanMonth)
  const quarterActualDeals = getDashboardSalesCount(salesPlanQuarterDashboard)
  const quarterPlannedDeals = sumQuarterSalesPlanDeals(salesPlanQuarter)
  const monthPlanPending = !salesPlanMonth || !salesPlanMonthDashboard
  const quarterPlanPending = !salesPlanQuarter || !salesPlanQuarterDashboard

  const cards = [
    {
      label: 'Выиграно',
      value: pendingState ? pendingValue : formatInteger(totalDeals),
      note: pendingState ? pendingNote : 'передано в клуб за период',
    },
    {
      label: 'Доход Привлечения',
      value: pendingState ? pendingValue : formatAmount(totalAttractionRevenue),
      note: pendingState ? pendingNote : 'по правилам цен',
    },
    {
      label: 'Средний доход',
      value: pendingState ? pendingValue : formatAmount(averageAttractionRevenue),
      note: pendingState ? pendingNote : 'доход / продажи',
    },
    {
      label: 'Среднее членство',
      value: pendingState ? pendingValue : formatAmount(averageMembershipAmount),
      note: pendingState ? pendingNote : 'стоимость тарифа',
    },
    {
      label: 'План месяца',
      value:
        pendingState || monthPlanPending
          ? pendingValue
          : formatPlanCompletion(monthActualDeals, monthPlannedDeals),
      note:
        pendingState || monthPlanPending
          ? pendingNote
          : formatPlanCompletionNote(monthActualDeals, monthPlannedDeals),
    },
    {
      label: 'План квартала',
      value:
        pendingState || quarterPlanPending
          ? pendingValue
          : formatPlanCompletion(quarterActualDeals, quarterPlannedDeals),
      note:
        pendingState || quarterPlanPending
          ? pendingNote
          : formatPlanCompletionNote(quarterActualDeals, quarterPlannedDeals),
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" aria-label="KPI продаж">
      {cards.map((card) => (
        <div key={card.label} className="metric p-4">
          <p className="subtle-label">{card.label}</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{card.value}</p>
          <p className="text-xs text-slate-500">{card.note}</p>
        </div>
      ))}
    </section>
  )
}

export function SalesScene({ filters, runtimeData }: SceneComponentProps) {
  return (
    <div className="space-y-6">
      <SalesKpiCards
        dashboard={runtimeData?.salesDashboard}
        salesPlanMonth={runtimeData?.salesPlanMonth}
        salesPlanMonthDashboard={runtimeData?.salesPlanMonthDashboard}
        salesPlanQuarter={runtimeData?.salesPlanQuarter}
        salesPlanQuarterDashboard={runtimeData?.salesPlanQuarterDashboard}
        status={runtimeData?.operationalStatus}
      />

      {SHOW_TARGET_GROUP_CONVERSION ? (
        <TargetGroupConversionSection
          report={runtimeData?.targetGroupConversion}
          filters={filters}
        />
      ) : null}

      <SalesPlanFactSection
        dashboard={runtimeData?.salesDashboard}
        salesPlan={runtimeData?.salesPlan}
      />

      <SalesManagersReport
        dashboard={runtimeData?.salesDashboard}
        status={runtimeData?.operationalStatus}
        error={runtimeData?.operationalError}
      />

      {SHOW_SALES_SECONDARY_REPORTS ? (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <section className="panel p-5">
            <PanelHeading
              title="Матрица по источникам"
              description="Сколько сделок было создано, сколько получили итоговое качество, дошли до звонка и были закрыты."
              right={<span className="badge-chip badge-neutral">4 источника</span>}
            />
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-3 py-3">Источник</th>
                    <th className="px-3 py-3">Создано</th>
                    <th className="px-3 py-3">Качество A/B</th>
                    <th className="px-3 py-3">Готов ко встрече</th>
                    <th className="px-3 py-3">Звонок-знакомство</th>
                    <th className="px-3 py-3">Выиграно</th>
                    <th className="px-3 py-3">Средний цикл</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRows.map((row) => (
                    <tr key={row.source} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.source}</td>
                      <td className="px-3 py-3">{row.created}</td>
                      <td className="px-3 py-3">{row.quality}</td>
                      <td className="px-3 py-3">{row.ready}</td>
                      <td className="px-3 py-3">{row.intro}</td>
                      <td className="px-3 py-3">{row.won}</td>
                      <td className="px-3 py-3">{row.cycle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-5">
            <PanelHeading
              title="Точки конверсии"
              description="Где реально теряется объем после статуса «Готов ко встрече»."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="subtle-label">Лучший источник</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Партнёры</div>
                <p className="mt-2 text-sm text-slate-600">26% win-rate и самый короткий цикл по выигранным сделкам.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="subtle-label">Главное узкое место</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Встреча → оффер</div>
                <p className="mt-2 text-sm text-slate-600">После звонка-знакомства теряется 27% сделок, нужен drill-down.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="subtle-label">Что проверить</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Вебинары</div>
                <p className="mt-2 text-sm text-slate-600">Длинный цикл и слабый проход в звонок при неплохом входящем объёме.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-5">
            <PanelHeading
              title="Давление воронки"
              description="Справа остаётся один вертикальный разрез, без перегруза графиками."
            />
            <div className="space-y-4">
              {stagePressure.map((stage) => (
                <div key={stage.label} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{stage.label}</div>
                      <div className="text-sm text-slate-500">{stage.note}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{stage.value}%</div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#80a2ff)]"
                      style={{ width: `${stage.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <PanelHeading
              title="Фокус на период"
              description="Быстрый summary для обсуждения на летучке."
            />
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
                <div className="subtle-label">Сильный сигнал</div>
                <div className="mt-2 text-base font-bold text-slate-900">Платный поиск держит качество</div>
                <p className="mt-1 text-sm text-slate-600">41 сделка с итоговым качеством A/B. Это лучший вход в воронку.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
                <div className="subtle-label">Риск периода</div>
                <div className="mt-2 text-base font-bold text-slate-900">Органика не доходит до встреч</div>
                <p className="mt-1 text-sm text-slate-600">Есть объём, но пробуксовка начинается сразу после этапа качества.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
      ) : null}
    </div>
  )
}

function formatOutcomeCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function OutcomeEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  )
}

function AcquisitionOutcomesSection({
  report,
  filters,
}: {
  report: AcquisitionOutcomesReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const lossReasonsByStage = report.topLossReasons.reduce<
    Array<{
      stageId: string
      stageName: string
      totalCount: number
      reasons: Array<{
        reasonKey: string
        reasonLabel: string
        count: number
      }>
    }>
  >((groups, row) => {
    const existing = groups.find((group) => group.stageId === row.stageId)
    if (existing) {
      existing.totalCount += row.count
      const existingReason = existing.reasons.find((reason) => reason.reasonKey === row.reasonKey)
      if (existingReason) {
        existingReason.count += row.count
      } else {
        existing.reasons.push({
          reasonKey: row.reasonKey,
          reasonLabel: row.reasonLabel,
          count: row.count,
        })
      }
      return groups
    }

    groups.push({
      stageId: row.stageId,
      stageName: row.stageName,
      totalCount: row.count,
      reasons: [
        {
          reasonKey: row.reasonKey,
          reasonLabel: row.reasonLabel,
          count: row.count,
        },
      ],
    })
    return groups
  }, []).map((group) => ({
    ...group,
    reasons: group.reasons.sort((left, right) => right.count - left.count || left.reasonLabel.localeCompare(right.reasonLabel, 'ru')),
  }))

  return (
    <section
      className="panel p-5"
      data-comment-block-id="attraction-acquisition-outcomes"
      data-comment-block-label="Привлечение: проигрыши и исходы"
      id="attraction-acquisition-outcomes"
    >
      <PanelHeading
        title="Сделки и потери"
        description="Новые сделки собраны по менеджерам, источникам и качеству, а потери разложены по этапам и причинам."
        right={
          <div className="flex flex-wrap gap-2">
            <span className="badge-chip badge-green">{formatOutcomeCount(report.totalNewDeals)} новых</span>
            <span className="badge-chip badge-neutral">{formatOutcomeCount(report.totalLostDeals)} потерь</span>
            <span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
        <article className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Новые сделки</h3>
            <p className="mt-1 text-xs text-slate-500">По менеджерам, источникам и качеству входа.</p>
          </div>

          {report.newDealsByManager.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-0 py-2">Менеджер</th>
                    <th className="px-3 py-2">Источники и качество</th>
                    <th className="px-0 py-2 text-right">Сделки</th>
                  </tr>
                </thead>
                <tbody>
                  {report.newDealsByManager.map((row) => (
                    <tr key={row.managerId} className="border-b border-slate-200/70 align-top last:border-b-0">
                      <td className="px-0 py-3 font-semibold text-slate-900">{row.managerName}</td>
                      <td className="px-3 py-3">
                        <div className="space-y-2">
                          {row.sources.map((source) => (
                            <div key={`${row.managerId}-${source.sourceKey}`} className="space-y-1">
                              <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                                <span>{source.sourceLabel}</span>
                                <span className="font-semibold text-slate-900">
                                  {formatOutcomeCount(source.totalNewDeals)}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {source.qualities.map((quality) => (
                                  <span
                                    key={`${row.managerId}-${source.sourceKey}-${quality.qualityKey}`}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                                  >
                                    <span>{quality.qualityLabel}</span>
                                    <span className="text-slate-400">{formatOutcomeCount(quality.count)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-0 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatOutcomeCount(row.totalNewDeals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <OutcomeEmptyState message="В выбранном окне новые сделки не появились." />
          )}
        </article>

        <article className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Проигранные сделки</h3>
            <p className="mt-1 text-xs text-slate-500">Этапы потерь, менеджеры и причины в одном блоке.</p>
          </div>

          {report.lostStages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {report.lostStages.map((stage) => (
                <span
                  key={stage.stageId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  <span>{stage.stageName}</span>
                  <span className="text-slate-400">{formatOutcomeCount(stage.count)}</span>
                </span>
              ))}
            </div>
          ) : (
            <OutcomeEmptyState message="Потерь по этапам в этом периоде нет." />
          )}

          {report.lostDealsByManager.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-0 py-2">Менеджер</th>
                    <th className="px-3 py-2">Этапы</th>
                    <th className="px-0 py-2 text-right">Потери</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lostDealsByManager.map((row) => (
                    <tr key={row.managerId} className="border-b border-slate-200/70 align-top last:border-b-0">
                      <td className="px-0 py-3 font-semibold text-slate-900">{row.managerName}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.stages.map((stage) => (
                            <span
                              key={`${row.managerId}-${stage.stageId}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                            >
                              <span>{stage.stageName}</span>
                              <span className="text-slate-400">{formatOutcomeCount(stage.count)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-0 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatOutcomeCount(row.totalLostDeals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Причины по стадиям</h4>
              <p className="mt-1 text-xs text-slate-500">Та же логика чтения, что и у новых сделок: стадия, набор причин и итоговый объём потерь.</p>
            </div>

            {report.topLossReasons.length > 0 ? (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                      <th className="px-4 py-3">Стадия</th>
                      <th className="px-4 py-3">Причины</th>
                      <th className="px-4 py-3 text-right">Потери</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lossReasonsByStage.map((group) => (
                      <tr
                        key={group.stageId}
                        className="border-b border-slate-200/70 align-top last:border-b-0"
                      >
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">{group.stageName}</div>
                            <div className="text-xs text-slate-500">
                              {formatOutcomeCount(group.reasons.length)} причин в этой стадии
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {group.reasons.map((reason) => (
                              <span
                                key={`${group.stageId}-${reason.reasonKey}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                              >
                                <span>{reason.reasonLabel}</span>
                                <span className="text-slate-400">{formatOutcomeCount(reason.count)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                          {formatOutcomeCount(group.totalCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <OutcomeEmptyState message="Причины проигрыша пока не синхронизировались для выбранного периода." />
            )}
          </div>
        </article>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Drill-down потерь</h3>
          <p className="mt-1 text-xs text-slate-500">
            Каждая проигранная сделка со стадией потери, источником, business club и детализацией причины.
          </p>
        </div>

        {report.lostDealDetails.length > 0 ? (
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-3">Сделка</th>
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-4 py-3">Источник</th>
                  <th className="px-4 py-3">Business club</th>
                  <th className="px-4 py-3">Стадия потери</th>
                  <th className="px-4 py-3">Причина</th>
                </tr>
              </thead>
              <tbody>
                {report.lostDealDetails.map((row) => (
                  <tr key={row.dealId} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.dealId}</td>
                    <td className="px-4 py-3 text-slate-700">{row.managerName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.sourceLabel}</td>
                    <td className="px-4 py-3 text-slate-700">{row.businessClubValue ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.stageName}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.reasonLabel}</div>
                      <div className="text-xs text-slate-500">{row.reasonDetail ?? 'Без детализации'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <OutcomeEmptyState message="Детализация по проигранным сделкам пока не сформировалась." />
        )}
      </div>
    </section>
  )
}

function ActivitiesMeetingsSection({
  report,
  filters,
}: {
  report: ActivitiesWorkloadReport | undefined
  filters: ProtoFilterState
}) {
  const [expandedMeetingHeatmapManagers, setExpandedMeetingHeatmapManagers] = useState<Set<string>>(() => new Set())

  if (!report) {
    return null
  }

  const hasComparison = Boolean(report.comparisons?.[0]?.snapshot)
  const compareByManager = new Map(
    (report.comparisons?.[0]?.snapshot.managerRows ?? []).map((row) => [row.managerId, row]),
  )
  const rows = report.managerRows.filter(
    (row) => row.meetingCount > 0 || row.meetingTypeBreakdown.length > 0,
  )

  function toggleMeetingHeatmap(managerId: string) {
    setExpandedMeetingHeatmapManagers((current) => {
      const next = new Set(current)
      if (next.has(managerId)) {
        next.delete(managerId)
      } else {
        next.add(managerId)
      }

      return next
    })
  }

  return (
    <section className="panel min-w-0 p-5">
      <PanelHeading
        title="Встречи"
        description="Сколько встреч ведёт каждый менеджер, какие типы встреч доминируют и как меняется нагрузка относительно первого compare-периода."
        right={
          <div className="flex flex-wrap gap-2">
            <span className="badge-chip badge-neutral">{formatMeetingCount(report.totalMeetingCount)}</span>
            <span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>
          </div>
        }
      />

      {rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-[620px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Встречи</th>
                <th className="px-3 py-3">Клуб / тип встречи</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const compareRow = compareByManager.get(row.managerId)
                const meetingGroups = buildMeetingBusinessClubGroups(row)
                const isExpanded = expandedMeetingHeatmapManagers.has(row.managerId)
                return (
                  <Fragment key={row.managerId}>
                    <tr className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Свернуть' : 'Раскрыть'} карту встреч ${row.managerName}`}
                          className="group inline-flex items-center gap-2 rounded-full px-1 py-1 text-left font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                          onClick={() => toggleMeetingHeatmap(row.managerId)}
                        >
                          <DisclosureIndicator expanded={isExpanded} />
                          <span>{row.managerName}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-900">{formatInteger(row.meetingCount)}</div>
                        {hasComparison ? (
                          <div className="text-xs text-slate-500">
                            С1: {formatInteger(compareRow?.meetingCount ?? 0)} ·{' '}
                            {formatCompareDelta(row.meetingCount, compareRow?.meetingCount ?? 0)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-2">
                          {meetingGroups.map((group) => (
                            <div
                              key={`${row.managerId}-${group.businessClubKey}`}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {group.businessClubLabel}
                              </span>
                              {group.meetingTypes.map((meetingType) => (
                                <span
                                  key={`${row.managerId}-${group.businessClubKey}-${meetingType.meetingSlotLabel ?? 'legacy'}-${meetingType.meetingTypeKey}`}
                                  {...(meetingType.meetingSlotIndex
                                    ? { 'data-meeting-slot-index': meetingType.meetingSlotIndex }
                                    : {})}
                                  className={getMeetingBusinessClubTypeBadgeClass(
                                    meetingType.meetingSlotIndex,
                                  )}
                                >
                                  <span>{formatMeetingBusinessClubTypeLabel(meetingType)}</span>
                                  <span className="opacity-70">{formatInteger(meetingType.count)}</span>
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <td colSpan={3} className="px-3 py-4">
                          <div
                            className="sticky left-0 min-w-0"
                            style={{ width: 'min(100%, calc(100vw - 5rem))' }}
                          >
                            <HourlyWeekdayHeatmap
                              title="Встречи по часам"
                              heatmap={row.meetingsHourlyHeatmap}
                              tone="meetings"
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="В выбранном периоде встречи по менеджерам не зафиксированы." />
      )}
    </section>
  )
}

function buildMeetingBusinessClubGroups(row: ActivitiesWorkloadReport['managerRows'][number]) {
  const grouped = new Map<
    string,
    {
      businessClubKey: string
      businessClubLabel: string
      meetingTypes: Array<{
        meetingSlotIndex: 1 | 2 | 3 | null
        meetingSlotLabel: string | null
        meetingTypeKey: string
        meetingTypeLabel: string
        count: number
      }>
    }
  >()
  const combinedBreakdown = row.meetingBusinessClubBreakdown ?? []

  if (combinedBreakdown.length === 0) {
    grouped.set('LEGACY', {
      businessClubKey: 'LEGACY',
      businessClubLabel: 'Без разреза по клубу',
      meetingTypes: row.meetingTypeBreakdown.map((meetingType) => ({
        meetingSlotIndex: null,
        meetingSlotLabel: null,
        ...meetingType,
      })),
    })
  } else {
    for (const item of combinedBreakdown) {
      const group = grouped.get(item.businessClubKey) ?? {
        businessClubKey: item.businessClubKey,
        businessClubLabel: item.businessClubLabel,
        meetingTypes: [],
      }

      group.meetingTypes.push({
        meetingSlotIndex: item.meetingSlotIndex ?? null,
        meetingSlotLabel: item.meetingSlotLabel ?? null,
        meetingTypeKey: item.meetingTypeKey,
        meetingTypeLabel: item.meetingTypeLabel,
        count: item.count,
      })
      grouped.set(item.businessClubKey, group)
    }
  }

  return Array.from(grouped.values())
}

function formatMeetingBusinessClubTypeLabel(
  item: ReturnType<typeof buildMeetingBusinessClubGroups>[number]['meetingTypes'][number],
) {
  return item.meetingSlotLabel
    ? `${item.meetingSlotLabel} · ${item.meetingTypeLabel}`
    : item.meetingTypeLabel
}

function getMeetingBusinessClubTypeBadgeClass(slotIndex: 1 | 2 | 3 | null | undefined) {
  const baseClass =
    'inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs font-medium shadow-[0_1px_0_rgba(15,23,42,0.03)]'

  switch (slotIndex) {
    case 1:
      return `${baseClass} border-amber-100 text-amber-700`
    case 2:
      return `${baseClass} border-violet-100 text-violet-700`
    case 3:
      return `${baseClass} border-rose-100 text-rose-700`
    default:
      return `${baseClass} border-slate-200 text-slate-700`
  }
}

function formatActivityConversionEventStages(
  row: ActivitiesWorkloadReport['conversionEventRows'][number],
) {
  if (row.stageBreakdown.length === 0) {
    return '—'
  }

  return row.stageBreakdown
    .map((stage) => `${formatInteger(stage.invitedCount)} ${stage.stageName}`)
    .join(', ')
}

function ActivitiesConversionEventsSection({
  report,
  conversionEvents,
}: {
  report: ActivitiesWorkloadReport | undefined
  conversionEvents: ConversionEventsReport | undefined
}) {
  if (!report) {
    return null
  }

  const rows = report.conversionEventRows ?? []
  const invitedCount = rows.reduce((total, row) => total + row.invitedCount, 0)
  const attendedCount = rows.reduce((total, row) => total + row.attendedCount, 0)
  const refusedCount = rows.reduce((total, row) => total + row.refusedCount, 0)
  const waitingCount = rows.reduce((total, row) => total + row.waitingCount, 0)
  const warnings = rows.length === 0 ? (conversionEvents?.warnings ?? []) : []

  return (
    <section
      className="panel min-w-0 p-5"
      data-comment-block-id="attraction-conversion-events"
      data-comment-block-label="Привлечение: конверсионные мероприятия"
      id="attraction-conversion-events"
    >
      <PanelHeading
        title="Конверсионные мероприятия"
        description="Срез отчета активности: кого звали на мероприятия привлечения, кто дошел, кто отказался и с каких этапов онтологии звали."
        right={
          <div className="flex flex-wrap gap-2">
            <span className="badge-chip badge-neutral">
              {formatInteger(rows.length)} мероприятий
            </span>
            <span className="badge-chip badge-neutral">
              {formatInteger(attendedCount)} / {formatInteger(invitedCount)} дошли
            </span>
            <span className="badge-chip badge-neutral">
              {formatInteger(refusedCount)} отказ · {formatInteger(waitingCount)} ждут
            </span>
          </div>
        }
      />

      {warnings.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warnings.length} warnings: {warnings.slice(0, 3).join(' · ')}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Мероприятие</th>
                <th className="px-3 py-3 text-right">Пригласили</th>
                <th className="px-3 py-3 text-right">Дошли</th>
                <th className="px-3 py-3 text-right">Отказ</th>
                <th className="px-3 py-3 text-right">Еще ждут</th>
                <th className="px-3 py-3">С каких этапов звали</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.eventKey} className="border-b border-slate-100 align-top last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.eventName}</td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {formatInteger(row.invitedCount)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatInteger(row.attendedCount)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatInteger(row.refusedCount)}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{formatInteger(row.waitingCount)}</td>
                  <td className="min-w-[320px] px-3 py-3 text-slate-700">
                    {formatActivityConversionEventStages(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState
          message={
            warnings.length > 0
              ? 'Снимок конверсионных мероприятий не загружен. Проверьте доступ вебхука к smart-process «Посещения мероприятий» и запустите обновление данных.'
              : 'В выбранном периоде конверсионные мероприятия не найдены.'
          }
        />
      )}
    </section>
  )
}

function ActivitiesSlaSection({
  report,
  filters,
}: {
  report: ActivitiesWorkloadReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const compareByManager = new Map(
    (report.comparisons?.[0]?.snapshot.managerRows ?? []).map((row) => [row.managerId, row]),
  )
  const rows = report.managerRows.filter((row) => row.slaMetrics.length > 0)

  return (
    <section
      className="panel p-5"
      data-comment-block-id="attraction-activities-sla"
      data-comment-block-label="Привлечение: SLA и активность"
      id="attraction-activities-sla"
    >
      <PanelHeading
        title="SLA"
        description="SLA считается только для новых сделок источника «Лидген УС» с итоговым качеством «Готов ко встрече». SLA1 — перевод из базы входящей в «Звонок-знакомство», SLA2 — первый звонок, SLA3 — два звонка и переход дальше за 3 рабочих дня."
        right={<span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>}
      />

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {rows.map((row) => {
            const compareRow = compareByManager.get(row.managerId)
            const compareMetrics = new Map(
              (compareRow?.slaMetrics ?? []).map((metric) => [metric.slaKey, metric]),
            )
            const slaDealCount = row.slaMetrics[0]
              ? row.slaMetrics[0].onTimeCount +
                row.slaMetrics[0].lateCount +
                row.slaMetrics[0].noTouchCount
              : 0

            return (
              <article key={row.managerId} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">{row.managerName}</h3>
                  <p className="text-xs text-slate-500">{formatInteger(slaDealCount)} сделок в SLA</p>
                </div>
                <div className="space-y-3">
                  {row.slaMetrics.map((metric) => {
                    const compareMetric = compareMetrics.get(metric.slaKey)
                    return (
                      <div key={`${row.managerId}-${metric.slaKey}`} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{metric.label}</div>
                          <span className="text-xs font-semibold text-slate-500">
                            С1 {compareMetric ? `${compareMetric.medianHours} ч` : '—'}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <span className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                            on-time {metric.onTimeCount}
                          </span>
                          <span
                            className={`rounded-lg px-2 py-1 font-semibold ${
                              metric.lateCount === 0
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            late {metric.lateCount}
                          </span>
                          <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                            no-touch {metric.noTouchCount}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          медиана {metric.medianHours} ч ·{' '}
                          {formatCompareDelta(
                            metric.medianHours,
                            compareMetric?.medianHours ?? 0,
                            'days',
                          ).replace(' дн.', ' ч')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <OutcomeEmptyState message="SLA-метрики пока не рассчитались для выбранного периода." />
      )}
    </section>
  )
}

function BusinessClubWorkloadSection({
  report,
  filters,
}: {
  report: AcquisitionOutcomesReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Нагрузка по заказчикам"
        description="Открытые сделки в воронке по менеджерам: отдельно бизнес-клуб заказчика и таргет-группа."
        right={<span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>}
      />

      {report.businessClubByManager.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Бизнес-клуб заказчика</th>
                <th className="px-3 py-3">Таргет-группа</th>
                <th className="px-3 py-3 text-right">Открыто сделок</th>
              </tr>
            </thead>
            <tbody>
              {report.businessClubByManager.map((row) => (
                <tr key={row.managerId} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.managerName}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.businessClubs.map((club) => (
                        <span
                          key={`${row.managerId}-${club.businessClubKey}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <span>{club.businessClubLabel}</span>
                          <span className="text-slate-400">{formatInteger(club.count)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.targetGroups.map((targetGroup) => (
                        <span
                          key={`${row.managerId}-${targetGroup.targetGroupKey}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <span>{targetGroup.targetGroupLabel}</span>
                          <span className="text-slate-400">{formatInteger(targetGroup.count)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {formatInteger(row.totalDeals)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="В текущей воронке нет открытых сделок по выбранным фильтрам." />
      )}
    </section>
  )
}

export function ActivitiesScene({ filters, runtimeData }: SceneComponentProps) {
  const [summarySort, setSummarySort] = useState<ActivitySummarySort>({
    index: 2,
    direction: 'desc',
  })
  const [expandedSummaryHeatmapManagers, setExpandedSummaryHeatmapManagers] = useState<Set<string>>(() => new Set())
  const isUnavailable =
    runtimeData?.operationalStatus !== 'ready' && !runtimeData?.activitiesCalls
  const sceneData = getActivitiesSceneData(runtimeData)
  const activitiesWorkload = runtimeData?.activitiesWorkload
  const acquisitionOutcomes = runtimeData?.acquisitionOutcomes
  const visibleWarnings = sceneData.warnings.filter(isVisibleActivityWarning)
  const sortedSummaryRows = sortActivitySummaryRows(sceneData.summaryRows, summarySort)
  const matrixStageLabels = sceneData.matrixRows[0]?.stages.map((stage) => stage.label) ?? activityStages

  function toggleSummarySort(index: number) {
    setSummarySort((current) => ({
      index,
      direction: current.index === index && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  function toggleSummaryHeatmap(manager: string) {
    setExpandedSummaryHeatmapManagers((current) => {
      const next = new Set(current)
      if (next.has(manager)) {
        next.delete(manager)
      } else {
        next.add(manager)
      }

      return next
    })
  }

  if (isUnavailable) {
    return (
      <section
        className="panel min-w-0 p-5"
        data-comment-block-id={runtimeData?.activitySummaryCommentBlockId}
        data-comment-block-label={runtimeData?.activitySummaryCommentBlockLabel}
      >
        <PanelHeading
          title="Отчет активности"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные отчёта активности.'
              : 'Live-данные отчёта активности сейчас недоступны.'
          }
        />
      </section>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      {SHOW_ACTIVITY_MATRIX ? (
      <section className="panel min-w-0 p-5">
        <PanelHeading
          title="Матрица активности"
          description="Показывает текущий период, сравнение и процентную динамику по выбранному окну фильтров."
          right={
            <div className="flex flex-wrap gap-2">
              <span className="badge-chip badge-neutral">
                {sceneData.managerCount} менеджера · {sceneData.stageCount} этапов
              </span>
              <span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>
            </div>
          }
        />
        {visibleWarnings.length > 0 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {visibleWarnings.join(' · ')}
          </div>
        ) : null}
        <div className="w-full max-w-full overflow-x-auto">
          <table className="min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
	                {matrixStageLabels.map((stage) => (
	                  <th key={stage} className="px-3 py-3">{stage}</th>
	                ))}
                <th className="px-3 py-3">Итого</th>
              </tr>
            </thead>
            <tbody>
              {sceneData.matrixRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold text-slate-900">{row.manager}</div>
                  </td>
                  {row.stages.map((stage) => (
	                    <td key={`${row.manager}-${stage.label}`} className="min-w-[168px] px-2 py-3 align-top">
	                      <div
	                        className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 px-2 py-2"
	                        aria-label={`${row.manager}, ${stage.label}: ${stage.totalCalls} звонков, ${stage.totalClosedTasks} закрытых дела`}
	                        style={{
	                          backgroundColor:
                            stage.level >= 5 ? 'rgba(77,124,255,0.18)' :
                            stage.level === 4 ? 'rgba(77,124,255,0.14)' :
                            stage.level === 3 ? 'rgba(77,124,255,0.1)' :
                            stage.level === 2 ? 'rgba(77,124,255,0.07)' :
                            'rgba(77,124,255,0.04)',
	                        }}
	                      >
	                        <ActivityStageMetricCard
	                          label="Звонки"
	                          value={stage.totalCalls}
	                          unit="шт."
	                          average={stage.callsPerDeal}
	                          delta={stage.callsDelta ?? getStageDelta(stage.level)}
	                        />
	                        <ActivityStageMetricCard
	                          label="Дела"
	                          value={stage.totalClosedTasks}
	                          unit="закр."
	                          average={stage.closedTasksAvg}
	                          delta={stage.closedTasksDelta ?? (stage.level >= 3 ? '+5%' : '-4%')}
	                        />
	                      </div>
	                    </td>
                  ))}
                  <td className="px-3 py-3 align-top">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
	                        <span className="text-slate-500">Звонки</span>
	                        <span className="flex items-center gap-2">
	                          <strong className="text-slate-900">{row.totalCalls}</strong>
	                          <DeltaPill value={row.avgCallsDelta ?? '+7%'} />
	                        </span>
	                      </div>
	                      <div className="mt-1 text-xs font-medium text-slate-500">ср. {row.avgCalls} / сделку</div>
	                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
	                        <span className="text-slate-500">Закрыто дел</span>
	                        <span className="flex items-center gap-2">
	                          <strong className="text-slate-900">{row.totalClosedTasks}</strong>
	                          <DeltaPill value={row.avgClosedTasksDelta ?? '+4%'} />
	                        </span>
	                      </div>
	                      <div className="mt-1 text-xs font-medium text-slate-500">ср. {row.avgClosedTasks} / сделку</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section
        className="panel min-w-0 p-5"
        data-comment-block-id={runtimeData?.activitySummaryCommentBlockId}
        data-comment-block-label={runtimeData?.activitySummaryCommentBlockLabel}
      >
        <PanelHeading
          title="Сводка по менеджерам"
          description="Абсолютные значения и динамика относительно первого периода сравнения."
          right={<span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>}
        />
        <div className="w-full max-w-full overflow-x-auto">
          <table className="min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
	                {activitySummaryColumns.map((column) => {
	                  const isActive = summarySort.index === column.index

	                  return (
	                  <th
	                    key={column.index}
	                    className="px-3 py-3"
	                    aria-sort={
	                      isActive
	                        ? summarySort.direction === 'desc'
	                          ? 'descending'
	                          : 'ascending'
	                        : 'none'
	                    }
	                  >
	                    <button
	                      type="button"
	                      className="group flex min-w-[120px] items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
	                      onClick={() => toggleSummarySort(column.index)}
	                    >
                      <span>
                        <span className="block">{column.label}</span>
                        {column.hint ? (
                          <span className="block text-[0.62rem] normal-case tracking-normal text-slate-400">
                            {column.hint}
                          </span>
                        ) : null}
                      </span>
	                      <SortIndicator active={isActive} direction={summarySort.direction} />
	                    </button>
	                  </th>
	                )})}
              </tr>
            </thead>
            <tbody>
              {sortedSummaryRows.map((row) => {
                const isExpanded = expandedSummaryHeatmapManagers.has(row.manager)

                return (
                  <Fragment key={row.manager}>
                    <tr className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-3 align-top">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Свернуть' : 'Раскрыть'} карту звонков и дел ${row.manager}`}
                          className="group inline-flex items-center gap-2 rounded-full px-1 py-1 text-left font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                          onClick={() => toggleSummaryHeatmap(row.manager)}
                        >
                          <DisclosureIndicator expanded={isExpanded} />
                          <span>{row.manager}</span>
                        </button>
                      </td>
                      {getActivitySummaryCells(row).map((cell, index) => (
                        <td key={`${row.manager}-${cell.key}`} className="px-3 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span>{cell.value}</span>
                            <DeltaPill value={row.deltas?.[index] ?? activitySummaryDeltas[row.manager]?.[index] ?? '0%'} />
                          </span>
                          {cell.helper ? (
                            <span className="mt-1 block text-xs font-medium text-slate-400">{cell.helper}</span>
                          ) : null}
                          {row.comparePoints && row.comparePoints.length > 0 ? (
                            <div className="mt-2 grid max-w-[190px] gap-1">
                              {row.comparePoints.slice(0, 5).map((point) => (
                                <span
                                  key={`${row.manager}-${cell.key}-${point.label}`}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.68rem] font-semibold text-slate-600"
                                >
                                  {point.label} {point.values[index]} / {point.deltas[index]}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <td colSpan={activitySummaryColumns.length + 1} className="px-3 py-4">
                          <div
                            className="sticky left-0 min-w-0"
                            style={{ width: 'min(100%, calc(100vw - 5rem))' }}
                          >
                            <div
                              className="grid min-w-0 gap-3 xl:grid-cols-2"
                              data-testid="activity-summary-heatmap-grid"
                            >
                              <HourlyWeekdayHeatmap
                                title="Исходящие звонки по часам"
                                heatmap={row.callsHourlyHeatmap}
                                tone="calls"
                              />
                              <HourlyWeekdayHeatmap
                                title="Задачи по часам"
                                heatmap={row.tasksHourlyHeatmap}
                                tone="tasks"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {activitiesWorkload ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <ActivitiesMeetingsSection report={activitiesWorkload} filters={filters} />
          <ActivitiesConversionEventsSection
            report={activitiesWorkload}
            conversionEvents={runtimeData?.conversionEvents}
          />
        </div>
      ) : null}

      <ActivitiesSlaSection report={activitiesWorkload} filters={filters} />

      {acquisitionOutcomes ? (
        <AcquisitionOutcomesSection report={acquisitionOutcomes} filters={filters} />
      ) : null}

      <BusinessClubWorkloadSection report={acquisitionOutcomes} filters={filters} />
    </div>
  )
}

type RevenueVelocitySortKey =
  | 'createdDeals'
  | 'activeDeals'
  | 'wonDeals'
  | 'lostDeals'
  | 'wipDeals'
  | 'salesAmount'
  | 'averageCheck'
  | 'winRate'
  | 'averageCycleDays'
  | 'revenueVelocityPerDay'
  | 'activePipelineAmount'
  | 'expectedPipelineAmount'
  | 'expectedPipelineDelta'
  | 'liveRevenueVelocity'
  | 'velocityDelta'
  | 'realizedWonAmountInPeriod'
  | 'systemValueCreated'
  | 'systemValuePerActionPoint'
  | 'historicalMoneyPerActionPoint'
  | 'estimatedFutureMoneyFromPeriodActions'
  | 'connectedCallsOverThirtySeconds'
  | 'meetingsCount'
  | 'conversionEventsCount'
  | 'closedTasks'
  | 'weightedActionPoints'
  | 'moneyPerMeeting'
  | 'moneyPerConnectedCallOverThirtySeconds'
  | 'moneyPerConversionEvent'
  | 'moneyPerWeightedActionPoint'
  | 'weightedActionPointsPerWin'
  | 'actionEfficiencyIndex'

const revenueVelocityViews: Array<{
  key: RevenueVelocityView
  label: string
  description: string
}> = [
  {
    key: 'systemState',
    label: 'Состояние системы',
    description: 'Период — окно наблюдения: состояние активной воронки на конец периода и изменение к прошлой неделе.',
  },
  {
    key: 'operationalPeriod',
    label: 'Оперативно',
    description: 'События периода: действия, закрытия, изменение ожидаемых денег воронки и системный прирост.',
  },
  {
    key: 'createdCohort',
    label: 'Когорты',
    description: 'Когорта создания: период выбирает сделки по dateCreate и считает их lifetime действия до закрытия/asOf.',
  },
]

const revenueVelocityDimensions: Array<{
  key: RevenueVelocityDimension
  label: string
}> = [
  { key: 'manager', label: 'Менеджеры' },
  { key: 'source', label: 'Источники' },
  { key: 'customer', label: 'Заказчики' },
  { key: 'managerSource', label: 'Менеджер × источник' },
  { key: 'sourceCustomer', label: 'Источник × заказчик' },
  { key: 'managerCustomer', label: 'Менеджер × заказчик' },
]

const REVENUE_WARNING_DETAIL_LIMIT = 8

function formatRubles(value: number) {
  return `${formatInteger(Math.round(value))} ₽`
}

function formatRublesPerDay(value: number) {
  return `${formatInteger(Math.round(value))} ₽/день`
}

function formatOptionalRubles(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? formatRubles(value) : '—'
}

function formatOptionalRublesPerDay(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? formatRublesPerDay(value) : '—'
}

function formatOptionalPercent(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${formatPercent(value * 100)}%`
    : '—'
}

function formatOptionalDays(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)} дн.` : '—'
}

function formatOptionalDecimal(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : '—'
}

function getRevenueVelocityFormula(row: RevenueVelocityRow, isCohortView: boolean) {
  if (row.revenueVelocityFormula) {
    return row.revenueVelocityFormula
  }

  return {
    source: isCohortView ? 'selectedCohort' : 'rollingQuarterCohort',
    sourceLabel: isCohortView ? 'Выбранная когорта' : 'Когорта за последние 90 дней',
    averageRevenueAmount: row.averageCheck,
    opportunitiesCount: isCohortView ? row.createdDeals : row.activeDeals,
    conversionRate: row.winRate,
    averageCycleDays: row.averageCycleDays,
    value: isCohortView ? row.revenueVelocityPerDay : row.liveRevenueVelocity,
    benchmarkFrom: null,
    benchmarkTo: null,
    missingReason: null,
  } satisfies RevenueVelocityFormulaBreakdown
}

function formatRevenueVelocityEquation(formula: RevenueVelocityFormulaBreakdown) {
  return `${formatOptionalRublesPerDay(formula.value)} = ${formatOptionalRubles(
    formula.averageRevenueAmount,
  )} × ${formatInteger(formula.opportunitiesCount)} × ${formatOptionalPercent(
    formula.conversionRate,
  )} ÷ ${formatOptionalDays(formula.averageCycleDays)}`
}

function RevenueVelocityFormulaCard({
  formula,
  tooltip,
}: {
  formula: RevenueVelocityFormulaBreakdown
  tooltip?: string | undefined
}) {
  const sourceText =
    formula.source === 'rollingQuarterCohort'
      ? 'Конверсия берётся когортная за последние 90 дней; активные возможности — сделки в clean-стадиях на конец периода.'
      : 'Формула рассчитана по выбранной когорте создания сделок.'
  const detailTooltip = [tooltip, sourceText, formula.missingReason].filter(Boolean).join(' ')
  const opportunitiesLabel =
    formula.source === 'rollingQuarterCohort' ? 'активные возможности' : 'возможности'

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3 md:col-span-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
          Формула
        </div>
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-blue-700"
          title={detailTooltip}
          aria-label="Как считается денежная скорость"
        >
          ?
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-700">
        Денежная скорость = средний доход × {opportunitiesLabel} × конверсия ÷ цикл
      </div>
      <p className="mt-3 text-lg font-bold text-slate-950">
        {formatRevenueVelocityEquation(formula)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {formula.sourceLabel}
        {formula.missingReason ? ` · ${formula.missingReason}` : ''}
      </p>
    </div>
  )
}

function formatDealWarningCount(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${formatInteger(count)} сделок`
  }

  if (lastDigit === 1) {
    return `${formatInteger(count)} сделка`
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${formatInteger(count)} сделки`
  }

  return `${formatInteger(count)} сделок`
}

function formatWonDealWarningCount(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${formatInteger(count)} выигранных сделок`
  }

  if (lastDigit === 1) {
    return `${formatInteger(count)} выигранная сделка`
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${formatInteger(count)} выигранные сделки`
  }

  return `${formatInteger(count)} выигранных сделок`
}

function formatSystemWarningCount(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${formatInteger(count)} системных предупреждений`
  }

  if (lastDigit === 1) {
    return `${formatInteger(count)} системное предупреждение`
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${formatInteger(count)} системных предупреждения`
  }

  return `${formatInteger(count)} системных предупреждений`
}

function summarizeRevenueWarnings(warnings: string[]) {
  const uniqueWarnings = Array.from(new Set(warnings.filter(Boolean)))
  const missingFinalWonFields = uniqueWarnings.filter((warning) =>
    warning.includes('target group and tariff are required for finalWon pricing'),
  ).length
  const missingPipelineFields = uniqueWarnings.filter((warning) =>
    warning.includes('target group and tariff are required for pipelinePlan pricing'),
  ).length
  const missingPricingRules = uniqueWarnings.filter((warning) =>
    warning.includes('no pricing rule for customer'),
  ).length
  const pricingConflicts = uniqueWarnings.filter((warning) =>
    warning.includes('priced as ClubFirst Future while target group'),
  ).length
  const otherWarnings =
    uniqueWarnings.length -
    missingFinalWonFields -
    missingPipelineFields -
    missingPricingRules -
    pricingConflicts
  const summaryParts: string[] = []

  if (missingFinalWonFields > 0) {
    summaryParts.push(
      `${formatWonDealWarningCount(missingFinalWonFields)} без договорных полей`,
    )
  }
  if (missingPipelineFields > 0) {
    summaryParts.push(
      `${formatDealWarningCount(missingPipelineFields)} без заказчика/таргет-группы для оценки активной воронки`,
    )
  }
  if (missingPricingRules > 0) {
    summaryParts.push(`${formatDealWarningCount(missingPricingRules)} без правила цены`)
  }
  if (pricingConflicts > 0) {
    summaryParts.push(`${formatDealWarningCount(pricingConflicts)} с конфликтом тарифа`)
  }
  if (otherWarnings > 0) {
    summaryParts.push(formatSystemWarningCount(otherWarnings))
  }

  return {
    count: uniqueWarnings.length,
    summary:
      summaryParts.length > 0
        ? summaryParts.join(' · ')
        : `${formatInteger(uniqueWarnings.length)} предупреждений`,
    details: uniqueWarnings.slice(0, REVENUE_WARNING_DETAIL_LIMIT),
    hiddenCount: Math.max(0, uniqueWarnings.length - REVENUE_WARNING_DETAIL_LIMIT),
  }
}

function WarningSummaryBlock({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) {
    return null
  }

  const warningSummary = summarizeRevenueWarnings(warnings)

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Предупреждения расчёта</div>
          <div>{warningSummary.summary}</div>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
          {formatInteger(warningSummary.count)}
        </span>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-amber-800">
          Показать детали
        </summary>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2 text-xs leading-5">
          {warningSummary.details.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          {warningSummary.hiddenCount > 0 ? (
            <li className="font-semibold">
              Ещё {formatInteger(warningSummary.hiddenCount)} предупреждений скрыто.
            </li>
          ) : null}
        </ul>
      </details>
    </div>
  )
}

function getRevenueVelocityTooltip(
  key: string,
  report: RevenueVelocityReport | null,
) {
  const fromReport = report?.formulaTooltips.find((tooltip) => tooltip.key === key)
  const fromRegistry =
    revenueVelocityTooltips[key as keyof typeof revenueVelocityTooltips]
  const tooltip = fromReport ?? fromRegistry

  if (!tooltip) {
    return undefined
  }

  return [tooltip.formula, tooltip.description, tooltip.emptyState]
    .filter(Boolean)
    .join(' · ')
}

function readRevenueVelocitySortValue(
  row: RevenueVelocityRow,
  key: RevenueVelocitySortKey,
) {
  if (key === 'connectedCallsOverThirtySeconds') {
    return row.actions.connectedCallsOverThirtySeconds
  }
  if (key === 'meetingsCount') {
    return row.actions.meetingsCount
  }
  if (key === 'conversionEventsCount') {
    return row.actions.conversionEventsCount
  }
  if (key === 'closedTasks') {
    return row.actions.closedTasks
  }
  if (key === 'weightedActionPoints') {
    return row.actions.weightedActionPoints
  }
  if (key === 'activePipelineAmount') {
    return row.activePipelineAmount
  }
  if (key === 'expectedPipelineAmount') {
    return row.expectedPipelineAmount ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'expectedPipelineDelta') {
    return row.expectedPipelineDelta ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'liveRevenueVelocity') {
    return row.liveRevenueVelocity ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'velocityDelta') {
    return row.velocityDelta ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'realizedWonAmountInPeriod') {
    return row.realizedWonAmountInPeriod
  }
  if (key === 'systemValueCreated') {
    return row.systemValueCreated ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'systemValuePerActionPoint') {
    return row.systemValuePerActionPoint ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'historicalMoneyPerActionPoint') {
    return row.historicalMoneyPerActionPoint ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'estimatedFutureMoneyFromPeriodActions') {
    return row.estimatedFutureMoneyFromPeriodActions ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'moneyPerMeeting') {
    return row.moneyPerAction.moneyPerMeeting ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'moneyPerConnectedCallOverThirtySeconds') {
    return row.moneyPerAction.moneyPerConnectedCallOverThirtySeconds ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'moneyPerConversionEvent') {
    return row.moneyPerAction.moneyPerConversionEvent ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'moneyPerWeightedActionPoint') {
    return row.moneyPerAction.moneyPerWeightedActionPoint ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'weightedActionPointsPerWin') {
    return row.actions.weightedActionPointsPerWin ?? Number.NEGATIVE_INFINITY
  }
  if (key === 'actionEfficiencyIndex') {
    return row.moneyPerAction.actionEfficiencyIndex ?? Number.NEGATIVE_INFINITY
  }

  return row[key] ?? Number.NEGATIVE_INFINITY
}

function RevenueVelocityHeader({
  label,
  sortKey,
  activeSort,
  tooltip,
  onSort,
}: {
  label: string
  sortKey: RevenueVelocitySortKey
  activeSort: { key: RevenueVelocitySortKey; direction: 'asc' | 'desc' }
  tooltip?: string | undefined
  onSort: (key: RevenueVelocitySortKey) => void
}) {
  return (
    <th className="px-2 py-2">
      <button
        type="button"
        className="group inline-flex items-center gap-1 text-left"
        onClick={() => onSort(sortKey)}
        title={tooltip}
      >
        <span>{label}</span>
        <span className="text-slate-400">
          {activeSort.key === sortKey ? (activeSort.direction === 'desc' ? '↓' : '↑') : '↕'}
        </span>
      </button>
    </th>
  )
}

export function RevenueVelocityScene({ filters, runtimeData }: SceneComponentProps) {
  const [view, setView] = useState<RevenueVelocityView>('systemState')
  const [dimension, setDimension] = useState<RevenueVelocityDimension>('manager')
  const [sort, setSort] = useState<{
    key: RevenueVelocitySortKey
    direction: 'asc' | 'desc'
  }>({ key: 'activePipelineAmount', direction: 'desc' })
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [fetchedReport, setFetchedReport] = useState<{
    view: RevenueVelocityView
    dimension: RevenueVelocityDimension
    runtimeKey: string
    report: RevenueVelocityReport
  } | null>(null)
  const [dimensionError, setDimensionError] = useState<{
    view: RevenueVelocityView
    dimension: RevenueVelocityDimension
    runtimeKey: string
    message: string
  } | null>(null)
  const query = useMemo(() => buildDashboardQueryFromProtoFilters(filters), [filters])
  const runtimeKey = JSON.stringify({
    preset: query.preset,
    from: 'from' in query ? query.from : null,
    to: 'to' in query ? query.to : null,
    managers: query.managerIds,
    sources: query.sourceKeys,
    businessClubs: query.businessClubKeys,
    targetGroups: query.targetGroupKeys,
    view,
    dimension,
  })
  const fetchedDimensionReport =
    fetchedReport?.view === view &&
    fetchedReport.dimension === dimension &&
    fetchedReport.runtimeKey === runtimeKey
      ? fetchedReport.report
      : null
  const report = fetchedDimensionReport
  const dimensionErrorMessage =
    dimensionError?.view === view &&
    dimensionError.dimension === dimension &&
    dimensionError.runtimeKey === runtimeKey
      ? dimensionError.message
      : null
  const needsDimensionFetch =
    Boolean(runtimeData && runtimeData.operationalStatus === 'ready') &&
    !fetchedDimensionReport
  const loadingDimension = needsDimensionFetch && !dimensionErrorMessage
  const isUnavailable = runtimeData?.operationalStatus !== 'ready' && !report

  useEffect(() => {
    if (!needsDimensionFetch) {
      return
    }

    let cancelled = false

    apiClient
      .getRevenueVelocityReport({
        ...query,
        view,
        dimension,
        compareRanges: [],
      })
      .then((nextReport) => {
        if (!cancelled) {
          setFetchedReport({ view, dimension, runtimeKey, report: nextReport })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDimensionError({
            view,
            dimension,
            runtimeKey,
            message:
              error instanceof Error
                ? error.message
                : 'Не удалось загрузить разрез денежной скорости',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [dimension, needsDimensionFetch, query, runtimeKey, view])

  const sortedRows = useMemo(() => {
    const rows = [...(report?.rows ?? [])]
    return rows.sort((left, right) => {
      const leftValue = readRevenueVelocitySortValue(left, sort.key)
      const rightValue = readRevenueVelocitySortValue(right, sort.key)
      const result =
        leftValue === rightValue
          ? left.label.localeCompare(right.label, 'ru-RU')
          : leftValue - rightValue

      return sort.direction === 'asc' ? result : -result
    })
  }, [report?.rows, sort])

  function handleSort(key: RevenueVelocitySortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  if (isUnavailable) {
    return (
      <section
        className="panel p-5"
        data-comment-block-id="attraction-revenue-velocity"
        data-comment-block-label="Привлечение: денежная скорость"
        id="attraction-revenue-velocity"
      >
        <PanelHeading
          title="Денежная скорость"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные revenue velocity.'
              : 'Live-данные revenue velocity сейчас недоступны.'
          }
        />
      </section>
    )
  }

  const totals = report?.totals
  const warnings = Array.from(new Set([...(report?.warnings ?? []), ...(totals?.warnings ?? [])]))
  const isCohortView = view === 'createdCohort'
  const activeView = revenueVelocityViews.find((item) => item.key === view) ?? revenueVelocityViews[0]
  const hasNoDeals = isCohortView
    ? (totals?.createdDeals ?? 0) === 0
    : (totals?.activeDeals ?? 0) === 0 &&
      (totals?.wonDealsInPeriod ?? 0) === 0 &&
      (totals?.actions.weightedActionPoints ?? 0) === 0
  const hasNoWonDeals = isCohortView && !hasNoDeals && (totals?.wonDeals ?? 0) === 0
  const hasNoActions = isCohortView && (totals?.actions.weightedActionPoints ?? 0) === 0
  const kpis = isCohortView
    ? [
        {
          label: 'Доход Привлечения',
          value: formatRubles(totals?.salesAmount ?? 0),
          tooltipKey: 'salesAmount',
        },
        {
          label: 'Денежная скорость, ₽/день',
          value: formatOptionalRublesPerDay(totals?.revenueVelocityPerDay ?? null),
          tooltipKey: 'revenueVelocityPerDay',
        },
        {
          label: 'Средний доход',
          value: formatOptionalRubles(totals?.averageCheck ?? null),
          tooltipKey: 'averageCheck',
        },
        {
          label: 'Конверсия',
          value: formatOptionalPercent(totals?.winRate ?? null),
          tooltipKey: 'winRate',
        },
        {
          label: '₽ / балл действий',
          value: formatOptionalRubles(totals?.moneyPerAction.moneyPerWeightedActionPoint ?? null),
          tooltipKey: 'moneyPerWeightedActionPoint',
        },
      ]
    : [
        {
          label: 'Факт денег периода',
          value: formatRubles(totals?.realizedWonAmountInPeriod ?? 0),
          tooltipKey: 'realizedWonAmountInPeriod',
        },
        {
          label: 'Активная воронка',
          value: formatRubles(totals?.activePipelineAmount ?? 0),
          tooltipKey: 'activePipelineAmount',
        },
        {
          label: 'Денежная скорость',
          value: formatOptionalRublesPerDay(totals?.liveRevenueVelocity ?? null),
          tooltipKey: 'liveRevenueVelocity',
        },
        {
          label: 'Изменение скорости',
          value: formatOptionalRublesPerDay(totals?.velocityDelta ?? null),
          tooltipKey: 'velocityDelta',
        },
        {
          label: 'Системный прирост',
          value: formatOptionalRubles(totals?.systemValueCreated ?? null),
          tooltipKey: 'systemValueCreated',
        },
        {
          label: 'Действия, баллы',
          value: formatNumber(totals?.actions.weightedActionPoints ?? 0),
          tooltipKey: 'weightedActionPoints',
        },
        {
          label: '₽ системного прироста / балл',
          value: formatOptionalRubles(totals?.systemValuePerActionPoint ?? null),
          tooltipKey: 'systemValuePerActionPoint',
        },
        {
          label: 'Оценка будущих денег от действий',
          value: formatOptionalRubles(totals?.estimatedFutureMoneyFromPeriodActions ?? null),
          tooltipKey: 'estimatedFutureMoneyFromPeriodActions',
        },
      ]

  return (
    <div className="space-y-6">
      <section
        className="panel p-5"
        data-comment-block-id="attraction-revenue-velocity"
        data-comment-block-label="Привлечение: денежная скорость"
        id="attraction-revenue-velocity"
      >
        <PanelHeading
          title="Денежная скорость"
          description={activeView?.description ?? ''}
          right={
            <div className="flex flex-wrap gap-2">
              <span className="badge-chip badge-neutral">{report?.rows.length ?? 0} строк</span>
              <span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>
            </div>
          }
        />

        <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-sm">
          {revenueVelocityViews.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setView(item.key)
                setExpandedKey(null)
                setSort({
                  key: item.key === 'createdCohort' ? 'revenueVelocityPerDay' : 'activePipelineAmount',
                  direction: 'desc',
                })
              }}
              className={
                view === item.key
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-sm">
          {revenueVelocityDimensions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setDimension(item.key)}
              className={
                dimension === item.key
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
              }
            >
              {item.label}
            </button>
          ))}
          {loadingDimension ? (
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              обновляю разрез
            </span>
          ) : null}
        </div>

        {dimensionErrorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {dimensionErrorMessage}
          </div>
        ) : null}

        <WarningSummaryBlock warnings={warnings} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          {kpis.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              title={getRevenueVelocityTooltip(metric.tooltipKey, report)}
            >
              <p className="subtle-label">{metric.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel overflow-auto p-3">
        {hasNoDeals ? (
          <div className="p-4 text-sm text-slate-600">
            {isCohortView
              ? 'Нет сделок в выбранной когорте.'
              : 'Нет активной воронки, закрытий или действий в выбранном окне наблюдения.'}
          </div>
        ) : hasNoWonDeals ? (
          <div className="p-4 text-sm text-slate-600">
            В выбранной когорте пока нет выигранных сделок. Денежные метрики появятся после первых успешных закрытий.
          </div>
        ) : hasNoActions ? (
          <div className="p-4 text-sm text-slate-600">
            По сделкам когорты не найдено связанных действий.
          </div>
        ) : (
          <table className="min-w-[1240px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-2 py-2">Срез</th>
                <RevenueVelocityHeader label="Активные сделки" sortKey="activeDeals" activeSort={sort} onSort={handleSort} />
                <RevenueVelocityHeader label="Активная воронка" sortKey="activePipelineAmount" activeSort={sort} onSort={handleSort} tooltip={getRevenueVelocityTooltip('activePipelineAmount', report)} />
                <RevenueVelocityHeader label="Факт продаж" sortKey="realizedWonAmountInPeriod" activeSort={sort} onSort={handleSort} tooltip={getRevenueVelocityTooltip('realizedWonAmountInPeriod', report)} />
                <RevenueVelocityHeader
                  label="Денежная скорость"
                  sortKey={isCohortView ? 'revenueVelocityPerDay' : 'liveRevenueVelocity'}
                  activeSort={sort}
                  onSort={handleSort}
                  tooltip={getRevenueVelocityTooltip(isCohortView ? 'revenueVelocityPerDay' : 'liveRevenueVelocity', report)}
                />
                <RevenueVelocityHeader label="Выиграно" sortKey="wonDeals" activeSort={sort} onSort={handleSort} tooltip={getRevenueVelocityTooltip('wonDeals', report)} />
                <RevenueVelocityHeader label="Действия, баллы" sortKey="weightedActionPoints" activeSort={sort} onSort={handleSort} tooltip={getRevenueVelocityTooltip('weightedActionPoints', report)} />
                <RevenueVelocityHeader label="Системный прирост" sortKey="systemValueCreated" activeSort={sort} onSort={handleSort} tooltip={getRevenueVelocityTooltip('systemValueCreated', report)} />
                <th className="px-2 py-2">Сигнал</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <Fragment key={row.key}>
                  <tr className="border-b border-slate-100 last:border-b-0">
                    <td className="px-2 py-2 font-semibold text-slate-900">
                      <button
                        type="button"
                        className="group inline-flex items-center gap-2 text-left"
                        onClick={() => setExpandedKey((current) => current === row.key ? null : row.key)}
                      >
                        <DisclosureIndicator expanded={expandedKey === row.key} />
                        <span>{row.label}</span>
                      </button>
                    </td>
                    <td className="px-2 py-2">{formatInteger(row.activeDeals)}</td>
                    <td className="px-2 py-2">{formatRubles(row.activePipelineAmount)}</td>
                    <td className="px-2 py-2">{formatRubles(row.realizedWonAmountInPeriod)}</td>
                    <td className="px-2 py-2">
                      {formatOptionalRublesPerDay(
                        isCohortView ? row.revenueVelocityPerDay : row.liveRevenueVelocity,
                      )}
                    </td>
                    <td className="px-2 py-2">{formatInteger(row.wonDeals)}</td>
                    <td className="px-2 py-2">{formatNumber(row.actions.weightedActionPoints)}</td>
                    <td className="px-2 py-2">{formatOptionalRubles(row.systemValueCreated)}</td>
                    <td className="px-2 py-2">
                      {row.bottleneckStageName
                        ? `Узкое место: ${row.bottleneckStageName}`
                        : row.lostDealsInPeriod > 0
                          ? 'Есть отвал'
                          : '—'}
                    </td>
                  </tr>
                  {expandedKey === row.key ? (
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <td className="px-3 py-3" colSpan={9}>
                        <div className="grid gap-3 md:grid-cols-4">
                          <RevenueVelocityFormulaCard
                            formula={getRevenueVelocityFormula(row, isCohortView)}
                            tooltip={getRevenueVelocityTooltip(
                              isCohortView ? 'revenueVelocityPerDay' : 'liveRevenueVelocity',
                              report,
                            )}
                          />
                          {[
                            ['Создано в периоде', formatInteger(row.createdDeals)],
                            ['Сделки в работе по clean-стадиям', formatInteger(row.wipDeals)],
                            ['Проиграно за период', formatInteger(row.lostDealsInPeriod)],
                            ['Ожидаемые деньги воронки', formatOptionalRubles(row.expectedPipelineAmount)],
                            ['Изменение ожидаемых денег', formatOptionalRubles(row.expectedPipelineDelta)],
                            [
                              'Денежная скорость',
                              formatOptionalRublesPerDay(
                                isCohortView ? row.revenueVelocityPerDay : row.liveRevenueVelocity,
                              ),
                            ],
                            ['Изменение скорости', formatOptionalRublesPerDay(row.velocityDelta)],
                            ['Средний доход', formatOptionalRubles(row.averageCheck)],
                            ['Конверсия', formatOptionalPercent(row.winRate)],
                            ['Цикл, дни', formatOptionalDays(row.averageCycleDays)],
                            ['Всего звонков', formatInteger(row.actions.totalCalls)],
                            ['Звонков >30 сек', formatInteger(row.actions.connectedCallsOverThirtySeconds)],
                            ['Встреч', formatInteger(row.actions.meetingsCount)],
                            ['Конверсионных мероприятий', formatInteger(row.actions.conversionEventsCount)],
                            ['Закрытых задач', formatInteger(row.actions.closedTasks)],
                            ['Взвешенные баллы действий', formatNumber(row.actions.weightedActionPoints)],
                            ['Действий на выигрыш', formatOptionalDecimal(row.actions.weightedActionPointsPerWin)],
                            ['₽ / балл действий', formatOptionalRubles(row.moneyPerAction.moneyPerWeightedActionPoint)],
                            ['₽ системного прироста / балл', formatOptionalRubles(row.systemValuePerActionPoint)],
                            ['Реализованные ₽ / балл', formatOptionalRubles(row.realizedMoneyPerActionPoint)],
                            ['Исторический ₽ / балл', formatOptionalRubles(row.historicalMoneyPerActionPoint)],
                            ['Оценка будущих денег', formatOptionalRubles(row.estimatedFutureMoneyFromPeriodActions)],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div className="text-xs font-semibold text-slate-500">{label}</div>
                              <div className="mt-1 font-bold text-slate-900">{value}</div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          Учитываются только события на этапах Активация и Демонстрация.
                          {row.actions.conversionEventsCount === 0
                            ? ' Конверсионные мероприятия пока не подключены. Колонка зарезервирована под будущие данные.'
                            : ''}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function getSourceCohortFilterMonth(filters: ProtoFilterState) {
  return /^\d{4}-\d{2}/.test(filters.rangeStart)
    ? filters.rangeStart.slice(0, 7)
    : ''
}

function getSourceCohortMonthRange(month: string) {
  const monthParts = month.split('-')
  const year = Number(monthParts[0])
  const monthNumber = Number(monthParts[1])

  if (
    monthParts.length !== 2 ||
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    return null
  }

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  return {
    from: `${month}-01T00:00:00.000+03:00`,
    to: `${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999+03:00`,
  }
}

function buildSourceCohortQuery(filters: ProtoFilterState, month: string) {
  const monthRange = getSourceCohortMonthRange(month)
  const baseQuery = buildDashboardQueryFromProtoFilters(filters)

  if (!monthRange) {
    return baseQuery
  }

  return {
    ...baseQuery,
    preset: 'custom' as const,
    from: monthRange.from,
    to: monthRange.to,
  }
}

function formatSourceCohortPercent(value: number) {
  return `${formatPercent(value)}%`
}

function formatSourceCohortDays(value: number) {
  return value > 0 ? `${formatOneDecimal(value)} дн.` : '—'
}

const sourceCohortMonthShortLabels = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
]

function getSourceCohortMonthShortLabel(cohortMonth: string) {
  const monthNumber = Number(cohortMonth.slice(5, 7))
  return sourceCohortMonthShortLabels[monthNumber - 1] ?? cohortMonth
}

const sourceCohortVisibleYears = ['2025', '2026']

function summarizeSourceCohortStages(
  stages: SourceCohortConversionOpenStageRow[],
  limit = 2,
) {
  if (stages.length === 0) {
    return '—'
  }

  const visible = stages
    .slice(0, limit)
    .map((stage) => `${stage.stageName} ${formatInteger(stage.openDeals)}`)
    .join(', ')
  const hiddenCount = stages.length - limit

  return hiddenCount > 0 ? `${visible} +${hiddenCount}` : visible
}

function aggregateSourceCohortOpenStages(rows: SourceCohortConversionRow[]) {
  const totals = new Map<string, SourceCohortConversionOpenStageRow>()

  for (const row of rows) {
    for (const stage of row.openStageBreakdown) {
      const current = totals.get(stage.stageId) ?? {
        stageId: stage.stageId,
        stageName: stage.stageName,
        openDeals: 0,
      }
      current.openDeals += stage.openDeals
      totals.set(stage.stageId, current)
    }
  }

  return Array.from(totals.values()).sort((left, right) => {
    if (right.openDeals !== left.openDeals) {
      return right.openDeals - left.openDeals
    }

    return left.stageName.localeCompare(right.stageName, 'ru')
  })
}

type SourceCohortTargetGroupItem = {
  key: string
  customerLabel?: string
  targetGroupLabel: string
  wonDeals: number
  averageDaysToWin: number
}

function aggregateSourceCohortTargetGroups(
  rows: SourceCohortConversionRow[],
): SourceCohortTargetGroupItem[] {
  const totals = new Map<
    string,
    SourceCohortTargetGroupItem & { cycleSum: number; cycleWeight: number }
  >()

  for (const row of rows) {
    for (const targetGroup of row.targetGroupBreakdown) {
      const key = `${row.customerKey}|${targetGroup.targetGroupKey}`
      const current = totals.get(key) ?? {
        key,
        customerLabel: row.customerLabel,
        targetGroupLabel: targetGroup.targetGroupLabel,
        wonDeals: 0,
        averageDaysToWin: 0,
        cycleSum: 0,
        cycleWeight: 0,
      }
      current.wonDeals += targetGroup.wonDeals
      if (targetGroup.averageDaysToWin > 0 && targetGroup.wonDeals > 0) {
        current.cycleSum += targetGroup.averageDaysToWin * targetGroup.wonDeals
        current.cycleWeight += targetGroup.wonDeals
      }
      totals.set(key, current)
    }
  }

  return Array.from(totals.values())
    .map(({ cycleSum, cycleWeight, ...targetGroup }) => ({
      ...targetGroup,
      averageDaysToWin:
        cycleWeight > 0 ? Number((cycleSum / cycleWeight).toFixed(2)) : 0,
    }))
    .sort((left, right) => {
      if (right.wonDeals !== left.wonDeals) {
        return right.wonDeals - left.wonDeals
      }

      const leftLabel = `${left.customerLabel ?? ''} ${left.targetGroupLabel}`
      const rightLabel = `${right.customerLabel ?? ''} ${right.targetGroupLabel}`
      return leftLabel.localeCompare(rightLabel, 'ru')
    })
}

type SourceCohortManagerSegment = {
  id: string
  sourceLabel: string
  qualityLabel: string
  customerLabel: string
  stats: SourceCohortConversionManagerRow
}

type SourceCohortManagerView = {
  managerId: string
  managerName: string
  createdDeals: number
  wonDeals: number
  lostDeals: number
  openDeals: number
  winRate: number
  averageDaysToWin: number
  openStageBreakdown: SourceCohortConversionOpenStageRow[]
  segments: SourceCohortManagerSegment[]
}

function buildSourceCohortManagerViews(
  rows: SourceCohortConversionRow[],
): SourceCohortManagerView[] {
  const managers = new Map<
    string,
    Omit<SourceCohortManagerView, 'winRate' | 'averageDaysToWin' | 'openStageBreakdown'> & {
      cycleSum: number
      cycleWeight: number
      openStages: Map<string, SourceCohortConversionOpenStageRow>
    }
  >()

  for (const row of rows) {
    for (const manager of row.managerBreakdown) {
      const current = managers.get(manager.managerId) ?? {
        managerId: manager.managerId,
        managerName: manager.managerName,
        createdDeals: 0,
        wonDeals: 0,
        lostDeals: 0,
        openDeals: 0,
        cycleSum: 0,
        cycleWeight: 0,
        openStages: new Map<string, SourceCohortConversionOpenStageRow>(),
        segments: [],
      }
      current.createdDeals += manager.createdDeals
      current.wonDeals += manager.wonDeals
      current.lostDeals += manager.lostDeals
      current.openDeals += manager.openDeals
      if (manager.averageDaysToWin > 0 && manager.wonDeals > 0) {
        current.cycleSum += manager.averageDaysToWin * manager.wonDeals
        current.cycleWeight += manager.wonDeals
      }
      for (const stage of manager.openStageBreakdown) {
        const stageTotal = current.openStages.get(stage.stageId) ?? {
          stageId: stage.stageId,
          stageName: stage.stageName,
          openDeals: 0,
        }
        stageTotal.openDeals += stage.openDeals
        current.openStages.set(stage.stageId, stageTotal)
      }
      current.segments.push({
        id: `${row.id}|${manager.managerId}`,
        sourceLabel: row.sourceLabel,
        qualityLabel: row.qualityLabel,
        customerLabel: row.customerLabel,
        stats: manager,
      })
      managers.set(manager.managerId, current)
    }
  }

  return Array.from(managers.values())
    .map(({ cycleSum, cycleWeight, openStages, segments, ...manager }) => ({
      ...manager,
      winRate:
        manager.createdDeals > 0
          ? Number(((manager.wonDeals / manager.createdDeals) * 100).toFixed(2))
          : 0,
      averageDaysToWin:
        cycleWeight > 0 ? Number((cycleSum / cycleWeight).toFixed(2)) : 0,
      openStageBreakdown: Array.from(openStages.values()).sort((left, right) => {
        if (right.openDeals !== left.openDeals) {
          return right.openDeals - left.openDeals
        }

        return left.stageName.localeCompare(right.stageName, 'ru')
      }),
      segments: segments.sort((left, right) => {
        if (right.stats.createdDeals !== left.stats.createdDeals) {
          return right.stats.createdDeals - left.stats.createdDeals
        }

        return left.sourceLabel.localeCompare(right.sourceLabel, 'ru')
      }),
    }))
    .sort((left, right) => {
      if (right.createdDeals !== left.createdDeals) {
        return right.createdDeals - left.createdDeals
      }

      return left.managerName.localeCompare(right.managerName, 'ru')
    })
}

function SourceCohortExpandToggle({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-label={isExpanded ? 'Свернуть строку' : 'Раскрыть строку'}
      aria-expanded={isExpanded}
      onClick={onToggle}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
    >
      <HugeiconsIcon
        icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
        strokeWidth={2}
        className="h-4 w-4"
      />
    </button>
  )
}

function SourceCohortOutcomeBar({ report }: { report: SourceCohortConversionReport }) {
  const total = report.totalCreatedDeals

  if (total === 0) {
    return null
  }

  const segments = [
    { key: 'won', label: 'Продано', value: report.totalWonDeals, color: 'rgba(31,157,88,0.85)' },
    { key: 'open', label: 'В работе', value: report.totalOpenDeals, color: 'rgba(77,124,255,0.55)' },
    { key: 'lost', label: 'Проиграно', value: report.totalLostDeals, color: 'rgba(148,163,184,0.6)' },
  ].filter((segment) => segment.value > 0)

  return (
    <div className="mt-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label} {formatInteger(segment.value)} ·{' '}
            {formatSourceCohortPercent((segment.value / total) * 100)}
          </span>
        ))}
      </div>
    </div>
  )
}

function SourceCohortStageBars({
  stages,
  emptyText,
}: {
  stages: SourceCohortConversionOpenStageRow[]
  emptyText: string
}) {
  if (stages.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>
  }

  const totalOpenDeals = stages.reduce((total, stage) => total + stage.openDeals, 0)
  const maxOpenDeals = stages[0]?.openDeals ?? 1

  return (
    <div className="grid gap-2.5">
      {stages.map((stage) => (
        <div key={stage.stageId} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-slate-800">{stage.stageName}</span>
            <span className="shrink-0 font-semibold text-slate-900">
              {formatInteger(stage.openDeals)}
              {' '}
              <span className="ml-1.5 text-xs font-semibold text-slate-500">
                {formatSourceCohortPercent(
                  totalOpenDeals > 0 ? (stage.openDeals / totalOpenDeals) * 100 : 0,
                )}
              </span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${maxOpenDeals > 0 ? Math.max((stage.openDeals / maxOpenDeals) * 100, 4) : 0}%`,
                backgroundColor: 'rgba(77,124,255,0.7)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function SourceCohortTargetGroupList({
  groups,
  emptyText,
}: {
  groups: SourceCohortTargetGroupItem[]
  emptyText: string
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>
  }

  return (
    <div className="grid gap-2">
      {groups.map((targetGroup) => (
        <div
          key={targetGroup.key}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <span className="min-w-0 text-sm">
            {targetGroup.customerLabel ? (
              <>
                <span className="text-slate-500">{targetGroup.customerLabel}</span>{' '}
                <span aria-hidden="true" className="text-slate-400">
                  →
                </span>{' '}
              </>
            ) : null}
            <span className="font-semibold text-slate-800">
              {targetGroup.targetGroupLabel}
            </span>
          </span>
          <span className="shrink-0 text-sm text-slate-600">
            <span className="font-bold text-emerald-700">{formatInteger(targetGroup.wonDeals)}</span>{' '}
            {targetGroup.wonDeals === 1 ? 'продажа' : 'продаж'} · цикл{' '}
            {formatSourceCohortDays(targetGroup.averageDaysToWin)}
          </span>
        </div>
      ))}
    </div>
  )
}

function SourceCohortRowDetails({ row }: { row: SourceCohortConversionRow }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.9fr)]">
      <div className="min-w-0">
        <div className="subtle-label">Менеджеры</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                <th className="py-2 pr-3 font-semibold">Менеджер</th>
                <th className="py-2 pr-3 font-semibold">Передано</th>
                <th className="py-2 pr-3 font-semibold">Продано</th>
                <th className="py-2 pr-3 font-semibold">Конверсия</th>
                <th className="py-2 pr-3 font-semibold">Цикл</th>
                <th className="py-2 pr-3 font-semibold">Проиграно</th>
                <th className="py-2 pr-3 font-semibold">В работе</th>
                <th className="py-2 font-semibold">Этапы в работе</th>
              </tr>
            </thead>
            <tbody>
              {row.managerBreakdown.map((manager) => (
                <tr
                  key={manager.managerId}
                  className="border-b border-slate-100 align-top last:border-b-0"
                >
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">
                    {manager.managerName}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">
                    {formatInteger(manager.createdDeals)}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-emerald-700">
                    {formatInteger(manager.wonDeals)}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900">
                    {formatSourceCohortPercent(manager.winRate)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-700">
                    {formatSourceCohortDays(manager.averageDaysToWin)}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{formatInteger(manager.lostDeals)}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{formatInteger(manager.openDeals)}</td>
                  <td className="py-2.5 text-xs leading-5 text-slate-600">
                    <div className="max-w-[220px]">
                      {summarizeSourceCohortStages(manager.openStageBreakdown)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid content-start gap-4 border-slate-200 xl:border-l xl:pl-5">
        <div>
          <div className="subtle-label">В работе по этапам</div>
          <div className="mt-2">
            <SourceCohortStageBars
              stages={row.openStageBreakdown}
              emptyText="Открытых сделок в строке нет."
            />
          </div>
        </div>
        <div>
          <div className="subtle-label">Продажи: клуб заказчика → таргет-группа</div>
          <div className="mt-2">
            <SourceCohortTargetGroupList
              groups={row.targetGroupBreakdown.map((targetGroup) => ({
                key: targetGroup.targetGroupKey,
                customerLabel: row.customerLabel,
                targetGroupLabel: targetGroup.targetGroupLabel,
                wonDeals: targetGroup.wonDeals,
                averageDaysToWin: targetGroup.averageDaysToWin,
              }))}
              emptyText="Продаж в строке пока нет."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceCohortManagerDetails({ manager }: { manager: SourceCohortManagerView }) {
  return (
    <div className="grid gap-4">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              <th className="py-2 pr-3 font-semibold">Источник · качество · клуб</th>
              <th className="py-2 pr-3 font-semibold">Передано</th>
              <th className="py-2 pr-3 font-semibold">Продано</th>
              <th className="py-2 pr-3 font-semibold">Конверсия</th>
              <th className="py-2 pr-3 font-semibold">Цикл</th>
              <th className="py-2 pr-3 font-semibold">Проиграно</th>
              <th className="py-2 pr-3 font-semibold">В работе</th>
              <th className="py-2 font-semibold">Этапы в работе</th>
            </tr>
          </thead>
          <tbody>
            {manager.segments.map((segment) => (
              <tr key={segment.id} className="border-b border-slate-100 align-top last:border-b-0">
                <td className="min-w-[220px] py-2 pr-3">
                  <div className="font-semibold text-slate-900">{segment.sourceLabel}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{segment.qualityLabel}</div>
                  <div className="mt-1">
                    <span className="inline-flex max-w-full rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {segment.customerLabel}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 font-semibold text-slate-900">
                  {formatInteger(segment.stats.createdDeals)}
                </td>
                <td className="py-2 pr-3 font-semibold text-emerald-700">
                  {formatInteger(segment.stats.wonDeals)}
                </td>
                <td className="py-2 pr-3 font-semibold text-slate-900">
                  {formatSourceCohortPercent(segment.stats.winRate)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-slate-700">
                  {formatSourceCohortDays(segment.stats.averageDaysToWin)}
                </td>
                <td className="py-2 pr-3 text-slate-700">{formatInteger(segment.stats.lostDeals)}</td>
                <td className="py-2 pr-3 text-slate-700">{formatInteger(segment.stats.openDeals)}</td>
                <td className="py-2 text-xs text-slate-600">
                  {summarizeSourceCohortStages(segment.stats.openStageBreakdown)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type OperationalRiskFilter = 'all' | 'critical' | OperationalRiskRuleKey

const operationalRiskRuleOrder: OperationalRiskRuleKey[] = [
  'stage_aging',
  'no_open_activity',
  'no_recent_calls',
  'no_recent_activity',
]

const operationalRiskRuleLabels: Record<OperationalRiskRuleKey, string> = {
  stage_aging: 'Застрял на этапе',
  no_open_activity: 'Без дел',
  no_recent_calls: 'Без звонков',
  no_recent_activity: 'Без активностей',
}

const operationalCalculationHints = {
  meetings:
    'Считаются встречи В1/В2/В3 по слотам сделки, если дата встречи попадает в выбранный период.',
  sales:
    'Считаются выигранные сделки за период. Клуб берется из таргет-группы продажи, цикл - от создания сделки до закрытия.',
  sla:
    'SLA первого касания: от создания сделки до первого контакта в бизнес-часах. Порог берется из настроек.',
  planned:
    'Считаются открытые дела и встречи с дедлайном сегодня или завтра. Встречи берутся только В1/В2/В3.',
  stages:
    'Открытые сделки группируются по текущему этапу. Клик по этапу фильтрует ленту рисков.',
  risks:
    'В ленте только открытые сделки с хотя бы одним флагом: застрял на этапе, нет открытого дела, нет любого звонка за порог или нет свежей CRM-активности.',
  managers:
    'Строка менеджера собирает созданные сделки, встречи, продажи, SLA, открытые сделки и риски за текущий срез. Клик фильтрует ленту.',
}

const operationalRiskFilterHints: Record<OperationalRiskFilter, string> = {
  all: 'Все рисковые открытые сделки в текущем срезе.',
  critical: 'Критично, если хотя бы один флаг критический. Для этапа это срок в два раза выше порога.',
  stage_aging: 'Сделка находится на текущем этапе дольше порога этого этапа из настроек.',
  no_open_activity: 'По сделке нет ни одного открытого CRM-дела.',
  no_recent_calls: 'Последний любой привязанный звонок по сделке старше порога из настроек. Учитываются входящие, исходящие, успешные и неуспешные звонки с датой.',
  no_recent_activity:
    'CRM-активность - дело/активность в карточке сделки: задача, встреча, звонок как Bitrix activity. Берется самая поздняя дата created, completed или updated. Отдельная телефония считается правилом "Без звонков".',
}

function formatOperationalDays(value: number | null | undefined) {
  return `${formatOneDecimal(value ?? 0)} дн`
}

function formatOperationalHours(value: number | null | undefined) {
  return `${formatOneDecimal(value ?? 0)} ч`
}

function sumOperationalSlots(slots: OperationalMeetingSlotCount[]) {
  return slots.reduce((total, slot) => total + slot.count, 0)
}

function formatOperationalSlotSummary(slots: OperationalMeetingSlotCount[]) {
  return slots
    .map((slot) => `${slot.slotLabel.replace('Встреча ', 'В')}: ${formatInteger(slot.count)}`)
    .join(' · ')
}

function formatManagerMeetingSlots(slots: OperationalMeetingSlotCount[]) {
  return slots.map((slot) => formatInteger(slot.count)).join('/')
}

function countOperationalRisksByRule(
  risks: OperationalRiskDeal[],
  rule: OperationalRiskRuleKey,
) {
  return risks.filter((risk) => risk.flags.some((flag) => flag.rule === rule)).length
}

function formatOperationalRiskFlags(flags: OperationalRiskDeal['flags']) {
  return flags.map((flag) => flag.label || operationalRiskRuleLabels[flag.rule]).join(' · ')
}

function getOperationalRiskRowTone(severity: 'risk' | 'critical') {
  return severity === 'critical'
    ? {
        row: 'border-l-rose-300 bg-gradient-to-r from-rose-50/45 via-white to-white',
        pill: 'border-rose-100 bg-white/90 text-rose-700',
      }
    : {
        row: 'border-l-amber-300 bg-gradient-to-r from-amber-50/45 via-white to-white',
        pill: 'border-amber-100 bg-white/90 text-amber-700',
      }
}

function getOperationalSla2(report: OperationalDashboardReport) {
  return (
    report.sla.find((row) => row.slaKey === 'sla2') ??
    report.sla[0] ?? {
      slaKey: 'sla2' as const,
      label: 'Первый контакт',
      thresholdBusinessHours: 0,
      onTimeCount: 0,
      lateCount: 0,
      noTouchCount: 0,
      medianHours: 0,
    }
  )
}

function matchesOperationalRiskFilter(
  risk: OperationalRiskDeal,
  ruleFilter: OperationalRiskFilter,
  stageFilter: string | null,
  managerFilter: string | null,
) {
  if (ruleFilter === 'critical' && risk.severity !== 'critical') {
    return false
  }

  if (
    ruleFilter !== 'all' &&
    ruleFilter !== 'critical' &&
    !risk.flags.some((flag) => flag.rule === ruleFilter)
  ) {
    return false
  }

  if (stageFilter && risk.stageId !== stageFilter) {
    return false
  }

  if (managerFilter && risk.managerId !== managerFilter) {
    return false
  }

  return true
}

function OperationListRow({
  label,
  value,
  note,
}: {
  label: string
  value: ReactNode
  note?: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="min-w-0 truncate text-sm text-slate-700">{label}</span>
      <span className="shrink-0 text-right text-sm font-bold text-slate-900">
        {value}
        {note ? <span className="ml-1 text-xs font-semibold text-slate-400">{note}</span> : null}
      </span>
    </div>
  )
}

function OperationalRiskChip({
  active,
  children,
  onClick,
  tooltip,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
  tooltip?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'group relative inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white'
          : 'group relative inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900'
      }
    >
      <span>{children}</span>
      {tooltip ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none',
            active ? 'border-white/30 text-white/75' : 'border-slate-200 text-slate-400',
          )}
        >
          ?
        </span>
      ) : null}
      {tooltip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold leading-relaxed text-slate-600 shadow-lg group-hover:block group-focus-within:block"
        >
          {tooltip}
        </span>
      ) : null}
    </button>
  )
}

export function OperationsScene({ filters }: SceneComponentProps) {
  const requestKey = useMemo(
    () => JSON.stringify(buildDashboardQueryFromProtoFilters(filters)),
    [filters],
  )
  const query = useMemo(() => JSON.parse(requestKey) as DashboardQuery, [requestKey])
  const [reportState, setReportState] = useState<{
    requestKey: string
    report: OperationalDashboardReport
  } | null>(null)
  const [errorState, setErrorState] = useState<{
    requestKey: string
    message: string
  } | null>(null)
  const [ruleFilter, setRuleFilter] = useState<OperationalRiskFilter>('all')
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [managerFilter, setManagerFilter] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    apiClient
      .getOperationalDashboardReport(query)
      .then((nextReport) => {
        if (cancelled) {
          return
        }

        setReportState({ requestKey, report: nextReport })
        setErrorState(null)
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return
        }

        setErrorState({
          requestKey,
          message:
            nextError instanceof Error
              ? nextError.message
              : 'Не удалось загрузить операционный дашборд',
        })
      })

    return () => {
      cancelled = true
    }
  }, [query, requestKey])

  const report = reportState?.requestKey === requestKey ? reportState.report : null
  const errorMessage = errorState?.requestKey === requestKey ? errorState.message : null
  const isLoading = reportState?.requestKey !== requestKey && !errorMessage
  const scopedRisks = useMemo(
    () =>
      (report?.risks ?? []).filter((risk) =>
        matchesOperationalRiskFilter(risk, 'all', stageFilter, managerFilter),
      ),
    [managerFilter, report?.risks, stageFilter],
  )
  const filteredRisks = useMemo(
    () =>
      scopedRisks.filter((risk) =>
        matchesOperationalRiskFilter(risk, ruleFilter, null, null),
      ),
    [ruleFilter, scopedRisks],
  )
  const visibleRisks = filteredRisks
  const stageNameById = useMemo(
    () => new Map((report?.stageWip ?? []).map((stage) => [stage.stageId, stage.stageName])),
    [report?.stageWip],
  )
  const managerNameById = useMemo(
    () =>
      new Map(
        (report?.managers ?? []).map((manager) => [manager.managerId, manager.managerName]),
      ),
    [report?.managers],
  )
  const criticalRisksByStage = useMemo(() => {
    const rows = new Map<string, number>()
    for (const risk of report?.risks ?? []) {
      if (risk.severity === 'critical') {
        rows.set(risk.stageId, (rows.get(risk.stageId) ?? 0) + 1)
      }
    }
    return rows
  }, [report?.risks])

  if (isLoading && !report) {
    return (
      <section className="panel p-5" role="status">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <span className="btn-spinner" aria-hidden="true" />
          Загружаю операционный дашборд
        </div>
      </section>
    )
  }

  if (errorMessage && !report) {
    return (
      <section
        role="alert"
        className="panel border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        {errorMessage}
      </section>
    )
  }

  if (!report) {
    return null
  }

  const sla2 = getOperationalSla2(report)
  const activeStageLabel = stageFilter ? stageNameById.get(stageFilter) ?? stageFilter : null
  const activeManagerLabel = managerFilter
    ? managerNameById.get(managerFilter) ?? managerFilter
    : null
  const toggleManagerFilter = (managerId: string) =>
    setManagerFilter((current) => (current === managerId ? null : managerId))
  const loadedRiskTotal = report.risks.length
  const isRiskListCapped = report.riskSummary.total > loadedRiskTotal
  const riskDescription =
    isRiskListCapped
      ? `Всего рисков: ${formatInteger(report.riskSummary.total)}. В список загружены первые ${formatInteger(loadedRiskTotal)} по приоритету.`
      : `Всего рисков: ${formatInteger(report.riskSummary.total)}.`
  const riskFilterButtons: Array<{
    key: OperationalRiskFilter
    label: string
    count: number
  }> = [
    { key: 'all', label: isRiskListCapped ? 'В списке' : 'Все', count: scopedRisks.length },
    {
      key: 'critical',
      label: 'Критично',
      count: scopedRisks.filter((risk) => risk.severity === 'critical').length,
    },
    ...operationalRiskRuleOrder.map((rule) => ({
      key: rule,
      label: operationalRiskRuleLabels[rule],
      count: countOperationalRisksByRule(scopedRisks, rule),
    })),
  ]

  return (
    <div className="grid min-w-0 gap-6">
      {isLoading ? (
        <div
          role="status"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500"
        >
          <span className="btn-spinner" aria-hidden="true" />
          Обновляю
        </div>
      ) : null}

      {errorMessage ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section
        className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-6"
        data-comment-block-id="attraction-operations-summary"
        data-comment-block-label="Операционный дашборд — сводка"
      >
        {[
          ['Создано', formatInteger(report.createdDeals), 'новых сделок'],
          [
            'Встречи',
            formatInteger(report.meetingsHeld.total),
            formatOperationalSlotSummary(report.meetingsHeld.bySlot),
          ],
          ['Продажи', formatInteger(report.sales.total), 'по клубам ниже'],
          ['Проиграно', formatInteger(report.lostDeals), 'за период'],
          ['В работе', formatInteger(report.openDeals), 'открытых сделок'],
          [
            'Рисков',
            formatInteger(report.riskSummary.total),
            `${formatInteger(report.riskSummary.critical)} критично · ${formatInteger(report.riskSummary.risk)} риск`,
          ],
        ].map(([label, value, note]) => {
          const isRisk = label === 'Рисков'
          return (
              <div
                key={label}
                className={cn(
                  'metric min-w-0 p-4',
                isRisk && 'border-slate-300 bg-white/95 border-t-2 border-t-slate-300',
                )}
              >
                <p className="subtle-label">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {value}
                </p>
                <p className="truncate text-xs font-medium text-slate-500">{note}</p>
              </div>
          )
        })}
      </section>

        <section className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.15fr)]">
          <div className="grid min-w-0 gap-6">
            <section
              className="grid min-w-0 gap-6 2xl:grid-cols-2"
            data-comment-block-id="attraction-operations-flow"
            data-comment-block-label="Операционный дашборд — поток"
          >
            <div className="panel min-w-0 p-5">
              <PanelHeading
                title="Встречи за период"
                hint={operationalCalculationHints.meetings}
                right={<span className="badge-chip badge-neutral">{formatInteger(report.meetingsHeld.total)}</span>}
              />
              <div className="grid gap-1">
                {report.meetingsHeld.bySlot.map((slot) => (
                  <OperationListRow
                    key={slot.slotIndex}
                    label={slot.slotLabel}
                    value={formatInteger(slot.count)}
                  />
                ))}
              </div>
            </div>

            <div className="panel min-w-0 p-5">
              <PanelHeading
                title="Продажи за период"
                hint={operationalCalculationHints.sales}
                right={<span className="badge-chip badge-green">{formatInteger(report.sales.total)}</span>}
              />
              <div className="grid gap-1">
                {report.sales.byClub.length > 0 ? (
                  report.sales.byClub.map((club) => (
                    <OperationListRow
                      key={club.targetGroupKey}
                      label={club.targetGroupLabel}
                      value={formatInteger(club.wonDeals)}
                      note={`· цикл ${formatOperationalDays(club.averageDaysToWin)}`}
                    />
                  ))
                ) : (
                  <OperationListRow label="Продаж нет" value="—" />
                )}
              </div>
            </div>
          </section>

            <section
              className="grid min-w-0 gap-6 2xl:grid-cols-2"
            data-comment-block-id="attraction-operations-sla-planned"
            data-comment-block-label="Операционный дашборд — SLA и планы"
          >
            <div className="panel min-w-0 p-5">
              <PanelHeading
                title="SLA первого касания"
                description={`Порог ${formatInteger(sla2.thresholdBusinessHours)} ч из настроек`}
                hint={operationalCalculationHints.sla}
              />
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
                {[
                  ['Вовремя', sla2.onTimeCount, 'bg-emerald-500'],
                  ['С опозданием', sla2.lateCount, 'bg-rose-500'],
                  ['Без касания', sla2.noTouchCount, 'bg-rose-500'],
                ].map(([label, value, dotClass]) => (
                  <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />
                      <span className="min-w-0 truncate text-[11px] font-bold uppercase text-slate-500">
                        {label}
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-900">{formatInteger(Number(value))}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium text-slate-500">
                Медиана до первого контакта: <span className="text-slate-900">{formatOperationalHours(sla2.medianHours)}</span>
              </p>
            </div>

            <div className="panel min-w-0 p-5">
              <PanelHeading title="Запланировано" hint={operationalCalculationHints.planned} />
              <div className="grid gap-1">
                <OperationListRow
                  label="Сегодня: встречи"
                  value={formatInteger(sumOperationalSlots(report.planned.meetingsToday))}
                  note={`· ${formatOperationalSlotSummary(report.planned.meetingsToday)}`}
                />
                <OperationListRow
                  label="Сегодня: дела"
                  value={formatInteger(report.planned.tasksToday)}
                />
                <OperationListRow
                  label="Завтра: встречи"
                  value={formatInteger(sumOperationalSlots(report.planned.meetingsTomorrow))}
                  note={`· ${formatOperationalSlotSummary(report.planned.meetingsTomorrow)}`}
                />
                <OperationListRow
                  label="Завтра: дела"
                  value={formatInteger(report.planned.tasksTomorrow)}
                />
              </div>
            </div>
          </section>

          <section
            className="panel min-w-0 p-5"
            data-comment-block-id="attraction-operations-stage-wip"
            data-comment-block-label="Операционный дашборд — в работе по этапам"
          >
            <PanelHeading
              title="В работе по этапам"
              hint={operationalCalculationHints.stages}
              right={<span className="badge-chip badge-neutral">{formatInteger(report.openDeals)} открыто</span>}
            />
            <div className="grid gap-1">
              {report.stageWip.length > 0 ? (
                report.stageWip.map((stage) => {
                  const hasCritical = (criticalRisksByStage.get(stage.stageId) ?? 0) > 0
                  return (
                      <button
                        key={stage.stageId}
                        type="button"
                        aria-label={`Фильтр по этапу ${stage.stageName}`}
                        aria-pressed={stageFilter === stage.stageId}
                        onClick={() =>
                          setStageFilter((current) =>
                            current === stage.stageId ? null : stage.stageId,
                          )
                        }
                        className={cn(
                          'flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300',
                          stageFilter === stage.stageId && 'border-slate-400 bg-slate-100/80',
                        )}
                      >
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{stage.stageName}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{formatInteger(stage.openDeals)}</span>
                          {stage.riskDeals > 0 ? (
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                                hasCritical
                                  ? 'border-slate-300 bg-slate-50 text-slate-700'
                                  : 'border-slate-200 bg-white text-slate-500',
                              )}
                            >
                              {formatInteger(stage.riskDeals)} в риске
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]',
                              stageFilter === stage.stageId
                                ? 'border-slate-500 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-500',
                            )}
                          >
                            {stageFilter === stage.stageId ? 'Активен' : 'Фильтр'}
                          </span>
                        </span>
                      </button>
                    )
                  })
              ) : (
                <OperationListRow label="Открытых этапов нет" value="—" />
              )}
            </div>
          </section>
        </div>

        <section
          className="panel min-w-0 p-5"
          data-comment-block-id="attraction-operations-risks"
          data-comment-block-label="Операционный дашборд — лента рисков"
          >
          <PanelHeading
            title="Лента рисков"
              description={riskDescription}
              hint={operationalCalculationHints.risks}
              right={
                <span className="badge-chip badge-neutral">
                  {formatInteger(filteredRisks.length)} сделок
                </span>
              }
            />
          <div className="mb-3 flex min-w-0 flex-wrap gap-2">
            {riskFilterButtons.map((chip) => (
              <OperationalRiskChip
                key={chip.key}
                active={ruleFilter === chip.key}
                onClick={() => setRuleFilter(chip.key)}
                tooltip={operationalRiskFilterHints[chip.key]}
              >
                {chip.label} · {formatInteger(chip.count)}
              </OperationalRiskChip>
            ))}
          </div>

          {activeStageLabel || activeManagerLabel ? (
            <div className="mb-3 flex min-w-0 flex-wrap gap-2">
              {activeStageLabel ? (
                <button
                  type="button"
                  onClick={() => setStageFilter(null)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Этап: {activeStageLabel} ×
                </button>
              ) : null}
              {activeManagerLabel ? (
                <button
                  type="button"
                  onClick={() => setManagerFilter(null)}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Менеджер: {activeManagerLabel} ×
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid max-h-[44rem] gap-2 overflow-y-auto pr-1">
            {visibleRisks.length > 0 ? (
              visibleRisks.map((risk) => {
                const rowTone = getOperationalRiskRowTone(risk.severity)
                return (
                  <article
                    key={risk.dealId}
                    className={cn(
                      'rounded-lg border border-l-[3px] border-slate-200 px-3 py-2 shadow-[0_1px_3px_rgba(15,23,42,0.03)]',
                      rowTone.row,
                    )}
                  >
                    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                          {risk.dealUrl ? (
                            <a
                              href={risk.dealUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-sm font-bold text-blue-700 hover:text-blue-900"
                            >
                              Сделка #{risk.dealId} ↗
                            </a>
                          ) : (
                            <span className="shrink-0 text-sm font-bold text-slate-900">
                              Сделка #{risk.dealId}
                            </span>
                          )}
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                            {risk.stageName} · {risk.managerName}
                          </span>
                        </div>
                        <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                          <span className="min-w-0 truncate">
                            {risk.sourceLabel} · {risk.customerClubLabel}
                          </span>
                          <span className="min-w-0 truncate">
                            {formatOperationalRiskFlags(risk.flags)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full border px-2 py-1 text-right text-xs font-bold',
                          rowTone.pill,
                        )}
                      >
                        {formatInteger(risk.daysOnStage)} дн
                        {risk.stageMaxDays ? ` / ${formatInteger(risk.stageMaxDays)}` : ''}
                      </span>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                Рисков по выбранным фильтрам нет.
              </div>
            )}
          </div>

        </section>
      </section>

      <section
        className="panel min-w-0 overflow-hidden p-5"
        data-comment-block-id="attraction-operations-managers"
        data-comment-block-label="Операционный дашборд — менеджеры"
      >
          <PanelHeading
            title="Менеджеры за период"
            hint={operationalCalculationHints.managers}
            right={<span className="badge-chip badge-neutral">{formatInteger(report.managers.length)} менеджеров</span>}
          />
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 pr-3">Менеджер</th>
                <th className="py-2 pr-3 text-right">Создано</th>
                <th className="py-2 pr-3 text-right">Встречи В1/В2/В3</th>
                <th className="py-2 pr-3 text-right">Продажи</th>
                <th className="py-2 pr-3 text-right">SLA поздно/без кас.</th>
                <th className="py-2 pr-3 text-right">В работе</th>
                <th className="py-2 text-right">Рисков</th>
              </tr>
            </thead>
            <tbody>
              {report.managers.length > 0 ? (
                report.managers.map((manager) => (
                  <tr
                    key={manager.managerId}
                    onClick={() => toggleManagerFilter(manager.managerId)}
                    className={cn(
                      'cursor-pointer border-b border-slate-100 transition hover:bg-slate-50',
                      managerFilter === manager.managerId && 'bg-slate-50',
                    )}
                  >
                    <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          aria-label={`Фильтр по менеджеру ${manager.managerName}`}
                          aria-pressed={managerFilter === manager.managerId}
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleManagerFilter(manager.managerId)
                          }}
                          className="flex w-full min-w-0 cursor-pointer items-center gap-2 text-left font-semibold text-slate-900 outline-none transition hover:text-blue-700 focus:text-blue-700"
                        >
                          <span className="min-w-0 truncate">{manager.managerName}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]',
                              managerFilter === manager.managerId
                                ? 'border-slate-500 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-500',
                            )}
                          >
                            {managerFilter === manager.managerId ? 'Активен' : 'Фильтр'}
                          </span>
                        </button>
                      </td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{formatInteger(manager.createdDeals)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{formatManagerMeetingSlots(manager.meetingsBySlot)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{formatInteger(manager.wonDeals)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">
                      {formatInteger(manager.slaLateCount)} / {formatInteger(manager.slaNoTouchCount)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{formatInteger(manager.openDeals)}</td>
                    <td
                        className={cn(
                          'py-2.5 text-right font-bold',
                          manager.riskDeals > 0
                            ? 'rounded-l-lg bg-rose-50/60 px-2 text-rose-700'
                            : 'text-slate-500',
                        )}
                    >
                      {formatInteger(manager.riskDeals)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={7}>
                    Нет данных по менеджерам за выбранный период.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function SourceCohortsScene({ filters }: SceneComponentProps) {
  const filterMonth = getSourceCohortFilterMonth(filters)
  const [monthOverride, setMonthOverride] = useState<{
    filterMonth: string
    month: string
  } | null>(null)
  const [reportState, setReportState] = useState<{
    requestKey: string
    report: SourceCohortConversionReport
  } | null>(null)
  const [errorState, setErrorState] = useState<{
    requestKey: string
    message: string
  } | null>(null)
  const [viewYear, setViewYear] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'mix' | 'managers'>('mix')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set())
  const selectedMonth =
    monthOverride?.filterMonth === filterMonth ? monthOverride.month : ''
  const requestedMonth = selectedMonth || filterMonth
  const sourceCohortQuery = useMemo(
    () =>
      requestedMonth
        ? buildSourceCohortQuery(filters, requestedMonth)
        : null,
    [filters, requestedMonth],
  )
  const requestKey = useMemo(
    () => (sourceCohortQuery ? JSON.stringify(sourceCohortQuery) : ''),
    [sourceCohortQuery],
  )

  useEffect(() => {
    if (!sourceCohortQuery || !requestKey) {
      return
    }

    let cancelled = false

    apiClient
      .getSourceCohortConversionReport(sourceCohortQuery)
      .then((nextReport) => {
        if (cancelled) {
          return
        }

        setReportState({ requestKey, report: nextReport })

        const hasRequestedMonth = nextReport.cohortMonths.some(
          (month) => month.cohortMonth === requestedMonth,
        )
        const fallbackMonth = nextReport.cohortMonths.at(-1)?.cohortMonth
        if (!hasRequestedMonth && fallbackMonth && fallbackMonth !== requestedMonth) {
          setMonthOverride({ filterMonth, month: fallbackMonth })
        }
      })
      .catch((nextError: unknown) => {
        if (cancelled) {
          return
        }

        setErrorState({
          requestKey,
          message:
            nextError instanceof Error
              ? nextError.message
              : 'Не удалось загрузить отчет по конверсиям',
        })
      })

    return () => {
      cancelled = true
    }
  }, [filterMonth, requestKey, requestedMonth, sourceCohortQuery])

  const report = reportState?.requestKey === requestKey ? reportState.report : null
  const errorMessage = errorState?.requestKey === requestKey ? errorState.message : null
  const isLoading = Boolean(
    requestKey && reportState?.requestKey !== requestKey && !errorMessage,
  )
  const activeMonth = selectedMonth || requestedMonth || report?.cohortMonths.at(-1)?.cohortMonth || ''
  const selectedMonthLabel =
    report?.cohortMonths.find((month) => month.cohortMonth === activeMonth)?.cohortLabel ??
    activeMonth
  const monthOptions = useMemo(() => report?.cohortMonths ?? [], [report])
  const cohortYears = useMemo(
    () =>
      sourceCohortVisibleYears.filter((year) =>
        monthOptions.some((month) => month.cohortMonth.startsWith(year)),
      ),
    [monthOptions],
  )
  const activeYear = activeMonth.slice(0, 4)
  const displayedYear =
    viewYear && cohortYears.includes(viewYear)
      ? viewYear
      : cohortYears.includes(activeYear)
        ? activeYear
        : (cohortYears.at(-1) ?? '')
  const displayedMonths = monthOptions.filter((month) =>
    month.cohortMonth.startsWith(displayedYear),
  )
  const openStageTotals = useMemo(
    () => aggregateSourceCohortOpenStages(report?.rows ?? []),
    [report],
  )
  const targetGroupTotals = useMemo(
    () => aggregateSourceCohortTargetGroups(report?.rows ?? []),
    [report],
  )
  const managerViews = useMemo(
    () => buildSourceCohortManagerViews(report?.rows ?? []),
    [report],
  )
  const toggleRow = (rowKey: string) => {
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }
      return next
    })
  }

  return (
    <div className="grid min-w-0 gap-6">
      <section
        className="panel min-w-0 p-5"
        data-comment-block-id="attraction-source-cohort-conversion"
        data-comment-block-label="Конверсии"
      >
        <PanelHeading
          title="Конверсии"
          description="Когорта по месяцу создания сделки: сколько передано источниками и что с этими сделками стало к текущему моменту."
          right={
            <div className="flex flex-wrap items-center gap-2">
              {isLoading && report ? (
                <span
                  role="status"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500"
                >
                  <span className="btn-spinner" aria-hidden="true" />
                  Обновляю
                </span>
              ) : null}
              <span className="badge-chip badge-neutral">месяц создания сделки</span>
              <span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>
            </div>
          }
        />

        <div className="mb-4 grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="subtle-label">Месяц создания</span>
            {cohortYears.length > 1
              ? cohortYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    aria-pressed={year === displayedYear}
                    onClick={() => setViewYear(year)}
                    className={
                      year === displayedYear
                        ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white'
                        : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-slate-300'
                    }
                  >
                    {year}
                  </button>
                ))
              : null}
            <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              Когорта: <span className="text-slate-900">{selectedMonthLabel || '—'}</span> · передано{' '}
              <span className="text-slate-900">{formatInteger(report?.totalCreatedDeals ?? 0)}</span>
            </span>
          </div>
          <div
            role="group"
            aria-label="Месяц создания сделки"
            className="flex min-w-0 flex-wrap gap-2"
          >
            {displayedMonths.length > 0 ? (
              displayedMonths.map((month) => {
                const isActive = month.cohortMonth === activeMonth
                return (
                  <button
                    key={month.cohortMonth}
                    type="button"
                    aria-pressed={isActive}
                    aria-label={`${month.cohortLabel} · ${formatInteger(month.totalCreatedDeals)}`}
                    onClick={() =>
                      setMonthOverride({ filterMonth, month: month.cohortMonth })
                    }
                    className={
                      isActive
                        ? 'rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white'
                        : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 transition hover:border-slate-300'
                    }
                  >
                    {getSourceCohortMonthShortLabel(month.cohortMonth)}
                    <span className={isActive ? 'ml-1 opacity-75' : 'ml-1 font-semibold text-slate-400'}>
                      · {formatInteger(month.totalCreatedDeals)}
                    </span>
                  </button>
                )
              })
            ) : (
              <span className="text-sm text-slate-500">
                {isLoading ? 'Загружаю список месяцев…' : 'Нет данных по месяцам.'}
              </span>
            )}
          </div>
        </div>

        {isLoading && !report ? (
          <div
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
            role="status"
          >
            <span className="btn-spinner" aria-hidden="true" />
            <span>Считаю когорту {selectedMonthLabel}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}

        {report ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[
                ['Передано', formatInteger(report.totalCreatedDeals), 'создано в когорте'],
                ['Продано', formatInteger(report.totalWonDeals), `${formatSourceCohortPercent(report.winRate)} конверсия`],
                ['Цикл продажи', formatSourceCohortDays(report.averageDaysToWin), 'до первой продажи'],
                ['Проиграно', formatInteger(report.totalLostDeals), 'текущий финальный статус'],
                ['В работе', formatInteger(report.totalOpenDeals), 'текущие открытые этапы'],
              ].map(([label, value, note]) => (
                <div key={label} className="metric p-4">
                  <p className="subtle-label">{label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-500">{note}</p>
                </div>
              ))}
            </div>

            <SourceCohortOutcomeBar report={report} />
          </>
        ) : null}
      </section>

      {report ? (
        <section className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section
            className="panel min-w-0 p-5"
            data-comment-block-id="attraction-source-cohort-wip"
            data-comment-block-label="Конверсии — в работе по этапам"
          >
            <PanelHeading
              title="В работе по этапам"
              description="Открытые сделки когорты по текущим этапам воронки Привлечение."
              right={
                <span className="badge-chip badge-neutral">
                  {formatInteger(report.totalOpenDeals)} в работе
                </span>
              }
            />
            <SourceCohortStageBars
              stages={openStageTotals}
              emptyText="Открытых сделок в когорте нет."
            />
          </section>

          <section
            className="panel min-w-0 p-5"
            data-comment-block-id="attraction-source-cohort-target-groups"
            data-comment-block-label="Конверсии — продажи по таргет-группе"
          >
            <PanelHeading
              title="Продажи по таргет-группе"
              description="Мэппинг продаж когорты: бизнес-клуб заказчика при создании → таргет-группа / клуб продажи, с количеством и средним циклом."
              right={
                <span className="badge-chip badge-green">
                  {formatInteger(report.totalWonDeals)} продаж
                </span>
              }
            />
            <SourceCohortTargetGroupList
              groups={targetGroupTotals}
              emptyText="Продаж в когорте пока нет."
            />
          </section>
        </section>
      ) : null}

      {report ? (
        <section
          className="panel min-w-0 p-5"
          data-comment-block-id="attraction-source-cohort-breakdown"
          data-comment-block-label="Конверсии — разрез"
        >
          <PanelHeading
            title="Разрез когорты"
            description={
              viewMode === 'mix'
                ? 'Главный разрез: источник, итоговое качество и бизнес-клуб заказчика при создании сделки. Строка раскрывается до менеджеров, этапов в работе и таргет-групп.'
                : 'Менеджеры по всей когорте. Строка раскрывается до разреза источник · качество · клуб; средний цикл менеджера — средневзвешенный по его продажам.'
            }
          />

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-sm">
            {[
              { id: 'mix' as const, label: 'Источник · качество · клуб' },
              { id: 'managers' as const, label: 'По менеджерам' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={
                  viewMode === mode.id
                    ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                    : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
                }
              >
                {mode.label}
              </button>
            ))}
            <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              {viewMode === 'mix'
                ? `${formatInteger(report.rows.length)} строк разреза`
                : `${formatInteger(managerViews.length)} менеджеров`}
            </span>
          </div>

          {report.rows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                За выбранный месяц нет сделок в текущих фильтрах и whitelist менеджеров.
              </p>
              <p className="mt-1 text-xs text-slate-500">Месяц: {selectedMonthLabel}</p>
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-3 font-semibold">
                      {viewMode === 'mix' ? 'Источник · качество · клуб' : 'Менеджер'}
                    </th>
                    <th className="px-3 py-3 font-semibold">Передано</th>
                    <th className="px-3 py-3 font-semibold">Продано</th>
                    <th className="px-3 py-3 font-semibold">Конверсия</th>
                    <th className="px-3 py-3 font-semibold">Цикл</th>
                    <th className="px-3 py-3 font-semibold">Проиграно</th>
                    <th className="px-3 py-3 font-semibold">В работе</th>
                    <th className="px-3 py-3 font-semibold">Этапы в работе</th>
                  </tr>
                </thead>
                <tbody>
                  {viewMode === 'mix'
                    ? report.rows.map((row) => {
                        const rowKey = `mix:${row.id}`
                        const isExpanded = expandedRows.has(rowKey)
                        return (
                          <Fragment key={row.id}>
                            <tr className="border-b border-slate-100 align-top">
                              <td className="min-w-[220px] px-3 py-3">
                                <div className="flex min-w-0 items-start gap-2">
                                  <SourceCohortExpandToggle
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleRow(rowKey)}
                                  />
                                  <div className="min-w-0 max-w-[280px]">
                                    <div className="font-semibold text-slate-900">
                                      {row.sourceLabel}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                      {row.qualityLabel}
                                    </div>
                                    <div className="mt-1">
                                      <span className="inline-flex max-w-full rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                                        {row.customerLabel}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-900">
                                {formatInteger(row.createdDeals)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-emerald-700">
                                {formatInteger(row.wonDeals)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-900">
                                {formatSourceCohortPercent(row.winRate)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                {formatSourceCohortDays(row.averageDaysToWin)}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {formatInteger(row.lostDeals)}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {formatInteger(row.openDeals)}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">
                                <div className="max-w-[220px]">
                                  {summarizeSourceCohortStages(row.openStageBreakdown)}
                                </div>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="border-b border-slate-200">
                                <td colSpan={8} className="bg-slate-50/70 px-4 py-4">
                                  <SourceCohortRowDetails row={row} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })
                    : managerViews.map((manager) => {
                        const rowKey = `managers:${manager.managerId}`
                        const isExpanded = expandedRows.has(rowKey)
                        return (
                          <Fragment key={manager.managerId}>
                            <tr className="border-b border-slate-100 align-top">
                              <td className="min-w-[220px] px-3 py-3">
                                <div className="flex min-w-0 items-start gap-2">
                                  <SourceCohortExpandToggle
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleRow(rowKey)}
                                  />
                                  <div className="min-w-0 max-w-[280px]">
                                    <div className="font-semibold text-slate-900">
                                      {manager.managerName}
                                    </div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                      {formatInteger(manager.segments.length)}{' '}
                                      {manager.segments.length === 1 ? 'разрез' : 'разрезов'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-900">
                                {formatInteger(manager.createdDeals)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-emerald-700">
                                {formatInteger(manager.wonDeals)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-900">
                                {formatSourceCohortPercent(manager.winRate)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                {formatSourceCohortDays(manager.averageDaysToWin)}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {formatInteger(manager.lostDeals)}
                              </td>
                              <td className="px-3 py-3 text-slate-700">
                                {formatInteger(manager.openDeals)}
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600">
                                <div className="max-w-[220px]">
                                  {summarizeSourceCohortStages(manager.openStageBreakdown)}
                                </div>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="border-b border-slate-200">
                                <td colSpan={8} className="bg-slate-50/70 px-4 py-4">
                                  <SourceCohortManagerDetails manager={manager} />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {report ? (
        <SourceCohortStageConversionSection
          selectedMonthLabel={selectedMonthLabel}
          totalCreatedDeals={report.totalCreatedDeals}
          trajectory={report.trajectoryStatus === 'available' ? report.trajectory : undefined}
          trajectoryUnavailableReason={report.trajectoryUnavailableReason}
        />
      ) : null}
    </div>
  )
}

export function CohortsScene({ filters, runtimeData }: SceneComponentProps) {
  const [sliceMode, setSliceMode] = useState<'summary' | 'managers' | 'sources'>('summary')
  const [expandedCohortBreakdownRows, setExpandedCohortBreakdownRows] = useState<Set<string>>(() => new Set())
  const isUnavailable = runtimeData?.operationalStatus !== 'ready' && !runtimeData?.cohorts
  const sceneData = getCohortSceneData(runtimeData)
  const managerPickerOptions = getManagerPickerOptions(runtimeData)
  const sourcePickerOptions = getSourcePickerOptions(runtimeData)
  const sliceLabel =
    sliceMode === 'summary'
      ? 'общий срез'
      : sliceMode === 'managers'
        ? 'срез по менеджерам'
        : 'срез по источникам'
  const sliceDistribution =
    sliceMode === 'sources'
      ? sceneData.sourceDistribution
      : sceneData.managerDistribution
  const selectedManagers = summarizeFilterSelection(filters.managers, managerPickerOptions, 'Все менеджеры')
  const selectedSources = summarizeFilterSelection(filters.sources, sourcePickerOptions, 'Все источники')
  const cohortRangeLabel = sceneData.range
    ? `${formatFilterDate(sceneData.range.from.slice(0, 10))} - ${formatFilterDate(sceneData.range.to.slice(0, 10))}`
    : `${formatFilterDate(filters.rangeStart)} - ${formatFilterDate(filters.rangeEnd)}`
  const sourceBreakdownMode = sliceMode === 'sources' && sceneData.sourceBreakdownRows.length > 0
  const sourceBreakdownChildren = new Map<string, CohortBreakdownRow[]>()
  for (const row of sceneData.sourceBreakdownRows) {
    if (!row.parentId) {
      continue
    }

    const current = sourceBreakdownChildren.get(row.parentId) ?? []
    current.push(row)
    sourceBreakdownChildren.set(row.parentId, current)
  }
  const visibleSourceBreakdownRows: CohortBreakdownRow[] = []
  const appendSourceBreakdownRow = (row: CohortBreakdownRow) => {
    visibleSourceBreakdownRows.push(row)
    if (!expandedCohortBreakdownRows.has(row.id)) {
      return
    }

    for (const child of sourceBreakdownChildren.get(row.id) ?? []) {
      appendSourceBreakdownRow(child)
    }
  }
  for (const row of sceneData.sourceBreakdownRows.filter((entry) => !entry.parentId)) {
    appendSourceBreakdownRow(row)
  }
  const toggleCohortBreakdownRow = (rowId: string) => {
    setExpandedCohortBreakdownRows((current) => {
      const next = new Set(current)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  if (isUnavailable) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Когортный отчет"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные когортного отчёта.'
              : 'Live-данные когортного отчёта сейчас недоступны.'
          }
        />
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <section className="panel p-5">
          <PanelHeading
            title={sourceBreakdownMode ? 'Когорты по источникам' : 'Когортная матрица'}
            description={
              sourceBreakdownMode
                ? 'Месяц когорты раскрывается до источника, качества и клуба/заказчика. Окна продаж считаются относительно месяца создания сделки.'
                : `Месяц создания по строкам, закрытие по окнам времени по столбцам. Матрица всегда показывает последние 12 месяцев и пересчитывается только по менеджерам и источникам, сейчас выбран ${sliceLabel}.`
            }
            right={
              <div className="flex flex-wrap gap-2">
                <span className="badge-chip badge-neutral">
                  {sourceBreakdownMode
                    ? `${sceneData.sourceBreakdownRows.filter((row) => row.level === 'cohort').length} когорты`
                    : `${sceneData.matrixRows.length} когорты`}
                </span>
                <span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>
              </div>
            }
          />
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-sm">
            {[
              { id: 'summary', label: 'Общий срез' },
              { id: 'managers', label: 'По менеджерам' },
              { id: 'sources', label: 'По источникам' },
            ].map((slice) => (
              <button
                key={slice.id}
                type="button"
                onClick={() => setSliceMode(slice.id as 'summary' | 'managers' | 'sources')}
                className={
                  sliceMode === slice.id
                    ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                    : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
                }
              >
                {slice.label}
              </button>
            ))}
            <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              годовой период: {cohortRangeLabel}
            </span>
          </div>
          {sliceMode !== 'summary' ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {sliceMode === 'managers' ? (
                <span>Выбраны менеджеры: <span className="font-semibold text-slate-900">{selectedManagers}</span></span>
              ) : (
                <span>Выбраны источники: <span className="font-semibold text-slate-900">{selectedSources}</span></span>
              )}
            </div>
          ) : null}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-3 py-3">{sourceBreakdownMode ? 'Когорта / источник / качество / клуб' : 'Когорта'}</th>
                  <th className="px-3 py-3">Создано</th>
                  <th className="px-3 py-3">В 1 месяц</th>
                  <th className="px-3 py-3">Во 2 месяц</th>
                  <th className="px-3 py-3">В 3 месяц</th>
                  <th className="px-3 py-3">В 4+ месяц</th>
                  <th className="px-3 py-3">Конверсия</th>
                  <th className="px-3 py-3">Средний цикл</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdownMode
                  ? visibleSourceBreakdownRows.map((row) => {
                      const children = sourceBreakdownChildren.get(row.id) ?? []
                      const isExpanded = expandedCohortBreakdownRows.has(row.id)
                      return (
                        <tr
                          key={row.id}
                          className={
                            row.level === 'cohort'
                              ? 'border-b border-slate-100 bg-white last:border-b-0'
                              : 'border-b border-slate-100 bg-slate-50/60 last:border-b-0'
                          }
                        >
                          <td className="min-w-[260px] px-3 py-3 font-semibold text-slate-900">
                            <div
                              className="flex min-w-0 items-center gap-2"
                              style={{ paddingLeft: getCohortBreakdownIndent(row.level) }}
                            >
                              {children.length > 0 ? (
                                <button
                                  type="button"
                                  aria-label={isExpanded ? 'Свернуть строку' : 'Раскрыть строку'}
                                  onClick={() => toggleCohortBreakdownRow(row.id)}
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                                >
                                  <HugeiconsIcon
                                    icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                                    strokeWidth={2}
                                    className="h-4 w-4"
                                  />
                                </button>
                              ) : (
                                <span className="h-7 w-7 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="truncate">{row.label}</div>
                                <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  {getCohortBreakdownLevelLabel(row.level)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-900">{row.createdDeals}</td>
                          {row.cells.map((cell, index) => (
                            <td key={`${row.id}-${index}`} className="px-3 py-3">
                              <div className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-900" style={{
                                backgroundColor:
                                  cell.level === 5 ? 'rgba(77,124,255,0.24)' :
                                  cell.level === 4 ? 'rgba(77,124,255,0.18)' :
                                  cell.level === 3 ? 'rgba(77,124,255,0.13)' :
                                  cell.level === 2 ? 'rgba(77,124,255,0.1)' :
                                  'rgba(77,124,255,0.06)',
                              }}>
                                <div>{cell.value}</div>
                                {cell.subvalue ? (
                                  <div className="mt-1 text-[11px] font-semibold text-slate-500">
                                    {cell.subvalue}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          ))}
                          <td className="px-3 py-3">{row.conversion}</td>
                          <td className="px-3 py-3">{row.cycle}</td>
                        </tr>
                      )
                    })
                  : sceneData.matrixRows.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-3 font-semibold text-slate-900">{row.month}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{row.createdDeals}</td>
                        {row.cells.map((cell, index) => (
                          <td key={`${row.month}-${index}`} className="px-3 py-3">
                            <div className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-900" style={{
                              backgroundColor:
                                cell.level === 5 ? 'rgba(77,124,255,0.24)' :
                                cell.level === 4 ? 'rgba(77,124,255,0.18)' :
                                cell.level === 3 ? 'rgba(77,124,255,0.13)' :
                                cell.level === 2 ? 'rgba(77,124,255,0.1)' :
                                'rgba(77,124,255,0.06)',
                            }}>
                              <div>{cell.value}</div>
                              {cell.subvalue ? (
                                <div className="mt-1 text-[11px] font-semibold text-slate-500">
                                  {cell.subvalue}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        ))}
                        <td className="px-3 py-3">{row.conversion}</td>
                        <td className="px-3 py-3">{row.cycle}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-5">
            <PanelHeading
              title="Распределение закрытия"
              description="Средняя доля закрытий по когортам в 1-й, 2-й, 3-й и 4+ месяц после создания."
            />
            <div className="space-y-4">
              {sceneData.distributionBuckets.map((bucket) => (
                <div key={bucket.label} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{bucket.label}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-700">{bucket.value}</div>
                      {bucket.delta ? <DeltaPill value={bucket.delta} /> : null}
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#9ab4ff)]"
                      style={{ width: `${bucket.width}%` }}
                    />
                  </div>
                  {bucket.compare ? (
                    <div className="text-xs text-slate-500">предыдущий период: {bucket.compare}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <PanelHeading
              title={sliceMode === 'sources' ? 'Распределение по источникам' : 'Распределение по менеджерам'}
              description={
                sliceMode === 'sources'
                  ? 'Какие каналы чаще закрываются в 1-й, 2-й, 3-й и 4+ месяц после создания.'
                  : 'У кого чаще закрываются сделки в 1-й, 2-й, 3-й и 4+ месяц после создания.'
              }
            />
            <div className="space-y-3">
              {sliceDistribution.map((row) => (
                <div key={row.manager} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-900">{row.manager}</div>
                    <div className="text-xs font-semibold text-slate-500">пик: во 2 месяц</div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">1м: {row.month1}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">2м: {row.month2}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">3м: {row.month3}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">4+: {row.tail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <ManagerActionOutcomeSection
        report={runtimeData?.managerActionOutcomes}
        status={runtimeData?.managerActionOutcomesStatus}
        error={runtimeData?.managerActionOutcomesError}
      />
    </div>
  )
}

export function FunnelFlowScene({ filters, runtimeData }: SceneComponentProps) {
  const isUnavailable = runtimeData?.operationalStatus !== 'ready' && !runtimeData?.tocFlow
  const sceneData = getTocSceneData(runtimeData)

  if (isUnavailable) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Движение по воронке"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные stage-flow.'
              : 'Live-данные stage-flow сейчас недоступны.'
          }
        />
      </section>
    )
  }

  if (sceneData.currentStages.length === 0) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Движение по воронке"
          description="Для выбранного периода пока нет stage-flow данных."
        />
      </section>
    )
  }

  const currentLabel = `${formatFilterDate(filters.rangeStart)} - ${formatFilterDate(filters.rangeEnd)}`
  const compareLabel = getCompareRangeLabel(filters)
  const hasCompare = sceneData.compareStages.length > 0
  const compareByStage = new Map(sceneData.compareStages.map((stage) => [stage.stage, stage]))
  const bottleneck = sceneData.currentStages.reduce((best, current) =>
    current.throughputPerDay < best.throughputPerDay ? current : best,
  )
  const compareBottleneck =
    sceneData.compareStages.length > 0
      ? sceneData.compareStages.reduce((best, current) =>
          current.throughputPerDay < best.throughputPerDay ? current : best,
        )
      : null
  const maxQueueStage = sceneData.currentStages.reduce((best, current) =>
    current.queueEnd > best.queueEnd ? current : best,
  )
  const throughputDropStage = sceneData.currentStages.reduce(
    (worst, current) => {
      const compare = compareByStage.get(current.stage)
      const delta = current.throughputPerDay - (compare?.throughputPerDay ?? 0)

      return delta < worst.delta ? { stage: current.stage, delta } : worst
    },
    { stage: sceneData.currentStages[0]!.stage, delta: Infinity },
  )
  const bottleneckBuffer = queueBufferDays(bottleneck.queueEnd, bottleneck.throughputPerDay)
  const maxQueueBuffer = queueBufferDays(maxQueueStage.queueEnd, maxQueueStage.throughputPerDay)
  const managerConversionStages = sceneData.managerConversionRows[0]?.stages.map((stage) => stage.stage) ?? []

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div>
          <FunnelTocChart
            current={sceneData.currentStages}
            compare={sceneData.compareStages}
            currentLabel={currentLabel}
            compareLabel={compareLabel}
          />
        </div>

        <div className="panel p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Фокус TOC</h3>
          {sceneData.warnings.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {sceneData.warnings.join(' · ')}
            </div>
          ) : null}
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Ограничение</p>
              <p className="font-semibold">{sceneData.focus.bottleneckStage || bottleneck.stage}</p>
              <p className="text-sm text-slate-500">Пропускная способность: {formatNumber(bottleneck.throughputPerDay)} / день</p>
              <p className="text-sm text-slate-500">Очередь: {formatNumber(bottleneck.queueEnd)}</p>
              <p className="text-sm text-slate-500">
                Буфер очереди: {bottleneckBuffer ? `${bottleneckBuffer.toFixed(1)} дн.` : '—'}
              </p>
              {hasCompare ? (
                <p className="text-sm text-slate-500">
                  Сравнение 1: {sceneData.focus.compareBottleneckStage || compareBottleneck?.stage || '—'}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Где копится очередь</p>
              <p className="font-semibold">{sceneData.focus.maxQueueStage || maxQueueStage.stage}</p>
              <p className="text-sm text-slate-500">
                Объем: {formatNumber(maxQueueStage.queueEnd)} | Буфер:{' '}
                {maxQueueBuffer ? `${maxQueueBuffer.toFixed(1)} дн.` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Вывод за период</p>
              <p className="text-sm text-slate-700">
                {hasCompare ? 'Самая сильная просадка ПС:' : 'Минимальная ПС:'}{' '}
                <span className="font-semibold">
                  {sceneData.focus.throughputDropStage || throughputDropStage.stage}
                </span>{' '}
                {hasCompare ? `(${formatSignedNumber(throughputDropStage.delta)} сдел./день). ` : ''}
                Первый фокус: разгрузить этот этап и не переливать входящий поток выше его фактической ПС.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FunnelStageDistributionChart distribution={sceneData.stageDistribution} />

      <section className="panel overflow-auto p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          {hasCompare ? 'Стадии: основной vs сравнение 1' : 'Стадии: основной период'}
        </h3>
        {hasCompare ? (
          <p className="mb-2 text-xs text-slate-500">Сравнение 1: {compareLabel}</p>
        ) : null}
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
              <th className="px-2 py-2">Этап</th>
              <th className="px-2 py-2">Вход в этап</th>
              <th className="px-2 py-2">Текущая ПС/день</th>
              {hasCompare ? <th className="px-2 py-2">ПС сравнения/день</th> : null}
              {hasCompare ? <th className="px-2 py-2">Изменение ПС</th> : null}
              <th className="px-2 py-2">Очередь (текущая)</th>
              {hasCompare ? <th className="px-2 py-2">Очередь (сравнение)</th> : null}
              <th className="px-2 py-2">Буфер очереди</th>
            </tr>
          </thead>
          <tbody>
            {sceneData.currentStages.map((stage) => {
              const compare = compareByStage.get(stage.stage)
              const buffer = queueBufferDays(stage.queueEnd, stage.throughputPerDay)

              return (
                <tr key={stage.stage} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-semibold text-slate-900">{stage.stage}</td>
                  <td className="px-2 py-2">{formatNumber(stage.entered)}</td>
                  <td className="px-2 py-2">{formatNumber(stage.throughputPerDay)}</td>
                  {hasCompare ? (
                    <td className="px-2 py-2">{compare ? formatNumber(compare.throughputPerDay) : '—'}</td>
                  ) : null}
                  {hasCompare ? (
                    <td className="px-2 py-2">{compare ? formatSignedNumber(stage.throughputPerDay - compare.throughputPerDay) : '—'}</td>
                  ) : null}
                  <td className="px-2 py-2">{formatNumber(stage.queueEnd)}</td>
                  {hasCompare ? (
                    <td className="px-2 py-2">{compare ? formatNumber(compare.queueEnd) : '—'}</td>
                  ) : null}
                  <td className="px-2 py-2">{buffer ? `${buffer.toFixed(1)} дн.` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {sceneData.stableLeaders.length > 0 ? (
        <section className="panel overflow-auto p-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Сильные менеджеры по этапам
          </h3>
          <p className="mb-2 text-xs text-slate-500">
            Для каждого этапа показывается лидер текущего периода, его объём и признак устойчивости относительно первого compare-периода.
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-2 py-2">Этап</th>
                <th className="px-2 py-2">Лидер</th>
                <th className="px-2 py-2">Текущая конверсия</th>
                <th className="px-2 py-2">Сравнение 1</th>
                <th className="px-2 py-2">Устойчивость</th>
              </tr>
            </thead>
            <tbody>
              {sceneData.stableLeaders.map((leader) => (
                <tr key={leader.stage} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 font-semibold text-slate-900">{leader.stage}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{leader.manager}</div>
                    <div className="text-xs text-slate-500">{leader.volume}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{leader.conversion}</div>
                    <div className="text-xs text-slate-500">{leader.volume}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{leader.compareConversion}</div>
                    <div className="text-xs text-slate-500">{leader.compareVolume}</div>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                        leader.stabilityTone === 'positive'
                          ? 'bg-emerald-100 text-emerald-800'
                          : leader.stabilityTone === 'negative'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {leader.stabilityLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {sceneData.managerConversionRows.length > 0 ? (
        <section className="panel overflow-auto p-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Конверсии этапов по менеджерам
          </h3>
          <p className="mb-2 text-xs text-slate-500">
            Для каждого менеджера: перешло на следующий этап / вошло в этап за основной период.
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-2 py-2">Менеджер</th>
                {managerConversionStages.map((stage) => (
                  <th key={stage} className="min-w-[170px] px-2 py-2">{stage}</th>
                ))}
                <th className="px-2 py-2">Средняя</th>
              </tr>
            </thead>
            <tbody>
              {sceneData.managerConversionRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 font-semibold text-slate-900">{row.manager}</td>
                  {row.stages.map((stage) => (
                    <td key={`${row.manager}-${stage.stage}`} className="px-2 py-2">
                      <div
                        className="rounded-xl border border-slate-200 px-3 py-2"
                        style={{ backgroundColor: conversionHeatColor(stage.level) }}
                      >
                        <div className="font-bold text-slate-900">{stage.conversion}</div>
                        <div className="text-xs text-slate-500">{stage.volume}</div>
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 font-bold text-slate-900">{row.averageConversion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}

function formatUnitEconomicsRange(
  report: UnitEconomicsReport | null,
  filters: ProtoFilterState,
) {
  const from = report?.range.from.slice(0, 10) ?? filters.rangeStart
  const to = report?.range.to.slice(0, 10) ?? filters.rangeEnd

  return `${formatFilterDate(from)} - ${formatFilterDate(to)}`
}

function sumUnitEconomicsCostRows(rows: UnitEconomicsManagerCostDetailRow[]) {
  return rows.reduce((total, detailRow) => total + detailRow.amount, 0)
}

function getManagerProductionCost(row: UnitEconomicsManagerRow) {
  return sumUnitEconomicsCostRows(row.productionCostRows)
}

function getManagerDirectCost(row: UnitEconomicsManagerRow) {
  return sumUnitEconomicsCostRows(row.directCostRows)
}

function getManagerTaxAndFinanceCost(row: UnitEconomicsManagerRow) {
  return sumUnitEconomicsCostRows(row.taxAndFinanceRows)
}

function getManagerTotalCost(row: UnitEconomicsManagerRow) {
  return getManagerProductionCost(row) + getManagerDirectCost(row) + getManagerTaxAndFinanceCost(row)
}

function formatUnitEconomicsQuantity(
  quantity: number | null,
  unitLabel: string | null,
) {
  if (quantity === null) {
    return '—'
  }

  return unitLabel ? `${formatNumber(quantity)} ${unitLabel}` : formatNumber(quantity)
}

function formatUnitEconomicsDetailPrice(
  unitPrice: number | null,
  percent: number | null,
) {
  if (percent !== null) {
    return `${formatNumber(percent)}%`
  }

  if (unitPrice !== null) {
    return formatRubles(unitPrice)
  }

  return '—'
}

function formatUnitEconomicsPnlLevel(level: string) {
  if (level === 'variable_contribution') {
    return 'Себестоимость производства'
  }

  if (level === 'above_ebitda') {
    return 'Прямые расходы'
  }

  if (level === 'below_ebitda') {
    return 'Налоги и финсервис'
  }

  return level
}

function UnitEconomicsManagerDetails({ row }: { row: UnitEconomicsManagerRow }) {
  const hasDetailRows =
    row.revenueRows.length > 0 ||
    row.productionCostRows.length > 0 ||
    row.directCostRows.length > 0 ||
    row.taxAndFinanceRows.length > 0
  const revenueTotal = row.revenueRows.reduce(
    (total, revenueRow) => total + revenueRow.attractionRevenue,
    0,
  )
  const productionTotal = row.productionCostRows.reduce(
    (total, detailRow) => total + detailRow.amount,
    0,
  )
  const grossMarginRubles = revenueTotal - productionTotal
  const directTotal = row.directCostRows.reduce(
    (total, detailRow) => total + detailRow.amount,
    0,
  )
  const ebitdaRubles = grossMarginRubles - directTotal
  const belowEbitdaTotal = row.taxAndFinanceRows.reduce(
    (total, detailRow) => total + detailRow.amount,
    0,
  )
  const netProfitRubles = ebitdaRubles - belowEbitdaTotal
  const marginPercent = (value: number) =>
    revenueTotal > 0 ? formatOptionalPercent(value / revenueTotal) : '—'
  const buildTotalRow = (
    section: string,
    article: string,
    amount: string,
    tone: 'revenue' | 'expense' | 'result',
  ) => ({
    section,
    article,
    product: '—',
    quantity: '—',
    basis: '—',
    price: '—',
    amount,
    warnings: [],
    isTotal: true,
    tone,
  })
  const detailRows: Array<{
    section: string
    article: string
    product: string
    quantity: string
    basis: string
    price: string
    amount: string
    warnings: string[]
    tone: 'revenue' | 'expense' | 'result'
    isTotal?: boolean
  }> = [
    ...row.revenueRows.map((revenueRow) => ({
      section: 'Доходы',
      article: 'Выручка от основной деятельности',
      product: [revenueRow.clubLabel ?? 'Без клуба', revenueRow.tariffLabel ?? 'Без тарифа']
        .filter(Boolean)
        .join(' · '),
      quantity: `${formatInteger(revenueRow.wonDeals)} won`,
      basis: 'Выигранные сделки периода',
      price: revenueRow.wonDeals > 0
        ? formatRubles(revenueRow.attractionRevenue / revenueRow.wonDeals)
        : '—',
      amount: formatRubles(revenueRow.attractionRevenue),
        warnings: [],
        tone: 'revenue' as const,
    })),
    buildTotalRow('Доходы', 'Итого доходы', formatRubles(revenueTotal), 'revenue'),
    ...row.productionCostRows.map((detailRow) => ({
      section: 'Себестоимость производства',
      article: detailRow.articleLabel,
      product: detailRow.productLabel,
      quantity: formatUnitEconomicsQuantity(detailRow.quantity, detailRow.unitLabel),
      basis: detailRow.basis,
      price: formatUnitEconomicsDetailPrice(detailRow.unitPrice, detailRow.percent),
      amount: formatRubles(detailRow.amount),
      warnings: detailRow.warnings,
      tone: 'expense' as const,
    })),
    buildTotalRow(
      'Себестоимость производства',
      'Итого себестоимость производства',
      formatRubles(productionTotal),
      'expense',
    ),
    buildTotalRow(
      'Себестоимость производства',
      'Gross margin, Р.:',
      formatRubles(grossMarginRubles),
      'result',
    ),
    buildTotalRow(
      'Себестоимость производства',
      'Gross margin, %:',
      marginPercent(grossMarginRubles),
      'result',
    ),
    ...row.directCostRows.map((detailRow) => ({
      section: 'Прямые расходы',
      article: detailRow.articleLabel,
      product: detailRow.productLabel,
      quantity: formatUnitEconomicsQuantity(detailRow.quantity, detailRow.unitLabel),
      basis: detailRow.basis,
      price: formatUnitEconomicsDetailPrice(detailRow.unitPrice, detailRow.percent),
      amount: formatRubles(detailRow.amount),
      warnings: detailRow.warnings,
      tone: 'expense' as const,
    })),
    buildTotalRow(
      'Прямые расходы',
      'Итого прямые расходы',
      formatRubles(directTotal),
      'expense',
    ),
    buildTotalRow('Прямые расходы', 'Ebitda, Р.:', formatRubles(ebitdaRubles), 'result'),
    buildTotalRow('Прямые расходы', 'Ebitda, %:', marginPercent(ebitdaRubles), 'result'),
    ...row.taxAndFinanceRows.map((detailRow) => ({
      section: 'Налоги и финсервис',
      article: detailRow.articleLabel,
      product: detailRow.productLabel,
      quantity: formatUnitEconomicsQuantity(detailRow.quantity, detailRow.unitLabel),
      basis: detailRow.basis,
      price: formatUnitEconomicsDetailPrice(detailRow.unitPrice, detailRow.percent),
      amount: formatRubles(detailRow.amount),
      warnings: detailRow.warnings,
      tone: 'expense' as const,
    })),
    buildTotalRow(
      'Налоги и финсервис',
      'Итого налоги и финсервис',
      formatRubles(belowEbitdaTotal),
      'expense',
    ),
    buildTotalRow(
      'Налоги и финсервис',
      'Чистая прибыль (Net Profit), Р.:',
      formatRubles(netProfitRubles),
      'result',
    ),
    buildTotalRow(
      'Налоги и финсервис',
      'Чистая прибыль (Net Profit), %:',
      marginPercent(netProfitRubles),
      'result',
    ),
  ]
  let previousSection: string | null = null

  if (!hasDetailRows) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
        Детализация по менеджеру пока не рассчитана.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[0.68rem] uppercase tracking-[0.08em] text-slate-500">
            <th className="px-3 py-2">Раздел</th>
            <th className="px-3 py-2">Статья</th>
            <th className="px-3 py-2">Продукт</th>
            <th className="px-3 py-2">Кол-во</th>
            <th className="px-3 py-2">Основание</th>
            <th className="px-3 py-2">Цена</th>
            <th className="px-3 py-2">Стоимость</th>
          </tr>
        </thead>
        <tbody>
          {detailRows.map((detailRow, index) => {
            const showSection = detailRow.section !== previousSection
            previousSection = detailRow.section
            const productLabel =
              detailRow.product === detailRow.article ? '—' : detailRow.product
            const amountClassName = [
              'px-3 py-2 font-semibold',
              detailRow.tone === 'expense' || detailRow.amount.startsWith('-')
                ? 'text-rose-700'
                : 'text-slate-900',
            ].join(' ')

            return (
              <tr
                key={`${detailRow.section}-${detailRow.article}-${detailRow.product}-${index}`}
                className={[
                  'border-b border-slate-100 last:border-b-0',
                  detailRow.isTotal ? 'bg-slate-50 font-semibold' : '',
                ].filter(Boolean).join(' ')}
              >
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {showSection ? detailRow.section : ''}
                </td>
                <td className="px-3 py-2 text-slate-700">{detailRow.article}</td>
                <td className="px-3 py-2 text-slate-700">
                  {detailRow.section === 'Доходы' ? (
                    <div className="flex flex-wrap gap-1">
                      {productLabel.split(' · ').map((productPart) => (
                        <span
                          key={productPart}
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5"
                        >
                          {productPart}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div>{productLabel}</div>
                  )}
                  {detailRow.warnings.length > 0 ? (
                    <div className="mt-1 text-[0.68rem] font-semibold text-amber-700">
                      {detailRow.warnings.join(' ')}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-700">{detailRow.quantity}</td>
                <td className="px-3 py-2 text-slate-500">{detailRow.basis}</td>
                <td className="px-3 py-2 text-slate-700">{detailRow.price}</td>
                <td className={amountClassName}>
                  {detailRow.amount}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function UnitEconomicsScene({ filters, runtimeData }: SceneComponentProps) {
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null)
  const savedEventParticipantMode =
    runtimeData?.unitEconomicsSettings?.eventParticipantMode ?? 'invited'
  const [eventParticipantMode, setEventParticipantMode] =
    useState<UnitEconomicsEventParticipantMode>(savedEventParticipantMode)
  const [fetchedReport, setFetchedReport] = useState<{
    runtimeKey: string
    report: UnitEconomicsReport
  } | null>(null)
  const [loadError, setLoadError] = useState<{
    runtimeKey: string
    message: string
  } | null>(null)
  const query = useMemo(() => buildDashboardQueryFromProtoFilters(filters), [filters])
  const runtimeKey = JSON.stringify({
    preset: query.preset,
    from: 'from' in query ? query.from : null,
    to: 'to' in query ? query.to : null,
    managers: query.managerIds,
    sources: query.sourceKeys,
    businessClubs: query.businessClubKeys,
    targetGroups: query.targetGroupKeys,
    eventParticipantMode,
  })
  const report =
    fetchedReport?.runtimeKey === runtimeKey ? fetchedReport.report : null
  const errorMessage =
    loadError?.runtimeKey === runtimeKey ? loadError.message : null
  const shouldLoad =
    Boolean(runtimeData && runtimeData.operationalStatus === 'ready') && !report
  const isUnavailable = runtimeData?.operationalStatus !== 'ready' && !report

  useEffect(() => {
    setEventParticipantMode(savedEventParticipantMode)
  }, [savedEventParticipantMode])

  useEffect(() => {
    if (!shouldLoad) {
      return
    }

    let cancelled = false

    apiClient
      .getUnitEconomicsReport({
        ...query,
        eventParticipantMode,
        compareRanges: [],
      })
      .then((nextReport) => {
        if (!cancelled) {
          setFetchedReport({ runtimeKey, report: nextReport })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError({
            runtimeKey,
            message:
              error instanceof Error
                ? error.message
                : 'Не удалось загрузить финрезультат',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [eventParticipantMode, query, runtimeKey, shouldLoad])

  if (isUnavailable) {
    return (
      <section
        className="panel p-5"
        data-comment-block-id="attraction-unit-economics-financial-result"
        data-comment-block-label="Привлечение: финрезультат"
        id="attraction-unit-economics-financial-result"
      >
        <PanelHeading
          title="Финрезультат"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю P&L и юнит-экономику.'
              : 'Финрезультат сейчас недоступен.'
          }
        />
      </section>
    )
  }

  const summary = report?.summary
  const warnings = report?.warnings ?? []
  const managerRows = report?.managerRows ?? []
  const rangeLabel = formatUnitEconomicsRange(report, filters)
  const metrics = [
    {
      label: 'Доход Привлечения',
      value: formatOptionalRubles(summary?.attractionRevenue ?? null),
      note: `${formatInteger(summary?.wonDeals ?? 0)} won`,
    },
    {
      label: 'Переменные расходы',
      value: formatOptionalRubles(summary?.variableCosts ?? null),
      note: `Лиды ${formatOptionalRubles(summary?.leadPurchaseCost ?? null)}`,
      tone: 'expense',
    },
    {
      label: 'Маржинальный результат',
      value: formatOptionalRubles(summary?.contributionResult ?? null),
      note: formatOptionalPercent(summary?.contributionMargin ?? null),
    },
    {
      label: 'Операционные расходы',
      value: formatOptionalRubles(summary?.aboveEbitdaCosts ?? null),
      note: 'Операционный блок',
      tone: 'expense',
    },
    {
      label: 'EBITDA',
      value: formatOptionalRubles(summary?.ebitda ?? null),
      note: formatOptionalPercent(summary?.ebitdaMargin ?? null),
    },
    {
      label: 'Net Profit',
      value: formatOptionalRubles(summary?.netProfit ?? null),
      note: formatOptionalPercent(summary?.netProfitMargin ?? null),
    },
  ]

  return (
    <div className="grid gap-6">
      <section
        className="panel p-5"
        data-comment-block-id="attraction-unit-economics-financial-result"
        data-comment-block-label="Привлечение: финрезультат"
        id="attraction-unit-economics-financial-result"
      >
        <PanelHeading
          title="Финрезультат"
          description="P&L модуля: закупка лидов, контрактация, прямые расходы, EBITDA и Net Profit."
          right={<span className="badge-chip badge-neutral">Период: {rangeLabel}</span>}
        />

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
            {errorMessage}
          </div>
        ) : null}

        {!report && !errorMessage ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
            Загрузка финрезультата...
          </div>
        ) : null}

        {warnings.length > 0 ? <WarningSummaryBlock warnings={warnings} /> : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Расходы событий
          </span>
          {([
            ['invited', 'Приглашенные'],
            ['attended', 'Дошедшие'],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={eventParticipantMode === mode ? 'btn btn-primary' : 'btn btn-ghost'}
              aria-pressed={eventParticipantMode === mode}
              onClick={() => setEventParticipantMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => {
            const valueClassName = [
              'mt-1 break-words text-xl font-bold',
              metric.tone === 'expense' || metric.value.startsWith('-')
                ? 'text-rose-700'
                : 'text-slate-900',
            ].join(' ')

            return (
              <div key={metric.label} className="metric p-4">
                <p className="subtle-label">{metric.label}</p>
                <p className={valueClassName}>
                  {metric.value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{metric.note}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-unit-economics-managers"
        data-comment-block-label="Привлечение: финрезультат по менеджерам"
      >
        <PanelHeading
          title="Менеджеры"
          description="Разрез P&L по владельцу сделки: себестоимость производства, прямые расходы, налоги, доход и прибыль."
          right={<span className="badge-chip badge-neutral">{formatInteger(managerRows.length)} строк</span>}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-2 py-2">Менеджер</th>
                <th className="px-2 py-2">Создано</th>
                <th className="px-2 py-2">Won</th>
                <th className="px-2 py-2">Покупки</th>
                <th className="px-2 py-2">С/с производства</th>
                <th className="px-2 py-2">Прямые расходы</th>
                <th className="px-2 py-2">Налоги и финсервис</th>
                <th className="px-2 py-2">Все расходы</th>
                <th className="px-2 py-2">Доход</th>
                <th className="px-2 py-2">Прибыль</th>
                <th className="px-2 py-2">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {managerRows.length > 0 ? (
                managerRows.map((row) => {
                  const isExpanded = expandedManagerId === row.managerId
                  const productionCost = getManagerProductionCost(row)
                  const directCost = getManagerDirectCost(row)
                  const taxAndFinanceCost = getManagerTaxAndFinanceCost(row)
                  const totalCost = getManagerTotalCost(row)
                  const profitClassName = [
                    'px-2 py-3 font-semibold',
                    row.financialResult < 0 ? 'text-rose-700' : 'text-slate-900',
                  ].join(' ')

                  return (
                    <Fragment key={row.managerId}>
                      <tr className="border-b border-slate-100">
                        <td className="px-2 py-3 font-semibold text-slate-900">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-left font-semibold text-slate-900 hover:text-blue-700"
                            onClick={() =>
                              setExpandedManagerId((current) =>
                                current === row.managerId ? null : row.managerId,
                              )
                            }
                          >
                            <span className="text-slate-400">
                              {isExpanded ? '▾' : '▸'}
                            </span>
                            <span>{row.managerName}</span>
                          </button>
                        </td>
                        <td className="px-2 py-3">{formatInteger(row.createdDeals)}</td>
                        <td className="px-2 py-3">{formatInteger(row.wonDeals)}</td>
                        <td className="px-2 py-3">{formatInteger(row.purchasedLeads)}</td>
                        <td className="px-2 py-3 text-rose-700">
                          {formatRubles(productionCost)}
                        </td>
                        <td className="px-2 py-3 text-rose-700">
                          {formatRubles(directCost)}
                        </td>
                        <td className="px-2 py-3 text-rose-700">
                          {formatRubles(taxAndFinanceCost)}
                        </td>
                        <td className="px-2 py-3 text-rose-700">
                          {formatRubles(totalCost)}
                        </td>
                        <td className="px-2 py-3 font-semibold text-slate-900">
                          {formatRubles(row.attractionRevenue)}
                        </td>
                        <td className={profitClassName}>
                          {formatRubles(row.financialResult)}
                        </td>
                        <td className="px-2 py-3">
                          {formatOptionalPercent(row.margin)}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td className="px-2 py-3" colSpan={11}>
                            <UnitEconomicsManagerDetails row={row} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              ) : (
                <tr>
                  <td className="px-2 py-3 text-sm font-semibold text-slate-600" colSpan={11}>
                    Нет менеджерских строк для выбранного периода.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="panel p-5"
        data-comment-block-id="attraction-unit-economics-cost-ledger"
        data-comment-block-label="Привлечение: статьи расходов"
      >
        <PanelHeading
          title="Статьи расходов"
          description="Факты и правила расходов с уровнем P&L и методом расчета."
        />
        <div className="mt-4 grid gap-2">
          {(report?.costRows ?? []).length > 0 ? (
            report?.costRows.map((row) => (
              <div
                key={`${row.articleId}-${row.sourceSystem}-${row.amount}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-slate-900">{row.label}</div>
                  <div className="text-xs text-slate-500">
                    {formatUnitEconomicsPnlLevel(row.pnlLevel)} · {row.calculationMethod} · {row.sourceSystem}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-rose-700">{formatRubles(row.amount)}</div>
                  <div className="text-xs text-slate-500">
                    {row.percent !== null ? `${formatNumber(row.percent)}%` : row.confidence}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
              Расходные правила пока не настроены для выбранного периода.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

const sceneComponents: Record<string, ComponentType<SceneComponentProps>> = {
  operations: OperationsScene,
  sales: SalesScene,
  'sales-plan': SalesPlanScene,
  'activities-calls': ActivitiesScene,
  cohorts: CohortsScene,
  'source-cohorts': SourceCohortsScene,
  'revenue-velocity': RevenueVelocityScene,
  'unit-economics': UnitEconomicsScene,
  'funnel-flow': FunnelFlowScene,
}

export const scenes: ProtoScene[] = sceneMetadata.map((scene) => ({
  ...scene,
  component: sceneComponents[scene.id] ?? SalesScene,
}))
