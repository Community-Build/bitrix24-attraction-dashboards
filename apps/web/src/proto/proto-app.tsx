import '@/proto/proto.css'

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, LazyExoticComponent, MouseEvent } from 'react'
import { Notification03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  ConversionEventTypeSettingsInput,
  DashboardQuery,
  DealPricingRuleInput,
  LastSyncSummary,
  LeadgenFunnelReport,
  ManagerWhitelistSettingsInput,
  MetaResponse,
  OperationalThresholdSettingsInput,
  SalesPlanQuarterDraftRow,
  SnapshotStats,
  SyncChangeSummary,
  SyncDealChangeBreakdown,
  SyncProgressEvent,
  SyncRunHistoryResponse,
  SyncRunLogEntry,
  SyncSummary,
  UnitEconomicsCostRulesInput,
} from '@/lib/dashboard-types'
import { cn } from '@/lib/utils'
import {
  createDefaultFilters,
  managerOptions,
  sceneMetadata as scenes,
  sourceOptions,
} from '@/proto/scene-registry'
import {
  buildDashboardQueryFromProtoFilters,
  mapActivitiesCallsSceneData,
  mapCohortSceneData,
  mapTocFlowSceneData,
} from '@/proto/live-reporting'
import {
  createEmptyManagerWhitelistDraftState,
  ModuleSettingsPanel,
} from '@/proto/module-settings-panel'
import type { ManagerWhitelistDraftState } from '@/proto/module-settings-panel'
import type {
  CompareRange,
  AuthUser,
  CommentNotification,
  ModuleRole,
  ModuleUser,
  PaperclipCommentStatus,
  PaperclipReadyReport,
  PickerOption,
  PlatformAccess,
  PlatformMembershipInput,
  PlatformUser,
  ActivitiesCallsSceneData,
  ProtoComment,
  ProtoCommentAnchor,
  ProtoCommentContext,
  ProtoFilterState,
  ProtoKpi,
  ProtoRuntimeData,
  SceneComponentProps,
} from '@/proto/types'
import { useProtoComments } from '@/proto/use-proto-comments'

const LazyCallAnalysisWorkspace = lazy(() =>
  import('@/proto/call-analysis-workspace').then((module) => ({
    default: module.CallAnalysisWorkspace,
  })),
)

const LazyActivitiesScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.ActivitiesScene })),
)
const LazyCohortsScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.CohortsScene })),
)
const LazyFunnelFlowScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.FunnelFlowScene })),
)
const LazyOntologyHubScene = lazy(() =>
  import('@/proto/ontology-hub').then((module) => ({ default: module.OntologyHubScene })),
)
const LazyPlaybookScene = lazy(() =>
  import('@/proto/playbook-scene').then((module) => ({ default: module.PlaybookScene })),
)
const LazyRevenueVelocityScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.RevenueVelocityScene })),
)
const LazyOperationsScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.OperationsScene })),
)
const LazySourceCohortsScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.SourceCohortsScene })),
)
const LazySalesPlanScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.SalesPlanScene })),
)
const LazySalesScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.SalesScene })),
)
const LazyUnitEconomicsScene = lazy(() =>
  import('@/proto/scenes').then((module) => ({ default: module.UnitEconomicsScene })),
)

const lazySceneComponents: Record<
  string,
  LazyExoticComponent<ComponentType<SceneComponentProps>>
> = {
  operations: LazyOperationsScene,
  sales: LazySalesScene,
  'sales-plan': LazySalesPlanScene,
  'activities-calls': LazyActivitiesScene,
  cohorts: LazyCohortsScene,
  'source-cohorts': LazySourceCohortsScene,
  'revenue-velocity': LazyRevenueVelocityScene,
  'unit-economics': LazyUnitEconomicsScene,
  'funnel-flow': LazyFunnelFlowScene,
}

function getLazySceneComponent(sceneId: string) {
  return lazySceneComponents[sceneId] ?? LazySalesScene
}

function SceneLoadingFallback({ label = 'Загружаю экран' }: { label?: string }) {
  return (
    <section className="panel p-5" aria-live="polite">
      <h2 className="text-xl font-bold text-slate-900">{label}</h2>
      <p className="mt-1 text-sm text-slate-500">Подготавливаю интерфейс отчета.</p>
    </section>
  )
}

type CustomDashboardQuery = Extract<DashboardQuery, { preset: 'custom' }>

type ProtoAppProps = {
  currentUser?: AuthUser | null
}

type LeadgenWorkloadData = {
  activities: ActivitiesWorkloadReport
  calls: CallsWorkloadReport
  scene: ActivitiesCallsSceneData
}
type LeadgenLoadStatus = 'idle' | 'loading' | 'error'

type ProtoRoute = 'dashboard' | 'calls' | 'account' | 'ontology' | 'playbook'
type AccountTab = 'profile' | 'module' | 'settings' | 'users'
type SceneLoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type AttractionSceneLoadKey =
  | 'sales'
  | 'activities-calls'
  | 'cohorts'
  | 'funnel-flow'
  | 'ontology'

const initialAttractionSceneStatuses: Record<AttractionSceneLoadKey, SceneLoadStatus> = {
  sales: 'idle',
  'activities-calls': 'idle',
  cohorts: 'idle',
  'funnel-flow': 'idle',
  ontology: 'idle',
}

function getAttractionSceneLoadKey(sceneId: string): AttractionSceneLoadKey {
  if (sceneId === 'activities-calls') {
    return 'activities-calls'
  }

  if (sceneId === 'cohorts') {
    return 'cohorts'
  }

  if (sceneId === 'funnel-flow') {
    return 'funnel-flow'
  }

  return 'sales'
}

function getRuntimeSceneStatus(
  runtimeData: ProtoRuntimeData,
  sceneKey: AttractionSceneLoadKey,
) {
  return runtimeData.sceneStatuses?.[sceneKey] ?? runtimeData.operationalStatus
}

function getRuntimeSceneError(
  runtimeData: ProtoRuntimeData,
  sceneKey: AttractionSceneLoadKey,
) {
  return runtimeData.sceneErrors?.[sceneKey] ?? runtimeData.operationalError
}

function setRuntimeSceneState(
  runtimeData: ProtoRuntimeData,
  sceneKey: AttractionSceneLoadKey,
  status: SceneLoadStatus,
  error: string | null,
): ProtoRuntimeData {
  return {
    ...runtimeData,
    operationalStatus: status,
    operationalError: error,
    sceneStatuses: {
      ...initialAttractionSceneStatuses,
      ...runtimeData.sceneStatuses,
      [sceneKey]: status,
    },
    sceneErrors: {
      ...runtimeData.sceneErrors,
      [sceneKey]: error,
    },
  }
}

function withoutManagerActionOutcomes(runtimeData: ProtoRuntimeData): ProtoRuntimeData {
  const next = { ...runtimeData }
  delete next.managerActionOutcomes
  return next
}

function resetAttractionReportData(
  runtimeData: ProtoRuntimeData,
  salesStatus: SceneLoadStatus,
): ProtoRuntimeData {
  return {
    managerOptions: runtimeData.managerOptions,
    sourceOptions: runtimeData.sourceOptions,
    ...(runtimeData.pricingSettings !== undefined
      ? { pricingSettings: runtimeData.pricingSettings }
      : {}),
    ...(runtimeData.operationalThresholdSettings !== undefined
      ? { operationalThresholdSettings: runtimeData.operationalThresholdSettings }
      : {}),
    ...(runtimeData.conversionEventTypeSettings !== undefined
      ? { conversionEventTypeSettings: runtimeData.conversionEventTypeSettings }
      : {}),
    ...(runtimeData.unitEconomicsSettings !== undefined
      ? { unitEconomicsSettings: runtimeData.unitEconomicsSettings }
      : {}),
    ...(runtimeData.managerWhitelistSettings !== undefined
      ? { managerWhitelistSettings: runtimeData.managerWhitelistSettings }
      : {}),
    ...(runtimeData.salesPlan !== undefined ? { salesPlan: runtimeData.salesPlan } : {}),
    ...(runtimeData.salesPlanMonth !== undefined
      ? { salesPlanMonth: runtimeData.salesPlanMonth }
      : {}),
    ...(runtimeData.salesPlanQuarter !== undefined
      ? { salesPlanQuarter: runtimeData.salesPlanQuarter }
      : {}),
    operationalStatus: salesStatus,
    operationalError: null,
    sceneStatuses: {
      ...initialAttractionSceneStatuses,
      sales: salesStatus,
    },
    sceneErrors: {},
  }
}

const notificationLabels: Record<CommentNotification['status'], string> = {
  queued: 'В очереди',
  sent: 'Отправлено',
  in_work: 'В работе',
  needs_input: 'Нужен ответ',
  done: 'На проверку',
  failed: 'Ошибка',
}

const notificationClasses: Record<CommentNotification['status'], string> = {
  queued: 'badge-neutral',
  sent: 'badge-green',
  in_work: 'badge-green',
  needs_input: 'badge-neutral',
  done: 'badge-green',
  failed: 'badge-neutral',
}

const notificationSyncLabels: Record<CommentNotification['paperclipSyncStatus'], string> = {
  queued: 'Ожидает отправки',
  syncing: 'Синхронизация',
  sent: 'Синхронизировано',
  failed: 'Ошибка отправки',
}

const commentsPanelStatusLabels = {
  loading: 'Комментарии загружаются',
  ready: 'Панель готова',
  saving: 'Сохраняем',
  error: 'Ошибка панели',
} satisfies Record<'loading' | 'ready' | 'saving' | 'error', string>

const commentNotificationReadStorageKey = 'bitrix24-dashboard.comment-notifications.read.v1'

function getCommentNotificationReadKey(notification: CommentNotification) {
  return [
    notification.id,
    notification.updatedAt,
    notification.status,
    notification.paperclipSyncStatus,
    notification.paperclipError ?? '',
    notification.paperclipReadyReport?.createdAt ?? '',
    notification.paperclipThread?.at(-1)?.updatedAt ?? '',
  ].join('|')
}

function readStoredCommentNotificationKeys() {
  if (typeof window === 'undefined') {
    return new Set<string>()
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(commentNotificationReadStorageKey) ?? '[]',
    ) as unknown
    if (!Array.isArray(parsed)) {
      return new Set<string>()
    }

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set<string>()
  }
}

function writeStoredCommentNotificationKeys(keys: Set<string>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      commentNotificationReadStorageKey,
      JSON.stringify(Array.from(keys)),
    )
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
}

function formatUnreadNotificationCount(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'новое' : 'новых'
  return `${count} ${word}`
}

function formatDevelopmentTeamError(value: string) {
  return value.replace(/paperclip/gi, 'команда разработки')
}

function formatReadyReportBody(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, '').trimEnd())
    .join('\n')
    .trim()
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString('ru-RU', { hour12: false })
}

async function loadAttractionOntologySafely() {
  try {
    return await apiClient.getAttractionOntology()
  } catch {
    return null
  }
}

async function loadSyncRunsSafely(): Promise<SyncRunHistoryResponse> {
  try {
    return await apiClient.getSyncRuns({ limit: 5 })
  } catch {
    return { runs: [] }
  }
}

function DevelopmentReadyReport({
  report,
  status,
}: {
  report: PaperclipReadyReport | null | undefined
  status: PaperclipCommentStatus | undefined
}) {
  const reportBody = report?.body.trim() ?? ''

  if (reportBody.length === 0 && status !== 'done') {
    return null
  }

  if (reportBody.length === 0) {
    return (
      <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
          Отчёт команды разработки не найден
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          Задача отмечена как готовая к проверке, но команда не приложила мини-отчёт в треде.
          Можно вернуть на доработку и попросить указать, что сделано, причину, новое поведение
          и проверки.
        </p>
      </section>
    )
  }

  const reportCreatedAt = report?.createdAt ?? ''

  return (
    <section className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
          Отчёт команды разработки
        </div>
        <time className="text-xs font-semibold text-emerald-900/70">
          {formatDateTime(reportCreatedAt)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {formatReadyReportBody(reportBody)}
      </p>
    </section>
  )
}

function getUserDisplayName(user: AuthUser | null | undefined) {
  if (!user) {
    return ''
  }

  const fullName = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  return fullName || user.login
}

function getUserInitials(user: AuthUser | null | undefined) {
  const displayName = getUserDisplayName(user)
  if (!displayName) {
    return 'ЛК'
  }

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'ЛК'
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(14)

  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * alphabet.length)
    }
  }

  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
}

function readProtoRoute(): ProtoRoute {
  if (typeof window === 'undefined') {
    return 'dashboard'
  }

  if (window.location.pathname === '/account') {
    return 'account'
  }

  if (window.location.pathname === '/calls') {
    return 'calls'
  }

  if (window.location.pathname === '/ontology') {
    return 'ontology'
  }

  if (window.location.pathname === '/playbook') {
    return 'playbook'
  }

  return 'dashboard'
}

function writeProtoRoute(route: ProtoRoute) {
  if (typeof window === 'undefined') {
    return
  }

  const nextPath =
    route === 'account'
      ? '/account'
      : route === 'calls'
        ? '/calls'
        : route === 'ontology'
          ? '/ontology'
          : route === 'playbook'
            ? '/playbook'
            : '/'
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath)
  }
}

function findDashboardBlockTarget(blockId: string) {
  if (typeof document === 'undefined') {
    return null
  }

  return (
    document.getElementById(blockId) ??
    Array.from(document.querySelectorAll('[data-comment-block-id]')).find(
      (element) => element.getAttribute('data-comment-block-id') === blockId,
    ) ??
    null
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

function formatSyncMode(value: 'full' | 'delta' | undefined) {
  return value === 'full' ? 'full' : 'delta'
}

function formatDurationMs(value: number | null) {
  if (value === null) {
    return '-'
  }

  const totalSeconds = Math.round(value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) {
    return `${seconds} сек`
  }

  return `${minutes} мин ${seconds} сек`
}

function formatSyncRunStatus(value: SyncRunLogEntry['status']) {
  if (value === 'success') {
    return 'Успех'
  }

  if (value === 'failed') {
    return 'Ошибка'
  }

  return 'В работе'
}

function formatSyncRunDiagnostics(run: SyncRunLogEntry) {
  return run.diagnostics.length > 0
    ? run.diagnostics.join(' · ')
    : formatDealBreakdown({
        deals: run.dealsSynced,
        dealBreakdown: run.dealBreakdown,
      })
}

function resolveDealBreakdown(
  changes: Pick<SyncChangeSummary, 'deals'> & {
    dealBreakdown?: Partial<SyncDealChangeBreakdown>
  },
) {
  const breakdown = changes.dealBreakdown ?? {}
  return {
    total: breakdown.total ?? changes.deals,
    created: breakdown.created ?? 0,
    updated: breakdown.updated ?? changes.deals,
    closed: breakdown.closed ?? 0,
    reopened: breakdown.reopened ?? 0,
    unchanged: breakdown.unchanged ?? 0,
  }
}

function formatDealBreakdown(
  changes: Pick<SyncChangeSummary, 'deals'> & {
    dealBreakdown?: Partial<SyncDealChangeBreakdown>
  },
) {
  const breakdown = resolveDealBreakdown(changes)
  const parts = [
    `новых ${formatCount(breakdown.created)}`,
    `обновлено ${formatCount(breakdown.updated)}`,
    `закрыто ${formatCount(breakdown.closed)}`,
    `переоткрыто ${formatCount(breakdown.reopened)}`,
    `без изменений ${formatCount(breakdown.unchanged)}`,
  ]
  return parts.join(' · ')
}

function resolveSyncHealthWarning(meta: Pick<MetaResponse, 'syncHealth'>) {
  return (
    meta.syncHealth?.warnings[0] ??
    (meta.syncHealth?.blocking
      ? meta.syncHealth.issues[0]?.message ?? 'Локальный snapshot не подтвержден sync coverage.'
      : null)
  )
}

function formatSyncError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'SYNC_ALREADY_RUNNING') {
      return 'Синхронизация уже идет. Дождитесь завершения текущего запуска.'
    }

    if (error.message === 'UNAUTHORIZED') {
      return 'Нет доступа к запуску синхронизации. Проверьте API token.'
    }

    if (error.message.startsWith('SYNC_FAILED: ')) {
      return `Не удалось синхронизировать данные: ${error.message.slice('SYNC_FAILED: '.length)}`
    }
  }

  return 'Не удалось синхронизировать данные'
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function omitSalesPlan(runtimeData: ProtoRuntimeData): ProtoRuntimeData {
  const next = { ...runtimeData }
  delete next.salesPlan
  delete next.salesPlanMonth
  delete next.salesPlanMonthDashboard
  return next
}

function omitSalesPlanQuarter(runtimeData: ProtoRuntimeData): ProtoRuntimeData {
  const next = { ...runtimeData }
  delete next.salesPlanQuarter
  delete next.salesPlanQuarterDashboard
  return next
}

function resolveSalesPlanQuarter(filters: ProtoFilterState) {
  const [yearPart, monthPart] = filters.rangeEnd.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const quarter = Math.floor((month - 1) / 3) + 1

  return {
    year: Number.isInteger(year) ? year : new Date().getFullYear(),
    quarter: quarter >= 1 && quarter <= 4 ? quarter : 1,
  }
}

function parseFilterYearMonth(value: string) {
  const [yearPart, monthPart] = value.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  ) {
    return { year, month }
  }

  const fallback = new Date()
  return { year: fallback.getFullYear(), month: fallback.getMonth() + 1 }
}

function formatDateInputParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function resolveMonthDateRange(filters: ProtoFilterState) {
  const { year, month } = parseFilterYearMonth(filters.rangeEnd)
  const lastDay = new Date(year, month, 0).getDate()

  return {
    rangeStart: formatDateInputParts(year, month, 1),
    rangeEnd: formatDateInputParts(year, month, lastDay),
  }
}

function resolveQuarterDateRange(input: { year: number; quarter: number }) {
  const firstMonth = (input.quarter - 1) * 3 + 1
  const lastMonth = firstMonth + 2
  const lastDay = new Date(input.year, lastMonth, 0).getDate()

  return {
    rangeStart: formatDateInputParts(input.year, firstMonth, 1),
    rangeEnd: formatDateInputParts(input.year, lastMonth, lastDay),
  }
}

function buildDashboardQueryForDateRange(
  filters: ProtoFilterState,
  range: Pick<ProtoFilterState, 'rangeStart' | 'rangeEnd'>,
): CustomDashboardQuery {
  return buildDashboardQueryFromProtoFilters({
    ...filters,
    ...range,
    compareRanges: [],
  }) as CustomDashboardQuery
}

function summarizeSelection(
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

function formatRangeLabel(start: string, end: string) {
  return `${formatShortDate(start)}..${formatShortDate(end)}`
}

function summarizeCompareRanges(ranges: CompareRange[]) {
  if (ranges.length === 0) {
    return 'не задано'
  }

  const firstRange = ranges[0]

  if (ranges.length === 1 && firstRange) {
    return formatRangeLabel(firstRange.start, firstRange.end)
  }

  return `${ranges.length} периода`
}

const attractionManagerOrder = new Map(
  managerOptions.map((option, index) => [option.id, index]),
)
const hiddenActivityKpiLabels = new Set(['Перенесён дедлайн'])

function getVisibleSceneKpis(sceneId: string, kpis: ProtoKpi[]) {
  if (sceneId !== 'activities-calls') {
    return kpis
  }

  return kpis.filter((metric) => !hiddenActivityKpiLabels.has(metric.label))
}

function normalizeManagerPickerOptions(
  entries: Array<{ id: string; name: string }>,
): PickerOption[] {
  return entries
    .filter((entry) => attractionManagerOrder.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      label: entry.name,
      meta: 'Менеджер',
    }))
    .sort((left, right) => {
      const leftOrder = attractionManagerOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = attractionManagerOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER

      return leftOrder - rightOrder
    })
}

function buildStagePickerOptions(
  entries: MetaResponse['stageCatalog'],
  categoryId: string | null | undefined,
): PickerOption[] {
  const seen = new Set<string>()

  return entries
    .filter(
      (entry) =>
        entry.entityType === 'deal' &&
        entry.statusId &&
        (!categoryId || entry.categoryId === categoryId),
    )
    .filter((entry) => {
      if (seen.has(entry.statusId)) {
        return false
      }
      seen.add(entry.statusId)
      return true
    })
    .map((entry) => ({
      id: entry.statusId,
      label: entry.name || entry.statusId,
      meta: 'Этап',
    }))
}

function buildWhitelistedManagerOptions(
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
): PickerOption[] {
  return (managerWhitelistSettings?.settings ?? [])
    .filter((setting) => setting.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((setting) => ({
      id: setting.managerId,
      label: setting.managerName,
      meta: 'Менеджер',
    }))
}

const MANAGER_TEAM_FILTER_PREFIX = 'team:'
const MANAGER_ALL_TEAMS_FILTER_ID = `${MANAGER_TEAM_FILTER_PREFIX}__all__`

type ManagerTeamFilterOption = {
  id: string
  name: string
  managerIds: string[]
  sortOrder: number
}

function shiftDateInputValue(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function createCompareRange(filters: ProtoFilterState): CompareRange {
  const anchorRange = filters.compareRanges.at(-1)
  const start = anchorRange?.start ?? filters.rangeStart
  const end = anchorRange?.end ?? filters.rangeEnd

  return {
    id: crypto.randomUUID(),
    start: shiftDateInputValue(start, -7),
    end: shiftDateInputValue(end, -7),
  }
}

function cloneFilters(filters: ProtoFilterState): ProtoFilterState {
  return {
    ...filters,
    compareRanges: filters.compareRanges.map((range) => ({ ...range })),
    managers: [...filters.managers],
    sources: [...filters.sources],
  }
}

function getUserModule(user: AuthUser | null | undefined, moduleId = 'attraction') {
  return (
    user?.modules.find((item) => item.id === moduleId) ??
    user?.modules.find((item) => item.id === 'attraction' || item.slug === 'attraction') ??
    null
  )
}

function getDefaultManagerIdForModule(
  user: AuthUser | null | undefined,
  moduleId = 'attraction',
) {
  const module = getUserModule(user, moduleId)
  const defaultManagerId = module?.defaultManagerId?.trim()

  return defaultManagerId || null
}

function canSeeAllManagerTeams(
  user: AuthUser | null | undefined,
  moduleId = 'attraction',
) {
  if (!user) {
    return true
  }

  const module = getUserModule(user, moduleId)

  return user?.isSuperAdmin === true || module?.role === 'leader'
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}

type ManagerWhitelistTeamAssignment = {
  id: string
  name: string
  managerIds: string[]
}

function normalizeManagerWhitelistTeamAssignments(
  teams: ManagerWhitelistSettingsInput['teams'] | undefined,
  allowedManagerIds: string[],
): ManagerWhitelistTeamAssignment[] {
  const allowedManagerIdSet = new Set(allowedManagerIds)

  return (teams ?? [])
    .map((team) => {
      const name = team.name.trim()
      const id = team.id?.trim() || name
      const managerIds = team.managerIds
        .filter((managerId) => allowedManagerIdSet.has(managerId))
        .sort((left, right) => left.localeCompare(right))

      return { id, name, managerIds }
    })
    .filter((team) => team.id && team.name && team.managerIds.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id) || left.name.localeCompare(right.name))
}

function normalizeSavedManagerWhitelistTeamAssignments(
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
): ManagerWhitelistTeamAssignment[] {
  return getConfiguredManagerTeams(managerWhitelistSettings)
    .map((team) => ({
      id: team.id,
      name: team.name,
      managerIds: [...team.managerIds].sort((left, right) => left.localeCompare(right)),
    }))
    .filter((team) => team.id && team.name && team.managerIds.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id) || left.name.localeCompare(right.name))
}

function sameManagerWhitelistTeamAssignments(
  left: ManagerWhitelistTeamAssignment[],
  right: ManagerWhitelistTeamAssignment[],
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((leftTeam, index) => {
    const rightTeam = right[index]
    return Boolean(
      rightTeam &&
      leftTeam.id === rightTeam.id &&
      leftTeam.name === rightTeam.name &&
      sameStringSet(leftTeam.managerIds, rightTeam.managerIds),
    )
  })
}

function hasManagerWhitelistSettingsChanged(
  input: ManagerWhitelistSettingsInput,
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
) {
  if (!managerWhitelistSettings) {
    return input.managerIds.length > 0 || (input.teams?.length ?? 0) > 0
  }

  if (!sameStringSet(input.managerIds, getEnabledWhitelistManagerIds(managerWhitelistSettings))) {
    return true
  }

  return !sameManagerWhitelistTeamAssignments(
    normalizeManagerWhitelistTeamAssignments(input.teams, input.managerIds),
    normalizeSavedManagerWhitelistTeamAssignments(managerWhitelistSettings),
  )
}

function getEnabledWhitelistManagerIds(
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
) {
  return (managerWhitelistSettings?.settings ?? [])
    .filter((setting) => setting.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((setting) => setting.managerId)
}

function getConfiguredManagerTeams(
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
): ManagerTeamFilterOption[] {
  const enabledManagerIds = new Set(getEnabledWhitelistManagerIds(managerWhitelistSettings))
  const savedTeams = (managerWhitelistSettings?.teams ?? [])
    .map((team) => ({
      id: team.id,
      name: team.name,
      managerIds: team.managerIds.filter((managerId) => enabledManagerIds.has(managerId)),
      sortOrder: team.sortOrder,
    }))
    .filter((team) => team.id && team.name && team.managerIds.length > 0)

  if (savedTeams.length > 0) {
    return savedTeams.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    )
  }

  const teams = new Map<string, ManagerTeamFilterOption>()
  for (const setting of managerWhitelistSettings?.settings ?? []) {
    if (!setting.enabled || !setting.teamId || !setting.teamName) {
      continue
    }

    const existing = teams.get(setting.teamId)
    if (existing) {
      existing.managerIds.push(setting.managerId)
      existing.sortOrder = Math.min(existing.sortOrder, setting.sortOrder)
      continue
    }

    teams.set(setting.teamId, {
      id: setting.teamId,
      name: setting.teamName,
      managerIds: [setting.managerId],
      sortOrder: setting.sortOrder,
    })
  }

  return Array.from(teams.values()).sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  )
}

function getAllowedManagerIdsForUser(
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
  user: AuthUser | null | undefined,
  moduleId = 'attraction',
) {
  const enabledManagerIds = getEnabledWhitelistManagerIds(managerWhitelistSettings)
  if (canSeeAllManagerTeams(user, moduleId)) {
    return enabledManagerIds
  }

  const defaultManagerId = getDefaultManagerIdForModule(user, moduleId)
  if (!defaultManagerId) {
    return []
  }

  const ownTeam = getConfiguredManagerTeams(managerWhitelistSettings).find((team) =>
    team.managerIds.includes(defaultManagerId),
  )
  if (ownTeam) {
    return ownTeam.managerIds
  }

  return enabledManagerIds.includes(defaultManagerId) ? [defaultManagerId] : []
}

function buildManagerScopePickerOptions(input: {
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings']
  fallbackOptions: PickerOption[]
  user: AuthUser | null | undefined
  moduleId: string
  moduleSlug: string
}) {
  if (input.moduleSlug !== 'attraction') {
    return input.fallbackOptions
  }

  const canSeeAllTeams = canSeeAllManagerTeams(input.user, input.moduleId)
  if (!input.managerWhitelistSettings) {
    if (canSeeAllTeams) {
      return input.fallbackOptions
    }

    const defaultManagerId = getDefaultManagerIdForModule(input.user, input.moduleId)
    return defaultManagerId
      ? input.fallbackOptions.filter((option) => option.id === defaultManagerId)
      : []
  }

  const allowedManagerIds = new Set(
    getAllowedManagerIdsForUser(
      input.managerWhitelistSettings,
      input.user,
      input.moduleId,
    ),
  )
  const managerOptions = buildWhitelistedManagerOptions(input.managerWhitelistSettings).filter(
    (option) => allowedManagerIds.has(option.id),
  )
  const teamOptions = getConfiguredManagerTeams(input.managerWhitelistSettings)
    .filter((team) => team.managerIds.some((managerId) => allowedManagerIds.has(managerId)))
    .map((team) => ({
      id: `${MANAGER_TEAM_FILTER_PREFIX}${team.id}`,
      label: team.name,
      meta: 'Команда',
    }))

  return [
    ...(canSeeAllTeams && teamOptions.length > 0
      ? [{ id: MANAGER_ALL_TEAMS_FILTER_ID, label: 'Все команды', meta: 'Команды' }]
      : []),
    ...teamOptions,
    ...managerOptions,
  ]
}

function resolveManagerScopeOptionManagerIds(
  optionId: string,
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
) {
  if (optionId === MANAGER_ALL_TEAMS_FILTER_ID) {
    return []
  }

  if (!optionId.startsWith(MANAGER_TEAM_FILTER_PREFIX)) {
    return null
  }

  const teamId = optionId.slice(MANAGER_TEAM_FILTER_PREFIX.length)
  const team = getConfiguredManagerTeams(managerWhitelistSettings).find(
    (item) => item.id === teamId,
  )

  return team?.managerIds ?? null
}

function isManagerScopeOptionSelected(
  optionId: string,
  selectedManagerIds: string[],
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings'],
) {
  const teamManagerIds = resolveManagerScopeOptionManagerIds(optionId, managerWhitelistSettings)

  if (teamManagerIds !== null) {
    return sameStringSet(selectedManagerIds, teamManagerIds)
  }

  return selectedManagerIds.includes(optionId)
}

function summarizeManagerScopeSelection(input: {
  selectedManagerIds: string[]
  managerWhitelistSettings: ProtoRuntimeData['managerWhitelistSettings']
  options: PickerOption[]
  fallback: string
}) {
  if (input.selectedManagerIds.length === 0) {
    return input.fallback
  }

  const selectedTeam = getConfiguredManagerTeams(input.managerWhitelistSettings).find((team) =>
    sameStringSet(input.selectedManagerIds, team.managerIds),
  )
  if (selectedTeam) {
    return selectedTeam.name
  }

  return summarizeSelection(
    input.selectedManagerIds,
    input.options.filter((option) => !option.id.startsWith(MANAGER_TEAM_FILTER_PREFIX)),
    input.fallback,
  )
}

function createDefaultFiltersForUser(
  user: AuthUser | null | undefined,
  moduleId = 'attraction',
) {
  const filters = createDefaultFilters()
  const defaultManagerId = getDefaultManagerIdForModule(user, moduleId)

  return defaultManagerId ? { ...filters, managers: [defaultManagerId] } : filters
}

function shouldIgnoreCommentTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }

  return Boolean(
    target.closest(
      'button, input, textarea, select, label, [role="dialog"], [data-slot="command"], [data-slot="command-item"], [data-slot="popover-content"], [data-no-comment="true"]',
    ),
  )
}

const namedCommentBlockSelector = [
  '[data-comment-block-id]',
  '[data-comment-block-label]',
  '.panel',
  'section',
  'article',
  '[role="region"]',
  '[aria-label]',
].join(',')

const tableCommentBlockSelector = 'table'

function cleanCommentLabel(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim()
  return (normalized || fallback).slice(0, 180)
}

function nthOfType(element: Element) {
  const tagName = element.tagName.toLowerCase()
  let index = 1
  let sibling = element.previousElementSibling

  while (sibling) {
    if (sibling.tagName.toLowerCase() === tagName) {
      index += 1
    }
    sibling = sibling.previousElementSibling
  }

  return `${tagName}:nth-of-type(${index})`
}

function selectorSegment(element: Element) {
  const blockId = element.getAttribute('data-comment-block-id')
  if (blockId) {
    return `[data-comment-block-id="${blockId.replace(/"/g, '\\"')}"]`
  }

  if (element.id) {
    return `#${element.id.replace(/"/g, '\\"')}`
  }

  return nthOfType(element)
}

function buildElementSelector(element: Element, root: Element) {
  const segments: string[] = []
  let current: Element | null = element

  while (current && current !== root) {
    segments.unshift(selectorSegment(current))
    current = current.parentElement
  }

  return segments.join(' > ') || selectorSegment(root)
}

function resolveElementLabel(element: Element) {
  const heading = element.querySelector('h1,h2,h3,[role="heading"]')
  const caption = element.querySelector('caption')
  return cleanCommentLabel(
    element.getAttribute('data-comment-block-label') ??
      element.getAttribute('aria-label') ??
      heading?.textContent ??
      caption?.textContent ??
      element.textContent,
    element.tagName.toLowerCase(),
  )
}

function closestHtmlElement(element: Element, selector: string) {
  const closest = element.closest(selector)
  return closest instanceof HTMLElement ? closest : null
}

function resolveCommentBlockElement(targetElement: Element, shell: HTMLElement) {
  return (
    closestHtmlElement(targetElement, namedCommentBlockSelector) ??
    closestHtmlElement(targetElement, tableCommentBlockSelector) ??
    shell
  )
}

function resolveCommentAnchor(
  target: EventTarget | null,
  shell: HTMLElement,
  clientX: number,
  clientY: number,
): ProtoCommentAnchor {
  const targetElement = target instanceof Element ? target : shell
  const blockElement = resolveCommentBlockElement(targetElement, shell)
  const rect = blockElement.getBoundingClientRect()
  const relativeX =
    rect.width === 0 ? 0 : Number(((clientX - rect.left) / rect.width).toFixed(4))
  const relativeY =
    rect.height === 0 ? 0 : Number(((clientY - rect.top) / rect.height).toFixed(4))
  const blockSelector = buildElementSelector(blockElement, shell)

  return {
    blockId: blockElement.getAttribute('data-comment-block-id') ?? blockSelector,
    blockLabel: resolveElementLabel(blockElement),
    blockSelector,
    blockRole: blockElement.getAttribute('role') ?? blockElement.tagName.toLowerCase(),
    elementSelector: buildElementSelector(targetElement, shell),
    elementLabel: resolveElementLabel(targetElement),
    relativeX: Math.min(1, Math.max(0, relativeX)),
    relativeY: Math.min(1, Math.max(0, relativeY)),
  }
}

function MultiSelectField({
  label,
  placeholder,
  emptyLabel,
  options,
  selected,
  onToggle,
  summary,
  isOptionSelected,
}: {
  label: string
  placeholder: string
  emptyLabel: string
  options: PickerOption[]
  selected: string[]
  onToggle: (value: string) => void
  summary?: string
  isOptionSelected?: (option: PickerOption) => boolean
}) {
  const [open, setOpen] = useState(false)
  const fieldSummary = summary ?? summarizeSelection(selected, options, emptyLabel)

  return (
    <div className="space-y-1.5">
      <label className="subtle-label">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="field flex items-center justify-between text-left" aria-label={label}>
            <span className="truncate">{fieldSummary}</span>
            <span className="text-slate-400">{open ? '−' : '+'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="proto-select-popover w-[var(--radix-popover-trigger-width)] rounded-xl p-2"
        >
          <Command className="proto-select-command">
            <CommandInput placeholder={placeholder} />
            <CommandList className="proto-select-list">
              <CommandEmpty>Ничего не найдено</CommandEmpty>
              <CommandGroup heading={label}>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.label} ${option.meta}`}
                    data-checked={isOptionSelected ? isOptionSelected(option) : selected.includes(option.id)}
                    className="cursor-pointer"
                    onSelect={() => onToggle(option.id)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <strong className="truncate text-sm">{option.label}</strong>
                      <span className="truncate text-xs text-slate-500">{option.meta}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

type PaperclipNotificationsProps = {
  notifications: CommentNotification[]
  summary: Array<[CommentNotification['status'], number]>
  unreadCount: number
  unreadKeys: ReadonlySet<string>
  onRead: () => void
}

function PaperclipNotifications({
  notifications,
  summary,
  unreadCount,
  unreadKeys,
  onRead,
}: PaperclipNotificationsProps) {
  const [open, setOpen] = useState(false)
  const totalCount = notifications.length
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const buttonLabel =
    unreadCount > 0
      ? `Уведомления команды разработки: ${formatUnreadNotificationCount(unreadCount)}, ${totalCount} активных задач`
      : totalCount === 0
      ? 'Уведомления команды разработки: нет активных задач'
      : `Уведомления команды разработки: нет новых, ${totalCount} активных задач`

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      onRead()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="btn btn-ghost relative h-12 w-12 rounded-2xl p-0 text-slate-800"
          aria-label={buttonLabel}
        >
          <HugeiconsIcon
            icon={Notification03Icon}
            size={28}
            strokeWidth={2.2}
            aria-hidden="true"
          />
          {unreadCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 grid min-h-6 min-w-6 place-items-center rounded-full bg-slate-900 px-1.5 text-[0.7rem] font-bold leading-none text-white ring-2 ring-white"
              aria-hidden="true"
            >
              {unreadLabel}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="subtle-label">Команда разработки</div>
            <h2 className="mt-1 text-base font-bold text-slate-900">Уведомления</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {unreadCount > 0 ? (
              <span className="badge-chip badge-green">новые · {unreadCount}</span>
            ) : null}
            <span className="badge-chip badge-neutral">{totalCount}</span>
          </div>
        </div>

        {summary.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summary.map(([notificationStatus, count]) => (
              <span
                key={notificationStatus}
                className={cn('badge-chip', notificationClasses[notificationStatus])}
              >
                {notificationLabels[notificationStatus]} · {count}
              </span>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-600">
            Нет активных задач команды разработки.
          </div>
        )}

        {notifications.length > 0 ? (
          <div className="grid max-h-[24rem] gap-2 overflow-auto pr-1">
            {notifications.map((notification) => {
              const unread = unreadKeys.has(getCommentNotificationReadKey(notification))

              return (
                <article
                  key={notification.id}
                  className={cn(
                    'rounded-xl border px-3 py-3',
                    unread
                      ? 'border-slate-300 bg-slate-50'
                      : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <span className={cn('badge-chip', notificationClasses[notification.status])}>
                        {notificationLabels[notification.status]}
                      </span>
                      {unread ? <span className="badge-chip badge-green">Новое</span> : null}
                    </div>
                    <time className="text-xs font-semibold text-slate-500">
                      {formatDateTime(notification.updatedAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {notification.text}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{notificationSyncLabels[notification.paperclipSyncStatus]}</span>
                    {notification.paperclipIssueIdentifier ? (
                      <span>{notification.paperclipIssueIdentifier}</span>
                    ) : null}
                  </div>
                  {notification.paperclipError ? (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                      {formatDevelopmentTeamError(notification.paperclipError)}
                    </p>
                  ) : null}
                  <DevelopmentReadyReport
                    report={notification.paperclipReadyReport}
                    status={notification.status}
                  />
                </article>
              )
            })}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

type LeadgenReportId = 'sales' | 'activity'

const leadgenReportTabs: Array<{ id: LeadgenReportId; label: string }> = [
  { id: 'sales', label: 'Отчет по продажам' },
  { id: 'activity', label: 'Отчет активности' },
]

function LeadgenDashboard({
  report,
  workload,
  reportStatus,
  reportError,
  workloadStatus,
  workloadError,
  filters,
  commentMode,
  activeReportId,
  onActiveReportChange,
}: {
  report: LeadgenFunnelReport | null
  workload: LeadgenWorkloadData | null
  reportStatus: LeadgenLoadStatus
  reportError: string | null
  workloadStatus: LeadgenLoadStatus
  workloadError: string | null
  filters: ProtoFilterState
  commentMode: boolean
  activeReportId: LeadgenReportId
  onActiveReportChange: (reportId: LeadgenReportId) => void
}) {
  const topStages = report?.stageRows ?? []
  const topReasons = report?.reasonRows ?? []
  const isSalesReport = activeReportId === 'sales'
  const emptyValue = reportStatus === 'loading' ? '...' : '0'
  const activeError = isSalesReport ? reportError : (workloadError ?? reportError)
  const salesMetrics = [
    {
      label: 'Всего сделок',
      value: report ? formatCount(report.totalDeals) : emptyValue,
      hint: 'в Лидген УС',
    },
    {
      label: 'Создано',
      value: report ? formatCount(report.createdDeals) : emptyValue,
      hint: 'за период',
    },
    {
      label: 'Активные',
      value: report ? formatCount(report.activeDeals) : emptyValue,
      hint: 'в работе',
    },
    {
      label: 'Закрытые',
      value: report ? formatCount(report.closedDeals) : emptyValue,
      hint: 'закрытые сделки',
    },
  ]
  const activityMetrics = workload
    ? getVisibleSceneKpis('activities-calls', workload.scene.kpis).map((metric) => ({
        label: metric.label,
        value: metric.value,
        hint: metric.note,
        compare: metric.compare,
        delta: metric.delta,
        deltaTone: metric.deltaTone,
      }))
    : []
  const leadgenActivityRuntimeData: ProtoRuntimeData = {
    managerOptions:
      report?.managerRows.map((row) => ({
        id: row.managerId,
        label: row.managerName,
        meta: 'Менеджер',
      })) ?? [],
    sourceOptions:
      report?.sourceRows.map((row) => ({
        id: row.sourceKey,
        label: row.sourceLabel,
        meta: 'Источник',
      })) ?? [],
    ...(workload ? { activitiesCalls: workload.scene } : {}),
    activitySummaryCommentBlockId: 'leadgen-workload-managers',
    activitySummaryCommentBlockLabel: 'Лидогенерация: Отчет звонков',
    operationalStatus: workload ? 'ready' : workloadStatus === 'loading' ? 'loading' : 'error',
    operationalError: workloadError,
  }
  const activeMetrics = isSalesReport ? salesMetrics : activityMetrics
  const workloadWarnings = workload?.scene.warnings ?? []

  return (
    <div className="grid gap-6">
      <section
        className="panel sticky top-3 z-20 flex flex-wrap gap-2 p-3"
        data-no-comment="true"
        aria-label="Отчеты лидогенерации"
      >
        {leadgenReportTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn('tab-chip', activeReportId === tab.id && 'tab-chip-active')}
            aria-pressed={activeReportId === tab.id}
            onClick={() => onActiveReportChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {activeError}
        </div>
      ) : null}

      <section
        className="grid gap-4 md:grid-cols-4"
        data-comment-block-id={
          isSalesReport ? 'leadgen-sales-kpi' : 'leadgen-workload-kpi'
        }
        data-comment-block-label={
          isSalesReport
            ? 'Лидогенерация: KPI отчета продаж'
            : 'Лидогенерация: KPI звонков и дел'
        }
      >
        {activeMetrics.map((metric) => (
          <div key={metric.label} className="metric p-4">
            <p className="subtle-label">{metric.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-sm text-slate-500">{metric.hint}</p>
          </div>
        ))}
      </section>

      {report?.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {report.warnings.join(' ')}
        </div>
      ) : null}

      {!isSalesReport && workloadWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {workloadWarnings.join(' ')}
        </div>
      ) : null}

      {!isSalesReport ? (
        <>
          <section className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Отчет звонков</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Сводка звонков и дел по менеджерам Лидген УС по активным фильтрам.
                </p>
              </div>
              <span className="badge-chip badge-neutral">
                {workload ? `${formatCount(workload.scene.managerCount)} менеджеров` : 'загрузка'}
              </span>
            </div>
          </section>

          {workload ? (
            <Suspense fallback={<SceneLoadingFallback label="Загружаю отчет звонков" />}>
              <LazyActivitiesScene
                commentMode={commentMode}
                filters={filters}
                runtimeData={leadgenActivityRuntimeData}
              />
            </Suspense>
          ) : (
            <section className="panel p-5">
              <h2 className="text-xl font-bold text-slate-900">Отчет звонков</h2>
              <p className="mt-1 text-sm text-slate-500">
                {workloadStatus === 'loading'
                  ? 'Загружаю live-данные отчета звонков.'
                  : workloadStatus === 'error'
                    ? 'Не удалось загрузить отчет звонков.'
                  : 'Нет звонков и дел в выбранном периоде.'}
              </p>
            </section>
          )}
        </>
      ) : (
      <section className="grid gap-6">
          <div
            className="panel p-5"
            data-comment-block-id="leadgen-stage-distribution"
            data-comment-block-label="Лидогенерация: стадии"
          >
          <div className="subtle-label">Распределение по стадиям</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Стадия</th>
                  <th className="py-2 pr-4">Создано</th>
                  <th className="py-2 pr-4">Активные</th>
                  <th className="py-2 pr-4">Закрытые</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topStages.map((row) => (
                  <tr key={row.stageId}>
                    <td className="py-2 pr-4 font-semibold text-slate-900">
                      {row.stageName}
                    </td>
                    <td className="py-2 pr-4">{formatCount(row.createdDeals)}</td>
                    <td className="py-2 pr-4">{formatCount(row.activeDeals)}</td>
                    <td className="py-2 pr-4">{formatCount(row.closedDeals)}</td>
                  </tr>
                ))}
                {topStages.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={4}>
                      Нет сделок в выбранном периоде.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </div>

          <div
            className="panel p-5"
            data-comment-block-id="leadgen-reasons"
            data-comment-block-label="Лидогенерация: причины возврата и корзины"
          >
          <div className="subtle-label">Причины возврата / корзины</div>
          <div className="mt-3 grid gap-2">
            {topReasons.map((row) => (
              <div
                key={row.reasonKey}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className="font-semibold text-slate-900">{row.reasonLabel}</span>
                <span className="badge-chip badge-neutral">{formatCount(row.dealCount)}</span>
              </div>
            ))}
            {topReasons.length === 0 ? (
              <p className="text-sm text-slate-500">Нет данных за период.</p>
            ) : null}
          </div>
          </div>
      </section>
      )}
    </div>
  )
}

export function ProtoApp({ currentUser }: ProtoAppProps = {}) {
  const initialModuleId = currentUser?.modules[0]?.id ?? 'attraction'
  const [route, setRoute] = useState<ProtoRoute>(() => readProtoRoute())
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]?.id ?? 'sales')
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null)
  const [commentMode, setCommentMode] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [accountUser, setAccountUser] = useState<AuthUser | null>(currentUser ?? null)
  const [activeModuleId, setActiveModuleId] = useState(initialModuleId)
  const [accountStatus, setAccountStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [activeAccountTab, setActiveAccountTab] = useState<AccountTab>('settings')
  const [profileDraft, setProfileDraft] = useState({
    firstName: currentUser?.firstName ?? '',
    lastName: currentUser?.lastName ?? '',
  })
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [filters, setFilters] = useState<ProtoFilterState>(() =>
    createDefaultFiltersForUser(currentUser, initialModuleId),
  )
  const [appliedFilters, setAppliedFilters] = useState<ProtoFilterState>(() =>
    createDefaultFiltersForUser(currentUser, initialModuleId),
  )
  const [salesPlanQuarter, setSalesPlanQuarter] = useState(() =>
    resolveSalesPlanQuarter(createDefaultFiltersForUser(currentUser, initialModuleId)),
  )
  const [lastFiltersApply, setLastFiltersApply] = useState(
    new Date('2026-04-10T11:42:00.000Z').toISOString(),
  )
  const [runtimeData, setRuntimeData] = useState<ProtoRuntimeData>({
    managerOptions,
    sourceOptions,
    operationalStatus: 'idle',
    operationalError: null,
  })
  const isMountedRef = useRef(true)
  const runtimeDataRef = useRef(runtimeData)
  const [leadgenActiveReportId, setLeadgenActiveReportId] =
    useState<LeadgenReportId>('sales')
  const [leadgenReport, setLeadgenReport] = useState<LeadgenFunnelReport | null>(null)
  const [leadgenWorkload, setLeadgenWorkload] = useState<LeadgenWorkloadData | null>(null)
  const [leadgenReportStatus, setLeadgenReportStatus] =
    useState<LeadgenLoadStatus>('idle')
  const [leadgenReportError, setLeadgenReportError] = useState<string | null>(null)
  const [leadgenWorkloadStatus, setLeadgenWorkloadStatus] =
    useState<LeadgenLoadStatus>('idle')
  const [leadgenWorkloadError, setLeadgenWorkloadError] = useState<string | null>(null)
  const [leadgenWorkloadFilterKey, setLeadgenWorkloadFilterKey] = useState<string | null>(
    null,
  )
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing'>('idle')
  const [syncProgress, setSyncProgress] = useState<SyncProgressEvent | null>(null)
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
  const [salesPlanLoading, setSalesPlanLoading] = useState(false)
  const [salesPlanSaving, setSalesPlanSaving] = useState(false)
  const [salesPlanSaveError, setSalesPlanSaveError] = useState<string | null>(null)
  const [pricingSettingsLoading, setPricingSettingsLoading] = useState(false)
  const [pricingSettingsSaving, setPricingSettingsSaving] = useState(false)
  const [pricingSettingsSaveError, setPricingSettingsSaveError] = useState<string | null>(null)
  const [operationalThresholdSettingsLoading, setOperationalThresholdSettingsLoading] =
    useState(false)
  const [operationalThresholdSettingsSaving, setOperationalThresholdSettingsSaving] =
    useState(false)
  const [operationalThresholdSettingsSaveError, setOperationalThresholdSettingsSaveError] =
    useState<string | null>(null)
  const [conversionEventTypeSettingsLoading, setConversionEventTypeSettingsLoading] = useState(false)
  const [conversionEventTypeSettingsSaving, setConversionEventTypeSettingsSaving] = useState(false)
  const [conversionEventTypeSettingsSaveError, setConversionEventTypeSettingsSaveError] = useState<string | null>(null)
  const [unitEconomicsSettingsLoading, setUnitEconomicsSettingsLoading] = useState(false)
  const [unitEconomicsSettingsSaving, setUnitEconomicsSettingsSaving] = useState(false)
  const [unitEconomicsSettingsSaveError, setUnitEconomicsSettingsSaveError] = useState<string | null>(null)
  const [managerWhitelistSettingsLoading, setManagerWhitelistSettingsLoading] = useState(false)
  const [managerWhitelistSettingsSaving, setManagerWhitelistSettingsSaving] = useState(false)
  const [managerWhitelistSettingsSaveError, setManagerWhitelistSettingsSaveError] = useState<string | null>(null)
  const [managerWhitelistSettingsNotice, setManagerWhitelistSettingsNotice] = useState<string | null>(null)
  const [managerWhitelistDraft, setManagerWhitelistDraft] =
    useState<ManagerWhitelistDraftState>(createEmptyManagerWhitelistDraftState)
  const [commentNotifications, setCommentNotifications] = useState<CommentNotification[]>([])
  const [readCommentNotificationKeys, setReadCommentNotificationKeys] = useState<Set<string>>(
    () => readStoredCommentNotificationKeys(),
  )
  const [moduleUsers, setModuleUsers] = useState<ModuleUser[]>([])
  const [moduleUsersStatus, setModuleUsersStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [moduleUsersError, setModuleUsersError] = useState<string | null>(null)
  const [platformAccess, setPlatformAccess] = useState<PlatformAccess | null>(null)
  const [platformAccessStatus, setPlatformAccessStatus] = useState<
    'idle' | 'loading' | 'saving' | 'error'
  >('idle')
  const [platformAccessError, setPlatformAccessError] = useState<string | null>(null)
  const [newModuleUser, setNewModuleUser] = useState({
    firstName: '',
    lastName: '',
    login: '',
    password: '',
    role: 'employee' as ModuleRole,
    defaultManagerId: '',
  })
  const [createdCredentials, setCreatedCredentials] = useState<string | null>(null)
  const [snapshotStats, setSnapshotStats] = useState<SnapshotStats | null>(null)
  const [lastSync, setLastSync] = useState<LastSyncSummary | null>(null)
  const [syncRuns, setSyncRuns] = useState<SyncRunLogEntry[]>([])
  const [syncJournalOpen, setSyncJournalOpen] = useState(false)
  const [syncJournalStatus, setSyncJournalStatus] = useState<'idle' | 'loading' | 'ready'>(
    'idle',
  )
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [draftComment, setDraftComment] = useState<{
    id: string | null
    x: number
    y: number
    text: string
    anchor: ProtoCommentAnchor
    paperclipStatus?: ProtoComment['paperclipStatus']
    paperclipReadyReport?: ProtoComment['paperclipReadyReport']
  } | null>(null)
  const [reworkText, setReworkText] = useState('')
  const [commentSavePending, setCommentSavePending] = useState(false)
  const [commentReworkPending, setCommentReworkPending] = useState(false)

  const shellRef = useRef<HTMLDivElement>(null)
  const commentPanelRef = useRef<HTMLElement>(null)
  const rangeStartInputRef = useRef<HTMLInputElement>(null)
  const rangeEndInputRef = useRef<HTMLInputElement>(null)
  const runtimeRequestRef = useRef(0)
  const syncJournalRequestRef = useRef(0)
  const managerWhitelistSettingsRevisionRef = useRef(0)
  const commentSaveInFlightRef = useRef(false)
  const commentReworkInFlightRef = useRef(false)
  const {
    comments,
    updatedAt,
    status,
    error,
    upsertComment,
    archiveComment,
    retryComment,
    reworkComment,
  } = useProtoComments(activeModuleId)

  useEffect(() => {
    if (!commentsOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (commentPanelRef.current?.contains(target)) {
        return
      }
      const targetElement = target instanceof Element ? target : target.parentElement
      if (targetElement?.closest('[data-comments-panel-trigger="true"]')) {
        return
      }

      setDraftComment(null)
      setReworkText('')
      setCommentsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [commentsOpen])

  useEffect(() => {
    function handlePopState() {
      setRoute(readProtoRoute())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    setAccountUser(currentUser ?? null)
    setProfileDraft({
      firstName: currentUser?.firstName ?? '',
      lastName: currentUser?.lastName ?? '',
    })
  }, [currentUser])

  useEffect(() => {
    runtimeDataRef.current = runtimeData
  }, [runtimeData])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const availableModules = useMemo(() => accountUser?.modules ?? [], [accountUser])
  const activeModule = useMemo(
    () =>
      availableModules.find((module) => module.id === activeModuleId) ??
      availableModules.find((module) => module.id === 'attraction') ??
      availableModules[0] ??
      null,
    [activeModuleId, availableModules],
  )
  const activeModuleSlug = activeModule?.slug ?? activeModule?.id ?? activeModuleId
  const isLeadgenModule = activeModuleSlug === 'leadgen'
  const leadgenWorkloadRequestKey = useMemo(
    () =>
      JSON.stringify({
        moduleId: activeModuleId,
        query: buildDashboardQueryFromProtoFilters(appliedFilters),
      }),
    [activeModuleId, appliedFilters],
  )
  const activeCommentSceneId = isLeadgenModule ? 'leadgen-funnel' : activeSceneId
  useEffect(() => {
    if (availableModules.length === 0) {
      return
    }

    if (!availableModules.some((module) => module.id === activeModuleId)) {
      setActiveModuleId(
        availableModules.find((module) => module.id === 'attraction')?.id ??
          availableModules[0]!.id,
      )
    }
  }, [activeModuleId, availableModules])

  useEffect(() => {
    setManagerWhitelistDraft(createEmptyManagerWhitelistDraftState())
  }, [activeModuleId])

  const canArchiveComments =
    activeModule?.permissions.includes('comments:archive') === true
  const canManageModuleUsers =
    activeModule?.permissions.includes('module-users:manage') === true
  const canManageModuleSettings = canManageModuleUsers || accountUser?.isSuperAdmin === true
  const canSeeAccountUsersTab =
    canManageModuleSettings || accountUser?.isSuperAdmin === true
  const platformModules = platformAccess?.modules ?? []
  const platformUsers = platformAccess?.users ?? []

  useEffect(() => {
    if (activeAccountTab === 'users' && !canSeeAccountUsersTab) {
      setActiveAccountTab('settings')
    }
  }, [activeAccountTab, canSeeAccountUsersTab])

  const switchModule = useCallback((moduleId: string) => {
    setActiveModuleId(moduleId)
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
    setSyncSummary(null)
    setSyncProgress(null)
    setSyncError(null)
    setSnapshotStats(null)
    setLastSync(null)
    setSyncRuns([])
    setSyncWarning(null)
  }, [])

  const ModuleSwitcher = useMemo(
    () =>
      availableModules.length > 1 ? (
        <div className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm">
          {availableModules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={cn(
                'tab-chip',
                module.id === activeModule?.id && 'tab-chip-active',
              )}
              aria-pressed={module.id === activeModule?.id}
              onClick={() => switchModule(module.id)}
            >
              {module.name}
            </button>
          ))}
        </div>
      ) : null,
    [activeModule?.id, availableModules, switchModule],
  )

  const activeScene = useMemo(
    () => scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0]!,
    [activeSceneId],
  )
  const activeAttractionSceneLoadKey =
    route === 'ontology' ? 'ontology' : getAttractionSceneLoadKey(activeScene.id)
  const shouldLoadAttractionSceneData =
    route === 'ontology' || (!isLeadgenModule && route === 'dashboard')
  const activeAttractionSceneStatus = getRuntimeSceneStatus(
    runtimeData,
    activeAttractionSceneLoadKey,
  )
  const activeAttractionSceneError = getRuntimeSceneError(
    runtimeData,
    activeAttractionSceneLoadKey,
  )
  const activeRuntimeData = useMemo(
    () => ({
      ...runtimeData,
      operationalStatus: activeAttractionSceneStatus,
      operationalError: activeAttractionSceneError,
    }),
    [activeAttractionSceneError, activeAttractionSceneStatus, runtimeData],
  )
  const activeSceneKpis = useMemo(() => {
    if (activeRuntimeData.operationalStatus !== 'ready' && activeScene.id !== 'sales') {
      return []
    }

    if (activeScene.id === 'activities-calls' && activeRuntimeData.activitiesCalls) {
      return activeRuntimeData.activitiesCalls.kpis
    }

    if (activeScene.id === 'cohorts' && activeRuntimeData.cohorts) {
      return activeRuntimeData.cohorts.kpis
    }

    if (activeScene.id === 'funnel-flow' && activeRuntimeData.tocFlow) {
      return activeRuntimeData.tocFlow.kpis
    }

    return activeScene.kpis
  }, [
    activeScene,
    activeRuntimeData.activitiesCalls,
    activeRuntimeData.cohorts,
    activeRuntimeData.operationalStatus,
    activeRuntimeData.tocFlow,
  ])
  const visibleSceneKpis = useMemo(
    () => getVisibleSceneKpis(activeScene.id, activeSceneKpis),
    [activeScene.id, activeSceneKpis],
  )
  const sceneComments = useMemo(
    () =>
      comments.filter(
        (comment) =>
          comment.sceneId === activeCommentSceneId &&
          (comment.status ?? 'open') === 'open',
      ),
    [activeCommentSceneId, comments],
  )
  const activeDraftStoredComment = useMemo(
    () =>
      draftComment?.id
        ? comments.find((comment) => comment.id === draftComment.id) ?? null
        : null,
    [comments, draftComment?.id],
  )
  const notificationSummary = useMemo(() => {
    const counts = new Map<CommentNotification['status'], number>()
    for (const notification of commentNotifications) {
      counts.set(notification.status, (counts.get(notification.status) ?? 0) + 1)
    }

    return Array.from(counts.entries())
  }, [commentNotifications])
  const unreadCommentNotificationKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const notification of commentNotifications) {
      const key = getCommentNotificationReadKey(notification)
      if (!readCommentNotificationKeys.has(key)) {
        keys.add(key)
      }
    }

    return keys
  }, [commentNotifications, readCommentNotificationKeys])
  const ActiveSceneComponent = getLazySceneComponent(activeScene.id)
  const availableManagerOptions =
    runtimeData.managerOptions.length > 0 ? runtimeData.managerOptions : managerOptions
  const availableSourceOptions =
    runtimeData.sourceOptions.length > 0 ? runtimeData.sourceOptions : sourceOptions
  const whitelistedManagerOptions = buildWhitelistedManagerOptions(
    runtimeData.managerWhitelistSettings,
  )
  const hasManagerWhitelistSettings = runtimeData.managerWhitelistSettings !== undefined
  const defaultManagerOptions = hasManagerWhitelistSettings
    ? whitelistedManagerOptions
    : availableManagerOptions
  const managerScopeOptions = useMemo(
    () =>
      buildManagerScopePickerOptions({
        managerWhitelistSettings: runtimeData.managerWhitelistSettings,
        fallbackOptions: availableManagerOptions,
        user: accountUser,
        moduleId: activeModuleId,
        moduleSlug: activeModuleSlug,
      }),
    [
      accountUser,
      activeModuleId,
      activeModuleSlug,
      availableManagerOptions,
      runtimeData.managerWhitelistSettings,
    ],
  )
  const visibleManagerOptions = useMemo(
    () =>
      managerScopeOptions.filter(
        (option) => !option.id.startsWith(MANAGER_TEAM_FILTER_PREFIX),
      ),
    [managerScopeOptions],
  )
  const managerFilterEmptyLabel =
    activeModuleSlug === 'attraction' && hasManagerWhitelistSettings
      ? canSeeAllManagerTeams(accountUser, activeModuleId)
        ? 'Все команды'
        : 'Вся команда'
      : 'Все менеджеры'
  const managerFilterSummary = summarizeManagerScopeSelection({
    selectedManagerIds: filters.managers,
    managerWhitelistSettings: runtimeData.managerWhitelistSettings,
    options: managerScopeOptions,
    fallback: managerFilterEmptyLabel,
  })
  const visibleLeadgenWorkload =
    leadgenWorkloadFilterKey === leadgenWorkloadRequestKey ? leadgenWorkload : null
  const isReportLoading = isLeadgenModule
    ? leadgenReportStatus === 'loading'
    : runtimeData.operationalStatus === 'loading' ||
      activeRuntimeData.operationalStatus === 'loading'
  const salesSceneStatus = getRuntimeSceneStatus(runtimeData, 'sales')

  function navigateToAccount() {
    writeProtoRoute('account')
    setRoute('account')
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
  }

  function navigateToDashboard() {
    writeProtoRoute('dashboard')
    setRoute('dashboard')
  }

  function navigateToCalls() {
    writeProtoRoute('calls')
    setRoute('calls')
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
  }

  function navigateToOntology() {
    writeProtoRoute('ontology')
    setRoute('ontology')
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
  }

  function navigateToPlaybook() {
    writeProtoRoute('playbook')
    setRoute('playbook')
    setCommentsOpen(false)
    setCommentMode(false)
    setDraftComment(null)
  }

  const handleSceneNavigate = useCallback((sceneId: string, blockId?: string) => {
    const targetScene = scenes.find((scene) => scene.id === sceneId)
    if (!targetScene) {
      return
    }

    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', blockId ? `/#${blockId}` : '/')
    } else {
      writeProtoRoute('dashboard')
    }
    setRoute('dashboard')
    setActiveSceneId(targetScene.id)
    setPendingScrollTarget(blockId ?? null)
  }, [])

  useEffect(() => {
    if (!pendingScrollTarget) {
      return
    }

    const target = findDashboardBlockTarget(pendingScrollTarget)
    if (!target) {
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPendingScrollTarget(null)
  }, [activeSceneId, activeRuntimeData.operationalStatus, pendingScrollTarget])

  const refreshCommentNotifications = useCallback(async () => {
    try {
      const response = await apiClient.getCommentNotifications(activeModuleId)
      setCommentNotifications(response.notifications)
    } catch {
      setCommentNotifications([])
    }
  }, [activeModuleId])

  const markCommentNotificationsRead = useCallback(() => {
    if (commentNotifications.length === 0) {
      return
    }

    setReadCommentNotificationKeys((current) => {
      const next = new Set(current)
      let changed = false
      for (const notification of commentNotifications) {
        const key = getCommentNotificationReadKey(notification)
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      if (changed) {
        writeStoredCommentNotificationKeys(next)
      }

      return changed ? next : current
    })
  }, [commentNotifications])

  const refreshSyncJournal = useCallback(async () => {
    const requestId = syncJournalRequestRef.current + 1
    syncJournalRequestRef.current = requestId
    setSyncJournalStatus('loading')

    const response = await loadSyncRunsSafely()
    if (syncJournalRequestRef.current !== requestId) {
      return
    }

    setSyncRuns(response.runs)
    setSyncJournalStatus('ready')
  }, [])

  const handleSyncJournalToggle = useCallback(() => {
    if (!syncJournalOpen && syncJournalStatus === 'idle') {
      void refreshSyncJournal()
    }

    setSyncJournalOpen((current) => !current)
  }, [refreshSyncJournal, syncJournalOpen, syncJournalStatus])

  useEffect(() => {
    return () => {
      syncJournalRequestRef.current += 1
    }
  }, [])

  const refreshModuleUsers = useCallback(async () => {
    if (!canManageModuleSettings) {
      setModuleUsers([])
      return
    }

    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      const response = await apiClient.getModuleUsers(activeModuleId)
      setModuleUsers(response.users)
      setModuleUsersStatus('idle')
    } catch (loadError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить пользователей модуля',
      )
    }
  }, [activeModuleId, canManageModuleSettings])

  const refreshPlatformAccess = useCallback(async () => {
    if (!accountUser?.isSuperAdmin) {
      setPlatformAccess(null)
      setPlatformAccessStatus('idle')
      setPlatformAccessError(null)
      return
    }

    setPlatformAccessStatus('loading')
    setPlatformAccessError(null)

    try {
      const response = await apiClient.getPlatformAccess()
      setPlatformAccess(response)
      setPlatformAccessStatus('idle')
    } catch (loadError) {
      setPlatformAccessStatus('error')
      setPlatformAccessError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить доступы платформы',
      )
    }
  }, [accountUser?.isSuperAdmin])

  useEffect(() => {
    let cancelled = false

    async function loadRuntimeData() {
      const requestId = runtimeRequestRef.current + 1
      runtimeRequestRef.current = requestId
      const managerWhitelistSettingsRevisionAtRequestStart =
        managerWhitelistSettingsRevisionRef.current

      setRuntimeData((current) => ({
        ...current,
        operationalStatus: 'loading',
        operationalError: null,
      }))

      try {
        const query = buildDashboardQueryFromProtoFilters(appliedFilters)
        if (isLeadgenModule) {
          setLeadgenReportStatus('loading')
          setLeadgenReportError(null)
          setLeadgenWorkloadStatus('idle')
          setLeadgenWorkloadError(null)
          setPricingSettingsLoading(false)
          setConversionEventTypeSettingsLoading(false)
          setUnitEconomicsSettingsLoading(false)
          setManagerWhitelistSettingsLoading(false)

          const [meta, report] = await Promise.all([
            apiClient.getMeta(activeModuleId),
            apiClient.getLeadgenFunnelReport(activeModuleId, query),
          ])
          if (cancelled || runtimeRequestRef.current !== requestId) {
            return
          }

          setLeadgenReport(report)
          setSnapshotStats(meta.snapshotStats)
          setLastSync(meta.lastSync)
          setSyncRuns([])
          setSyncWarning(resolveSyncHealthWarning(meta))
          setLeadgenReportStatus('idle')
          setRuntimeData({
            managerOptions: report.managerRows.map((row) => ({
              id: row.managerId,
              label: row.managerName,
              meta: 'Менеджер',
            })),
            sourceOptions: report.sourceRows.map((row) => ({
              id: row.sourceKey,
              label: row.sourceLabel,
              meta: 'Источник',
            })),
            operationalStatus: 'ready',
            operationalError: null,
          })
          return
        }

        setLeadgenReport(null)
        setLeadgenWorkload(null)
        setLeadgenReportStatus('idle')
        setLeadgenReportError(null)
        setLeadgenWorkloadStatus('idle')
        setLeadgenWorkloadError(null)
        setLeadgenWorkloadFilterKey(null)
        setPricingSettingsLoading(true)
        setOperationalThresholdSettingsLoading(true)
        setConversionEventTypeSettingsLoading(true)
        setUnitEconomicsSettingsLoading(true)
        setManagerWhitelistSettingsLoading(true)
        setRuntimeData((current) => resetAttractionReportData(current, 'loading'))
        const [
          meta,
          pricingSettings,
          operationalThresholdSettings,
          conversionEventTypeSettings,
          unitEconomicsSettings,
          managerWhitelistSettings,
          dashboard,
          monthDashboard,
          quarterDashboard,
        ] = await Promise.all([
          apiClient.getMeta(activeModuleId),
          apiClient.getPricingSettings(),
          apiClient.getOperationalThresholdSettings(),
          apiClient.getConversionEventTypeSettings(),
          apiClient.getUnitEconomicsSettings(),
          apiClient.getManagerWhitelistSettings(),
          apiClient.getDashboard(query),
          apiClient.getDashboard(
            buildDashboardQueryForDateRange(
              appliedFilters,
              resolveMonthDateRange(appliedFilters),
            ),
          ),
          apiClient.getDashboard(
            buildDashboardQueryForDateRange(
              appliedFilters,
              resolveQuarterDateRange(salesPlanQuarter),
            ),
          ),
        ])

        if (cancelled || runtimeRequestRef.current !== requestId) {
          return
        }
        setPricingSettingsLoading(false)
        setOperationalThresholdSettingsLoading(false)
        setConversionEventTypeSettingsLoading(false)
        setUnitEconomicsSettingsLoading(false)
        setManagerWhitelistSettingsLoading(false)

        const managerPickerOptions = normalizeManagerPickerOptions(meta.managerCatalog)
        const sourcePickerOptions = meta.sourceCatalog.map((entry) => ({
          id: entry.key,
          label: entry.label,
          meta: 'Источник',
        }))
        const stagePickerOptions = buildStagePickerOptions(
          meta.stageCatalog,
          activeModule?.bitrixCategoryId ?? '10',
        )
        setSnapshotStats(meta.snapshotStats)
        setLastSync(meta.lastSync)
        setSyncWarning(resolveSyncHealthWarning(meta))

        setRuntimeData((current) => {
          const shouldUseFetchedManagerWhitelistSettings =
            managerWhitelistSettingsRevisionRef.current ===
            managerWhitelistSettingsRevisionAtRequestStart

          return {
            ...current,
            managerOptions: managerPickerOptions,
            sourceOptions: sourcePickerOptions,
            stageOptions: stagePickerOptions,
            ...(current.salesPlan ? { salesPlan: current.salesPlan } : {}),
            ...(current.salesPlanMonth ? { salesPlanMonth: current.salesPlanMonth } : {}),
            ...(current.salesPlanQuarter ? { salesPlanQuarter: current.salesPlanQuarter } : {}),
            pricingSettings,
            operationalThresholdSettings,
            conversionEventTypeSettings,
            unitEconomicsSettings,
            managerWhitelistSettings: shouldUseFetchedManagerWhitelistSettings
              ? managerWhitelistSettings
              : (current.managerWhitelistSettings ?? managerWhitelistSettings),
            salesDashboard: dashboard,
            salesPlanMonthDashboard: monthDashboard,
            salesPlanQuarterDashboard: quarterDashboard,
            ...(current.revenueVelocity ? { revenueVelocity: current.revenueVelocity } : {}),
            operationalStatus: 'ready',
            operationalError: null,
            sceneStatuses: {
              ...initialAttractionSceneStatuses,
              ...current.sceneStatuses,
              sales: 'ready',
            },
            sceneErrors: {
              ...current.sceneErrors,
              sales: null,
            },
          }
        })
      } catch (error) {
        if (cancelled || runtimeRequestRef.current !== requestId) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Не удалось загрузить live-данные'
        setRuntimeData((current) =>
          isLeadgenModule
            ? {
                ...current,
                operationalStatus: 'error',
                operationalError: message,
              }
            : setRuntimeSceneState(current, 'sales', 'error', message),
        )
        if (isLeadgenModule) {
          setLeadgenReportStatus('error')
          setLeadgenWorkload(null)
          setLeadgenWorkloadStatus('idle')
          setLeadgenWorkloadError(null)
          setLeadgenWorkloadFilterKey(null)
          setLeadgenReportError(
            error instanceof Error ? error.message : 'Не удалось загрузить отчет leadgen',
          )
        }
        setPricingSettingsLoading(false)
        setOperationalThresholdSettingsLoading(false)
        setConversionEventTypeSettingsLoading(false)
        setUnitEconomicsSettingsLoading(false)
        setManagerWhitelistSettingsLoading(false)
      }
    }

    void loadRuntimeData()

    return () => {
      cancelled = true
    }
  }, [activeModule?.bitrixCategoryId, activeModuleId, appliedFilters, isLeadgenModule, salesPlanQuarter])

  useEffect(() => {
    if (!isLeadgenModule || leadgenActiveReportId !== 'activity') {
      return
    }

    if (leadgenWorkload && leadgenWorkloadFilterKey === leadgenWorkloadRequestKey) {
      return
    }

    let cancelled = false
    const requestId = runtimeRequestRef.current
    const query = buildDashboardQueryFromProtoFilters(appliedFilters)

    async function loadLeadgenWorkload() {
      setLeadgenWorkloadStatus('loading')
      setLeadgenWorkloadError(null)

      try {
        const [activities, calls] = await Promise.all([
          apiClient.getLeadgenActivitiesWorkloadReport(activeModuleId, query),
          apiClient.getLeadgenCallsWorkloadReport(activeModuleId, query),
        ])

        if (cancelled || !isMountedRef.current || runtimeRequestRef.current !== requestId) {
          return
        }

        setLeadgenWorkload({
          activities,
          calls,
          scene: mapActivitiesCallsSceneData({ activities, calls }),
        })
        setLeadgenWorkloadFilterKey(leadgenWorkloadRequestKey)
        setLeadgenWorkloadStatus('idle')
      } catch (error) {
        if (cancelled || !isMountedRef.current || runtimeRequestRef.current !== requestId) {
          return
        }

        setLeadgenWorkload(null)
        setLeadgenWorkloadFilterKey(null)
        setLeadgenWorkloadStatus('error')
        setLeadgenWorkloadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить отчет активности leadgen',
        )
      }
    }

    void loadLeadgenWorkload()

    return () => {
      cancelled = true
    }
  }, [
    activeModuleId,
    appliedFilters,
    isLeadgenModule,
    leadgenActiveReportId,
    leadgenWorkload,
    leadgenWorkloadFilterKey,
    leadgenWorkloadRequestKey,
  ])

  useEffect(() => {
    if (!shouldLoadAttractionSceneData || activeAttractionSceneLoadKey === 'sales') {
      return
    }

    if (salesSceneStatus !== 'ready') {
      return
    }

    const currentRuntimeData = runtimeDataRef.current
    const currentSceneStatus = getRuntimeSceneStatus(
      currentRuntimeData,
      activeAttractionSceneLoadKey,
    )
    if (currentSceneStatus === 'loading' || currentSceneStatus === 'ready') {
      return
    }

    const requestId = runtimeRequestRef.current
    const query = buildDashboardQueryFromProtoFilters(appliedFilters)
    const currentManagerOptions =
      currentRuntimeData.managerOptions.length > 0
        ? currentRuntimeData.managerOptions
        : managerOptions

    async function loadActiveAttractionScene() {
      setRuntimeData((current) =>
        setRuntimeSceneState(current, activeAttractionSceneLoadKey, 'loading', null),
      )

      try {
        if (activeAttractionSceneLoadKey === 'activities-calls') {
          const [
            activities,
            calls,
            acquisitionOutcomes,
            targetGroupConversion,
            conversionEvents,
          ] = await Promise.all([
            apiClient.getActivitiesWorkloadReport(query),
            apiClient.getCallsWorkloadReport(query),
            apiClient.getAcquisitionOutcomesReport(query),
            apiClient.getTargetGroupConversionReport(query),
            apiClient.getConversionEventsReport(query),
          ])

          if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
            return
          }

          setRuntimeData((current) =>
            setRuntimeSceneState(
              {
                ...current,
                activitiesWorkload: activities,
                callsWorkload: calls,
                activitiesCalls: mapActivitiesCallsSceneData({ activities, calls }),
                acquisitionOutcomes,
                targetGroupConversion,
                conversionEvents,
              },
              activeAttractionSceneLoadKey,
              'ready',
              null,
            ),
          )
          return
        }

        if (activeAttractionSceneLoadKey === 'cohorts') {
          const managerBreakdownIds =
            appliedFilters.managers.length > 0
              ? appliedFilters.managers
              : currentManagerOptions.map((option) => option.id).slice(0, 5)
          const [cohort, managerBreakdownResults] =
            await Promise.all([
              apiClient.getCohortConversionReport(query),
              Promise.allSettled(
                managerBreakdownIds.map(async (managerId) => {
                  const report = await apiClient.getCohortConversionReport({
                    ...query,
                    managerIds: [managerId],
                    compareRanges: [],
                    includeBreakdown: false,
                  })

                  return {
                    key: managerId,
                    label:
                      currentManagerOptions.find((entry) => entry.id === managerId)?.label ??
                      managerId,
                    report,
                  }
                }),
              ),
            ])
          const managerBreakdowns = managerBreakdownResults.flatMap((result) =>
            result.status === 'fulfilled' ? [result.value] : [],
          )

          if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
            return
          }

          setRuntimeData((current) => {
            return setRuntimeSceneState(
              {
                ...withoutManagerActionOutcomes(current),
                managerActionOutcomesStatus: 'loading',
                managerActionOutcomesError: null,
                cohorts: mapCohortSceneData({
                  report: cohort,
                  managerBreakdowns,
                  sourceBreakdowns: [],
                }),
              },
              activeAttractionSceneLoadKey,
              'ready',
              null,
            )
          })

          void apiClient
            .getManagerActionOutcomeReport(query)
            .then((managerActionOutcomes) => {
              if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
                return
              }

              setRuntimeData((current) => ({
                ...current,
                managerActionOutcomes,
                managerActionOutcomesStatus: 'ready',
                managerActionOutcomesError: null,
              }))
            })
            .catch((error) => {
              if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
                return
              }

              setRuntimeData((current) => {
                return {
                  ...withoutManagerActionOutcomes(current),
                  managerActionOutcomesStatus: 'error',
                  managerActionOutcomesError:
                    error instanceof Error
                      ? error.message
                      : 'Не удалось загрузить детализацию действий',
                }
              })
            })
          return
        }

        if (activeAttractionSceneLoadKey === 'funnel-flow') {
          const tocManagerBreakdownIds =
            appliedFilters.managers.length > 0
              ? appliedFilters.managers
              : currentManagerOptions.map((option) => option.id)
          const [toc, tocManagerBreakdowns] = await Promise.all([
            apiClient.getTocFlowReport(query),
            Promise.all(
              tocManagerBreakdownIds.map(async (managerId) => {
                const report = await apiClient.getTocFlowReport({
                  ...query,
                  managerIds: [managerId],
                  compareRanges: query.compareRanges ?? [],
                })
                const label =
                  currentManagerOptions.find((entry) => entry.id === managerId)?.label ??
                  managerId

                return {
                  key: managerId,
                  label,
                  report,
                }
              }),
            ),
          ])

          if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
            return
          }

          setRuntimeData((current) =>
            setRuntimeSceneState(
              {
                ...current,
                tocFlow: mapTocFlowSceneData({
                  report: toc,
                  managerBreakdowns: tocManagerBreakdowns,
                }),
              },
              activeAttractionSceneLoadKey,
              'ready',
              null,
            ),
          )
          return
        }

        const ontology = await loadAttractionOntologySafely()
        if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
          return
        }

        setRuntimeData((current) =>
          setRuntimeSceneState(
            {
              ...current,
              ...(ontology ? { attractionOntology: ontology } : {}),
            },
            activeAttractionSceneLoadKey,
            'ready',
            null,
          ),
        )
      } catch (error) {
        if (!isMountedRef.current || runtimeRequestRef.current !== requestId) {
          return
        }

        setRuntimeData((current) =>
          setRuntimeSceneState(
            current,
            activeAttractionSceneLoadKey,
            'error',
            error instanceof Error ? error.message : 'Не удалось загрузить live-данные',
          ),
        )
      }
    }

    void loadActiveAttractionScene()
  }, [
    activeAttractionSceneLoadKey,
    appliedFilters,
    salesSceneStatus,
    shouldLoadAttractionSceneData,
  ])

  useEffect(() => {
    void refreshCommentNotifications()
  }, [refreshCommentNotifications])

  useEffect(() => {
    void refreshModuleUsers()
  }, [refreshModuleUsers])

  useEffect(() => {
    void refreshPlatformAccess()
  }, [refreshPlatformAccess])

  useEffect(() => {
    let cancelled = false

    async function loadEffectiveSalesPlan() {
      if (isLeadgenModule) {
        setRuntimeData((current) => omitSalesPlan(current))
        return
      }

      const query = buildDashboardQueryFromProtoFilters(appliedFilters)
      if (query.preset !== 'custom') {
        return
      }

      setRuntimeData((current) => omitSalesPlan(current))

      try {
        const monthQuery = buildDashboardQueryForDateRange(
          appliedFilters,
          resolveMonthDateRange(appliedFilters),
        )
        const [salesPlan, salesPlanMonth] = await Promise.all([
          apiClient.getEffectiveSalesPlan({
            from: query.from,
            to: query.to,
          }),
          apiClient.getEffectiveSalesPlan({
            from: monthQuery.from,
            to: monthQuery.to,
          }),
        ])
        if (cancelled) {
          return
        }

        setRuntimeData((current) => ({
          ...current,
          salesPlan,
          salesPlanMonth,
        }))
      } catch {
        if (cancelled) {
          return
        }

        setRuntimeData((current) => omitSalesPlan(current))
      }
    }

    void loadEffectiveSalesPlan()

    return () => {
      cancelled = true
    }
  }, [appliedFilters, isLeadgenModule])

  useEffect(() => {
    let cancelled = false

    async function loadSalesPlanQuarter() {
      if (isLeadgenModule) {
        setSalesPlanLoading(false)
        setRuntimeData((current) => omitSalesPlanQuarter(current))
        return
      }

      setSalesPlanLoading(true)
      setRuntimeData((current) => omitSalesPlanQuarter(current))

      try {
        const salesPlanQuarterData = await apiClient.getSalesPlanQuarter(salesPlanQuarter)
        if (cancelled) {
          return
        }

        setRuntimeData((current) => ({
          ...current,
          salesPlanQuarter: salesPlanQuarterData,
        }))
      } catch {
        if (cancelled) {
          return
        }

        setRuntimeData((current) => omitSalesPlanQuarter(current))
      } finally {
        if (!cancelled) {
          setSalesPlanLoading(false)
        }
      }
    }

    void loadSalesPlanQuarter()

    return () => {
      cancelled = true
    }
  }, [isLeadgenModule, salesPlanQuarter])

  async function refreshSyncMeta(moduleId = activeModuleId) {
    const [meta, syncJournal] =
      moduleId === 'attraction'
        ? await Promise.all([apiClient.getMeta(moduleId), loadSyncRunsSafely()])
        : [await apiClient.getMeta(moduleId), { runs: [] }]
    setSnapshotStats(meta.snapshotStats)
    setLastSync(meta.lastSync)
    setSyncRuns(syncJournal.runs)
    setSyncWarning(resolveSyncHealthWarning(meta))
  }

  async function handleRefreshData() {
    if (syncStatus === 'syncing') {
      return
    }

    setSyncStatus('syncing')
    setSyncError(null)
    setSyncSummary(null)
    setSyncProgress({
      syncRunId: null,
      phase: 'inspect_snapshot',
      progress: 3,
      message: 'Запускаем синхронизацию',
    })
    setRuntimeData((current) => ({
      ...current,
      operationalError: null,
    }))

    try {
      const summary = await apiClient.triggerSync(activeModuleId, (event) => {
        setSyncProgress(event)
        if (event.snapshotBefore) {
          setSnapshotStats(event.snapshotBefore)
        }
      })
      setSyncSummary(summary)
      setSnapshotStats(summary.snapshotAfter)
      setLastSync({
        finishedAt: summary.finishedAt,
        leadsSynced: summary.leadsSynced,
        dealsSynced: summary.dealsSynced,
        mode: summary.mode,
        dealBreakdown: resolveDealBreakdown(summary.changes),
      })
      setSyncProgress({
        syncRunId: summary.syncRunId,
        phase: 'complete',
        progress: 100,
        message: 'Синхронизация завершена',
        snapshotBefore: summary.snapshotBefore,
        snapshotAfter: summary.snapshotAfter,
        changes: summary.changes,
        mode: summary.mode,
        modifiedAfter: summary.modifiedAfter,
        finishedAt: summary.finishedAt,
        diagnostics: summary.diagnostics,
      })
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setSyncError(formatSyncError(error))
      setRuntimeData((current) => ({
        ...current,
        operationalError: null,
      }))
    } finally {
      await refreshSyncMeta(activeModuleId).catch(() => undefined)
      setSyncStatus('idle')
    }
  }

  async function handleSaveSalesPlan(rows: SalesPlanQuarterDraftRow[]) {
    if (salesPlanLoading) {
      return
    }

    setSalesPlanSaving(true)
    setSalesPlanSaveError(null)

    try {
      const saved = await apiClient.saveSalesPlanQuarter({
        year: salesPlanQuarter.year,
        quarter: salesPlanQuarter.quarter,
        rows,
      })
      setRuntimeData((current) => ({
        ...current,
        salesPlanQuarter: saved,
      }))
    } catch (error) {
      setSalesPlanSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить план продаж',
      )
    } finally {
      setSalesPlanSaving(false)
    }
  }

  async function handleSavePricingSettings(rows: DealPricingRuleInput[]) {
    if (pricingSettingsLoading) {
      return
    }

    setPricingSettingsSaving(true)
    setPricingSettingsSaveError(null)

    try {
      const saved = await apiClient.savePricingSettings({ rules: rows })
      setRuntimeData((current) => ({
        ...current,
        pricingSettings: saved,
      }))
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setPricingSettingsSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить цены',
      )
    } finally {
      setPricingSettingsSaving(false)
    }
  }

  async function handleSaveOperationalThresholdSettings(
    input: OperationalThresholdSettingsInput,
  ) {
    if (operationalThresholdSettingsLoading) {
      return
    }

    setOperationalThresholdSettingsSaving(true)
    setOperationalThresholdSettingsSaveError(null)

    try {
      const saved = await apiClient.saveOperationalThresholdSettings(input)
      setRuntimeData((current) => ({
        ...current,
        operationalThresholdSettings: saved,
      }))
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setOperationalThresholdSettingsSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить пороги',
      )
    } finally {
      setOperationalThresholdSettingsSaving(false)
    }
  }

  async function handleSaveConversionEventTypeSettings(
    input: ConversionEventTypeSettingsInput,
  ) {
    if (conversionEventTypeSettingsLoading) {
      return
    }

    setConversionEventTypeSettingsSaving(true)
    setConversionEventTypeSettingsSaveError(null)

    try {
      const saved = await apiClient.saveConversionEventTypeSettings(input)
      setRuntimeData((current) => ({
        ...current,
        conversionEventTypeSettings: saved,
      }))
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setConversionEventTypeSettingsSaveError(
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить типы мероприятий',
      )
    } finally {
      setConversionEventTypeSettingsSaving(false)
    }
  }

  async function handleSaveUnitEconomicsCostRules(input: UnitEconomicsCostRulesInput) {
    if (unitEconomicsSettingsLoading) {
      return
    }

    setUnitEconomicsSettingsSaving(true)
    setUnitEconomicsSettingsSaveError(null)

    try {
      const saved = await apiClient.saveUnitEconomicsCostRules(input)
      setRuntimeData((current) => ({
        ...current,
        unitEconomicsSettings: saved,
      }))
      setAppliedFilters((current) => cloneFilters(current))
    } catch (error) {
      setUnitEconomicsSettingsSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить расходы',
      )
    } finally {
      setUnitEconomicsSettingsSaving(false)
    }
  }

  async function handleSaveManagerWhitelistSettings(
    input: ManagerWhitelistSettingsInput,
  ) {
    if (managerWhitelistSettingsLoading) {
      return
    }

    setManagerWhitelistSettingsSaving(true)
    setManagerWhitelistSettingsSaveError(null)
    setManagerWhitelistSettingsNotice(null)
    managerWhitelistSettingsRevisionRef.current += 1

    try {
      const managerWhitelistChanged = hasManagerWhitelistSettingsChanged(
        input,
        runtimeDataRef.current.managerWhitelistSettings,
      )
      const saved = await apiClient.saveManagerWhitelistSettings(input)
      const managerOptionsFromSettings = buildWhitelistedManagerOptions(saved)
      const allowedManagerIds = new Set(managerOptionsFromSettings.map((option) => option.id))
      const keepAllowedManagers = (current: ProtoFilterState) => {
        const managers = current.managers.filter((managerId) => allowedManagerIds.has(managerId))
        const unchanged =
          managers.length === current.managers.length &&
          managers.every((managerId, index) => managerId === current.managers[index])

        return unchanged ? current : { ...current, managers }
      }
      const usersNeedingDefaultManagerReassignment = moduleUsers.filter(
        (user) => user.defaultManagerId && !allowedManagerIds.has(user.defaultManagerId),
      )
      setRuntimeData((current) => ({
        ...current,
        managerWhitelistSettings: saved,
        managerOptions: managerOptionsFromSettings,
      }))
      setManagerWhitelistDraft(createEmptyManagerWhitelistDraftState())
      setFilters(keepAllowedManagers)
      setAppliedFilters(keepAllowedManagers)
      if (managerWhitelistChanged) {
        const syncNotice = 'Вайтлист менеджеров изменен. Нужна синхронизация данных.'
        const reassignmentNotice =
          usersNeedingDefaultManagerReassignment.length > 0
            ? `${syncNotice} Нужно переназначить менеджера.`
            : syncNotice
        setSyncWarning(syncNotice)
        setManagerWhitelistSettingsNotice(
          reassignmentNotice,
        )
      }
      await refreshModuleUsers()
    } catch (error) {
      setManagerWhitelistSettingsSaveError(
        error instanceof Error ? error.message : 'Не удалось сохранить менеджеров',
      )
    } finally {
      setManagerWhitelistSettingsSaving(false)
    }
  }

  function patchFilters(next: Partial<ProtoFilterState>) {
    setFilters((current) => ({ ...current, ...next }))
  }

  function toggleFilterValue(key: 'managers' | 'sources', value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }))
  }

  function toggleManagerFilterValue(value: string) {
    const managerIds = resolveManagerScopeOptionManagerIds(
      value,
      runtimeData.managerWhitelistSettings,
    )

    if (managerIds !== null) {
      setFilters((current) => ({
        ...current,
        managers: sameStringSet(current.managers, managerIds) ? [] : managerIds,
      }))
      return
    }

    toggleFilterValue('managers', value)
  }

  function addCompareRange() {
    setFilters((current) => {
      if (current.compareRanges.length >= 5) {
        return current
      }

      return {
        ...current,
        compareRanges: [...current.compareRanges, createCompareRange(current)],
      }
    })
  }

  function updateCompareRange(id: string, patch: Partial<CompareRange>) {
    setFilters((current) => ({
      ...current,
      compareRanges: current.compareRanges.map((range) =>
        range.id === id ? { ...range, ...patch } : range,
      ),
    }))
  }

  function removeCompareRange(id: string) {
    setFilters((current) => ({
      ...current,
      compareRanges: current.compareRanges.filter((range) => range.id !== id),
    }))
  }

  function applyFilters() {
    const nextFilters = cloneFilters({
      ...filters,
      rangeStart: rangeStartInputRef.current?.value ?? filters.rangeStart,
      rangeEnd: rangeEndInputRef.current?.value ?? filters.rangeEnd,
    })
    setFilters(nextFilters)
    setAppliedFilters(nextFilters)
    setSalesPlanQuarter(resolveSalesPlanQuarter(nextFilters))
    setLastFiltersApply(new Date().toISOString())
  }

  function openNewComment(x: number, y: number, anchor: ProtoCommentAnchor) {
    setDraftComment({ id: null, x, y, text: '', anchor })
    setReworkText('')
    setCommentsOpen(true)
  }

  function openExistingComment(comment: ProtoComment) {
    setDraftComment({
      id: comment.id,
      x: comment.x,
      y: comment.y,
      text: comment.text,
      anchor:
        comment.anchor ??
        ({
          blockId: 'legacy-comment',
          blockLabel: 'Комментарий без привязки',
          blockSelector: 'legacy-comment',
          blockRole: null,
          elementSelector: 'legacy-comment',
          elementLabel: '',
          relativeX: comment.x,
          relativeY: comment.y,
        } satisfies ProtoCommentAnchor),
      paperclipStatus: comment.paperclipStatus,
      paperclipReadyReport: comment.paperclipReadyReport,
    })
    setReworkText('')
    setCommentsOpen(true)
  }

  function handleShellClick(event: MouseEvent<HTMLDivElement>) {
    if (!commentMode || !shellRef.current || shouldIgnoreCommentTarget(event.target)) {
      return
    }

    const rect = shellRef.current.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }

    openNewComment(
      Number(((event.clientX - rect.left) / rect.width).toFixed(4)),
      Number(((event.clientY - rect.top) / rect.height).toFixed(4)),
      resolveCommentAnchor(event.target, shellRef.current, event.clientX, event.clientY),
    )
  }

  async function handleSaveComment() {
    if (!draftComment || commentSaveInFlightRef.current) {
      return
    }

    const text = draftComment.text.trim()
    if (!text) {
      return
    }

    commentSaveInFlightRef.current = true
    setCommentSavePending(true)

    try {
      const now = new Date().toISOString()
      const context: ProtoCommentContext = {
        filters: appliedFilters,
      }
      await upsertComment({
        id: draftComment.id ?? crypto.randomUUID(),
        sceneId: activeCommentSceneId,
        x: draftComment.x,
        y: draftComment.y,
        text,
        anchor: draftComment.anchor,
        createdAt:
          comments.find((item) => item.id === draftComment.id)?.createdAt ?? now,
        updatedAt: now,
        status: 'open',
        archivedAt: null,
        context,
      })
      await refreshCommentNotifications()
      setDraftComment(null)
      setCommentsOpen(false)
    } finally {
      commentSaveInFlightRef.current = false
      setCommentSavePending(false)
    }
  }

  function closeCommentDraft() {
    setDraftComment(null)
    setReworkText('')
    setCommentsOpen(false)
  }

  async function handleArchiveComment(commentId: string) {
    await archiveComment(commentId)
    await refreshCommentNotifications()
    setDraftComment(null)
    setCommentsOpen(false)
  }

  async function handleRetryComment(commentId: string) {
    await retryComment(commentId)
    await refreshCommentNotifications()
  }

  async function handleReworkComment(commentId: string) {
    if (commentReworkInFlightRef.current) {
      return
    }

    const text = reworkText.trim()
    if (!text) {
      return
    }

    commentReworkInFlightRef.current = true
    setCommentReworkPending(true)

    try {
      const reworked = await reworkComment(commentId, text)
      if (!reworked) {
        return
      }

      await refreshCommentNotifications()
      setReworkText('')
      setDraftComment(null)
      setCommentsOpen(false)
    } finally {
      commentReworkInFlightRef.current = false
      setCommentReworkPending(false)
    }
  }

  async function handleSaveProfile() {
    setAccountStatus('saving')
    setAccountMessage(null)

    try {
      const response = await apiClient.updateCurrentUser({
        firstName: profileDraft.firstName.trim() || null,
        lastName: profileDraft.lastName.trim() || null,
      })
      setAccountUser(response.user)
      setAccountStatus('idle')
      setAccountMessage('Профиль обновлен.')
    } catch (profileError) {
      setAccountStatus('error')
      setAccountMessage(
        profileError instanceof Error ? profileError.message : 'Не удалось сохранить профиль.',
      )
    }
  }

  async function handleChangePassword() {
    if (passwordDraft.newPassword.length < 8) {
      setAccountStatus('error')
      setAccountMessage('Новый пароль должен быть не короче 8 символов.')
      return
    }

    setAccountStatus('saving')
    setAccountMessage(null)

    try {
      await apiClient.changeCurrentPassword(passwordDraft)
      setPasswordDraft({
        currentPassword: '',
        newPassword: '',
      })
      setAccountStatus('idle')
      setAccountMessage('Пароль обновлен.')
    } catch (passwordError) {
      setAccountStatus('error')
      setAccountMessage(
        passwordError instanceof Error ? passwordError.message : 'Не удалось сменить пароль.',
      )
    }
  }

  function handleGeneratePassword() {
    setNewModuleUser((current) => ({
      ...current,
      password: generateTemporaryPassword(),
    }))
  }

  async function handleCopyCredentials() {
    if (!createdCredentials) {
      return
    }

    try {
      await navigator.clipboard?.writeText(createdCredentials)
      setModuleUsersError(null)
    } catch {
      setModuleUsersError('Не удалось скопировать доступы автоматически.')
    }
  }

  async function handleCreateModuleUser() {
    const login = newModuleUser.login.trim()
    const password = newModuleUser.password
    if (!login || password.length < 8) {
      setModuleUsersError('Логин и пароль от 8 символов обязательны.')
      return
    }

    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      await apiClient.createModuleUser(
        {
          login,
          firstName: newModuleUser.firstName.trim() || null,
          lastName: newModuleUser.lastName.trim() || null,
          password,
          role: newModuleUser.role,
          defaultManagerId: newModuleUser.defaultManagerId || null,
        },
        activeModuleId,
      )
      setCreatedCredentials(`Логин: ${login}\nПароль: ${password}`)
      setNewModuleUser({
        firstName: '',
        lastName: '',
        login: '',
        password: '',
        role: 'employee',
        defaultManagerId: '',
      })
      await refreshModuleUsers()
    } catch (createError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        createError instanceof Error
          ? createError.message
          : 'Не удалось создать пользователя',
      )
    }
  }

  async function handleUpdateModuleUser(
    user: ModuleUser,
    patch: {
      firstName?: string | null
      lastName?: string | null
      password?: string
      role?: ModuleRole
      defaultManagerId?: string | null
      disabled?: boolean
      membershipStatus?: 'active' | 'disabled'
    },
  ) {
    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      const response = await apiClient.updateModuleUser(user.id, patch, activeModuleId)
      setModuleUsers((current) =>
        current.map((item) => (item.id === user.id ? response.user : item)),
      )
      setModuleUsersStatus('idle')
    } catch (updateError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        updateError instanceof Error
          ? updateError.message
          : 'Не удалось обновить пользователя',
      )
    }
  }

  async function handleDeleteModuleUser(user: ModuleUser) {
    setModuleUsersStatus('loading')
    setModuleUsersError(null)

    try {
      const response = await apiClient.deleteModuleUser(user.id, activeModuleId)
      setModuleUsers((current) =>
        current.map((item) => (item.id === user.id ? response.user : item)),
      )
      setModuleUsersStatus('idle')
    } catch (deleteError) {
      setModuleUsersStatus('error')
      setModuleUsersError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Не удалось удалить пользователя',
      )
    }
  }

  function getActivePlatformMembership(user: PlatformUser, moduleId: string) {
    return user.memberships.find(
      (membership) =>
        membership.moduleId === moduleId && membership.membershipStatus === 'active',
    )
  }

  function buildPlatformMemberships(
    user: PlatformUser,
    moduleId: string,
    role: ModuleRole | null,
  ): PlatformMembershipInput[] {
    const byModule = new Map<string, PlatformMembershipInput>()
    for (const membership of user.memberships) {
      if (membership.membershipStatus !== 'active') {
        continue
      }
      byModule.set(membership.moduleId, {
        moduleId: membership.moduleId,
        role: membership.moduleRole,
        status: 'active',
      })
    }

    if (role) {
      byModule.set(moduleId, {
        moduleId,
        role,
        status: 'active',
      })
    } else {
      byModule.delete(moduleId)
    }

    const modules = platformAccess?.modules ?? []
    return modules
      .map((module) => byModule.get(module.id))
      .filter((membership): membership is PlatformMembershipInput => Boolean(membership))
  }

  async function savePlatformUserMemberships(
    userId: number,
    memberships: PlatformMembershipInput[],
  ) {
    setPlatformAccessStatus('saving')
    setPlatformAccessError(null)

    try {
      const response = await apiClient.updatePlatformUserMemberships(userId, memberships)
      setPlatformAccess((current) =>
        current
          ? {
              ...current,
              users: current.users.map((item) =>
                item.id === userId ? response.user : item,
              ),
            }
          : current,
      )
      setPlatformAccessStatus('idle')
    } catch (saveError) {
      setPlatformAccessStatus('error')
      setPlatformAccessError(
        saveError instanceof Error
          ? saveError.message
          : 'Не удалось обновить доступы платформы',
      )
    }
  }

  async function handleTogglePlatformMembership(
    user: PlatformUser,
    moduleId: string,
    enabled: boolean,
  ) {
    const currentMembership = getActivePlatformMembership(user, moduleId)
    const role = enabled ? currentMembership?.moduleRole ?? 'employee' : null
    await savePlatformUserMemberships(user.id, buildPlatformMemberships(user, moduleId, role))
  }

  async function handleChangePlatformRole(
    user: PlatformUser,
    moduleId: string,
    role: ModuleRole,
  ) {
    await savePlatformUserMemberships(user.id, buildPlatformMemberships(user, moduleId, role))
  }

  if (route === 'account') {
    const accountTabs: Array<{ id: AccountTab; label: string; description: string }> = [
      {
        id: 'profile',
        label: 'Профиль',
        description: 'Имя, логин и пароль',
      },
      {
        id: 'module',
        label: 'Модуль',
        description: 'Роль и права',
      },
      {
        id: 'settings',
        label: 'Настройки',
        description: 'Цены, команды, события и расходы',
      },
      ...(canSeeAccountUsersTab
        ? [
            {
              id: 'users' as const,
              label: 'Пользователи',
              description: 'Сотрудники и доступы',
            },
          ]
        : []),
    ]

    return (
      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex w-full max-w-[1420px] flex-col gap-6">
          <header className="panel p-4 md:p-5" data-no-comment="true">
            <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-center">
              <div>
                <p className="subtle-label">
                  Модуль «{activeModule?.name ?? 'Привлечение'}»
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  Личный кабинет
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {accountUser ? getUserDisplayName(accountUser) : 'Пользователь не определен'}
                </p>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {ModuleSwitcher}
                <button type="button" className="btn btn-ghost" onClick={navigateToDashboard}>
                  К дашборду
                </button>
              </div>
            </div>
          </header>

          {accountMessage ? (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-semibold',
                accountStatus === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700',
              )}
              role={accountStatus === 'error' ? 'alert' : 'status'}
            >
              {accountMessage}
            </div>
          ) : null}

          <nav className="panel p-3" aria-label="Разделы личного кабинета">
            <div className="flex flex-wrap gap-2" role="tablist">
              {accountTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeAccountTab === tab.id}
                  aria-controls={`account-tab-${tab.id}`}
                  className={cn(
                    'tab-chip text-left',
                    activeAccountTab === tab.id && 'tab-chip-active',
                  )}
                  onClick={() => setActiveAccountTab(tab.id)}
                >
                  <span className="block">{tab.label}</span>
                  <span className="mt-0.5 block text-[0.68rem] font-semibold opacity-75">
                    {tab.description}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          <div
            id="account-tab-profile"
            role="tabpanel"
            hidden={activeAccountTab !== 'profile'}
            className="grid gap-6"
          >
            <section className="panel grid gap-4 p-5">
              <div>
                <div className="subtle-label">Профиль</div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Имя и вход</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="subtle-label">Имя</span>
                  <input
                    className="field"
                    value={profileDraft.firstName}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="subtle-label">Фамилия</span>
                  <input
                    className="field"
                    value={profileDraft.lastName}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="subtle-label">Логин для входа</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {accountUser?.login ?? 'Нет активной сессии'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary w-fit"
                onClick={() => void handleSaveProfile()}
                disabled={accountStatus === 'saving' || !accountUser}
              >
                Сохранить профиль
              </button>
            </section>

            <section className="panel grid gap-4 p-5">
              <div>
                <div className="subtle-label">Пароль</div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Смена пароля</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="field"
                  type="password"
                  placeholder="текущий пароль"
                  value={passwordDraft.currentPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                />
                <input
                  className="field"
                  type="password"
                  placeholder="новый пароль"
                  value={passwordDraft.newPassword}
                  onChange={(event) =>
                    setPasswordDraft((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost w-fit"
                onClick={() => void handleChangePassword()}
                disabled={accountStatus === 'saving' || !passwordDraft.currentPassword}
              >
                Сменить пароль
              </button>
            </section>
          </div>

          <div
            id="account-tab-module"
            role="tabpanel"
            hidden={activeAccountTab !== 'module'}
            className="grid gap-6"
          >
            <section className="panel grid gap-4 p-5">
              <div>
                <div className="subtle-label">Модуль</div>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {activeModule?.name ?? 'Привлечение'}
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="subtle-label">Роль</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {activeModule?.role === 'leader' ? 'Лидер модуля' : 'Сотрудник'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="subtle-label">Slug</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {activeModule?.slug ?? activeModuleId}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="subtle-label">Права</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {activeModule?.permissions.length ?? 0}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div
            id="account-tab-settings"
            role="tabpanel"
            hidden={activeAccountTab !== 'settings'}
            className="grid gap-6"
          >
            <ModuleSettingsPanel
              canEdit={canManageModuleSettings}
              pricingSettings={runtimeData.pricingSettings}
              operationalThresholdSettings={runtimeData.operationalThresholdSettings}
              conversionEventTypeSettings={runtimeData.conversionEventTypeSettings}
              unitEconomicsSettings={runtimeData.unitEconomicsSettings}
              managerWhitelistSettings={runtimeData.managerWhitelistSettings}
              pricingSettingsLoading={pricingSettingsLoading}
              pricingSettingsSaving={pricingSettingsSaving}
              pricingSettingsSaveError={pricingSettingsSaveError}
              operationalThresholdSettingsLoading={operationalThresholdSettingsLoading}
              operationalThresholdSettingsSaving={operationalThresholdSettingsSaving}
              operationalThresholdSettingsSaveError={
                operationalThresholdSettingsSaveError
              }
              conversionEventTypeSettingsLoading={conversionEventTypeSettingsLoading}
              conversionEventTypeSettingsSaving={conversionEventTypeSettingsSaving}
              conversionEventTypeSettingsSaveError={conversionEventTypeSettingsSaveError}
              unitEconomicsSettingsLoading={unitEconomicsSettingsLoading}
              unitEconomicsSettingsSaving={unitEconomicsSettingsSaving}
              unitEconomicsSettingsSaveError={unitEconomicsSettingsSaveError}
              managerWhitelistSettingsLoading={managerWhitelistSettingsLoading}
              managerWhitelistSettingsSaving={managerWhitelistSettingsSaving}
              managerWhitelistSettingsSaveError={managerWhitelistSettingsSaveError}
              managerWhitelistSettingsNotice={managerWhitelistSettingsNotice}
              managerWhitelistDraft={managerWhitelistDraft}
              onManagerWhitelistDraftChange={setManagerWhitelistDraft}
              onPricingSettingsSave={handleSavePricingSettings}
              onOperationalThresholdSettingsSave={handleSaveOperationalThresholdSettings}
              onConversionEventTypeSettingsSave={handleSaveConversionEventTypeSettings}
              onUnitEconomicsCostRulesSave={handleSaveUnitEconomicsCostRules}
              onManagerWhitelistSettingsSave={handleSaveManagerWhitelistSettings}
            />
          </div>

          {canSeeAccountUsersTab ? (
            <div
              id="account-tab-users"
              role="tabpanel"
              hidden={activeAccountTab !== 'users'}
              className="grid gap-6"
            >
              {accountUser?.isSuperAdmin ? (
                <section className="panel grid gap-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="subtle-label">Супер-админ</div>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">
                        Доступы платформы
                      </h2>
                    </div>
                    <span className="badge-chip badge-neutral">{platformAccessStatus}</span>
                  </div>
                  {platformAccessError ? (
                    <p className="text-sm font-semibold text-red-600">
                      {platformAccessError}
                    </p>
                  ) : null}
                  {platformModules.length === 0 || platformUsers.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {platformAccessStatus === 'loading'
                        ? 'Загрузка доступов.'
                        : 'Нет пользователей или модулей для настройки.'}
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {platformUsers.map((user) => (
                        <div
                          key={user.id}
                          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.8fr)]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">
                              {user.login}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {user.isSuperAdmin
                                ? 'Суперадмин'
                                : user.disabled
                                  ? 'Отключен'
                                  : 'Пользователь'}
                            </div>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {platformModules.map((module) => {
                              const membership = getActivePlatformMembership(user, module.id)
                              const locked = user.isSuperAdmin
                              const checked = locked || Boolean(membership)
                              const disabled =
                                locked ||
                                user.disabled ||
                                platformAccessStatus === 'loading' ||
                                platformAccessStatus === 'saving'

                              return (
                                <div
                                  key={module.id}
                                  className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3"
                                >
                                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      aria-label={`${user.login}: доступ к модулю ${module.name}`}
                                      onChange={(event) =>
                                        void handleTogglePlatformMembership(
                                          user,
                                          module.id,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                    <span className="min-w-0 truncate">{module.name}</span>
                                  </label>
                                  <select
                                    className="field"
                                    value={locked ? 'leader' : membership?.moduleRole ?? 'employee'}
                                    disabled={disabled || !membership}
                                    aria-label={`${user.login}: роль в модуле ${module.name}`}
                                    onChange={(event) =>
                                      void handleChangePlatformRole(
                                        user,
                                        module.id,
                                        event.target.value as ModuleRole,
                                      )
                                    }
                                  >
                                    <option value="employee">Сотрудник</option>
                                    <option value="leader">Лидер</option>
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {canManageModuleSettings ? (
                <section className="panel grid gap-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="subtle-label">Команда</div>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">
                        Пользователи модуля
                      </h2>
                    </div>
                    <span className="badge-chip badge-neutral">{moduleUsersStatus}</span>
                  </div>
                  {moduleUsersError ? (
                    <p className="text-sm font-semibold text-red-600">{moduleUsersError}</p>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="field"
                      placeholder="имя"
                      value={newModuleUser.firstName}
                      onChange={(event) =>
                        setNewModuleUser((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="field"
                      placeholder="фамилия"
                      value={newModuleUser.lastName}
                      onChange={(event) =>
                        setNewModuleUser((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="field"
                      type="text"
                      placeholder="логин"
                      value={newModuleUser.login}
                      onChange={(event) =>
                        setNewModuleUser((current) => ({
                          ...current,
                          login: event.target.value,
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <input
                        className="field"
                        type="text"
                        placeholder="пароль"
                        value={newModuleUser.password}
                        onChange={(event) =>
                          setNewModuleUser((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                      <button type="button" className="btn btn-ghost px-3" onClick={handleGeneratePassword}>
                        Сгенерировать
                      </button>
                    </div>
                    <select
                      className="field"
                      value={newModuleUser.role}
                      onChange={(event) =>
                        setNewModuleUser((current) => ({
                          ...current,
                          role: event.target.value as ModuleRole,
                        }))
                      }
                    >
                      <option value="employee">Сотрудник</option>
                      <option value="leader">Лидер</option>
                    </select>
                    <label className="space-y-1.5">
                      <span className="subtle-label">Менеджер по умолчанию</span>
                      <select
                        className="field"
                        aria-label="Менеджер по умолчанию для нового сотрудника"
                        value={newModuleUser.defaultManagerId}
                        onChange={(event) =>
                          setNewModuleUser((current) => ({
                            ...current,
                            defaultManagerId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Не выбран</option>
                        {defaultManagerOptions.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleCreateModuleUser()}
                      disabled={moduleUsersStatus === 'loading'}
                    >
                      Создать сотрудника
                    </button>
                  </div>

                  {createdCredentials ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <div className="subtle-label text-emerald-800">Новые доступы</div>
                      <pre className="mt-2 whitespace-pre-wrap text-sm font-semibold text-emerald-950">
                        {createdCredentials}
                      </pre>
                      <button
                        type="button"
                        className="btn btn-ghost mt-3"
                        onClick={() => void handleCopyCredentials()}
                      >
                        Скопировать логин и пароль
                      </button>
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    {moduleUsers.map((user) => {
                      const defaultManagerExists =
                        !user.defaultManagerId ||
                        defaultManagerOptions.some((manager) => manager.id === user.defaultManagerId)

                      return (
                        <div
                          key={user.id}
                          data-module-user-row="true"
                          className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 xl:grid-cols-[1.2fr_1fr_1fr_9rem_minmax(12rem,0.9fr)_auto_auto]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">
                              {user.login}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {user.disabled || user.membershipStatus === 'disabled'
                                ? 'Удален'
                                : 'Активен'}
                            </div>
                          </div>
                          <input
                            className="field"
                            placeholder="имя"
                            value={user.firstName ?? ''}
                            onChange={(event) =>
                              setModuleUsers((current) =>
                                current.map((item) =>
                                  item.id === user.id
                                    ? { ...item, firstName: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <input
                            className="field"
                            placeholder="фамилия"
                            value={user.lastName ?? ''}
                            onChange={(event) =>
                              setModuleUsers((current) =>
                                current.map((item) =>
                                  item.id === user.id
                                    ? { ...item, lastName: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <select
                            className="field"
                            value={user.moduleRole}
                            onChange={(event) =>
                              setModuleUsers((current) =>
                                current.map((item) =>
                                  item.id === user.id
                                    ? { ...item, moduleRole: event.target.value as ModuleRole }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="employee">Сотрудник</option>
                            <option value="leader">Лидер</option>
                          </select>
                          <div className="grid gap-1">
                            <select
                              className="field"
                              aria-label={`${user.login}: менеджер по умолчанию`}
                              value={defaultManagerExists ? user.defaultManagerId ?? '' : ''}
                              onChange={(event) =>
                                setModuleUsers((current) =>
                                  current.map((item) =>
                                    item.id === user.id
                                      ? { ...item, defaultManagerId: event.target.value || null }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="">Не выбран</option>
                              {defaultManagerOptions.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.label}
                                </option>
                              ))}
                            </select>
                            {defaultManagerExists ? null : (
                              <span className="text-xs font-semibold text-amber-700">
                                Нужно переназначить менеджера.
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              void handleUpdateModuleUser(user, {
                                firstName: user.firstName?.trim() || null,
                                lastName: user.lastName?.trim() || null,
                                role: user.moduleRole,
                                defaultManagerId: user.defaultManagerId ?? null,
                              })
                            }
                          >
                            Обновить
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handleDeleteModuleUser(user)}
                            disabled={user.disabled || user.membershipStatus === 'disabled'}
                          >
                            Удалить
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <div
        ref={shellRef}
        className={cn('relative mx-auto flex w-full max-w-[1420px] flex-col gap-6', {
          'cursor-crosshair': commentMode,
        })}
        onClick={handleShellClick}
        role="presentation"
      >
        <header className="panel p-4 md:p-5" data-no-comment="true">
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-center">
            <div>
              <p className="subtle-label">
                Модуль «{activeModule?.name ?? 'Привлечение'}»
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {route === 'calls'
                  ? 'Анализ звонков'
                  : route === 'ontology'
                    ? 'Онтология'
                    : route === 'playbook'
                      ? 'Плейбук КИ'
                  : isLeadgenModule
                    ? 'Лидогенерация'
                    : 'PDCA-дашборд метрик'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {route === 'calls'
                  ? 'Очередь звонков, ручной запуск анализа, transcript по ролям и оценка ИИ.'
                  : route === 'ontology'
                    ? 'Карта процесса, источники, статусы актуальности и связанные отчеты.'
                    : route === 'playbook'
                      ? 'Плейбук Комьюнити-Интегратора: сценарии, события, поля и рабочие правила.'
                  : isLeadgenModule
                  ? 'Лидген УС: стадии, источники, UTM и менеджеры.'
                  : 'Контур по продажам, делам, звонкам и когортам на базе локального Bitrix24 snapshot.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              {ModuleSwitcher}
              <PaperclipNotifications
                notifications={commentNotifications}
                summary={notificationSummary}
                unreadCount={unreadCommentNotificationKeys.size}
                unreadKeys={unreadCommentNotificationKeys}
                onRead={markCommentNotificationsRead}
              />
              {accountUser ? (
                <button
                  type="button"
                  className="btn btn-ghost gap-2"
                  onClick={navigateToAccount}
                  aria-label="Личный кабинет"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {getUserInitials(accountUser)}
                  </span>
                  <span>Личный кабинет</span>
                </button>
              ) : null}
              <span className="badge-chip badge-neutral">Desktop only</span>
              <span className="badge-chip badge-green">
                {isLeadgenModule
                  ? leadgenReportStatus === 'loading'
                    ? 'Загрузка leadgen'
                    : leadgenReportStatus === 'error'
                      ? 'Ошибка leadgen'
                      : 'Leadgen API'
                  : route === 'ontology'
                    ? activeRuntimeData.operationalStatus === 'loading'
                      ? 'Загрузка ontology'
                      : activeRuntimeData.operationalStatus === 'error'
                        ? 'Ошибка ontology'
                        : 'Ontology live'
                  : route === 'playbook'
                    ? 'Плейбук local'
                  : activeScene.id === 'sales'
                  ? activeRuntimeData.salesDashboard
                    ? 'Sales report live'
                    : 'Sales loading'
                  : activeRuntimeData.operationalStatus === 'loading'
                    ? 'Загрузка live'
                    : activeRuntimeData.operationalStatus === 'error'
                      ? 'Ошибка live'
                      : 'Live API'}
              </span>
            </div>
          </div>

          <nav
            className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3"
            aria-label="Основные разделы дашборда"
          >
            <button
              className={cn('tab-chip', route === 'dashboard' && 'tab-chip-active')}
              type="button"
              onClick={navigateToDashboard}
              aria-pressed={route === 'dashboard'}
            >
              Аналитика
            </button>
            <button
              className={cn('tab-chip', route === 'calls' && 'tab-chip-active')}
              type="button"
              onClick={navigateToCalls}
              aria-pressed={route === 'calls'}
            >
              Анализ звонков
            </button>
            <button
              className={cn('tab-chip', route === 'ontology' && 'tab-chip-active')}
              type="button"
              onClick={navigateToOntology}
              aria-pressed={route === 'ontology'}
            >
              Онтология
            </button>
            <button
              className={cn('tab-chip', route === 'playbook' && 'tab-chip-active')}
              type="button"
              onClick={navigateToPlaybook}
              aria-pressed={route === 'playbook'}
            >
              Плейбук КИ
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void handleRefreshData()}
              disabled={syncStatus === 'syncing'}
              aria-busy={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? 'Синхронизация...' : 'Обновить данные'}
            </button>
            <button
              className="btn btn-ghost"
              data-comments-panel-trigger="true"
              onClick={() => setCommentsOpen((current) => !current)}
            >
              Комментарии
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setCommentMode((current) => !current)
                setDraftComment(null)
              }}
            >
              {commentMode ? 'Выйти из comment mode' : 'Comment mode'}
            </button>
          </nav>

          {route === 'dashboard' ? (
          <div className="sync-strip mt-3" aria-live="polite">
            <div className="sync-strip-grid">
              <div>
                <div className="sync-strip-label">Snapshot</div>
                <div className="sync-strip-value">
                  {snapshotStats
                    ? `${formatCount(snapshotStats.deals)} сделок`
                    : isLeadgenModule && leadgenReportStatus === 'loading'
                      ? 'Загрузка'
                      : 'Нет данных'}
                </div>
                {snapshotStats ? (
                  <div className="sync-strip-meta">
                    {formatCount(snapshotStats.activities)} активностей ·{' '}
                    {formatCount(snapshotStats.calls)} звонков ·{' '}
                    {formatCount(snapshotStats.stageHistory)} стадий
                  </div>
                ) : null}
              </div>
              <div>
                <div className="sync-strip-label">Последний sync</div>
                <div className="sync-strip-value">
                  {lastSync ? formatDateTime(lastSync.finishedAt) : 'Еще не было'}
                </div>
                <div className="sync-strip-meta">
                  {lastSync
                    ? `${formatSyncMode(lastSync.mode)} · ${formatDealBreakdown({
                        deals: lastSync.dealsSynced,
                        dealBreakdown: lastSync.dealBreakdown,
                      })}`
                    : 'Локальный snapshot ожидает первого успешного запуска'}
                </div>
              </div>
              <div>
                <div className="sync-strip-label">Текущий запуск</div>
                <div className="sync-strip-value">
                  {syncProgress?.message ??
                    (syncSummary
                      ? `${formatCount(syncSummary.changes.deals)} строк сделок из Bitrix за sync`
                      : 'Готов к запуску')}
                </div>
                <div className="sync-strip-meta">
                  {syncSummary
                    ? `${formatDealBreakdown(syncSummary.changes)} · ${formatCount(
                        syncSummary.changes.activities,
                      )} активностей · ${formatCount(
                        syncSummary.changes.calls,
                      )} звонков`
                    : 'Фазы: справочники, сделки, активности, звонки, SQLite'}
                </div>
              </div>
            </div>
            <div
              className="sync-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={syncProgress?.progress ?? 0}
            >
              <div
                className="sync-progress-fill"
                style={{ width: `${syncProgress?.progress ?? 0}%` }}
              />
            </div>
            {!isLeadgenModule ? (
              <div className="sync-journal-toolbar">
                <button
                  type="button"
                  className="sync-journal-toggle"
                  aria-label={
                    syncJournalOpen ? 'Скрыть журнал синхронизаций' : 'Открыть журнал синхронизаций'
                  }
                  aria-controls="sync-journal-panel"
                  aria-expanded={syncJournalOpen}
                  onClick={handleSyncJournalToggle}
                >
                  Журнал
                  {syncRuns.length > 0 ? (
                    <span className="sync-journal-count">{formatCount(syncRuns.length)}</span>
                  ) : null}
                </button>
              </div>
            ) : null}
            {syncJournalOpen && !isLeadgenModule ? (
              <div id="sync-journal-panel" className="sync-journal" aria-label="Журнал синхронизаций">
                <div className="sync-journal-head">
                  <div>
                    <div className="sync-strip-label">Журнал синхронизаций</div>
                    <div className="sync-strip-meta">Автосинхронизация: Привлечение раз в час</div>
                  </div>
                </div>
                {syncJournalStatus === 'loading' ? (
                  <div className="sync-strip-meta mt-2">Загрузка журнала...</div>
                ) : syncRuns.length > 0 ? (
                  <div className="sync-journal-table-wrap">
                    <table className="sync-journal-table">
                      <thead>
                        <tr>
                          <th>Старт</th>
                          <th>Статус</th>
                          <th>Режим</th>
                          <th>Сделки</th>
                          <th>Длительность</th>
                          <th>Диагностика</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncRuns.map((run) => (
                          <tr key={run.id}>
                            <td>{formatDateTime(run.startedAt)}</td>
                            <td>
                              <span className={cn('sync-run-status', `sync-run-status-${run.status}`)}>
                                {formatSyncRunStatus(run.status)}
                              </span>
                            </td>
                            <td>{formatSyncMode(run.mode)}</td>
                            <td>{formatCount(run.dealsSynced)}</td>
                            <td>{formatDurationMs(run.durationMs)}</td>
                            <td>{formatSyncRunDiagnostics(run)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="sync-strip-meta mt-2">Пока нет записей журнала</div>
                )}
              </div>
            ) : null}
            {syncWarning ? (
              <div className="sync-notice sync-notice-warning">{syncWarning}</div>
            ) : null}
            {syncError ? (
              <div className="sync-notice sync-notice-error" role="alert">
                {syncError}
              </div>
            ) : null}
          </div>
          ) : null}
        </header>

        {route === 'calls' ? (
          <Suspense fallback={<SceneLoadingFallback label="Загружаю анализ звонков" />}>
            <LazyCallAnalysisWorkspace
              moduleId={activeModuleId}
              managerOptions={visibleManagerOptions}
              sourceOptions={availableSourceOptions}
              stageOptions={runtimeData.stageOptions ?? []}
            />
          </Suspense>
        ) : route === 'ontology' ? (
          <Suspense fallback={<SceneLoadingFallback label="Загружаю онтологию" />}>
            <LazyOntologyHubScene
              commentMode={commentMode}
              filters={appliedFilters}
              runtimeData={activeRuntimeData}
              onSceneNavigate={handleSceneNavigate}
            />
          </Suspense>
        ) : route === 'playbook' ? (
          <Suspense fallback={<SceneLoadingFallback label="Загружаю плейбук КИ" />}>
            <LazyPlaybookScene />
          </Suspense>
        ) : (
          <>
        <section
          className="panel p-5"
          data-comment-block-id="filters-panel"
          data-comment-block-label="Фильтры периода и среза"
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
                Фильтры периода и среза
              </h3>
              <div className="text-sm font-semibold text-slate-700">
                Применено: {formatDateTime(lastFiltersApply)}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,330px)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
              <div className="space-y-1.5">
                <label className="subtle-label">Основной диапазон</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    ref={rangeStartInputRef}
                    type="date"
                    aria-label="Дата начала основного диапазона"
                    value={filters.rangeStart}
                    onChange={(event) => patchFilters({ rangeStart: event.target.value })}
                    onInput={(event) => patchFilters({ rangeStart: event.currentTarget.value })}
                    className="field"
                  />
                  <input
                    ref={rangeEndInputRef}
                    type="date"
                    aria-label="Дата конца основного диапазона"
                    value={filters.rangeEnd}
                    onChange={(event) => patchFilters({ rangeEnd: event.target.value })}
                    onInput={(event) => patchFilters({ rangeEnd: event.currentTarget.value })}
                    className="field"
                  />
                </div>
              </div>
              <MultiSelectField
                label="Менеджер / команда"
                placeholder="Поиск менеджера или команды"
                emptyLabel={managerFilterEmptyLabel}
                options={managerScopeOptions}
                selected={filters.managers}
                onToggle={toggleManagerFilterValue}
                summary={managerFilterSummary}
                isOptionSelected={(option) =>
                  isManagerScopeOptionSelected(
                    option.id,
                    filters.managers,
                    runtimeData.managerWhitelistSettings,
                  )
                }
              />
              <MultiSelectField
                label="Источники"
                placeholder="Поиск источника"
                emptyLabel="Все источники"
                options={availableSourceOptions}
                selected={filters.sources}
                onToggle={(value) => toggleFilterValue('sources', value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost h-[42px] whitespace-nowrap px-4"
                  onClick={addCompareRange}
                  disabled={filters.compareRanges.length >= 5}
                >
                  + Сравнение
                </button>
                <button
                  type="button"
                  className={cn(
                    'btn btn-primary h-[42px] min-w-[168px] whitespace-nowrap px-5',
                    isReportLoading && 'btn-loading',
                  )}
                  onClick={applyFilters}
                  disabled={isReportLoading}
                  aria-busy={isReportLoading}
                >
                  {isReportLoading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      <span>Загружаю</span>
                    </>
                  ) : (
                    'Применить фильтры'
                  )}
                </button>
              </div>
            </div>

            {filters.compareRanges.length > 0 ? (
              <div className="mt-3 max-w-[980px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="subtle-label">Периоды сравнения</div>
                    <div className="mt-1 text-sm text-slate-600">
                      До 5 окон сравнения, каждое можно удалить отдельно.
                    </div>
                  </div>
                  <span className="badge-chip badge-neutral">{filters.compareRanges.length}/5</span>
                </div>

                <div className="grid gap-3">
                  {filters.compareRanges.map((range, index) => (
                    <div
                      key={range.id}
                      className="grid max-w-[760px] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 xl:grid-cols-[92px_170px_170px_120px]"
                    >
                      <div className="flex items-center text-sm font-semibold text-slate-700">
                        Период {index + 1}
                      </div>
                      <input
                        type="date"
                        value={range.start}
                        onChange={(event) => updateCompareRange(range.id, { start: event.target.value })}
                        className="field"
                      />
                      <input
                        type="date"
                        value={range.end}
                        onChange={(event) => updateCompareRange(range.id, { end: event.target.value })}
                        className="field"
                      />
                      <button
                        type="button"
                        className="btn btn-ghost h-[42px] whitespace-nowrap px-3"
                        onClick={() => removeCompareRange(range.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-sm text-slate-500">
              Основной: {formatRangeLabel(filters.rangeStart, filters.rangeEnd)} | Сравнение:{' '}
              {summarizeCompareRanges(filters.compareRanges)} | Менеджеры:{' '}
              {managerFilterSummary} | Источники:{' '}
              {summarizeSelection(filters.sources, availableSourceOptions, 'все')}
            </p>
            {isReportLoading ? (
              <div
                className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"
                role="status"
                aria-live="polite"
              >
                <span className="btn-spinner" aria-hidden="true" />
                <span>
                  Загружаю данные за {formatRangeLabel(appliedFilters.rangeStart, appliedFilters.rangeEnd)}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {isLeadgenModule ? (
          <LeadgenDashboard
            report={leadgenReport}
            workload={visibleLeadgenWorkload}
            reportStatus={leadgenReportStatus}
            reportError={leadgenReportError}
            workloadStatus={leadgenWorkloadStatus}
            workloadError={leadgenWorkloadError}
            filters={appliedFilters}
            commentMode={commentMode}
            activeReportId={leadgenActiveReportId}
            onActiveReportChange={setLeadgenActiveReportId}
          />
        ) : (
          <>
            <section
              className="panel sticky top-3 z-20 flex flex-wrap gap-2 p-3"
              data-no-comment="true"
              aria-label="Аналитические дашборды"
            >
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => handleSceneNavigate(scene.id)}
                  className={cn('tab-chip', {
                    'tab-chip-active': activeScene.id === scene.id,
                  })}
                >
                  {scene.label}
                </button>
              ))}
            </section>

            {activeScene.id !== 'sales' && visibleSceneKpis.length > 0 ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {visibleSceneKpis.map((metric) => (
                  <div key={metric.label} className="metric p-4">
                    <p className="subtle-label">{metric.label}</p>
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <p className="text-xl font-bold text-slate-800">{metric.value}</p>
                      {metric.delta ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-1 text-[0.68rem] font-bold',
                            metric.deltaTone === 'negative' && 'bg-rose-50 text-rose-700',
                            metric.deltaTone === 'positive' && 'bg-emerald-50 text-emerald-700',
                            (!metric.deltaTone || metric.deltaTone === 'neutral') &&
                              'bg-slate-100 text-slate-600',
                          )}
                        >
                          {metric.delta}
                        </span>
                      ) : null}
                    </div>
                    {metric.note ? <p className="text-xs text-slate-500">{metric.note}</p> : null}
                    {metric.compare ? (
                      <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                        {metric.compare}
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : null}

            {activeRuntimeData.operationalError ? (
              <div
                role="alert"
                className="panel border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                {activeRuntimeData.operationalError}
              </div>
            ) : null}

            <Suspense fallback={<SceneLoadingFallback label={`Загружаю экран: ${activeScene.label}`} />}>
              <ActiveSceneComponent
                commentMode={commentMode}
                filters={appliedFilters}
                runtimeData={activeRuntimeData}
                salesPlanQuarter={salesPlanQuarter}
                salesPlanLoading={salesPlanLoading}
                salesPlanSaving={salesPlanSaving}
                salesPlanSaveError={salesPlanSaveError}
                onSalesPlanQuarterChange={setSalesPlanQuarter}
                onSalesPlanSave={handleSaveSalesPlan}
                pricingSettings={runtimeData.pricingSettings}
                pricingSettingsLoading={pricingSettingsLoading}
                pricingSettingsSaving={pricingSettingsSaving}
                pricingSettingsSaveError={pricingSettingsSaveError}
                onPricingSettingsSave={handleSavePricingSettings}
                operationalThresholdSettings={runtimeData.operationalThresholdSettings}
                operationalThresholdSettingsLoading={operationalThresholdSettingsLoading}
                operationalThresholdSettingsSaving={operationalThresholdSettingsSaving}
                operationalThresholdSettingsSaveError={
                  operationalThresholdSettingsSaveError
                }
                onOperationalThresholdSettingsSave={
                  handleSaveOperationalThresholdSettings
                }
                onSceneNavigate={handleSceneNavigate}
                conversionEventTypeSettings={runtimeData.conversionEventTypeSettings}
                conversionEventTypeSettingsLoading={conversionEventTypeSettingsLoading}
                conversionEventTypeSettingsSaving={conversionEventTypeSettingsSaving}
                conversionEventTypeSettingsSaveError={conversionEventTypeSettingsSaveError}
                onConversionEventTypeSettingsSave={handleSaveConversionEventTypeSettings}
              />
            </Suspense>
          </>
        )}
          </>
        )}

        <aside
          ref={commentPanelRef}
          className={cn(
            'panel fixed top-4 right-4 bottom-4 z-40 flex w-full max-w-xl flex-col gap-4 overflow-hidden p-5 transition-transform duration-200',
            commentsOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]',
          )}
          data-no-comment="true"
        >
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <div className="subtle-label">Комментарии модуля</div>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{sceneComments.length} заметок</h2>
              <p className="mt-1 text-sm text-slate-500">
                {updatedAt
                  ? `Последнее сохранение: ${formatDateTime(updatedAt)}`
                  : 'Заметок пока нет'}
              </p>
            </div>
            <span className="badge-chip badge-neutral">{commentsPanelStatusLabels[status]}</span>
          </div>

          {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
            data-comment-panel-body="true"
          >
            <div className="flex flex-col gap-4">
              <div className="panel w-full p-4">
                <div className="subtle-label">
                  {draftComment?.id ? 'Редактирование' : 'Новая заметка'}
                </div>
                {draftComment?.anchor ? (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Блок: <span className="font-semibold text-slate-800">{draftComment.anchor.blockLabel}</span>
                  </div>
                ) : null}
                <div className="mt-3">
                  <Textarea
                    value={draftComment?.text ?? ''}
                    onChange={(event) =>
                      setDraftComment((current) =>
                        current ? { ...current, text: event.target.value } : current,
                      )
                    }
                    placeholder="Комментарий к точке интерфейса..."
                    disabled={!draftComment || commentSavePending}
                    className="max-h-48 overflow-y-auto overscroll-contain"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleSaveComment()}
                    disabled={
                      !draftComment ||
                      draftComment.text.trim().length === 0 ||
                      commentSavePending
                    }
                    aria-busy={commentSavePending}
                  >
                    {commentSavePending ? 'Сохраняем...' : 'Сохранить'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={closeCommentDraft}
                    disabled={!draftComment || commentSavePending || commentReworkPending}
                  >
                    Отмена
                  </button>
                  {draftComment?.id && canArchiveComments ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() => void handleArchiveComment(draftComment.id!)}
                      disabled={commentSavePending || commentReworkPending}
                    >
                      В архив
                    </button>
                  ) : null}
                  {draftComment?.id &&
                  activeDraftStoredComment?.paperclipSyncStatus === 'failed' &&
                  !activeDraftStoredComment.paperclipIssueId ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() => void handleRetryComment(draftComment.id!)}
                      disabled={commentSavePending || commentReworkPending}
                    >
                      Повторить
                    </button>
                  ) : null}
                </div>
                <DevelopmentReadyReport
                  report={draftComment?.paperclipReadyReport}
                  status={draftComment?.paperclipStatus}
                />
                {draftComment?.id &&
                canArchiveComments &&
                activeDraftStoredComment?.paperclipIssueId ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="subtle-label">Вернуть команде разработки</div>
                    <div className="mt-2">
                      <Textarea
                        value={reworkText}
                        onChange={(event) => setReworkText(event.target.value)}
                        placeholder="Комментарий к доработке..."
                        disabled={commentReworkPending}
                        className="min-h-40 max-h-64 overflow-y-auto overscroll-contain"
                      />
                    </div>
                    <div
                      className="sticky bottom-0 z-10 -mx-1 mt-3 flex bg-white/95 px-1 py-2 backdrop-blur"
                      data-rework-actions="true"
                    >
                      <button
                        className="btn btn-dark w-full sm:w-auto"
                        onClick={() => void handleReworkComment(draftComment.id!)}
                        disabled={reworkText.trim().length === 0 || commentReworkPending}
                        aria-busy={commentReworkPending}
                      >
                        {commentReworkPending ? 'Отправляем...' : 'На доработку'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                {sceneComments.length === 0 ? (
                  <div className="panel p-4 text-sm text-slate-500">
                    Включи `Comment mode` и кликни в любом месте страницы.
                  </div>
                ) : (
                  sceneComments.map((comment, index) => (
                    <button
                      key={comment.id}
                      type="button"
                      className={cn('panel grid grid-cols-[2rem_minmax(0,1fr)] gap-3 p-3 text-left', {
                        'border-blue-300': draftComment?.id === comment.id,
                      })}
                      onClick={() => openExistingComment(comment)}
                    >
                      <div className="grid aspect-square place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{comment.text}</div>
                        {comment.anchor ? (
                          <div className="mt-1 truncate text-xs text-slate-500">
                            Блок: {comment.anchor.blockLabel}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(comment.updatedAt)}</div>
                        {comment.paperclipStatus ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'badge-chip',
                                notificationClasses[comment.paperclipStatus],
                              )}
                            >
                              {notificationLabels[comment.paperclipStatus]}
                            </span>
                            {comment.paperclipSyncStatus === 'failed' ? (
                              <span className="text-xs text-red-600">
                                {comment.paperclipError
                                  ? formatDevelopmentTeamError(comment.paperclipError)
                                  : 'Команда разработки недоступна'}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

        </aside>

        {sceneComments.map((comment, index) => (
          <button
            key={comment.id}
            type="button"
            className={cn(
              'absolute z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-xs font-bold text-white shadow-lg',
              draftComment?.id === comment.id && 'bg-blue-600',
            )}
            style={{
              left: `${comment.x * 100}%`,
              top: `${comment.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(event) => {
              event.stopPropagation()
              openExistingComment(comment)
            }}
            aria-label={`Комментарий ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}

        {draftComment && draftComment.id === null ? (
          <div
            className="absolute z-30 h-6 w-6 rounded-full border-2 border-dashed border-blue-500"
            style={{
              left: `${draftComment.x * 100}%`,
              top: `${draftComment.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ) : null}
      </div>
    </main>
  )
}

export default ProtoApp
