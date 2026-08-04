import { useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type {
  MessengerManagerSummaryRow,
  MessengerReportSummary,
} from '@/lib/dashboard-types'
import { formatInteger } from '@/lib/formatters'
import { buildDashboardQueryFromProtoFilters } from '@/proto/live-reporting'
import { MessengerMessageReader } from '@/proto/messenger-message-reader'
import type { ProtoFilterState } from '@/proto/types'

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1_000

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
  const requestVersionRef = useRef(0)
  const [summary, setSummary] = useState<MessengerReportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readerManager, setReaderManager] = useState<{
    managerId: string
    managerName: string
  } | null>(null)
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null)

  useEffect(() => {
    requestVersionRef.current += 1
    setSummary(null)
    setLoading(false)
    setError(null)
    setReaderManager(null)
  }, [requestKey])

  const rangeTooLong =
    !from || !to || Date.parse(to) - Date.parse(from) > MAX_RANGE_MS
  const sortedRows = useMemo(
    () =>
      [...(summary?.managerRows ?? [])].sort(
        (left, right) =>
          right.messages - left.messages ||
          left.managerName.localeCompare(right.managerName, 'ru'),
      ),
    [summary],
  )

  if (!canRead) return null

  async function loadSummary() {
    if (rangeTooLong) return

    const requestVersion = ++requestVersionRef.current
    setLoading(true)
    setError(null)

    try {
      const response = await apiClient.getMessengerReportSummary({
        managerIds,
        from,
        to,
      })
      if (requestVersion === requestVersionRef.current) setSummary(response)
    } catch (requestError) {
      if (requestVersion !== requestVersionRef.current) return
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось посчитать сообщения за выбранный период.',
      )
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false)
    }
  }

  return (
    <>
      <section
        className="panel min-w-0 p-5"
        data-comment-block-id="activities-messenger-messages"
        data-comment-block-label="Активности: сообщения в мессенджерах"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Сообщения в мессенджерах
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Считает все несистемные сообщения в открытых линиях по выбранным датам и
              менеджерам. Уникальность считается по диалогам, а не по людям.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading || rangeTooLong}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-slate-800 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {loading
              ? 'Считаю сообщения…'
              : summary
                ? 'Пересчитать сообщения'
                : 'Посчитать сообщения за период'}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          Направление сообщения для WAZZUP, OLChat и Umnico определяется ненадёжно.
          Поэтому показатель не называется «отправлено менеджером» и включает обе
          стороны диалога.
        </div>

        {rangeTooLong ? (
          <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
            Для расчёта и чтения сообщений выберите диапазон не длиннее 31 дня.
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
            {error}
          </div>
        ) : null}

        {summary ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCard(
                'Всего сообщений',
                summary.totalMessages,
                'messenger-total-messages',
                'Все несистемные сообщения',
              )}
              {metricCard(
                'Уникальных диалогов',
                summary.uniqueDialogs,
                'messenger-unique-dialogs',
                'Сессии открытых линий',
              )}
              {metricCard(
                'Сделок с сообщениями',
                summary.dealsWithMessages,
                'messenger-deals-with-messages',
                'Уникальные ID сделок',
              )}
              {metricCard(
                'Сообщений с текстом',
                summary.messagesWithText,
                'messenger-text-messages',
                `${formatInteger(summary.attachmentOnlyMessages)} только с вложением`,
              )}
            </div>

            <div className="mt-5 w-full max-w-full overflow-x-auto">
              <table className="min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-3 py-3">Менеджер</th>
                    <th className="px-3 py-3 text-right">Сообщения</th>
                    <th className="px-3 py-3 text-right">Диалоги</th>
                    <th className="px-3 py-3 text-right">Сделки</th>
                    <th className="px-3 py-3">Каналы</th>
                    <th className="px-3 py-3 text-right">Текст</th>
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
                        {formatInteger(row.messages)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {formatInteger(row.uniqueDialogs)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                        {formatInteger(row.dealsWithMessages)}
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
        ) : (
          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center">
            <p className="font-bold text-slate-700">
              Итог по сообщениям ещё не рассчитан
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Расчёт запускается вручную и не замедляет загрузку отчёта активности.
            </p>
          </div>
        )}
      </section>

      <MessengerMessageReader
        open={readerManager !== null}
        managerId={readerManager?.managerId ?? null}
        managerName={readerManager?.managerName ?? null}
        from={from}
        to={to}
        returnFocus={returnFocus}
        onRequestClose={() => setReaderManager(null)}
      />
    </>
  )
}
