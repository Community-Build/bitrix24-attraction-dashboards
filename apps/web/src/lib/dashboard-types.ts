export const PERIOD_OPTIONS = [7, 30, 90, 180] as const

export type PeriodDays = (typeof PERIOD_OPTIONS)[number]
export type ReportPreset = PeriodDays | 'custom'
export type TimelineGranularity = 'daily' | 'weekly'
export interface ReportRange {
  from: string
  to: string
}

export interface ReportComparison<TSnapshot> {
  compareIndex: number
  range: ReportRange
  snapshot: TSnapshot
}

export type WorkloadHeatmapWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type WorkloadHeatmapBasis =
  | 'outgoing_calls'
  | 'tasks'
  | 'created_tasks'
  | 'closed_tasks'
  | 'meetings'

export type WorkloadHeatmapSegmentKey =
  | WorkloadHeatmapBasis
  | 'successful_outgoing_calls'
  | 'other_outgoing_calls'
  | 'no_answer_outgoing_calls'
  | 'meeting_slot_1'
  | 'meeting_slot_2'
  | 'meeting_slot_3'

export interface WorkloadHeatmapBasisInfo {
  key: WorkloadHeatmapBasis
  label: string
}

export interface WorkloadHeatmapSegment {
  key: WorkloadHeatmapSegmentKey
  label: string
  count: number
  intensity: number
}

export interface WorkloadHeatmapWeekdayColumn {
  weekday: WorkloadHeatmapWeekday
  label: string
}

export interface HourlyWeekdayWorkloadHeatmapCell {
  weekday: WorkloadHeatmapWeekday
  weekdayLabel: string
  hour: number
  count: number
  intensity: number
  segments?: WorkloadHeatmapSegment[]
}

export interface HourlyWeekdayWorkloadHeatmap {
  basis: WorkloadHeatmapBasisInfo
  hours: number[]
  weekdays: WorkloadHeatmapWeekdayColumn[]
  cells: HourlyWeekdayWorkloadHeatmapCell[]
  total: number
  gridTotal: number
  outsideGridTotal: number
  peak: HourlyWeekdayWorkloadHeatmapCell | null
}

export interface ReportFilters {
  managerIds?: string[]
  sourceKeys?: string[]
  businessClubKeys?: string[]
  targetGroupKeys?: string[]
}

export type UnitEconomicsEventParticipantMode = 'invited' | 'attended'

export interface LeadgenFunnelStageRow {
  stageId: string
  stageName: string
  sortOrder: number
  activeDeals: number
  createdDeals: number
  closedDeals: number
}

export interface LeadgenFunnelSourceRow {
  sourceKey: string
  sourceLabel: string
  dealCount: number
}

export interface LeadgenFunnelUtmRow {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  dealCount: number
}

export interface LeadgenFunnelManagerRow {
  managerId: string
  managerName: string
  dealCount: number
}

export interface LeadgenFunnelReasonRow {
  reasonKey: string
  reasonLabel: string
  dealCount: number
}

export interface LeadgenFunnelReport {
  range: ReportRange
  totalDeals: number
  createdDeals: number
  activeDeals: number
  closedDeals: number
  stageRows: LeadgenFunnelStageRow[]
  sourceRows: LeadgenFunnelSourceRow[]
  utmRows: LeadgenFunnelUtmRow[]
  managerRows: LeadgenFunnelManagerRow[]
  reasonRows: LeadgenFunnelReasonRow[]
  warnings: string[]
}

export type DashboardQuery = (
  | {
      preset: PeriodDays
    }
  | {
      preset: 'custom'
      from: string
      to: string
    }
) &
  ReportFilters & {
    compareRanges?: ReportRange[]
  }

export type CohortConversionQuery = DashboardQuery & {
  includeBreakdown?: boolean
}

export interface SalesTimelinePoint {
  date: string
  salesCount: number
  salesAmount: number
}

export interface SalesOverview {
  salesCount: number
  salesAmount: number
  averageSaleAmount: number
  newDealsCount: number
  conversionRate: number
  salesTimeline: SalesTimelinePoint[]
}

export interface SalesSummary {
  salesCount: number
  salesAmount: number
  averageSaleAmount: number
  attractionRevenueAmount: number
  averageAttractionRevenueAmount: number
  membershipAmount: number
  averageMembershipAmount: number
  pricingWarnings: string[]
  newDealsCount: number
  conversionRate: number
  meetingsCount?: number
}

export type DealPricingStatus =
  | 'priced'
  | 'missingContractFields'
  | 'missingPricingRule'
  | 'conflict'

export interface DealPricingRule {
  id: string
  customerLabel: string
  tariffLabel: string
  attractionRevenueAmount: number
  enabled: boolean
  sortOrder: number
  updatedAt: string | null
}

export interface DealPricingRuleInput {
  id: string
  customerLabel: string
  tariffLabel: string
  attractionRevenueAmount: number
  enabled: boolean
  sortOrder?: number | null
}

export interface DealPricingSettings {
  rules: DealPricingRule[]
  updatedAt: string | null
}

export interface DealPricingSettingsInput {
  rules: DealPricingRuleInput[]
}

export interface OperationalStageAgingThreshold {
  stageId: string
  stageName: string
  maxDaysOnStage: number
}

export interface OperationalSlaBusinessHours {
  sla1: number
  sla2: number
  sla3: number
}

export interface OperationalThresholdSettings {
  stageAging: OperationalStageAgingThreshold[]
  noCallsMaxDays: number
  noActivityMaxDays: number
  slaBusinessHours: OperationalSlaBusinessHours
  updatedAt: string | null
}

export interface OperationalStageAgingThresholdInput {
  stageId: string
  maxDaysOnStage: number
}

export interface OperationalThresholdSettingsInput {
  stageAging: OperationalStageAgingThresholdInput[]
  noCallsMaxDays: number
  noActivityMaxDays: number
  slaBusinessHours: OperationalSlaBusinessHours
}

export type OperationalRiskRuleKey =
  | 'stage_aging'
  | 'no_open_activity'
  | 'no_recent_calls'
  | 'no_recent_activity'

export interface OperationalRiskFlag {
  rule: OperationalRiskRuleKey
  label: string
  severity: 'risk' | 'critical'
}

export interface OperationalRiskDeal {
  dealId: string
  dealUrl: string | null
  managerId: string
  managerName: string
  stageId: string
  stageName: string
  daysOnStage: number
  stageMaxDays: number | null
  sourceLabel: string
  customerClubLabel: string
  flags: OperationalRiskFlag[]
  severity: 'risk' | 'critical'
  overdueRatio: number
}

export interface OperationalMeetingSlotCount {
  slotIndex: 1 | 2 | 3
  slotLabel: string
  count: number
}

export interface OperationalSaleByClub {
  targetGroupKey: string
  targetGroupLabel: string
  wonDeals: number
  averageDaysToWin: number
}

export interface OperationalStageWip {
  stageId: string
  stageName: string
  openDeals: number
  riskDeals: number
}

export interface OperationalPlannedBlock {
  meetingsToday: OperationalMeetingSlotCount[]
  meetingsTomorrow: OperationalMeetingSlotCount[]
  tasksToday: number
  tasksTomorrow: number
}

export interface OperationalSlaSummary {
  slaKey: 'sla1' | 'sla2' | 'sla3'
  label: string
  thresholdBusinessHours: number
  onTimeCount: number
  lateCount: number
  noTouchCount: number
  medianHours: number
}

export interface OperationalManagerRow {
  managerId: string
  managerName: string
  createdDeals: number
  meetingsBySlot: OperationalMeetingSlotCount[]
  wonDeals: number
  slaLateCount: number
  slaNoTouchCount: number
  openDeals: number
  riskDeals: number
}

export interface OperationalDashboardReport {
  range: ReportRange
  generatedAt: string
  createdDeals: number
  meetingsHeld: {
    total: number
    bySlot: OperationalMeetingSlotCount[]
  }
  sales: {
    total: number
    byClub: OperationalSaleByClub[]
  }
  lostDeals: number
  openDeals: number
  riskSummary: {
    total: number
    critical: number
    risk: number
    byRule: Array<{
      rule: OperationalRiskRuleKey
      label: string
      count: number
    }>
    byStage: Array<{
      stageId: string
      stageName: string
      count: number
    }>
  }
  stageWip: OperationalStageWip[]
  sla: OperationalSlaSummary[]
  planned: OperationalPlannedBlock
  managers: OperationalManagerRow[]
  risks: OperationalRiskDeal[]
  thresholdsUpdatedAt: string | null
}

export interface DealCohortContext {
  createdMonth: string
  cohortCreatedDeals: number
  cohortWonDeals: number
  cohortWonConversionRate: number
}

export interface DealCallSummary {
  total: number
  incoming: number
  outgoing: number
  successful: number
  failed: number
  overThirtySeconds: number
  connectedOverThirtySeconds: number
}

export type CallAnalysisRunStatus = 'queued' | 'analyzing' | 'ready' | 'error'

export type CallAnalysisTranscriptRole = 'manager' | 'client' | 'unknown'

export interface CallAnalysisTranscriptSegment {
  role: CallAnalysisTranscriptRole
  start: number
  end: number
  text: string
}

export type CallAnalysisNextStepQuality =
  | 'good'
  | 'ok'
  | 'weak'
  | 'missing'
  | 'unknown'

export interface CallAnalysisEmotionalBackground {
  managerTone: string
  clientTone: string
  frictionSignals: string[]
  confidence: number
}

export type CallAnalysisClassificationType =
  | 'primary_sales'
  | 'qualification'
  | 'follow_up'
  | 'scheduling'
  | 'inbound'
  | 'failed_or_no_conversation'
  | 'unknown'

export interface CallAnalysisClassification {
  type: CallAnalysisClassificationType
  confidence: number
  reason: string
}

export type CallAnalysisRubricApplicabilityLevel =
  | 'high'
  | 'medium'
  | 'low'
  | 'none'

export interface CallAnalysisRubricApplicability {
  level: CallAnalysisRubricApplicabilityLevel
  reason: string
}

export interface CallAnalysisScoreBlock {
  score: number
  rationale: string
  evidenceQuotes: string[]
}

export interface CallAnalysisNarrativeScore extends CallAnalysisScoreBlock {
  applicableNarratives: string[]
  missedNarratives: string[]
}

export interface CallAnalysisAiEvaluation {
  score: number
  callClassification: CallAnalysisClassification
  rubricApplicability: CallAnalysisRubricApplicability
  communicationScore: CallAnalysisScoreBlock
  narrativeScore: CallAnalysisNarrativeScore
  callTypeInterpretation: string
  summary: string
  strengths: string[]
  risks: string[]
  nextStepQuality: CallAnalysisNextStepQuality
  suggestedNextStep: string
  emotionalBackground: CallAnalysisEmotionalBackground
  evidenceQuotes: string[]
  confidence: number
}

export interface CallAnalysisResult {
  callId: string
  runId: string
  status: Extract<CallAnalysisRunStatus, 'ready'>
  transcriptByRoles: CallAnalysisTranscriptSegment[]
  fullTranscriptText: string
  aiEvaluation: CallAnalysisAiEvaluation
  rawAiEvaluation: Record<string, unknown>
  attributes: Record<string, unknown>
  model: string
  promptVersion: string
  analyzedAt: string
  updatedAt: string
}

export interface CallAnalysisRunResponse {
  status: Extract<CallAnalysisRunStatus, 'ready'>
  reusedExistingResult: boolean
  result: CallAnalysisResult
}

export interface CallAnalysisLookupResponse {
  status: Extract<CallAnalysisRunStatus, 'ready'>
  result: CallAnalysisResult
}

export type CallAnalysisQueueStatus =
  | 'not_analyzed'
  | 'analyzing'
  | 'ready'
  | 'error'

export type CallAnalysisQueueCallType =
  | 'outgoing_over_30'
  | 'outgoing_under_30'
  | 'incoming'
  | 'unknown'

export interface CallAnalysisQueueItem {
  callId: string
  crmActivityId: string | null
  startedAt: string
  managerId: string | null
  managerName: string
  callType: CallAnalysisQueueCallType
  callTypeLabel: string
  durationSeconds: number
  dealId: string | null
  dealSourceId: string | null
  dealCurrentStageId: string | null
  dealCurrentStageName: string | null
  stageAtCallId: string | null
  stageAtCallName: string | null
  analysisStatus: CallAnalysisQueueStatus
  score: number | null
  promptVersion: string | null
  model: string | null
  analyzedAt: string | null
  updatedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  bitrixUrl?: string | null
}

export interface CallAnalysisQueueTotals {
  total: number
  notAnalyzed: number
  analyzing: number
  ready: number
  error: number
  averageScore: number | null
}

export interface CallAnalysisQueueResponse {
  range: ReportRange
  totals: CallAnalysisQueueTotals
  items: CallAnalysisQueueItem[]
}

export interface DealTaskSummary {
  created: number
  closed: number
}

export interface DealMeetingSummary {
  total: number
}

export interface DealMeetingEvent {
  activityId: string
  createdAt: string
  timelineAt: string
  scheduledAt: string
  completed: boolean
  slotIndex?: 1 | 2 | 3 | null
  typeValue?: string | null
  placeValue?: string | null
  calendarValue?: string | null
  eventId?: string | null
}

export interface DealStageTimelineEntry {
  stageId: string
  stageName: string
  enteredAt: string
  leftAt: string
  durationHours: number
  callSummary?: DealCallSummary
  taskSummary?: DealTaskSummary
  meetingEvents?: DealMeetingEvent[]
}

export type DealLifecycleStatus = 'won' | 'lost' | 'wip'

export type DealTimelineEventKind =
  | 'call'
  | 'task_created'
  | 'task_completed'
  | 'meeting'
  | 'meeting_date_changed'
  | 'conversion_event_visit'

export interface DealTimelineEvent {
  id: string
  kind: DealTimelineEventKind
  occurredAt: string
  stageId: string | null
  stageName: string | null
  title: string
  detail: string | null
  badgeLabel: string | null
  linkConfidence: 'high' | 'medium' | 'low'
}

export interface DealEventSummary {
  callSummary: DealCallSummary
  taskSummary: DealTaskSummary
  meetingSummary: DealMeetingSummary
  conversionEventVisits: number
}

export type DealSaleCostSourceSystem = 'rule' | 'fact'

export interface DealSaleCostRow {
  id: string
  articleId: string
  label: string
  amount: number
  basis: string
  sourceSystem: DealSaleCostSourceSystem
  confidence: UnitEconomicsCostConfidence
}

export type DealSaleRevenueMode = 'actual' | 'planned' | 'none'

export interface DealSaleEconomics {
  revenueMode: DealSaleRevenueMode
  attractionRevenueAmount: number | null
  membershipAmount: number
  saleCostAmount: number
  marginAmount: number | null
  allocatedFixedCostAmount: number
  fullyLoadedCostAmount: number
  fullyLoadedMarginAmount: number | null
  costRows: DealSaleCostRow[]
  allocatedFixedCostRows: DealSaleCostRow[]
}

export interface DealLifecycleStageTimelineEntry extends DealStageTimelineEntry {
  callSummary: DealCallSummary
  taskSummary: DealTaskSummary
  meetingEvents: DealMeetingEvent[]
  events: DealTimelineEvent[]
}

export interface DealLifecycleCard {
  dealId: string
  managerId: string
  managerName: string
  status: DealLifecycleStatus
  stageId: string
  stageName: string
  dateCreate: string
  dateClosed: string | null
  dateModify: string
  cycleDays: number | null
  sourceKey?: string
  sourceLabel?: string
  qualityValue?: string | null
  businessClubValue?: string | null
  targetGroupValue?: string | null
  meetingTypeValue?: string | null
  meetingDateValue?: string | null
  tariffValue?: string | null
  economics: DealSaleEconomics
  eventSummary: DealEventSummary
  stageTimeline: DealLifecycleStageTimelineEntry[]
  cohortContext?: DealCohortContext
  sla?: {
    sla1: ManagerActionOutcomeDealSla
    sla2: ManagerActionOutcomeDealSla
    sla3: ManagerActionOutcomeDealSla
  }
}

export interface SalesDealRow {
  dealId: string
  dealTitle: string
  managerId: string
  managerName: string
  amount: number
  attractionRevenueAmount: number | null
  membershipAmount: number
  pricingStatus: DealPricingStatus
  pricingWarnings: string[]
  dateCreate: string
  dateClosed: string
  cycleDays: number
  sourceKey?: string
  sourceLabel?: string
  qualityValue?: string | null
  businessClubValue?: string | null
  targetGroupValue?: string | null
  meetingTypeValue?: string | null
  meetingDateValue?: string | null
  tariffValue?: string | null
  cohortContext: DealCohortContext
  callSummary: DealCallSummary
  taskSummary: DealTaskSummary
  meetingSummary?: DealMeetingSummary
  stageTimeline: DealStageTimelineEntry[]
  lifecycleCard?: DealLifecycleCard
}

export interface SalesManagerGroup {
  managerId: string
  managerName: string
  totalWonDeals: number
  totalSalesAmount: number
  totalAttractionRevenueAmount: number
  averageAttractionRevenueAmount: number
  totalMembershipAmount: number
  averageMembershipAmount: number
  deals: SalesDealRow[]
}

export interface FunnelSnapshotEntry {
  stageId: string
  stageName: string
  count: number
  amount: number
}

export interface SourceBreakdownEntry {
  sourceKey: string
  sourceLabel: string
  salesCount: number
  salesAmount: number
  newDealsCount: number
  newLeadsCount: number
}

export interface DashboardDataSnapshot {
  salesSummary: SalesSummary
  managerGroups: SalesManagerGroup[]
}

export interface DashboardData extends DashboardDataSnapshot {
  comparisons?: Array<ReportComparison<DashboardDataSnapshot>>
}

export interface SalesPlanRow {
  periodStart: string
  periodEnd: string
  managerId: string
  managerName: string | null
  targetGroupKey: string
  targetGroupLabel: string
  plannedDeals: number
  plannedAmount: number
  updatedAt: string
}

export interface SalesPlanDraftRow {
  managerId: string
  managerName?: string | null | undefined
  targetGroupKey: string
  targetGroupLabel?: string | null | undefined
  plannedDeals: number
  plannedAmount: number
}

export interface SalesPlanData {
  periodStart: string
  periodEnd: string
  rows: SalesPlanRow[]
  updatedAt: string | null
}

export interface SalesPlanInput {
  periodStart: string
  periodEnd: string
  rows: SalesPlanDraftRow[]
}

export interface SalesPlanQuarterMonth {
  month: string
  label: string
  periodStart: string
  periodEnd: string
}

export interface SalesPlanQuarterRowMonth {
  month: string
  periodStart: string
  periodEnd: string
  plannedDeals: number
  plannedAmount: number
  updatedAt: string | null
}

export interface SalesPlanQuarterRow {
  managerId: string
  managerName: string | null
  targetGroupKey: string
  targetGroupLabel: string
  quarterPlannedDeals: number
  quarterPlannedAmount: number
  months: SalesPlanQuarterRowMonth[]
  updatedAt: string | null
}

export interface SalesPlanQuarterData {
  year: number
  quarter: number
  periodStart: string
  periodEnd: string
  months: SalesPlanQuarterMonth[]
  rows: SalesPlanQuarterRow[]
  updatedAt: string | null
}

export interface SalesPlanQuarterDraftMonth {
  month: string
  plannedDeals: number
  plannedAmount: number
}

export interface SalesPlanQuarterDraftRow {
  managerId: string
  managerName?: string | null | undefined
  targetGroupKey: string
  targetGroupLabel?: string | null | undefined
  quarterPlannedDeals: number
  quarterPlannedAmount: number
  months: SalesPlanQuarterDraftMonth[]
}

export interface SalesPlanQuarterInput {
  year: number
  quarter: number
  rows: SalesPlanQuarterDraftRow[]
}

export interface StageSequenceEntry {
  stageId: string
  stageName: string
  sortOrder: number
}

export interface StageProgressionMetric {
  stageId: string
  stageName: string
  reachedDeals: number
  conversionRate: number
  averageStageDurationHours: number
}

export interface SourceQualityConversionRow {
  sourceKey: string
  sourceLabel: string
  qualityKey: string
  qualityLabel: string
  createdDeals: number
  wonDeals: number
  stageMetrics: StageProgressionMetric[]
}

export interface SourceQualityConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalWonDeals: number
  rows: SourceQualityConversionRow[]
  stageSequence: StageSequenceEntry[]
}

export interface SourceQualityConversionReport
  extends SourceQualityConversionReportSnapshot {
  comparisons?: Array<ReportComparison<SourceQualityConversionReportSnapshot>>
}

export interface SourceCohortConversionOpenStageRow {
  stageId: string
  stageName: string
  openDeals: number
}

export interface SourceCohortConversionManagerRow {
  managerId: string
  managerName: string
  createdDeals: number
  wonDeals: number
  lostDeals: number
  openDeals: number
  winRate: number
  averageDaysToWin: number
  openStageBreakdown: SourceCohortConversionOpenStageRow[]
}

export interface SourceCohortConversionTargetGroupRow {
  targetGroupKey: string
  targetGroupLabel: string
  wonDeals: number
  averageDaysToWin: number
}

export interface SourceCohortConversionRow {
  id: string
  sourceKey: string
  sourceLabel: string
  qualityKey: string
  qualityLabel: string
  customerKey: string
  customerLabel: string
  createdDeals: number
  wonDeals: number
  lostDeals: number
  openDeals: number
  winRate: number
  averageDaysToWin: number
  managerBreakdown: SourceCohortConversionManagerRow[]
  openStageBreakdown: SourceCohortConversionOpenStageRow[]
  targetGroupBreakdown: SourceCohortConversionTargetGroupRow[]
}

export interface SourceCohortConversionMonthOption {
  cohortMonth: string
  cohortLabel: string
  totalCreatedDeals: number
}

export type SourceCohortTrajectoryActionKey =
  | 'first_successful_call'
  | 'completed_meeting'
  | 'attended_event'

export type SourceCohortTrajectoryFactStepKey =
  | 'created'
  | 'first_successful_call'
  | 'meeting_stage'
  | 'completed_meeting'
  | 'attended_event'
  | 'contract_stage'
  | 'won'

export type SourceCohortTrajectoryGapKey =
  | 'no_successful_call'
  | 'successful_call_without_meeting_stage'
  | 'meeting_stage_without_fact'
  | 'completed_meeting_without_next_stage'
  | 'attended_event_without_contract'
  | 'contract_without_win'

export type SourceCohortTrajectoryQualityStatus =
  | 'reliable'
  | 'limited'
  | 'low_sample'

export interface SourceCohortTrajectoryStageNode {
  stageId: string
  stageName: string
  sortOrder: number
  reachedDeals: number
  reachedRate: number
  medianDaysFromCreate: number | null
  medianDaysOnStage: number | null
}

export interface SourceCohortTrajectoryActionNode {
  actionKey: SourceCohortTrajectoryActionKey
  label: string
  reachedDeals: number
  reachedRate: number
  medianDaysFromCreate: number | null
  evidence: string
}

export interface SourceCohortTrajectoryStageTransition {
  id: string
  fromStageId: string | null
  fromStageName: string | null
  fromSortOrder: number | null
  toStageId: string
  toStageName: string
  toSortOrder: number
  deals: number
  conversionRate: number
}

export interface SourceCohortTrajectoryFactStepNode {
  stepKey: SourceCohortTrajectoryFactStepKey
  label: string
  deals: number
  rateFromCohort: number
  rateFromPrevious: number
  medianDaysFromCreate: number | null
  evidence: string
}

export interface SourceCohortTrajectoryGapRow {
  gapKey: SourceCohortTrajectoryGapKey
  label: string
  deals: number
  rate: number
  denominatorStepKey: SourceCohortTrajectoryFactStepKey
  evidence: string
  managementQuestion: string
}

export type SourceCohortTrajectorySpeedStepKey =
  | 'first_successful_call'
  | 'completed_meeting'
  | 'attended_event'
  | 'contract_stage'
  | 'post_meeting_next_stage'

export interface SourceCohortTrajectorySpeedBucket {
  bucketKey: string
  label: string
  minDays: number | null
  maxDays: number | null
  deals: number
  rate: number
}

export interface SourceCohortTrajectorySpeedStep {
  stepKey: SourceCohortTrajectorySpeedStepKey
  label: string
  totalDeals: number
  medianDays: number | null
  slaDays: number
  slowDeals: number
  slowRate: number
  buckets: SourceCohortTrajectorySpeedBucket[]
}

export type SourceCohortTrajectoryDiagnosticStatus =
  | 'strength'
  | 'bottleneck'
  | 'mixed'
  | 'low_sample'

export type SourceCohortTrajectoryDiagnosticSeverity =
  | 'positive'
  | 'warning'
  | 'neutral'

export interface SourceCohortTrajectoryDiagnosticSignal {
  signalKey: string
  label: string
  value: number
  benchmarkValue: number | null
  delta: number | null
  unit: string
  severity: SourceCohortTrajectoryDiagnosticSeverity
}

export interface SourceCohortTrajectoryManagerDiagnostic {
  managerId: string
  managerName: string
  totalDeals: number
  status: SourceCohortTrajectoryDiagnosticStatus
  headline: string
  strengths: SourceCohortTrajectoryDiagnosticSignal[]
  bottlenecks: SourceCohortTrajectoryDiagnosticSignal[]
  recommendedFocus: string
  sampleWarning: string | null
}

export type SourceCohortTrajectoryLossShapeKey =
  | 'not_reached_successful_call'
  | 'call_without_meeting_stage'
  | 'meeting_stage_without_fact'
  | 'meeting_fact_without_next_stage'
  | 'event_without_contract'
  | 'contract_without_win'
  | 'terminal_loss'
  | 'open_wip'

export interface SourceCohortTrajectoryLossShapeReason {
  shapeKey: SourceCohortTrajectoryLossShapeKey
  label: string
  deals: number
  rate: number
  evidence: string
  recommendedQuestion: string
}

export interface SourceCohortTrajectoryLossShape {
  dominantShapeKey: SourceCohortTrajectoryLossShapeKey
  dominantShapeLabel: string
  dominantDeals: number
  dominantRate: number
  terminalLossDeals: number
  openWipDeals: number
  reasons: SourceCohortTrajectoryLossShapeReason[]
}

export interface SourceCohortTrajectorySignals {
  noSuccessfulCallDeals: number
  firstSuccessfulCallDeals: number
  firstSuccessfulCallFallbackDeals: number
  successfulCallWithoutMeetingStageDeals: number
  meetingStageDeals: number
  meetingStageWithoutFactDeals: number
  completedMeetingDeals: number
  completedMeetingWithoutNextStageDeals: number
  attendedEventDeals: number
  attendedEventWithoutContractDeals: number
  contractWithoutWinDeals: number
  slowFirstSuccessfulCallDeals: number
  slowCompletedMeetingDeals: number
  slowAttendedEventDeals: number
  slowContractStageDeals: number
  staleAfterCompletedMeetingDeals: number
  staleOpenContractStageDeals: number
  repeatAttendedEventDeals: number
  repeatAttendedEventVisits: number
  contractStageDeals: number
  contractStageRate: number
  medianDaysToContractStage: number | null
  medianDaysOnContractStage: number | null
  wonDeals: number
  lostDeals: number
  openDeals: number
}

export interface SourceCohortTrajectoryDataQuality {
  totalDeals: number
  stageHistoryDeals: number
  stageHistoryCoverageRate: number
  touchpointDeals: number
  touchpointCoverageRate: number
  eventVisitDeals: number
  eventVisitCoverageRate: number
  businessClubDeals: number
  businessClubCoverageRate: number
  businessClubMissingDeals: number
  warnings: string[]
}

export interface SourceCohortTrajectoryBreakdownRow
  extends SourceCohortTrajectorySignals {
  key: string
  label: string
  totalDeals: number
  firstSuccessfulCallDeals: number
  firstSuccessfulCallRate: number
  medianDaysToFirstSuccessfulCall: number | null
  meetingStageDeals: number
  meetingStageRate: number
  completedMeetingDeals: number
  completedMeetingRate: number
  medianDaysToCompletedMeeting: number | null
  attendedEventDeals: number
  attendedEventRate: number
  medianDaysToAttendedEvent: number | null
  wonDeals: number
  wonRate: number
  lostDeals: number
  openDeals: number
  dataQualityStatus: SourceCohortTrajectoryQualityStatus
  lossShape: SourceCohortTrajectoryLossShape
}

export interface SourceCohortTrajectoryManagerRow
  extends SourceCohortTrajectoryBreakdownRow {
  managerId: string
  managerName: string
}

export interface SourceCohortTrajectoryReport {
  range: ReportRange
  totalDeals: number
  stageNodes: SourceCohortTrajectoryStageNode[]
  stageTransitions: SourceCohortTrajectoryStageTransition[]
  actionNodes: SourceCohortTrajectoryActionNode[]
  factSteps: SourceCohortTrajectoryFactStepNode[]
  conversionGaps: SourceCohortTrajectoryGapRow[]
  speedSteps: SourceCohortTrajectorySpeedStep[]
  overallSignals: SourceCohortTrajectorySignals
  managerDiagnostics: SourceCohortTrajectoryManagerDiagnostic[]
  managerRows: SourceCohortTrajectoryManagerRow[]
  sourceRows: SourceCohortTrajectoryBreakdownRow[]
  customerRows: SourceCohortTrajectoryBreakdownRow[]
  dataQuality: SourceCohortTrajectoryDataQuality
}

export type SourceCohortTrajectoryAvailabilityStatus =
  | 'available'
  | 'unavailable'

export interface SourceCohortConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalWonDeals: number
  totalLostDeals: number
  totalOpenDeals: number
  winRate: number
  averageDaysToWin: number
  cohortMonths: SourceCohortConversionMonthOption[]
  rows: SourceCohortConversionRow[]
  trajectoryStatus: SourceCohortTrajectoryAvailabilityStatus
  trajectoryUnavailableReason: string | null
  trajectory?: SourceCohortTrajectoryReport
}

export interface SourceCohortConversionReport
  extends SourceCohortConversionReportSnapshot {
  comparisons?: Array<ReportComparison<SourceCohortConversionReportSnapshot>>
}

export interface StageWorkloadMetric {
  stageId: string
  stageName: string
  dealCount: number
  createdCount: number
  rescheduledCount: number
  closedCount: number
  averageCreatedPerDeal: number
  averageRescheduledPerDeal: number
  averageClosedPerDeal: number
}

export interface MeetingTypeBucket {
  meetingTypeKey: string
  meetingTypeLabel: string
  count: number
}

export interface BusinessClubDealBucket {
  businessClubKey: string
  businessClubLabel: string
  dealCount: number
}

export interface MeetingBusinessClubBucket {
  businessClubKey: string
  businessClubLabel: string
  meetingSlotIndex?: 1 | 2 | 3 | null
  meetingSlotLabel?: string | null
  meetingTypeKey: string
  meetingTypeLabel: string
  count: number
}

export interface SlaMetric {
  slaKey: 'sla1' | 'sla2' | 'sla3'
  label: string
  onTimeCount: number
  lateCount: number
  noTouchCount: number
  medianHours: number
}

export interface ManagerActivitiesWorkloadRow {
  managerId: string
  managerName: string
  dealCount: number
  createdCount: number
  rescheduledCount: number
  closedCount: number
  meetingCount: number
  averageCreatedPerDeal: number
  averageRescheduledPerDeal: number
  averageClosedPerDeal: number
  averageMeetingsPerDeal: number
  meetingTypeBreakdown: MeetingTypeBucket[]
  businessClubBreakdown: BusinessClubDealBucket[]
  meetingBusinessClubBreakdown?: MeetingBusinessClubBucket[]
  tasksHourlyHeatmap?: HourlyWeekdayWorkloadHeatmap
  createdTasksHourlyHeatmap?: HourlyWeekdayWorkloadHeatmap
  closedTasksHourlyHeatmap?: HourlyWeekdayWorkloadHeatmap
  meetingsHourlyHeatmap?: HourlyWeekdayWorkloadHeatmap
  slaMetrics: SlaMetric[]
  stageBreakdown: StageWorkloadMetric[]
}

export interface ActivityConversionEventStageBreakdown {
  stageId: string
  stageName: string
  invitedCount: number
}

export interface ActivityConversionEventRow {
  eventKey: string
  eventName: string
  eventDate: string
  invitedCount: number
  attendedCount: number
  refusedCount: number
  waitingCount: number
  stageBreakdown: ActivityConversionEventStageBreakdown[]
}

export interface ActivitiesWorkloadReportSnapshot {
  range: ReportRange
  totalDealCount: number
  totalCreatedCount: number
  totalRescheduledCount: number
  totalClosedCount: number
  totalMeetingCount: number
  warnings: string[]
  managerRows: ManagerActivitiesWorkloadRow[]
  conversionEventRows: ActivityConversionEventRow[]
}

export interface ActivitiesWorkloadReport extends ActivitiesWorkloadReportSnapshot {
  comparisons?: Array<ReportComparison<ActivitiesWorkloadReportSnapshot>>
}

export interface StageCallMetric {
  stageId: string
  stageName: string
  dealCount: number
  totalCalls: number
  incomingCalls: number
  missedIncomingCalls?: number
  outgoingCalls: number
  otherOutgoingCalls: number
  connectedCalls: number
  failedCalls: number
  callsOverThirtySeconds: number
  connectedCallsOverThirtySeconds: number
  averageCallsPerDeal: number
  averageDurationSeconds: number
}

export interface CallPopulationSummary {
  totalCalls: number
  incomingCalls: number
  missedIncomingCalls?: number
  outgoingCalls: number
  otherOutgoingCalls: number
  connectedCalls: number
  failedCalls: number
  callsOverThirtySeconds: number
  connectedCallsOverThirtySeconds: number
  averageDurationSeconds: number
}

export type CallAttributionPolicy = 'standard' | 'direct_only'

export interface LinkedDealCallPopulationSummary extends CallPopulationSummary {
  dealCount: number
  averageCallsPerDeal: number
  stageBreakdown: StageCallMetric[]
  excludedByPolicyCalls?: CallPopulationSummary
}

export interface LinkedDealCallReportSummary extends CallPopulationSummary {
  totalDealCount: number
  excludedByPolicyCalls?: CallPopulationSummary
}

export interface ManagerCallsWorkloadRow {
  managerId: string
  managerName: string
  dealCount: number
  totalCalls: number
  incomingCalls: number
  missedIncomingCalls?: number
  outgoingCalls: number
  otherOutgoingCalls: number
  connectedCalls: number
  failedCalls: number
  callsOverThirtySeconds: number
  connectedCallsOverThirtySeconds: number
  averageCallsPerDeal: number
  averageDurationSeconds: number
  callAttributionPolicy?: CallAttributionPolicy
  allCalls?: CallPopulationSummary
  linkedDealCalls?: LinkedDealCallPopulationSummary
  callsHourlyHeatmap?: HourlyWeekdayWorkloadHeatmap
  stageBreakdown: StageCallMetric[]
}

export interface CallsWorkloadReportSnapshot {
  range: ReportRange
  totalDealCount: number
  totalCalls: number
  totalIncomingCalls: number
  totalMissedIncomingCalls?: number
  totalOutgoingCalls: number
  totalOtherOutgoingCalls: number
  totalConnectedCalls: number
  totalFailedCalls: number
  totalCallsOverThirtySeconds: number
  totalConnectedCallsOverThirtySeconds: number
  allCalls?: CallPopulationSummary
  linkedDealCalls?: LinkedDealCallReportSummary
  warnings: string[]
  managerRows: ManagerCallsWorkloadRow[]
}

export interface CallsWorkloadReport extends CallsWorkloadReportSnapshot {
  comparisons?: Array<ReportComparison<CallsWorkloadReportSnapshot>>
}

export interface AcquisitionOutcomeQualityBucket {
  qualityKey: string
  qualityLabel: string
  count: number
}

export interface AcquisitionOutcomeSourceBucket {
  sourceKey: string
  sourceLabel: string
  totalNewDeals: number
  qualities: AcquisitionOutcomeQualityBucket[]
}

export interface AcquisitionOutcomeNewDealsByManagerRow {
  managerId: string
  managerName: string
  totalNewDeals: number
  sources: AcquisitionOutcomeSourceBucket[]
}

export interface AcquisitionOutcomeStageBucket {
  stageId: string
  stageName: string
  count: number
}

export interface AcquisitionOutcomeLostDealsByManagerRow {
  managerId: string
  managerName: string
  totalLostDeals: number
  stages: AcquisitionOutcomeStageBucket[]
}

export interface AcquisitionOutcomeReasonRow {
  stageId: string
  stageName: string
  managerId: string
  managerName: string
  reasonKey: string
  reasonLabel: string
  count: number
}

export interface AcquisitionOutcomeBusinessClubBucket {
  businessClubKey: string
  businessClubLabel: string
  count: number
}

export interface AcquisitionOutcomeTargetGroupBucket {
  targetGroupKey: string
  targetGroupLabel: string
  count: number
}

export interface AcquisitionOutcomeBusinessClubByManagerRow {
  managerId: string
  managerName: string
  totalDeals: number
  businessClubs: AcquisitionOutcomeBusinessClubBucket[]
  targetGroups: AcquisitionOutcomeTargetGroupBucket[]
}

export interface LostDealDetailRow {
  dealId: string
  managerId: string
  managerName: string
  sourceKey: string
  sourceLabel: string
  businessClubValue: string | null
  stageId: string
  stageName: string
  reasonKey: string
  reasonLabel: string
  reasonDetail: string | null
}

export interface AcquisitionOutcomesReportSnapshot {
  range: ReportRange
  totalNewDeals: number
  totalLostDeals: number
  newDealsByManager: AcquisitionOutcomeNewDealsByManagerRow[]
  lostDealsByManager: AcquisitionOutcomeLostDealsByManagerRow[]
  lostStages: AcquisitionOutcomeStageBucket[]
  businessClubByManager: AcquisitionOutcomeBusinessClubByManagerRow[]
  topLossReasons: AcquisitionOutcomeReasonRow[]
  lostDealDetails: LostDealDetailRow[]
}

export interface AcquisitionOutcomesReport
  extends AcquisitionOutcomesReportSnapshot {
  comparisons?: Array<ReportComparison<AcquisitionOutcomesReportSnapshot>>
}

export interface TargetGroupConversionRow {
  targetGroupKey: string
  targetGroupLabel: string
  createdDeals: number
  wonDeals: number
  winRate: number
  salesAmount: number
  averageSaleAmount: number
  averageCycleDays: number
}

export interface TargetGroupConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalWonDeals: number
  rows: TargetGroupConversionRow[]
}

export interface TargetGroupConversionReport
  extends TargetGroupConversionReportSnapshot {
  comparisons?: Array<ReportComparison<TargetGroupConversionReportSnapshot>>
}

export interface ConversionEventBreakdownRow {
  key: string
  label: string
  count: number
}

export interface ConversionEventRow {
  eventKey: string
  eventName: string
  eventDate: string
  invitedCount: number
  confirmedCount: number
  attendedCount: number
  refusedCount: number
  missedCount: number
  attendanceRate: number | null
  nextStepEligibleCount: number
  nextStepCount: number
  nextStepRate: number | null
  unlinkedCount: number
  unknownStatusCount: number
  managerBreakdown: ConversionEventBreakdownRow[]
  sourceBreakdown: ConversionEventBreakdownRow[]
  businessClubBreakdown: ConversionEventBreakdownRow[]
}

export interface ConversionEventsReportSnapshot {
  range: ReportRange
  totalInvitedCount: number
  totalConfirmedCount: number
  totalAttendedCount: number
  totalRefusedCount: number
  totalMissedCount: number
  attendanceRate: number | null
  nextStepEligibleCount: number
  nextStepCount: number
  nextStepRate: number | null
  warnings: string[]
  rows: ConversionEventRow[]
}

export interface ConversionEventsReport extends ConversionEventsReportSnapshot {
  comparisons?: Array<ReportComparison<ConversionEventsReportSnapshot>>
}

export interface ConversionEventTypeOption {
  id: string
  title: string
  categoryId: number | null
  stageId: string | null
  selectedForPlannedInventory: boolean
}

export interface ModuleEventTypeSetting {
  moduleKey: string
  eventTypeId: string
  eventTypeLabel: string
  enabled: boolean
  updatedAt: string
}

export interface ConversionEventTypeSettingsData {
  options: ConversionEventTypeOption[]
  settings: ModuleEventTypeSetting[]
}

export interface ConversionEventTypeSettingsInput {
  eventTypeIds: string[]
}

export interface ManagerActionOutcomeRow {
  managerId: string
  managerName: string
  createdTasks: number
  closedTasks: number
  totalCalls: number
  successfulCallsOverThirtySeconds: number
  meetingsCount: number
  sla1OnTimeCount: number
  sla1LateCount: number
  sla1NoTouchCount: number
  sla1MedianHours: number
  sla2OnTimeCount: number
  sla2LateCount: number
  sla2NoTouchCount: number
  sla2MedianHours: number
  sla3OnTimeCount: number
  sla3LateCount: number
  sla3NoTouchCount: number
  sla3MedianHours: number
  newDealsCount: number
  wonDealsCount: number
  winRate: number
  salesAmount: number
  averageSaleAmount: number
  averageCycleDays: number
}

export type ManagerActionOutcomeStatus = 'won' | 'lost' | 'wip'

export interface ManagerActionOutcomeCohortOption {
  cohortMonth: string
  cohortLabel: string
  totalCreatedDeals: number
}

export type ManagerActionOutcomeDealSlaStatus = 'onTime' | 'late' | 'noTouch'

export interface ManagerActionOutcomeDealSla {
  status: ManagerActionOutcomeDealSlaStatus
  hours: number | null
}

export interface ManagerActionOutcomeDealDetail {
  dealId: string
  stageId: string
  stageName: string
  amount: number
  dateCreate: string
  dateClosed: string | null
  dateModify: string
  sourceKey?: string
  sourceLabel?: string
  qualityValue?: string | null
  businessClubValue?: string | null
  targetGroupValue?: string | null
  meetingTypeValue?: string | null
  meetingDateValue?: string | null
  tariffValue?: string | null
  taskSummary: DealTaskSummary
  callSummary: DealCallSummary
  meetingSummary: DealMeetingSummary
  sla: {
    sla1: ManagerActionOutcomeDealSla
    sla2: ManagerActionOutcomeDealSla
    sla3: ManagerActionOutcomeDealSla
  }
  stageTimeline: DealStageTimelineEntry[]
  lifecycleCard?: DealLifecycleCard
}

export interface ManagerActionOutcomeStatusRow {
  managerId: string
  managerName: string
  cohortMonth: string | null
  statusKey: ManagerActionOutcomeStatus
  statusLabel: string
  cohortCreatedDeals: number
  dealCount: number
  statusShare: number
  createdTasksPerDeal: number
  closedTasksPerDeal: number
  totalCallsPerDeal: number
  successfulCallsOverThirtySecondsPerDeal: number
  meetingsPerDeal: number
  sla1OnTimeRate: number
  sla2OnTimeRate: number
  sla3OnTimeRate: number
  financialAmount: number
  averageFinancialAmount: number
  dealDetails: ManagerActionOutcomeDealDetail[]
}

export interface ManagerActionOutcomeReportSnapshot {
  range: ReportRange
  warnings: string[]
  rows: ManagerActionOutcomeRow[]
  cohortMonths: ManagerActionOutcomeCohortOption[]
  cohortStatusRows: ManagerActionOutcomeStatusRow[]
}

export interface ManagerActionOutcomeReport
  extends ManagerActionOutcomeReportSnapshot {
  comparisons?: Array<ReportComparison<ManagerActionOutcomeReportSnapshot>>
}

export type CohortRelativeBucketKey =
  | 'month_1'
  | 'month_2'
  | 'month_3'
  | 'month_4_plus'

export interface CohortClosureBucket {
  closedMonth: string
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
}

export interface CohortRelativeClosureBucket {
  bucketKey: CohortRelativeBucketKey
  label: string
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
}

export interface CohortConversionRow {
  createdMonth: string
  createdDeals: number
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
  averageDaysToClose: number
  averageDaysToWin: number
  closureBuckets: CohortClosureBucket[]
  relativeClosureBuckets: CohortRelativeClosureBucket[]
}

export type CohortConversionBreakdownLevel = 'cohort' | 'source' | 'quality' | 'customer'

export interface CohortConversionBreakdownRow {
  id: string
  level: CohortConversionBreakdownLevel
  parentId: string | null
  cohortMonth: string | null
  cohortLabel: string | null
  sourceKey: string | null
  sourceLabel: string | null
  qualityKey: string | null
  qualityLabel: string | null
  customerKey: string | null
  customerLabel: string | null
  createdDeals: number
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
  averageDaysToClose: number
  averageDaysToWin: number
  relativeClosureBuckets: CohortRelativeClosureBucket[]
}

export interface CohortConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalClosedDeals: number
  totalWonDeals: number
  closureMonths: string[]
  relativeBucketKeys: CohortRelativeBucketKey[]
  rows: CohortConversionRow[]
  breakdownRows: CohortConversionBreakdownRow[]
}

export interface CohortConversionReport extends CohortConversionReportSnapshot {
  comparisons?: Array<ReportComparison<CohortConversionReportSnapshot>>
}

export interface TocFlowStageMetric {
  stageId: string
  stageName: string
  stageSemanticId: string | null
  sortOrder: number
  enteredDeals: number
  movedNextDeals: number
  throughputPerDay: number
  queueEnd: number
  queueBufferDays: number | null
  averageStageDurationDays: number
}

export interface TocFlowBottleneck {
  stageId: string
  stageName: string
  throughputPerDay: number
  queueEnd: number
  queueBufferDays: number | null
}

export interface TocStageDistributionNode {
  stageId: string
  stageName: string
  sortOrder: number
  dealCount: number
  shareOfCreatedDeals: number
}

export interface TocStageDistributionEdge {
  fromStageId: string | null
  fromStageName: string | null
  toStageId: string
  toStageName: string
  dealCount: number
  conversionRate: number
}

export interface TocStageDistributionRouteNode {
  step: number
  stageId: string
  stageName: string
  sortOrder: number
  dealCount: number
  shareOfCreatedDeals: number
}

export interface TocStageDistributionRouteEdge {
  fromStep: number
  fromStageId: string
  fromStageName: string
  toStep: number
  toStageId: string
  toStageName: string
  dealCount: number
  conversionRate: number
}

export interface TocStageDistribution {
  totalCreatedDeals: number
  nodes: TocStageDistributionNode[]
  edges: TocStageDistributionEdge[]
  routeNodes?: TocStageDistributionRouteNode[]
  routeEdges?: TocStageDistributionRouteEdge[]
}

export interface TocFlowReportSnapshot {
  range: ReportRange
  businessDays: number
  warnings: string[]
  estimatedGainPerDay: number | null
  rows: TocFlowStageMetric[]
  bottleneck: TocFlowBottleneck | null
  stageDistribution?: TocStageDistribution | null
}

export interface TocFlowReport extends TocFlowReportSnapshot {
  comparisons?: Array<ReportComparison<TocFlowReportSnapshot>>
}

export type RevenueVelocityDimension =
  | 'manager'
  | 'source'
  | 'customer'
  | 'managerSource'
  | 'sourceCustomer'
  | 'managerCustomer'

export type RevenueVelocityView =
  | 'systemState'
  | 'operationalPeriod'
  | 'createdCohort'

export interface RevenueVelocityActionWeights {
  connectedCallOverThirtySeconds: number
  meeting: number
  conversionEvent: number
  closedTask: number
}

export interface RevenueVelocityActionSummary {
  totalCalls: number
  connectedCallsOverThirtySeconds: number
  meetingsCount: number
  conversionEventsCount: number
  createdTasks: number
  closedTasks: number
  weightedActionPoints: number
  weightedActionPointsPerDeal: number | null
  weightedActionPointsPerWin: number | null
}

export interface RevenueVelocityMoneyPerAction {
  moneyPerMeeting: number | null
  moneyPerConnectedCallOverThirtySeconds: number | null
  moneyPerConversionEvent: number | null
  moneyPerClosedTask: number | null
  moneyPerWeightedActionPoint: number | null
  actionEfficiencyIndex: number | null
}

export type RevenueVelocityFormulaSource =
  | 'selectedCohort'
  | 'rollingQuarterCohort'

export interface RevenueVelocityFormulaBreakdown {
  source: RevenueVelocityFormulaSource
  sourceLabel: string
  averageRevenueAmount: number | null
  opportunitiesCount: number
  conversionRate: number | null
  averageCycleDays: number | null
  value: number | null
  benchmarkFrom: string | null
  benchmarkTo: string | null
  missingReason: string | null
}

export interface RevenueVelocityRow {
  dimension: RevenueVelocityDimension
  view: RevenueVelocityView
  key: string
  label: string
  managerId?: string | null
  managerName?: string | null
  sourceKey?: string | null
  sourceLabel?: string | null
  customerKey?: string | null
  customerLabel?: string | null
  createdDeals: number
  activeDeals: number
  wonDeals: number
  lostDeals: number
  wipDeals: number
  salesAmount: number
  averageCheck: number | null
  winRate: number | null
  averageCycleDays: number | null
  medianCycleDays: number | null
  revenueVelocityPerDay: number | null
  revenueVelocityFormula?: RevenueVelocityFormulaBreakdown | null
  activePipelineAmount: number
  expectedPipelineAmount: number | null
  previousExpectedPipelineAmount: number | null
  expectedPipelineDelta: number | null
  liveRevenueVelocity: number | null
  previousLiveRevenueVelocity: number | null
  velocityDelta: number | null
  velocityDeltaPercent: number | null
  averageRemainingDays: number | null
  realizedWonAmountInPeriod: number
  wonDealsInPeriod: number
  lostDealsInPeriod: number
  systemValueCreated: number | null
  actionPointsDelta: number | null
  systemValuePerActionPoint: number | null
  realizedMoneyPerActionPoint: number | null
  historicalMoneyPerActionPoint: number | null
  estimatedFutureMoneyFromPeriodActions: number | null
  actions: RevenueVelocityActionSummary
  moneyPerAction: RevenueVelocityMoneyPerAction
  bottleneckStageId: string | null
  bottleneckStageName: string | null
  warnings: string[]
}

export interface RevenueVelocityFormulaTooltip {
  key: string
  label: string
  formula: string
  description: string
  emptyState?: string
}

export interface RevenueVelocityReportSnapshot {
  range: ReportRange
  asOf: string
  previousAsOf: string | null
  dimension: RevenueVelocityDimension
  view: RevenueVelocityView
  actionWeights: RevenueVelocityActionWeights
  totals: RevenueVelocityRow
  rows: RevenueVelocityRow[]
  formulaTooltips: RevenueVelocityFormulaTooltip[]
  warnings: string[]
}

export interface RevenueVelocityReport extends RevenueVelocityReportSnapshot {
  comparisons?: Array<ReportComparison<RevenueVelocityReportSnapshot>>
}

export type UnitEconomicsPnlLevel =
  | 'variable_contribution'
  | 'above_ebitda'
  | 'below_ebitda'

export type UnitEconomicsCostBehavior = 'fixed' | 'variable' | 'mixed'

export type UnitEconomicsCalculationMethod =
  | 'manual_amount'
  | 'percent_of_module_revenue'
  | 'percent_of_sale'
  | 'percent_of_club_membership'
  | 'amount_per_lead'
  | 'amount_per_participant'
  | 'amount_per_contract'
  | 'amount_per_event'
  | 'amount_per_period'
  | 'imported_fact'

export type UnitEconomicsCostConfidence =
  | 'confirmed'
  | 'imported'
  | 'manual'
  | 'inferred'
  | 'needs_review'
  | 'conflicting'

export interface UnitEconomicsCostArticle {
  id: string
  name: string
  pnlLevel: UnitEconomicsPnlLevel
  costBehavior: UnitEconomicsCostBehavior
  calculationMethod: UnitEconomicsCalculationMethod
  enabled: boolean
  sortOrder: number
  effectiveFrom: string | null
  effectiveTo: string | null
  updatedAt: string | null
}

export interface UnitEconomicsCostRule {
  id: string
  articleId: string
  pnlLevel: UnitEconomicsPnlLevel
  costBehavior: UnitEconomicsCostBehavior
  calculationMethod: UnitEconomicsCalculationMethod
  unitPrice: number | null
  percent: number | null
  amount: number | null
  sourceKey: string | null
  qualityValue: string | null
  eventNamePattern?: string | null
  enabled: boolean
  effectiveFrom: string
  effectiveTo: string | null
  sortOrder: number
}

export interface UnitEconomicsCostRulesInput {
  rules: UnitEconomicsCostRule[]
  eventParticipantMode?: UnitEconomicsEventParticipantMode
}

export interface UnitEconomicsSettings {
  articles: UnitEconomicsCostArticle[]
  rules: UnitEconomicsCostRule[]
  eventParticipantMode: UnitEconomicsEventParticipantMode
  updatedAt: string | null
}

export interface UnitEconomicsSummary {
  createdDeals: number
  wonDeals: number
  purchasedLeads: number
  attractionRevenue: number
  clubRevenue: number
  leadPurchaseCost: number
  eventCost: number
  ambassadorActivityCost: number
  ctuCertificateCost: number
  contractationCost: number
  otherVariableCost: number
  variableCosts: number
  contributionResult: number
  contributionMargin: number | null
  aboveEbitdaCosts: number
  ebitda: number
  ebitdaMargin: number | null
  belowEbitdaCosts: number
  netProfit: number
  netProfitMargin: number | null
  attractionAverageCheck: number | null
  clubAverageCheck: number | null
  costPerWonDeal: number | null
  costPerCreatedDeal: number | null
}

export interface UnitEconomicsSourceQualityRow {
  sourceKey: string
  sourceLabel: string
  qualityValue: string | null
  createdDeals: number
  wonDeals: number
  purchasedLeads: number
  attractionRevenue: number
  clubRevenue: number
  leadPurchaseCost: number
  contractationCost: number
  variableCosts: number
  financialResult: number
  margin: number | null
  warnings: string[]
}

export interface UnitEconomicsManagerRevenueRow {
  clubLabel: string | null
  tariffLabel: string | null
  wonDeals: number
  attractionRevenue: number
  clubRevenue: number
}

export interface UnitEconomicsManagerCostDetailRow {
  articleId: string
  articleLabel: string
  productLabel: string
  quantity: number | null
  unitLabel: string | null
  unitPrice: number | null
  percent: number | null
  amount: number
  basis: string
  warnings: string[]
}

export interface UnitEconomicsManagerRow {
  managerId: string
  managerName: string
  createdDeals: number
  wonDeals: number
  purchasedLeads: number
  attractionRevenue: number
  clubRevenue: number
  leadPurchaseCost: number
  eventCost: number
  ambassadorActivityCost: number
  ctuCertificateCost: number
  contractationCost: number
  variableCosts: number
  financialResult: number
  margin: number | null
  warnings: string[]
  revenueRows: UnitEconomicsManagerRevenueRow[]
  productionCostRows: UnitEconomicsManagerCostDetailRow[]
  directCostRows: UnitEconomicsManagerCostDetailRow[]
  taxAndFinanceRows: UnitEconomicsManagerCostDetailRow[]
}

export interface UnitEconomicsCostRow {
  articleId: string
  label: string
  pnlLevel: UnitEconomicsPnlLevel
  costBehavior: UnitEconomicsCostBehavior
  calculationMethod: UnitEconomicsCalculationMethod
  amount: number
  quantity: number | null
  unitPrice: number | null
  percent: number | null
  sourceKey: string | null
  qualityValue: string | null
  confidence: UnitEconomicsCostConfidence
  sourceSystem: string
  warnings: string[]
}

export interface UnitEconomicsReportSnapshot {
  range: ReportRange
  summary: UnitEconomicsSummary
  sourceQualityRows: UnitEconomicsSourceQualityRow[]
  managerRows: UnitEconomicsManagerRow[]
  costRows: UnitEconomicsCostRow[]
  warnings: string[]
}

export interface UnitEconomicsReport extends UnitEconomicsReportSnapshot {
  comparisons?: Array<ReportComparison<UnitEconomicsReportSnapshot>>
}

export type UnitEconomicsQuery = DashboardQuery & {
  eventParticipantMode?: UnitEconomicsEventParticipantMode
}

export type RevenueVelocityQuery = DashboardQuery & {
  dimension?: RevenueVelocityDimension
  view?: RevenueVelocityView
  asOf?: string
  customerKeys?: string[]
  qualityKeys?: string[]
  tariffKeys?: string[]
}

export interface ManagerDirectoryEntry {
  id: string
  name: string
  callAttributionPolicy?: CallAttributionPolicy
}

export interface ManagerWhitelistSetting {
  moduleKey: string
  managerId: string
  managerName: string
  enabled: boolean
  sortOrder: number
  updatedAt: string
  teamId?: string | null
  teamName?: string | null
}

export interface ManagerTeamSetting {
  id: string
  name: string
  managerIds: string[]
  sortOrder: number
  updatedAt: string
}

export interface ManagerWhitelistSettingsData {
  options: ManagerDirectoryEntry[]
  settings: ManagerWhitelistSetting[]
  teams?: ManagerTeamSetting[]
}

export interface ManagerWhitelistSettingsInput {
  managerIds: string[]
  teams?: Array<{
    id?: string | null
    name: string
    managerIds: string[]
  }>
}

export interface SourceCatalogEntry {
  key: string
  label: string
}

export interface StageCatalogEntry {
  entityType: 'deal' | 'lead' | 'source'
  categoryId: string | null
  statusId: string
  name: string
  semanticId: string | null
}

export type OntologyStatus =
  | 'confirmed'
  | 'needs-sync'
  | 'draft'
  | 'deprecated'
  | 'unclassified'

export interface OntologySourceRef {
  id: string
  label: string
  kind: 'google-doc' | 'google-sheet' | 'markdown' | 'bitrix' | 'dashboard' | 'decision'
  href: string
  canonicality: 'canonical' | 'supporting' | 'implementation' | 'decision'
}

export interface OntologyConcept {
  id: string
  type: 'stage' | 'transition' | 'outcome' | 'delivery_quality' | 'format' | 'source'
  label: string
  status: OntologyStatus
  definition: string
  not: string[]
  bitrix?: {
    categoryId: string
    stageId?: string
    fieldCode?: string
    enumValue?: string
  }
  sourceIds: string[]
  reportBindingIds: string[]
}

export interface OntologyTransition {
  id: string
  label: string
  status: OntologyStatus
  fromConceptId: string
  toConceptId: string
  definition: string
  trigger?: string
  sourceIds: string[]
  reportBindingIds: string[]
}

export interface OntologyReportBinding {
  id: string
  label: string
  sceneId: string
  blockId: string
  href: string
}

export interface OntologyDriftItem {
  kind: 'stage' | 'source' | 'reason' | 'report_binding'
  severity: 'info' | 'warning' | 'blocking'
  label: string
  message: string
}

export interface AttractionOntologyResponse {
  moduleKey: 'attraction'
  title: string
  governance: {
    decisionRole: string
    decisionUnit: string
  }
  lastReviewedAt: string
  sources: OntologySourceRef[]
  concepts: OntologyConcept[]
  transitions: OntologyTransition[]
  reportBindings: OntologyReportBinding[]
  drift: OntologyDriftItem[]
}

export interface OntologySourceDocumentResponse {
  moduleKey: 'attraction'
  source: OntologySourceRef
  content: string
}

export interface LastSyncSummary {
  finishedAt: string
  leadsSynced: number
  dealsSynced: number
  mode: 'full' | 'delta'
  dealBreakdown: SyncDealChangeBreakdown
}

export interface SnapshotStats {
  deals: number
  activities: number
  calls: number
  stageHistory: number
}

export interface SyncChangeSummary {
  deals: number
  dealBreakdown: SyncDealChangeBreakdown
  activities: number
  calls: number
  stageHistory: number
  managers: number
}

export interface SyncDealChangeBreakdown {
  total: number
  created: number
  updated: number
  closed: number
  reopened: number
  unchanged: number
}

export type SyncProgressPhase =
  | 'inspect_snapshot'
  | 'fetch_catalogs'
  | 'fetch_deals'
  | 'fetch_activities'
  | 'fetch_calls'
  | 'persist_snapshot'
  | 'complete'
  | 'failed'

export interface SyncProgressEvent {
  syncRunId: number | null
  phase: SyncProgressPhase
  progress: number
  message: string
  snapshotBefore?: SnapshotStats
  snapshotAfter?: SnapshotStats
  changes?: SyncChangeSummary
  mode?: 'full' | 'delta'
  modifiedAfter?: string | null
  startedAt?: string
  finishedAt?: string
  diagnostics?: string[]
}

export type SyncHealthStatus = 'ready' | 'warning' | 'blocked'
export type SyncHealthIssueSeverity = 'warning' | 'blocking'

export interface SyncHealthIssue {
  code:
    | 'NO_SUCCESSFUL_SYNC'
    | 'STALE_SUCCESSFUL_SYNC'
    | 'STALE_RUNNING_SYNC'
    | 'MISSING_COVERAGE'
  severity: SyncHealthIssueSeverity
  message: string
}

export interface SyncHealth {
  status: SyncHealthStatus
  blocking: boolean
  checkedAt: string
  lastSuccessfulSync: string | null
  issues: SyncHealthIssue[]
  warnings: string[]
}

export interface MetaResponse {
  stageCatalog: StageCatalogEntry[]
  managerCatalog: ManagerDirectoryEntry[]
  sourceCatalog: SourceCatalogEntry[]
  businessClubCatalog: SourceCatalogEntry[]
  targetGroupCatalog: SourceCatalogEntry[]
  wonStageIds: string[]
  defaultPeriodDays: number
  lastSync: LastSyncSummary | null
  snapshotStats: SnapshotStats
  syncHealth: SyncHealth
}

export interface SyncSummary {
  syncRunId: number
  leadsSynced: number
  dealsSynced: number
  mode: 'full' | 'delta'
  modifiedAfter: string | null
  finishedAt: string
  snapshotBefore: SnapshotStats
  snapshotAfter: SnapshotStats
  changes: SyncChangeSummary
  diagnostics: string[]
}

export type SyncRunStatus = 'running' | 'success' | 'failed'

export interface SyncRunLogEntry {
  id: number
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  status: SyncRunStatus
  mode: 'full' | 'delta'
  modifiedAfter: string | null
  scopeKey: string | null
  leadsSynced: number
  dealsSynced: number
  dealBreakdown: SyncDealChangeBreakdown
  diagnostics: string[]
}

export interface SyncRunHistoryResponse {
  runs: SyncRunLogEntry[]
}

export interface TimelineBucket {
  bucket: string
  label: string
  salesCount: number
  salesAmount: number
}

export interface DashboardSnapshot {
  dashboard: DashboardData
  meta: MetaResponse
}
