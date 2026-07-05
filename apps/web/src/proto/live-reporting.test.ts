import { describe, expect, it } from 'vitest'

import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  CohortConversionReport,
} from '@/lib/dashboard-types'
import {
  buildDashboardQueryFromProtoFilters,
  mapActivitiesCallsSceneData,
  mapCohortSceneData,
  mapTocFlowSceneData,
} from '@/proto/live-reporting'

describe('live-reporting', () => {
  it('builds a dashboard query from prototype filters in the Bitrix business timezone', () => {
    const query = buildDashboardQueryFromProtoFilters({
      rangeStart: '2026-04-01',
      rangeEnd: '2026-04-30',
      compareRanges: [
        {
          id: 'cmp-1',
          start: '2026-03-01',
          end: '2026-03-31',
        },
      ],
      managers: ['7', '9'],
      sources: ['WEB', 'REFERRAL'],
      businessClubs: ['ClubFirst One'],
      targetGroups: ['ClubFirst Future'],
    })

    expect(query).toEqual({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      managerIds: ['7', '9'],
      sourceKeys: ['WEB', 'REFERRAL'],
      businessClubKeys: ['ClubFirst One'],
      targetGroupKeys: ['ClubFirst Future'],
      compareRanges: [
        {
          from: '2026-03-01T00:00:00.000+03:00',
          to: '2026-03-31T23:59:59.999+03:00',
        },
      ],
    })
  })

  it('maps activities and calls reports into prototype-friendly activity scene data', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      totalDealCount: 20,
      totalCreatedCount: 80,
      totalRescheduledCount: 0,
      totalClosedCount: 60,
      totalMeetingCount: 0,
      warnings: ['Перенос дедлайна пока отключен'],
      conversionEventRows: [],
      managerRows: [
        {
          managerId: '7',
          managerName: 'Анна Петрова',
          dealCount: 10,
          createdCount: 40,
          rescheduledCount: 0,
          closedCount: 32,
          meetingCount: 0,
          averageCreatedPerDeal: 4,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 3.2,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 8,
              createdCount: 24,
              rescheduledCount: 0,
              closedCount: 18,
              averageCreatedPerDeal: 3,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 2.25,
            },
          ],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-01T00:00:00.000Z',
            to: '2026-03-31T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-01T00:00:00.000Z',
              to: '2026-03-31T23:59:59.999Z',
            },
            totalDealCount: 16,
            totalCreatedCount: 64,
            totalRescheduledCount: 0,
            totalClosedCount: 48,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: [
              {
                managerId: '7',
                managerName: 'Анна Петрова',
                dealCount: 8,
                createdCount: 32,
                rescheduledCount: 0,
                closedCount: 24,
                meetingCount: 0,
                averageCreatedPerDeal: 4,
                averageRescheduledPerDeal: 0,
                averageClosedPerDeal: 3,
                averageMeetingsPerDeal: 0,
                meetingTypeBreakdown: [],
                businessClubBreakdown: [],
                slaMetrics: [],
                stageBreakdown: [
                  {
                    stageId: 'CALL',
                    stageName: 'Звонок-знакомство',
                    dealCount: 6,
                    createdCount: 18,
                    rescheduledCount: 0,
                    closedCount: 12,
                    averageCreatedPerDeal: 3,
                    averageRescheduledPerDeal: 0,
                    averageClosedPerDeal: 2,
                  },
                ],
              },
            ],
          },
        },
      ],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      totalDealCount: 20,
      totalCalls: 50,
      totalIncomingCalls: 15,
      totalOutgoingCalls: 35,
      totalOtherOutgoingCalls: 8,
      totalConnectedCalls: 40,
      totalFailedCalls: 10,
      totalCallsOverThirtySeconds: 30,
      totalConnectedCallsOverThirtySeconds: 24,
      warnings: [],
      managerRows: [
        {
          managerId: '7',
          managerName: 'Анна Петрова',
          dealCount: 10,
          totalCalls: 25,
          incomingCalls: 8,
          outgoingCalls: 17,
          otherOutgoingCalls: 0,
          connectedCalls: 20,
          failedCalls: 5,
          callsOverThirtySeconds: 15,
          connectedCallsOverThirtySeconds: 12,
          averageCallsPerDeal: 2.5,
          averageDurationSeconds: 88,
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 8,
              totalCalls: 16,
              incomingCalls: 5,
              outgoingCalls: 11,
              otherOutgoingCalls: 1,
              connectedCalls: 13,
              failedCalls: 3,
              callsOverThirtySeconds: 9,
              connectedCallsOverThirtySeconds: 7,
              averageCallsPerDeal: 2,
              averageDurationSeconds: 92,
            },
          ],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-01T00:00:00.000Z',
            to: '2026-03-31T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-01T00:00:00.000Z',
              to: '2026-03-31T23:59:59.999Z',
            },
            totalDealCount: 16,
            totalCalls: 32,
            totalIncomingCalls: 10,
            totalOutgoingCalls: 22,
            totalOtherOutgoingCalls: 4,
            totalConnectedCalls: 26,
            totalFailedCalls: 6,
            totalCallsOverThirtySeconds: 20,
            totalConnectedCallsOverThirtySeconds: 14,
            warnings: [],
            managerRows: [
              {
                managerId: '7',
                managerName: 'Анна Петрова',
                dealCount: 8,
                totalCalls: 16,
                incomingCalls: 4,
                outgoingCalls: 12,
                otherOutgoingCalls: 2,
                connectedCalls: 13,
                failedCalls: 3,
                callsOverThirtySeconds: 10,
                connectedCallsOverThirtySeconds: 7,
                averageCallsPerDeal: 2,
                averageDurationSeconds: 80,
                stageBreakdown: [
                  {
                    stageId: 'CALL',
                    stageName: 'Звонок-знакомство',
                    dealCount: 6,
                    totalCalls: 12,
                    incomingCalls: 3,
                    outgoingCalls: 9,
                    otherOutgoingCalls: 2,
                    connectedCalls: 10,
                    failedCalls: 2,
                    callsOverThirtySeconds: 8,
                    connectedCallsOverThirtySeconds: 5,
                    averageCallsPerDeal: 2,
                    averageDurationSeconds: 76,
                  },
                ],
              },
            ],
          },
        },
      ],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })

    expect(scene.kpis).toEqual([
      expect.objectContaining({ label: 'Создано задач', value: '80', delta: '+25%', deltaTone: 'positive' }),
      expect.objectContaining({ label: 'Перенесён дедлайн', value: '0', delta: '—', deltaTone: 'neutral' }),
      expect.objectContaining({ label: 'Закрыто задач', value: '60', delta: '+25%', deltaTone: 'positive' }),
      expect.objectContaining({ label: 'Звонков на сделку', value: '2.5', delta: '+25%', deltaTone: 'positive' }),
      expect.objectContaining({ label: 'Задач на сделку', value: '4.0', delta: '0%', deltaTone: 'neutral' }),
    ])
    expect(scene.summaryRows).toEqual([
      expect.objectContaining({
        manager: 'Анна Петрова',
        createdTasks: '40',
        closedTasks: '32',
        outgoing: '17',
        successfulCalls: '12',
        otherOutgoing: '0',
        missedIncoming: '0',
        incoming: '8',
        noAnswer: '5',
        comparePoints: [
          {
            label: 'С1',
            values: ['32', '24', '12', '7', '2', '3', '0', '4'],
            deltas: ['+25%', '+33%', '+42%', '+71%', '-100%', '+67%', '0%', '+100%'],
          },
        ],
      }),
    ])
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        manager: 'Анна Петрова',
        avgCalls: '2.5',
        totalCalls: '25',
        avgClosedTasks: '3.2',
        totalClosedTasks: '32',
        stages: [
          expect.objectContaining({
            label: 'Звонок-знакомство',
            totalCalls: '16',
            callsPerDeal: '2.0',
            totalClosedTasks: '18',
            closedTasksAvg: '2.3',
          }),
        ],
      }),
    ])
    expect(scene.warnings).toContain('Перенос дедлайна пока отключен')
  })

  it('explains when calls exist but are not linked to deals for calls-per-deal KPI', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCalls: 12,
      totalIncomingCalls: 1,
      totalOutgoingCalls: 11,
      totalOtherOutgoingCalls: 3,
      totalConnectedCalls: 8,
      totalFailedCalls: 4,
      totalCallsOverThirtySeconds: 5,
      totalConnectedCallsOverThirtySeconds: 4,
      warnings: [],
      managerRows: [],
      comparisons: [],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })
    const callsPerDeal = scene.kpis.find((metric) => metric.label === 'Звонков на сделку')

    expect(callsPerDeal).toEqual({
      label: 'Звонков на сделку',
      value: '—',
      note: 'есть звонки, но они не привязаны к сделкам',
      delta: 'нет привязки',
      deltaTone: 'neutral',
    })
  })

  it('uses linked attraction calls for direct-only managers in dashboard call summary columns', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-06-15T00:00:00.000Z',
        to: '2026-06-21T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [
        {
          managerId: '118',
          managerName: 'Аделия Космасова',
          dealCount: 0,
          createdCount: 0,
          rescheduledCount: 0,
          closedCount: 0,
          meetingCount: 0,
          averageCreatedPerDeal: 0,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 0,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-06-15T00:00:00.000Z',
        to: '2026-06-21T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCalls: 3,
      totalIncomingCalls: 1,
      totalMissedIncomingCalls: 0,
      totalOutgoingCalls: 2,
      totalOtherOutgoingCalls: 0,
      totalConnectedCalls: 2,
      totalFailedCalls: 1,
      totalCallsOverThirtySeconds: 1,
      totalConnectedCallsOverThirtySeconds: 1,
      linkedDealCalls: {
        totalDealCount: 0,
        totalCalls: 0,
        incomingCalls: 0,
        missedIncomingCalls: 0,
        outgoingCalls: 0,
        otherOutgoingCalls: 0,
        connectedCalls: 0,
        failedCalls: 0,
        callsOverThirtySeconds: 0,
        connectedCallsOverThirtySeconds: 0,
        averageDurationSeconds: 0,
      },
      warnings: [],
      managerRows: [
        {
          managerId: '118',
          managerName: 'Аделия Космасова',
          callAttributionPolicy: 'direct_only',
          dealCount: 0,
          totalCalls: 3,
          incomingCalls: 1,
          missedIncomingCalls: 0,
          outgoingCalls: 2,
          otherOutgoingCalls: 0,
          connectedCalls: 2,
          failedCalls: 1,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 1,
          averageCallsPerDeal: 0,
          averageDurationSeconds: 39.33,
          allCalls: {
            totalCalls: 3,
            incomingCalls: 1,
            missedIncomingCalls: 0,
            outgoingCalls: 2,
            otherOutgoingCalls: 0,
            connectedCalls: 2,
            failedCalls: 1,
            callsOverThirtySeconds: 1,
            connectedCallsOverThirtySeconds: 1,
            averageDurationSeconds: 39.33,
          },
          linkedDealCalls: {
            dealCount: 0,
            totalCalls: 0,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 0,
            otherOutgoingCalls: 0,
            connectedCalls: 0,
            failedCalls: 0,
            callsOverThirtySeconds: 0,
            connectedCallsOverThirtySeconds: 0,
            averageDurationSeconds: 0,
            averageCallsPerDeal: 0,
            stageBreakdown: [],
          },
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })

    expect(scene.summaryRows).toEqual([
      expect.objectContaining({
        manager: 'Аделия Космасова',
        outgoing: '0',
        successfulCalls: '0',
        otherOutgoing: '0',
        noAnswer: '0',
        missedIncoming: '0',
        incoming: '0',
      }),
    ])
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        manager: 'Аделия Космасова',
        totalCalls: '0',
        avgCalls: '0.0',
      }),
    ])
  })

  it('carries manager hourly heatmaps into activity summary rows', () => {
    const createdTasksHourlyHeatmap = {
      basis: { key: 'created_tasks' as const, label: 'Созданные задачи' },
      hours: [9],
      weekdays: [{ weekday: 1 as const, label: 'Пн' }],
      cells: [{ weekday: 1 as const, weekdayLabel: 'Пн', hour: 9, count: 2, intensity: 5 }],
      total: 2,
      gridTotal: 2,
      outsideGridTotal: 0,
      peak: { weekday: 1 as const, weekdayLabel: 'Пн', hour: 9, count: 2, intensity: 5 },
    }
    const closedTasksHourlyHeatmap = {
      basis: { key: 'closed_tasks' as const, label: 'Закрытые задачи' },
      hours: [9],
      weekdays: [{ weekday: 1 as const, label: 'Пн' }],
      cells: [{ weekday: 1 as const, weekdayLabel: 'Пн', hour: 9, count: 1, intensity: 5 }],
      total: 1,
      gridTotal: 1,
      outsideGridTotal: 0,
      peak: { weekday: 1 as const, weekdayLabel: 'Пн', hour: 9, count: 1, intensity: 5 },
    }
    const meetingsHourlyHeatmap = {
      basis: { key: 'meetings' as const, label: 'Встречи' },
      hours: [15],
      weekdays: [{ weekday: 2 as const, label: 'Вт' }],
      cells: [{ weekday: 2 as const, weekdayLabel: 'Вт', hour: 15, count: 1, intensity: 5 }],
      total: 1,
      gridTotal: 1,
      outsideGridTotal: 0,
      peak: { weekday: 2 as const, weekdayLabel: 'Вт', hour: 15, count: 1, intensity: 5 },
    }
    const callsHourlyHeatmap = {
      basis: { key: 'outgoing_calls' as const, label: 'Исходящие звонки' },
      hours: [10],
      weekdays: [{ weekday: 3 as const, label: 'Ср' }],
      cells: [{ weekday: 3 as const, weekdayLabel: 'Ср', hour: 10, count: 2, intensity: 5 }],
      total: 2,
      gridTotal: 2,
      outsideGridTotal: 0,
      peak: { weekday: 3 as const, weekdayLabel: 'Ср', hour: 10, count: 2, intensity: 5 },
    }
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 1,
      totalCreatedCount: 1,
      totalRescheduledCount: 0,
      totalClosedCount: 1,
      totalMeetingCount: 1,
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
          meetingCount: 1,
          averageCreatedPerDeal: 1,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1,
          averageMeetingsPerDeal: 1,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          meetingBusinessClubBreakdown: [],
          createdTasksHourlyHeatmap,
          closedTasksHourlyHeatmap,
          meetingsHourlyHeatmap,
          slaMetrics: [],
          stageBreakdown: [],
        },
      ],
    }
    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
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

    const scene = mapActivitiesCallsSceneData({ activities, calls })

    expect(scene.summaryRows[0]?.createdTasksHourlyHeatmap).toEqual(
      createdTasksHourlyHeatmap,
    )
    expect(scene.summaryRows[0]?.closedTasksHourlyHeatmap).toEqual(
      closedTasksHourlyHeatmap,
    )
    expect(scene.summaryRows[0]?.callsHourlyHeatmap).toEqual(callsHourlyHeatmap)
  })

  it('shows when direct-only attribution excludes contact fallback calls from the calls-per-deal KPI', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 5,
      totalCreatedCount: 10,
      totalRescheduledCount: 0,
      totalClosedCount: 8,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 5,
      totalCalls: 13,
      totalIncomingCalls: 0,
      totalOutgoingCalls: 13,
      totalOtherOutgoingCalls: 3,
      totalConnectedCalls: 10,
      totalFailedCalls: 3,
      totalCallsOverThirtySeconds: 7,
      totalConnectedCallsOverThirtySeconds: 7,
      linkedDealCalls: {
        totalDealCount: 5,
        totalCalls: 10,
        incomingCalls: 0,
        outgoingCalls: 10,
        otherOutgoingCalls: 2,
        connectedCalls: 8,
        failedCalls: 2,
        callsOverThirtySeconds: 6,
        connectedCallsOverThirtySeconds: 6,
        averageDurationSeconds: 90,
        excludedByPolicyCalls: {
          totalCalls: 3,
          incomingCalls: 0,
          outgoingCalls: 3,
          otherOutgoingCalls: 1,
          connectedCalls: 2,
          failedCalls: 1,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 1,
          averageDurationSeconds: 45,
        },
      },
      warnings: [],
      managerRows: [],
      comparisons: [],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })
    const callsPerDeal = scene.kpis.find((metric) => metric.label === 'Звонков на сделку')

    expect(callsPerDeal).toEqual(
      expect.objectContaining({
        value: '2.0',
        note: 'звонки по сделкам / сделки в выборке; исключено по direct-only: 3',
      }),
    )
  })

  it('shows direct-only exclusions even when there is no linked calls-per-deal base', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-06-15T00:00:00.000Z',
        to: '2026-06-21T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-06-15T00:00:00.000Z',
        to: '2026-06-21T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCalls: 3,
      totalIncomingCalls: 1,
      totalMissedIncomingCalls: 0,
      totalOutgoingCalls: 2,
      totalOtherOutgoingCalls: 0,
      totalConnectedCalls: 2,
      totalFailedCalls: 1,
      totalCallsOverThirtySeconds: 1,
      totalConnectedCallsOverThirtySeconds: 1,
      linkedDealCalls: {
        totalDealCount: 0,
        totalCalls: 0,
        incomingCalls: 0,
        missedIncomingCalls: 0,
        outgoingCalls: 0,
        otherOutgoingCalls: 0,
        connectedCalls: 0,
        failedCalls: 0,
        callsOverThirtySeconds: 0,
        connectedCallsOverThirtySeconds: 0,
        averageDurationSeconds: 0,
        excludedByPolicyCalls: {
          totalCalls: 3,
          incomingCalls: 1,
          missedIncomingCalls: 0,
          outgoingCalls: 2,
          otherOutgoingCalls: 0,
          connectedCalls: 2,
          failedCalls: 1,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 1,
          averageDurationSeconds: 39.33,
        },
      },
      warnings: [],
      managerRows: [],
      comparisons: [],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })
    const callsPerDeal = scene.kpis.find((metric) => metric.label === 'Звонков на сделку')

    expect(callsPerDeal).toEqual(
      expect.objectContaining({
        value: '—',
        note: 'нет прямых связей; исключено по direct-only: 3',
      }),
    )
  })

  it('does not invent zero compare values when the comparison base is missing', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 4,
      totalCreatedCount: 12,
      totalRescheduledCount: 0,
      totalClosedCount: 6,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-30T00:00:00.000Z',
            to: '2026-04-05T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-30T00:00:00.000Z',
              to: '2026-04-05T23:59:59.999Z',
            },
            totalDealCount: 0,
            totalCreatedCount: 0,
            totalRescheduledCount: 0,
            totalClosedCount: 0,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: [],
          },
        },
      ],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 4,
      totalCalls: 8,
      totalIncomingCalls: 2,
      totalOutgoingCalls: 6,
      totalOtherOutgoingCalls: 1,
      totalConnectedCalls: 4,
      totalFailedCalls: 2,
      totalCallsOverThirtySeconds: 3,
      totalConnectedCallsOverThirtySeconds: 2,
      warnings: [],
      managerRows: [],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-30T00:00:00.000Z',
            to: '2026-04-05T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-30T00:00:00.000Z',
              to: '2026-04-05T23:59:59.999Z',
            },
            totalDealCount: 0,
            totalCalls: 0,
            totalIncomingCalls: 0,
            totalOutgoingCalls: 0,
            totalOtherOutgoingCalls: 0,
            totalConnectedCalls: 0,
            totalFailedCalls: 0,
            totalCallsOverThirtySeconds: 0,
            totalConnectedCallsOverThirtySeconds: 0,
            warnings: [],
            managerRows: [],
          },
        },
      ],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })

    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({
          label: 'Звонков на сделку',
          compare: 'пред. период: 0.0',
        }),
        expect.not.objectContaining({
          label: 'Задач на сделку',
          compare: 'пред. период: 0.0',
        }),
      ]),
    )
    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Звонков на сделку',
          delta: '—',
        }),
        expect.objectContaining({
          label: 'Задач на сделку',
          delta: '—',
        }),
      ]),
    )
  })

  it('maps cohort report into matrix rows, cycle buckets and breakdown slices', () => {
    const report: CohortConversionReport = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      totalCreatedDeals: 20,
      totalClosedDeals: 15,
      totalWonDeals: 10,
      closureMonths: ['2026-02', '2026-03', '2026-04', '2026-05'],
      relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
      breakdownRows: [
        {
          id: 'cohort:2026-01',
          level: 'cohort',
          parentId: null,
          cohortMonth: '2026-01',
          cohortLabel: '2026-01',
          sourceKey: null,
          sourceLabel: null,
          qualityKey: null,
          qualityLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 11,
          closedDeals: 8,
          wonDeals: 6,
          closedRate: 72.73,
          wonConversionRate: 54.55,
          averageDaysToClose: 53,
          averageDaysToWin: 49,
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 2, wonDeals: 2, closedRate: 18.18, wonConversionRate: 18.18 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 2, wonDeals: 2, closedRate: 18.18, wonConversionRate: 18.18 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 2, wonDeals: 1, closedRate: 18.18, wonConversionRate: 9.09 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 2, wonDeals: 2, closedRate: 18.18, wonConversionRate: 18.18 },
          ],
        },
        {
          id: 'source:2026-01/WEB',
          level: 'source',
          parentId: 'cohort:2026-01',
          cohortMonth: '2026-01',
          cohortLabel: '2026-01',
          sourceKey: 'WEB',
          sourceLabel: 'Платный поиск',
          qualityKey: null,
          qualityLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 10,
          closedDeals: 8,
          wonDeals: 6,
          closedRate: 80,
          wonConversionRate: 60,
          averageDaysToClose: 53,
          averageDaysToWin: 49,
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
          ],
        },
        {
          id: 'source:2026-01/NO_WINS',
          level: 'source',
          parentId: 'cohort:2026-01',
          cohortMonth: '2026-01',
          cohortLabel: '2026-01',
          sourceKey: 'NO_WINS',
          sourceLabel: 'Без продаж',
          qualityKey: null,
          qualityLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 1,
          closedDeals: 0,
          wonDeals: 0,
          closedRate: 0,
          wonConversionRate: 0,
          averageDaysToClose: 0,
          averageDaysToWin: 0,
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
          ],
        },
      ],
      rows: [
        {
          createdMonth: '2026-01',
          createdDeals: 10,
          closedDeals: 8,
          wonDeals: 6,
          closedRate: 80,
          wonConversionRate: 60,
          averageDaysToClose: 53,
          averageDaysToWin: 49,
          closureBuckets: [
            { closedMonth: '2026-01', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { closedMonth: '2026-02', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { closedMonth: '2026-03', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
            { closedMonth: '2026-04', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
          ],
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
          ],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-01T00:00:00.000Z',
            to: '2026-03-31T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-01T00:00:00.000Z',
              to: '2026-03-31T23:59:59.999Z',
            },
            totalCreatedDeals: 16,
            totalClosedDeals: 11,
            totalWonDeals: 8,
            closureMonths: ['2026-01', '2026-02', '2026-03'],
            relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
            breakdownRows: [],
            rows: [
              {
                createdMonth: '2025-12',
                createdDeals: 8,
                closedDeals: 6,
                wonDeals: 4,
                closedRate: 75,
                wonConversionRate: 50,
                averageDaysToClose: 58,
                averageDaysToWin: 54,
                closureBuckets: [],
                relativeClosureBuckets: [
                  { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
                  { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 2, wonDeals: 1, closedRate: 25, wonConversionRate: 12.5 },
                  { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
                  { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 2, wonDeals: 1, closedRate: 25, wonConversionRate: 12.5 },
                ],
              },
            ],
          },
        },
      ],
    }

    const scene = mapCohortSceneData({
      report,
      managerBreakdowns: [
        {
          key: '7',
          label: 'Анна Петрова',
          report: {
            totalCreatedDeals: 10,
            totalClosedDeals: 8,
            totalWonDeals: 6,
            rows: report.rows,
          },
        },
      ],
      sourceBreakdowns: [],
    })

    expect(scene.range).toEqual(report.range)
    expect(scene.kpis).toEqual([
      { label: 'Средняя когортная конверсия', value: '60%', note: 'среднее по когортам за год' },
      { label: 'В 1 месяц', value: '20%', note: 'среднее по когортам за год' },
      { label: 'Во 2 месяц', value: '20%', note: 'среднее по когортам за год' },
      { label: 'В 3 месяц', value: '10%', note: 'среднее по когортам за год' },
      { label: 'В 4+ месяц', value: '20%', note: 'среднее по когортам за год' },
      { label: 'Средний цикл', value: '49 дн.', note: 'среднее по выигранным сделкам за год' },
    ])
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        month: 'Январь 2026',
        createdDeals: '10',
        cells: [
          { value: '2', subvalue: '20%', level: 5 },
          { value: '2', subvalue: '20%', level: 5 },
          { value: '1', subvalue: '10%', level: 3 },
          { value: '2', subvalue: '20%', level: 5 },
        ],
        conversion: '60%',
        cycle: '49 дн.',
      }),
    ])
    expect(scene.distributionBuckets).toEqual([
      expect.objectContaining({ label: 'В 1 месяц', value: '20%' }),
      expect.objectContaining({ label: 'Во 2 месяц', value: '20%' }),
      expect.objectContaining({ label: 'В 3 месяц', value: '10%' }),
      expect.objectContaining({ label: 'В 4+ месяц', value: '20%' }),
    ])
    for (const bucket of scene.distributionBuckets) {
      expect(bucket).not.toHaveProperty('compare')
      expect(bucket).not.toHaveProperty('delta')
    }
    expect(scene.managerDistribution).toEqual([
      expect.objectContaining({
        manager: 'Анна Петрова',
        month1: '20%',
        month2: '20%',
        month3: '10%',
        tail: '20%',
      }),
    ])
    expect(scene.sourceDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          manager: 'Платный поиск',
          month1: '20%',
          month2: '20%',
          month3: '10%',
          tail: '20%',
        }),
      ]),
    )
    expect(scene.sourceBreakdownRows).toEqual([
      expect.objectContaining({
        id: 'cohort:2026-01',
        parentId: null,
        level: 'cohort',
        label: 'Январь 2026',
        createdDeals: '11',
        conversion: '54%',
        cycle: '49 дн.',
      }),
      expect.objectContaining({
        id: 'source:2026-01/WEB',
        parentId: 'cohort:2026-01',
        level: 'source',
        label: 'Платный поиск',
        createdDeals: '10',
        cells: [
          { value: '2', subvalue: '20%', level: 5 },
          { value: '2', subvalue: '20%', level: 5 },
          { value: '1', subvalue: '10%', level: 3 },
          { value: '2', subvalue: '20%', level: 5 },
        ],
        conversion: '60%',
        cycle: '49 дн.',
      }),
      expect.objectContaining({
        id: 'source:2026-01/NO_WINS',
        parentId: 'cohort:2026-01',
        level: 'source',
        label: 'Без продаж',
        createdDeals: '1',
        conversion: '0%',
        cycle: '—',
      }),
    ])
  })

  it('uses average cohort-row rates for annual cohort KPI cards without compare text', () => {
    const scene = mapCohortSceneData({
      report: {
        range: {
          from: '2025-05-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalCreatedDeals: 101,
        totalClosedDeals: 11,
        totalWonDeals: 11,
        closureMonths: [],
        relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
        breakdownRows: [],
        rows: [
          {
            createdMonth: '2026-03',
            createdDeals: 100,
            closedDeals: 10,
            wonDeals: 10,
            closedRate: 10,
            wonConversionRate: 10,
            averageDaysToClose: 30,
            averageDaysToWin: 30,
            closureBuckets: [],
            relativeClosureBuckets: [
              { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 5, wonDeals: 5, closedRate: 5, wonConversionRate: 5 },
              { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 3, wonDeals: 3, closedRate: 3, wonConversionRate: 3 },
              { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 1, wonDeals: 1, closedRate: 1, wonConversionRate: 1 },
              { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 1, wonDeals: 1, closedRate: 1, wonConversionRate: 1 },
            ],
          },
          {
            createdMonth: '2026-04',
            createdDeals: 1,
            closedDeals: 1,
            wonDeals: 1,
            closedRate: 100,
            wonConversionRate: 100,
            averageDaysToClose: 5,
            averageDaysToWin: 5,
            closureBuckets: [],
            relativeClosureBuckets: [
              { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 100, wonConversionRate: 100 },
              { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
              { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
              { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            ],
          },
        ],
      },
      managerBreakdowns: [
        {
          key: '78',
          label: 'Егоров Андрей',
          report: {
            totalCreatedDeals: 101,
            totalClosedDeals: 11,
            totalWonDeals: 11,
            rows: [
              {
                createdMonth: '2026-03',
                createdDeals: 100,
                closedDeals: 10,
                wonDeals: 10,
                closedRate: 10,
                wonConversionRate: 10,
                averageDaysToClose: 30,
                averageDaysToWin: 30,
                closureBuckets: [],
                relativeClosureBuckets: [
                  { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 5, wonDeals: 5, closedRate: 5, wonConversionRate: 5 },
                  { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 3, wonDeals: 3, closedRate: 3, wonConversionRate: 3 },
                  { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 1, wonDeals: 1, closedRate: 1, wonConversionRate: 1 },
                  { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 1, wonDeals: 1, closedRate: 1, wonConversionRate: 1 },
                ],
              },
              {
                createdMonth: '2026-04',
                createdDeals: 1,
                closedDeals: 1,
                wonDeals: 1,
                closedRate: 100,
                wonConversionRate: 100,
                averageDaysToClose: 5,
                averageDaysToWin: 5,
                closureBuckets: [],
                relativeClosureBuckets: [
                  { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 100, wonConversionRate: 100 },
                  { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
                  { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
                  { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
                ],
              },
            ],
          },
        },
      ],
      sourceBreakdowns: [],
    })

    expect(scene.kpis).toEqual([
      { label: 'Средняя когортная конверсия', value: '55%', note: 'среднее по когортам за год' },
      { label: 'В 1 месяц', value: '52%', note: 'среднее по когортам за год' },
      { label: 'Во 2 месяц', value: '1%', note: 'среднее по когортам за год' },
      { label: 'В 3 месяц', value: '<1%', note: 'среднее по когортам за год' },
      { label: 'В 4+ месяц', value: '<1%', note: 'среднее по когортам за год' },
      { label: 'Средний цикл', value: '28 дн.', note: 'среднее по выигранным сделкам за год' },
    ])
    expect(scene.distributionBuckets).toEqual([
      expect.objectContaining({ label: 'В 1 месяц', value: '52%' }),
      expect.objectContaining({ label: 'Во 2 месяц', value: '1%' }),
      expect.objectContaining({ label: 'В 3 месяц', value: '<1%' }),
      expect.objectContaining({ label: 'В 4+ месяц', value: '<1%' }),
    ])
    for (const bucket of scene.distributionBuckets) {
      expect(bucket).not.toHaveProperty('compare')
      expect(bucket).not.toHaveProperty('delta')
    }
    expect(scene.managerDistribution).toEqual([
      expect.objectContaining({
        manager: 'Егоров Андрей',
        month1: '52%',
        month2: '1%',
        month3: '<1%',
        tail: '<1%',
      }),
    ])
  })

  it('keeps recent-three-month cohort conversion and all source breakdowns visible', () => {
    const makeRow = (createdMonth: string, wonConversionRate: number) => ({
      createdMonth,
      createdDeals: 10,
      closedDeals: Math.round(wonConversionRate / 10),
      wonDeals: Math.round(wonConversionRate / 10),
      closedRate: wonConversionRate,
      wonConversionRate,
      averageDaysToClose: 20,
      averageDaysToWin: 20,
      closureBuckets: [],
      relativeClosureBuckets: [
        { bucketKey: 'month_1' as const, label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 10, wonConversionRate: 10 },
        { bucketKey: 'month_2' as const, label: 'Во 2 месяц', closedDeals: 1, wonDeals: 1, closedRate: 10, wonConversionRate: 10 },
        { bucketKey: 'month_3' as const, label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
        { bucketKey: 'month_4_plus' as const, label: 'В 4+ месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
      ],
    })
    const sourceBreakdowns = [
      ['paid', 'Платный поиск', 60],
      ['webinar', 'Вебинары', 50],
      ['partner', 'Партнёры', 40],
      ['organic', 'Органика', 30],
      ['event', 'Мероприятия', 20],
      ['referral', 'Рекомендации', 10],
      ['leadgen-us', 'Лидген US', 8],
      ['internal', 'Внутренняя база', 6],
    ].map(([key, label, totalCreatedDeals]) => ({
      key: String(key),
      label: String(label),
      report: {
        totalCreatedDeals: Number(totalCreatedDeals),
        totalClosedDeals: 1,
        totalWonDeals: 1,
        rows: [makeRow('2026-04', 10)],
      },
    }))

    const scene = mapCohortSceneData({
      report: {
        range: {
          from: '2025-05-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalCreatedDeals: 40,
        totalClosedDeals: 10,
        totalWonDeals: 10,
        closureMonths: [],
        relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
        breakdownRows: [],
        rows: [
          makeRow('2026-01', 10),
          makeRow('2026-02', 20),
          makeRow('2026-03', 30),
          makeRow('2026-04', 40),
        ],
      },
      managerBreakdowns: [],
      sourceBreakdowns,
    })

    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        { label: 'Средняя когортная конверсия', value: '25%', note: 'среднее по когортам за год' },
        { label: 'Средняя за 3 месяца', value: '30%', note: 'последние 3 когорты' },
      ]),
    )
    expect(scene.sourceDistribution.map((row) => row.manager)).toEqual(
      expect.arrayContaining(['Рекомендации', 'Лидген US', 'Внутренняя база']),
    )
  })

  it('formats sub-one-percent values without collapsing them to zero', () => {
    const scene = mapCohortSceneData({
      report: {
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalCreatedDeals: 200,
        totalClosedDeals: 1,
        totalWonDeals: 1,
        closureMonths: ['2026-04'],
        relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
        breakdownRows: [],
        rows: [
          {
            createdMonth: '2026-04',
            createdDeals: 200,
            closedDeals: 1,
            wonDeals: 1,
            closedRate: 0.5,
            wonConversionRate: 0.5,
            averageDaysToClose: 12,
            averageDaysToWin: 12,
            closureBuckets: [],
            relativeClosureBuckets: [
              { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 0.5, wonConversionRate: 0.5 },
              { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
              { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
              { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            ],
          },
        ],
        comparisons: [],
      },
      managerBreakdowns: [],
      sourceBreakdowns: [],
    })

    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Средняя когортная конверсия', value: '<1%' }),
        expect.objectContaining({ label: 'В 1 месяц', value: '<1%' }),
      ]),
    )
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        cells: [
          expect.objectContaining({ subvalue: '<1%' }),
          expect.objectContaining({ subvalue: '0%' }),
          expect.objectContaining({ subvalue: '0%' }),
          expect.objectContaining({ subvalue: '0%' }),
        ],
      }),
    ])
  })

  it('maps toc report into current and comparison stage tables with bottleneck summary', () => {
    const scene = mapTocFlowSceneData({
      report: {
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 40,
            movedNextDeals: 20,
            throughputPerDay: 0.91,
            queueEnd: 15,
            queueBufferDays: 16.48,
            averageStageDurationDays: 4.5,
          },
          {
            stageId: 'PROBLEM',
            stageName: 'Проблематизация',
            stageSemanticId: null,
            sortOrder: 20,
            enteredDeals: 28,
            movedNextDeals: 8,
            throughputPerDay: 0.36,
            queueEnd: 17,
            queueBufferDays: 47.22,
            averageStageDurationDays: 9.2,
          },
        ],
        bottleneck: {
          stageId: 'PROBLEM',
          stageName: 'Проблематизация',
          throughputPerDay: 0.36,
          queueEnd: 17,
          queueBufferDays: 47.22,
        },
        comparisons: [
          {
            compareIndex: 1,
            range: {
              from: '2026-03-01T00:00:00.000Z',
              to: '2026-03-31T23:59:59.999Z',
            },
            snapshot: {
              range: {
                from: '2026-03-01T00:00:00.000Z',
                to: '2026-03-31T23:59:59.999Z',
              },
              businessDays: 21,
              warnings: [],
              estimatedGainPerDay: null,
              rows: [
                {
                  stageId: 'CALL',
                  stageName: 'Звонок-знакомство',
                  stageSemanticId: null,
                  sortOrder: 10,
                  enteredDeals: 36,
                  movedNextDeals: 22,
                  throughputPerDay: 1.05,
                  queueEnd: 10,
                  queueBufferDays: 9.52,
                  averageStageDurationDays: 3.8,
                },
                {
                  stageId: 'PROBLEM',
                  stageName: 'Проблематизация',
                  stageSemanticId: null,
                  sortOrder: 20,
                  enteredDeals: 25,
                  movedNextDeals: 10,
                  throughputPerDay: 0.48,
                  queueEnd: 11,
                  queueBufferDays: 22.92,
                  averageStageDurationDays: 6.4,
                },
              ],
              bottleneck: {
                stageId: 'PROBLEM',
                stageName: 'Проблематизация',
                throughputPerDay: 0.48,
                queueEnd: 11,
                queueBufferDays: 22.92,
              },
            },
          },
        ],
      },
      managerBreakdowns: [
        {
          key: '78',
          label: 'Егоров Андрей',
          report: {
            rows: [
              {
                stageId: 'CALL',
                stageName: 'Звонок-знакомство',
                stageSemanticId: null,
                sortOrder: 10,
                enteredDeals: 10,
                movedNextDeals: 5,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
              {
                stageId: 'PROBLEM',
                stageName: 'Проблематизация',
                stageSemanticId: null,
                sortOrder: 20,
                enteredDeals: 4,
                movedNextDeals: 1,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
            ],
            comparisons: [
              {
                compareIndex: 1,
                range: {
                  from: '2026-03-01T00:00:00.000Z',
                  to: '2026-03-31T23:59:59.999Z',
                },
                snapshot: {
                  range: {
                    from: '2026-03-01T00:00:00.000Z',
                    to: '2026-03-31T23:59:59.999Z',
                  },
                  businessDays: 0,
                  warnings: [],
                  estimatedGainPerDay: null,
                  bottleneck: null,
                  rows: [
                    {
                      stageId: 'CALL',
                      stageName: 'Звонок-знакомство',
                      stageSemanticId: null,
                      sortOrder: 10,
                      enteredDeals: 12,
                      movedNextDeals: 7,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                    {
                      stageId: 'PROBLEM',
                      stageName: 'Проблематизация',
                      stageSemanticId: null,
                      sortOrder: 20,
                      enteredDeals: 5,
                      movedNextDeals: 2,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          key: '11234',
          label: 'Ромашова Ольга',
          report: {
            rows: [
              {
                stageId: 'CALL',
                stageName: 'Звонок-знакомство',
                stageSemanticId: null,
                sortOrder: 10,
                enteredDeals: 8,
                movedNextDeals: 6,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
              {
                stageId: 'PROBLEM',
                stageName: 'Проблематизация',
                stageSemanticId: null,
                sortOrder: 20,
                enteredDeals: 6,
                movedNextDeals: 3,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
            ],
            comparisons: [
              {
                compareIndex: 1,
                range: {
                  from: '2026-03-01T00:00:00.000Z',
                  to: '2026-03-31T23:59:59.999Z',
                },
                snapshot: {
                  range: {
                    from: '2026-03-01T00:00:00.000Z',
                    to: '2026-03-31T23:59:59.999Z',
                  },
                  businessDays: 0,
                  warnings: [],
                  estimatedGainPerDay: null,
                  bottleneck: null,
                  rows: [
                    {
                      stageId: 'CALL',
                      stageName: 'Звонок-знакомство',
                      stageSemanticId: null,
                      sortOrder: 10,
                      enteredDeals: 9,
                      movedNextDeals: 7,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                    {
                      stageId: 'PROBLEM',
                      stageName: 'Проблематизация',
                      stageSemanticId: null,
                      sortOrder: 20,
                      enteredDeals: 5,
                      movedNextDeals: 2,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    })

    expect(scene.kpis).toEqual([
      expect.objectContaining({ label: 'Сделок в работе', value: '32', delta: '+52%' }),
      expect.objectContaining({ label: 'Выход за период', value: '28', delta: '-12%', deltaTone: 'negative' }),
      expect.objectContaining({ label: 'Главное ограничение', value: 'Проблематизация' }),
      expect.objectContaining({ label: 'Средний WIP', value: '16' }),
      expect.objectContaining({ label: 'Средний цикл этапа', value: '6.9 дн.', delta: '+1.7 дн.', deltaTone: 'negative' }),
    ])
    expect(scene.currentStages).toEqual([
      expect.objectContaining({
        stage: 'Звонок-знакомство',
        entered: 40,
        throughputPerDay: 0.91,
        queueEnd: 15,
        avgCycleDays: 4.5,
      }),
      expect.objectContaining({
        stage: 'Проблематизация',
        note: 'Главное ограничение периода',
      }),
    ])
    expect(scene.compareStages).toEqual([
      expect.objectContaining({
        stage: 'Звонок-знакомство',
        throughputPerDay: 1.05,
      }),
      expect.objectContaining({
        stage: 'Проблематизация',
      }),
    ])
    expect(scene.focus).toEqual(
      expect.objectContaining({
        bottleneckStage: 'Проблематизация',
        compareBottleneckStage: 'Проблематизация',
        maxQueueStage: 'Проблематизация',
        throughputDropStage: 'Звонок-знакомство',
      }),
    )
    expect(scene.managerConversionRows).toEqual([
      {
        manager: 'Ромашова Ольга',
        averageConversion: '64%',
        stages: [
          { stage: 'Звонок-знакомство', conversion: '75%', volume: '6 / 8', level: 4 },
          { stage: 'Проблематизация', conversion: '50%', volume: '3 / 6', level: 3 },
        ],
      },
      {
        manager: 'Егоров Андрей',
        averageConversion: '42%',
        stages: [
          { stage: 'Звонок-знакомство', conversion: '50%', volume: '5 / 10', level: 3 },
          { stage: 'Проблематизация', conversion: '25%', volume: '1 / 4', level: 2 },
        ],
      },
    ])
    expect(scene.stableLeaders).toEqual([
      {
        stage: 'Звонок-знакомство',
        manager: 'Ромашова Ольга',
        conversion: '75%',
        volume: '6 / 8',
        compareConversion: '77%',
        compareVolume: '7 / 9',
        stabilityLabel: 'Устойчив',
        stabilityTone: 'positive',
      },
      {
        stage: 'Проблематизация',
        manager: 'Ромашова Ольга',
        conversion: '50%',
        volume: '3 / 6',
        compareConversion: '40%',
        compareVolume: '2 / 5',
        stabilityLabel: 'Устойчив',
        stabilityTone: 'positive',
      },
    ])
  })

  it('excludes terminal funnel outcomes from toc capacity metrics', () => {
    const scene = mapTocFlowSceneData({
      report: {
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 40,
            movedNextDeals: 20,
            throughputPerDay: 0.91,
            queueEnd: 15,
            queueBufferDays: 16.48,
            averageStageDurationDays: 4.5,
          },
          {
            stageId: 'WON',
            stageName: 'Передано в клуб',
            stageSemanticId: 'S',
            sortOrder: 20,
            enteredDeals: 8,
            movedNextDeals: 0,
            throughputPerDay: 0.01,
            queueEnd: 99,
            queueBufferDays: 9900,
            averageStageDurationDays: 0,
          },
          {
            stageId: 'LOSE',
            stageName: 'Корзина',
            stageSemanticId: 'F',
            sortOrder: 30,
            enteredDeals: 4,
            movedNextDeals: 0,
            throughputPerDay: 0.01,
            queueEnd: 88,
            queueBufferDays: 8800,
            averageStageDurationDays: 0,
          },
          {
            stageId: 'RETURN',
            stageName: 'Возврат в Лидген(неквал)',
            stageSemanticId: 'F',
            sortOrder: 40,
            enteredDeals: 3,
            movedNextDeals: 0,
            throughputPerDay: 0.01,
            queueEnd: 77,
            queueBufferDays: 7700,
            averageStageDurationDays: 0,
          },
        ],
        bottleneck: {
          stageId: 'LOSE',
          stageName: 'Корзина',
          throughputPerDay: 0.01,
          queueEnd: 88,
          queueBufferDays: 8800,
        },
        comparisons: [],
      },
      managerBreakdowns: [],
    })

    expect(scene.currentStages.map((stage) => stage.stage)).toEqual(['Звонок-знакомство'])
    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Сделок в работе', value: '15' }),
        expect.objectContaining({ label: 'Главное ограничение', value: 'Звонок-знакомство' }),
      ]),
    )
    expect(scene.focus).toEqual(
      expect.objectContaining({
        bottleneckStage: 'Звонок-знакомство',
        maxQueueStage: 'Звонок-знакомство',
      }),
    )
  })
})
