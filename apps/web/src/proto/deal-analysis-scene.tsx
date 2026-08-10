import {
  AiBrain01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  Calendar03Icon,
  Call02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Message01Icon,
  Sorting01Icon,
  Task01Icon,
  WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type {
  DashboardQuery,
  DealAnalysisCallInsight,
  DealAnalysisDetail,
  DealAnalysisRow,
  DealAnalysisScope,
  DealAnalysisTimelineItem,
  DealHealthBand,
} from '@/lib/dashboard-types'
import { formatAmount, formatInteger, formatShortDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { buildDashboardQueryFromProtoFilters } from '@/proto/live-reporting'
import type { SceneComponentProps } from '@/proto/types'

const healthMeta: Record<DealHealthBand, { label: string; text: string; bg: string; dot: string }> = {
  critical: { label: 'Критические', text: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500' },
  risk: { label: 'Риск', text: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  watch: { label: 'Наблюдение', text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-400' },
  healthy: { label: 'Здоровые', text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
}

const markerColors: Record<string, string> = {
  call: 'bg-blue-500',
  task_created: 'bg-sky-400',
  task_completed: 'bg-emerald-500',
  meeting: 'bg-violet-500',
  meeting_date_changed: 'bg-amber-400',
  conversion_event_visit: 'bg-fuchsia-500',
  message_count: 'bg-pink-500',
}

type DealSortKey = 'deal' | 'score' | 'risks' | 'manager' | 'stage' | 'activity' | 'nextAction' | 'amount'
type SortDirection = 'asc' | 'desc'
type DealSortState = { key: DealSortKey; direction: SortDirection }

const sortMeta: Record<DealSortKey, {
  label: string
  initialDirection: SortDirection
  description: Record<SortDirection, string>
}> = {
  deal: {
    label: 'Сделка',
    initialDirection: 'desc',
    description: { asc: 'ID по возрастанию', desc: 'ID по убыванию' },
  },
  score: {
    label: 'Оценка',
    initialDirection: 'asc',
    description: { asc: 'сначала проблемные', desc: 'сначала здоровые' },
  },
  risks: {
    label: 'Риски',
    initialDirection: 'desc',
    description: { asc: 'сначала меньше рисков', desc: 'сначала больше рисков' },
  },
  manager: {
    label: 'Менеджер',
    initialDirection: 'asc',
    description: { asc: 'от А до Я', desc: 'от Я до А' },
  },
  stage: {
    label: 'Этап',
    initialDirection: 'desc',
    description: { asc: 'сначала недавно на этапе', desc: 'сначала дольше на этапе' },
  },
  activity: {
    label: 'Активность',
    initialDirection: 'asc',
    description: { asc: 'сначала давно без активности', desc: 'сначала свежая активность' },
  },
  nextAction: {
    label: 'След. действие',
    initialDirection: 'asc',
    description: { asc: 'сначала без действия и просроченные', desc: 'сначала поздние сроки' },
  },
  amount: {
    label: 'Сумма',
    initialDirection: 'desc',
    description: { asc: 'сначала небольшие', desc: 'сначала крупные' },
  },
}

const dealCollator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' })

function compareOptionalNumbers(
  left: number | null,
  right: number | null,
  direction: SortDirection,
  missingFirst = false,
) {
  if (left === right) return 0
  if (left === null) return missingFirst && direction === 'asc' ? -1 : 1
  if (right === null) return missingFirst && direction === 'asc' ? 1 : -1
  return (left - right) * (direction === 'asc' ? 1 : -1)
}

function timestamp(value: string | null) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function compareRows(left: DealAnalysisRow, right: DealAnalysisRow, sort: DealSortState) {
  const directionFactor = sort.direction === 'asc' ? 1 : -1
  let result = 0

  if (sort.key === 'deal') result = dealCollator.compare(left.dealId, right.dealId) * directionFactor
  if (sort.key === 'score') result = compareOptionalNumbers(left.healthScore, right.healthScore, sort.direction)
  if (sort.key === 'risks') result = (left.risks.length - right.risks.length) * directionFactor
  if (sort.key === 'manager') result = dealCollator.compare(left.managerName, right.managerName) * directionFactor
  if (sort.key === 'stage') result = (left.daysOnStage - right.daysOnStage) * directionFactor
  if (sort.key === 'activity') {
    result = compareOptionalNumbers(timestamp(left.lastActivityAt), timestamp(right.lastActivityAt), sort.direction, true)
  }
  if (sort.key === 'nextAction') {
    result = compareOptionalNumbers(timestamp(left.nextAction.deadline), timestamp(right.nextAction.deadline), sort.direction, true)
  }
  if (sort.key === 'amount') result = (left.amount - right.amount) * directionFactor

  return result || dealCollator.compare(right.dealId, left.dealId)
}

function dateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function formatCallDuration(value: number | null) {
  if (value === null) return null
  const seconds = Math.max(0, Math.round(value))
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const remainingSeconds = seconds % 60
  return [
    hours ? `${hours} ч` : null,
    minutes ? `${minutes} мин` : null,
    remainingSeconds || (!hours && !minutes) ? `${remainingSeconds} сек` : null,
  ].filter(Boolean).join(' ')
}

function directionLabel(direction: DealAnalysisTimelineItem['direction']) {
  if (direction === 'outgoing') return 'Исходящий'
  if (direction === 'incoming') return 'Входящий'
  if (direction === 'unknown') return 'Направление не определено'
  return null
}

function activityComment(value: string) {
  return value.replace(/\[\/?p\]/gi, '').trim()
}

function eventStatusLabel(value: string | null) {
  if (value === 'invited') return 'Приглашён'
  if (value === 'confirmed') return 'Участие подтверждено'
  if (value === 'attended') return 'Посетил'
  if (value === 'missed') return 'Не пришёл'
  if (value === 'refused') return 'Отказался'
  return value
}

function SortHeader({
  sortKey,
  sort,
  align = 'left',
  onSort,
}: {
  sortKey: DealSortKey
  sort: DealSortState
  align?: 'left' | 'right'
  onSort(key: DealSortKey): void
}) {
  const meta = sortMeta[sortKey]
  const active = sort.key === sortKey
  const direction = active ? sort.direction : meta.initialDirection
  const nextAction = active
    ? `Изменить направление на ${direction === 'asc' ? 'по убыванию' : 'по возрастанию'}`
    : `Сортировать ${meta.description[meta.initialDirection]}`
  const icon = !active ? Sorting01Icon : direction === 'asc' ? ArrowUp01Icon : ArrowDown01Icon

  return (
    <th
      className={cn('px-4 py-0', align === 'right' && 'text-right')}
      aria-sort={active ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'group inline-flex min-h-11 w-full items-center gap-2 rounded-lg text-xs font-extrabold uppercase tracking-[0.06em] transition-[color,background-color] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
          active ? 'text-slate-900' : 'text-slate-500',
          align === 'right' ? 'justify-end' : 'justify-start',
        )}
        aria-label={`${meta.label}: ${active ? `${direction === 'asc' ? 'по возрастанию' : 'по убыванию'}, ${meta.description[direction]}` : 'сортировка не применена'}. ${nextAction}`}
      >
        <span>{meta.label}</span>
        <span className={cn(
          'inline-flex size-6 items-center justify-center rounded-md transition-[background-color,color,opacity]',
          active ? 'bg-blue-50 text-blue-700' : 'text-slate-300 opacity-70 group-hover:text-slate-500 group-hover:opacity-100',
        )} aria-hidden="true">
          <HugeiconsIcon icon={icon} strokeWidth={2.2} className="size-3.5" />
        </span>
      </button>
    </th>
  )
}

function CallAnalysisBlock({
  insight,
  allowed,
  onOpen,
}: {
  insight: DealAnalysisCallInsight | null
  allowed: boolean
  onOpen(): void
}) {
  if (!allowed) {
    return <p className="mt-3 text-xs leading-5 text-slate-400">Анализ и транскрипт доступны только руководителю.</p>
  }
  if (insight?.status === 'ready') {
    return (
      <section className="mt-4 rounded-xl bg-blue-50/80 p-4 shadow-[0_0_0_1px_oklch(0.75_0.09_255/0.32),0_6px_16px_oklch(0.35_0.08_255/0.06)]" aria-label="Анализ звонка">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-blue-950">
            <HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} className="size-4" aria-hidden="true" />
            <strong className="text-sm">Анализ звонка</strong>
          </div>
          {insight.score !== null ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold tabular-nums text-blue-700 shadow-[0_0_0_1px_oklch(0.75_0.09_255/0.24)]">{insight.score}/100</span> : null}
        </div>
        {insight.summary ? <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-blue-950">{insight.summary}</p> : null}
        {insight.risks.length ? <p className="mt-2 text-sm leading-6 text-blue-800"><strong>Риски:</strong> {insight.risks.join(' · ')}</p> : null}
        {insight.suggestedNextStep ? <p className="mt-3 rounded-lg bg-white/75 px-3 py-2.5 text-sm leading-6 text-blue-950"><strong>Следующий шаг:</strong> {insight.suggestedNextStep}</p> : null}
        {insight.transcript ? (
          <details className="mt-3 rounded-lg bg-white px-3 py-2.5 shadow-[0_0_0_1px_oklch(0.75_0.09_255/0.22)]">
            <summary className="cursor-pointer select-none text-sm font-bold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Показать транскрипт</summary>
            <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{insight.transcript}</p>
          </details>
        ) : <p className="mt-2 text-xs text-blue-700">Транскрипт для этого анализа не сохранён.</p>}
        <button type="button" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-blue-700 transition-[background-color,transform] hover:bg-white/80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" onClick={onOpen}>
          Открыть полный анализ
          <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-4" aria-hidden="true" />
        </button>
      </section>
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="inline-flex min-h-10 items-center rounded-xl bg-blue-50 px-3.5 text-sm font-bold text-blue-700 shadow-[inset_0_0_0_1px_oklch(0.85_0.07_255)] transition-[background-color,box-shadow,transform] hover:bg-blue-100 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        onClick={onOpen}
      >
        <HugeiconsIcon icon={AiBrain01Icon} strokeWidth={2} className="mr-2 size-4" aria-hidden="true" />
        {insight?.status === 'analyzing' ? 'Открыть ход анализа' : insight?.status === 'error' ? 'Открыть и повторить анализ' : 'Открыть в анализе звонков'}
      </button>
      {insight?.status === 'error' && insight.errorMessage ? <span className="text-sm text-rose-700">{insight.errorMessage}</span> : null}
    </div>
  )
}

function timelineVisual(item: DealAnalysisTimelineItem) {
  if (item.kind === 'call') return { icon: Call02Icon, label: 'Звонок', tone: 'bg-blue-50 text-blue-700' }
  if (item.kind === 'message') return { icon: Message01Icon, label: 'Сообщение', tone: 'bg-sky-50 text-sky-700' }
  if (item.kind === 'meeting' || item.kind === 'meeting_date_changed') return { icon: Calendar03Icon, label: item.kind === 'meeting' ? 'Встреча' : 'Изменение встречи', tone: 'bg-violet-50 text-violet-700' }
  if (item.kind === 'conversion_event_visit') return { icon: WorkflowSquare01Icon, label: 'Мероприятие', tone: 'bg-fuchsia-50 text-fuchsia-700' }
  if (item.kind === 'task_completed') return { icon: CheckmarkCircle02Icon, label: 'Задача', tone: 'bg-emerald-50 text-emerald-700' }
  return { icon: Task01Icon, label: 'Задача', tone: 'bg-amber-50 text-amber-700' }
}

function TimelineCard({
  item,
  insight,
  analysisAllowed,
  onOpenCallAnalysis,
}: {
  item: DealAnalysisTimelineItem
  insight: DealAnalysisCallInsight | null
  analysisAllowed: boolean
  onOpenCallAnalysis(): void
}) {
  const isTask = item.kind === 'task_created' || item.kind === 'task_completed'
  const isCall = item.kind === 'call'
  const isMessage = item.kind === 'message'
  const status = item.kind === 'conversion_event_visit' ? eventStatusLabel(item.detail) : null
  const visual = timelineVisual(item)
  const heading = isCall ? `${directionLabel(item.direction) ?? ''} звонок`.trim() : item.title

  return (
    <article className="relative pl-12">
      <span className={cn('absolute left-0 top-1 z-10 inline-flex size-10 items-center justify-center rounded-xl shadow-[0_0_0_4px_oklch(0.97_0.01_255),0_1px_2px_oklch(0.2_0.02_255/0.08)]', visual.tone)} aria-hidden="true">
        <HugeiconsIcon icon={visual.icon} strokeWidth={2} className="size-5" />
      </span>
      <div className="rounded-[18px] bg-white px-5 py-4 shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_1px_2px_-1px_oklch(0_0_0/0.06),0_6px_18px_oklch(0.2_0.02_255/0.05)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{visual.label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="break-words font-bold leading-6 text-slate-950">{heading}</h3>
              {isTask ? <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', item.completedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{item.completedAt ? 'Выполнена' : 'Запланирована'}</span> : null}
              {status && !isTask ? <span className="whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{status}</span> : null}
            </div>
            {isCall || isMessage ? <p className="mt-1 text-sm font-medium text-slate-500">{[isMessage ? directionLabel(item.direction) : null, isCall ? formatCallDuration(item.durationSeconds) : null].filter(Boolean).join(' · ')}</p> : null}
          </div>
          <time className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-slate-400">{dateTime(item.occurredAt)}</time>
        </div>

        {isTask ? (
          <>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums text-slate-500">
              {item.createdAt ? <span><strong className="text-slate-700">Создана:</strong> {dateTime(item.createdAt)}</span> : null}
              {item.deadlineAt ? <span><strong className="text-slate-700">Выполнить до:</strong> {dateTime(item.deadlineAt)}</span> : null}
              {item.completedAt ? <span><strong className="text-slate-700">Завершена:</strong> {dateTime(item.completedAt)}</span> : null}
            </div>
            {item.comment ? (
              <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{activityComment(item.comment)}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                {analysisAllowed ? 'Комментарий к задаче не заполнен.' : 'Содержание задачи доступно руководителю.'}
              </p>
            )}
          </>
        ) : null}

        {isMessage && item.detail ? <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.detail}</p> : null}

        {item.kind === 'meeting' && item.deadlineAt ? <p className="mt-3 text-sm text-slate-600"><strong>Встреча назначена:</strong> {dateTime(item.deadlineAt)}</p> : null}
        {item.kind === 'meeting' && item.comment ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.comment}</p> : null}
        {item.kind === 'meeting_date_changed' && item.detail ? <p className="mt-3 text-sm text-slate-600">{item.detail}</p> : null}
        {item.stageName ? <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-400">Этап на момент события: {item.stageName}</p> : null}

        {isCall ? <CallAnalysisBlock insight={insight} allowed={analysisAllowed} onOpen={onOpenCallAnalysis} /> : null}
      </div>
    </article>
  )
}

function nextActionLabel(row: DealAnalysisRow) {
  if (row.nextAction.status === 'missing') return 'Не назначено'
  if (row.nextAction.status === 'overdue') return `Просрочено ${row.nextAction.overdueDays} дн.`
  if (row.nextAction.status === 'today') return 'Сегодня'
  return formatShortDate(row.nextAction.deadline ?? '')
}

function HealthBadge({ row }: { row: DealAnalysisRow }) {
  if (row.healthScore === null || !row.healthBand) return <span className="text-slate-400">—</span>
  const meta = healthMeta[row.healthBand]!
  return (
    <span className={`inline-flex min-w-11 items-center justify-center rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums ${meta.bg} ${meta.text}`} title={meta.label}>
      {row.healthScore}
    </span>
  )
}

function ActivityDots({ row }: { row: DealAnalysisRow }) {
  const markers = [...row.activityMarkers].reverse().slice(-12)
  return (
    <div className="min-w-36" aria-label={`${row.activityMarkerCount} активностей`}>
      <div className="flex items-center gap-1">
        <span className="h-px min-w-5 flex-1 bg-slate-200" />
        {markers.length === 0 ? <span className="text-xs text-slate-400">нет событий</span> : markers.map((marker) => (
          <span
            key={marker.id}
            className={`size-2 shrink-0 rounded-full ${markerColors[marker.kind] ?? 'bg-slate-400'}`}
            title={`${marker.kind}: ${dateTime(marker.occurredAt)}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-400">
        {row.lastActivityAt ? `Последняя: ${formatShortDate(row.lastActivityAt)}` : 'Активностей нет'}
      </p>
    </div>
  )
}

function DealTableRow({
  row,
  scope,
  onOpen,
}: {
  row: DealAnalysisRow
  scope: DealAnalysisScope
  onOpen(): void
}) {
  const actionIsAtRisk = row.nextAction.status === 'missing' || row.nextAction.status === 'overdue'

  return (
    <tr className="group hover:bg-slate-50/90">
      <td className="px-5 py-3.5">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg text-left transition-[color,background-color,transform] hover:text-blue-700 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          aria-label={`Открыть сделку ${row.dealId}`}
        >
          <span className="min-w-0">
            <strong className="block font-extrabold tabular-nums text-slate-950 group-hover:text-blue-700">#{row.dealId}</strong>
            <span className="mt-0.5 block truncate text-sm text-slate-500" title={row.sourceLabel}>{row.sourceLabel}</span>
          </span>
          <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-4 shrink-0 text-slate-300 transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-600" aria-hidden="true" />
        </button>
      </td>
      {scope === 'open' ? (
        <>
          <td className="px-4 py-3.5"><HealthBadge row={row} /></td>
          <td className="px-4 py-3.5">
            <span className={cn('inline-flex items-center gap-2 text-sm font-extrabold tabular-nums', row.risks.length ? 'text-orange-700' : 'text-slate-400')}>
              <span className={cn('size-2 rounded-full', row.risks.length ? 'bg-orange-500' : 'bg-slate-200')} aria-hidden="true" />
              {row.risks.length || '—'}
            </span>
          </td>
        </>
      ) : null}
      <td className="px-4 py-3.5 text-sm font-semibold leading-5 text-slate-700">{row.managerName}</td>
      <td className="px-4 py-3.5">
        <strong className="block text-sm leading-5 text-slate-900">{row.stageName}</strong>
        <span className={cn('mt-1 block text-xs font-medium tabular-nums', row.stageOverdueDays ? 'text-orange-600' : 'text-slate-400')}>{row.daysOnStage} дн. на этапе</span>
      </td>
      <td className="px-4 py-3.5"><ActivityDots row={row} /></td>
      <td className="px-4 py-3.5">
        <span className={cn('text-sm font-bold tabular-nums', actionIsAtRisk ? 'text-orange-700' : 'text-slate-700')}>{nextActionLabel(row)}</span>
      </td>
      <td className="px-5 py-3.5 text-right font-extrabold tabular-nums text-slate-950">{formatAmount(row.amount)}</td>
    </tr>
  )
}

function DealDrawer({
  row,
  query,
  scope,
  onClose,
  onOpenCallAnalysis,
}: {
  row: DealAnalysisRow
  query: DashboardQuery
  scope: DealAnalysisScope
  onClose(): void
  onOpenCallAnalysis(callId: string, startedAt: string): void
}) {
  const drawerRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const [detail, setDetail] = useState<DealAnalysisDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'risks' | 'activity' | 'path' | 'details'>(row.risks.length ? 'risks' : 'activity')

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute('hidden'))
      if (focusable.length === 0) {
        event.preventDefault()
        closeRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !drawerRef.current.contains(active))) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && (active === last || !drawerRef.current.contains(active))) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiClient.getDealAnalysisDetail(row.dealId, query, scope)
      .then((next) => { if (!cancelled) setDetail(next) })
      .catch((nextError: unknown) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить сделку')
      })
    return () => { cancelled = true }
  }, [query, row.dealId, scope])

  const callInsightById = useMemo(
    () => new Map((detail?.callInsights ?? []).map((insight) => [insight.callId, insight])),
    [detail?.callInsights],
  )

  const tabs = [
    ['risks', 'Риски'], ['activity', 'Активность'], ['path', 'История этапов'], ['details', 'Детали'],
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside ref={drawerRef} className="flex h-full w-full max-w-[820px] flex-col bg-slate-50 shadow-2xl [overscroll-behavior:contain]" role="dialog" aria-modal="true" aria-label={`Сделка ${row.dealId}`}>
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-400">Сделка <span className="tabular-nums">#{row.dealId}</span></p>
              <h2 className="mt-1 text-balance text-2xl font-bold leading-tight text-slate-950">{row.stageName}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                <span>{row.sourceLabel}</span><span aria-hidden="true">·</span>
                <span className="font-semibold tabular-nums text-slate-700">{formatAmount(row.amount)}</span><span aria-hidden="true">·</span>
                <span>{row.managerName}</span>
              </div>
              {scope === 'open' ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <HealthBadge row={row} />
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', row.risks.length ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700')}>
                    {row.risks.length ? `${row.risks.length} ${row.risks.length === 1 ? 'риск' : 'риска'}` : 'Без операционных рисков'}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {row.dealUrl ? (
                <a className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 pl-4 pr-3.5 text-sm font-bold text-slate-800 transition-[background-color,transform] hover:bg-slate-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" href={row.dealUrl} target="_blank" rel="noreferrer">
                  Открыть в CRM
                  <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-4" aria-hidden="true" />
                </a>
              ) : null}
              <button ref={closeRef} type="button" onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-xl text-slate-500 transition-[background-color,color,transform] hover:bg-slate-100 hover:text-slate-900 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" aria-label="Закрыть">
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav className="mt-5 grid grid-cols-4 rounded-xl bg-slate-100 p-1" aria-label="Разделы сделки">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cn(
                  'min-h-11 rounded-lg px-2 text-sm font-bold transition-[background-color,color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                  tab === id ? 'bg-white text-blue-700 shadow-[0_1px_3px_oklch(0.2_0.02_255/0.12)]' : 'text-slate-500 hover:bg-white/55 hover:text-slate-800',
                )}
              >{label}</button>
            ))}
          </nav>
        </header>
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {!detail && !error ? <div className="rounded-[18px] bg-white p-6 text-slate-500 shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_4px_14px_oklch(0.2_0.02_255/0.05)]" aria-live="polite">Загружаю историю сделки…</div> : null}
          {error ? <div className="rounded-[18px] bg-rose-50 p-5 text-rose-700 shadow-[0_0_0_1px_oklch(0.65_0.18_25/0.2)]" role="alert">{error}</div> : null}
          {detail && tab === 'risks' ? (
            detail.row.risks.length === 0 ? (
              <div className="flex items-start gap-3 rounded-[18px] bg-emerald-50 p-5 text-emerald-800 shadow-[0_0_0_1px_oklch(0.7_0.12_155/0.2)]">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <p className="text-sm font-semibold leading-6">Операционных рисков по текущим правилам нет.</p>
              </div>
            ) : (
              <section className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_1px_2px_-1px_oklch(0_0_0/0.06),0_8px_22px_oklch(0.2_0.02_255/0.05)]" aria-label="Риски сделки">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 text-orange-600" aria-hidden="true" />
                    <h3 className="font-bold text-slate-950">Что требует вмешательства</h3>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-400">{detail.row.risks.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {detail.row.risks.map((risk) => (
                    <article key={risk.key} className="px-5 py-5">
                      <div className="flex items-start justify-between gap-4"><h4 className="font-bold leading-6 text-slate-950">{risk.label}</h4><span className="whitespace-nowrap rounded-full bg-orange-50 px-2.5 py-1 text-xs font-extrabold tabular-nums text-orange-700">−{risk.deduction}</span></div>
                      <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-slate-500">{risk.evidence}</p>
                      <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-semibold leading-6 text-slate-800"><span className="text-slate-400">Проверить:</span> {risk.recommendation}</p>
                    </article>
                  ))}
                </div>
              </section>
            )
          ) : null}
          {detail && tab === 'activity' ? (
            <div className="relative space-y-4 before:absolute before:bottom-6 before:left-5 before:top-6 before:w-px before:bg-slate-200">
              {detail.timeline.length === 0 ? <p className="text-slate-500">За выбранный период активностей нет.</p> : detail.timeline.map((item) => (
                <TimelineCard
                  key={item.id}
                  item={item}
                  insight={item.kind === 'call' ? callInsightById.get(item.sourceEntityId) ?? null : null}
                  analysisAllowed={detail.sensitiveContentAvailable}
                  onOpenCallAnalysis={() => onOpenCallAnalysis(item.sourceEntityId, item.occurredAt)}
                />
              ))}
              {!detail.sensitiveContentAvailable ? <p className="text-xs text-slate-400">Тексты сообщений и выводы анализа звонков доступны только руководителю.</p> : null}
            </div>
          ) : null}
          {detail && tab === 'path' ? (
            detail.stageHistory.length === 0 ? <p className="text-slate-500">История перемещений по этапам отсутствует.</p> : (
              <ol className="relative space-y-1 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-slate-200">
                {detail.stageHistory.map((entry, index) => (
                  <li key={entry.id} className="relative flex gap-4 py-3 pl-12">
                    <span className={cn('absolute left-0 top-3 z-10 flex size-10 items-center justify-center rounded-xl text-sm font-extrabold tabular-nums', index === 0 ? 'bg-blue-600 text-white shadow-[0_0_0_4px_oklch(0.97_0.01_255)]' : 'bg-white text-slate-500 shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_0_0_4px_oklch(0.97_0.01_255)]')}>{detail.stageHistory.length - index}</span>
                    <div className="min-w-0 py-1.5"><p className="font-bold leading-6 text-slate-900">{entry.stageName}</p><time className="mt-0.5 block text-sm font-medium tabular-nums text-slate-500">{dateTime(entry.enteredAt)}</time></div>
                  </li>
                ))}
              </ol>
            )
          ) : null}
          {detail && tab === 'details' ? (
            <dl className="grid overflow-hidden rounded-[18px] bg-white sm:grid-cols-2 shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_6px_18px_oklch(0.2_0.02_255/0.05)]">
              {[
                ['ID сделки', detail.row.dealId], ['Менеджер', detail.row.managerName], ['Источник', detail.row.sourceLabel],
                ['Сумма', formatAmount(detail.row.amount)], ['Создана', dateTime(detail.row.dateCreate)],
                ['На этапе', `${detail.row.daysOnStage} дн.`], ['Последняя активность', dateTime(detail.row.lastActivityAt)],
                ['Последний звонок', dateTime(detail.row.lastCallAt)],
              ].map(([label, value], index) => <div key={label} className={cn('p-4', index > 1 && 'border-t border-slate-100', index % 2 === 1 && 'sm:border-l sm:border-slate-100')}><dt className="text-xs font-extrabold uppercase tracking-[0.06em] text-slate-400">{label}</dt><dd className="mt-1.5 font-semibold tabular-nums text-slate-900">{value}</dd></div>)}
            </dl>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

export function DealAnalysisScene({ filters, onCallAnalysisNavigate }: SceneComponentProps) {
  const queryKey = useMemo(() => JSON.stringify(buildDashboardQueryFromProtoFilters(filters)), [filters])
  const query = useMemo(() => JSON.parse(queryKey) as DashboardQuery, [queryKey])
  const [scope, setScope] = useState<DealAnalysisScope>('open')
  const requestKey = `${queryKey}:${scope}`
  const [reportState, setReportState] = useState<{ requestKey: string; rows: DealAnalysisRow[]; scopeStatus: string } | null>(null)
  const [errorState, setErrorState] = useState<{ requestKey: string; message: string } | null>(null)
  const [health, setHealth] = useState<DealHealthBand | 'all'>('all')
  const [sort, setSort] = useState<DealSortState>({ key: 'score', direction: 'asc' })
  const [visible, setVisible] = useState(50)
  const [selected, setSelected] = useState<DealAnalysisRow | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient.getDealAnalysisReport(query, scope)
      .then((report) => { if (!cancelled) { setReportState({ requestKey, rows: report.rows, scopeStatus: report.currentScope.status }); setErrorState(null) } })
      .catch((nextError: unknown) => { if (!cancelled) setErrorState({ requestKey, message: nextError instanceof Error ? nextError.message : 'Не удалось загрузить анализ сделок' }) })
    return () => { cancelled = true }
  }, [query, requestKey, scope])

  const rows = reportState?.requestKey === requestKey ? reportState.rows : null
  const scopeStatus = reportState?.requestKey === requestKey ? reportState.scopeStatus : null
  const error = errorState?.requestKey === requestKey ? errorState.message : null

  const filteredRows = useMemo(
    () => health === 'all' ? rows ?? [] : (rows ?? []).filter((row) => row.healthBand === health),
    [health, rows],
  )
  const sortedRows = useMemo(
    () => [...filteredRows].sort((left, right) => compareRows(left, right, sort)),
    [filteredRows, sort],
  )
  const cards = (['critical', 'risk', 'watch', 'healthy'] as DealHealthBand[]).map((band) => {
    const matches = (rows ?? []).filter((row) => row.healthBand === band)
    return { band, count: matches.length, amount: matches.reduce((sum, row) => sum + row.amount, 0) }
  })

  function changeScope(nextScope: DealAnalysisScope) {
    setScope(nextScope)
    setHealth('all')
    setVisible(50)
    setSort(nextScope === 'open' ? { key: 'score', direction: 'asc' } : { key: 'amount', direction: 'desc' })
  }

  function changeSort(key: DealSortKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: sortMeta[key].initialDirection })
    setVisible(50)
  }

  const activeHealthLabel = health === 'all' ? null : healthMeta[health].label
  const activeHealthMeta = health === 'all' ? null : healthMeta[health]
  const activeSortDescription = `${sortMeta[sort.key].label}: ${sortMeta[sort.key].description[sort.direction]}`

  return (
    <section className="grid min-w-0 gap-6" data-proto-block-id="attraction-deal-analysis-summary">
      <header className="panel overflow-hidden p-5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <p className="subtle-label">Ежедневное управление</p>
            <h1 className="mt-1 text-balance text-3xl font-bold leading-tight text-slate-950">Анализ сделок</h1>
            <p className="mt-2 max-w-xl text-pretty text-sm leading-6 text-slate-600">Очередь вмешательства: где сделка теряет темп, почему это произошло и что руководителю проверить дальше.</p>
            <p className="mt-3 inline-flex rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold leading-5 text-slate-500">Срез берётся из общего фильтра выше · период ограничивает только отображаемую активность</p>
          </div>
          <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1" aria-label="Состояние сделок">
            {([['open', 'В работе'], ['won', 'Выиграны'], ['lost', 'Проиграны']] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => changeScope(id)}
                aria-pressed={scope === id}
                className={cn(
                  'min-h-10 rounded-lg px-4 text-sm font-bold transition-[background-color,color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                  scope === id ? 'bg-white text-blue-700 shadow-[0_1px_3px_oklch(0.2_0.02_255/0.12)]' : 'text-slate-500 hover:bg-white/55 hover:text-slate-800',
                )}
              >{label}</button>
            ))}
          </div>
        </div>
        {scopeStatus && scopeStatus !== 'ready' ? <div className="sync-notice sync-notice-warning mt-4">Последняя успешная синхронизация устарела. Показан последний полностью согласованный снимок сделок.</div> : null}
      </header>

      {scope === 'open' ? (
        <section className="panel overflow-hidden" aria-labelledby="deal-health-heading">
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
            <div className="flex items-baseline gap-3">
              <h2 id="deal-health-heading" className="font-bold text-slate-950">Состояние портфеля</h2>
              <span className="text-xs font-semibold tabular-nums text-slate-400">{formatInteger((rows ?? []).length)} сделок</span>
            </div>
            {activeHealthLabel ? <button type="button" onClick={() => setHealth('all')} className="min-h-10 rounded-lg px-3 text-sm font-bold text-blue-700 transition-[background-color,transform] hover:bg-blue-50 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Снять фильтр «{activeHealthLabel}»</button> : <span className="text-xs font-medium text-slate-400">Нажмите сегмент, чтобы отфильтровать</span>}
          </div>
          <div className="grid gap-px bg-slate-200/70 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ band, count, amount }) => {
              const meta = healthMeta[band]!
              const active = health === band
              return (
                <button
                  key={band}
                  type="button"
                  onClick={() => setHealth(active ? 'all' : band)}
                  aria-pressed={active}
                  className={cn(
                    'relative min-h-24 bg-white px-5 py-4 text-left transition-[background-color,box-shadow,transform] hover:bg-slate-50 active:scale-[0.96] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
                    active && `${meta.bg} shadow-[inset_0_-3px_0_oklch(0.62_0.18_255)]`,
                  )}
                >
                  <span className="flex items-center gap-2"><span className={cn('size-2.5 rounded-full', meta.dot)} aria-hidden="true" /><span className={cn('text-sm font-bold', active ? meta.text : 'text-slate-500')}>{meta.label}</span></span>
                  <span className="mt-3 flex items-end justify-between gap-3"><strong className="text-2xl font-extrabold tabular-nums text-slate-950">{formatInteger(count)}</strong><span className="text-sm font-semibold tabular-nums text-slate-500">{formatAmount(amount)}</span></span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className="panel overflow-hidden" data-proto-block-id="attraction-deal-analysis-table">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-slate-950">Сделки</h2>
            <span className="text-sm font-semibold tabular-nums text-slate-400">{formatInteger(filteredRows.length)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500" aria-live="polite">
            {activeHealthMeta ? <span className={cn('rounded-full px-2.5 py-1', activeHealthMeta.bg, activeHealthMeta.text)}>{activeHealthMeta.label}</span> : null}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1"><HugeiconsIcon icon={Sorting01Icon} strokeWidth={2} className="size-3.5" aria-hidden="true" />{activeSortDescription}</span>
          </div>
        </div>
        {error ? <div className="p-6 text-rose-700" role="alert">{error}</div> : null}
        {!rows && !error ? <div className="p-6 text-slate-500" aria-live="polite">Загружаю текущие сделки…</div> : null}
        {rows ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-left">
              <thead className="bg-slate-50/90"><tr>
                <SortHeader sortKey="deal" sort={sort} onSort={changeSort} />
                {scope === 'open' ? <><SortHeader sortKey="score" sort={sort} onSort={changeSort} /><SortHeader sortKey="risks" sort={sort} onSort={changeSort} /></> : null}
                <SortHeader sortKey="manager" sort={sort} onSort={changeSort} />
                <SortHeader sortKey="stage" sort={sort} onSort={changeSort} />
                <SortHeader sortKey="activity" sort={sort} onSort={changeSort} />
                <SortHeader sortKey="nextAction" sort={sort} onSort={changeSort} />
                <SortHeader sortKey="amount" sort={sort} align="right" onSort={changeSort} />
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{sortedRows.slice(0, visible).map((row) => <DealTableRow key={row.dealId} row={row} scope={scope} onOpen={() => setSelected(row)} />)}</tbody>
            </table>
            {sortedRows.length === 0 ? <div className="border-t border-slate-100 p-8 text-center text-slate-500">По выбранному состоянию сделок нет.</div> : null}
          </div>
        ) : null}
        {filteredRows.length > visible ? <div className="border-t border-slate-100 p-4 text-center"><button type="button" onClick={() => setVisible((count) => count + 50)} className="btn btn-ghost">Показать ещё</button></div> : null}
      </div>
      {selected ? <DealDrawer row={selected} query={query} scope={scope} onClose={() => setSelected(null)} onOpenCallAnalysis={(callId, startedAt) => onCallAnalysisNavigate?.(callId, startedAt)} /> : null}
    </section>
  )
}
