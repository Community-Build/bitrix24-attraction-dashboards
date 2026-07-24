import { ArrowUpRight01Icon, Cancel01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type {
  DashboardQuery,
  SourceCohortConversionJourneyDealRow,
  SourceCohortConversionJourneyDealStatus,
  SourceCohortConversionJourneyDrilldown,
  SourceCohortConversionJourneyDrilldownKind,
  SourceCohortConversionJourneyDrilldownViewKey,
} from '@/lib/dashboard-types'
import { formatInteger } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type DrilldownViewKey = SourceCohortConversionJourneyDrilldownViewKey

const VIEW_ORDER: DrilldownViewKey[] = ['not_advanced', 'missed', 'reached']

const STATUS_CLASSES: Record<SourceCohortConversionJourneyDealStatus, string> = {
  advanced: 'bg-emerald-50 text-emerald-700',
  within_sla: 'bg-blue-50 text-blue-700',
  stuck: 'bg-amber-50 text-amber-800',
  lost: 'bg-rose-50 text-rose-700',
  returned: 'bg-slate-200 text-slate-700',
  data_gap: 'bg-slate-100 text-slate-600',
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatAge(deal: SourceCohortConversionJourneyDealRow) {
  if (deal.ageDays === null) return 'Срок не рассчитан'
  const ageDays = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1,
  }).format(deal.ageDays)
  if (deal.slaDays === null) return `${ageDays} дн. с контрольной даты`

  return `${ageDays} из ${formatInteger(deal.slaDays)} дн. SLA`
}

function formatDealCount(count: number) {
  const absolute = Math.abs(count)
  const lastTwoDigits = absolute % 100
  const lastDigit = absolute % 10
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 14
      ? 'сделок'
      : lastDigit === 1
        ? 'сделка'
        : lastDigit >= 2 && lastDigit <= 4
          ? 'сделки'
          : 'сделок'

  return `${formatInteger(count)} ${suffix}`
}

function getView(
  data: SourceCohortConversionJourneyDrilldown,
  key: DrilldownViewKey,
) {
  if (key === 'not_advanced') return data.views.notAdvanced
  if (key === 'missed') return data.views.missed
  return data.views.reached
}

function getDefaultView(data: SourceCohortConversionJourneyDrilldown): DrilldownViewKey {
  return VIEW_ORDER.find((key) => getView(data, key).count > 0) ?? 'reached'
}

function DealCard({
  deal,
  data,
}: {
  deal: SourceCohortConversionJourneyDealRow
  data: SourceCohortConversionJourneyDrilldown
}) {
  const timestamps = [
    { label: 'Создана', value: deal.createdAt },
    ...(data.previousStepKey && data.previousStepKey !== 'created'
      ? [{ label: data.previousStepLabel ?? data.previousStepKey, value: deal.previousStepAt }]
      : []),
    ...(data.stepKey === 'created'
      ? []
      : [{ label: data.stepLabel, value: deal.selectedStepAt }]),
    ...(data.nextStepLabel
      ? [{ label: data.nextStepLabel, value: deal.nextStepAt }]
      : []),
  ]

  return (
    <article className="rounded-xl bg-slate-50 p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.25)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold tabular-nums text-slate-950">
              Сделка #{deal.dealId}
            </p>
            <span
              className={cn(
                'inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold',
                STATUS_CLASSES[deal.status],
              )}
            >
              {deal.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {deal.managerName || `Менеджер #${deal.managerId}`} ·{' '}
            {deal.currentStageName || deal.currentStageId || 'Этап не указан'}
          </p>
        </div>
        {deal.dealUrl ? (
          <a
            href={deal.dealUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-blue-700 shadow-sm outline-none transition-[box-shadow,color,transform] duration-150 hover:text-blue-800 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.96]"
            aria-label={`Открыть сделку ${deal.dealId} в Битрикс24`}
          >
            Битрикс24
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} className="size-4" />
          </a>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">{deal.reason}</p>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        {timestamps.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="truncate font-semibold text-slate-500">{item.label}</dt>
            <dd className="mt-0.5 font-bold tabular-nums text-slate-700">
              {formatDateTime(item.value)}
            </dd>
          </div>
        ))}
      </dl>

      {deal.ageFromAt ? (
        <p className="mt-3 border-t border-slate-200 pt-2 text-xs font-semibold tabular-nums text-slate-500">
          {formatAge(deal)}
        </p>
      ) : null}
    </article>
  )
}

export function SourceCohortJourneyDrilldown({
  open,
  query,
  drilldownKind,
  stepKey,
  returnFocus,
  onRequestClose,
}: {
  open: boolean
  query: DashboardQuery
  drilldownKind: SourceCohortConversionJourneyDrilldownKind
  stepKey: string | null
  returnFocus: HTMLElement | null
  onRequestClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [data, setData] = useState<SourceCohortConversionJourneyDrilldown | null>(null)
  const [activeView, setActiveView] = useState<DrilldownViewKey>('not_advanced')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (open) {
      if (!dialog.open) {
        dialog.dataset.state = 'closed'
        dialog.showModal()
      }
      window.requestAnimationFrame(() => {
        dialog.dataset.state = 'open'
      })
      return
    }

    dialog.dataset.state = 'closed'
    if (dialog.open) {
      closeTimerRef.current = window.setTimeout(() => {
        dialog.close()
        returnFocus?.focus()
        closeTimerRef.current = null
      }, 160)
    }

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open, returnFocus])

  useEffect(() => {
    if (!open || !stepKey) return

    let current = true
    const requestTimer = window.setTimeout(() => {
      if (!current) return
      setLoading(true)
      setError(null)
      setData(null)

      void apiClient
        .getSourceCohortConversionJourneyDrilldown(
          query,
          stepKey,
          drilldownKind,
        )
        .then((response) => {
          if (!current) return
          setData(response)
          setActiveView(getDefaultView(response))
        })
        .catch((requestError: unknown) => {
          if (!current) return
          setError(
            requestError instanceof Error
              ? requestError.message
              : drilldownKind === 'crm_stage'
                ? 'Не удалось загрузить сделки для этого CRM-этапа.'
                : 'Не удалось загрузить сделки для этого перехода.',
          )
        })
        .finally(() => {
          if (current) setLoading(false)
        })
    }, 0)

    return () => {
      current = false
      window.clearTimeout(requestTimer)
    }
  }, [drilldownKind, open, query, reloadKey, stepKey])

  const views = useMemo(
    () =>
      data
        ? VIEW_ORDER.map((key) => ({
            key,
            view: getView(data, key),
          }))
        : [],
    [data],
  )
  const selectedView = data ? getView(data, activeView) : null

  return (
    <dialog
      ref={dialogRef}
      className="journey-drilldown-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-transparent p-0 text-slate-950"
      aria-labelledby="journey-drilldown-title"
      onCancel={(event) => {
        event.preventDefault()
        onRequestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose()
      }}
    >
      <section
        className="journey-drilldown-drawer ml-auto flex h-[100dvh] w-full max-w-[720px] flex-col bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.18)] sm:rounded-l-3xl"
        aria-busy={loading}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="subtle-label">
              {data?.drilldownKind === 'crm_stage' || drilldownKind === 'crm_stage'
                ? 'Сделки CRM-этапа'
                : 'Сделки этапа'}
            </p>
            <h3 id="journey-drilldown-title" className="mt-1 text-xl font-extrabold text-slate-950">
              {data?.stepLabel ?? 'Загрузка перехода'}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Точный состав когорты и ссылки в Битрикс24
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 outline-none transition-[background-color,color,transform] duration-150 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.96]"
            aria-label="Закрыть список сделок"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {loading ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center" role="status">
              <HugeiconsIcon
                icon={Loading03Icon}
                strokeWidth={2}
                className="size-6 animate-spin text-blue-600"
              />
              <p className="mt-3 text-sm font-bold text-slate-700">
                {drilldownKind === 'crm_stage'
                  ? 'Собираю сделки CRM-этапа…'
                  : 'Собираю сделки перехода…'}
              </p>
              <p className="mt-1 text-xs text-slate-500">Основной отчет при этом не пересчитывается.</p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-rose-900" role="alert">
              <p className="font-bold">Не удалось загрузить сделки</p>
              <p className="mt-1 text-sm leading-6">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-3 min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-rose-700 shadow-sm outline-none transition-[box-shadow,transform] duration-150 hover:shadow-md focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 active:scale-[0.96]"
              >
                Повторить
              </button>
            </div>
          ) : null}

          {!loading && data ? (
            <>
              <div className="rounded-2xl bg-slate-50 p-2" role="tablist" aria-label="Состав сделок этапа">
                <div className="grid gap-1 sm:grid-cols-3">
                  {views.map(({ key, view }) => (
                    <button
                      key={key}
                      id={`journey-drilldown-tab-${key}`}
                      type="button"
                      role="tab"
                      aria-selected={activeView === key}
                      aria-controls="journey-drilldown-panel"
                      onClick={() => setActiveView(key)}
                      className={cn(
                        'min-h-11 rounded-xl px-3 py-2 text-left outline-none transition-[background-color,box-shadow,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.96]',
                        activeView === key
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                      )}
                    >
                      <span className="block text-xs font-bold leading-4">{view.label}</span>
                      <span className="mt-0.5 block text-lg font-extrabold tabular-nums">
                        {formatInteger(view.count)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                id="journey-drilldown-panel"
                role="tabpanel"
                aria-labelledby={`journey-drilldown-tab-${activeView}`}
                className="mt-5"
              >
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-slate-950">{selectedView?.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Статус и причина рассчитаны сервером на {formatDateTime(data.asOf)}.
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-slate-600">
                    {formatDealCount(selectedView?.count ?? 0)}
                  </p>
                </div>

                {selectedView && selectedView.deals.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {selectedView.deals.map((deal) => (
                      <DealCard key={deal.dealId} deal={deal} data={data} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-8 text-center">
                    <p className="font-bold text-slate-700">В этой выборке сделок нет</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Переключитесь на другой тип перехода.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </dialog>
  )
}
