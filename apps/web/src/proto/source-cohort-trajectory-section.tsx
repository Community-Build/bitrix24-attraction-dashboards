import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import type {
  SourceCohortTrajectoryBreakdownRow,
  SourceCohortTrajectoryManagerRow,
  SourceCohortTrajectoryReport,
  SourceCohortTrajectorySpeedStep,
} from '@/lib/dashboard-types'
import { formatInteger, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { FunnelStageDistributionChart, type FunnelStageNodeAnnotation } from '@/proto/funnel-stage-distribution-chart'
import { SourceCohortConversionJourneySection } from '@/proto/source-cohort-conversion-journey'
import { SourceCohortManagerDiagnosticsSection } from '@/proto/source-cohort-trajectory-manager-diagnostics'
import type { TocStageDistribution } from '@/proto/types'

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatSourceCohortPercent(value: number) {
  return `${formatPercent(value)}%`
}

function SourceCohortSectionHeading({
  title,
  description,
  right,
}: {
  title: string
  description?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {right}
    </div>
  )
}

const FIRST_SUCCESSFUL_CALL_HINT =
  'Считается первый прямой доверенный исходящий звонок после создания сделки: есть соединение и разговор дольше 30 секунд. Короткие соединения и неуспешные попытки сюда не входят.'
const REPEAT_ATTENDED_EVENTS_HINT =
  'Первое число - сделки с двумя и более фактическими посещениями мероприятий. Второе число - дополнительные посещения сверх первого.'
const MEETING_STAGE_WITHOUT_FACT_HINT =
  'Сделка дошла до CRM-стадии встречи, но в фактах нет проведенной встречи после создания сделки.'
const COMPLETED_MEETING_WITHOUT_NEXT_STAGE_HINT =
  'Есть факт проведенной встречи, но после него нет следующего перехода по CRM-стадиям.'
const STAGE_DWELL_HINT =
  'Завершенное время от входа в этап до выхода. Для Корзины и Возврата не показывается: это проигрышный исход, а не операционный этап.'
const SLOW_FACT_HINT =
  'Факт есть, но срок от создания сделки позже норматива V1. Сделки без факта считаются отдельно в бакете «Нет факта» и в разрывах.'
const STALE_AFTER_MEETING_HINT =
  'Есть проведенная встреча, сделка открыта, после встречи нет следующего этапа больше 7 дней.'
const STALE_CONTRACT_HINT =
  'Открытая сделка находится на CRM-этапе контракта больше 14 дней. Проигрышные исходы сюда не входят.'

function SourceCohortMetricHeader({
  label,
  hint,
}: {
  label: string
  hint: string
}) {
  const hintId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [isHintOpen, setIsHintOpen] = useState(false)
  const [hintPosition, setHintPosition] = useState<{
    left: number
    top: number
    width: number
  } | null>(null)

  const updateHintPosition = useCallback((tooltipHeight = 120) => {
    const trigger = triggerRef.current

    if (!trigger || typeof window === 'undefined') {
      return
    }

    const viewportPadding = 12
    const rect = trigger.getBoundingClientRect()
    const width = Math.max(220, Math.min(320, window.innerWidth - viewportPadding * 2))
    const minLeft = viewportPadding
    const maxLeft = Math.max(minLeft, window.innerWidth - width - viewportPadding)
    const preferredLeft = rect.left + rect.width / 2 - width / 2
    const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft)
    const belowTop = rect.bottom + 8
    const aboveTop = rect.top - tooltipHeight - 8
    const maxTop = Math.max(viewportPadding, window.innerHeight - tooltipHeight - viewportPadding)
    const top =
      belowTop + tooltipHeight <= window.innerHeight - viewportPadding
        ? belowTop
        : Math.min(Math.max(aboveTop, viewportPadding), maxTop)

    setHintPosition((current) => {
      if (current?.left === left && current.top === top && current.width === width) {
        return current
      }

      return { left, top, width }
    })
  }, [])

  const openHint = () => {
    updateHintPosition()
    setIsHintOpen(true)
  }

  const closeHint = () => setIsHintOpen(false)

  useLayoutEffect(() => {
    if (!isHintOpen) {
      return
    }

    updateHintPosition(tooltipRef.current?.getBoundingClientRect().height ?? 120)
  }, [hint, isHintOpen, updateHintPosition])

  useEffect(() => {
    if (!isHintOpen) {
      return undefined
    }

    const handleViewportChange = () => {
      updateHintPosition(tooltipRef.current?.getBoundingClientRect().height ?? 120)
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isHintOpen, updateHintPosition])

  return (
    <span className="inline-flex items-center gap-1 align-middle leading-snug">
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={hintId}
        aria-label={hint}
        onBlur={closeHint}
        onClick={openHint}
        onFocus={openHint}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            closeHint()
          }
        }}
        onMouseEnter={openHint}
        onMouseLeave={closeHint}
        onPointerDown={openHint}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-black leading-none text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        ?
      </button>
      {isHintOpen && hintPosition && typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={tooltipRef}
              id={hintId}
              role="tooltip"
              style={{
                left: hintPosition.left,
                top: hintPosition.top,
                width: hintPosition.width,
              }}
              className="pointer-events-none fixed z-[100] max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium normal-case leading-snug tracking-normal text-slate-700 shadow-lg"
            >
              {hint}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}

type SourceCohortTrajectoryBreakdownKey = 'managers' | 'sources' | 'customers'

const sourceCohortTrajectoryBreakdownMeta: Record<
  SourceCohortTrajectoryBreakdownKey,
  { button: string; heading: string; subject: string; countLabel: string }
> = {
  managers: {
    button: 'Менеджеры',
    heading: 'Кто до каких этапов доводит',
    subject: 'Менеджер',
    countLabel: 'менеджера',
  },
  sources: {
    button: 'Источники',
    heading: 'Какие источники где теряют движение',
    subject: 'Источник',
    countLabel: 'источника',
  },
  customers: {
    button: 'Заказчики',
    heading: 'Какие заказчики как проходят траекторию',
    subject: 'Заказчик',
    countLabel: 'сегмента',
  },
}

function buildSourceCohortTrajectoryDistribution(
  trajectory: SourceCohortTrajectoryReport,
): TocStageDistribution {
  const stageNodes = trajectory.stageNodes.filter((node) => node.reachedDeals > 0)

  return {
    totalCreatedDeals: trajectory.totalDeals,
    nodes: stageNodes.map((node) => ({
      stageId: node.stageId,
      stage: node.stageName,
      sortOrder: node.sortOrder,
      count: node.reachedDeals,
      shareOfCreatedDeals: node.reachedRate,
    })),
    edges: trajectory.stageTransitions.map((transition) => ({
      id: transition.id,
      fromStageId: transition.fromStageId,
      fromStage: transition.fromStageName ?? 'Старт выборки',
      toStageId: transition.toStageId,
      toStage: transition.toStageName,
      count: transition.deals,
      conversionRate: transition.conversionRate,
    })),
  }
}

function formatTrajectoryDays(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)} дн.` : '—'
}

function formatSpeedBucketRange(step: SourceCohortTrajectorySpeedStep) {
  return `норма ${formatNumber(step.slaDays)} дн.`
}

function formatRepeatAttendedEvents(deals: number, extraVisits: number) {
  return `${formatInteger(deals)} сдел. · ${formatInteger(extraVisits)} доп. посещ.`
}

function formatFirstSuccessfulCalls(row: SourceCohortTrajectoryBreakdownRow) {
  const direct = `${formatInteger(row.firstSuccessfulCallDeals)} · ${formatSourceCohortPercent(row.firstSuccessfulCallRate)}`
  return row.firstSuccessfulCallFallbackDeals > 0
    ? `${direct} · косв. ${formatInteger(row.firstSuccessfulCallFallbackDeals)}`
    : direct
}

function buildSourceCohortTrajectoryNodeAnnotations(
  trajectory: SourceCohortTrajectoryReport,
): Record<string, FunnelStageNodeAnnotation> {
  return Object.fromEntries(
    trajectory.stageNodes.map((node) => [
      node.stageId,
      {
        evidence: `${formatInteger(node.reachedDeals)} сдел. · ${formatSourceCohortPercent(node.reachedRate)}`,
        timing: `до этапа: ${formatTrajectoryDays(node.medianDaysFromCreate)} · на этапе: ${formatTrajectoryDays(node.medianDaysOnStage)}`,
      },
    ]),
  )
}

function getSourceCohortTrajectoryRows(
  trajectory: SourceCohortTrajectoryReport,
  breakdown: SourceCohortTrajectoryBreakdownKey,
): Array<SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow> {
  if (breakdown === 'managers') {
    return trajectory.managerRows
  }

  if (breakdown === 'sources') {
    return trajectory.sourceRows
  }

  return trajectory.customerRows
}

function getSourceCohortTrajectoryRowLabel(
  row: SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow,
) {
  return 'managerName' in row ? row.managerName : row.label
}

function getSourceCohortTrajectoryRowKey(
  row: SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow,
) {
  return 'managerId' in row ? row.managerId : row.key
}

function getSourceCohortTrajectoryTone(
  row: SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow,
) {
  if (row.dataQualityStatus === 'low_sample') {
    return 'neutral'
  }

  if (
    row.meetingStageWithoutFactDeals > 0 ||
    row.completedMeetingWithoutNextStageDeals > 0 ||
    row.staleAfterCompletedMeetingDeals > 0 ||
    row.staleOpenContractStageDeals > 0
  ) {
    return 'warning'
  }

  return row.wonRate > 0 && row.lostDeals === 0 ? 'positive' : 'neutral'
}

function getSourceCohortTrajectoryDiagnosis(
  row: SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow,
) {
  const label = getSourceCohortTrajectoryRowLabel(row)

  if (row.dataQualityStatus === 'low_sample') {
    return `${label}: N=${formatInteger(row.totalDeals)}. Эту строку можно смотреть как факт по сделкам, но нельзя использовать для рейтинга.`
  }

  if (row.meetingStageWithoutFactDeals > 0) {
    return `${label}: ${formatInteger(row.meetingStageWithoutFactDeals)} сдел. дошли до стадии встречи без подтвержденного факта встречи. Это проверка качества назначения и фиксации встречи.`
  }

  if (row.staleAfterCompletedMeetingDeals > 0) {
    return `${label}: ${formatInteger(row.staleAfterCompletedMeetingDeals)} открытых сдел. зависли после факта встречи больше 7 дней без следующего этапа. Это очередь контроля после встречи.`
  }

  if (row.completedMeetingWithoutNextStageDeals > 0) {
    return `${label}: ${formatInteger(row.completedMeetingWithoutNextStageDeals)} сдел. имеют факт встречи, но не имеют следующего этапа. Это очередь контроля после знакомства.`
  }

  if (row.staleOpenContractStageDeals > 0) {
    return `${label}: ${formatInteger(row.staleOpenContractStageDeals)} открытых сдел. находятся на этапе контракта больше 14 дней. Это очередь контроля закрытия договора.`
  }

  return `${label}: явного разрыва между стадией встречи и фактом встречи в выбранной когорте не видно. Проверьте строку по N и срокам перед управленческим выводом.`
}

function getSourceCohortTrajectoryToneClasses(
  tone: 'positive' | 'warning' | 'neutral',
) {
  if (tone === 'positive') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }

  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-900'
  }

  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getLossShapeQuestion(row: SourceCohortTrajectoryBreakdownRow) {
  return (
    row.lossShape.reasons[0]?.recommendedQuestion ??
    'Где нужен следующий управленческий шаг?'
  )
}

export function SourceCohortStageConversionSection({
  selectedMonthLabel,
  totalCreatedDeals,
  trajectory,
  trajectoryUnavailableReason,
}: {
  selectedMonthLabel: string
  totalCreatedDeals: number
  trajectory: SourceCohortTrajectoryReport | undefined
  trajectoryUnavailableReason?: string | null
}) {
  const [breakdown, setBreakdown] = useState<SourceCohortTrajectoryBreakdownKey>('managers')
  const breakdownRows = useMemo(
    () => (trajectory ? getSourceCohortTrajectoryRows(trajectory, breakdown) : []),
    [breakdown, trajectory],
  )
  const [selectedRowKey, setSelectedRowKey] = useState('')
  const distribution = useMemo(
    () => (trajectory ? buildSourceCohortTrajectoryDistribution(trajectory) : null),
    [trajectory],
  )
  const nodeAnnotations = useMemo(
    () => (trajectory ? buildSourceCohortTrajectoryNodeAnnotations(trajectory) : {}),
    [trajectory],
  )
  const selectedBreakdownRow =
    breakdownRows.find((row) => getSourceCohortTrajectoryRowKey(row) === selectedRowKey) ??
    breakdownRows[0]
  const breakdownMeta = sourceCohortTrajectoryBreakdownMeta[breakdown]
  const firstCall = trajectory?.actionNodes.find(
    (node) => node.actionKey === 'first_successful_call',
  )
  const meeting = trajectory?.actionNodes.find(
    (node) => node.actionKey === 'completed_meeting',
  )
  const event = trajectory?.actionNodes.find((node) => node.actionKey === 'attended_event')
  const summaryCards: Array<{
    label: string
    value: string
    note: string
    hint?: string
  }> = [
    {
      label: 'Первый успешный звонок',
      value: `${formatInteger(firstCall?.reachedDeals ?? 0)} · ${formatSourceCohortPercent(firstCall?.reachedRate ?? 0)}`,
      note: `до успешного звонка: ${formatTrajectoryDays(firstCall?.medianDaysFromCreate ?? null)}`,
      hint: FIRST_SUCCESSFUL_CALL_HINT,
    },
    {
      label: 'Факт встречи',
      value: `${formatInteger(meeting?.reachedDeals ?? 0)} · ${formatSourceCohortPercent(meeting?.reachedRate ?? 0)}`,
      note: `медиана ${formatTrajectoryDays(meeting?.medianDaysFromCreate ?? null)}`,
    },
    {
      label: 'Мероприятие',
      value: `${formatInteger(event?.reachedDeals ?? 0)} · ${formatSourceCohortPercent(event?.reachedRate ?? 0)}`,
      note: `медиана ${formatTrajectoryDays(event?.medianDaysFromCreate ?? null)}`,
    },
    {
      label: 'Повторные мероприятия',
      value: formatRepeatAttendedEvents(
        trajectory?.overallSignals.repeatAttendedEventDeals ?? 0,
        trajectory?.overallSignals.repeatAttendedEventVisits ?? 0,
      ),
      note: 'дополнительные посещения сверх первого',
      hint: REPEAT_ATTENDED_EVENTS_HINT,
    },
    {
      label: 'Контракт',
      value: `${formatInteger(trajectory?.overallSignals.contractStageDeals ?? 0)} · ${formatSourceCohortPercent(trajectory?.overallSignals.contractStageRate ?? 0)}`,
      note: `до: ${formatTrajectoryDays(trajectory?.overallSignals.medianDaysToContractStage ?? null)} · на этапе: ${formatTrajectoryDays(trajectory?.overallSignals.medianDaysOnContractStage ?? null)}`,
    },
    {
      label: 'CRM-встреча без факта',
      value: formatInteger(trajectory?.overallSignals.meetingStageWithoutFactDeals ?? 0),
      note: 'стадия встречи без проведенной встречи',
      hint: MEETING_STAGE_WITHOUT_FACT_HINT,
    },
  ]
  const selectedTone = selectedBreakdownRow
    ? getSourceCohortTrajectoryTone(selectedBreakdownRow)
    : 'neutral'
  const showLossShapeColumns = breakdown !== 'managers'
  const selectedLossReasons =
    showLossShapeColumns && selectedBreakdownRow
      ? selectedBreakdownRow.lossShape.reasons.slice(0, 3)
      : []

  return (
    <section
      className="panel min-w-0 p-5"
      data-comment-block-id="attraction-source-cohort-trajectory-conversions"
      data-comment-block-label="Конверсии — траектория по этапам и фактам"
    >
      {!trajectory?.conversionJourney ? (
        <SourceCohortSectionHeading
          title="Конверсии по этапам и фактам"
          description={`Когорта ${selectedMonthLabel || '—'}: этапы, фактические встречи и события, сроки до следующего действия, зависания и отвалы.`}
          right={
            <div className="flex flex-wrap gap-2">
              <span className="badge-chip badge-neutral">
                {formatInteger(totalCreatedDeals)} сделок
              </span>
              {trajectory ? (
                <span className="badge-chip badge-neutral">
                  история стадий {formatSourceCohortPercent(trajectory.dataQuality.stageHistoryCoverageRate)}
                </span>
              ) : null}
              <span className="badge-chip badge-neutral">когорта выбрана выше</span>
            </div>
          }
        />
      ) : null}

      {!trajectory ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {trajectoryUnavailableReason ??
            'Слой траектории не рассчитан. Старые блоки выше загружены, но управленческие выводы по фактическим действиям недоступны.'}
        </div>
      ) : null}

      {trajectory ? (
        <>
	      {trajectory.conversionJourney ? (
	        <SourceCohortConversionJourneySection
	          journey={trajectory.conversionJourney}
	          selectedMonthLabel={selectedMonthLabel}
	          totalDeals={trajectory.totalDeals}
	        />
	      ) : null}
	      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
	        {summaryCards.map(({ label, value, note, hint }) => (
	          <div key={label} className="metric p-4">
            <p className="subtle-label">
              {hint ? <SourceCohortMetricHeader label={label} hint={hint} /> : label}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">{note}</p>
          </div>
	        ))}
	      </div>

	      <div className="mb-4 rounded-2xl border border-slate-200 bg-white/75 p-3">
	        <SourceCohortSectionHeading
          title="Диагностика переходов"
          description="Фактическая цепочка показывает, сколько сделок дошло до каждого действия. Разрывы справа считаются от предыдущего фактического шага, а не всегда от всей когорты."
          right={
            <span className="badge-chip badge-neutral">
              Стадии CRM и факты разделены
            </span>
          }
	        />
	        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
	          <div className="min-w-0">
	            <h4 className="subtle-label mb-2">Фактическая цепочка</h4>
	            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
	              {trajectory.factSteps.map((step) => (
	                <div
	                  key={step.stepKey}
	                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
	                >
	                  <div className="flex flex-wrap items-baseline justify-between gap-2">
	                    <p className="font-bold text-slate-900">{step.label}</p>
	                    <p className="text-sm font-black text-slate-950">
	                      {formatInteger(step.deals)} · {formatSourceCohortPercent(step.rateFromCohort)}
	                    </p>
	                  </div>
	                  <p className="mt-1 text-xs text-slate-500">
	                    от предыдущего шага {formatSourceCohortPercent(step.rateFromPrevious)} · медиана {formatTrajectoryDays(step.medianDaysFromCreate)}
	                  </p>
                    <p className="mt-1 text-xs leading-snug text-slate-500">{step.evidence}</p>
	                </div>
	              ))}
	            </div>
	          </div>
	          <div className="min-w-0">
	            <h4 className="subtle-label mb-2">Где разрывается движение</h4>
	            <div className="space-y-2">
	              {trajectory.conversionGaps.map((gap) => (
	                <div
	                  key={gap.gapKey}
	                  className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2"
	                >
	                  <div className="flex flex-wrap items-baseline justify-between gap-2">
	                    <p className="font-bold text-amber-950">{gap.label}</p>
	                    <p className="text-sm font-black text-amber-950">
	                      {formatInteger(gap.deals)} · {formatSourceCohortPercent(gap.rate)}
	                    </p>
	                  </div>
	                  <p className="mt-1 text-xs text-amber-900">{gap.managementQuestion}</p>
                    <p className="mt-1 text-xs leading-snug text-amber-800">{gap.evidence}</p>
	                </div>
	              ))}
	            </div>
	          </div>
	        </div>
	      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white/75 p-3">
        <SourceCohortSectionHeading
          title="Сроки и зависания"
          description="Норматив показывает, где действие случилось поздно. «Нет факта» не смешивается с просрочкой: это отдельный бакет и отдельный управленческий вопрос."
          right={<span className="badge-chip badge-neutral">Норматив V1</span>}
        />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {trajectory.speedSteps.map((step) => (
            <div key={step.stepKey} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-950">{step.label}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    медиана {formatTrajectoryDays(step.medianDays)} · {formatSpeedBucketRange(step)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-amber-800">
                    {formatInteger(step.slowDeals)} · {formatSourceCohortPercent(step.slowRate)}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">
                    медленно
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {step.buckets.map((bucket) => (
                  <div key={bucket.bucketKey}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-600">{bucket.label}</span>
                      <span className="font-bold text-slate-900">
                        {formatInteger(bucket.deals)} · {formatSourceCohortPercent(bucket.rate)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          bucket.bucketKey === 'no_fact' ? 'bg-slate-400' : 'bg-blue-500',
                        )}
                        style={{ width: `${Math.min(Math.max(bucket.rate, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="subtle-label">
              <SourceCohortMetricHeader label="Зависли после встречи" hint={STALE_AFTER_MEETING_HINT} />
            </p>
            <p className="mt-1 text-lg font-black text-amber-950">
              {formatInteger(trajectory.overallSignals.staleAfterCompletedMeetingDeals)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="subtle-label">
              <SourceCohortMetricHeader label="Зависли на контракте" hint={STALE_CONTRACT_HINT} />
            </p>
            <p className="mt-1 text-lg font-black text-amber-950">
              {formatInteger(trajectory.overallSignals.staleOpenContractStageDeals)}
            </p>
          </div>
        </div>
      </div>

	      {distribution ? (
        <FunnelStageDistributionChart
          distribution={distribution}
          title="Траектория участника"
          description="Карточка показывает долю от всей когорты и медианный срок до этапа. Фактические действия рядом считаются отдельно от CRM-стадий; это не строгая линейная воронка."
          mapLabel="Маршрут участника"
          legendLabel="Доля когорты на этапе"
          createdLabel="Когорта"
          ariaLabel="Карта конверсии по этапам выбранной когорты"
          stepLabelKind="milestone"
          nodeAnnotations={nodeAnnotations}
        />
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/75 p-3">
          <SourceCohortSectionHeading
            title="Сроки на этапах"
            description="Сколько сделок доходило до этапа, медианный срок от создания до входа и медианное завершенное время на этапе до следующего перехода. Текущий возраст открытых сделок не смешивается с этим числом."
          right={
            <span className="badge-chip badge-neutral">
              {formatInteger(trajectory.stageNodes.filter((node) => node.reachedDeals > 0).length)} этапов
            </span>
          }
        />
        <div className="overflow-auto">
          <table className="min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-2 py-2">Этап</th>
                <th className="px-2 py-2">Дошли</th>
                <th className="px-2 py-2">Доля когорты</th>
	                <th className="px-2 py-2">До этапа</th>
	                <th className="px-2 py-2">
	                  <SourceCohortMetricHeader label="На этапе" hint={STAGE_DWELL_HINT} />
	                </th>
              </tr>
            </thead>
            <tbody>
              {trajectory.stageNodes
                .filter((node) => node.reachedDeals > 0)
                .map((node) => {
                  const isContract = node.stageName.toLocaleLowerCase('ru').includes('контракт')
                  return (
                    <tr
                      key={node.stageId}
                      className={cn(
                        'border-b border-slate-100',
                        isContract ? 'bg-blue-50/60 font-semibold text-slate-950' : '',
                      )}
                    >
                      <td className="px-2 py-2">{node.stageName}</td>
                      <td className="px-2 py-2">{formatInteger(node.reachedDeals)}</td>
                      <td className="px-2 py-2">{formatSourceCohortPercent(node.reachedRate)}</td>
                      <td className="px-2 py-2">{formatTrajectoryDays(node.medianDaysFromCreate)}</td>
                      <td className="px-2 py-2">{formatTrajectoryDays(node.medianDaysOnStage)}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          ['Действия в CRM', trajectory.dataQuality.touchpointDeals, trajectory.dataQuality.touchpointCoverageRate],
          ['Посещения событий', trajectory.dataQuality.eventVisitDeals, trajectory.dataQuality.eventVisitCoverageRate],
          ['История стадий', trajectory.dataQuality.stageHistoryDeals, trajectory.dataQuality.stageHistoryCoverageRate],
          ['Заказчик заполнен', trajectory.dataQuality.businessClubDeals, trajectory.dataQuality.businessClubCoverageRate],
        ].map(([label, count, rate]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white/75 p-3">
            <p className="subtle-label">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatInteger(Number(count))} · {formatSourceCohortPercent(Number(rate))}
            </p>
          </div>
        ))}
      </div>

      {trajectory.dataQuality.warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {trajectory.dataQuality.warnings.join(' ')}
        </div>
      ) : null}

      <div className="mt-4">
        <SourceCohortSectionHeading
          title={breakdownMeta.heading}
          description="Тот же слой можно смотреть по менеджерам, источникам и заказчикам: где быстрее доводят до звонка и встречи, где встреча не подтверждается фактом, где зависают или уходят в корзину."
          right={
            <span className="badge-chip badge-neutral">
              {formatInteger(breakdownRows.length)} {breakdownMeta.countLabel}
            </span>
          }
        />

        <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-sm">
          {(Object.keys(sourceCohortTrajectoryBreakdownMeta) as SourceCohortTrajectoryBreakdownKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBreakdown(key)}
              className={
                breakdown === key
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
              }
            >
              {sourceCohortTrajectoryBreakdownMeta[key].button}
            </button>
          ))}
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_380px]">
          <section className="min-w-0 overflow-auto rounded-2xl border border-slate-200 bg-white/75 p-3">
            <table className="min-w-[2160px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
	                  <th className="sticky left-0 z-20 bg-white px-2 py-2 shadow-[6px_0_12px_rgba(148,163,184,0.18)]">{breakdownMeta.subject}</th>
                    {showLossShapeColumns ? (
                      <>
                        <th className="px-2 py-2">Профиль потерь</th>
                        <th className="px-2 py-2">Сделок</th>
                        <th className="px-2 py-2">Доля</th>
                        <th className="px-2 py-2">Вопрос РОП</th>
                      </>
                    ) : null}
	                  <th className="px-2 py-2">База</th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="Первый успешный звонок" hint={FIRST_SUCCESSFUL_CALL_HINT} />
	                  </th>
	                  <th className="px-2 py-2">До успешного звонка</th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="Звонок позже нормы" hint={SLOW_FACT_HINT} />
	                  </th>
	                  <th className="px-2 py-2">Стадия встречи</th>
	                  <th className="px-2 py-2">Факт встречи</th>
	                  <th className="px-2 py-2">Срок до встречи</th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="Встреча позже нормы" hint={SLOW_FACT_HINT} />
	                  </th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="Повторные мероприятия" hint={REPEAT_ATTENDED_EVENTS_HINT} />
	                  </th>
	                  <th className="px-2 py-2">Контракт</th>
	                  <th className="px-2 py-2">На контракте</th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="Зависли на контракте" hint={STALE_CONTRACT_HINT} />
	                  </th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="CRM-встреча без факта" hint={MEETING_STAGE_WITHOUT_FACT_HINT} />
	                  </th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="После встречи без движения" hint={COMPLETED_MEETING_WITHOUT_NEXT_STAGE_HINT} />
	                  </th>
	                  <th className="px-2 py-2">
	                    <SourceCohortMetricHeader label="Зависли после встречи" hint={STALE_AFTER_MEETING_HINT} />
	                  </th>
	                  <th className="px-2 py-2">Проигрыш</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map((row) => {
                  const rowKey = getSourceCohortTrajectoryRowKey(row)
                  const rowLabel = getSourceCohortTrajectoryRowLabel(row)
                  const isSelected = rowKey === getSourceCohortTrajectoryRowKey(selectedBreakdownRow ?? row)

                  return (
                    <tr
                      key={rowKey}
                      className={cn(
                        'border-b border-slate-100 transition hover:bg-blue-50/40',
                        isSelected ? 'bg-blue-50/60' : '',
                      )}
                      style={{ contentVisibility: 'auto' }}
                    >
                      <td
                        className={cn(
                          'sticky left-0 z-10 px-2 py-2 shadow-[6px_0_12px_rgba(148,163,184,0.14)]',
                          isSelected ? 'bg-blue-50' : 'bg-white',
                        )}
                      >
                        <button
                          type="button"
                          className="text-left font-semibold text-slate-900 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedRowKey(rowKey)}
                        >
                          {rowLabel}
                        </button>
                      </td>
                      {showLossShapeColumns ? (
                        <>
                          <td className="px-2 py-2 font-semibold text-slate-900">
                            {row.lossShape.dominantShapeLabel}
                          </td>
                          <td className="px-2 py-2">
                            {formatInteger(row.lossShape.dominantDeals)}
                          </td>
                          <td className="px-2 py-2">
                            {formatSourceCohortPercent(row.lossShape.dominantRate)}
                          </td>
                          <td className="max-w-[260px] px-2 py-2 text-xs leading-snug text-slate-600">
                            {getLossShapeQuestion(row)}
                          </td>
                        </>
                      ) : null}
                      <td className="px-2 py-2">{formatInteger(row.totalDeals)}</td>
                      <td className="px-2 py-2">{formatFirstSuccessfulCalls(row)}</td>
                      <td className="px-2 py-2">{formatTrajectoryDays(row.medianDaysToFirstSuccessfulCall)}</td>
                      <td className="px-2 py-2 text-amber-800">{formatInteger(row.slowFirstSuccessfulCallDeals)}</td>
                      <td className="px-2 py-2">{formatInteger(row.meetingStageDeals)} · {formatSourceCohortPercent(row.meetingStageRate)}</td>
                      <td className="px-2 py-2">{formatInteger(row.completedMeetingDeals)} · {formatSourceCohortPercent(row.completedMeetingRate)}</td>
	                      <td className="px-2 py-2">{formatTrajectoryDays(row.medianDaysToCompletedMeeting)}</td>
	                      <td className="px-2 py-2 text-amber-800">{formatInteger(row.slowCompletedMeetingDeals)}</td>
	                      <td className="px-2 py-2">
	                        {formatRepeatAttendedEvents(row.repeatAttendedEventDeals, row.repeatAttendedEventVisits)}
	                      </td>
                      <td className="px-2 py-2">{formatInteger(row.contractStageDeals)} · {formatSourceCohortPercent(row.contractStageRate)}</td>
                      <td className="px-2 py-2">{formatTrajectoryDays(row.medianDaysOnContractStage)}</td>
                      <td className="px-2 py-2 text-amber-800">{formatInteger(row.staleOpenContractStageDeals)}</td>
                      <td className="px-2 py-2">{formatInteger(row.meetingStageWithoutFactDeals)}</td>
                      <td className="px-2 py-2">{formatInteger(row.completedMeetingWithoutNextStageDeals)}</td>
                      <td className="px-2 py-2 text-amber-800">{formatInteger(row.staleAfterCompletedMeetingDeals)}</td>
                      <td className="px-2 py-2 text-orange-700">{formatInteger(row.lostDeals)} · {formatSourceCohortPercent(row.totalDeals > 0 ? (row.lostDeals / row.totalDeals) * 100 : 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {showLossShapeColumns && selectedBreakdownRow ? (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="subtle-label">
                    Профиль потерь: {getSourceCohortTrajectoryRowLabel(selectedBreakdownRow)}
                  </p>
                  <span className="badge-chip badge-neutral">
                    {formatInteger(selectedLossReasons.length)} причины
                  </span>
                </div>
                <div className="grid gap-2 lg:grid-cols-3">
                  {selectedLossReasons.map((reason) => (
                    <div key={reason.shapeKey} className="border-l-2 border-slate-300 pl-3">
                      <p className="font-bold text-slate-900">{reason.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatInteger(reason.deals)} сдел. · {formatSourceCohortPercent(reason.rate)}
                      </p>
                      <p className="mt-1 text-xs leading-snug text-slate-600">
                        {reason.recommendedQuestion}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white/75 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Что видно в выбранной строке
            </h4>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-slate-950">
                    {selectedBreakdownRow ? getSourceCohortTrajectoryRowLabel(selectedBreakdownRow) : '—'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatInteger(selectedBreakdownRow?.totalDeals ?? 0)} сделок в когорте
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    getSourceCohortTrajectoryToneClasses(selectedTone),
                  )}
                >
                  {selectedTone === 'positive'
                    ? 'сильный участок'
                    : selectedTone === 'warning'
                      ? 'есть узкое место'
                      : 'смотреть с ограничением'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {selectedBreakdownRow
                  ? getSourceCohortTrajectoryDiagnosis(selectedBreakdownRow)
                  : 'Нет строк в выбранном разрезе.'}
              </p>
              {selectedBreakdownRow ? (
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
	                  {[
	                    [
	                      'Повторные мероприятия',
	                      formatRepeatAttendedEvents(
	                        selectedBreakdownRow.repeatAttendedEventDeals,
	                        selectedBreakdownRow.repeatAttendedEventVisits,
	                      ),
	                    ],
                    ['Контракт', `${formatInteger(selectedBreakdownRow.contractStageDeals)} · ${formatSourceCohortPercent(selectedBreakdownRow.contractStageRate)}`],
                    ['До контракта', formatTrajectoryDays(selectedBreakdownRow.medianDaysToContractStage)],
                    ['На контракте', formatTrajectoryDays(selectedBreakdownRow.medianDaysOnContractStage)],
                    ['Звонок позже нормы', formatInteger(selectedBreakdownRow.slowFirstSuccessfulCallDeals)],
                    ['Зависли после встречи', formatInteger(selectedBreakdownRow.staleAfterCompletedMeetingDeals)],
                    ['Зависли на контракте', formatInteger(selectedBreakdownRow.staleOpenContractStageDeals)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                      <p className="mt-1 font-black text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
	              <p>Срок до успешного звонка считается до первого доверенного исходящего звонка, а не до любой попытки дозвона.</p>
	              <p>“CRM-встреча без факта” показывает сделки, которые перевели в стадию встречи, но подтвержденной проведенной встречи нет. “После встречи без движения” показывает фактическую встречу без следующего этапа.</p>
	            </div>
          </aside>
        </div>

        <SourceCohortManagerDiagnosticsSection diagnostics={trajectory.managerDiagnostics} />
      </div>
      </>
      ) : null}
    </section>
  )
}
