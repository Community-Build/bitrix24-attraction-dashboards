import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DealAnalysisReport, DealAnalysisRow } from '@/lib/dashboard-types'
import { createCallAnalysisFiltersForTarget } from '@/proto/call-analysis-workspace'
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
const healthyRow: DealAnalysisRow = {
  ...row,
  dealId: '84',
  dealUrl: 'https://example.test/deal/84',
  managerName: 'Борис Смирнов',
  amount: 100000,
  daysOnStage: 2,
  stageOverdueDays: 0,
  lastActivityAt: '2026-06-19T10:00:00.000Z',
  nextAction: { status: 'scheduled', activityId: '15', deadline: '2026-06-25T12:00:00.000Z', overdueDays: 0 },
  healthScore: 85,
  healthBand: 'healthy',
  risks: [],
}
const report: DealAnalysisReport = {
  range: { from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T23:59:59.999Z' },
  generatedAt: '2026-06-30T12:00:00.000Z', scope: 'open',
  currentScope: { status: 'ready', reconciledAt: null, dealCount: 2 }, rows: [row, healthyRow], thresholdsUpdatedAt: null,
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
    const scoreHeader = screen.getByRole('columnheader', { name: /Оценка/ })
    expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#42')
    await user.click(screen.getByRole('button', { name: /Оценка: по возрастанию/ }))
    expect(scoreHeader).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#84')
    await user.click(screen.getByRole('button', { name: /Оценка: по убыванию/ }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#42')
    expect(screen.getByRole('button', { name: /Сделка: сортировка не применена/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Риски: сортировка не применена/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Менеджер: сортировка не применена/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Этап: сортировка не применена/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Активность: сортировка не применена/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /След. действие: сортировка не применена/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Сумма: сортировка не применена/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Менеджер: сортировка не применена/ }))
    expect(screen.getByRole('columnheader', { name: /Менеджер/ })).toHaveAttribute('aria-sort', 'ascending')
    await user.click(screen.getByRole('button', { name: /Менеджер: по возрастанию/ }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#84')

    await user.click(screen.getByRole('button', { name: /Сумма: сортировка не применена/ }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#42')
    await user.click(screen.getByRole('button', { name: /Сумма: по убыванию/ }))
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#84')
    expect(screen.queryByRole('button', { name: '+ Добавить фильтр' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Поиск по ID сделки')).not.toBeInTheDocument()
    await user.click(screen.getByText('#42'))

    expect(await screen.findByRole('dialog', { name: 'Сделка 42' })).toBeInTheDocument()
    expect(screen.getByText('Нет следующего действия')).toBeInTheDocument()
    await waitFor(() => expect(api.detail).toHaveBeenCalledWith('42', expect.any(Object), 'open'))
  })

  it('renders a concrete full timeline and connects a call to analysis', async () => {
    api.report.mockResolvedValue(report)
    api.detail.mockResolvedValue({
      row,
      timeline: [
        {
          id: 'task:11', sourceEntityId: '11', kind: 'task_completed',
          occurredAt: '2026-06-18T14:00:00.000Z', title: 'Подготовить предложение',
          detail: null, subject: 'Подготовить предложение', comment: 'Согласовать состав пакета',
          createdAt: '2026-06-17T09:00:00.000Z', deadlineAt: '2026-06-19T12:00:00.000Z',
          completedAt: '2026-06-18T14:00:00.000Z', eventName: null, direction: null,
          durationSeconds: null, successful: true, stageId: 'C10:NEW', stageName: 'Квалификация',
        },
        {
          id: 'call:99', sourceEntityId: '99', kind: 'call',
          occurredAt: '2026-06-18T10:00:00.000Z', title: 'Звонок', detail: null,
          subject: null, comment: null, createdAt: null, deadlineAt: null,
          completedAt: null, eventName: null, direction: 'outgoing', durationSeconds: 999,
          successful: true, stageId: 'C10:NEW', stageName: 'Квалификация',
        },
        {
          id: 'message:7', sourceEntityId: '7', kind: 'message',
          occurredAt: '2026-06-18T09:00:00.000Z', title: 'WhatsApp', detail: 'Подтверждаю встречу',
          subject: null, comment: null, createdAt: '2026-06-18T09:00:00.000Z', deadlineAt: null,
          completedAt: null, eventName: null, direction: 'incoming', durationSeconds: null,
          successful: null, stageId: null, stageName: null,
        },
        {
          id: 'event:4', sourceEntityId: '4', kind: 'conversion_event_visit',
          occurredAt: '2026-06-17T18:00:00.000Z', title: 'День открытых дверей', detail: 'invited',
          subject: null, comment: null, createdAt: null, deadlineAt: null, completedAt: null,
          eventName: 'День открытых дверей', direction: null, durationSeconds: null,
          successful: null, stageId: 'C10:NEW', stageName: 'Квалификация',
        },
      ],
      stageHistory: [], messages: [],
      callInsights: [{ callId: '99', status: 'not_analyzed', score: null, summary: null, risks: [], suggestedNextStep: null, transcript: null, analyzedAt: null, errorMessage: null }],
      sensitiveContentAvailable: true,
    })
    const onCallAnalysisNavigate = vi.fn()
    const user = userEvent.setup()
    render(<DealAnalysisScene filters={filters} commentMode={false} onCallAnalysisNavigate={onCallAnalysisNavigate} />)

    await user.click(await screen.findByText('#42'))
    await user.click(await screen.findByRole('button', { name: 'Активность' }))

    expect(screen.getByText('Подготовить предложение')).toBeInTheDocument()
    expect(screen.getByText('Согласовать состав пакета')).toBeInTheDocument()
    expect(screen.getByText('Выполнить до:')).toBeInTheDocument()
    expect(screen.queryByText('Срок:')).not.toBeInTheDocument()
    expect(screen.getByText('Исходящий звонок')).toBeInTheDocument()
    expect(screen.getByText('16 мин 39 сек')).toBeInTheDocument()
    expect(screen.getByText('Подтверждаю встречу')).toBeInTheDocument()
    expect(screen.getByText('День открытых дверей')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'История этапов' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Открыть в анализе звонков' }))
    expect(onCallAnalysisNavigate).toHaveBeenCalledWith('99', '2026-06-18T10:00:00.000Z')
    expect(createCallAnalysisFiltersForTarget({ callId: '99', startedAt: '2026-06-18T10:00:00.000Z' })).toMatchObject({
      rangeStart: '2026-06-18',
      rangeEnd: '2026-06-18',
    })
  })
})
