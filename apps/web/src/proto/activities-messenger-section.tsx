import { useEffect, useMemo, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type {
  MessengerManagerSummaryRow,
  MessengerReportSummary,
} from '@/lib/dashboard-types'
import { formatInteger } from '@/lib/formatters'
import { buildDashboardQueryFromProtoFilters } from '@/proto/live-reporting'
import { MessengerMessageReader } from '@/proto/messenger-message-reader'
import type { ProtoFilterState } from '@/proto/types'

function metricCard(label: string, value: number, testId: string, hint: string) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-extrabold tabular-nums text-slate-950"
        data-testid={testId}
      >
        {formatInteger(value)}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  )
}

function channelLabels(row: MessengerManagerSummaryRow) {
  if (row.channels.length === 0) return '—'
  return row.channels
    .map((channel) => `${channel.label} · ${formatInteger(channel.messages)}`)
    .join(', ')
}

function formatPeriod(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  return `${formatter.format(new Date(from))} — ${formatter.format(new Date(to))}`
}

export function ActivitiesMessengerSection({
  filters,
  canRead,
}: {
  filters: ProtoFilterState
  canRead: boolean
}) {
  const query = useMemo(
    () => buildDashboardQueryFromProtoFilters(filters),
    [filters],
  )
  const from = query.preset === 'custom' ? query.from : ''
  const to = query.preset === 'custom' ? query.to : ''
  const managerIds = query.managerIds ?? []
  const requestKey = JSON.stringify({ from, to, managerIds })
  const [loadResult, setLoadResult] = useState<{
    requestKey: string
    summary: MessengerReportSummary | null
    error: string | null
  }>({ requestKey: '', summary: null, error: null })
  const [readerManager, setReaderManager] = useState<{
    managerId: string
    managerName: string
    requestKey: string
  } | null>(null)
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!canRead) return

    const request = JSON.parse(requestKey) as {
      from: string
      to: string
      managerIds: string[]
    }
    if (!request.from || !request.to) return

    let cancelled = false
    void apiClient
      .getMessengerReportSummary(request)
      .then((response) => {
        if (!cancelled) {
          setLoadResult({ requestKey, summary: response, error: null })
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setLoadResult({
            requestKey,
            summary: null,
            error:
              requestError instanceof Error
                ? requestError.message
                : 'Не удалось загрузить сообщения за выбранный период.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [canRead, requestKey])

  const hasValidRange = Boolean(from && to)
  const isCurrentResult = loadResult.requestKey === requestKey
  const summary = isCurrentResult ? loadResult.summary : null
  const error = !hasValidRange
    ? 'Не удалось определить выбранный период отчёта.'
    : isCurrentResult
      ? loadResult.error
      : null
  const loading = canRead && hasValidRange && !isCurrentResult
  const activeReaderManager =
    readerManager?.requestKey === requestKey ? readerManager : null

  const sortedRows = useMemo(
    () =>
      [...(summary?.managerRows ?? [])].sort(
        (left, right) =>
          right.outgoingMessages +
            right.outgoingUnknownAuthorMessages -
            (left.outgoingMessages + left.outgoingUnknownAuthorMessages) ||
          left.managerName.localeCompare(right.managerName, 'ru'),
      ),
    [summary],
  )

  if (!canRead) return null

  return (
    <>
      <section
        className="panel min-w-0 p-5"
        aria-busy={loading}
        data-comment-block-id="activities-messenger-messages"
        data-comment-block-label="Активности: сообщения в мессенджерах"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Сообщения в мессенджерах
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Автоматически показывает сообщения за период общего фильтра. Исходящие
              засчитываются менеджеру только когда автор подтверждён данными сообщения.
            </p>
          </div>
          {from && to ? (
            <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              Сообщения за {formatPeriod(from, to)}
            </p>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Для WAZZUP служебная пометка «Исходящее сообщение» определяет направление и
          автора. Сообщение без такой пометки считается входящим. Исходящие с подписью
          «Телефон» видны отдельно и не приписываются текущему ответственному сделки.
        </div>

        {error ? (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
            {error}
          </div>
        ) : null}

        {summary ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCard(
                'Всего отправлено',
                summary.outgoingMessages + summary.outgoingUnknownAuthorMessages,
                'messenger-outgoing-messages',
                `${formatInteger(summary.outgoingMessages)} с подтверждённым автором · ${formatInteger(summary.outgoingUnknownAuthorMessages)} без автора`,
              )}
              {metricCard(
                'Уникальных диалогов',
                summary.uniqueOutgoingDialogs,
                'messenger-unique-outgoing-dialogs',
                'Диалоги хотя бы с одним исходящим',
              )}
              {metricCard(
                'Сделок с исходящими',
                summary.dealsWithOutgoingMessages,
                'messenger-deals-with-outgoing-messages',
                'Уникальные ID сделок',
              )}
              {metricCard(
                'Входящих сообщений',
                summary.incomingMessages,
                'messenger-incoming-messages',
                `${formatInteger(summary.unknownDirectionMessages)} с неопределённым направлением`,
              )}
            </div>

            <div className="mt-5 w-full max-w-full overflow-x-auto">
              <table className="min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-3 py-3">Менеджер</th>
                    <th className="px-3 py-3 text-right">Автор подтверждён</th>
                    <th className="px-3 py-3 text-right">Автор не определён</th>
                    <th className="px-3 py-3 text-right">Диалоги</th>
                    <th className="px-3 py-3 text-right">Сделки</th>
                    <th className="px-3 py-3 text-right">Входящие</th>
                    <th className="px-3 py-3 text-right">Не определено</th>
                    <th className="px-3 py-3">Каналы</th>
                    <th className="px-3 py-3 text-right">Просмотр</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.managerId}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {row.managerName}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">
                        {formatInteger(row.outgoingMessages)}
                      </td>
                      <td
                        className="px-3 py-3 text-right tabular-nums text-amber-800"
                        data-testid={`messenger-unknown-author-${row.managerId}`}
                      >
                        {formatInteger(row.outgoingUnknownAuthorMessages)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {formatInteger(row.uniqueOutgoingDialogs)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {formatInteger(row.dealsWithOutgoingMessages)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {formatInteger(row.incomingMessages)}
                      </td>
                      <td
                        className="px-3 py-3 text-right tabular-nums text-slate-700"
                        data-testid={`messenger-unknown-${row.managerId}`}
                      >
                        {formatInteger(row.unknownDirectionMessages)}
                      </td>
                      <td className="max-w-[320px] px-3 py-3 text-xs leading-5 text-slate-600">
                        {channelLabels(row)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          disabled={row.messages === 0}
                          aria-label={`Читать сообщения ${row.managerName}`}
                          onClick={(event) => {
                            setReturnFocus(event.currentTarget)
                            setReaderManager({
                              managerId: row.managerId,
                              managerName: row.managerName,
                              requestKey,
                            })
                          }}
                          className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-blue-700 outline-none transition-[border-color,box-shadow,transform] duration-150 hover:border-blue-300 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Читать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : loading ? (
          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center">
            <p className="font-bold text-slate-700">
              Загружаем сообщения за выбранный период…
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Данные читаются из локальной базы отчётов.
            </p>
          </div>
        ) : error ? null : (
          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center">
            <p className="font-bold text-slate-700">Сообщений за период нет</p>
          </div>
        )}
      </section>

      <MessengerMessageReader
        open={activeReaderManager !== null}
        managerId={activeReaderManager?.managerId ?? null}
        managerName={activeReaderManager?.managerName ?? null}
        from={from}
        to={to}
        returnFocus={returnFocus}
        onRequestClose={() => setReaderManager(null)}
      />
    </>
  )
}
