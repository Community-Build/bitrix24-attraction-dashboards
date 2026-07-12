import { useMemo, useState, type ReactNode } from 'react'

import type {
  SourceCohortEventPerformance,
  SourceCohortEventPerformanceRow,
  SourceCohortTrajectoryBreakdownRow,
  SourceCohortTrajectoryManagerRow,
  SourceCohortTrajectoryQualityStatus,
  SourceCohortTrajectoryReport,
} from '@/lib/dashboard-types'
import { formatInteger, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type ReportMode = 'journey' | 'events'
type JourneyView = 'facts' | 'stages' | 'gaps'
type BreakdownKey = 'managers' | 'sources' | 'customers' | 'quality'
type TransitionKey = 'meeting' | 'event' | 'contract' | 'transfer'
type EventBreakdownKey = 'types' | 'events' | 'managers'

const CONTROL_CLASS =
  'min-h-10 rounded-full border px-4 py-2 text-sm font-bold outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.96]'
const ACTIVE_CONTROL_CLASS =
  'border-slate-900 bg-slate-900 text-white shadow-sm hover:border-slate-900'
const INACTIVE_CONTROL_CLASS = 'border-slate-200 bg-white text-slate-600'

const CORE_STEP_LABELS: Record<string, string> = {
  created: 'Создана',
  first_call: 'Первая попытка',
  confirmed_conversation: 'Успешный разговор',
  meeting_scheduled: 'Дата встречи зафиксирована',
  meeting_completed: 'Встреча состоялась',
  contract: 'Контракт',
  transferred: 'Передано в клуб',
}

const BREAKDOWN_META: Record<BreakdownKey, { label: string; subject: string; note: string }> = {
  managers: {
    label: 'Менеджеры',
    subject: 'Менеджер',
    note: 'Менеджер — текущий ответственный по сделке. Историческая атрибуция действий пока недоступна.',
  },
  sources: {
    label: 'Поставщики / источники',
    subject: 'Источник',
    note: 'Источник используется как доступный в CRM аналог поставщика потока.',
  },
  customers: {
    label: 'Заказчики',
    subject: 'Заказчик',
    note: 'Заказчик — бизнес-клуб, зафиксированный у сделки.',
  },
  quality: {
    label: 'Итоговое качество',
    subject: 'Качество',
    note: 'Качество взято из текущего снимка сделки, поэтому это итоговый описательный разрез, а не входной признак.',
  },
}

const TRANSITION_META: Record<TransitionKey, { label: string; reached: string; stuck: string }> = {
  meeting: { label: 'До встречи', reached: 'Встреча состоялась', stuck: 'После встречи без движения' },
  event: { label: 'До мероприятия', reached: 'Посетили', stuck: 'Без контракта после события' },
  contract: { label: 'До контракта', reached: 'Дошли до контракта', stuck: 'Контракт без передачи' },
  transfer: { label: 'До передачи', reached: 'Передано в клуб', stuck: 'Не передано' },
}

const EVENT_BREAKDOWN_META: Record<EventBreakdownKey, { label: string; subject: string }> = {
  types: { label: 'Типы мероприятий', subject: 'Тип' },
  events: { label: 'Отдельные мероприятия', subject: 'Мероприятие' },
  managers: { label: 'Ответственные', subject: 'Ответственный' },
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatRate(value: number | null) {
  return value === null ? '—' : `${formatPercent(value)}%`
}

function formatDays(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${formatNumber(value)} дн.`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function getEventPerformance(
  trajectory: SourceCohortTrajectoryReport,
): SourceCohortEventPerformance {
  return trajectory.eventPerformance ?? {
    range: trajectory.range,
    outcomeWindowDays: 60,
    totalEvents: 0,
    attendedVisits: 0,
    matureVisits: 0,
    contractAfterVisits: 0,
    transferredAfterVisits: 0,
    eventTypeRows: [],
    eventRows: [],
    managerRows: [],
    warnings: ['Событийный расчет отсутствует в этом снимке API.'],
  }
}

function SegmentControl<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
}: {
  value: T
  items: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            CONTROL_CLASS,
            value === item.value ? ACTIVE_CONTROL_CLASS : INACTIVE_CONTROL_CLASS,
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <p className="subtle-label">{eyebrow}</p>
        <h3 className="mt-1 text-balance text-xl font-bold text-slate-950">{title}</h3>
        <p className="mt-1 max-w-[72ch] text-pretty text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  )
}

function SummaryMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 border-l-2 border-slate-200 pl-3 first:border-blue-500">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-extrabold tabular-nums text-slate-950">{value}</p>
      <p className="mt-0.5 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  )
}

function ReliabilityBadge({ status }: { status: SourceCohortTrajectoryQualityStatus }) {
  const label = status === 'reliable' ? 'Надежно' : status === 'limited' ? 'Ограниченно' : 'Мало данных'
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-1 text-xs font-bold',
        status === 'reliable'
          ? 'bg-emerald-50 text-emerald-700'
          : status === 'limited'
            ? 'bg-amber-50 text-amber-800'
            : 'bg-slate-100 text-slate-600',
      )}
    >
      {label}
    </span>
  )
}

function JourneyFacts({ trajectory }: { trajectory: SourceCohortTrajectoryReport }) {
  const journey = trajectory.conversionJourney
  if (!journey) {
    return <p className="py-8 text-sm text-slate-500">Фактическая траектория недоступна в этом снимке.</p>
  }

  const scheduledMeeting = journey.coreSteps.find((step) => step.stepKey === 'meeting_scheduled')
  const mainSteps = journey.coreSteps.filter((step) => step.stepKey !== 'meeting_scheduled')

  return (
    <div className="mt-5">
      <ol className="grid overflow-hidden rounded-lg border border-slate-200 bg-white lg:grid-cols-6">
        {mainSteps.map((step, index) => (
          <li
            key={step.stepKey}
            className="relative min-w-0 border-b border-slate-200 p-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-extrabold tabular-nums text-blue-700">
                {index + 1}
              </span>
              <p className="text-sm font-bold leading-5 text-slate-900">
                {CORE_STEP_LABELS[step.stepKey] ?? step.label}
              </p>
            </div>
            <p className="mt-4 text-2xl font-extrabold tabular-nums text-slate-950">
              {formatInteger(step.deals)}
            </p>
            <p className="mt-0.5 text-xs font-semibold tabular-nums text-blue-700">
              {formatRate(step.rateFromCohort)} к когорте
            </p>
            <dl className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
              <div className="flex justify-between gap-2">
                <dt>После прошлого шага</dt>
                <dd className="font-bold tabular-nums text-slate-700">{formatRate(step.rateFromPrevious)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Медиана</dt>
                <dd className="font-bold tabular-nums text-slate-700">{formatDays(step.medianDaysFromCreate)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      {scheduledMeeting ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm">
          <div>
            <p className="font-bold text-slate-800">Диагностика процесса: дата встречи зафиксирована</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              Это не обязательный факт конверсии: показатель проверяет, что встречу назначили и внесли в CRM.
            </p>
          </div>
          <p className="font-extrabold tabular-nums text-slate-900">
            {formatInteger(scheduledMeeting.deals)} · {formatRate(scheduledMeeting.rateFromCohort)}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function JourneyStages({ trajectory }: { trajectory: SourceCohortTrajectoryReport }) {
  const rows = trajectory.stageNodes.filter((row) => row.reachedDeals > 0)
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-[760px] text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-4 py-3">CRM-этап</th>
            <th className="px-3 py-3">Дошли</th>
            <th className="px-3 py-3">Доля когорты</th>
            <th className="px-3 py-3">До этапа</th>
            <th className="px-3 py-3">На этапе</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stageId} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3 font-semibold text-slate-900">{row.stageName}</td>
              <td className="px-3 py-3 tabular-nums">{formatInteger(row.reachedDeals)}</td>
              <td className="px-3 py-3 tabular-nums">{formatRate(row.reachedRate)}</td>
              <td className="px-3 py-3 tabular-nums">{formatDays(row.medianDaysFromCreate)}</td>
              <td className="px-3 py-3 tabular-nums">{formatDays(row.medianDaysOnStage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JourneyGaps({ trajectory }: { trajectory: SourceCohortTrajectoryReport }) {
  const rows = trajectory.conversionGaps.filter((row) => row.deals > 0)
  return (
    <div className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">Заметных расхождений в выбранной когорте нет.</p>
      ) : (
        rows.map((row) => (
          <div key={row.gapKey} className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,0.7fr)_100px_minmax(320px,1.3fr)] lg:items-center">
            <div>
              <p className="font-bold text-slate-900">{row.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{row.evidence}</p>
            </div>
            <p className="text-lg font-extrabold tabular-nums text-amber-800">
              {formatInteger(row.deals)} · {formatRate(row.rate)}
            </p>
            <p className="text-sm leading-6 text-slate-700">{row.managementQuestion}</p>
          </div>
        ))
      )}
    </div>
  )
}

function getBreakdownRows(trajectory: SourceCohortTrajectoryReport, key: BreakdownKey) {
  if (key === 'managers') return trajectory.managerRows
  if (key === 'sources') return trajectory.sourceRows
  if (key === 'customers') return trajectory.customerRows
  return trajectory.qualityRows ?? []
}

function getRowKey(row: SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow) {
  return 'managerId' in row ? row.managerId : row.key
}

function getRowLabel(row: SourceCohortTrajectoryBreakdownRow | SourceCohortTrajectoryManagerRow) {
  return 'managerName' in row ? row.managerName : row.label
}

function getTransitionMetric(row: SourceCohortTrajectoryBreakdownRow, transition: TransitionKey) {
  if (transition === 'meeting') {
    return {
      reached: row.completedMeetingDeals,
      rate: row.completedMeetingRate,
      median: row.medianDaysToCompletedMeeting,
      stuck: row.staleAfterCompletedMeetingDeals,
    }
  }
  if (transition === 'event') {
    return {
      reached: row.attendedEventDeals,
      rate: row.attendedEventRate,
      median: row.medianDaysToAttendedEvent,
      stuck: row.attendedEventWithoutContractDeals,
    }
  }
  if (transition === 'contract') {
    return {
      reached: row.contractStageDeals,
      rate: row.contractStageRate,
      median: row.medianDaysToContractStage,
      stuck: row.contractWithoutWinDeals,
    }
  }
  return {
    reached: row.wonDeals,
    rate: row.wonRate,
    median: null,
    stuck: Math.max(row.totalDeals - row.wonDeals, 0),
  }
}

function ComparisonMatrix({ trajectory }: { trajectory: SourceCohortTrajectoryReport }) {
  const [breakdown, setBreakdown] = useState<BreakdownKey>('managers')
  const [transition, setTransition] = useState<TransitionKey>('meeting')
  const [selectedKey, setSelectedKey] = useState('')
  const rows = useMemo(() => getBreakdownRows(trajectory, breakdown), [breakdown, trajectory])
  const selectedRow = rows.find((row) => getRowKey(row) === selectedKey) ?? rows[0]
  const selectedMetric = selectedRow ? getTransitionMetric(selectedRow, transition) : null
  const transitionMeta = TRANSITION_META[transition]

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <SectionHeader
        eyebrow="Сравнение"
        title="Кто лучше доводит до выбранного результата"
        description="Сначала выберите разрез, затем переход. Таблица не смешивает все этапы сразу и показывает объем, конверсию, скорость, зависания и надежность вывода."
      />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <SegmentControl
          value={breakdown}
          onChange={(value) => {
            setBreakdown(value)
            setSelectedKey('')
          }}
          ariaLabel="Разрез сравнения"
          items={(Object.keys(BREAKDOWN_META) as BreakdownKey[]).map((value) => ({
            value,
            label: BREAKDOWN_META[value].label,
          }))}
        />
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
          <span>Переход</span>
          <select
            value={transition}
            onChange={(event) => setTransition(event.target.value as TransitionKey)}
            className="min-h-9 rounded-md border-0 bg-slate-50 px-2 font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {(Object.keys(TRANSITION_META) as TransitionKey[]).map((value) => (
              <option key={value} value={value}>{TRANSITION_META[value].label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{BREAKDOWN_META[breakdown].note}</p>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[900px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-3">{BREAKDOWN_META[breakdown].subject}</th>
              <th className="px-3 py-3">Сделок</th>
              <th className="px-3 py-3">{transitionMeta.reached}</th>
              <th className="px-3 py-3">Конверсия</th>
              <th className="px-3 py-3">Медиана</th>
              <th className="px-3 py-3">{transitionMeta.stuck}</th>
              <th className="px-3 py-3">Надежность</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const metric = getTransitionMetric(row, transition)
              const key = getRowKey(row)
              const isSelected = key === getRowKey(selectedRow ?? row)
              return (
                <tr
                  key={key}
                  className={cn('border-b border-slate-100 last:border-b-0', isSelected ? 'bg-blue-50/70' : '')}
                >
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedKey(key)}
                      className="min-h-10 text-left font-bold text-slate-900 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      {getRowLabel(row)}
                    </button>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatInteger(row.totalDeals)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInteger(metric.reached)}</td>
                  <td className="px-3 py-2 font-bold tabular-nums text-slate-900">{formatRate(metric.rate)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDays(metric.median)}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums text-amber-800">{formatInteger(metric.stuck)}</td>
                  <td className="px-3 py-2"><ReliabilityBadge status={row.dataQualityStatus} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedRow && selectedMetric ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="max-w-3xl text-sm leading-6 text-slate-700">
            <strong className="text-slate-950">{getRowLabel(selectedRow)}:</strong>{' '}
            {formatInteger(selectedMetric.reached)} из {formatInteger(selectedRow.totalDeals)} дошли до результата «{transitionMeta.reached.toLocaleLowerCase('ru')}»
            {' '}за медианные {formatDays(selectedMetric.median)}; {transitionMeta.stuck.toLocaleLowerCase('ru')} — {formatInteger(selectedMetric.stuck)}.
          </p>
          <ReliabilityBadge status={selectedRow.dataQualityStatus} />
        </div>
      ) : null}
    </div>
  )
}

function getEventRows(trajectory: SourceCohortTrajectoryReport, key: EventBreakdownKey) {
  const performance = getEventPerformance(trajectory)
  if (key === 'types') return performance.eventTypeRows
  if (key === 'events') return performance.eventRows
  return performance.managerRows
}

function EventTable({ trajectory }: { trajectory: SourceCohortTrajectoryReport }) {
  const [breakdown, setBreakdown] = useState<EventBreakdownKey>('types')
  const rows = getEventRows(trajectory, breakdown)
  const performance = getEventPerformance(trajectory)
  const windowDays = performance.outcomeWindowDays

  return (
    <>
      <div className="mt-5">
        <SegmentControl
          value={breakdown}
          onChange={setBreakdown}
          ariaLabel="Разрез мероприятий"
          items={(Object.keys(EVENT_BREAKDOWN_META) as EventBreakdownKey[]).map((value) => ({
            value,
            label: EVENT_BREAKDOWN_META[value].label,
          }))}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Когорта строится по дате мероприятия. В конверсию входят только посещения, после которых прошло {windowDays} дней. Одно посещение представлено в каждом из трех разрезов, поэтому суммы между разрезами не складываются.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[1040px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-4 py-3">{EVENT_BREAKDOWN_META[breakdown].subject}</th>
              {breakdown === 'events' ? <th className="px-3 py-3">Дата</th> : null}
              <th className="px-3 py-3">Мероприятий</th>
              <th className="px-3 py-3">Посещений</th>
              <th className="px-3 py-3">Зрелая база</th>
              <th className="px-3 py-3">Контракт после</th>
              <th className="px-3 py-3">Передано после</th>
              <th className="px-3 py-3">До контракта</th>
              <th className="px-3 py-3">Надежность</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Нет данных для выбранного разреза.</td></tr>
            ) : rows.map((row: SourceCohortEventPerformanceRow) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-b-0">
                <td className="max-w-[320px] px-4 py-3 font-bold leading-5 text-slate-900">{row.label}</td>
                {breakdown === 'events' ? <td className="px-3 py-3 tabular-nums">{formatDate(row.eventDate)}</td> : null}
                <td className="px-3 py-3 tabular-nums">{formatInteger(row.eventCount)}</td>
                <td className="px-3 py-3 tabular-nums">{formatInteger(row.attendedVisits)}</td>
                <td className="px-3 py-3 tabular-nums">{formatInteger(row.matureVisits)}</td>
                <td className="px-3 py-3 font-bold tabular-nums text-slate-900">{formatInteger(row.contractAfterVisits)} · {formatRate(row.contractRate)}</td>
                <td className="px-3 py-3 font-bold tabular-nums text-slate-900">{formatInteger(row.transferredAfterVisits)} · {formatRate(row.transferredRate)}</td>
                <td className="px-3 py-3 tabular-nums">{formatDays(row.medianDaysToContract)}</td>
                <td className="px-3 py-3"><ReliabilityBadge status={row.dataQualityStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Methodology({ trajectory }: { trajectory: SourceCohortTrajectoryReport }) {
  return (
    <details className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <summary className="min-h-10 cursor-pointer content-center font-bold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        Как считаются показатели и где есть ограничения
      </summary>
      <div className="mt-3 grid gap-4 border-t border-slate-200 pt-4 leading-6 lg:grid-cols-2">
        <div>
          <p><strong className="text-slate-800">Когорта пути:</strong> сделки, созданные в выбранном месяце. Создание совпадает с первым входом в «База входящая».</p>
          <p className="mt-2"><strong className="text-slate-800">Факт встречи:</strong> доверенная выполненная встреча из локального снимка активностей, а не сам перевод в CRM-этап.</p>
          <p className="mt-2"><strong className="text-slate-800">CRM-этапы:</strong> считаются отдельно и нужны для поиска расхождений с фактами.</p>
        </div>
        <div>
          <p><strong className="text-slate-800">Когорта мероприятий:</strong> посещения событий в выбранном диапазоне. Исход считается в окне {getEventPerformance(trajectory).outcomeWindowDays} дней после посещения.</p>
          <p className="mt-2"><strong className="text-slate-800">Атрибуция:</strong> менеджер сделки и ответственный посещения взяты из текущего снимка; это не исторические владельцы действий.</p>
          <p className="mt-2"><strong className="text-slate-800">Причинность:</strong> отчет показывает наблюдаемую конверсию после события, но не доказывает, что именно событие вызвало результат.</p>
        </div>
      </div>
      {trajectory.dataQuality.warnings.length > 0 || getEventPerformance(trajectory).warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-xs leading-5 text-amber-900">
          {[...trajectory.dataQuality.warnings, ...getEventPerformance(trajectory).warnings].map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}
    </details>
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
  const [mode, setMode] = useState<ReportMode>('journey')
  const [journeyView, setJourneyView] = useState<JourneyView>('facts')

  if (!trajectory) {
    return (
      <section className="panel p-5" data-comment-block-id="attraction-source-cohort-trajectory-conversions" data-comment-block-label="Конверсии">
        <SectionHeader
          eyebrow="Конверсии"
          title="Траектория пока недоступна"
          description={trajectoryUnavailableReason ?? 'API не передал расчет траектории для выбранной когорты.'}
        />
      </section>
    )
  }

  const performance = getEventPerformance(trajectory)
  return (
    <section
      className="panel min-w-0 p-5"
      data-comment-block-id="attraction-source-cohort-trajectory-conversions"
      data-comment-block-label="Конверсии"
    >
      <SectionHeader
        eyebrow="Конверсии"
        title={mode === 'journey' ? 'Путь участника по фактам и CRM' : 'Какие мероприятия связаны с дальнейшим результатом'}
        description={
          mode === 'journey'
            ? `Когорта ${selectedMonthLabel || '—'}: ${formatInteger(totalCreatedDeals)} сделок, созданных в этом месяце. Сравнивайте фактические действия, CRM-этапы и расхождения между ними.`
            : `Мероприятия за ${selectedMonthLabel || 'выбранный месяц'}. Сравнивайте типы, отдельные события и ответственных по конверсии в течение ${performance.outcomeWindowDays} дней после посещения.`
        }
        action={
          <SegmentControl
            value={mode}
            onChange={setMode}
            ariaLabel="Режим отчета конверсий"
            items={[
              { value: 'journey', label: 'Путь участника' },
              { value: 'events', label: 'Мероприятия' },
            ]}
          />
        }
      />

      {mode === 'journey' ? (
        <>
          <div className="mt-5 grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric label="Когорта" value={formatInteger(trajectory.totalDeals)} note="создано в месяце" />
            <SummaryMetric label="Передано в клуб" value={`${formatInteger(trajectory.overallSignals.wonDeals)} · ${formatRate(trajectory.totalDeals > 0 ? (trajectory.overallSignals.wonDeals / trajectory.totalDeals) * 100 : 0)}`} note="финальный результат" />
            <SummaryMetric label="В работе" value={formatInteger(trajectory.overallSignals.openDeals)} note="текущие открытые сделки" />
            <SummaryMetric label="Проиграно" value={formatInteger(trajectory.overallSignals.lostDeals)} note="текущий финальный статус" />
          </div>
          <div className="mt-5">
            <SegmentControl
              value={journeyView}
              onChange={setJourneyView}
              ariaLabel="Представление пути участника"
              items={[
                { value: 'facts', label: 'Факты' },
                { value: 'stages', label: 'CRM-этапы' },
                { value: 'gaps', label: 'Расхождения' },
              ]}
            />
          </div>
          {journeyView === 'facts' ? <JourneyFacts trajectory={trajectory} /> : null}
          {journeyView === 'stages' ? <JourneyStages trajectory={trajectory} /> : null}
          {journeyView === 'gaps' ? <JourneyGaps trajectory={trajectory} /> : null}
          <ComparisonMatrix trajectory={trajectory} />
        </>
      ) : (
        <>
          <div className="mt-5 grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryMetric label="Мероприятий" value={formatInteger(performance.totalEvents)} note="в выбранном диапазоне" />
            <SummaryMetric label="Посещений" value={formatInteger(performance.attendedVisits)} note="доверенные факты" />
            <SummaryMetric label="Зрелая база" value={formatInteger(performance.matureVisits)} note={`прошло ${performance.outcomeWindowDays} дней`} />
            <SummaryMetric label="Контракт после" value={formatInteger(performance.contractAfterVisits)} note="наблюдаемый результат" />
          </div>
          <EventTable trajectory={trajectory} />
        </>
      )}
      <Methodology trajectory={trajectory} />
    </section>
  )
}
