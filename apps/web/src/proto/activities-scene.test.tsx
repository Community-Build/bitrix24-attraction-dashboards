import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  HourlyWeekdayWorkloadHeatmap,
  WorkloadHeatmapSegment,
} from '@/lib/dashboard-types'
import { mapActivitiesCallsSceneData } from '@/proto/live-reporting'
import { ActivitiesScene } from '@/proto/scenes'
import type { ProtoFilterState, ProtoRuntimeData } from '@/proto/types'

const messengerApiMock = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getDetails: vi.fn(),
  downloadAttachment: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getMessengerReportSummary: messengerApiMock.getSummary,
    getManagerMessageDetails: messengerApiMock.getDetails,
    downloadMessengerAttachment: messengerApiMock.downloadAttachment,
  },
}))

const filters: ProtoFilterState = {
  rangeStart: '2026-04-01',
  rangeEnd: '2026-04-30',
  compareRanges: [],
  managers: [],
  sources: [],
  businessClubs: [],
  targetGroups: [],
}

function heatmap(
  basis: HourlyWeekdayWorkloadHeatmap['basis'],
  weekday: HourlyWeekdayWorkloadHeatmap['weekdays'][number],
  hour: number,
  count: number,
  outsideGridTotal = 0,
  segments: WorkloadHeatmapSegment[] = [],
): HourlyWeekdayWorkloadHeatmap {
  const cell = {
    weekday: weekday.weekday,
    weekdayLabel: weekday.label,
    hour,
    count,
    intensity: 5,
    segments,
  }

  return {
    basis,
    hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    weekdays: [
      { weekday: 1, label: 'Пн' },
      { weekday: 2, label: 'Вт' },
      { weekday: 3, label: 'Ср' },
      { weekday: 4, label: 'Чт' },
      { weekday: 5, label: 'Пт' },
      { weekday: 6, label: 'Сб' },
      { weekday: 7, label: 'Вс' },
    ],
    cells: [cell],
    total: count + outsideGridTotal,
    gridTotal: count,
    outsideGridTotal,
    peak: cell,
  }
}

function createRuntimeData(): ProtoRuntimeData {
  const tasksHourlyHeatmap = heatmap(
    { key: 'tasks', label: 'Задачи' },
    { weekday: 1, label: 'Пн' },
    9,
    2,
    0,
    [
      { key: 'created_tasks', label: 'Созданные задачи', count: 1, intensity: 5 },
      { key: 'closed_tasks', label: 'Закрытые задачи', count: 1, intensity: 5 },
    ],
  )
  const createdTasksHourlyHeatmap = heatmap(
    { key: 'created_tasks', label: 'Созданные задачи' },
    { weekday: 1, label: 'Пн' },
    9,
    1,
  )
  const closedTasksHourlyHeatmap = heatmap(
    { key: 'closed_tasks', label: 'Закрытые задачи' },
    { weekday: 1, label: 'Пн' },
    9,
    1,
  )
  const meetingsHourlyHeatmap = heatmap(
    { key: 'meetings', label: 'Встречи' },
    { weekday: 2, label: 'Вт' },
    15,
    3,
    0,
    [
      { key: 'meeting_slot_1', label: 'Встреча 1', count: 1, intensity: 5 },
      { key: 'meeting_slot_2', label: 'Встреча 2', count: 1, intensity: 5 },
      { key: 'meeting_slot_3', label: 'Встреча 3', count: 1, intensity: 5 },
    ],
  )
  const callsHourlyHeatmap = heatmap(
    { key: 'outgoing_calls', label: 'Исходящие звонки' },
    { weekday: 3, label: 'Ср' },
    10,
    3,
    1,
    [
      { key: 'successful_outgoing_calls', label: 'Успешные >30 сек', count: 1, intensity: 5 },
      { key: 'other_outgoing_calls', label: 'Прочие исходящие', count: 1, intensity: 5 },
      { key: 'no_answer_outgoing_calls', label: 'Недозвоны', count: 1, intensity: 5 },
    ],
  )
  const activities: ActivitiesWorkloadReport = {
    range: {
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
    },
    totalDealCount: 1,
    totalCreatedCount: 1,
    totalRescheduledCount: 0,
    totalClosedCount: 1,
    totalMeetingCount: 3,
    warnings: [],
    conversionEventRows: [],
    managerRows: [
      {
        managerId: '7',
        managerName: 'Анна Петрова',
        dealCount: 1,
        createdCount: 1,
        rescheduledCount: 0,
        closedCount: 1,
        meetingCount: 3,
        averageCreatedPerDeal: 1,
        averageRescheduledPerDeal: 0,
        averageClosedPerDeal: 1,
        averageMeetingsPerDeal: 3,
        meetingTypeBreakdown: [
          {
            meetingTypeKey: 'Очная',
            meetingTypeLabel: 'Очная',
            count: 3,
          },
        ],
        businessClubBreakdown: [],
        meetingBusinessClubBreakdown: [
          {
            businessClubKey: 'ClubOne',
            businessClubLabel: 'ClubOne',
            meetingTypeKey: 'Очная',
            meetingTypeLabel: 'Очная',
            count: 3,
          },
        ],
        tasksHourlyHeatmap,
        createdTasksHourlyHeatmap,
        closedTasksHourlyHeatmap,
        meetingsHourlyHeatmap,
        slaMetrics: [],
        stageBreakdown: [],
      },
    ],
  }
  const calls: CallsWorkloadReport = {
    range: activities.range,
    totalDealCount: 1,
    totalCalls: 2,
    totalIncomingCalls: 0,
    totalOutgoingCalls: 2,
    totalOtherOutgoingCalls: 0,
    totalConnectedCalls: 2,
    totalFailedCalls: 0,
    totalCallsOverThirtySeconds: 2,
    totalConnectedCallsOverThirtySeconds: 2,
    warnings: [],
    managerRows: [
      {
        managerId: '7',
        managerName: 'Анна Петрова',
        dealCount: 1,
        totalCalls: 2,
        incomingCalls: 0,
        outgoingCalls: 2,
        otherOutgoingCalls: 0,
        connectedCalls: 2,
        failedCalls: 0,
        callsOverThirtySeconds: 2,
        connectedCallsOverThirtySeconds: 2,
        averageCallsPerDeal: 2,
        averageDurationSeconds: 90,
        callsHourlyHeatmap,
        stageBreakdown: [],
      },
    ],
  }

  return {
    managerOptions: [],
    sourceOptions: [],
    activitiesWorkload: activities,
    callsWorkload: calls,
    activitiesCalls: mapActivitiesCallsSceneData({ activities, calls }),
    operationalStatus: 'ready',
    operationalError: null,
  }
}

describe('ActivitiesScene', () => {
  beforeEach(() => {
    messengerApiMock.getSummary.mockReset()
    messengerApiMock.getDetails.mockReset()
    messengerApiMock.downloadAttachment.mockReset()
  })

  it('expands manager heatmaps in the summary and meetings tables', async () => {
    render(
      <ActivitiesScene
        commentMode={false}
        filters={filters}
        runtimeData={createRuntimeData()}
      />,
    )

    expect(screen.queryByText('Исходящие звонки по часам')).not.toBeInTheDocument()
    expect(screen.queryByText('Встречи по часам')).not.toBeInTheDocument()
    expect(screen.queryByText(/С1:/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Сообщения в мессенджерах' }),
    ).not.toBeInTheDocument()
    expect(messengerApiMock.getSummary).not.toHaveBeenCalled()

    await userEvent.click(
      screen.getByRole('button', {
        name: /раскрыть карту звонков и дел анна петрова/i,
      }),
    )

    expect(screen.getByText('Исходящие звонки по часам')).toBeInTheDocument()
    expect(screen.getByText('Задачи по часам')).toBeInTheDocument()
    expect(screen.getByTestId('activity-summary-heatmap-grid')).toHaveClass(
      'xl:grid-cols-2',
    )
    expect(screen.getByTestId('activity-summary-heatmap-grid')).not.toHaveClass(
      '2xl:grid-cols-2',
    )
    expect(screen.queryByText('Созданные задачи по часам')).not.toBeInTheDocument()
    expect(screen.queryByText('Закрытые задачи по часам')).not.toBeInTheDocument()
    expect(screen.getByText('вне 09-21 1')).toBeInTheDocument()
    expect(
      screen.getByLabelText(/пн 09:00: созданные задачи 1, закрытые задачи 1/i),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        /ср 10:00: успешные >30 сек 1, прочие исходящие 1, недозвоны 1/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-cell-total-outgoing_calls-3-10')).toHaveTextContent(
      '3',
    )
    expect(
      screen.queryByTestId('heatmap-segment-counts-outgoing_calls-3-10'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ),
    ).toHaveTextContent('1')
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ).parentElement,
    ).toHaveClass('relative')
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ),
    ).toHaveClass('absolute')
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ),
    ).toHaveClass('bottom-1')
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ),
    ).not.toHaveClass('bg-white/25')
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ),
    ).not.toHaveClass('rounded')
    expect(
      screen.getByTestId(
        'heatmap-segment-count-outgoing_calls-3-10-successful_outgoing_calls',
      ),
    ).not.toHaveClass('px-[3px]')
    expect(
      screen.getByTestId('heatmap-segment-count-outgoing_calls-3-10-other_outgoing_calls'),
    ).toHaveTextContent('1')
    expect(
      screen.getByTestId('heatmap-segment-count-outgoing_calls-3-10-no_answer_outgoing_calls'),
    ).toHaveTextContent('1')
    expect(
      screen.getByTestId('heatmap-cell-total-outgoing_calls-3-10'),
    ).toHaveClass('inset-0')
    expect(
      screen.getByTestId('heatmap-cell-total-outgoing_calls-3-10'),
    ).not.toHaveClass('rounded-full')
    expect(screen.getByTestId('heatmap-cell-total-tasks-1-9')).toHaveTextContent('2')
    expect(screen.queryByTestId('heatmap-segment-counts-tasks-1-9')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('heatmap-segment-count-tasks-1-9-created_tasks'),
    ).toHaveTextContent('1')
    expect(
      screen.getByTestId('heatmap-segment-count-tasks-1-9-closed_tasks'),
    ).toHaveTextContent('1')
    expect(screen.getByTestId('heatmap-cell-total-tasks-1-9')).toHaveClass(
      'inset-0',
    )
    expect(screen.getByTestId('heatmap-cell-total-tasks-1-9')).not.toHaveClass(
      'rounded-full',
    )
    expect(screen.getAllByText('09:00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('21:00').length).toBeGreaterThan(0)

    await userEvent.click(
      screen.getByRole('button', {
        name: /раскрыть карту встреч анна петрова/i,
      }),
    )

    expect(screen.getByText('Встречи по часам')).toHaveClass('text-sky-700')
    expect(screen.getByText('Встречи по часам')).not.toHaveClass('text-amber-700')
    expect(
      screen.getByLabelText(/вт 15:00: встреча 1 1, встреча 2 1, встреча 3 1/i),
    ).toBeInTheDocument()
    expect(screen.getByTestId('heatmap-cell-total-meetings-2-15')).toHaveTextContent('3')
    expect(
      screen.getByTestId('heatmap-segment-count-meetings-2-15-meeting_slot_1'),
    ).toHaveTextContent('1')
    expect(
      screen.getByTestId('heatmap-segment-count-meetings-2-15-meeting_slot_2'),
    ).toHaveTextContent('1')
    expect(
      screen.getByTestId('heatmap-segment-count-meetings-2-15-meeting_slot_3'),
    ).toHaveTextContent('1')
  })

  it('loads messenger totals only on demand and opens a separate message reader', async () => {
    messengerApiMock.getSummary.mockResolvedValue({
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      totalMessages: 12,
      messagesWithText: 11,
      attachmentOnlyMessages: 1,
      uniqueDialogs: 5,
      dealsWithMessages: 4,
      outgoingMessages: 8,
      incomingMessages: 3,
      unknownDirectionMessages: 1,
      uniqueOutgoingDialogs: 4,
      dealsWithOutgoingMessages: 3,
      systemMessagesExcluded: 2,
      managerRows: [
        {
          managerId: '7',
          managerName: 'Анна Петрова',
          from: '2026-04-01T00:00:00.000+03:00',
          to: '2026-04-30T23:59:59.999+03:00',
          currentDeals: 8,
          sessions: 6,
          uniqueDialogs: 5,
          dealsWithMessages: 4,
          outgoingMessages: 8,
          incomingMessages: 3,
          unknownDirectionMessages: 1,
          uniqueOutgoingDialogs: 4,
          dealsWithOutgoingMessages: 3,
          messages: 12,
          messagesWithText: 11,
          attachmentOnlyMessages: 1,
          systemMessagesExcluded: 2,
          senderKinds: { connector: 8, operator: 4, unknown: 0 },
          channels: [
            { key: 'wz_telegram', label: 'WAZZUP: Telegram', messages: 12 },
          ],
          directionAvailable: false,
          personalAuthorAvailable: false,
        },
      ],
      directionAvailable: false,
      personalAuthorAvailable: false,
    })
    messengerApiMock.getDetails.mockResolvedValue({
      managerId: '7',
      managerName: 'Анна Петрова',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      totalMessages: 1,
      returnedMessages: 1,
      truncated: false,
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
          text: 'Полный текст сообщения в отдельном просмотрщике',
          attachments: [],
          hasAttachment: false,
        },
      ],
    })

    render(
      <ActivitiesScene
        commentMode={false}
        filters={{ ...filters, managers: ['7'] }}
        runtimeData={createRuntimeData()}
        canReadMessengerMessages
      />,
    )

    expect(messengerApiMock.getSummary).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: 'Сообщения в мессенджерах' }),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /посчитать сообщения за период/i }),
    )

    await waitFor(() =>
      expect(messengerApiMock.getSummary).toHaveBeenCalledWith({
        managerIds: ['7'],
        from: '2026-04-01T00:00:00.000+03:00',
        to: '2026-04-30T23:59:59.999+03:00',
      }),
    )
    expect(
      await screen.findByTestId('messenger-outgoing-messages'),
    ).toHaveTextContent(
      '8',
    )
    expect(screen.getByTestId('messenger-unique-outgoing-dialogs')).toHaveTextContent(
      '4',
    )
    expect(
      screen.getByTestId('messenger-deals-with-outgoing-messages'),
    ).toHaveTextContent(
      '3',
    )
    expect(screen.getByTestId('messenger-incoming-messages')).toHaveTextContent('3')
    expect(screen.getByTestId('messenger-unknown-7')).toHaveTextContent('1')
    expect(
      screen.getByRole('columnheader', { name: 'Не определено' }),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: /читать сообщения анна петрова/i,
      }),
    )

    expect(
      await screen.findByText('Полный текст сообщения в отдельном просмотрщике'),
    ).toBeInTheDocument()
    expect(messengerApiMock.getDetails).toHaveBeenCalledWith({
      managerId: '7',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      limit: 500,
    })
  })
})
