import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MessengerMessageReader } from '@/proto/messenger-message-reader'

const apiMock = vi.hoisted(() => ({
  getDetails: vi.fn(),
  downloadAttachment: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getManagerMessageDetails: apiMock.getDetails,
    downloadMessengerAttachment: apiMock.downloadAttachment,
  },
}))

describe('MessengerMessageReader', () => {
  beforeEach(() => {
    apiMock.getDetails.mockReset()
    apiMock.downloadAttachment.mockReset()
    apiMock.downloadAttachment.mockResolvedValue({
      blob: new Blob(['safe attachment'], { type: 'application/octet-stream' }),
      fileName: 'Договор.docx',
    })
    apiMock.getDetails.mockResolvedValue({
      managerId: '7',
      managerName: 'Анна Петрова',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      totalMessages: 700,
      returnedMessages: 4,
      truncated: true,
      directionAvailable: false,
      personalAuthorAvailable: false,
      messages: [
        {
          id: '501',
          sessionId: '441',
          dealId: '1001',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/1001/',
          occurredAt: '2026-04-12T10:15:00+03:00',
          channel: { key: 'wz_telegram', label: 'WAZZUP: Telegram' },
          senderKind: 'connector',
          direction: 'outgoing',
          authorLabel: 'Битрикс24 (Анна Петрова)',
          authorConfirmed: true,
          text: '<img src=x onerror=alert(1)>',
          attachments: [],
          hasAttachment: false,
        },
        {
          id: '502',
          sessionId: '441',
          dealId: '1001',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/1001/',
          occurredAt: '2026-04-12T10:16:00+03:00',
          channel: { key: 'wz_telegram', label: 'WAZZUP: Telegram' },
          senderKind: 'connector',
          direction: 'incoming',
          authorLabel: null,
          authorConfirmed: false,
          text: null,
          attachments: [{ id: '77' }],
          hasAttachment: true,
        },
        {
          id: '503',
          sessionId: '441',
          dealId: '1001',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/1001/',
          occurredAt: '2026-04-12T10:17:00+03:00',
          channel: { key: 'wz_telegram', label: 'WAZZUP: Telegram' },
          senderKind: 'connector',
          direction: 'outgoing',
          authorLabel: 'Телефон',
          authorConfirmed: false,
          text: 'Ответ без указанного автора',
          attachments: [],
          hasAttachment: false,
        },
        {
          id: '504',
          sessionId: '441',
          dealId: '1001',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/1001/',
          occurredAt: '2026-04-12T10:18:00+03:00',
          channel: { key: 'olchat_telegram', label: 'OLChat: Telegram' },
          senderKind: 'connector',
          direction: 'unknown',
          authorLabel: null,
          authorConfirmed: false,
          text: 'Направление неизвестно',
          attachments: [],
          hasAttachment: false,
        },
      ],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders raw text as plain data, groups the dialog, and reports truncation', async () => {
    render(
      <MessengerMessageReader
        open
        managerId="7"
        managerName="Анна Петрова"
        from="2026-04-01T00:00:00.000+03:00"
        to="2026-04-30T23:59:59.999+03:00"
        returnFocus={null}
        onRequestClose={vi.fn()}
      />,
    )

    const rawText = await screen.findByText('<img src=x onerror=alert(1)>')
    expect(rawText.tagName).toBe('P')
    expect(
      within(screen.getByTestId('messenger-message-501')).queryByRole('img'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Диалог #441')).toBeInTheDocument()
    expect(
      screen.getByText('Исходящее · Автор: Анна Петрова'),
    ).toBeInTheDocument()
    expect(screen.getByText('Входящее · Клиент')).toBeInTheDocument()
    expect(
      screen.getByText('Исходящее · Ответственный: Анна Петрова'),
    ).toBeInTheDocument()
    expect(screen.getByText('Направление не определено')).toBeInTheDocument()
    expect(screen.queryByText('Исходящее · Телефон')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /открыть сделку 1001/i }),
    ).toHaveAttribute(
      'href',
      'https://example.bitrix24.ru/crm/deal/details/1001/',
    )
    expect(screen.getByText('Вложение без текста')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /скачать вложение 1/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Показаны последние 4 сообщения/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Для WAZZUP и Umnico служебная пометка определяет/i),
    ).toBeInTheDocument()
    expect(apiMock.getDetails).toHaveBeenCalledWith({
      managerId: '7',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      limit: 500,
    })
  })

  it('downloads an attachment through the scoped API request', async () => {
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:attachment')
    const revokeObjectUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { unmount } = render(
      <MessengerMessageReader
        open
        managerId="7"
        managerName="Анна Петрова"
        from="2026-04-01T00:00:00.000+03:00"
        to="2026-04-30T23:59:59.999+03:00"
        returnFocus={null}
        onRequestClose={vi.fn()}
      />,
    )

    await screen.findByText('Диалог #441')
    fireEvent.click(screen.getByRole('button', { name: /скачать вложение 1/i }))

    await waitFor(() =>
      expect(apiMock.downloadAttachment).toHaveBeenCalledWith({
        managerId: '7',
        from: '2026-04-01T00:00:00.000+03:00',
        to: '2026-04-30T23:59:59.999+03:00',
        sessionId: '441',
        messageId: '502',
        fileId: '77',
      }),
    )
    expect(createObjectUrl).toHaveBeenCalledOnce()
    const preparedDownload = await screen.findByRole('link', {
      name: /скачать готовый файл 1/i,
    })
    expect(preparedDownload).toHaveAttribute('href', 'blob:attachment')
    expect(preparedDownload).toHaveAttribute('download', 'Договор.docx')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Файл готов. Если загрузка не началась автоматически, нажмите ссылку.',
    )
    expect(revokeObjectUrl).not.toHaveBeenCalled()

    unmount()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:attachment')
  })

  it('keeps the prepared link when an embedded browser blocks the automatic click', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-automatic')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Download blocked')
    })
    render(
      <MessengerMessageReader
        open
        managerId="7"
        managerName="Анна Петрова"
        from="2026-04-01T00:00:00.000+03:00"
        to="2026-04-30T23:59:59.999+03:00"
        returnFocus={null}
        onRequestClose={vi.fn()}
      />,
    )

    await screen.findByText('Диалог #441')
    fireEvent.click(screen.getByRole('button', { name: /скачать вложение 1/i }))

    expect(
      await screen.findByRole('link', { name: /скачать готовый файл 1/i }),
    ).toHaveAttribute('href', 'blob:blocked-automatic')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [
      'ATTACHMENT_UNAVAILABLE',
      'Bitrix24 не дал получить это вложение. Повторите позже; если ошибка сохранится, администратору нужно проверить доступ интеграции к файлам чата.',
    ],
    [
      'ATTACHMENT_NOT_FOUND',
      'Вложение больше недоступно в этом сообщении.',
    ],
    [
      'ATTACHMENT_TOO_LARGE',
      'Вложение больше 20 МБ и не может быть скачано через дашборд.',
    ],
    ['UNEXPECTED_FAILURE', 'Не удалось скачать вложение. Повторите попытку.'],
  ])(
    'shows %s beside the selected action and offers retry',
    async (errorCode, expectedMessage) => {
      apiMock.downloadAttachment.mockRejectedValue(new Error(errorCode))
      render(
        <MessengerMessageReader
          open
          managerId="7"
          managerName="Анна Петрова"
          from="2026-04-01T00:00:00.000+03:00"
          to="2026-04-30T23:59:59.999+03:00"
          returnFocus={null}
          onRequestClose={vi.fn()}
        />,
      )

      await screen.findByText('Диалог #441')
      const message = screen.getByTestId('messenger-message-502')
      fireEvent.click(
        within(message).getByRole('button', { name: /скачать вложение 1/i }),
      )

      expect(await within(message).findByRole('alert')).toHaveTextContent(
        expectedMessage,
      )
      const retry = within(message).getByRole('button', {
        name: /повторить скачивание вложения 1/i,
      })
      expect(retry).toHaveTextContent('Повторить скачивание 1')

      fireEvent.click(retry)
      await waitFor(() =>
        expect(apiMock.downloadAttachment).toHaveBeenCalledTimes(2),
      )
    },
  )

  it('keeps escape under parent state control', async () => {
    const onRequestClose = vi.fn()
    render(
      <MessengerMessageReader
        open
        managerId="7"
        managerName="Анна Петрова"
        from="2026-04-01T00:00:00.000+03:00"
        to="2026-04-30T23:59:59.999+03:00"
        returnFocus={null}
        onRequestClose={onRequestClose}
      />,
    )

    await screen.findByText('Диалог #441')
    const dialog = screen.getByRole('dialog')
    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(onRequestClose).toHaveBeenCalledOnce())
  })
})
