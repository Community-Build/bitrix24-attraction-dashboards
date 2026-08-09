import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DealAnalysisReport, DealAnalysisRow } from '@/lib/dashboard-types'
import { DealAnalysisScene } from '@/proto/deal-analysis-scene'
import type { ProtoFilterState } from '@/proto/types'

const api = vi.hoisted(() => ({ report: vi.fn(), detail: vi.fn() }))
vi.mock('@/lib/api-client', () => ({ apiClient: {
  getDealAnalysisReport: api.report,
  getDealAnalysisDetail: api.detail,
} }))

const filters: ProtoFilterState = {
  rangeStart: '2026-06-01', rangeEnd: '2026-06-30', compareRanges: [],
  managers: [], sources: [], businessClubs: [], targetGroups: [],
}
const row: DealAnalysisRow = {
  dealId: '42', dealUrl: 'https://example.test/deal/42', scope: 'open',
  managerId: '7', managerName: 'Анна Петрова', stageId: 'C10:NEW', stageName: 'Квалификация',
  sourceKey: '8', sourceLabel: 'Рекомендация', amount: 250000,
  dateCreate: '2026-06-01T10:00:00.000Z', dateModify: '2026-06-20T10:00:00.000Z', dateClosed: null,
  currentStageEnteredAt: '2026-06-10T10:00:00.000Z', daysOnStage: 10,
  stageMaxDays: 5, stageOverdueDays: 5, lastActivityAt: '2026-06-18T10:00:00.000Z', lastCallAt: null,
  nextAction: { status: 'missing', activityId: null, deadline: null, overdueDays: 0 },
  healthScore: 35, healthBand: 'risk',
  risks: [{ key: 'missing_next_action', label: 'Нет следующего действия', evidence: 'Нет открытой активности с датой', recommendation: 'Назначить задачу с целью и датой', deduction: 30, observedDays: null, thresholdDays: null }],
  activityMarkers: [], activityMarkerCount: 0,
}
const report: DealAnalysisReport = {
  range: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' },
  generatedAt: '2026-06-30T12:00:00.000Z', scope: 'open',
  currentScope: { status: 'ready', reconciledAt: null, dealCount: 1 }, rows: [row], thresholdsUpdatedAt: null,
}

describe('DealAnalysisScene', () => {
  it('renders the intervention queue and opens the lazy deal drawer', async () => {
    api.report.mockResolvedValue(report)
    api.detail.mockResolvedValue({
      row, timeline: [], stageHistory: [], messages: [], callInsights: [], sensitiveContentAvailable: true,
    })
    const user = userEvent.setup()
    render(<DealAnalysisScene filters={filters} commentMode={false} />)

    expect(await screen.findByText('#42')).toBeInTheDocument()
    expect(screen.getByText('35')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Добавить фильтр' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Давность активности' }), '14')
    expect(screen.queryByText('#42')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Давность активности' }), '7')
    expect(screen.getByText('#42')).toBeInTheDocument()
    await user.click(screen.getByText('#42'))

    expect(await screen.findByRole('dialog', { name: 'Сделка 42' })).toBeInTheDocument()
    expect(screen.getByText('Нет следующего действия')).toBeInTheDocument()
    await waitFor(() => expect(api.detail).toHaveBeenCalledWith('42', expect.any(Object), 'open'))
  })
})
