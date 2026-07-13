import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type {
  SourceCohortConversionJourney,
  SourceCohortConversionJourneyStepKey,
} from '@/lib/dashboard-types'
import { SourceCohortConversionJourneySection } from '@/proto/source-cohort-conversion-journey'

function step(
  stepKey: SourceCohortConversionJourneyStepKey,
  label: string,
  deals: number,
  rateFromPrevious: number,
  dropoffDeals: number,
  options: {
    transitionDeals?: number
    medianDaysFromCreate?: number | null
    medianDaysFromPrevious?: number | null
  } = {},
) {
  return {
    stepKey,
    label,
    deals,
    rateFromCohort: deals,
    transitionDeals: options.transitionDeals ?? deals,
    rateFromPrevious,
    dropoffDeals,
    medianDaysFromCreate: options.medianDaysFromCreate ?? 2,
    medianDaysFromPrevious: options.medianDaysFromPrevious ?? 1,
    evidence: `${label}: тестовая методика`,
  }
}

const journey: SourceCohortConversionJourney = {
  coreSteps: [
    step('created', 'Создана', 100, 100, 0),
    step('first_call', 'Первый звонок', 80, 80, 20),
    step('confirmed_conversation', 'Подтвержденный разговор', 40, 50, 40),
    step('meeting_scheduled', 'Встреча назначена', 35, 75, 10, {
      transitionDeals: 30,
      medianDaysFromCreate: 4,
      medianDaysFromPrevious: 1.5,
    }),
    step('meeting_completed', 'Встреча состоялась', 30, 85.71, 5),
    step('contract', 'Контракт', 10, 33.33, 20),
    step('transferred', 'Передано в клуб', 7, 70, 3),
  ],
  eventSteps: [
    step('event_1', 'Посетил событие №1', 20, 66.67, 10),
    step('event_2', 'Посетил событие №2', 12, 60, 8),
    step('event_3_plus', 'Посетил событие №3+', 5, 41.67, 7),
  ],
  eventDepthRows: [
    {
      depthKey: '0',
      label: 'Без события',
      deals: 10,
      rateFromCompletedMeeting: 33.33,
      contractDeals: 2,
      contractRate: 20,
      transferredDeals: 1,
      transferredRate: 10,
      medianDaysToContract: 4,
    },
    {
      depthKey: '1',
      label: '1 событие',
      deals: 8,
      rateFromCompletedMeeting: 26.67,
      contractDeals: 3,
      contractRate: 37.5,
      transferredDeals: 2,
      transferredRate: 25,
      medianDaysToContract: 5,
    },
    {
      depthKey: '2',
      label: '2 события',
      deals: 7,
      rateFromCompletedMeeting: 23.33,
      contractDeals: 3,
      contractRate: 42.86,
      transferredDeals: 2,
      transferredRate: 28.57,
      medianDaysToContract: 6,
    },
    {
      depthKey: '3_plus',
      label: '3+ события',
      deals: 5,
      rateFromCompletedMeeting: 16.67,
      contractDeals: 2,
      contractRate: 40,
      transferredDeals: 2,
      transferredRate: 40,
      medianDaysToContract: 8,
    },
  ],
}

describe('SourceCohortConversionJourneySection', () => {
  it('shows the complete core path, explicit transition denominators, and event depth', () => {
    render(
      <SourceCohortConversionJourneySection
        journey={journey}
        selectedMonthLabel="Июнь 2026"
        totalDeals={100}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Конверсия по траектории', level: 4 })).toBeInTheDocument()
    const corePath = screen.getByRole('region', { name: 'Основная траектория конверсии' })
    expect(within(corePath).getAllByRole('button')).toHaveLength(7)
    expect(within(corePath).getByRole('button', { name: /Первый звонок/ })).toBeInTheDocument()
    expect(within(corePath).getByRole('button', { name: /Передано в клуб/ })).toBeInTheDocument()
    expect(screen.getByText('Первый звонок → Подтвержденный разговор')).toBeInTheDocument()
    expect(screen.getAllByText(/40 из 80/)).not.toHaveLength(0)
    expect(screen.getByRole('img', { name: /3\+ события: 5 сделок/ })).toBeInTheDocument()

    const depthTable = screen.getByRole('table', {
      name: 'Контракт по глубине посещенных событий',
    })
    expect(within(depthTable).getByText('Без события')).toBeInTheDocument()
    expect(within(depthTable).getByText('3+ события')).toBeInTheDocument()
    const methodologySummary = screen.getByText('Как считаем шаги')
    const methodologyTrigger = methodologySummary.closest('summary')
    const methodologyDetails = methodologyTrigger?.closest('details')
    expect(methodologyDetails).not.toHaveAttribute('open')

    fireEvent.click(methodologyTrigger!)

    expect(methodologyDetails).toHaveAttribute('open')
  })

  it('opens the selected step methodology and explains facts outside the strict sequence', () => {
    render(
      <SourceCohortConversionJourneySection
        journey={journey}
        selectedMonthLabel="Июнь 2026"
        totalDeals={100}
      />,
    )

    const meetingScheduled = screen.getByRole('button', { name: /Встреча назначена/ })
    expect(meetingScheduled).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(meetingScheduled)

    expect(meetingScheduled).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Встреча назначена: тестовая методика')).toBeInTheDocument()
    expect(screen.getAllByText('30 из 40')).not.toHaveLength(0)
    expect(screen.getByText('1,5 дн.')).toBeInTheDocument()
    expect(screen.getByText(/У 5 сделок есть факт шага/)).toBeInTheDocument()
    expect(document.querySelector('[title]')).not.toBeInTheDocument()
  })

  it('shows an honest empty state when the completed-meeting cohort has no contracts', () => {
    const journeyWithoutContracts: SourceCohortConversionJourney = {
      ...journey,
      eventDepthRows: journey.eventDepthRows.map((row) => ({
        ...row,
        contractDeals: 0,
        contractRate: 0,
        transferredDeals: 0,
        transferredRate: 0,
        medianDaysToContract: null,
      })),
    }

    render(
      <SourceCohortConversionJourneySection
        journey={journeyWithoutContracts}
        selectedMonthLabel="Июнь 2026"
        totalDeals={100}
      />,
    )

    expect(screen.getByText('Недостаточно данных для сравнения')).toBeInTheDocument()
    expect(screen.getByText(/нет контрактов после подтвержденной встречи/)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Контракт по глубине посещенных событий' })).not.toBeInTheDocument()
  })
})
