import { useEffect, useMemo, useState } from 'react'

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
import { apiClient } from '@/lib/api-client'
import type {
  CallAnalysisQueueCallType,
  CallAnalysisQueueItem,
  CallAnalysisQueueResponse,
  CallAnalysisQueueStatus,
  CallAnalysisResult,
} from '@/lib/dashboard-types'
import { cn } from '@/lib/utils'
import type { PickerOption } from '@/proto/types'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'
type AnalysisStatus = 'idle' | 'loading' | 'missing' | 'ready' | 'analyzing' | 'error'

interface CallAnalysisFilters {
  rangeStart: string
  rangeEnd: string
  managerId: string
  sourceKey: string
  stageId: string
  callType: '' | CallAnalysisQueueCallType
  analysisStatus: '' | CallAnalysisQueueStatus
}

export interface CallAnalysisTarget {
  callId: string
  startedAt: string
}

export function createDefaultCallAnalysisFilters(today = new Date()): CallAnalysisFilters {
  const currentWeekStart = startOfCalendarWeek(today)
  const previousWeekStart = shiftDate(currentWeekStart, -7)
  const previousWeekEnd = shiftDate(previousWeekStart, 6)

  return {
    rangeStart: formatDateInputValue(previousWeekStart),
    rangeEnd: formatDateInputValue(previousWeekEnd),
    managerId: '',
    sourceKey: '',
    stageId: '',
    callType: '',
    analysisStatus: '',
  }
}

export function createCallAnalysisFiltersForTarget(
  target: CallAnalysisTarget | null,
  today = new Date(),
): CallAnalysisFilters {
  const filters = createDefaultCallAnalysisFilters(today)
  if (!target) return filters

  const startedAt = new Date(target.startedAt)
  if (Number.isNaN(startedAt.getTime())) return filters

  const targetDate = formatDateInputValue(startedAt)
  return { ...filters, rangeStart: targetDate, rangeEnd: targetDate }
}

const callTypeOptions: Array<{ value: '' | CallAnalysisQueueCallType; label: string }> = [
  { value: '', label: 'Все' },
  { value: 'outgoing_over_30', label: 'Исх >30' },
  { value: 'outgoing_under_30', label: 'Исх <30' },
  { value: 'incoming', label: 'Входящий' },
]

const analysisStatusOptions: Array<{ value: '' | CallAnalysisQueueStatus; label: string }> = [
  { value: '', label: 'Все' },
  { value: 'not_analyzed', label: 'Без оценки' },
  { value: 'analyzing', label: 'В анализе' },
  { value: 'ready', label: 'Готово' },
  { value: 'error', label: 'Ошибка' },
]

function normalizeDateForInput(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(12, 0, 0, 0)

  return normalized
}

function shiftDate(date: Date, days: number) {
  const shifted = normalizeDateForInput(date)
  shifted.setDate(shifted.getDate() + days)

  return shifted
}

function startOfCalendarWeek(date: Date) {
  const normalized = normalizeDateForInput(date)
  const daysSinceMonday = (normalized.getDay() + 6) % 7

  return shiftDate(normalized, -daysSinceMonday)
}

function formatDateInputValue(date: Date) {
  const normalized = normalizeDateForInput(date)
  const year = normalized.getFullYear()
  const month = String(normalized.getMonth() + 1).padStart(2, '0')
  const day = String(normalized.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toRangeStart(value: string) {
  return `${value}T00:00:00.000+03:00`
}

function toRangeEnd(value: string) {
  return `${value}T23:59:59.999+03:00`
}

function getErrorStatus(error: unknown) {
  return error && typeof error === 'object' && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU', { hour12: false })
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.max(0, Math.round(seconds % 60))
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function scoreClass(score: number | null) {
  if (score === null) {
    return 'text-slate-500'
  }

  if (score >= 80) {
    return 'text-emerald-700'
  }

  if (score >= 60) {
    return 'text-amber-700'
  }

  return 'text-rose-700'
}

function statusBadgeClass(status: CallAnalysisQueueStatus) {
  if (status === 'ready') {
    return 'badge-green'
  }

  if (status === 'error') {
    return 'badge-red'
  }

  if (status === 'analyzing') {
    return 'badge-neutral'
  }

  return 'badge-amber'
}

function statusLabel(status: CallAnalysisQueueStatus) {
  if (status === 'ready') {
    return 'готово'
  }

  if (status === 'error') {
    return 'ошибка'
  }

  if (status === 'analyzing') {
    return 'в анализе'
  }

  return 'без оценки'
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return `${Math.round(value * 100)}%`
}

function resolveAnalysisActionState({
  result,
  selectedCall,
  status,
}: {
  result: CallAnalysisResult | null
  selectedCall: CallAnalysisQueueItem | null
  status: AnalysisStatus
}) {
  if (!selectedCall) {
    return {
      canRun: false,
      disabled: true,
      label: 'Проанализировать',
    }
  }

  if (status === 'loading') {
    return {
      canRun: false,
      disabled: true,
      label: 'Загружаю анализ...',
    }
  }

  if (status === 'analyzing' || selectedCall.analysisStatus === 'analyzing') {
    return {
      canRun: false,
      disabled: true,
      label: 'Анализируется...',
    }
  }

  if (result || selectedCall.analysisStatus === 'ready') {
    return {
      canRun: false,
      disabled: true,
      label: 'Анализ готов',
    }
  }

  if (selectedCall.analysisStatus === 'error') {
    return {
      canRun: true,
      disabled: false,
      label: 'Повторить после ошибки',
    }
  }

  if (status === 'error') {
    return {
      canRun: false,
      disabled: true,
      label: 'Ошибка загрузки',
    }
  }

  return {
    canRun: true,
    disabled: false,
    label: 'Проанализировать',
  }
}

function summarizeQueue(queue: CallAnalysisQueueResponse | null) {
  if (!queue) {
    return [
      { label: 'Звонки', value: '—', hint: 'в выборке' },
      { label: 'Проанализировано', value: '—', hint: 'manual run' },
      { label: 'Средний score', value: '—', hint: 'по готовым' },
      { label: 'Без оценки', value: '—', hint: 'кандидаты' },
    ]
  }

  return [
    { label: 'Звонки', value: String(queue.totals.total), hint: 'в выборке' },
    { label: 'Проанализировано', value: String(queue.totals.ready), hint: 'manual run' },
    {
      label: 'Средний score',
      value: queue.totals.averageScore === null ? '—' : String(queue.totals.averageScore),
      hint: 'по готовым',
    },
    { label: 'Без оценки', value: String(queue.totals.notAnalyzed), hint: 'кандидаты' },
  ]
}

type SingleSelectOption = {
  value: string
  label: string
  meta: string
}

function SingleSelectField({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  options: SingleSelectOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className="grid gap-1.5">
      <span className="subtle-label">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="field flex items-center justify-between text-left"
            aria-label={label}
          >
            <span className="truncate">{selectedOption?.label ?? placeholder}</span>
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
                    key={`${label}-${option.value || 'all'}`}
                    value={`${option.label} ${option.meta}`}
                    data-checked={option.value === value}
                    className="cursor-pointer"
                    onSelect={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
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

function renderAiList(title: string, items: string[]) {
  if (items.length === 0) {
    return null
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <ul className="mt-2 grid gap-2 text-sm text-slate-700">
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`} className="border-l-2 border-blue-300 pl-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CallQueueList({
  items,
  selectedCallId,
  onSelect,
}: {
  items: CallAnalysisQueueItem[]
  selectedCallId: string | null
  onSelect: (callId: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Нет звонков по выбранным фильтрам.
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <button
          key={item.callId}
          type="button"
          className={cn(
            'grid w-full gap-1 px-4 py-3 text-left transition hover:bg-blue-50/60',
            selectedCallId === item.callId && 'bg-blue-50 ring-1 ring-inset ring-blue-300',
          )}
          aria-pressed={selectedCallId === item.callId}
          onClick={() => onSelect(item.callId)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">ID {item.callId}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-500">
                {item.managerName} · {formatDateTime(item.startedAt)} · {item.callTypeLabel}
              </div>
            </div>
            <div className={cn('text-sm font-black tabular-nums', scoreClass(item.score))}>
              {item.score ?? '—'}
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {item.dealId ? `#${item.dealId}` : 'без сделки'} ·{' '}
            {item.dealSourceId ?? 'без источника'} ·{' '}
            {item.stageAtCallName ?? item.dealCurrentStageName ?? 'этап не определен'}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className={cn('badge-chip', statusBadgeClass(item.analysisStatus))}>
              {statusLabel(item.analysisStatus)}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {formatDuration(item.durationSeconds)}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

function TranscriptPane({ result }: { result: CallAnalysisResult | null }) {
  if (!result) {
    return (
      <section className="border-t border-slate-200 p-5">
        <h3 className="subtle-label">Транскрипт по ролям</h3>
        <p className="mt-3 text-sm text-slate-500">
          Появится после успешного анализа выбранного звонка.
        </p>
      </section>
    )
  }

  return (
    <section className="border-t border-slate-200 p-5">
      <h3 className="subtle-label">Транскрипт по ролям</h3>
      <div className="mt-3 divide-y divide-slate-100">
        {result.transcriptByRoles.map((segment, index) => (
          <div
            key={`${segment.start}-${segment.end}-${index}`}
            className="grid gap-3 py-4 md:grid-cols-[96px_minmax(0,1fr)_90px]"
          >
            <div
              className={cn(
                'text-sm font-black',
                segment.role === 'manager' ? 'text-blue-700' : 'text-slate-600',
              )}
            >
              {segment.role === 'manager'
                ? 'Менеджер'
                : segment.role === 'client'
                  ? 'Клиент'
                  : 'Неизвестно'}
            </div>
            <div className="text-sm leading-6 text-slate-800">{segment.text}</div>
            <div className="text-xs font-bold tabular-nums text-slate-500">
              {formatDuration(segment.start)}-{formatDuration(segment.end)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AnalysisPane({
  result,
  status,
  error,
}: {
  result: CallAnalysisResult | null
  status: AnalysisStatus
  error: string | null
}) {
  if (status === 'loading') {
    return <div className="p-5 text-sm font-semibold text-slate-500">Загружаю оценку...</div>
  }

  if (status === 'analyzing') {
    return <div className="p-5 text-sm font-semibold text-slate-500">Транскрибирую и оцениваю...</div>
  }

  if (status === 'error') {
    return (
      <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
        {error ?? 'Не удалось загрузить анализ.'}
      </div>
    )
  }

  if (!result) {
    return (
      <div className="p-5 text-sm text-slate-500">
        Для этого звонка еще нет оценки. Запусти анализ вручную.
      </div>
    )
  }

  const evaluation = result.aiEvaluation
  const metadata = [
    ['Prompt', result.promptVersion],
    ['Model', result.model],
    ['Дата анализа', formatDateTime(result.analyzedAt)],
    ['Confidence', formatPercent(evaluation.confidence)],
  ]

  return (
    <div className="grid gap-3 p-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="subtle-label">Score</div>
            <div className={cn('mt-1 text-3xl font-black', scoreClass(evaluation.score))}>
              {evaluation.score}
            </div>
          </div>
          <span className="badge-chip badge-neutral">{result.promptVersion}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-700">{evaluation.summary}</p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs sm:grid-cols-2">
          {metadata.map(([label, value]) => (
            <div key={label} className="min-w-0 bg-slate-50 p-2">
              <div className="subtle-label">{label}</div>
              <div className="mt-1 break-words font-bold text-slate-800">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Классификация звонка</h3>
          <span className="badge-chip badge-neutral">
            {formatPercent(evaluation.callClassification.confidence)}
          </span>
        </div>
        <div className="mt-2 text-sm font-black text-slate-900">
          {evaluation.callClassification.type}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {evaluation.callClassification.reason}
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
          {evaluation.callTypeInterpretation}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Применимость prompt</h3>
          <span className="badge-chip badge-neutral">
            {evaluation.rubricApplicability.level}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {evaluation.rubricApplicability.reason}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Коммуникация</h3>
        <div className="mt-2 text-2xl font-black text-slate-900">
          {evaluation.communicationScore.score}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {evaluation.communicationScore.rationale || 'Нет отдельного комментария.'}
        </p>
        {evaluation.communicationScore.evidenceQuotes.length > 0 ? (
          <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            Evidence: {evaluation.communicationScore.evidenceQuotes.join(' · ')}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Нарративы</h3>
        <div className="mt-2 text-2xl font-black text-slate-900">
          {evaluation.narrativeScore.score}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {evaluation.narrativeScore.rationale || 'Нет отдельного комментария.'}
        </p>
        {evaluation.narrativeScore.applicableNarratives.length > 0 ? (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-semibold text-blue-900">
            Применимо: {evaluation.narrativeScore.applicableNarratives.join(', ')}
          </div>
        ) : null}
        {evaluation.narrativeScore.missedNarratives.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            Не раскрыто: {evaluation.narrativeScore.missedNarratives.join(', ')}
          </div>
        ) : null}
        {evaluation.narrativeScore.evidenceQuotes.length > 0 ? (
          <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            Evidence: {evaluation.narrativeScore.evidenceQuotes.join(' · ')}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Следующий шаг</h3>
        <div className="mt-2 text-sm font-black text-slate-900">
          Качество: {evaluation.nextStepQuality}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {evaluation.suggestedNextStep || 'Нет рекомендации.'}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-bold text-slate-900">Эмоциональный фон</h3>
        <dl className="mt-3 grid gap-2 text-sm text-slate-700">
          <div>
            <dt className="subtle-label">Менеджер</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {evaluation.emotionalBackground.managerTone || '—'}
            </dd>
          </div>
          <div>
            <dt className="subtle-label">Клиент</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {evaluation.emotionalBackground.clientTone || '—'}
            </dd>
          </div>
          <div>
            <dt className="subtle-label">Friction</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {evaluation.emotionalBackground.frictionSignals.length > 0
                ? evaluation.emotionalBackground.frictionSignals.join(' · ')
                : 'нет явных сигналов'}
            </dd>
          </div>
          <div>
            <dt className="subtle-label">Confidence</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {formatPercent(evaluation.emotionalBackground.confidence)}
            </dd>
          </div>
        </dl>
      </section>

      {renderAiList('Сильные стороны', evaluation.strengths)}
      {renderAiList('Риски', evaluation.risks)}
      {renderAiList('Доказательства', evaluation.evidenceQuotes)}

      <details className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-bold text-slate-900">Raw JSON</summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
          {JSON.stringify(result.rawAiEvaluation, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export function CallAnalysisWorkspace({
  moduleId,
  managerOptions,
  sourceOptions,
  stageOptions,
  initialTarget = null,
}: {
  moduleId: string
  managerOptions: PickerOption[]
  sourceOptions: PickerOption[]
  stageOptions: PickerOption[]
  initialTarget?: CallAnalysisTarget | null
}) {
  const [draftFilters, setDraftFilters] = useState<CallAnalysisFilters>(() => createCallAnalysisFiltersForTarget(initialTarget))
  const [appliedFilters, setAppliedFilters] = useState<CallAnalysisFilters>(() => createCallAnalysisFiltersForTarget(initialTarget))
  const [queue, setQueue] = useState<CallAnalysisQueueResponse | null>(null)
  const [queueStatus, setQueueStatus] = useState<LoadStatus>('idle')
  const [queueError, setQueueError] = useState<string | null>(null)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(initialTarget?.callId ?? null)
  const [analysisResult, setAnalysisResult] = useState<CallAnalysisResult | null>(null)
  const [analysisLoadStatus, setAnalysisLoadStatus] = useState<AnalysisStatus>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [appliedRevision, setAppliedRevision] = useState(0)

  useEffect(() => {
    let ignore = false

    async function loadQueue() {
      setQueueStatus('loading')
      setQueueError(null)

      try {
        const params = {
          from: toRangeStart(appliedFilters.rangeStart),
          to: toRangeEnd(appliedFilters.rangeEnd),
          ...(appliedFilters.managerId ? { managerIds: [appliedFilters.managerId] } : {}),
          ...(appliedFilters.sourceKey ? { sourceKeys: [appliedFilters.sourceKey] } : {}),
          ...(appliedFilters.stageId ? { stageIds: [appliedFilters.stageId] } : {}),
          ...(appliedFilters.callType ? { callTypes: [appliedFilters.callType] } : {}),
          ...(appliedFilters.analysisStatus ? { analysisStatuses: [appliedFilters.analysisStatus] } : {}),
        }

        const response = await apiClient.getCallAnalysisQueue(
          params,
          moduleId,
        )

        if (ignore) {
          return
        }

        setQueue(response)
        setQueueStatus(response.items.length > 0 ? 'ready' : 'empty')
        setSelectedCallId((current) => {
          if (current && response.items.some((item) => item.callId === current)) {
            return current
          }
          return response.items[0]?.callId ?? null
        })
      } catch (error) {
        if (!ignore) {
          setQueue(null)
          setQueueStatus('error')
          setQueueError(error instanceof Error ? error.message : 'Не удалось загрузить звонки.')
        }
      }
    }

    void loadQueue()

    return () => {
      ignore = true
    }
  }, [appliedFilters, appliedRevision, moduleId])

  useEffect(() => {
    if (!selectedCallId) {
      return
    }

    let ignore = false
    const callId = selectedCallId

    async function loadAnalysis() {
      setAnalysisResult(null)
      setAnalysisLoadStatus('loading')
      setAnalysisError(null)

      try {
        const response = await apiClient.getCallAnalysis(callId, moduleId)
        if (!ignore) {
          setAnalysisResult(response.result)
          setAnalysisLoadStatus('ready')
        }
      } catch (error) {
        if (ignore) {
          return
        }

        if (getErrorStatus(error) === 404) {
          setAnalysisResult(null)
          setAnalysisLoadStatus('missing')
          return
        }

        setAnalysisResult(null)
        setAnalysisLoadStatus('error')
        setAnalysisError(error instanceof Error ? error.message : 'Не удалось загрузить анализ.')
      }
    }

    void loadAnalysis()

    return () => {
      ignore = true
    }
  }, [moduleId, selectedCallId])

  const managerFilterOptions = useMemo<SingleSelectOption[]>(
    () => [
      { value: '', label: 'Все менеджеры', meta: 'Менеджер' },
      ...managerOptions.map((option) => ({
        value: option.id,
        label: option.label,
        meta: option.meta,
      })),
    ],
    [managerOptions],
  )
  const sourceFilterOptions = useMemo<SingleSelectOption[]>(
    () => [
      { value: '', label: 'Все источники', meta: 'Источник' },
      ...sourceOptions.map((option) => ({
        value: option.id,
        label: option.label,
        meta: option.meta || 'Источник',
      })),
    ],
    [sourceOptions],
  )
  const stageFilterOptions = useMemo<SingleSelectOption[]>(
    () => [
      { value: '', label: 'Все этапы', meta: 'Этап' },
      ...stageOptions.map((option) => ({
        value: option.id,
        label: option.label,
        meta: option.meta || 'Этап',
      })),
    ],
    [stageOptions],
  )
  const callTypeFilterOptions = useMemo<SingleSelectOption[]>(
    () => callTypeOptions.map((option) => ({
      value: option.value,
      label: option.label,
      meta: 'Тип звонка',
    })),
    [],
  )
  const analysisStatusFilterOptions = useMemo<SingleSelectOption[]>(
    () => analysisStatusOptions.map((option) => ({
      value: option.value,
      label: option.label,
      meta: 'Статус анализа',
    })),
    [],
  )

  const selectedCall = queue?.items.find((item) => item.callId === selectedCallId) ?? null
  const summaryMetrics = summarizeQueue(queue)
  const visibleAnalysisResult = selectedCall && analysisResult?.callId === selectedCall.callId && analysisLoadStatus === 'ready'
    ? analysisResult
    : null
  const visibleAnalysisLoadStatus = selectedCall ? analysisLoadStatus : 'idle'
  const visibleAnalysisError = selectedCall ? analysisError : null
  const analysisActionState = resolveAnalysisActionState({
    result: visibleAnalysisResult,
    selectedCall,
    status: visibleAnalysisLoadStatus,
  })

  async function runAnalysis() {
    if (!selectedCallId || !analysisActionState.canRun) {
      return
    }

    const callId = selectedCallId

    setAnalysisLoadStatus('analyzing')
    setAnalysisError(null)

    try {
      const response = await apiClient.analyzeCall(callId, moduleId)
      setAnalysisResult(response.result)
      setAnalysisLoadStatus('ready')
      setAppliedRevision((current) => current + 1)
    } catch (error) {
      setAnalysisLoadStatus('error')
      setAnalysisError(error instanceof Error ? error.message : 'Не удалось запустить анализ.')
      setAppliedRevision((current) => current + 1)
    }
  }

  function applyFilters() {
    setAppliedFilters({ ...draftFilters })
    setAppliedRevision((current) => current + 1)
  }

  return (
    <div className="grid gap-6">
      <section className="panel p-5" data-comment-block-id="call-analysis-filters" data-comment-block-label="Анализ звонков: фильтры">
        <div className="grid gap-3 xl:grid-cols-[150px_150px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_170px_160px_auto] xl:items-end">
          <label className="grid gap-1.5">
            <span className="subtle-label">Дата с</span>
            <input
              className="field"
              type="date"
              value={draftFilters.rangeStart}
              onChange={(event) => setDraftFilters((current) => ({ ...current, rangeStart: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="subtle-label">Дата по</span>
            <input
              className="field"
              type="date"
              value={draftFilters.rangeEnd}
              onChange={(event) => setDraftFilters((current) => ({ ...current, rangeEnd: event.target.value }))}
            />
          </label>
          <SingleSelectField
            label="Менеджер"
            placeholder="Поиск менеджера"
            options={managerFilterOptions}
            value={draftFilters.managerId}
            onChange={(managerId) => setDraftFilters((current) => ({ ...current, managerId }))}
          />
          <SingleSelectField
            label="Источник"
            placeholder="Поиск источника"
            options={sourceFilterOptions}
            value={draftFilters.sourceKey}
            onChange={(sourceKey) => setDraftFilters((current) => ({ ...current, sourceKey }))}
          />
          <SingleSelectField
            label="Этап"
            placeholder="Поиск этапа"
            options={stageFilterOptions}
            value={draftFilters.stageId}
            onChange={(stageId) => setDraftFilters((current) => ({ ...current, stageId }))}
          />
          <SingleSelectField
            label="Тип звонка"
            placeholder="Поиск типа"
            options={callTypeFilterOptions}
            value={draftFilters.callType}
            onChange={(callType) => setDraftFilters((current) => ({
              ...current,
              callType: callType as '' | CallAnalysisQueueCallType,
            }))}
          />
          <SingleSelectField
            label="Статус"
            placeholder="Поиск статуса"
            options={analysisStatusFilterOptions}
            value={draftFilters.analysisStatus}
            onChange={(analysisStatus) => setDraftFilters((current) => ({
              ...current,
              analysisStatus: analysisStatus as '' | CallAnalysisQueueStatus,
            }))}
          />
          <button className="btn btn-primary h-[42px] px-5" type="button" onClick={applyFilters}>
            Применить
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((metric) => (
          <div key={metric.label} className="metric p-4">
            <p className="subtle-label">{metric.label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{metric.value}</p>
            <p className="mt-1 text-sm text-slate-500">{metric.hint}</p>
          </div>
        ))}
      </section>

      {queueStatus === 'error' ? (
        <div className="panel border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {queueError}
        </div>
      ) : null}

      <section className="panel overflow-hidden" data-comment-block-id="call-analysis-workspace" data-comment-block-label="Анализ звонков: рабочая область">
        <div className="grid min-h-[620px] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="border-r border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Очередь</h2>
                <p className="text-xs font-semibold text-slate-500">
                  {queueStatus === 'loading' ? 'загрузка' : `${queue?.items.length ?? 0} звонков`}
                </p>
              </div>
              <span className="badge-chip badge-amber">{queue?.totals.notAnalyzed ?? 0} без оценки</span>
            </div>
            {queueStatus === 'loading' ? (
              <div className="p-4 text-sm font-semibold text-slate-500">Загружаю звонки...</div>
            ) : (
              <CallQueueList items={queue?.items ?? []} selectedCallId={selectedCallId} onSelect={setSelectedCallId} />
            )}
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="subtle-label">Выбранный звонок</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    {selectedCall ? `ID ${selectedCall.callId}` : 'Не выбран'}
                  </h2>
                  {selectedCall?.dealId ? (
                    <span className="text-sm font-bold text-slate-600">Сделка #{selectedCall.dealId}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedCall?.bitrixUrl ? (
                  <a
                    className="btn btn-ghost h-[42px] px-4"
                    href={selectedCall.bitrixUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть в Bitrix
                  </a>
                ) : null}
                <button
                  className="btn btn-primary h-[42px] px-5"
                  type="button"
                  disabled={analysisActionState.disabled}
                  onClick={() => void runAnalysis()}
                >
                  {analysisActionState.label}
                </button>
              </div>
            </div>

            {selectedCall ? (
              <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 text-sm md:grid-cols-5">
                {[
                  ['Менеджер', selectedCall.managerName],
                  ['Тип', selectedCall.callTypeLabel],
                  ['Длительность', formatDuration(selectedCall.durationSeconds)],
                  ['Источник', selectedCall.dealSourceId ?? '—'],
                  ['Этап', selectedCall.stageAtCallName ?? selectedCall.dealCurrentStageName ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <div className="subtle-label">{label}</div>
                    <div className="mt-1 font-bold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <TranscriptPane result={visibleAnalysisResult} />
          </div>

          <aside className="border-l border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="subtle-label">ИИ оценка</div>
              <div className={cn('text-2xl font-black', scoreClass(visibleAnalysisResult?.aiEvaluation.score ?? null))}>
                {visibleAnalysisResult?.aiEvaluation.score ?? '—'}
              </div>
            </div>
            <AnalysisPane result={visibleAnalysisResult} status={visibleAnalysisLoadStatus} error={visibleAnalysisError} />
          </aside>
        </div>
      </section>
    </div>
  )
}
