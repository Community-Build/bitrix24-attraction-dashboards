import { Cancel01Icon, Loading03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { apiClient } from '@/lib/api-client'
import type {
  MessengerMessageDetailItem,
  MessengerMessageDetails,
} from '@/lib/dashboard-types'
import { formatInteger } from '@/lib/formatters'

const DIRECTION_LABELS = {
  outgoing: 'Исходящее',
  incoming: 'Входящее',
  unknown: 'Направление не определено',
}

function messageDirectionLabel(message: MessengerMessageDetailItem) {
  const direction = DIRECTION_LABELS[message.direction]
  return message.authorLabel ? `${direction} · ${message.authorLabel}` : direction
}

function formatDateTime(value: string) {
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

function formatMessageCount(count: number) {
  const absolute = Math.abs(count)
  const lastTwoDigits = absolute % 100
  const lastDigit = absolute % 10
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 14
      ? 'сообщений'
      : lastDigit === 1
        ? 'сообщение'
        : lastDigit >= 2 && lastDigit <= 4
          ? 'сообщения'
          : 'сообщений'

  return `${formatInteger(count)} ${suffix}`
}

function groupMessagesBySession(messages: MessengerMessageDetailItem[]) {
  const groups = new Map<string, MessengerMessageDetailItem[]>()
  for (const message of messages) {
    const group = groups.get(message.sessionId) ?? []
    group.push(message)
    groups.set(message.sessionId, group)
  }

  return [...groups.entries()].map(([sessionId, items]) => ({
    sessionId,
    dealId: items[0]?.dealId ?? '',
    dealUrl: items[0]?.dealUrl ?? null,
    channelLabel: items[0]?.channel.label ?? 'Неизвестный канал',
    messages: items,
  }))
}

export function MessengerMessageReader({
  open,
  managerId,
  managerName,
  from,
  to,
  returnFocus,
  onRequestClose,
}: {
  open: boolean
  managerId: string | null
  managerName: string | null
  from: string
  to: string
  returnFocus: HTMLElement | null
  onRequestClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [data, setData] = useState<MessengerMessageDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(
    null,
  )
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
        setData(null)
        setError(null)
        setAttachmentError(null)
        setDownloadingAttachment(null)
        setLoading(false)
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
    if (!open || !managerId) return

    let current = true
    const requestTimer = window.setTimeout(() => {
      if (!current) return
      setLoading(true)
      setError(null)
      setAttachmentError(null)
      setData(null)

      void apiClient
        .getManagerMessageDetails({ managerId, from, to, limit: 500 })
        .then((response) => {
          if (current) setData(response)
        })
        .catch((requestError: unknown) => {
          if (!current) return
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Не удалось загрузить сообщения этого менеджера.',
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
  }, [from, managerId, open, reloadKey, to])

  const sessionGroups = useMemo(
    () => groupMessagesBySession(data?.messages ?? []),
    [data],
  )

  async function downloadAttachment(
    message: MessengerMessageDetailItem,
    fileId: string,
  ) {
    if (!managerId) return
    const attachmentKey = `${message.sessionId}:${message.id}:${fileId}`
    setDownloadingAttachment(attachmentKey)
    setAttachmentError(null)

    try {
      const attachment = await apiClient.downloadMessengerAttachment({
        managerId,
        from,
        to,
        sessionId: message.sessionId,
        messageId: message.id,
        fileId,
      })
      const objectUrl = URL.createObjectURL(attachment.blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = attachment.fileName
        anchor.hidden = true
        document.body.append(anchor)
        try {
          anchor.click()
        } finally {
          anchor.remove()
        }
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      }
    } catch (downloadError) {
      setAttachmentError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Не удалось скачать вложение.',
      )
    } finally {
      setDownloadingAttachment(null)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="journey-drilldown-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-transparent p-0 text-slate-950"
      aria-labelledby="messenger-message-reader-title"
      aria-describedby="messenger-message-reader-description"
      onCancel={(event) => {
        event.preventDefault()
        onRequestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose()
      }}
    >
      <section
        className="journey-drilldown-drawer ml-auto flex h-[100dvh] w-full max-w-[760px] flex-col bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.18)] sm:rounded-l-3xl"
        aria-busy={loading}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="subtle-label">Сообщения в мессенджерах</p>
            <h3
              id="messenger-message-reader-title"
              className="mt-1 text-xl font-extrabold text-slate-950"
            >
              {data?.managerName ?? managerName ?? 'Менеджер'}
            </h3>
            <p
              id="messenger-message-reader-description"
              className="mt-1 text-sm leading-5 text-slate-500"
            >
              Показаны сохранённые сообщения только за выбранный период отчёта.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 outline-none transition-[background-color,color,transform] duration-150 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.96]"
            aria-label="Закрыть просмотр сообщений"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            Для WAZZUP исходящие определяются по служебной пометке, а сообщения без
            неё — как входящие. Для других коннекторов направление может оставаться
            неопределённым.
          </div>

          {attachmentError ? (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
              {attachmentError}
            </div>
          ) : null}

          {loading ? (
            <div
              className="flex min-h-48 flex-col items-center justify-center text-center"
              role="status"
            >
              <HugeiconsIcon
                icon={Loading03Icon}
                strokeWidth={2}
                className="size-6 animate-spin text-blue-600"
              />
              <p className="mt-3 text-sm font-bold text-slate-700">
                Загружаю сообщения…
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Основной отчёт при этом не пересчитывается.
              </p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-rose-900" role="alert">
              <p className="font-bold">Не удалось загрузить сообщения</p>
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-600">
                  Показано {formatInteger(data.returnedMessages)} из{' '}
                  {formatInteger(data.totalMessages)} сообщений
                </span>
                <span className="font-semibold text-slate-500">
                  {formatInteger(sessionGroups.length)} диалогов
                </span>
              </div>

              {data.truncated ? (
                <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                  Показаны последние {formatMessageCount(data.returnedMessages)}.
                  Для меньшей выборки сузьте диапазон дат.
                </p>
              ) : null}

              {sessionGroups.length > 0 ? (
                <div className="space-y-4">
                  {sessionGroups.map((group) => (
                    <section
                      key={group.sessionId}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                    >
                      <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">
                            Диалог #{group.sessionId}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {group.channelLabel}
                            {' · '}
                            {group.dealUrl ? (
                              <a
                                href={group.dealUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                aria-label={`Открыть сделку ${group.dealId}`}
                                className="font-bold text-blue-700 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-500 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                Сделка #{group.dealId}
                              </a>
                            ) : (
                              <>Сделка #{group.dealId}</>
                            )}
                          </p>
                        </div>
                        <span className="badge-chip badge-neutral">
                          {formatInteger(group.messages.length)} сообщ.
                        </span>
                      </header>
                      <div className="divide-y divide-slate-100">
                        {group.messages.map((message) => (
                          <article
                            key={`${group.sessionId}-${message.id}`}
                            className="px-4 py-4"
                            data-testid={`messenger-message-${message.id}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-slate-600">
                                {messageDirectionLabel(message)}
                              </span>
                              <time
                                dateTime={message.occurredAt}
                                className="font-semibold tabular-nums text-slate-400"
                              >
                                {formatDateTime(message.occurredAt)}
                              </time>
                            </div>
                            {message.text ? (
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                                {message.text}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm italic text-slate-500">
                                {message.hasAttachment
                                  ? 'Вложение без текста'
                                  : 'Сообщение без текста'}
                              </p>
                            )}
                            {message.attachments.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {message.attachments.map((attachment, index) => {
                                  const attachmentKey = `${message.sessionId}:${message.id}:${attachment.id}`
                                  const downloading =
                                    downloadingAttachment === attachmentKey
                                  return (
                                    <button
                                      key={attachment.id}
                                      type="button"
                                      disabled={downloadingAttachment !== null}
                                      onClick={() =>
                                        void downloadAttachment(message, attachment.id)
                                      }
                                      aria-label={`Скачать вложение ${index + 1}`}
                                      className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-blue-700 outline-none transition-[border-color,background-color,box-shadow,transform] duration-150 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-wait disabled:text-slate-400"
                                    >
                                      {downloading
                                        ? 'Скачиваю…'
                                        : `Скачать вложение ${index + 1}`}
                                    </button>
                                  )
                                })}
                              </div>
                            ) : message.hasAttachment ? (
                              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                                Вложение недоступно для скачивания
                              </span>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center">
                  <p className="font-bold text-slate-700">Сообщений за период нет</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Измените диапазон дат или выберите другого менеджера.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </section>
    </dialog>
  )
}
