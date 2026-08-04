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
      returnedMessages: 2,
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
          text: null,
          attachments: [{ id: '77' }],
          hasAttachment: true,
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
      screen.getByText('Исходящее · Битрикс24 (Анна Петрова)'),
    ).toBeInTheDocument()
    expect(screen.getByText('Входящее')).toBeInTheDocument()
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
    expect(screen.getByText(/Показаны последние 2 сообщения/i)).toBeInTheDocument()
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
    await waitFor(() =>
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:attachment'),
    )
  })

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
