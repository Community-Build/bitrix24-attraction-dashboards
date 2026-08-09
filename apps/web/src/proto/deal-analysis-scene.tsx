import { useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type {
  DashboardQuery,
  DealAnalysisDetail,
  DealAnalysisRow,
  DealAnalysisScope,
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

function dateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
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
    <span className={`inline-flex min-w-11 items-center justify-center rounded-full px-2.5 py-1 text-sm font-bold ${meta.bg} ${meta.text}`}>
      {row.healthScore}
    </span>
  )
}

function ActivityDots({ row }: { row: DealAnalysisRow }) {
  const markers = [...row.activityMarkers].reverse().slice(-18)
  return (
    <div className="flex min-w-44 items-center gap-1" aria-label={`${row.activityMarkerCount} активностей`}>
      <span className="h-px flex-1 bg-slate-200" />
      {markers.length === 0 ? <span className="text-xs text-slate-400">нет событий</span> : markers.map((marker) => (
        <span
          key={marker.id}
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${markerColors[marker.kind] ?? 'bg-slate-400'}`}
          title={`${marker.kind}: ${dateTime(marker.occurredAt)}`}
        />
      ))}
    </div>
  )
}

function DealDrawer({
  row,
  query,
  scope,
  onClose,
}: {
  row: DealAnalysisRow
  query: DashboardQuery
  scope: DealAnalysisScope
  onClose(): void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [detail, setDetail] = useState<DealAnalysisDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'risks' | 'activity' | 'path' | 'details'>(row.risks.length ? 'risks' : 'activity')

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    apiClient.getDealAnalysisDetail(row.dealId, query, scope)
      .then((next) => { if (!cancelled) setDetail(next) })
      .catch((nextError: unknown) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить сделку')
      })
    return () => { cancelled = true }
  }, [query, row.dealId, scope])

  const tabs = [
    ['risks', 'Риски'], ['activity', 'Активность'], ['path', 'Путь сделки'], ['details', 'Детали'],
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Сделка ${row.dealId}`}>
        <header className="border-b border-slate-200 bg-white px-7 py-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Сделка #{row.dealId}</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">{row.stageName}</h2>
              <p className="mt-1 text-sm text-slate-500">{row.sourceLabel} · {formatAmount(row.amount)} · {row.managerName}</p>
            </div>
            <div className="flex items-center gap-2">
              {row.dealUrl ? <a className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200" href={row.dealUrl} target="_blank" rel="noreferrer">Открыть в CRM ↗</a> : null}
              <button ref={closeRef} type="button" onClick={onClose} className="h-10 w-10 rounded-xl text-xl text-slate-500 hover:bg-slate-100" aria-label="Закрыть">×</button>
            </div>
          </div>
          <nav className="mt-6 grid grid-cols-4 rounded-xl bg-slate-100 p-1" aria-label="Разделы сделки">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-2 py-2.5 text-sm font-bold ${tab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{label}</button>
            ))}
          </nav>
        </header>
        <div className="flex-1 overflow-y-auto p-7">
          {!detail && !error ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">Загружаю историю сделки…</div> : null}
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div> : null}
          {detail && tab === 'risks' ? (
            <div className="space-y-4">
              {detail.row.risks.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">Операционных рисков по текущим правилам нет.</div> : detail.row.risks.map((risk) => (
                <article key={risk.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4"><h3 className="font-bold text-slate-950">{risk.label}</h3><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">−{risk.deduction}</span></div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{risk.evidence}</p>
                  <p className="mt-4 inline-flex rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">Проверить: {risk.recommendation}</p>
                </article>
              ))}
            </div>
          ) : null}
          {detail && tab === 'activity' ? (
            <div className="space-y-3">
              {detail.callInsights?.map((insight) => (
                <article key={`insight:${insight.callId}`} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-blue-950">Анализ звонка</h3>{insight.score !== null ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-blue-700">{insight.score}/100</span> : null}</div>
                  {insight.summary ? <p className="mt-2 text-sm leading-6 text-blue-900">{insight.summary}</p> : null}
                  {insight.risks.length ? <p className="mt-2 text-sm text-blue-800">Риски: {insight.risks.join(' · ')}</p> : null}
                  {insight.suggestedNextStep ? <p className="mt-3 text-sm font-semibold text-blue-950">Проверить: {insight.suggestedNextStep}</p> : null}
                </article>
              ))}
              {detail.timeline.length === 0 ? <p className="text-slate-500">За выбранный период активностей нет.</p> : detail.timeline.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4"><h3 className="font-bold text-slate-900">{item.title}</h3><time className="shrink-0 text-xs text-slate-400">{dateTime(item.occurredAt)}</time></div>
                  <p className="mt-1 text-sm text-slate-500">{[item.direction, item.durationSeconds ? `${item.durationSeconds} сек.` : null, item.detail].filter(Boolean).join(' · ') || 'Событие зафиксировано'}</p>
                </article>
              ))}
              {!detail.sensitiveContentAvailable ? <p className="text-xs text-slate-400">Тексты сообщений и выводы анализа звонков доступны только руководителю.</p> : null}
            </div>
          ) : null}
          {detail && tab === 'path' ? (
            <ol className="space-y-3">
              {detail.stageHistory.map((entry, index) => (
                <li key={entry.id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-600">{detail.stageHistory.length - index}</span><div><p className="font-bold text-slate-900">{entry.stageName}</p><time className="text-sm text-slate-500">{dateTime(entry.enteredAt)}</time></div></li>
              ))}
            </ol>
          ) : null}
          {detail && tab === 'details' ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['ID сделки', detail.row.dealId], ['Менеджер', detail.row.managerName], ['Источник', detail.row.sourceLabel],
                ['Сумма', formatAmount(detail.row.amount)], ['Создана', dateTime(detail.row.dateCreate)],
                ['На этапе', `${detail.row.daysOnStage} дн.`], ['Последняя активность', dateTime(detail.row.lastActivityAt)],
                ['Последний звонок', dateTime(detail.row.lastCallAt)],
              ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

export function DealAnalysisScene({ filters }: SceneComponentProps) {
  const queryKey = useMemo(() => JSON.stringify(buildDashboardQueryFromProtoFilters(filters)), [filters])
  const query = useMemo(() => JSON.parse(queryKey) as DashboardQuery, [queryKey])
  const [scope, setScope] = useState<DealAnalysisScope>('open')
  const requestKey = `${queryKey}:${scope}`
  const [reportState, setReportState] = useState<{ requestKey: string; rows: DealAnalysisRow[]; scopeStatus: string } | null>(null)
  const [errorState, setErrorState] = useState<{ requestKey: string; message: string } | null>(null)
  const [health, setHealth] = useState<DealHealthBand | 'all'>('all')
  const [scoreSortDirection, setScoreSortDirection] = useState<'asc' | 'desc'>('asc')
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
  const sortedRows = useMemo(() => [...filteredRows].sort((left, right) => {
    if (left.healthScore === right.healthScore) return 0
    if (left.healthScore === null) return 1
    if (right.healthScore === null) return -1
    return scoreSortDirection === 'asc'
      ? left.healthScore - right.healthScore
      : right.healthScore - left.healthScore
  }), [filteredRows, scoreSortDirection])
  const cards = (['critical', 'risk', 'watch', 'healthy'] as DealHealthBand[]).map((band) => {
    const matches = (rows ?? []).filter((row) => row.healthBand === band)
    return { band, count: matches.length, amount: matches.reduce((sum, row) => sum + row.amount, 0) }
  })

  return (
    <section className="grid min-w-0 gap-6" data-proto-block-id="attraction-deal-analysis-summary">
      <div className="panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="subtle-label">Ежедневное управление</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Анализ сделок</h1><p className="mt-1 text-sm text-slate-600">Какие сделки требуют вмешательства, почему и что проверить дальше.</p><p className="mt-2 text-xs font-medium text-slate-500">Менеджеры, команды, заказчики и источники берутся из применённого среза выше; период ограничивает отображаемую активность.</p></div>
          <div className="flex flex-wrap gap-2">
            {([['open', 'В работе'], ['won', 'Выиграны'], ['lost', 'Проиграны']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => { setScope(id); setHealth('all'); setVisible(50) }} className={cn('tab-chip', scope === id && 'tab-chip-active')}>{label}</button>)}
          </div>
        </div>
        {scopeStatus && scopeStatus !== 'ready' ? <div className="sync-notice sync-notice-warning mt-4">Последняя успешная синхронизация устарела. Показан последний полностью согласованный снимок сделок.</div> : null}
      </div>

      {scope === 'open' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ band, count, amount }) => { const meta = healthMeta[band]!; return <button key={band} type="button" onClick={() => setHealth(health === band ? 'all' : band)} className={cn('metric p-4 text-left transition', health === band && 'border-slate-500 ring-1 ring-slate-400')}><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} /><span className="text-sm font-semibold text-slate-500">{meta.label}</span></div><div className="mt-3 flex items-end justify-between gap-3"><strong className="text-2xl text-slate-900">{formatInteger(count)}</strong><span className="text-sm font-semibold text-slate-500">{formatAmount(amount)}</span></div></button> })}
      </div> : null}

      <div className="panel overflow-hidden" data-proto-block-id="attraction-deal-analysis-table">
        {error ? <div className="p-6 text-rose-700">{error}</div> : null}
        {!rows && !error ? <div className="p-6 text-slate-500">Загружаю текущие сделки…</div> : null}
        {rows ? <div className="overflow-x-auto"><table className="w-full min-w-[1180px] border-collapse text-left"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-4">Сделка</th>{scope === 'open' ? <><th className="px-4 py-4" aria-sort={scoreSortDirection === 'asc' ? 'ascending' : 'descending'}><button type="button" onClick={() => { setScoreSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc'); setVisible(50) }} className="inline-flex items-center gap-1.5 rounded-md text-left transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" aria-label={`Оценка: ${scoreSortDirection === 'asc' ? 'по возрастанию' : 'по убыванию'}. Изменить направление сортировки`}><span>Оценка</span><span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-600">{scoreSortDirection === 'asc' ? '↑' : '↓'}</span></button></th><th className="px-4 py-4">Риски</th></> : null}<th className="px-4 py-4">Менеджер</th><th className="px-4 py-4">Этап</th><th className="px-4 py-4">Активность</th><th className="px-4 py-4">След. действие</th><th className="px-5 py-4 text-right">Сумма</th></tr></thead><tbody className="divide-y divide-slate-100">{sortedRows.slice(0, visible).map((row) => <tr key={row.dealId} className="cursor-pointer hover:bg-blue-50/40" onClick={() => setSelected(row)}><td className="px-5 py-4"><button type="button" className="text-left"><strong className="block text-slate-950">#{row.dealId}</strong><span className="text-sm text-slate-500">{row.sourceLabel}</span></button></td>{scope === 'open' ? <><td className="px-4 py-4"><HealthBadge row={row} /></td><td className="px-4 py-4"><span className={row.risks.length ? 'font-bold text-orange-600' : 'text-slate-400'}>{row.risks.length || '—'}</span></td></> : null}<td className="px-4 py-4 text-sm font-semibold text-slate-700">{row.managerName}</td><td className="px-4 py-4"><strong className="block text-sm text-slate-900">{row.stageName}</strong><span className={`text-xs ${row.stageOverdueDays ? 'text-orange-600' : 'text-slate-400'}`}>{row.daysOnStage} дн. на этапе</span></td><td className="px-4 py-4"><ActivityDots row={row} /></td><td className="px-4 py-4"><span className={`text-sm font-semibold ${row.nextAction.status === 'missing' || row.nextAction.status === 'overdue' ? 'text-orange-600' : 'text-slate-700'}`}>{nextActionLabel(row)}</span></td><td className="px-5 py-4 text-right font-bold text-slate-900">{formatAmount(row.amount)}</td></tr>)}</tbody></table>{sortedRows.length === 0 ? <div className="border-t border-slate-100 p-8 text-center text-slate-500">По выбранному состоянию сделок нет.</div> : null}</div> : null}
        {filteredRows.length > visible ? <div className="border-t border-slate-100 p-4 text-center"><button type="button" onClick={() => setVisible((count) => count + 50)} className="btn btn-ghost">Показать ещё</button></div> : null}
      </div>
      {selected ? <DealDrawer row={selected} query={query} scope={scope} onClose={() => setSelected(null)} /> : null}
    </section>
  )
}
