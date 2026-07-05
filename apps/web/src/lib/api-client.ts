import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomesReportSnapshot,
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  AttractionOntologyResponse,
  CallAttributionPolicy,
  CallAnalysisAiEvaluation,
  CallAnalysisClassification,
  CallAnalysisClassificationType,
  CallAnalysisEmotionalBackground,
  CallAnalysisLookupResponse,
  CallAnalysisNarrativeScore,
  CallAnalysisNextStepQuality,
  CallAnalysisQueueCallType,
  CallAnalysisQueueItem,
  CallAnalysisQueueResponse,
  CallAnalysisQueueStatus,
  CallAnalysisResult,
  CallAnalysisRubricApplicability,
  CallAnalysisRubricApplicabilityLevel,
  CallAnalysisRunResponse,
  CallAnalysisScoreBlock,
  CallAnalysisTranscriptRole,
  CallAnalysisTranscriptSegment,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionQuery,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  ConversionEventsReport,
  ConversionEventsReportSnapshot,
  DashboardQuery,
  DashboardData,
  DashboardDataSnapshot,
  DealLifecycleCard,
  DealLifecycleStageTimelineEntry,
  DealPricingSettings,
  DealPricingSettingsInput,
  DealSaleCostRow,
  DealSaleCostSourceSystem,
  DealSaleEconomics,
  DealSaleRevenueMode,
  DealTimelineEvent,
  DealTimelineEventKind,
  HourlyWeekdayWorkloadHeatmap,
  LeadgenFunnelReport,
  ManagerWhitelistSettingsData,
  ManagerWhitelistSettingsInput,
  ManagerActionOutcomeDealSlaStatus,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeReportSnapshot,
  MetaResponse,
  OntologyConcept,
  OntologyDriftItem,
  OntologyReportBinding,
  OntologySourceRef,
  OntologySourceDocumentResponse,
  OntologyStatus,
  OntologyTransition,
  ReportComparison,
  ReportRange,
  RevenueVelocityActionSummary,
  RevenueVelocityDimension,
  RevenueVelocityFormulaBreakdown,
  RevenueVelocityMoneyPerAction,
  RevenueVelocityQuery,
  RevenueVelocityReport,
  RevenueVelocityReportSnapshot,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
  SourceCohortConversionReport,
  SourceCohortConversionReportSnapshot,
  SourceQualityConversionReport,
  SourceQualityConversionReportSnapshot,
  SnapshotStats,
  SyncChangeSummary,
  SyncProgressEvent,
  SyncRunHistoryResponse,
  SyncSummary,
  TargetGroupConversionReport,
  TargetGroupConversionReportSnapshot,
  TocFlowReport,
  TocFlowReportSnapshot,
  TocStageDistribution,
  UnitEconomicsCalculationMethod,
  UnitEconomicsCostBehavior,
  UnitEconomicsCostConfidence,
  UnitEconomicsCostRulesInput,
  UnitEconomicsPnlLevel,
  UnitEconomicsQuery,
  UnitEconomicsReport,
  UnitEconomicsReportSnapshot,
  UnitEconomicsSettings,
  WorkloadHeatmapBasis,
  WorkloadHeatmapBasisInfo,
  WorkloadHeatmapSegmentKey,
  WorkloadHeatmapWeekday,
} from '@/lib/dashboard-types'
import type {
  AuthModule,
  AuthUser,
  CommentNotification,
  CommentStore,
  ModulePermission,
  ModuleRole,
  ModuleUser,
  PaperclipCommentStatus,
  PaperclipSyncStatus,
  PaperclipThreadEntryKind,
  PlatformAccess,
  PlatformMembershipInput,
  PlatformModule,
  PlatformUser,
  ProtoComment,
  ProtoCommentAnchor,
  ProtoCommentContext,
} from '@/proto/types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

class ApiClientError extends Error {
  readonly status: number | undefined
  readonly payload: unknown

  constructor(message: string, status?: number, payload?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.payload = payload
  }
}

interface AuthResponse {
  user: AuthUser
  csrfToken: string
}

let csrfToken: string | null = null
const unauthorizedListeners = new Set<() => void>()

function buildUrl(
  pathname: string,
  params?: Record<string, string | number | string[] | undefined>,
) {
  const url = new URL(`${API_BASE_URL}${pathname}`, window.location.origin)

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue
    }

    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return API_BASE_URL ? url.toString() : `${url.pathname}${url.search}`
}

function buildModulePath(moduleId: string | undefined, legacyPath: string) {
  const normalizedModuleId = moduleId?.trim() || 'attraction'
  if (normalizedModuleId === 'attraction') {
    return legacyPath
  }

  return `/api/modules/${encodeURIComponent(normalizedModuleId)}${legacyPath.replace(
    /^\/api/,
    '',
  )}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asArray<T>(value: unknown, mapper: (input: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapper) : []
}

const WORKLOAD_HEATMAP_HOURS = Array.from({ length: 13 }, (_, index) => index + 9)
const WORKLOAD_HEATMAP_WEEKDAYS: Array<{
  weekday: WorkloadHeatmapWeekday
  label: string
}> = [
  { weekday: 1, label: 'Пн' },
  { weekday: 2, label: 'Вт' },
  { weekday: 3, label: 'Ср' },
  { weekday: 4, label: 'Чт' },
  { weekday: 5, label: 'Пт' },
  { weekday: 6, label: 'Сб' },
  { weekday: 7, label: 'Вс' },
]
const WORKLOAD_HEATMAP_BASIS_LABELS: Record<WorkloadHeatmapBasis, string> = {
  outgoing_calls: 'Исходящие звонки',
  tasks: 'Задачи',
  created_tasks: 'Созданные задачи',
  closed_tasks: 'Закрытые задачи',
  meetings: 'Встречи',
}
const WORKLOAD_HEATMAP_SEGMENT_LABELS: Record<WorkloadHeatmapSegmentKey, string> = {
  ...WORKLOAD_HEATMAP_BASIS_LABELS,
  successful_outgoing_calls: 'Успешные >30 сек',
  other_outgoing_calls: 'Прочие исходящие',
  no_answer_outgoing_calls: 'Недозвоны',
  meeting_slot_1: 'Встреча 1',
  meeting_slot_2: 'Встреча 2',
  meeting_slot_3: 'Встреча 3',
}
const OUTGOING_CALLS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: 'outgoing_calls',
  label: WORKLOAD_HEATMAP_BASIS_LABELS.outgoing_calls,
}
const TASKS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: 'tasks',
  label: WORKLOAD_HEATMAP_BASIS_LABELS.tasks,
}
const CREATED_TASKS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: 'created_tasks',
  label: WORKLOAD_HEATMAP_BASIS_LABELS.created_tasks,
}
const CLOSED_TASKS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: 'closed_tasks',
  label: WORKLOAD_HEATMAP_BASIS_LABELS.closed_tasks,
}
const MEETINGS_HEATMAP_BASIS: WorkloadHeatmapBasisInfo = {
  key: 'meetings',
  label: WORKLOAD_HEATMAP_BASIS_LABELS.meetings,
}

function normalizeWorkloadHeatmapWeekday(value: unknown): WorkloadHeatmapWeekday {
  const weekday = asNumber(value, 1)
  return weekday >= 1 && weekday <= 7
    ? (Math.trunc(weekday) as WorkloadHeatmapWeekday)
    : 1
}

function normalizeWorkloadHeatmapSegment(value: unknown) {
  const item = isRecord(value) ? value : {}
  const key = asString(item.key) as WorkloadHeatmapSegmentKey
  const fallbackLabel = WORKLOAD_HEATMAP_SEGMENT_LABELS[key] ?? key

  return {
    key,
    label: asString(item.label, fallbackLabel),
    count: asNumber(item.count),
    intensity: asNumber(item.intensity),
  }
}

function normalizeHourlyWeekdayWorkloadHeatmapCell(value: unknown) {
  const item = isRecord(value) ? value : {}
  const weekday = normalizeWorkloadHeatmapWeekday(item.weekday)
  const segments = asArray(item.segments, normalizeWorkloadHeatmapSegment)

  const cell = {
    weekday,
    weekdayLabel: asString(
      item.weekdayLabel,
      WORKLOAD_HEATMAP_WEEKDAYS.find((column) => column.weekday === weekday)?.label ??
        '',
    ),
    hour: asNumber(item.hour),
    count: asNumber(item.count),
    intensity: asNumber(item.intensity),
  }

  return segments.length > 0 ? { ...cell, segments } : cell
}

function normalizeWorkloadHeatmapBasis(
  value: unknown,
  fallback: WorkloadHeatmapBasisInfo,
): WorkloadHeatmapBasisInfo {
  const item = isRecord(value) ? value : {}
  const key = asString(item.key) as WorkloadHeatmapBasis

  if (key in WORKLOAD_HEATMAP_BASIS_LABELS) {
    return {
      key,
      label: asString(item.label, WORKLOAD_HEATMAP_BASIS_LABELS[key]),
    }
  }

  return { ...fallback }
}

function createEmptyHourlyWeekdayWorkloadHeatmap(
  basis: WorkloadHeatmapBasisInfo,
): HourlyWeekdayWorkloadHeatmap {
  return {
    basis: { ...basis },
    hours: [...WORKLOAD_HEATMAP_HOURS],
    weekdays: WORKLOAD_HEATMAP_WEEKDAYS.map((column) => ({ ...column })),
    cells: WORKLOAD_HEATMAP_HOURS.flatMap((hour) =>
      WORKLOAD_HEATMAP_WEEKDAYS.map((column) => ({
        weekday: column.weekday,
        weekdayLabel: column.label,
        hour,
        count: 0,
        intensity: 0,
      })),
    ),
    total: 0,
    gridTotal: 0,
    outsideGridTotal: 0,
    peak: null,
  }
}

function normalizeHourlyWeekdayWorkloadHeatmap(
  value: unknown,
  basisFallback: WorkloadHeatmapBasisInfo,
): HourlyWeekdayWorkloadHeatmap {
  if (!isRecord(value)) {
    return createEmptyHourlyWeekdayWorkloadHeatmap(basisFallback)
  }

  const peak = isRecord(value.peak)
    ? normalizeHourlyWeekdayWorkloadHeatmapCell(value.peak)
    : null
  const cells = asArray(value.cells, normalizeHourlyWeekdayWorkloadHeatmapCell)
  const computedGridTotal = cells.reduce((sum, cell) => sum + cell.count, 0)
  const gridTotal = asNumber(value.gridTotal, computedGridTotal)
  const total = asNumber(value.total, gridTotal)

  return {
    basis: normalizeWorkloadHeatmapBasis(value.basis, basisFallback),
    hours: asArray(value.hours, (hour) => asNumber(hour)),
    weekdays: asArray(value.weekdays, (weekdayColumn) => {
      const column = isRecord(weekdayColumn) ? weekdayColumn : {}
      const weekday = normalizeWorkloadHeatmapWeekday(column.weekday)

      return {
        weekday,
        label: asString(
          column.label,
          WORKLOAD_HEATMAP_WEEKDAYS.find((item) => item.weekday === weekday)?.label ??
            '',
        ),
      }
    }),
    cells,
    total,
    gridTotal,
    outsideGridTotal: asNumber(value.outsideGridTotal, Math.max(0, total - gridTotal)),
    peak,
  }
}

function normalizeCallAttributionPolicy(value: unknown): CallAttributionPolicy | undefined {
  const policy = asString(value)
  return policy === 'standard' || policy === 'direct_only' ? policy : undefined
}

function normalizeDealCallSummary(value: unknown) {
  const calls = isRecord(value) ? value : {}
  return {
    total: asNumber(calls.total),
    incoming: asNumber(calls.incoming),
    outgoing: asNumber(calls.outgoing),
    successful: asNumber(calls.successful),
    failed: asNumber(calls.failed),
    overThirtySeconds: asNumber(calls.overThirtySeconds),
    connectedOverThirtySeconds: asNumber(calls.connectedOverThirtySeconds),
  }
}

function normalizeDealTaskSummary(value: unknown) {
  const tasks = isRecord(value) ? value : {}
  return {
    created: asNumber(tasks.created),
    closed: asNumber(tasks.closed),
  }
}

function normalizeDealMeetingSummary(value: unknown) {
  const meetings = isRecord(value) ? value : {}
  return {
    total: asNumber(meetings.total),
  }
}

function normalizeMeetingSlotIndex(value: unknown): 1 | 2 | 3 | null {
  return value === 1 || value === 2 || value === 3 ? value : null
}

function normalizeDealMeetingEvents(value: unknown) {
  return asArray(value, (event) => {
    const eventRow = isRecord(event) ? event : {}
    const slotIndex = normalizeMeetingSlotIndex(eventRow.slotIndex)
    return {
      activityId: asString(eventRow.activityId),
      createdAt: asString(eventRow.createdAt),
      timelineAt: asString(eventRow.timelineAt, asString(eventRow.createdAt)),
      scheduledAt: asString(eventRow.scheduledAt),
      completed: Boolean(eventRow.completed),
      slotIndex,
      typeValue: asNullableString(eventRow.typeValue),
      placeValue: asNullableString(eventRow.placeValue),
      calendarValue: asNullableString(eventRow.calendarValue),
      eventId: asNullableString(eventRow.eventId),
    }
  })
}

function normalizeManagerActionDealSlaStatus(
  value: unknown,
): ManagerActionOutcomeDealSlaStatus {
  return value === 'onTime' || value === 'late' || value === 'noTouch'
    ? value
    : 'noTouch'
}

function normalizeManagerActionDealSla(value: unknown) {
  const sla = isRecord(value) ? value : {}
  const normalizeOne = (entry: unknown) => {
    const item = isRecord(entry) ? entry : {}
    return {
      status: normalizeManagerActionDealSlaStatus(item.status),
      hours:
        typeof item.hours === 'number' && Number.isFinite(item.hours)
          ? item.hours
          : null,
    }
  }
  return {
    sla1: normalizeOne(sla.sla1),
    sla2: normalizeOne(sla.sla2),
    sla3: normalizeOne(sla.sla3),
  }
}

function normalizeDealStageTimeline(value: unknown) {
  return asArray(value, (stage) => {
    const stageRow = isRecord(stage) ? stage : {}
    return {
      stageId: asString(stageRow.stageId),
      stageName: asString(stageRow.stageName, asString(stageRow.stageId)),
      enteredAt: asString(stageRow.enteredAt),
      leftAt: asString(stageRow.leftAt),
      durationHours: asNumber(stageRow.durationHours),
      callSummary: normalizeDealCallSummary(stageRow.callSummary),
      taskSummary: normalizeDealTaskSummary(stageRow.taskSummary),
      meetingEvents: normalizeDealMeetingEvents(stageRow.meetingEvents),
    }
  })
}

function normalizeDealTimelineEventKind(value: unknown): DealTimelineEventKind {
  return value === 'call' ||
    value === 'task_created' ||
    value === 'task_completed' ||
    value === 'meeting' ||
    value === 'meeting_date_changed' ||
    value === 'conversion_event_visit'
    ? value
    : 'meeting'
}

function normalizeDealTimelineEvent(value: unknown): DealTimelineEvent {
  const event = isRecord(value) ? value : {}
  const linkConfidence: DealTimelineEvent['linkConfidence'] =
    event.linkConfidence === 'high' ||
    event.linkConfidence === 'medium' ||
    event.linkConfidence === 'low'
      ? event.linkConfidence
      : 'low'

  return {
    id: asString(event.id),
    kind: normalizeDealTimelineEventKind(event.kind),
    occurredAt: asString(event.occurredAt),
    stageId: asNullableString(event.stageId),
    stageName: asNullableString(event.stageName),
    title: asString(event.title),
    detail: asNullableString(event.detail),
    badgeLabel: asNullableString(event.badgeLabel),
    linkConfidence,
  }
}

function normalizeDealSaleCostRow(value: unknown): DealSaleCostRow {
  const row = isRecord(value) ? value : {}
  const sourceSystem: DealSaleCostSourceSystem =
    row.sourceSystem === 'fact' ? 'fact' : 'rule'
  const confidence: DealSaleCostRow['confidence'] =
    row.confidence === 'confirmed' ||
    row.confidence === 'imported' ||
    row.confidence === 'manual' ||
    row.confidence === 'inferred' ||
    row.confidence === 'needs_review' ||
    row.confidence === 'conflicting'
      ? row.confidence
      : 'inferred'
  const articleId = asString(row.articleId)
  const label = asString(row.label, articleId)
  const amount = asNumber(row.amount)
  const basis = asString(row.basis)

  return {
    id: asString(
      row.id,
      `${sourceSystem}:${articleId}:${label}:${basis}:${confidence}:${amount}`,
    ),
    articleId,
    label,
    amount,
    basis,
    sourceSystem,
    confidence,
  }
}

function normalizeDealSaleEconomics(value: unknown): DealSaleEconomics {
  const economics = isRecord(value) ? value : {}
  const revenueMode: DealSaleRevenueMode =
    economics.revenueMode === 'actual' ||
    economics.revenueMode === 'planned' ||
    economics.revenueMode === 'none'
      ? economics.revenueMode
      : 'none'
  const saleCostAmount = asNumber(economics.saleCostAmount)
  const allocatedFixedCostAmount = asNumber(economics.allocatedFixedCostAmount)
  const fullyLoadedCostAmount = asNumber(
    economics.fullyLoadedCostAmount,
    saleCostAmount + allocatedFixedCostAmount,
  )

  return {
    revenueMode,
    attractionRevenueAmount: asNullableNumber(economics.attractionRevenueAmount),
    membershipAmount: asNumber(economics.membershipAmount),
    saleCostAmount,
    marginAmount: asNullableNumber(economics.marginAmount),
    allocatedFixedCostAmount,
    fullyLoadedCostAmount,
    fullyLoadedMarginAmount: asNullableNumber(economics.fullyLoadedMarginAmount),
    costRows: asArray(economics.costRows, normalizeDealSaleCostRow),
    allocatedFixedCostRows: asArray(
      economics.allocatedFixedCostRows,
      normalizeDealSaleCostRow,
    ),
  }
}

function normalizeDealEventSummary(value: unknown) {
  const summary = isRecord(value) ? value : {}
  return {
    callSummary: normalizeDealCallSummary(summary.callSummary),
    taskSummary: normalizeDealTaskSummary(summary.taskSummary),
    meetingSummary: normalizeDealMeetingSummary(summary.meetingSummary),
    conversionEventVisits: asNumber(summary.conversionEventVisits),
  }
}

function normalizeDealLifecycleStageTimeline(
  value: unknown,
): DealLifecycleStageTimelineEntry[] {
  return asArray(value, (stage) => {
    const stageRow = isRecord(stage) ? stage : {}
    const baseStage = normalizeDealStageTimeline([stageRow])[0] ?? {
      stageId: '',
      stageName: '',
      enteredAt: '',
      leftAt: '',
      durationHours: 0,
      callSummary: normalizeDealCallSummary(undefined),
      taskSummary: normalizeDealTaskSummary(undefined),
      meetingEvents: [],
    }

    return {
      ...baseStage,
      callSummary: normalizeDealCallSummary(stageRow.callSummary),
      taskSummary: normalizeDealTaskSummary(stageRow.taskSummary),
      meetingEvents: normalizeDealMeetingEvents(stageRow.meetingEvents),
      events: asArray(stageRow.events, normalizeDealTimelineEvent),
    }
  })
}

function normalizeOptionalDealLifecycleCard(value: unknown): DealLifecycleCard | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const status =
    value.status === 'won' || value.status === 'lost' || value.status === 'wip'
      ? value.status
      : 'wip'
  const card: DealLifecycleCard = {
    dealId: asString(value.dealId),
    managerId: asString(value.managerId),
    managerName: asString(value.managerName, asString(value.managerId)),
    status,
    stageId: asString(value.stageId),
    stageName: asString(value.stageName, asString(value.stageId)),
    dateCreate: asString(value.dateCreate),
    dateClosed: asNullableString(value.dateClosed),
    dateModify: asString(value.dateModify),
    cycleDays: asNullableNumber(value.cycleDays),
    sourceKey: asString(value.sourceKey),
    sourceLabel: asString(value.sourceLabel, asString(value.sourceKey)),
    qualityValue: asNullableString(value.qualityValue),
    businessClubValue: asNullableString(value.businessClubValue),
    targetGroupValue: asNullableString(value.targetGroupValue),
    meetingTypeValue: asNullableString(value.meetingTypeValue),
    meetingDateValue: asNullableString(value.meetingDateValue),
    tariffValue: asNullableString(value.tariffValue),
    economics: normalizeDealSaleEconomics(value.economics),
    eventSummary: normalizeDealEventSummary(value.eventSummary),
    stageTimeline: normalizeDealLifecycleStageTimeline(value.stageTimeline),
  }

  if (isRecord(value.cohortContext)) {
    card.cohortContext = {
      createdMonth: asString(value.cohortContext.createdMonth),
      cohortCreatedDeals: asNumber(value.cohortContext.cohortCreatedDeals),
      cohortWonDeals: asNumber(value.cohortContext.cohortWonDeals),
      cohortWonConversionRate: asNumber(
        value.cohortContext.cohortWonConversionRate,
      ),
    }
  }

  if (isRecord(value.sla)) {
    card.sla = normalizeManagerActionDealSla(value.sla)
  }

  return card
}

function isMutatingMethod(method: string | undefined) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (method ?? 'GET').toUpperCase(),
  )
}

function normalizeAuthResponse(value: unknown): AuthResponse {
  const data = isRecord(value) ? value : {}
  const user = isRecord(data.user) ? data.user : {}

  return {
    user: {
      id: asNumber(user.id),
      login: asString(user.login),
      firstName: asNullableString(user.firstName),
      lastName: asNullableString(user.lastName),
      role: 'admin',
      isSuperAdmin: asBoolean(user.isSuperAdmin),
      modules: asArray(user.modules, normalizeAuthModule).filter(
        (module) => module.id && module.slug,
      ),
    },
    csrfToken: asString(data.csrfToken),
  }
}

function normalizeModuleRole(value: unknown): ModuleRole {
  return value === 'leader' ? 'leader' : 'employee'
}

function normalizeModulePermission(value: unknown): ModulePermission | null {
  return value === 'comments:create' ||
    value === 'comments:update' ||
    value === 'comments:archive' ||
    value === 'module-users:manage'
    ? value
    : null
}

function normalizeAuthModule(value: unknown): AuthModule {
  const data = isRecord(value) ? value : {}
  return {
    id: asString(data.id),
    slug: asString(data.slug),
    name: asString(data.name),
    role: normalizeModuleRole(data.role),
    permissions: asArray(data.permissions, normalizeModulePermission).filter(
      (permission): permission is ModulePermission => Boolean(permission),
    ),
    bitrixCategoryId: asNullableString(data.bitrixCategoryId),
    paperclipCompanyId: asNullableString(data.paperclipCompanyId),
    paperclipProjectId: asNullableString(data.paperclipProjectId),
    paperclipGoalId: asNullableString(data.paperclipGoalId),
    paperclipTriageAgentId: asNullableString(data.paperclipTriageAgentId),
    defaultManagerId: asNullableString(data.defaultManagerId),
  }
}

function normalizePaperclipCommentStatus(value: unknown): PaperclipCommentStatus {
  return value === 'sent' ||
    value === 'in_work' ||
    value === 'needs_input' ||
    value === 'done' ||
    value === 'failed'
    ? value
    : 'queued'
}

function normalizePaperclipSyncStatus(value: unknown): PaperclipSyncStatus {
  return value === 'syncing' || value === 'sent' || value === 'failed'
    ? value
    : 'queued'
}

function normalizeProtoCommentContext(value: unknown): ProtoCommentContext | undefined {
  return isRecord(value) ? value : undefined
}

function normalizeProtoCommentAnchor(value: unknown): ProtoCommentAnchor | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const blockId = asString(value.blockId)
  const blockLabel = asString(value.blockLabel)
  const blockSelector = asString(value.blockSelector)
  const elementSelector = asString(value.elementSelector)

  if (!blockId || !blockLabel || !blockSelector || !elementSelector) {
    return undefined
  }

  return {
    blockId,
    blockLabel,
    blockSelector,
    blockRole: asNullableString(value.blockRole),
    elementSelector,
    elementLabel: asString(value.elementLabel),
    relativeX: asNumber(value.relativeX),
    relativeY: asNumber(value.relativeY),
  }
}

function normalizePaperclipReadyReport(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const body = asString(value.body)
  const createdAt = asString(value.createdAt)
  if (!id || !body || !createdAt) {
    return null
  }

  return {
    id,
    body,
    authorAgentId: asNullableString(value.authorAgentId),
    authorUserId: asNullableString(value.authorUserId),
    createdAt,
    updatedAt: asString(value.updatedAt) || createdAt,
  }
}

function normalizePaperclipThreadEntryKind(value: unknown): PaperclipThreadEntryKind {
  return value === 'dashboard_rework' ||
    value === 'board_note' ||
    value === 'system_note' ||
    value === 'development_report'
    ? value
    : 'system_note'
}

function normalizePaperclipThreadEntry(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const body = asString(value.body)
  const createdAt = asString(value.createdAt)
  if (!id || !body || !createdAt) {
    return null
  }

  return {
    id,
    kind: normalizePaperclipThreadEntryKind(value.kind),
    body,
    authorAgentId: asNullableString(value.authorAgentId),
    authorUserId: asNullableString(value.authorUserId),
    createdAt,
    updatedAt: asString(value.updatedAt) || createdAt,
  }
}

function normalizePaperclipThread(value: unknown) {
  return asArray(value, normalizePaperclipThreadEntry).filter((entry) => entry !== null)
}

function normalizeProtoComment(value: unknown): ProtoComment {
  const data = isRecord(value) ? value : {}
  const anchor = normalizeProtoCommentAnchor(data.anchor)

  const comment: ProtoComment = {
    id: asString(data.id),
    moduleId: asString(data.moduleId),
    authorUserId: asNullableNumber(data.authorUserId),
    authorLogin: asNullableString(data.authorLogin),
    sceneId: asString(data.sceneId),
    x: asNumber(data.x),
    y: asNumber(data.y),
    text: asString(data.text),
    status: data.status === 'archived' ? 'archived' : 'open',
    archivedAt: asNullableString(data.archivedAt),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
    paperclipIssueId: asNullableString(data.paperclipIssueId),
    paperclipIssueIdentifier: asNullableString(data.paperclipIssueIdentifier),
    paperclipStatus: normalizePaperclipCommentStatus(data.paperclipStatus),
    paperclipSyncStatus: normalizePaperclipSyncStatus(data.paperclipSyncStatus),
    paperclipError: asNullableString(data.paperclipError),
    paperclipLastSyncedAt: asNullableString(data.paperclipLastSyncedAt),
    paperclipRetryCount: asNumber(data.paperclipRetryCount),
    paperclipReadyReport: normalizePaperclipReadyReport(data.paperclipReadyReport),
    paperclipThread: normalizePaperclipThread(data.paperclipThread),
  }

  const context = normalizeProtoCommentContext(data.context)

  return {
    ...comment,
    ...(anchor ? { anchor } : {}),
    ...(context ? { context } : {}),
  }
}

function normalizeCommentStore(value: unknown): CommentStore {
  const data = isRecord(value) ? value : {}

  return {
    comments: asArray(data.comments, normalizeProtoComment).filter(
      (comment) => comment.id && comment.sceneId,
    ),
    updatedAt: asNullableString(data.updatedAt),
  }
}

function normalizeCommentResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    comment: normalizeProtoComment(data.comment),
  }
}

function normalizeCommentNotification(value: unknown): CommentNotification {
  const data = isRecord(value) ? value : {}
  return {
    id: asString(data.id),
    sceneId: asString(data.sceneId),
    text: asString(data.text),
    status: normalizePaperclipCommentStatus(data.status),
    paperclipSyncStatus: normalizePaperclipSyncStatus(data.paperclipSyncStatus),
    paperclipIssueIdentifier: asNullableString(data.paperclipIssueIdentifier),
    paperclipError: asNullableString(data.paperclipError),
    paperclipReadyReport: normalizePaperclipReadyReport(data.paperclipReadyReport),
    paperclipThread: normalizePaperclipThread(data.paperclipThread),
    updatedAt: asString(data.updatedAt),
  }
}

function normalizeCommentNotificationsResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    notifications: asArray(data.notifications, normalizeCommentNotification).filter(
      (notification) => notification.id,
    ),
  }
}

function normalizeModuleUser(value: unknown): ModuleUser {
  const data = isRecord(value) ? value : {}
  return {
    id: asNumber(data.id),
    login: asString(data.login),
    firstName: asNullableString(data.firstName),
    lastName: asNullableString(data.lastName),
    disabled: asBoolean(data.disabled),
    moduleId: asString(data.moduleId),
    moduleRole: normalizeModuleRole(data.moduleRole),
    membershipStatus: data.membershipStatus === 'disabled' ? 'disabled' : 'active',
    defaultManagerId: asNullableString(data.defaultManagerId),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
  }
}

function normalizeModuleUsersResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    users: asArray(data.users, normalizeModuleUser).filter((user) => user.id > 0),
  }
}

function normalizeModuleUserResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    user: normalizeModuleUser(data.user),
  }
}

function normalizePlatformModule(value: unknown): PlatformModule {
  const data = isRecord(value) ? value : {}
  return {
    id: asString(data.id),
    slug: asString(data.slug),
    name: asString(data.name),
    bitrixCategoryId: asNullableString(data.bitrixCategoryId),
    paperclipCompanyId: asNullableString(data.paperclipCompanyId),
    paperclipProjectId: asNullableString(data.paperclipProjectId),
    paperclipGoalId: asNullableString(data.paperclipGoalId),
    paperclipTriageAgentId: asNullableString(data.paperclipTriageAgentId),
  }
}

function normalizePlatformUser(value: unknown): PlatformUser {
  const data = isRecord(value) ? value : {}
  return {
    id: asNumber(data.id),
    login: asString(data.login),
    firstName: asNullableString(data.firstName),
    lastName: asNullableString(data.lastName),
    disabled: asBoolean(data.disabled),
    isSuperAdmin: asBoolean(data.isSuperAdmin),
    memberships: asArray(data.memberships, normalizeModuleUser).filter(
      (membership) => membership.id > 0 && membership.moduleId,
    ),
  }
}

function normalizePlatformAccessResponse(value: unknown): PlatformAccess {
  const data = isRecord(value) ? value : {}
  return {
    modules: asArray(data.modules, normalizePlatformModule).filter(
      (module) => module.id && module.slug,
    ),
    users: asArray(data.users, normalizePlatformUser).filter((user) => user.id > 0),
  }
}

function normalizePlatformUserResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    user: normalizePlatformUser(data.user),
  }
}

function setCsrfTokenFromResponse(response: AuthResponse) {
  csrfToken = response.csrfToken || null
  return response
}

function notifyUnauthorized() {
  csrfToken = null
  for (const listener of unauthorizedListeners) {
    listener()
  }
}

async function readErrorResponse(response: Response) {
  let message = 'Local API request failed'
  let payload: unknown = null

  try {
    payload = (await response.json()) as unknown
    if (isRecord(payload)) {
      message = asString(payload.code, asString(payload.error, message))
    }
  } catch {
    // Keep the stable fallback when the server did not return JSON.
  }

  return { message, payload }
}

function buildRequestInit(init: RequestInit) {
  const method = init.method ?? 'GET'
  const headers = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutatingMethod(method) && csrfToken
      ? { 'X-CSRF-Token': csrfToken }
      : {}),
    ...(init.headers ?? {}),
  }

  return {
    ...init,
    credentials: 'include' as const,
    headers,
  }
}

function normalizePricingStatus(value: unknown) {
  return value === 'missingContractFields' ||
    value === 'missingPricingRule' ||
    value === 'conflict'
    ? value
    : 'priced'
}

function normalizeRange(value: unknown): ReportRange {
  const data = isRecord(value) ? value : {}

  return {
    from: asString(data.from),
    to: asString(data.to),
  }
}

function normalizeCallAnalysisTranscriptRole(value: unknown): CallAnalysisTranscriptRole {
  return value === 'manager' || value === 'client' ? value : 'unknown'
}

function normalizeCallAnalysisNextStepQuality(
  value: unknown,
): CallAnalysisNextStepQuality {
  return value === 'good' ||
    value === 'ok' ||
    value === 'weak' ||
    value === 'missing'
    ? value
    : 'unknown'
}

function normalizeCallAnalysisClassificationType(
  value: unknown,
): CallAnalysisClassificationType {
  return value === 'primary_sales' ||
    value === 'qualification' ||
    value === 'follow_up' ||
    value === 'scheduling' ||
    value === 'inbound' ||
    value === 'failed_or_no_conversation'
    ? value
    : 'unknown'
}

function normalizeCallAnalysisRubricApplicabilityLevel(
  value: unknown,
): CallAnalysisRubricApplicabilityLevel {
  return value === 'high' ||
    value === 'medium' ||
    value === 'low' ||
    value === 'none'
    ? value
    : 'none'
}

function normalizeCallAnalysisTranscriptSegment(
  value: unknown,
): CallAnalysisTranscriptSegment {
  const data = isRecord(value) ? value : {}

  return {
    role: normalizeCallAnalysisTranscriptRole(data.role),
    start: asNumber(data.start),
    end: asNumber(data.end),
    text: asString(data.text),
  }
}

function normalizeCallAnalysisEmotionalBackground(
  value: unknown,
): CallAnalysisEmotionalBackground {
  const data = isRecord(value) ? value : {}

  return {
    managerTone: asString(data.managerTone),
    clientTone: asString(data.clientTone),
    frictionSignals: asArray(data.frictionSignals, (signal) => asString(signal)).filter(
      Boolean,
    ),
    confidence: asNumber(data.confidence),
  }
}

function normalizeCallAnalysisClassification(
  value: unknown,
): CallAnalysisClassification {
  const data = isRecord(value) ? value : {}

  return {
    type: normalizeCallAnalysisClassificationType(data.type),
    confidence: asNumber(data.confidence),
    reason: asString(data.reason),
  }
}

function normalizeCallAnalysisRubricApplicability(
  value: unknown,
): CallAnalysisRubricApplicability {
  const data = isRecord(value) ? value : {}

  return {
    level: normalizeCallAnalysisRubricApplicabilityLevel(data.level),
    reason: asString(data.reason),
  }
}

function normalizeCallAnalysisScoreBlock(value: unknown): CallAnalysisScoreBlock {
  const data = isRecord(value) ? value : {}

  return {
    score: asNumber(data.score),
    rationale: asString(data.rationale),
    evidenceQuotes: asArray(data.evidenceQuotes, (quote) => asString(quote)).filter(
      Boolean,
    ),
  }
}

function normalizeCallAnalysisNarrativeScore(
  value: unknown,
): CallAnalysisNarrativeScore {
  const scoreBlock = normalizeCallAnalysisScoreBlock(value)
  const data = isRecord(value) ? value : {}

  return {
    ...scoreBlock,
    applicableNarratives: asArray(
      data.applicableNarratives,
      (narrative) => asString(narrative),
    ).filter(Boolean),
    missedNarratives: asArray(
      data.missedNarratives,
      (narrative) => asString(narrative),
    ).filter(Boolean),
  }
}

function normalizeCallAnalysisAiEvaluation(value: unknown): CallAnalysisAiEvaluation {
  const data = isRecord(value) ? value : {}

  return {
    score: asNumber(data.score),
    callClassification: normalizeCallAnalysisClassification(data.callClassification),
    rubricApplicability: normalizeCallAnalysisRubricApplicability(
      data.rubricApplicability,
    ),
    communicationScore: normalizeCallAnalysisScoreBlock(data.communicationScore),
    narrativeScore: normalizeCallAnalysisNarrativeScore(data.narrativeScore),
    callTypeInterpretation: asString(data.callTypeInterpretation),
    summary: asString(data.summary),
    strengths: asArray(data.strengths, (strength) => asString(strength)).filter(Boolean),
    risks: asArray(data.risks, (risk) => asString(risk)).filter(Boolean),
    nextStepQuality: normalizeCallAnalysisNextStepQuality(data.nextStepQuality),
    suggestedNextStep: asString(data.suggestedNextStep),
    emotionalBackground: normalizeCallAnalysisEmotionalBackground(
      data.emotionalBackground,
    ),
    evidenceQuotes: asArray(data.evidenceQuotes, (quote) => asString(quote)).filter(
      Boolean,
    ),
    confidence: asNumber(data.confidence),
  }
}

function normalizeCallAnalysisResult(value: unknown): CallAnalysisResult {
  const data = isRecord(value) ? value : {}
  const attributes = isRecord(data.attributes) ? data.attributes : {}
  const rawAiEvaluation = isRecord(data.rawAiEvaluation)
    ? data.rawAiEvaluation
    : isRecord(data.aiEvaluation)
      ? data.aiEvaluation
      : {}

  return {
    callId: asString(data.callId),
    runId: asString(data.runId),
    status: 'ready',
    transcriptByRoles: asArray(
      data.transcriptByRoles,
      normalizeCallAnalysisTranscriptSegment,
    ),
    fullTranscriptText: asString(data.fullTranscriptText),
    aiEvaluation: normalizeCallAnalysisAiEvaluation(data.aiEvaluation),
    rawAiEvaluation: { ...rawAiEvaluation },
    attributes: { ...attributes },
    model: asString(data.model),
    promptVersion: asString(data.promptVersion),
    analyzedAt: asString(data.analyzedAt),
    updatedAt: asString(data.updatedAt),
  }
}

function normalizeCallAnalysisRunResponse(value: unknown): CallAnalysisRunResponse {
  const data = isRecord(value) ? value : {}

  return {
    status: 'ready',
    reusedExistingResult: asBoolean(data.reusedExistingResult),
    result: normalizeCallAnalysisResult(data.result),
  }
}

function normalizeCallAnalysisLookupResponse(
  value: unknown,
): CallAnalysisLookupResponse {
  const data = isRecord(value) ? value : {}

  return {
    status: 'ready',
    result: normalizeCallAnalysisResult(data.result),
  }
}

function normalizeCallAnalysisQueueStatus(value: unknown): CallAnalysisQueueStatus {
  return value === 'not_analyzed' ||
    value === 'analyzing' ||
    value === 'ready' ||
    value === 'error'
    ? value
    : 'not_analyzed'
}

function normalizeCallAnalysisQueueCallType(value: unknown): CallAnalysisQueueCallType {
  return value === 'outgoing_over_30' ||
    value === 'outgoing_under_30' ||
    value === 'incoming' ||
    value === 'unknown'
    ? value
    : 'unknown'
}

function normalizeCallAnalysisQueueItem(value: unknown): CallAnalysisQueueItem {
  const data = isRecord(value) ? value : {}

  return {
    callId: asString(data.callId),
    crmActivityId: asNullableString(data.crmActivityId),
    startedAt: asString(data.startedAt),
    managerId: asNullableString(data.managerId),
    managerName: asString(data.managerName, 'Не назначен'),
    callType: normalizeCallAnalysisQueueCallType(data.callType),
    callTypeLabel: asString(data.callTypeLabel),
    durationSeconds: asNumber(data.durationSeconds),
    dealId: asNullableString(data.dealId),
    dealSourceId: asNullableString(data.dealSourceId),
    dealCurrentStageId: asNullableString(data.dealCurrentStageId),
    dealCurrentStageName: asNullableString(data.dealCurrentStageName),
    stageAtCallId: asNullableString(data.stageAtCallId),
    stageAtCallName: asNullableString(data.stageAtCallName),
    analysisStatus: normalizeCallAnalysisQueueStatus(data.analysisStatus),
    score: asNullableNumber(data.score),
    promptVersion: asNullableString(data.promptVersion),
    model: asNullableString(data.model),
    analyzedAt: asNullableString(data.analyzedAt),
    updatedAt: asNullableString(data.updatedAt),
    errorCode: asNullableString(data.errorCode),
    errorMessage: asNullableString(data.errorMessage),
    bitrixUrl: asNullableString(data.bitrixUrl),
  }
}

function normalizeCallAnalysisQueueResponse(
  value: unknown,
): CallAnalysisQueueResponse {
  const data = isRecord(value) ? value : {}
  const totals = isRecord(data.totals) ? data.totals : {}

  return {
    range: normalizeRange(data.range),
    totals: {
      total: asNumber(totals.total),
      notAnalyzed: asNumber(totals.notAnalyzed),
      analyzing: asNumber(totals.analyzing),
      ready: asNumber(totals.ready),
      error: asNumber(totals.error),
      averageScore: asNullableNumber(totals.averageScore),
    },
    items: asArray(data.items, normalizeCallAnalysisQueueItem).filter(
      (item) => item.callId,
    ),
  }
}

function normalizeComparisons<TSnapshot>(
  value: unknown,
  normalizeSnapshot: (input: unknown) => TSnapshot,
): Array<ReportComparison<TSnapshot>> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => {
    const item = isRecord(entry) ? entry : {}

    return {
      compareIndex: asNumber(item.compareIndex),
      range: normalizeRange(item.range),
      snapshot: normalizeSnapshot(item.snapshot),
    }
  })
}

function normalizeDashboardSnapshot(value: unknown): DashboardDataSnapshot {
  const data = isRecord(value) ? value : {}
  const salesSummary = isRecord(data.salesSummary) ? data.salesSummary : {}

  return {
    salesSummary: {
      salesCount: asNumber(salesSummary.salesCount),
      salesAmount: asNumber(salesSummary.salesAmount),
      averageSaleAmount: asNumber(salesSummary.averageSaleAmount),
      attractionRevenueAmount: asNumber(
        salesSummary.attractionRevenueAmount,
        asNumber(salesSummary.salesAmount),
      ),
      averageAttractionRevenueAmount: asNumber(
        salesSummary.averageAttractionRevenueAmount,
        asNumber(salesSummary.averageSaleAmount),
      ),
      membershipAmount: asNumber(
        salesSummary.membershipAmount,
        asNumber(salesSummary.salesAmount),
      ),
      averageMembershipAmount: asNumber(
        salesSummary.averageMembershipAmount,
        asNumber(salesSummary.averageSaleAmount),
      ),
      pricingWarnings: asArray(salesSummary.pricingWarnings, (warning) =>
        asString(warning),
      ),
      newDealsCount: asNumber(salesSummary.newDealsCount),
      conversionRate: asNumber(salesSummary.conversionRate),
      meetingsCount: asNumber(salesSummary.meetingsCount),
    },
    managerGroups: asArray(data.managerGroups, (group) => {
      const item = isRecord(group) ? group : {}
      const totalWonDeals = asNumber(item.totalWonDeals)
      const totalSalesAmount = asNumber(item.totalSalesAmount)
      const totalAttractionRevenueAmount = asNumber(
        item.totalAttractionRevenueAmount,
        totalSalesAmount,
      )
      const totalMembershipAmount = asNumber(
        item.totalMembershipAmount,
        totalSalesAmount,
      )

      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalWonDeals,
        totalSalesAmount,
        totalAttractionRevenueAmount,
        averageAttractionRevenueAmount: asNumber(
          item.averageAttractionRevenueAmount,
          totalWonDeals === 0 ? 0 : totalAttractionRevenueAmount / totalWonDeals,
        ),
        totalMembershipAmount,
        averageMembershipAmount: asNumber(
          item.averageMembershipAmount,
          totalWonDeals === 0 ? 0 : totalMembershipAmount / totalWonDeals,
        ),
        deals: asArray(item.deals, (deal) => {
          const row = isRecord(deal) ? deal : {}
          const cohort = isRecord(row.cohortContext) ? row.cohortContext : {}
          const lifecycleCard = normalizeOptionalDealLifecycleCard(row.lifecycleCard)
          return {
            dealId: asString(row.dealId),
            dealTitle: asString(row.dealTitle, asString(row.dealId)),
            managerId: asString(row.managerId, asString(item.managerId)),
            managerName: asString(
              row.managerName,
              asString(item.managerName, asString(item.managerId)),
            ),
            amount: asNumber(row.amount),
            attractionRevenueAmount: asNullableNumber(
              row.attractionRevenueAmount,
            ),
            membershipAmount: asNumber(row.membershipAmount, asNumber(row.amount)),
            pricingStatus: normalizePricingStatus(row.pricingStatus),
            pricingWarnings: asArray(row.pricingWarnings, (warning) =>
              asString(warning),
            ),
            dateCreate: asString(row.dateCreate),
            dateClosed: asString(row.dateClosed),
            cycleDays: asNumber(row.cycleDays),
            sourceKey: asString(row.sourceKey, asString(row.sourceId)),
            sourceLabel: asString(
              row.sourceLabel,
              asString(row.sourceKey, asString(row.sourceId)),
            ),
            qualityValue: asNullableString(row.qualityValue),
            businessClubValue: asNullableString(row.businessClubValue),
            targetGroupValue: asNullableString(row.targetGroupValue),
            meetingTypeValue: asNullableString(row.meetingTypeValue),
            meetingDateValue: asNullableString(row.meetingDateValue),
            tariffValue: asNullableString(row.tariffValue),
            cohortContext: {
              createdMonth: asString(cohort.createdMonth),
              cohortCreatedDeals: asNumber(cohort.cohortCreatedDeals),
              cohortWonDeals: asNumber(cohort.cohortWonDeals),
              cohortWonConversionRate: asNumber(cohort.cohortWonConversionRate),
            },
            callSummary: normalizeDealCallSummary(row.callSummary),
            taskSummary: normalizeDealTaskSummary(row.taskSummary),
            meetingSummary: normalizeDealMeetingSummary(row.meetingSummary),
            stageTimeline: normalizeDealStageTimeline(row.stageTimeline),
            ...(lifecycleCard ? { lifecycleCard } : {}),
          }
        }),
      }
    }),
  }
}

function normalizeDashboard(value: unknown): DashboardData {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeDashboardSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeDashboardSnapshot),
  }
}

function normalizeSalesPlan(value: unknown): SalesPlanData {
  const data = isRecord(value) ? value : {}
  const periodStart = asString(data.periodStart)
  const periodEnd = asString(data.periodEnd)

  return {
    periodStart,
    periodEnd,
    updatedAt: asNullableString(data.updatedAt),
    rows: asArray(data.rows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      const targetGroupKey = asString(row.targetGroupKey)

      return {
        periodStart: asString(row.periodStart, periodStart),
        periodEnd: asString(row.periodEnd, periodEnd),
        managerId: asString(row.managerId),
        managerName: asNullableString(row.managerName),
        targetGroupKey,
        targetGroupLabel: asString(row.targetGroupLabel, targetGroupKey),
        plannedDeals: asNumber(row.plannedDeals),
        plannedAmount: asNumber(row.plannedAmount),
        updatedAt: asString(row.updatedAt, asString(data.updatedAt)),
      }
    }),
  }
}

function normalizeSalesPlanQuarter(value: unknown): SalesPlanQuarterData {
  const data = isRecord(value) ? value : {}
  const updatedAt = asNullableString(data.updatedAt)
  const months = asArray(data.months, (entry) => {
    const month = isRecord(entry) ? entry : {}
    return {
      month: asString(month.month),
      label: asString(month.label, asString(month.month)),
      periodStart: asString(month.periodStart),
      periodEnd: asString(month.periodEnd),
    }
  })

  return {
    year: asNumber(data.year),
    quarter: asNumber(data.quarter),
    periodStart: asString(data.periodStart),
    periodEnd: asString(data.periodEnd),
    months,
    rows: asArray(data.rows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      const targetGroupKey = asString(row.targetGroupKey)
      const rowUpdatedAt = asNullableString(row.updatedAt)
      return {
        managerId: asString(row.managerId),
        managerName: asNullableString(row.managerName),
        targetGroupKey,
        targetGroupLabel: asString(row.targetGroupLabel, targetGroupKey),
        quarterPlannedDeals: asNumber(row.quarterPlannedDeals),
        quarterPlannedAmount: asNumber(row.quarterPlannedAmount),
        months: asArray(row.months, (monthEntry) => {
          const month = isRecord(monthEntry) ? monthEntry : {}
          return {
            month: asString(month.month),
            periodStart: asString(month.periodStart),
            periodEnd: asString(month.periodEnd),
            plannedDeals: asNumber(month.plannedDeals),
            plannedAmount: asNumber(month.plannedAmount),
            updatedAt: asNullableString(month.updatedAt),
          }
        }),
        updatedAt: rowUpdatedAt ?? updatedAt,
      }
    }),
    updatedAt,
  }
}

function normalizePricingSettings(value: unknown): DealPricingSettings {
  const data = isRecord(value) ? value : {}

  return {
    updatedAt: asNullableString(data.updatedAt),
    rules: asArray(data.rules, (entry) => {
      const rule = isRecord(entry) ? entry : {}

      return {
        id: asString(rule.id),
        customerLabel: asString(rule.customerLabel),
        tariffLabel: asString(rule.tariffLabel),
        attractionRevenueAmount: asNumber(rule.attractionRevenueAmount),
        enabled: rule.enabled !== false,
        sortOrder: asNumber(rule.sortOrder),
        updatedAt: asNullableString(rule.updatedAt),
      }
    }),
  }
}

function normalizeConversionEventTypeSettings(
  value: unknown,
): ConversionEventTypeSettingsData {
  const data = isRecord(value) ? value : {}

  return {
    options: asArray(data.options, (entry) => {
      const option = isRecord(entry) ? entry : {}

      return {
        id: asString(option.id),
        title: asString(option.title, asString(option.id)),
        categoryId: asNullableNumber(option.categoryId),
        stageId: asNullableString(option.stageId),
        selectedForPlannedInventory: option.selectedForPlannedInventory === true,
      }
    }),
    settings: asArray(data.settings, (entry) => {
      const setting = isRecord(entry) ? entry : {}

      return {
        moduleKey: asString(setting.moduleKey, 'attraction'),
        eventTypeId: asString(setting.eventTypeId),
        eventTypeLabel: asString(setting.eventTypeLabel, asString(setting.eventTypeId)),
        enabled: setting.enabled !== false,
        updatedAt: asString(setting.updatedAt),
      }
    }),
  }
}

function normalizeManagerWhitelistSettings(value: unknown): ManagerWhitelistSettingsData {
  const data = isRecord(value) ? value : {}

  return {
    options: asArray(data.options, (entry) => {
      const option = isRecord(entry) ? entry : {}
      const callAttributionPolicy = normalizeCallAttributionPolicy(
        option.callAttributionPolicy,
      )

      return {
        id: asString(option.id),
        name: asString(option.name, asString(option.id)),
        ...(callAttributionPolicy ? { callAttributionPolicy } : {}),
      }
    }).filter((option) => option.id),
    settings: asArray(data.settings, (entry) => {
      const setting = isRecord(entry) ? entry : {}

      return {
        moduleKey: asString(setting.moduleKey, 'attraction'),
        managerId: asString(setting.managerId),
        managerName: asString(setting.managerName, asString(setting.managerId)),
        enabled: setting.enabled !== false,
        sortOrder: asNumber(setting.sortOrder),
        updatedAt: asString(setting.updatedAt),
        teamId: asNullableString(setting.teamId),
        teamName: asNullableString(setting.teamName),
      }
    }).filter((setting) => setting.managerId),
    teams: asArray(data.teams, (entry) => {
      const team = isRecord(entry) ? entry : {}

      return {
        id: asString(team.id),
        name: asString(team.name, asString(team.id)),
        managerIds: asArray(team.managerIds, (managerId) => asString(managerId)).filter(Boolean),
        sortOrder: asNumber(team.sortOrder),
        updatedAt: asString(team.updatedAt),
      }
    }).filter((team) => team.id && team.name),
  }
}

function normalizeSyncHealth(value: unknown): MetaResponse['syncHealth'] {
  const data = isRecord(value) ? value : {}
  const issues: MetaResponse['syncHealth']['issues'] = asArray(data.issues, (entry) => {
    const issue = isRecord(entry) ? entry : {}
    const code = asString(issue.code)
    const normalizedCode: MetaResponse['syncHealth']['issues'][number]['code'] =
      code === 'NO_SUCCESSFUL_SYNC' ||
      code === 'STALE_SUCCESSFUL_SYNC' ||
      code === 'STALE_RUNNING_SYNC' ||
      code === 'MISSING_COVERAGE'
        ? code
        : 'MISSING_COVERAGE'

    return {
      code: normalizedCode,
      severity: issue.severity === 'warning' ? ('warning' as const) : ('blocking' as const),
      message: asString(issue.message, 'Нет подтвержденного покрытия локального snapshot.'),
    }
  })
  const blocking =
    typeof data.blocking === 'boolean'
      ? data.blocking
      : issues.some((issue) => issue.severity === 'blocking')
  const status =
    data.status === 'ready' || data.status === 'warning' || data.status === 'blocked'
      ? data.status
      : blocking
        ? 'blocked'
        : 'ready'

  return {
    status,
    blocking,
    checkedAt: asString(data.checkedAt),
    lastSuccessfulSync: asNullableString(data.lastSuccessfulSync),
    issues,
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSnapshotStats(value: unknown): SnapshotStats {
  const data = isRecord(value) ? value : {}

  return {
    deals: asNumber(data.deals),
    activities: asNumber(data.activities),
    calls: asNumber(data.calls),
    stageHistory: asNumber(data.stageHistory),
  }
}

function normalizeSyncChanges(value: unknown): SyncChangeSummary {
  const data = isRecord(value) ? value : {}
  const breakdown = isRecord(data.dealBreakdown) ? data.dealBreakdown : {}

  return {
    deals: asNumber(data.deals),
    dealBreakdown: {
      total: asNumber(breakdown.total, asNumber(data.deals)),
      created: asNumber(breakdown.created),
      updated: asNumber(breakdown.updated, asNumber(data.deals)),
      closed: asNumber(breakdown.closed),
      reopened: asNumber(breakdown.reopened),
      unchanged: asNumber(breakdown.unchanged),
    },
    activities: asNumber(data.activities),
    calls: asNumber(data.calls),
    stageHistory: asNumber(data.stageHistory),
    managers: asNumber(data.managers),
  }
}

function normalizeMeta(value: unknown): MetaResponse {
  const data = isRecord(value) ? value : {}
  const lastSync = isRecord(data.lastSync) ? data.lastSync : null

  return {
    stageCatalog: asArray(data.stageCatalog, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        entityType:
          item.entityType === 'lead' || item.entityType === 'source'
            ? item.entityType
            : 'deal',
        categoryId: asNullableString(item.categoryId),
        statusId: asString(item.statusId),
        name: asString(item.name, asString(item.statusId)),
        semanticId: asNullableString(item.semanticId),
      }
    }),
    wonStageIds: asArray(data.wonStageIds, (entry) => asString(entry)).filter(Boolean),
    managerCatalog: asArray(data.managerCatalog, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const callAttributionPolicy = normalizeCallAttributionPolicy(
        item.callAttributionPolicy,
      )
      return {
        id: asString(item.id),
        name: asString(item.name, asString(item.id)),
        ...(callAttributionPolicy ? { callAttributionPolicy } : {}),
      }
    }),
    sourceCatalog: asArray(data.sourceCatalog, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        key: asString(item.key),
        label: asString(item.label, asString(item.key)),
      }
    }),
    defaultPeriodDays: asNumber(data.defaultPeriodDays, 30),
    lastSync: lastSync
        ? {
            finishedAt: asString(lastSync.finishedAt),
            leadsSynced: asNumber(lastSync.leadsSynced),
            dealsSynced: asNumber(lastSync.dealsSynced),
            mode: lastSync.mode === 'full' ? 'full' : 'delta',
            dealBreakdown: normalizeSyncChanges({
              deals: lastSync.dealsSynced,
              dealBreakdown: isRecord(lastSync.dealBreakdown)
                ? lastSync.dealBreakdown
                : undefined,
            }).dealBreakdown,
          }
        : null,
    snapshotStats: normalizeSnapshotStats(data.snapshotStats),
    syncHealth: normalizeSyncHealth(data.syncHealth),
  }
}

function normalizeOntologyStatus(value: unknown): OntologyStatus {
  return value === 'needs-sync' ||
    value === 'draft' ||
    value === 'deprecated' ||
    value === 'unclassified'
    ? value
    : 'confirmed'
}

function normalizeOntologySource(value: unknown): OntologySourceRef {
  const data = isRecord(value) ? value : {}
  const kind: OntologySourceRef['kind'] =
    data.kind === 'google-doc' ||
    data.kind === 'google-sheet' ||
    data.kind === 'markdown' ||
    data.kind === 'bitrix' ||
    data.kind === 'dashboard' ||
    data.kind === 'decision'
      ? data.kind
      : 'decision'
  const canonicality: OntologySourceRef['canonicality'] =
    data.canonicality === 'canonical' ||
    data.canonicality === 'supporting' ||
    data.canonicality === 'implementation' ||
    data.canonicality === 'decision'
      ? data.canonicality
      : 'supporting'

  return {
    id: asString(data.id),
    label: asString(data.label, asString(data.id)),
    kind,
    href: asString(data.href),
    canonicality,
  }
}

function normalizeOntologyConcept(value: unknown): OntologyConcept {
  const data = isRecord(value) ? value : {}
  const bitrix = isRecord(data.bitrix) ? data.bitrix : null
  const type: OntologyConcept['type'] =
    data.type === 'transition' ||
    data.type === 'outcome' ||
    data.type === 'delivery_quality' ||
    data.type === 'format' ||
    data.type === 'source'
      ? data.type
      : 'stage'

  const concept: OntologyConcept = {
    id: asString(data.id),
    type,
    label: asString(data.label, asString(data.id)),
    status: normalizeOntologyStatus(data.status),
    definition: asString(data.definition),
    not: asArray(data.not, (entry) => asString(entry)).filter(Boolean),
    sourceIds: asArray(data.sourceIds, (entry) => asString(entry)).filter(Boolean),
    reportBindingIds: asArray(data.reportBindingIds, (entry) =>
      asString(entry),
    ).filter(Boolean),
  }

  if (bitrix) {
    const normalizedBitrix: NonNullable<OntologyConcept['bitrix']> = {
      categoryId: asString(bitrix.categoryId),
    }
    const stageId = asString(bitrix.stageId)
    const fieldCode = asString(bitrix.fieldCode)
    const enumValue = asString(bitrix.enumValue)

    if (stageId) {
      normalizedBitrix.stageId = stageId
    }
    if (fieldCode) {
      normalizedBitrix.fieldCode = fieldCode
    }
    if (enumValue) {
      normalizedBitrix.enumValue = enumValue
    }

    concept.bitrix = normalizedBitrix
  }

  return concept
}

function normalizeOntologyTransition(value: unknown): OntologyTransition {
  const data = isRecord(value) ? value : {}

  const transition: OntologyTransition = {
    id: asString(data.id),
    label: asString(data.label, asString(data.id)),
    status: normalizeOntologyStatus(data.status),
    fromConceptId: asString(data.fromConceptId),
    toConceptId: asString(data.toConceptId),
    definition: asString(data.definition),
    sourceIds: asArray(data.sourceIds, (entry) => asString(entry)).filter(Boolean),
    reportBindingIds: asArray(data.reportBindingIds, (entry) =>
      asString(entry),
    ).filter(Boolean),
  }

  const trigger = asString(data.trigger)
  if (trigger) {
    transition.trigger = trigger
  }

  return transition
}

function normalizeOntologyReportBinding(value: unknown): OntologyReportBinding {
  const data = isRecord(value) ? value : {}

  return {
    id: asString(data.id),
    label: asString(data.label, asString(data.id)),
    sceneId: asString(data.sceneId),
    blockId: asString(data.blockId),
    href: asString(data.href),
  }
}

function normalizeOntologyDriftItem(value: unknown): OntologyDriftItem {
  const data = isRecord(value) ? value : {}
  const kind: OntologyDriftItem['kind'] =
    data.kind === 'source' ||
    data.kind === 'reason' ||
    data.kind === 'report_binding'
      ? data.kind
      : 'stage'
  const severity: OntologyDriftItem['severity'] =
    data.severity === 'blocking' || data.severity === 'warning'
      ? data.severity
      : 'info'

  return {
    kind,
    severity,
    label: asString(data.label),
    message: asString(data.message),
  }
}

function normalizeAttractionOntology(value: unknown): AttractionOntologyResponse {
  const data = isRecord(value) ? value : {}
  const governance = isRecord(data.governance) ? data.governance : {}

  return {
    moduleKey: 'attraction',
    title: asString(data.title, 'Онтология Привлечения'),
    governance: {
      decisionRole: asString(governance.decisionRole),
      decisionUnit: asString(governance.decisionUnit),
    },
    lastReviewedAt: asString(data.lastReviewedAt),
    sources: asArray(data.sources, normalizeOntologySource).filter(
      (source) => source.id,
    ),
    concepts: asArray(data.concepts, normalizeOntologyConcept).filter(
      (concept) => concept.id,
    ),
    transitions: asArray(data.transitions, normalizeOntologyTransition).filter(
      (transition) => transition.id,
    ),
    reportBindings: asArray(
      data.reportBindings,
      normalizeOntologyReportBinding,
    ).filter((binding) => binding.id),
    drift: asArray(data.drift, normalizeOntologyDriftItem).filter(
      (item) => item.message,
    ),
  }
}

function normalizeOntologySourceDocument(
  value: unknown,
): OntologySourceDocumentResponse {
  const data = isRecord(value) ? value : {}

  return {
    moduleKey: 'attraction',
    source: normalizeOntologySource(data.source),
    content: asString(data.content),
  }
}

function normalizeSyncSummary(value: unknown): SyncSummary {
  const data = isRecord(value) ? value : {}

  return {
    syncRunId: asNumber(data.syncRunId),
    leadsSynced: asNumber(data.leadsSynced),
    dealsSynced: asNumber(data.dealsSynced),
    mode: data.mode === 'full' ? 'full' : 'delta',
    modifiedAfter: asNullableString(data.modifiedAfter),
    finishedAt: asString(data.finishedAt),
    snapshotBefore: normalizeSnapshotStats(data.snapshotBefore),
    snapshotAfter: normalizeSnapshotStats(data.snapshotAfter),
    changes: normalizeSyncChanges(data.changes),
    diagnostics: asArray(data.diagnostics, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSyncRunHistory(value: unknown): SyncRunHistoryResponse {
  const data = isRecord(value) ? value : {}

  return {
    runs: asArray(data.runs, (entry) => {
      const row = isRecord(entry) ? entry : {}
      const status =
        row.status === 'running' || row.status === 'success' || row.status === 'failed'
          ? row.status
          : 'failed'

      return {
        id: asNumber(row.id),
        startedAt: asString(row.startedAt),
        finishedAt: asNullableString(row.finishedAt),
        durationMs: asNullableNumber(row.durationMs),
        status,
        mode: row.mode === 'full' ? 'full' : 'delta',
        modifiedAfter: asNullableString(row.modifiedAfter),
        scopeKey: asNullableString(row.scopeKey),
        leadsSynced: asNumber(row.leadsSynced),
        dealsSynced: asNumber(row.dealsSynced),
        dealBreakdown: normalizeSyncChanges({
          deals: row.dealsSynced,
          dealBreakdown: isRecord(row.dealBreakdown) ? row.dealBreakdown : undefined,
        }).dealBreakdown,
        diagnostics: asArray(row.diagnostics, (item) => asString(item)).filter(Boolean),
      }
    }),
  }
}

function normalizeLeadgenFunnelReport(value: unknown): LeadgenFunnelReport {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalDeals: asNumber(data.totalDeals),
    createdDeals: asNumber(data.createdDeals),
    activeDeals: asNumber(data.activeDeals),
    closedDeals: asNumber(data.closedDeals),
    stageRows: asArray(data.stageRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
        activeDeals: asNumber(item.activeDeals),
        createdDeals: asNumber(item.createdDeals),
        closedDeals: asNumber(item.closedDeals),
      }
    }),
    sourceRows: asArray(data.sourceRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        sourceKey: asString(item.sourceKey),
        sourceLabel: asString(item.sourceLabel, asString(item.sourceKey)),
        dealCount: asNumber(item.dealCount),
      }
    }),
    utmRows: asArray(data.utmRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        utmSource: asNullableString(item.utmSource),
        utmMedium: asNullableString(item.utmMedium),
        utmCampaign: asNullableString(item.utmCampaign),
        dealCount: asNumber(item.dealCount),
      }
    }),
    managerRows: asArray(data.managerRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        dealCount: asNumber(item.dealCount),
      }
    }),
    reasonRows: asArray(data.reasonRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        reasonKey: asString(item.reasonKey),
        reasonLabel: asString(item.reasonLabel, asString(item.reasonKey)),
        dealCount: asNumber(item.dealCount),
      }
    }),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSyncProgressEvent(value: unknown): SyncProgressEvent {
  const data = isRecord(value) ? value : {}
  const phase = asString(data.phase)

  return {
    syncRunId: typeof data.syncRunId === 'number' ? data.syncRunId : null,
    phase:
      phase === 'inspect_snapshot' ||
      phase === 'fetch_catalogs' ||
      phase === 'fetch_deals' ||
      phase === 'fetch_activities' ||
      phase === 'fetch_calls' ||
      phase === 'persist_snapshot' ||
      phase === 'complete' ||
      phase === 'failed'
        ? phase
        : 'inspect_snapshot',
    progress: Math.min(100, Math.max(0, asNumber(data.progress))),
    message: asString(data.message),
    ...(isRecord(data.snapshotBefore)
      ? { snapshotBefore: normalizeSnapshotStats(data.snapshotBefore) }
      : {}),
    ...(isRecord(data.snapshotAfter)
      ? { snapshotAfter: normalizeSnapshotStats(data.snapshotAfter) }
      : {}),
    ...(isRecord(data.changes) ? { changes: normalizeSyncChanges(data.changes) } : {}),
    ...(data.mode === 'full' || data.mode === 'delta' ? { mode: data.mode } : {}),
    ...(typeof data.modifiedAfter === 'string' || data.modifiedAfter === null
      ? { modifiedAfter: data.modifiedAfter }
      : {}),
    ...(typeof data.startedAt === 'string' ? { startedAt: data.startedAt } : {}),
    ...(typeof data.finishedAt === 'string' ? { finishedAt: data.finishedAt } : {}),
    diagnostics: asArray(data.diagnostics, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSourceQualityConversionSnapshot(
  value: unknown,
): SourceQualityConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    stageSequence: asArray(data.stageSequence, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
      }
    }),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        sourceKey: asString(item.sourceKey),
        sourceLabel: asString(item.sourceLabel, asString(item.sourceKey)),
        qualityKey: asString(item.qualityKey),
        qualityLabel: asString(item.qualityLabel, asString(item.qualityKey)),
        createdDeals: asNumber(item.createdDeals),
        wonDeals: asNumber(item.wonDeals),
        stageMetrics: asArray(item.stageMetrics, (metric) => {
          const row = isRecord(metric) ? metric : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            reachedDeals: asNumber(row.reachedDeals),
            conversionRate: asNumber(row.conversionRate),
            averageStageDurationHours: asNumber(row.averageStageDurationHours),
          }
        }),
      }
    }),
  }
}

function normalizeSourceQualityConversionReport(
  value: unknown,
): SourceQualityConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeSourceQualityConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeSourceQualityConversionSnapshot,
    ),
  }
}

function normalizeSourceCohortOpenStageRows(value: unknown) {
  return asArray(value, (entry) => {
    const item = isRecord(entry) ? entry : {}
    return {
      stageId: asString(item.stageId),
      stageName: asString(item.stageName, asString(item.stageId)),
      openDeals: asNumber(item.openDeals),
    }
  })
}

function normalizeSourceCohortConversionSnapshot(
  value: unknown,
): SourceCohortConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    totalLostDeals: asNumber(data.totalLostDeals),
    totalOpenDeals: asNumber(data.totalOpenDeals),
    winRate: asNumber(data.winRate),
    averageDaysToWin: asNumber(data.averageDaysToWin),
    cohortMonths: asArray(data.cohortMonths, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        cohortMonth: asString(item.cohortMonth),
        cohortLabel: asString(item.cohortLabel, asString(item.cohortMonth)),
        totalCreatedDeals: asNumber(item.totalCreatedDeals),
      }
    }),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        id: asString(item.id),
        sourceKey: asString(item.sourceKey),
        sourceLabel: asString(item.sourceLabel, asString(item.sourceKey)),
        qualityKey: asString(item.qualityKey),
        qualityLabel: asString(item.qualityLabel, asString(item.qualityKey)),
        customerKey: asString(item.customerKey),
        customerLabel: asString(item.customerLabel, asString(item.customerKey)),
        createdDeals: asNumber(item.createdDeals),
        wonDeals: asNumber(item.wonDeals),
        lostDeals: asNumber(item.lostDeals),
        openDeals: asNumber(item.openDeals),
        winRate: asNumber(item.winRate),
        averageDaysToWin: asNumber(item.averageDaysToWin),
        managerBreakdown: asArray(item.managerBreakdown, (manager) => {
          const row = isRecord(manager) ? manager : {}
          return {
            managerId: asString(row.managerId),
            managerName: asString(row.managerName, asString(row.managerId)),
            createdDeals: asNumber(row.createdDeals),
            wonDeals: asNumber(row.wonDeals),
            lostDeals: asNumber(row.lostDeals),
            openDeals: asNumber(row.openDeals),
            winRate: asNumber(row.winRate),
            averageDaysToWin: asNumber(row.averageDaysToWin),
            openStageBreakdown: normalizeSourceCohortOpenStageRows(
              row.openStageBreakdown,
            ),
          }
        }),
        openStageBreakdown: normalizeSourceCohortOpenStageRows(
          item.openStageBreakdown,
        ),
        targetGroupBreakdown: asArray(item.targetGroupBreakdown, (targetGroup) => {
          const row = isRecord(targetGroup) ? targetGroup : {}
          return {
            targetGroupKey: asString(row.targetGroupKey),
            targetGroupLabel: asString(
              row.targetGroupLabel,
              asString(row.targetGroupKey),
            ),
            wonDeals: asNumber(row.wonDeals),
            averageDaysToWin: asNumber(row.averageDaysToWin),
          }
        }),
      }
    }),
  }
}

function normalizeSourceCohortConversionReport(
  value: unknown,
): SourceCohortConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeSourceCohortConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeSourceCohortConversionSnapshot,
    ),
  }
}

function normalizeActivitiesWorkloadSnapshot(
  value: unknown,
): ActivitiesWorkloadReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalDealCount: asNumber(data.totalDealCount),
    totalCreatedCount: asNumber(data.totalCreatedCount),
    totalRescheduledCount: asNumber(data.totalRescheduledCount),
    totalClosedCount: asNumber(data.totalClosedCount),
    totalMeetingCount: asNumber(data.totalMeetingCount),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    conversionEventRows: asArray(data.conversionEventRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        eventKey: asString(item.eventKey),
        eventName: asString(item.eventName, asString(item.eventKey)),
        eventDate: asString(item.eventDate),
        invitedCount: asNumber(item.invitedCount),
        attendedCount: asNumber(item.attendedCount),
        refusedCount: asNumber(item.refusedCount),
        waitingCount: asNumber(item.waitingCount),
        stageBreakdown: asArray(item.stageBreakdown, (stage) => {
          const row = isRecord(stage) ? stage : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            invitedCount: asNumber(row.invitedCount),
          }
        }),
      }
    }),
    managerRows: asArray(data.managerRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        dealCount: asNumber(item.dealCount),
        createdCount: asNumber(item.createdCount),
        rescheduledCount: asNumber(item.rescheduledCount),
        closedCount: asNumber(item.closedCount),
        meetingCount: asNumber(item.meetingCount),
        averageCreatedPerDeal: asNumber(item.averageCreatedPerDeal),
        averageRescheduledPerDeal: asNumber(item.averageRescheduledPerDeal),
        averageClosedPerDeal: asNumber(item.averageClosedPerDeal),
        averageMeetingsPerDeal: asNumber(item.averageMeetingsPerDeal),
        meetingTypeBreakdown: asArray(item.meetingTypeBreakdown, (meetingType) => {
          const row = isRecord(meetingType) ? meetingType : {}
          return {
            meetingTypeKey: asString(row.meetingTypeKey),
            meetingTypeLabel: asString(
              row.meetingTypeLabel,
              asString(row.meetingTypeKey),
            ),
            count: asNumber(row.count),
          }
        }),
        businessClubBreakdown: asArray(item.businessClubBreakdown, (businessClub) => {
          const row = isRecord(businessClub) ? businessClub : {}
          return {
            businessClubKey: asString(row.businessClubKey),
            businessClubLabel: asString(
              row.businessClubLabel,
              asString(row.businessClubKey),
            ),
            dealCount: asNumber(row.dealCount),
          }
        }),
        meetingBusinessClubBreakdown: asArray(
          item.meetingBusinessClubBreakdown,
          (meetingBusinessClub) => {
            const row = isRecord(meetingBusinessClub) ? meetingBusinessClub : {}
            const meetingSlotIndex = normalizeMeetingSlotIndex(row.meetingSlotIndex)
            return {
              businessClubKey: asString(row.businessClubKey),
              businessClubLabel: asString(
                row.businessClubLabel,
                asString(row.businessClubKey),
              ),
              meetingSlotIndex,
              meetingSlotLabel: asNullableString(row.meetingSlotLabel),
              meetingTypeKey: asString(row.meetingTypeKey),
              meetingTypeLabel: asString(
                row.meetingTypeLabel,
                asString(row.meetingTypeKey),
              ),
              count: asNumber(row.count),
            }
          },
        ),
        tasksHourlyHeatmap: normalizeHourlyWeekdayWorkloadHeatmap(
          item.tasksHourlyHeatmap,
          TASKS_HEATMAP_BASIS,
        ),
        createdTasksHourlyHeatmap: normalizeHourlyWeekdayWorkloadHeatmap(
          item.createdTasksHourlyHeatmap,
          CREATED_TASKS_HEATMAP_BASIS,
        ),
        closedTasksHourlyHeatmap: normalizeHourlyWeekdayWorkloadHeatmap(
          item.closedTasksHourlyHeatmap,
          CLOSED_TASKS_HEATMAP_BASIS,
        ),
        meetingsHourlyHeatmap: normalizeHourlyWeekdayWorkloadHeatmap(
          item.meetingsHourlyHeatmap,
          MEETINGS_HEATMAP_BASIS,
        ),
        slaMetrics: asArray(item.slaMetrics, (metric) => {
          const row = isRecord(metric) ? metric : {}
          return {
            slaKey:
              row.slaKey === 'sla2' || row.slaKey === 'sla3'
                ? row.slaKey
                : 'sla1',
            label: asString(row.label, asString(row.slaKey)),
            onTimeCount: asNumber(row.onTimeCount),
            lateCount: asNumber(row.lateCount),
            noTouchCount: asNumber(row.noTouchCount),
            medianHours: asNumber(row.medianHours),
          }
        }),
        stageBreakdown: asArray(item.stageBreakdown, (stage) => {
          const row = isRecord(stage) ? stage : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            dealCount: asNumber(row.dealCount),
            createdCount: asNumber(row.createdCount),
            rescheduledCount: asNumber(row.rescheduledCount),
            closedCount: asNumber(row.closedCount),
            averageCreatedPerDeal: asNumber(row.averageCreatedPerDeal),
            averageRescheduledPerDeal: asNumber(row.averageRescheduledPerDeal),
            averageClosedPerDeal: asNumber(row.averageClosedPerDeal),
          }
        }),
      }
    }),
  }
}

function normalizeActivitiesWorkloadReport(value: unknown): ActivitiesWorkloadReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeActivitiesWorkloadSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeActivitiesWorkloadSnapshot,
    ),
  }
}

function normalizeCallsWorkloadSnapshot(value: unknown): CallsWorkloadReportSnapshot {
  const data = isRecord(value) ? value : {}
  const normalizeCallPopulation = (value: unknown) => {
    const item = isRecord(value) ? value : {}

    return {
      totalCalls: asNumber(item.totalCalls),
      incomingCalls: asNumber(item.incomingCalls),
      missedIncomingCalls: asNumber(item.missedIncomingCalls),
      outgoingCalls: asNumber(item.outgoingCalls),
      otherOutgoingCalls: asNumber(item.otherOutgoingCalls),
      connectedCalls: asNumber(item.connectedCalls),
      failedCalls: asNumber(item.failedCalls),
      callsOverThirtySeconds: asNumber(item.callsOverThirtySeconds),
      connectedCallsOverThirtySeconds: asNumber(item.connectedCallsOverThirtySeconds),
      averageDurationSeconds: asNumber(item.averageDurationSeconds),
    }
  }
  const normalizeOptionalCallPopulation = (value: unknown) =>
    isRecord(value) ? normalizeCallPopulation(value) : undefined
  const normalizeStageCallMetric = (value: unknown) => {
    const row = isRecord(value) ? value : {}

    return {
      stageId: asString(row.stageId),
      stageName: asString(row.stageName, asString(row.stageId)),
      dealCount: asNumber(row.dealCount),
      totalCalls: asNumber(row.totalCalls),
      incomingCalls: asNumber(row.incomingCalls),
      missedIncomingCalls: asNumber(row.missedIncomingCalls),
      outgoingCalls: asNumber(row.outgoingCalls),
      otherOutgoingCalls: asNumber(row.otherOutgoingCalls),
      connectedCalls: asNumber(row.connectedCalls),
      failedCalls: asNumber(row.failedCalls),
      callsOverThirtySeconds: asNumber(row.callsOverThirtySeconds),
      connectedCallsOverThirtySeconds: asNumber(row.connectedCallsOverThirtySeconds),
      averageCallsPerDeal: asNumber(row.averageCallsPerDeal),
      averageDurationSeconds: asNumber(row.averageDurationSeconds),
    }
  }
  const linkedDealCalls = isRecord(data.linkedDealCalls) ? data.linkedDealCalls : {}
  const reportExcludedByPolicyCalls = normalizeOptionalCallPopulation(
    linkedDealCalls.excludedByPolicyCalls,
  )

  return {
    range: normalizeRange(data.range),
    totalDealCount: asNumber(data.totalDealCount),
    totalCalls: asNumber(data.totalCalls),
    totalIncomingCalls: asNumber(data.totalIncomingCalls),
    totalMissedIncomingCalls: asNumber(data.totalMissedIncomingCalls),
    totalOutgoingCalls: asNumber(data.totalOutgoingCalls),
    totalOtherOutgoingCalls: asNumber(data.totalOtherOutgoingCalls),
    totalConnectedCalls: asNumber(data.totalConnectedCalls),
    totalFailedCalls: asNumber(data.totalFailedCalls),
    totalCallsOverThirtySeconds: asNumber(data.totalCallsOverThirtySeconds),
    totalConnectedCallsOverThirtySeconds: asNumber(
      data.totalConnectedCallsOverThirtySeconds,
    ),
    allCalls: normalizeCallPopulation(data.allCalls),
    linkedDealCalls: {
      ...normalizeCallPopulation(linkedDealCalls),
      totalDealCount: asNumber(linkedDealCalls.totalDealCount),
      ...(reportExcludedByPolicyCalls
        ? { excludedByPolicyCalls: reportExcludedByPolicyCalls }
        : {}),
    },
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    managerRows: asArray(data.managerRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const linked = isRecord(item.linkedDealCalls) ? item.linkedDealCalls : {}
      const rowCallAttributionPolicy = normalizeCallAttributionPolicy(
        item.callAttributionPolicy,
      )
      const rowExcludedByPolicyCalls = normalizeOptionalCallPopulation(
        linked.excludedByPolicyCalls,
      )
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        dealCount: asNumber(item.dealCount),
        totalCalls: asNumber(item.totalCalls),
        incomingCalls: asNumber(item.incomingCalls),
        missedIncomingCalls: asNumber(item.missedIncomingCalls),
        outgoingCalls: asNumber(item.outgoingCalls),
        otherOutgoingCalls: asNumber(item.otherOutgoingCalls),
        connectedCalls: asNumber(item.connectedCalls),
        failedCalls: asNumber(item.failedCalls),
        callsOverThirtySeconds: asNumber(item.callsOverThirtySeconds),
        connectedCallsOverThirtySeconds: asNumber(
          item.connectedCallsOverThirtySeconds,
        ),
        averageCallsPerDeal: asNumber(item.averageCallsPerDeal),
        averageDurationSeconds: asNumber(item.averageDurationSeconds),
        ...(rowCallAttributionPolicy
          ? { callAttributionPolicy: rowCallAttributionPolicy }
          : {}),
        allCalls: normalizeCallPopulation(item.allCalls),
        linkedDealCalls: {
          ...normalizeCallPopulation(linked),
          dealCount: asNumber(linked.dealCount),
          averageCallsPerDeal: asNumber(linked.averageCallsPerDeal),
          stageBreakdown: asArray(linked.stageBreakdown, normalizeStageCallMetric),
          ...(rowExcludedByPolicyCalls
            ? { excludedByPolicyCalls: rowExcludedByPolicyCalls }
            : {}),
        },
        callsHourlyHeatmap: normalizeHourlyWeekdayWorkloadHeatmap(
          item.callsHourlyHeatmap,
          OUTGOING_CALLS_HEATMAP_BASIS,
        ),
        stageBreakdown: asArray(item.stageBreakdown, normalizeStageCallMetric),
      }
    }),
  }
}

function normalizeCallsWorkloadReport(value: unknown): CallsWorkloadReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeCallsWorkloadSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeCallsWorkloadSnapshot),
  }
}

function normalizeAcquisitionOutcomesSnapshot(
  value: unknown,
): AcquisitionOutcomesReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalNewDeals: asNumber(data.totalNewDeals),
    totalLostDeals: asNumber(data.totalLostDeals),
    newDealsByManager: asArray(data.newDealsByManager, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalNewDeals: asNumber(item.totalNewDeals),
        sources: asArray(item.sources, (source) => {
          const row = isRecord(source) ? source : {}
          return {
            sourceKey: asString(row.sourceKey),
            sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
            totalNewDeals: asNumber(row.totalNewDeals),
            qualities: asArray(row.qualities, (quality) => {
              const bucket = isRecord(quality) ? quality : {}
              return {
                qualityKey: asString(bucket.qualityKey),
                qualityLabel: asString(bucket.qualityLabel, asString(bucket.qualityKey)),
                count: asNumber(bucket.count),
              }
            }),
          }
        }),
      }
    }),
    lostDealsByManager: asArray(data.lostDealsByManager, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalLostDeals: asNumber(item.totalLostDeals),
        stages: asArray(item.stages, (stage) => {
          const row = isRecord(stage) ? stage : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            count: asNumber(row.count),
          }
        }),
      }
    }),
    lostStages: asArray(data.lostStages, (stage) => {
      const row = isRecord(stage) ? stage : {}
      return {
        stageId: asString(row.stageId),
        stageName: asString(row.stageName, asString(row.stageId)),
        count: asNumber(row.count),
      }
    }),
    businessClubByManager: asArray(data.businessClubByManager, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalDeals: asNumber(item.totalDeals),
        businessClubs: asArray(item.businessClubs, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            businessClubKey: asString(row.businessClubKey),
            businessClubLabel: asString(
              row.businessClubLabel,
              asString(row.businessClubKey),
            ),
            count: asNumber(row.count),
          }
        }),
        targetGroups: asArray(item.targetGroups, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            targetGroupKey: asString(row.targetGroupKey),
            targetGroupLabel: asString(
              row.targetGroupLabel,
              asString(row.targetGroupKey),
            ),
            count: asNumber(row.count),
          }
        }),
      }
    }),
    topLossReasons: asArray(data.topLossReasons, (reason) => {
      const row = isRecord(reason) ? reason : {}
      return {
        stageId: asString(row.stageId),
        stageName: asString(row.stageName, asString(row.stageId)),
        managerId: asString(row.managerId),
        managerName: asString(row.managerName, asString(row.managerId)),
        reasonKey: asString(row.reasonKey),
        reasonLabel: asString(row.reasonLabel, asString(row.reasonKey)),
        count: asNumber(row.count),
      }
    }),
    lostDealDetails: asArray(data.lostDealDetails, (detail) => {
      const row = isRecord(detail) ? detail : {}
      return {
        dealId: asString(row.dealId),
        managerId: asString(row.managerId),
        managerName: asString(row.managerName, asString(row.managerId)),
        sourceKey: asString(row.sourceKey),
        sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
        businessClubValue: asNullableString(row.businessClubValue),
        stageId: asString(row.stageId),
        stageName: asString(row.stageName, asString(row.stageId)),
        reasonKey: asString(row.reasonKey),
        reasonLabel: asString(row.reasonLabel, asString(row.reasonKey)),
        reasonDetail: asNullableString(row.reasonDetail),
      }
    }),
  }
}

function normalizeAcquisitionOutcomesReport(
  value: unknown,
): AcquisitionOutcomesReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeAcquisitionOutcomesSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeAcquisitionOutcomesSnapshot,
    ),
  }
}

function normalizeCohortRelativeClosureBuckets(
  value: unknown,
): CohortConversionReportSnapshot['rows'][number]['relativeClosureBuckets'] {
  return asArray(value, (bucket) => {
    const row = isRecord(bucket) ? bucket : {}
    return {
      bucketKey: asString(
        row.bucketKey,
      ) as CohortConversionReportSnapshot['relativeBucketKeys'][number],
      label: asString(row.label),
      closedDeals: asNumber(row.closedDeals),
      wonDeals: asNumber(row.wonDeals),
      closedRate: asNumber(row.closedRate),
      wonConversionRate: asNumber(row.wonConversionRate),
    }
  })
}

function normalizeCohortConversionSnapshot(
  value: unknown,
): CohortConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalClosedDeals: asNumber(data.totalClosedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    closureMonths: asArray(data.closureMonths, (entry) => asString(entry)).filter(Boolean),
    relativeBucketKeys: asArray(data.relativeBucketKeys, (entry) =>
      asString(entry),
    ).filter(Boolean) as CohortConversionReportSnapshot['relativeBucketKeys'],
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        createdMonth: asString(item.createdMonth),
        createdDeals: asNumber(item.createdDeals),
        closedDeals: asNumber(item.closedDeals),
        wonDeals: asNumber(item.wonDeals),
        closedRate: asNumber(item.closedRate),
        wonConversionRate: asNumber(item.wonConversionRate),
        averageDaysToClose: asNumber(item.averageDaysToClose),
        averageDaysToWin: asNumber(item.averageDaysToWin),
        closureBuckets: asArray(item.closureBuckets, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            closedMonth: asString(row.closedMonth),
            closedDeals: asNumber(row.closedDeals),
            wonDeals: asNumber(row.wonDeals),
            closedRate: asNumber(row.closedRate),
            wonConversionRate: asNumber(row.wonConversionRate),
          }
        }),
        relativeClosureBuckets: normalizeCohortRelativeClosureBuckets(
          item.relativeClosureBuckets,
        ),
      }
    }),
    breakdownRows: asArray(data.breakdownRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        id: asString(item.id),
        level: asString(
          item.level,
        ) as CohortConversionReportSnapshot['breakdownRows'][number]['level'],
        parentId: item.parentId == null ? null : asString(item.parentId),
        cohortMonth: item.cohortMonth == null ? null : asString(item.cohortMonth),
        cohortLabel: item.cohortLabel == null ? null : asString(item.cohortLabel),
        sourceKey: item.sourceKey == null ? null : asString(item.sourceKey),
        sourceLabel: item.sourceLabel == null ? null : asString(item.sourceLabel),
        qualityKey: item.qualityKey == null ? null : asString(item.qualityKey),
        qualityLabel: item.qualityLabel == null ? null : asString(item.qualityLabel),
        customerKey: item.customerKey == null ? null : asString(item.customerKey),
        customerLabel: item.customerLabel == null ? null : asString(item.customerLabel),
        createdDeals: asNumber(item.createdDeals),
        closedDeals: asNumber(item.closedDeals),
        wonDeals: asNumber(item.wonDeals),
        closedRate: asNumber(item.closedRate),
        wonConversionRate: asNumber(item.wonConversionRate),
        averageDaysToClose: asNumber(item.averageDaysToClose),
        averageDaysToWin: asNumber(item.averageDaysToWin),
        relativeClosureBuckets: normalizeCohortRelativeClosureBuckets(
          item.relativeClosureBuckets,
        ),
      }
    }),
  }
}

function normalizeCohortConversionReport(value: unknown): CohortConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeCohortConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeCohortConversionSnapshot,
    ),
  }
}

function normalizeTargetGroupConversionSnapshot(
  value: unknown,
): TargetGroupConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        targetGroupKey: asString(item.targetGroupKey),
        targetGroupLabel: asString(
          item.targetGroupLabel,
          asString(item.targetGroupKey),
        ),
        createdDeals: asNumber(item.createdDeals),
        wonDeals: asNumber(item.wonDeals),
        winRate: asNumber(item.winRate),
        salesAmount: asNumber(item.salesAmount),
        averageSaleAmount: asNumber(item.averageSaleAmount),
        averageCycleDays: asNumber(item.averageCycleDays),
      }
    }),
  }
}

function normalizeTargetGroupConversionReport(
  value: unknown,
): TargetGroupConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeTargetGroupConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeTargetGroupConversionSnapshot,
    ),
  }
}

function normalizeConversionEventBreakdown(value: unknown) {
  return asArray(value, (entry) => {
    const item = isRecord(entry) ? entry : {}
    return {
      key: asString(item.key),
      label: asString(item.label, asString(item.key)),
      count: asNumber(item.count),
    }
  })
}

function normalizeConversionEventsSnapshot(
  value: unknown,
): ConversionEventsReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalInvitedCount: asNumber(data.totalInvitedCount),
    totalConfirmedCount: asNumber(data.totalConfirmedCount),
    totalAttendedCount: asNumber(data.totalAttendedCount),
    totalRefusedCount: asNumber(data.totalRefusedCount),
    totalMissedCount: asNumber(data.totalMissedCount),
    attendanceRate:
      typeof data.attendanceRate === 'number' ? data.attendanceRate : null,
    nextStepEligibleCount: asNumber(data.nextStepEligibleCount),
    nextStepCount: asNumber(data.nextStepCount),
    nextStepRate:
      typeof data.nextStepRate === 'number' ? data.nextStepRate : null,
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        eventKey: asString(item.eventKey),
        eventName: asString(item.eventName),
        eventDate: asString(item.eventDate),
        invitedCount: asNumber(item.invitedCount),
        confirmedCount: asNumber(item.confirmedCount),
        attendedCount: asNumber(item.attendedCount),
        refusedCount: asNumber(item.refusedCount),
        missedCount: asNumber(item.missedCount),
        attendanceRate:
          typeof item.attendanceRate === 'number' ? item.attendanceRate : null,
        nextStepEligibleCount: asNumber(item.nextStepEligibleCount),
        nextStepCount: asNumber(item.nextStepCount),
        nextStepRate:
          typeof item.nextStepRate === 'number' ? item.nextStepRate : null,
        unlinkedCount: asNumber(item.unlinkedCount),
        unknownStatusCount: asNumber(item.unknownStatusCount),
        managerBreakdown: normalizeConversionEventBreakdown(item.managerBreakdown),
        sourceBreakdown: normalizeConversionEventBreakdown(item.sourceBreakdown),
        businessClubBreakdown: normalizeConversionEventBreakdown(
          item.businessClubBreakdown,
        ),
      }
    }),
  }
}

function normalizeConversionEventsReport(value: unknown): ConversionEventsReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeConversionEventsSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeConversionEventsSnapshot,
    ),
  }
}

function normalizeManagerActionOutcomeSnapshot(
  value: unknown,
): ManagerActionOutcomeReportSnapshot {
  const data = isRecord(value) ? value : {}
  const normalizeStatusKey = (value: unknown) =>
    value === 'won' || value === 'lost' || value === 'wip' ? value : 'wip'
  const normalizeDealSlaStatus = (value: unknown): ManagerActionOutcomeDealSlaStatus =>
    value === 'onTime' || value === 'late' || value === 'noTouch' ? value : 'noTouch'
  const normalizeDealSla = (value: unknown) => {
    const sla = isRecord(value) ? value : {}
    const normalizeOne = (entry: unknown) => {
      const item = isRecord(entry) ? entry : {}
      return {
        status: normalizeDealSlaStatus(item.status),
        hours: typeof item.hours === 'number' && Number.isFinite(item.hours) ? item.hours : null,
      }
    }
    return {
      sla1: normalizeOne(sla.sla1),
      sla2: normalizeOne(sla.sla2),
      sla3: normalizeOne(sla.sla3),
    }
  }

  return {
    range: normalizeRange(data.range),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        createdTasks: asNumber(item.createdTasks),
        closedTasks: asNumber(item.closedTasks),
        totalCalls: asNumber(item.totalCalls),
        successfulCallsOverThirtySeconds: asNumber(
          item.successfulCallsOverThirtySeconds,
        ),
        meetingsCount: asNumber(item.meetingsCount),
        sla1OnTimeCount: asNumber(item.sla1OnTimeCount),
        sla1LateCount: asNumber(item.sla1LateCount),
        sla1NoTouchCount: asNumber(item.sla1NoTouchCount),
        sla1MedianHours: asNumber(item.sla1MedianHours),
        sla2OnTimeCount: asNumber(item.sla2OnTimeCount),
        sla2LateCount: asNumber(item.sla2LateCount),
        sla2NoTouchCount: asNumber(item.sla2NoTouchCount),
        sla2MedianHours: asNumber(item.sla2MedianHours),
        sla3OnTimeCount: asNumber(item.sla3OnTimeCount),
        sla3LateCount: asNumber(item.sla3LateCount),
        sla3NoTouchCount: asNumber(item.sla3NoTouchCount),
        sla3MedianHours: asNumber(item.sla3MedianHours),
        newDealsCount: asNumber(item.newDealsCount),
        wonDealsCount: asNumber(item.wonDealsCount),
        winRate: asNumber(item.winRate),
        salesAmount: asNumber(item.salesAmount),
        averageSaleAmount: asNumber(item.averageSaleAmount),
        averageCycleDays: asNumber(item.averageCycleDays),
      }
    }),
    cohortMonths: asArray(data.cohortMonths, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        cohortMonth: asString(item.cohortMonth),
        cohortLabel: asString(item.cohortLabel, asString(item.cohortMonth)),
        totalCreatedDeals: asNumber(item.totalCreatedDeals),
      }
    }),
    cohortStatusRows: asArray(data.cohortStatusRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        cohortMonth: typeof item.cohortMonth === 'string' ? item.cohortMonth : null,
        statusKey: normalizeStatusKey(item.statusKey),
        statusLabel: asString(item.statusLabel),
        cohortCreatedDeals: asNumber(item.cohortCreatedDeals),
        dealCount: asNumber(item.dealCount),
        statusShare: asNumber(item.statusShare),
        createdTasksPerDeal: asNumber(item.createdTasksPerDeal),
        closedTasksPerDeal: asNumber(item.closedTasksPerDeal),
        totalCallsPerDeal: asNumber(item.totalCallsPerDeal),
        successfulCallsOverThirtySecondsPerDeal: asNumber(
          item.successfulCallsOverThirtySecondsPerDeal,
        ),
        meetingsPerDeal: asNumber(item.meetingsPerDeal),
        sla1OnTimeRate: asNumber(item.sla1OnTimeRate),
        sla2OnTimeRate: asNumber(item.sla2OnTimeRate),
        sla3OnTimeRate: asNumber(item.sla3OnTimeRate),
        financialAmount: asNumber(item.financialAmount),
        averageFinancialAmount: asNumber(item.averageFinancialAmount),
        dealDetails: asArray(item.dealDetails, (deal) => {
          const row = isRecord(deal) ? deal : {}
          const lifecycleCard = normalizeOptionalDealLifecycleCard(row.lifecycleCard)
          return {
            dealId: asString(row.dealId),
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            amount: asNumber(row.amount),
            dateCreate: asString(row.dateCreate),
            dateClosed: asNullableString(row.dateClosed),
            dateModify: asString(row.dateModify),
            sourceKey: asString(row.sourceKey),
            sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
            qualityValue: asNullableString(row.qualityValue),
            businessClubValue: asNullableString(row.businessClubValue),
            targetGroupValue: asNullableString(row.targetGroupValue),
            meetingTypeValue: asNullableString(row.meetingTypeValue),
            meetingDateValue: asNullableString(row.meetingDateValue),
            tariffValue: asNullableString(row.tariffValue),
            taskSummary: normalizeDealTaskSummary(row.taskSummary),
            callSummary: normalizeDealCallSummary(row.callSummary),
            meetingSummary: normalizeDealMeetingSummary(row.meetingSummary),
            sla: normalizeDealSla(row.sla),
            stageTimeline: normalizeDealStageTimeline(row.stageTimeline),
            ...(lifecycleCard ? { lifecycleCard } : {}),
          }
        }),
      }
    }),
  }
}

function normalizeManagerActionOutcomeReport(
  value: unknown,
): ManagerActionOutcomeReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeManagerActionOutcomeSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeManagerActionOutcomeSnapshot,
    ),
  }
}

function normalizeTocFlowSnapshot(value: unknown): TocFlowReportSnapshot {
  const data = isRecord(value) ? value : {}
  const bottleneck = isRecord(data.bottleneck) ? data.bottleneck : null

  return {
    range: normalizeRange(data.range),
    businessDays: asNumber(data.businessDays),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    estimatedGainPerDay:
      typeof data.estimatedGainPerDay === 'number' &&
      Number.isFinite(data.estimatedGainPerDay)
        ? data.estimatedGainPerDay
        : null,
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        stageSemanticId: asNullableString(item.stageSemanticId),
        sortOrder: asNumber(item.sortOrder),
        enteredDeals: asNumber(item.enteredDeals),
        movedNextDeals: asNumber(item.movedNextDeals),
        throughputPerDay: asNumber(item.throughputPerDay),
        queueEnd: asNumber(item.queueEnd),
        queueBufferDays:
          typeof item.queueBufferDays === 'number' &&
          Number.isFinite(item.queueBufferDays)
            ? item.queueBufferDays
            : null,
        averageStageDurationDays: asNumber(item.averageStageDurationDays),
      }
    }),
    bottleneck: bottleneck
      ? {
          stageId: asString(bottleneck.stageId),
          stageName: asString(bottleneck.stageName, asString(bottleneck.stageId)),
          throughputPerDay: asNumber(bottleneck.throughputPerDay),
          queueEnd: asNumber(bottleneck.queueEnd),
          queueBufferDays:
            typeof bottleneck.queueBufferDays === 'number' &&
            Number.isFinite(bottleneck.queueBufferDays)
              ? bottleneck.queueBufferDays
              : null,
        }
      : null,
    stageDistribution: normalizeTocStageDistribution(data.stageDistribution),
  }
}

function normalizeTocStageDistribution(value: unknown): TocStageDistribution | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    totalCreatedDeals: asNumber(value.totalCreatedDeals),
    nodes: asArray(value.nodes, (entry) => {
      const item = isRecord(entry) ? entry : {}

      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
        dealCount: asNumber(item.dealCount),
        shareOfCreatedDeals: asNumber(item.shareOfCreatedDeals),
      }
    }).filter((node) => node.stageId || node.stageName),
    edges: asArray(value.edges, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const fromStageId = asNullableString(item.fromStageId ?? item.sourceStageId)
      const fromStageName = asNullableString(item.fromStageName ?? item.sourceStageName)
      const toStageId = asString(item.toStageId ?? item.targetStageId)
      const toStageName = asString(
        item.toStageName ?? item.targetStageName,
        toStageId,
      )

      return {
        fromStageId,
        fromStageName,
        toStageId,
        toStageName,
        dealCount: asNumber(item.dealCount),
        conversionRate: asNumber(item.conversionRate),
      }
    }).filter((edge) => edge.toStageId || edge.toStageName),
    routeNodes: asArray(value.routeNodes, (entry) => {
      const item = isRecord(entry) ? entry : {}

      return {
        step: asNumber(item.step),
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
        dealCount: asNumber(item.dealCount),
        shareOfCreatedDeals: asNumber(item.shareOfCreatedDeals),
      }
    }).filter((node) => node.stageId || node.stageName),
    routeEdges: asArray(value.routeEdges, (entry) => {
      const item = isRecord(entry) ? entry : {}

      return {
        fromStep: asNumber(item.fromStep),
        fromStageId: asString(item.fromStageId),
        fromStageName: asString(item.fromStageName, asString(item.fromStageId)),
        toStep: asNumber(item.toStep),
        toStageId: asString(item.toStageId),
        toStageName: asString(item.toStageName, asString(item.toStageId)),
        dealCount: asNumber(item.dealCount),
        conversionRate: asNumber(item.conversionRate),
      }
    }).filter((edge) => edge.fromStageId && edge.toStageId),
  }
}

function normalizeTocFlowReport(value: unknown): TocFlowReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeTocFlowSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeTocFlowSnapshot),
  }
}

function normalizeRevenueVelocityDimension(value: unknown): RevenueVelocityDimension {
  return value === 'source' ||
    value === 'customer' ||
    value === 'managerSource' ||
    value === 'sourceCustomer' ||
    value === 'managerCustomer'
    ? value
    : 'manager'
}

function normalizeRevenueVelocityView(value: unknown): RevenueVelocityView {
  return value === 'operationalPeriod' || value === 'createdCohort'
    ? value
    : 'systemState'
}

function normalizeRevenueVelocityActionSummary(
  value: unknown,
): RevenueVelocityActionSummary {
  const data = isRecord(value) ? value : {}

  return {
    totalCalls: asNumber(data.totalCalls),
    connectedCallsOverThirtySeconds: asNumber(data.connectedCallsOverThirtySeconds),
    meetingsCount: asNumber(data.meetingsCount),
    conversionEventsCount: asNumber(data.conversionEventsCount),
    createdTasks: asNumber(data.createdTasks),
    closedTasks: asNumber(data.closedTasks),
    weightedActionPoints: asNumber(data.weightedActionPoints),
    weightedActionPointsPerDeal: asNullableNumber(data.weightedActionPointsPerDeal),
    weightedActionPointsPerWin: asNullableNumber(data.weightedActionPointsPerWin),
  }
}

function normalizeRevenueVelocityMoneyPerAction(
  value: unknown,
): RevenueVelocityMoneyPerAction {
  const data = isRecord(value) ? value : {}

  return {
    moneyPerMeeting: asNullableNumber(data.moneyPerMeeting),
    moneyPerConnectedCallOverThirtySeconds: asNullableNumber(
      data.moneyPerConnectedCallOverThirtySeconds,
    ),
    moneyPerConversionEvent: asNullableNumber(data.moneyPerConversionEvent),
    moneyPerClosedTask: asNullableNumber(data.moneyPerClosedTask),
    moneyPerWeightedActionPoint: asNullableNumber(data.moneyPerWeightedActionPoint),
    actionEfficiencyIndex: asNullableNumber(data.actionEfficiencyIndex),
  }
}

function normalizeRevenueVelocityFormulaBreakdown(
  value: unknown,
): RevenueVelocityFormulaBreakdown | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    source:
      value.source === 'selectedCohort' || value.source === 'rollingQuarterCohort'
        ? value.source
        : 'selectedCohort',
    sourceLabel: asString(value.sourceLabel),
    averageRevenueAmount: asNullableNumber(value.averageRevenueAmount),
    opportunitiesCount: asNumber(value.opportunitiesCount),
    conversionRate: asNullableNumber(value.conversionRate),
    averageCycleDays: asNullableNumber(value.averageCycleDays),
    value: asNullableNumber(value.value),
    benchmarkFrom: asNullableString(value.benchmarkFrom),
    benchmarkTo: asNullableString(value.benchmarkTo),
    missingReason: asNullableString(value.missingReason),
  }
}

function normalizeRevenueVelocitySnapshot(
  value: unknown,
): RevenueVelocityReportSnapshot {
  const data = isRecord(value) ? value : {}
  const dimension = normalizeRevenueVelocityDimension(data.dimension)
  const view = normalizeRevenueVelocityView(data.view)
  const normalizeRow = (entry: unknown) => {
    const row = isRecord(entry) ? entry : {}

    return {
      dimension: normalizeRevenueVelocityDimension(row.dimension ?? dimension),
      view: normalizeRevenueVelocityView(row.view ?? view),
      key: asString(row.key),
      label: asString(row.label, asString(row.key)),
      managerId: asNullableString(row.managerId),
      managerName: asNullableString(row.managerName),
      sourceKey: asNullableString(row.sourceKey),
      sourceLabel: asNullableString(row.sourceLabel),
      customerKey: asNullableString(row.customerKey),
      customerLabel: asNullableString(row.customerLabel),
      createdDeals: asNumber(row.createdDeals),
      activeDeals: asNumber(row.activeDeals),
      wonDeals: asNumber(row.wonDeals),
      lostDeals: asNumber(row.lostDeals),
      wipDeals: asNumber(row.wipDeals),
      salesAmount: asNumber(row.salesAmount),
      averageCheck: asNullableNumber(row.averageCheck),
      winRate: asNullableNumber(row.winRate),
      averageCycleDays: asNullableNumber(row.averageCycleDays),
      medianCycleDays: asNullableNumber(row.medianCycleDays),
      revenueVelocityPerDay: asNullableNumber(row.revenueVelocityPerDay),
      revenueVelocityFormula: normalizeRevenueVelocityFormulaBreakdown(
        row.revenueVelocityFormula,
      ),
      activePipelineAmount: asNumber(row.activePipelineAmount),
      expectedPipelineAmount: asNullableNumber(row.expectedPipelineAmount),
      previousExpectedPipelineAmount: asNullableNumber(row.previousExpectedPipelineAmount),
      expectedPipelineDelta: asNullableNumber(row.expectedPipelineDelta),
      liveRevenueVelocity: asNullableNumber(row.liveRevenueVelocity),
      previousLiveRevenueVelocity: asNullableNumber(row.previousLiveRevenueVelocity),
      velocityDelta: asNullableNumber(row.velocityDelta),
      velocityDeltaPercent: asNullableNumber(row.velocityDeltaPercent),
      averageRemainingDays: asNullableNumber(row.averageRemainingDays),
      realizedWonAmountInPeriod: asNumber(row.realizedWonAmountInPeriod),
      wonDealsInPeriod: asNumber(row.wonDealsInPeriod),
      lostDealsInPeriod: asNumber(row.lostDealsInPeriod),
      systemValueCreated: asNullableNumber(row.systemValueCreated),
      actionPointsDelta: asNullableNumber(row.actionPointsDelta),
      systemValuePerActionPoint: asNullableNumber(row.systemValuePerActionPoint),
      realizedMoneyPerActionPoint: asNullableNumber(row.realizedMoneyPerActionPoint),
      historicalMoneyPerActionPoint: asNullableNumber(row.historicalMoneyPerActionPoint),
      estimatedFutureMoneyFromPeriodActions: asNullableNumber(
        row.estimatedFutureMoneyFromPeriodActions,
      ),
      actions: normalizeRevenueVelocityActionSummary(row.actions),
      moneyPerAction: normalizeRevenueVelocityMoneyPerAction(row.moneyPerAction),
      bottleneckStageId: asNullableString(row.bottleneckStageId),
      bottleneckStageName: asNullableString(row.bottleneckStageName),
      warnings: asArray(row.warnings, (warning) => asString(warning)).filter(Boolean),
    }
  }
  const weights = isRecord(data.actionWeights) ? data.actionWeights : {}

  return {
    range: normalizeRange(data.range),
    asOf: asString(data.asOf),
    previousAsOf: asNullableString(data.previousAsOf),
    dimension,
    view,
    actionWeights: {
      connectedCallOverThirtySeconds: asNumber(
        weights.connectedCallOverThirtySeconds,
        1,
      ),
      meeting: asNumber(weights.meeting, 3),
      conversionEvent: asNumber(weights.conversionEvent, 5),
      closedTask: asNumber(weights.closedTask, 0.5),
    },
    totals: normalizeRow(data.totals),
    rows: asArray(data.rows, normalizeRow),
    formulaTooltips: asArray(data.formulaTooltips, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const emptyState = asNullableString(item.emptyState)
      return {
        key: asString(item.key),
        label: asString(item.label, asString(item.key)),
        formula: asString(item.formula),
        description: asString(item.description),
        ...(emptyState ? { emptyState } : {}),
      }
    }),
    warnings: asArray(data.warnings, (warning) => asString(warning)).filter(Boolean),
  }
}

function normalizeRevenueVelocityReport(value: unknown): RevenueVelocityReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeRevenueVelocitySnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeRevenueVelocitySnapshot),
  }
}

function asUnitEconomicsNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

function asUnitEconomicsNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = asUnitEconomicsNumber(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeUnitEconomicsPnlLevel(value: unknown): UnitEconomicsPnlLevel {
  return value === 'above_ebitda' || value === 'below_ebitda'
    ? value
    : 'variable_contribution'
}

function normalizeUnitEconomicsCostBehavior(value: unknown): UnitEconomicsCostBehavior {
  return value === 'fixed' || value === 'mixed' ? value : 'variable'
}

function normalizeUnitEconomicsEventParticipantMode(value: unknown) {
  return value === 'attended' ? 'attended' : 'invited'
}

function normalizeUnitEconomicsCalculationMethod(
  value: unknown,
): UnitEconomicsCalculationMethod {
  return value === 'manual_amount' ||
    value === 'percent_of_module_revenue' ||
    value === 'percent_of_sale' ||
    value === 'percent_of_club_membership' ||
    value === 'amount_per_lead' ||
    value === 'amount_per_participant' ||
    value === 'amount_per_contract' ||
    value === 'amount_per_event' ||
    value === 'amount_per_period' ||
    value === 'imported_fact'
    ? value
    : 'manual_amount'
}

function normalizeUnitEconomicsCostConfidence(
  value: unknown,
): UnitEconomicsCostConfidence {
  return value === 'confirmed' ||
    value === 'imported' ||
    value === 'manual' ||
    value === 'inferred' ||
    value === 'needs_review' ||
    value === 'conflicting'
    ? value
    : 'needs_review'
}

function normalizeUnitEconomicsSummary(value: unknown) {
  const data = isRecord(value) ? value : {}

  return {
    createdDeals: asUnitEconomicsNumber(data.createdDeals),
    wonDeals: asUnitEconomicsNumber(data.wonDeals),
    purchasedLeads: asUnitEconomicsNumber(data.purchasedLeads),
    attractionRevenue: asUnitEconomicsNumber(data.attractionRevenue),
    clubRevenue: asUnitEconomicsNumber(data.clubRevenue),
    leadPurchaseCost: asUnitEconomicsNumber(data.leadPurchaseCost),
    eventCost: asUnitEconomicsNumber(data.eventCost),
    ambassadorActivityCost: asUnitEconomicsNumber(data.ambassadorActivityCost),
    ctuCertificateCost: asUnitEconomicsNumber(data.ctuCertificateCost),
    contractationCost: asUnitEconomicsNumber(data.contractationCost),
    otherVariableCost: asUnitEconomicsNumber(data.otherVariableCost),
    variableCosts: asUnitEconomicsNumber(data.variableCosts),
    contributionResult: asUnitEconomicsNumber(data.contributionResult),
    contributionMargin: asUnitEconomicsNullableNumber(data.contributionMargin),
    aboveEbitdaCosts: asUnitEconomicsNumber(data.aboveEbitdaCosts),
    ebitda: asUnitEconomicsNumber(data.ebitda),
    ebitdaMargin: asUnitEconomicsNullableNumber(data.ebitdaMargin),
    belowEbitdaCosts: asUnitEconomicsNumber(data.belowEbitdaCosts),
    netProfit: asUnitEconomicsNumber(data.netProfit),
    netProfitMargin: asUnitEconomicsNullableNumber(data.netProfitMargin),
    attractionAverageCheck: asUnitEconomicsNullableNumber(data.attractionAverageCheck),
    clubAverageCheck: asUnitEconomicsNullableNumber(data.clubAverageCheck),
    costPerWonDeal: asUnitEconomicsNullableNumber(data.costPerWonDeal),
    costPerCreatedDeal: asUnitEconomicsNullableNumber(data.costPerCreatedDeal),
  }
}

function normalizeUnitEconomicsCostRule(value: unknown) {
  const data = isRecord(value) ? value : {}

  return {
    id: asString(data.id),
    articleId: asString(data.articleId),
    pnlLevel: normalizeUnitEconomicsPnlLevel(data.pnlLevel),
    costBehavior: normalizeUnitEconomicsCostBehavior(data.costBehavior),
    calculationMethod: normalizeUnitEconomicsCalculationMethod(data.calculationMethod),
    unitPrice: asUnitEconomicsNullableNumber(data.unitPrice),
    percent: asUnitEconomicsNullableNumber(data.percent),
    amount: asUnitEconomicsNullableNumber(data.amount),
    sourceKey: asNullableString(data.sourceKey),
    qualityValue: asNullableString(data.qualityValue),
    eventNamePattern: asNullableString(data.eventNamePattern),
    enabled: data.enabled !== false,
    effectiveFrom: asString(data.effectiveFrom),
    effectiveTo: asNullableString(data.effectiveTo),
    sortOrder: asUnitEconomicsNumber(data.sortOrder),
  }
}

function normalizeUnitEconomicsSettings(value: unknown): UnitEconomicsSettings {
  const data = isRecord(value) ? value : {}

  return {
    articles: asArray(data.articles, (entry) => {
      const article = isRecord(entry) ? entry : {}
      return {
        id: asString(article.id),
        name: asString(article.name, asString(article.id)),
        pnlLevel: normalizeUnitEconomicsPnlLevel(article.pnlLevel),
        costBehavior: normalizeUnitEconomicsCostBehavior(article.costBehavior),
        calculationMethod: normalizeUnitEconomicsCalculationMethod(
          article.calculationMethod,
        ),
        enabled: article.enabled !== false,
        sortOrder: asUnitEconomicsNumber(article.sortOrder),
        effectiveFrom: asNullableString(article.effectiveFrom),
        effectiveTo: asNullableString(article.effectiveTo),
        updatedAt: asNullableString(article.updatedAt),
      }
    }),
    rules: asArray(data.rules, normalizeUnitEconomicsCostRule),
    eventParticipantMode: normalizeUnitEconomicsEventParticipantMode(
      data.eventParticipantMode,
    ),
    updatedAt: asNullableString(data.updatedAt),
  }
}

function normalizeUnitEconomicsManagerRevenueRow(value: unknown) {
  const row = isRecord(value) ? value : {}

  return {
    clubLabel: asNullableString(row.clubLabel),
    tariffLabel: asNullableString(row.tariffLabel),
    wonDeals: asUnitEconomicsNumber(row.wonDeals),
    attractionRevenue: asUnitEconomicsNumber(row.attractionRevenue),
    clubRevenue: asUnitEconomicsNumber(row.clubRevenue),
  }
}

function normalizeUnitEconomicsManagerCostDetailRow(value: unknown) {
  const row = isRecord(value) ? value : {}

  return {
    articleId: asString(row.articleId),
    articleLabel: asString(row.articleLabel, asString(row.articleId)),
    productLabel: asString(row.productLabel),
    quantity: asUnitEconomicsNullableNumber(row.quantity),
    unitLabel: asNullableString(row.unitLabel),
    unitPrice: asUnitEconomicsNullableNumber(row.unitPrice),
    percent: asUnitEconomicsNullableNumber(row.percent),
    amount: asUnitEconomicsNumber(row.amount),
    basis: asString(row.basis),
    warnings: asArray(row.warnings, (warning) => asString(warning)).filter(Boolean),
  }
}

function normalizeUnitEconomicsSnapshot(value: unknown): UnitEconomicsReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    summary: normalizeUnitEconomicsSummary(data.summary),
    sourceQualityRows: asArray(data.sourceQualityRows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      return {
        sourceKey: asString(row.sourceKey),
        sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
        qualityValue: asNullableString(row.qualityValue),
        createdDeals: asUnitEconomicsNumber(row.createdDeals),
        wonDeals: asUnitEconomicsNumber(row.wonDeals),
        purchasedLeads: asUnitEconomicsNumber(row.purchasedLeads),
        attractionRevenue: asUnitEconomicsNumber(row.attractionRevenue),
        clubRevenue: asUnitEconomicsNumber(row.clubRevenue),
        leadPurchaseCost: asUnitEconomicsNumber(row.leadPurchaseCost),
        contractationCost: asUnitEconomicsNumber(row.contractationCost),
        variableCosts: asUnitEconomicsNumber(row.variableCosts),
        financialResult: asUnitEconomicsNumber(row.financialResult),
        margin: asUnitEconomicsNullableNumber(row.margin),
        warnings: asArray(row.warnings, (warning) => asString(warning)).filter(Boolean),
      }
    }),
    managerRows: asArray(data.managerRows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      return {
        managerId: asString(row.managerId),
        managerName: asString(row.managerName, asString(row.managerId)),
        createdDeals: asUnitEconomicsNumber(row.createdDeals),
        wonDeals: asUnitEconomicsNumber(row.wonDeals),
        purchasedLeads: asUnitEconomicsNumber(row.purchasedLeads),
        attractionRevenue: asUnitEconomicsNumber(row.attractionRevenue),
        clubRevenue: asUnitEconomicsNumber(row.clubRevenue),
        leadPurchaseCost: asUnitEconomicsNumber(row.leadPurchaseCost),
        eventCost: asUnitEconomicsNumber(row.eventCost),
        ambassadorActivityCost: asUnitEconomicsNumber(row.ambassadorActivityCost),
        ctuCertificateCost: asUnitEconomicsNumber(row.ctuCertificateCost),
        contractationCost: asUnitEconomicsNumber(row.contractationCost),
        variableCosts: asUnitEconomicsNumber(row.variableCosts),
        financialResult: asUnitEconomicsNumber(row.financialResult),
        margin: asUnitEconomicsNullableNumber(row.margin),
        warnings: asArray(row.warnings, (warning) => asString(warning)).filter(Boolean),
        revenueRows: asArray(
          row.revenueRows,
          normalizeUnitEconomicsManagerRevenueRow,
        ),
        productionCostRows: asArray(
          row.productionCostRows,
          normalizeUnitEconomicsManagerCostDetailRow,
        ),
        directCostRows: asArray(
          row.directCostRows,
          normalizeUnitEconomicsManagerCostDetailRow,
        ),
        taxAndFinanceRows: asArray(
          row.taxAndFinanceRows,
          normalizeUnitEconomicsManagerCostDetailRow,
        ),
      }
    }),
    costRows: asArray(data.costRows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      return {
        articleId: asString(row.articleId),
        label: asString(row.label, asString(row.articleId)),
        pnlLevel: normalizeUnitEconomicsPnlLevel(row.pnlLevel),
        costBehavior: normalizeUnitEconomicsCostBehavior(row.costBehavior),
        calculationMethod: normalizeUnitEconomicsCalculationMethod(
          row.calculationMethod,
        ),
        amount: asUnitEconomicsNumber(row.amount),
        quantity: asUnitEconomicsNullableNumber(row.quantity),
        unitPrice: asUnitEconomicsNullableNumber(row.unitPrice),
        percent: asUnitEconomicsNullableNumber(row.percent),
        sourceKey: asNullableString(row.sourceKey),
        qualityValue: asNullableString(row.qualityValue),
        confidence: normalizeUnitEconomicsCostConfidence(row.confidence),
        sourceSystem: asString(row.sourceSystem),
        warnings: asArray(row.warnings, (warning) => asString(warning)).filter(Boolean),
      }
    }),
    warnings: asArray(data.warnings, (warning) => asString(warning)).filter(Boolean),
  }
}

function normalizeUnitEconomicsReport(value: unknown): UnitEconomicsReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeUnitEconomicsSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeUnitEconomicsSnapshot),
  }
}

function buildQueryParams(query: DashboardQuery) {
  const compareFrom = query.compareRanges?.map((range) => range.from)
  const compareTo = query.compareRanges?.map((range) => range.to)
  const queryWithUnitEconomics = query as DashboardQuery & {
    eventParticipantMode?: string
  }
  const compareParams =
    compareFrom?.length && compareTo?.length
      ? {
          compareFrom,
          compareTo,
        }
      : {}
  const sharedParams = {
    managerIds: query.managerIds,
    sourceKeys: query.sourceKeys,
    eventParticipantMode: queryWithUnitEconomics.eventParticipantMode,
    ...compareParams,
  }

  return query.preset === 'custom'
    ? {
        from: query.from,
        to: query.to,
        ...sharedParams,
      }
    : {
        periodDays: query.preset,
        ...sharedParams,
      }
}

function buildCohortConversionQueryParams(query: CohortConversionQuery) {
  return {
    ...buildQueryParams(query),
    includeBreakdown:
      query.includeBreakdown === undefined ? undefined : String(query.includeBreakdown),
  }
}

function buildRevenueVelocityQueryParams(query: RevenueVelocityQuery) {
  return {
    ...buildQueryParams(query),
    dimension: query.dimension,
    view: query.view,
    asOf: query.asOf,
    customerKeys: query.customerKeys,
    qualityKeys: query.qualityKeys,
    tariffKeys: query.tariffKeys,
  }
}

async function requestJson<T>(
  pathname: string,
  init: RequestInit,
  normalize: (value: unknown) => T,
) {
  const response = await fetch(pathname, buildRequestInit(init))

  if (!response.ok) {
    const { message, payload } = await readErrorResponse(response)
    if (response.status === 401 && !String(pathname).includes('/api/auth/login')) {
      notifyUnauthorized()
    }
    throw new ApiClientError(message, response.status, payload)
  }

  const data = (await response.json()) as unknown
  return normalize(data)
}

async function requestVoid(pathname: string, init: RequestInit) {
  const response = await fetch(pathname, buildRequestInit(init))

  if (!response.ok) {
    const { message, payload } = await readErrorResponse(response)
    if (response.status === 401) {
      notifyUnauthorized()
    }
    throw new ApiClientError(message, response.status, payload)
  }
}

function parseSyncStreamBlock(block: string) {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  return {
    event,
    data: JSON.parse(dataLines.join('\n')) as unknown,
  }
}

async function requestSyncStream(
  moduleId: string,
  onProgress: (event: SyncProgressEvent) => void,
) {
  const syncPath = buildModulePath(moduleId, '/api/sync')
  const response = await fetch(buildUrl(syncPath), {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
  })

  if (!response.ok || !response.body) {
    if (!response.ok) {
      const { message, payload } = await readErrorResponse(response)
      if (response.status === 401) {
        notifyUnauthorized()
      }
      throw new ApiClientError(message, response.status, payload)
    }

    return requestJson(buildUrl(syncPath), { method: 'POST' }, normalizeSyncSummary)
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let summary: SyncSummary | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      buffer += decoder.decode(value, { stream: !done })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const parsed = parseSyncStreamBlock(block.trim())
        if (!parsed) {
          continue
        }

        if (parsed.event === 'progress') {
          onProgress(normalizeSyncProgressEvent(parsed.data))
        } else if (parsed.event === 'complete') {
          summary = normalizeSyncSummary(parsed.data)
        } else if (parsed.event === 'error') {
          const errorData = isRecord(parsed.data) ? parsed.data : {}
          const details = isRecord(errorData.details) ? errorData.details : {}
          const diagnostics = asArray(details.diagnostics, (entry) => asString(entry)).filter(
            Boolean,
          )
          const code = asString(errorData.code, 'SYNC_FAILED')
          throw new ApiClientError(
            [code, ...diagnostics].filter(Boolean).join(': '),
            response.status,
          )
        }
      }
    }

    if (done) {
      break
    }
  }

  if (summary) {
    return summary
  }

  throw new ApiClientError('SYNC_STREAM_INCOMPLETE', response.status)
}

export const apiClient = {
  onUnauthorized(listener: () => void) {
    unauthorizedListeners.add(listener)
    return () => {
      unauthorizedListeners.delete(listener)
    }
  },
  async login(input: { login: string; password: string }) {
    const response = await requestJson(
      buildUrl('/api/auth/login'),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeAuthResponse,
    )
    return setCsrfTokenFromResponse(response)
  },
  async getCurrentUser() {
    const response = await requestJson(
      buildUrl('/api/auth/me'),
      { method: 'GET' },
      normalizeAuthResponse,
    )
    return setCsrfTokenFromResponse(response)
  },
  async logout() {
    await requestVoid(buildUrl('/api/auth/logout'), { method: 'POST' })
    csrfToken = null
  },
  async updateCurrentUser(input: { firstName?: string | null; lastName?: string | null }) {
    const response = await requestJson(
      buildUrl('/api/auth/me'),
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      normalizeAuthResponse,
    )
    return setCsrfTokenFromResponse(response)
  },
  async changeCurrentPassword(input: { currentPassword: string; newPassword: string }) {
    await requestVoid(buildUrl('/api/auth/change-password'), {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async getProtoComments() {
    return requestJson(
      buildUrl('/api/proto-comments'),
      { method: 'GET' },
      normalizeCommentStore,
    )
  },
  async saveProtoComments(comments: ProtoComment[]) {
    return requestJson(
      buildUrl('/api/proto-comments'),
      {
        method: 'POST',
        body: JSON.stringify({ comments }),
      },
      normalizeCommentStore,
    )
  },
  async getComments(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/comments')),
      { method: 'GET' },
      normalizeCommentStore,
    )
  },
  async createComment(
    input: {
      sceneId: string
      x: number
      y: number
      text: string
      anchor?: ProtoCommentAnchor
      context?: ProtoCommentContext
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/comments')),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeCommentResponse,
    )
  },
  async updateComment(
    id: string,
    input: {
      text?: string
      context?: ProtoCommentContext
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}`)),
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      normalizeCommentResponse,
    )
  },
  async archiveComment(id: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}/archive`),
      ),
      { method: 'POST' },
      normalizeCommentResponse,
    )
  },
  async retryComment(id: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}/retry`),
      ),
      { method: 'POST' },
      normalizeCommentResponse,
    )
  },
  async reworkComment(id: string, input: { text: string }, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}/rework`),
      ),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeCommentResponse,
    )
  },
  async getCommentNotifications(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/comment-notifications')),
      { method: 'GET' },
      normalizeCommentNotificationsResponse,
    )
  },
  async getModuleUsers(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/admin/module-users')),
      { method: 'GET' },
      normalizeModuleUsersResponse,
    )
  },
  async createModuleUser(
    input: {
      login: string
      firstName?: string | null
      lastName?: string | null
      password: string
      role: ModuleRole
      defaultManagerId?: string | null
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/admin/module-users')),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeModuleUserResponse,
    )
  },
  async updateModuleUser(
    id: number,
    input: {
      firstName?: string | null
      lastName?: string | null
      password?: string
      role?: ModuleRole
      defaultManagerId?: string | null
      disabled?: boolean
      membershipStatus?: 'active' | 'disabled'
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, `/api/admin/module-users/${id}`)),
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      normalizeModuleUserResponse,
    )
  },
  async deleteModuleUser(id: number, moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, `/api/admin/module-users/${id}`)),
      { method: 'DELETE' },
      normalizeModuleUserResponse,
    )
  },
  async getPlatformAccess() {
    return requestJson(
      buildUrl('/api/admin/platform/access'),
      { method: 'GET' },
      normalizePlatformAccessResponse,
    )
  },
  async updatePlatformUserMemberships(
    id: number,
    memberships: PlatformMembershipInput[],
  ) {
    return requestJson(
      buildUrl(`/api/admin/platform/users/${id}/module-memberships`),
      {
        method: 'PATCH',
        body: JSON.stringify({ memberships }),
      },
      normalizePlatformUserResponse,
    )
  },
  async getDashboard(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/dashboard', buildQueryParams(query)),
      { method: 'GET' },
      normalizeDashboard,
    )
  },
  async getLeadgenFunnelReport(moduleId: string, query: DashboardQuery) {
    return requestJson(
      buildUrl(
        `/api/modules/${encodeURIComponent(moduleId)}/reports/funnel`,
        buildQueryParams(query),
      ),
      { method: 'GET' },
      normalizeLeadgenFunnelReport,
    )
  },
  async getLeadgenActivitiesWorkloadReport(moduleId: string, query: DashboardQuery) {
    return requestJson(
      buildUrl(
        `/api/modules/${encodeURIComponent(moduleId)}/reports/activities-workload`,
        buildQueryParams(query),
      ),
      { method: 'GET' },
      normalizeActivitiesWorkloadReport,
    )
  },
  async getLeadgenCallsWorkloadReport(moduleId: string, query: DashboardQuery) {
    return requestJson(
      buildUrl(
        `/api/modules/${encodeURIComponent(moduleId)}/reports/calls-workload`,
        buildQueryParams(query),
      ),
      { method: 'GET' },
      normalizeCallsWorkloadReport,
    )
  },
  async analyzeCall(callId: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(
          moduleId,
          `/api/calls/${encodeURIComponent(callId)}/analyze`,
        ),
      ),
      { method: 'POST' },
      normalizeCallAnalysisRunResponse,
    )
  },
  async getCallAnalysis(callId: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(
          moduleId,
          `/api/calls/${encodeURIComponent(callId)}/analysis`,
        ),
      ),
      { method: 'GET' },
      normalizeCallAnalysisLookupResponse,
    )
  },
  async getCallAnalysisQueue(
    params: {
      from: string
      to: string
      managerIds?: string[]
      sourceKeys?: string[]
      stageIds?: string[]
      callTypes?: CallAnalysisQueueCallType[]
      analysisStatuses?: CallAnalysisQueueStatus[]
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/calls/analysis-queue'), {
        from: params.from,
        to: params.to,
        managerIds: params.managerIds,
        sourceKeys: params.sourceKeys,
        stageIds: params.stageIds,
        callTypes: params.callTypes,
        analysisStatuses: params.analysisStatuses,
      }),
      { method: 'GET' },
      normalizeCallAnalysisQueueResponse,
    )
  },
  async getSalesPlan(range: ReportRange) {
    return requestJson(
      buildUrl('/api/sales-plan', {
        from: range.from,
        to: range.to,
      }),
      { method: 'GET' },
      normalizeSalesPlan,
    )
  },
  async saveSalesPlan(input: SalesPlanInput) {
    return requestJson(
      buildUrl('/api/sales-plan'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeSalesPlan,
    )
  },
  async getEffectiveSalesPlan(range: ReportRange) {
    return requestJson(
      buildUrl('/api/sales-plan/effective', {
        from: range.from,
        to: range.to,
      }),
      { method: 'GET' },
      normalizeSalesPlan,
    )
  },
  async getSalesPlanQuarter(input: { year: number; quarter: number }) {
    return requestJson(
      buildUrl('/api/sales-plan/quarter', {
        year: String(input.year),
        quarter: String(input.quarter),
      }),
      { method: 'GET' },
      normalizeSalesPlanQuarter,
    )
  },
  async saveSalesPlanQuarter(input: SalesPlanQuarterInput) {
    return requestJson(
      buildUrl('/api/sales-plan/quarter'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeSalesPlanQuarter,
    )
  },
  async getPricingSettings() {
    return requestJson(
      buildUrl('/api/settings/pricing'),
      { method: 'GET' },
      normalizePricingSettings,
    )
  },
  async savePricingSettings(input: DealPricingSettingsInput) {
    return requestJson(
      buildUrl('/api/settings/pricing'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizePricingSettings,
    )
  },
  async getUnitEconomicsSettings() {
    return requestJson(
      buildUrl('/api/settings/unit-economics'),
      { method: 'GET' },
      normalizeUnitEconomicsSettings,
    )
  },
  async saveUnitEconomicsCostRules(input: UnitEconomicsCostRulesInput) {
    return requestJson(
      buildUrl('/api/settings/unit-economics/cost-rules'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeUnitEconomicsSettings,
    )
  },
  async getConversionEventTypeSettings() {
    return requestJson(
      buildUrl('/api/settings/conversion-event-types'),
      { method: 'GET' },
      normalizeConversionEventTypeSettings,
    )
  },
  async saveConversionEventTypeSettings(input: ConversionEventTypeSettingsInput) {
    return requestJson(
      buildUrl('/api/settings/conversion-event-types'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeConversionEventTypeSettings,
    )
  },
  async getManagerWhitelistSettings() {
    return requestJson(
      buildUrl('/api/settings/manager-whitelist'),
      { method: 'GET' },
      normalizeManagerWhitelistSettings,
    )
  },
  async saveManagerWhitelistSettings(input: ManagerWhitelistSettingsInput) {
    return requestJson(
      buildUrl('/api/settings/manager-whitelist'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeManagerWhitelistSettings,
    )
  },
  async getMeta(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/meta')),
      { method: 'GET' },
      normalizeMeta,
    )
  },
  async getSyncRuns(options: { limit?: number } = {}) {
    return requestJson(
      buildUrl('/api/sync-runs', {
        limit: options.limit,
      }),
      { method: 'GET' },
      normalizeSyncRunHistory,
    )
  },
  async getAttractionOntology(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/ontology')),
      { method: 'GET' },
      normalizeAttractionOntology,
    )
  },
  async getAttractionOntologySourceDocument(sourceId: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(
          moduleId,
          `/api/ontology/sources/${encodeURIComponent(sourceId)}`,
        ),
      ),
      { method: 'GET' },
      normalizeOntologySourceDocument,
    )
  },
  async getSourceQualityConversionReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/source-quality-conversion', buildQueryParams(query)),
      { method: 'GET' },
      normalizeSourceQualityConversionReport,
    )
  },
  async getSourceCohortConversionReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/source-cohort-conversion', buildQueryParams(query)),
      { method: 'GET' },
      normalizeSourceCohortConversionReport,
    )
  },
  async getActivitiesWorkloadReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/activities-workload', buildQueryParams(query)),
      { method: 'GET' },
      normalizeActivitiesWorkloadReport,
    )
  },
  async getAcquisitionOutcomesReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/acquisition-outcomes', buildQueryParams(query)),
      { method: 'GET' },
      normalizeAcquisitionOutcomesReport,
    )
  },
  async getTargetGroupConversionReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/target-group-conversion', buildQueryParams(query)),
      { method: 'GET' },
      normalizeTargetGroupConversionReport,
    )
  },
  async getManagerActionOutcomeReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/manager-action-outcomes', buildQueryParams(query)),
      { method: 'GET' },
      normalizeManagerActionOutcomeReport,
    )
  },
  async getConversionEventsReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/conversion-events', buildQueryParams(query)),
      { method: 'GET' },
      normalizeConversionEventsReport,
    )
  },
  async getCallsWorkloadReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/calls-workload', buildQueryParams(query)),
      { method: 'GET' },
      normalizeCallsWorkloadReport,
    )
  },
  async getCohortConversionReport(query: CohortConversionQuery) {
    return requestJson(
      buildUrl('/api/reports/cohort-conversion', buildCohortConversionQueryParams(query)),
      { method: 'GET' },
      normalizeCohortConversionReport,
    )
  },
  async getTocFlowReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/toc-flow', buildQueryParams(query)),
      { method: 'GET' },
      normalizeTocFlowReport,
    )
  },
  async getRevenueVelocityReport(query: RevenueVelocityQuery) {
    return requestJson(
      buildUrl(
        '/api/reports/revenue-velocity',
        buildRevenueVelocityQueryParams(query),
      ),
      { method: 'GET' },
      normalizeRevenueVelocityReport,
    )
  },
  async getUnitEconomicsReport(query: UnitEconomicsQuery) {
    return requestJson(
      buildUrl('/api/reports/unit-economics', buildQueryParams(query)),
      { method: 'GET' },
      normalizeUnitEconomicsReport,
    )
  },
  async triggerSync(
    moduleIdOrProgress: string | ((event: SyncProgressEvent) => void) = 'attraction',
    maybeProgress?: (event: SyncProgressEvent) => void,
  ) {
    const moduleId =
      typeof moduleIdOrProgress === 'string' ? moduleIdOrProgress : 'attraction'
    const onProgress =
      typeof moduleIdOrProgress === 'function' ? moduleIdOrProgress : maybeProgress
    const syncPath = buildModulePath(moduleId, '/api/sync')

    if (onProgress) {
      return requestSyncStream(moduleId, onProgress)
    }

    return requestJson(buildUrl(syncPath), { method: 'POST' }, normalizeSyncSummary)
  },
}

export { ApiClientError }
