import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MessengerMessageReader } from '@/proto/messenger-message-reader'

const apiMock = vi.hoisted(() => ({
  getDetails: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getManagerMessageDetails: apiMock.getDetails,
  },
}))

describe('MessengerMessageReader', () => {
  beforeEach(() => {
    apiMock.getDetails.mockReset()
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
          occurredAt: '2026-04-12T10:15:00+03:00',
          channel: { key: 'wz_telegram', label: 'WAZZUP: Telegram' },
          senderKind: 'connector',
          direction: 'unknown',
          text: '<img src=x onerror=alert(1)>',
          hasAttachment: false,
        },
        {
          id: '502',
          sessionId: '441',
          dealId: '1001',
          occurredAt: '2026-04-12T10:16:00+03:00',
          channel: { key: 'wz_telegram', label: 'WAZZUP: Telegram' },
          senderKind: 'operator',
          direction: 'unknown',
          text: null,
          hasAttachment: true,
        },
      ],
    })
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
    expect(screen.getByText('Вложение без текста')).toBeInTheDocument()
    expect(screen.getByText(/Показаны последние 2 сообщения/i)).toBeInTheDocument()
    expect(apiMock.getDetails).toHaveBeenCalledWith({
      managerId: '7',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      limit: 500,
    })
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
