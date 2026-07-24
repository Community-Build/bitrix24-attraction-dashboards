import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SourceCohortTrajectoryReport } from '@/lib/dashboard-types'
import { SourceCohortStageConversionSection } from '@/proto/source-cohort-trajectory-section'

const drawerMock = vi.hoisted(() => ({
  render: vi.fn<(_props: unknown) => null>(() => null),
}))

vi.mock('@/proto/source-cohort-journey-drilldown', () => ({
  SourceCohortJourneyDrilldown: drawerMock.render,
}))

const trajectory = {
  range: {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-06-30T23:59:59.999Z',
  },
  totalDeals: 12,
  conversionJourney: {
    coreSteps: [],
    eventSteps: [],
    eventDepthRows: [],
  },
  stageNodes: [
    {
      stageId: 'C10:NEW',
      stageName: 'База входящая',
      sortOrder: 10,
      reachedDeals: 12,
      reachedRate: 100,
      medianDaysFromCreate: 0,
      medianDaysOnStage: 1,
    },
    {
      stageId: 'C10:PREPARATION',
      stageName: 'Звонок-знакомство',
      sortOrder: 20,
      reachedDeals: 8,
      reachedRate: 66.67,
      medianDaysFromCreate: 1,
      medianDaysOnStage: 2,
    },
  ],
  stageTransitions: [],
  actionNodes: [],
  factSteps: [],
  conversionGaps: [],
  speedSteps: [],
  overallSignals: {
    wonDeals: 1,
    lostDeals: 2,
    openDeals: 9,
  },
  managerDiagnostics: [],
  managerRows: [],
  sourceRows: [],
  customerRows: [],
  qualityRows: [],
  eventPerformance: {
    range: {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-30T23:59:59.999Z',
    },
    totalEvents: 0,
    invitedVisits: 0,
    attendedVisits: 0,
    attendanceRate: 0,
    contractEligibleVisits: 0,
    contractAfterVisits: 0,
    transferredAfterVisits: 0,
    eventTypeRows: [],
    eventRows: [],
    managerRows: [],
    warnings: [],
  },
  dataQuality: {
    warnings: [],
  },
} as unknown as SourceCohortTrajectoryReport

describe('SourceCohortStageConversionSection CRM stages', () => {
  beforeEach(() => {
    drawerMock.render.mockClear()
  })

  it('opens the shared deal drawer from an existing CRM-stage table row', async () => {
    render(
      <SourceCohortStageConversionSection
        selectedMonthLabel="Июнь 2026"
        totalCreatedDeals={12}
        trajectory={trajectory}
        query={{ preset: 30 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'CRM-этапы' }))

    const stageButton = screen.getByRole('button', {
      name: /Звонок-знакомство Сделки/,
    })
    expect(stageButton).toHaveAttribute('aria-haspopup', 'dialog')

    fireEvent.click(screen.getByRole('cell', { name: '8' }))

    await waitFor(() => {
      const props = drawerMock.render.mock.calls.at(-1)?.[0]
      expect(props).toEqual(
        expect.objectContaining({
          open: true,
          drilldownKind: 'crm_stage',
          stepKey: 'C10:PREPARATION',
        }),
      )
    })
  })
})
