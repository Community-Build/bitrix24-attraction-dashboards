import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SourceCohortConversionJourneyDrilldown } from '@/lib/dashboard-types'
import { SourceCohortJourneyDrilldown } from '@/proto/source-cohort-journey-drilldown'

const apiMock = vi.hoisted(() => ({
  getDrilldown: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getSourceCohortConversionJourneyDrilldown: apiMock.getDrilldown,
  },
}))

const drilldown: SourceCohortConversionJourneyDrilldown = {
  range: {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-06-30T23:59:59.999Z',
  },
  stepKey: 'first_call',
  stepLabel: 'Первая попытка',
  previousStepKey: 'created',
  previousStepLabel: 'Создана',
  nextStepKey: 'confirmed_conversation',
  nextStepLabel: 'Успешный разговор',
  asOf: '2026-07-24T12:00:00.000Z',
  views: {
    reached: {
      viewKey: 'reached',
      label: 'Дошли до этапа',
      count: 1,
      deals: [
        {
          dealId: '23841',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/23841/',
          managerId: '7',
          managerName: 'Мария',
          currentStageId: 'C10:QUALIFICATION',
          currentStageName: 'Квалификация',
          outcome: 'open',
          status: 'advanced',
          statusLabel: 'Прошла дальше',
          reason: 'После первой попытки зафиксирован успешный разговор.',
          createdAt: '2026-06-09T08:00:00.000Z',
          previousStepAt: '2026-06-09T08:00:00.000Z',
          selectedStepAt: '2026-06-09T08:40:00.000Z',
          nextStepAt: '2026-06-09T08:45:00.000Z',
          ageFromAt: '2026-06-09T08:40:00.000Z',
          ageDays: 0,
          slaDays: 3,
        },
      ],
    },
    missed: {
      viewKey: 'missed',
      label: 'Потерялись на переходе',
      count: 0,
      deals: [],
    },
    notAdvanced: {
      viewKey: 'not_advanced',
      label: 'Не пошли дальше',
      count: 1,
      deals: [
        {
          dealId: '23842',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/23842/',
          managerId: '8',
          managerName: 'Иван',
          currentStageId: 'C10:CALL',
          currentStageName: 'Первая попытка',
          outcome: 'open',
          status: 'stuck',
          statusLabel: 'Застряла',
          reason: 'После первой попытки нет успешного разговора дольше 3 дней.',
          createdAt: '2026-06-02T08:00:00.000Z',
          previousStepAt: '2026-06-02T08:00:00.000Z',
          selectedStepAt: '2026-06-02T09:00:00.000Z',
          nextStepAt: null,
          ageFromAt: '2026-06-02T09:00:00.000Z',
          ageDays: 52,
          slaDays: 3,
        },
      ],
    },
  },
}

describe('SourceCohortJourneyDrilldown', () => {
  beforeEach(() => {
    apiMock.getDrilldown.mockReset()
    apiMock.getDrilldown.mockResolvedValue(drilldown)
  })

  it('loads the selected transition lazily and opens on deals that did not advance', async () => {
    render(
      <SourceCohortJourneyDrilldown
        open
        query={{
          preset: 'custom',
          from: '2026-06-01',
          to: '2026-06-30',
          managerIds: ['7', '8'],
        }}
        stepKey="first_call"
        returnFocus={null}
        onRequestClose={vi.fn()}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Первая попытка' })).toBeInTheDocument()
    expect(apiMock.getDrilldown).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'custom',
        managerIds: ['7', '8'],
      }),
      'first_call',
    )

    const stuckTab = screen.getByRole('tab', { name: /Не пошли дальше 1/ })
    expect(stuckTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Сделка #23842')).toBeInTheDocument()
    expect(screen.getByText('После первой попытки нет успешного разговора дольше 3 дней.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Дошли до этапа 1/ }))

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Сделка #23841')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Открыть сделку 23841 в Битрикс24' })).toHaveAttribute(
      'href',
      'https://example.bitrix24.ru/crm/deal/details/23841/',
    )
  })

  it('keeps escape under parent state control', async () => {
    const onRequestClose = vi.fn()
    render(
      <SourceCohortJourneyDrilldown
        open
        query={{ preset: 30 }}
        stepKey="first_call"
        returnFocus={null}
        onRequestClose={onRequestClose}
      />,
    )

    await screen.findByRole('heading', { name: 'Первая попытка' })
    const dialog = document.querySelector('dialog')
    expect(dialog).not.toBeNull()

    fireEvent(dialog as HTMLDialogElement, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(onRequestClose).toHaveBeenCalledOnce())
  })
})
