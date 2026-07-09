import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient, ApiClientError } from '@/lib/api-client'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('marks incomplete source cohort trajectory payload as unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-30T23:59:59.999Z',
        },
        totalCreatedDeals: 1,
        totalWonDeals: 0,
        totalLostDeals: 0,
        totalOpenDeals: 1,
        winRate: 0,
        averageDaysToWin: 0,
        cohortMonths: [],
        rows: [],
        trajectoryStatus: 'available',
        trajectoryUnavailableReason: null,
        trajectory: {},
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getSourceCohortConversionReport({
      preset: 'custom',
      from: '2026-06-01',
      to: '2026-06-30',
    })

    expect(report.trajectoryStatus).toBe('unavailable')
    expect(report.trajectoryUnavailableReason).toBe('Траектория конверсии передана не полностью.')
    expect(report.trajectory).toBeUndefined()
  })

  it('does not expose trajectory when API marks it unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-06-01T00:00:00.000Z',
          to: '2026-06-30T23:59:59.999Z',
        },
        totalCreatedDeals: 1,
        totalWonDeals: 0,
        totalLostDeals: 0,
        totalOpenDeals: 1,
        winRate: 0,
        averageDaysToWin: 0,
        cohortMonths: [],
        rows: [],
        trajectoryStatus: 'unavailable',
        trajectoryUnavailableReason: 'Траектория отключена для этого ответа.',
        trajectory: {
          range: {
            from: '2026-06-01T00:00:00.000Z',
            to: '2026-06-30T23:59:59.999Z',
          },
          totalDeals: 1,
          stageNodes: [],
          stageTransitions: [],
          actionNodes: [],
          factSteps: [],
          conversionGaps: [],
          speedSteps: [],
          managerDiagnostics: [],
          managerRows: [],
          sourceRows: [],
          customerRows: [],
          overallSignals: {},
          dataQuality: {},
        },
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getSourceCohortConversionReport({
      preset: 'custom',
      from: '2026-06-01',
      to: '2026-06-30',
    })

    expect(report.trajectoryStatus).toBe('unavailable')
    expect(report.trajectoryUnavailableReason).toBe('Траектория отключена для этого ответа.')
    expect(report.trajectory).toBeUndefined()
  })

  it('normalizes stage timeline interaction summaries while preserving legacy fallbacks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        salesSummary: {
          salesCount: 1,
          salesAmount: 1000000,
          averageSaleAmount: 1000000,
          newDealsCount: 2,
          conversionRate: 50,
        },
        managerGroups: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            totalWonDeals: 1,
            totalSalesAmount: 1000000,
            totalAttractionRevenueAmount: 300000,
            averageAttractionRevenueAmount: 300000,
            totalMembershipAmount: 700000,
            averageMembershipAmount: 700000,
            deals: [
              {
                dealId: 'D-1',
                managerId: '78',
                managerName: 'Егоров Андрей',
                amount: 1000000,
                attractionRevenueAmount: 300000,
                membershipAmount: 700000,
                pricingStatus: 'priced',
                pricingWarnings: [],
                dateCreate: '2026-03-01T10:00:00.000Z',
                dateClosed: '2026-03-10T10:00:00.000Z',
                cycleDays: 9,
                cohortContext: {},
                callSummary: {},
                taskSummary: {},
                stageTimeline: [
                  {
                    stageId: 'C10:CALL',
                    stageName: 'Звонок-знакомство',
                    enteredAt: '2026-03-01T10:00:00.000Z',
                    leftAt: '2026-03-02T10:00:00.000Z',
                    durationHours: 24,
                    callSummary: {
                      total: 3,
                      incoming: 1,
                      outgoing: 2,
                      successful: 2,
                      failed: 1,
                      overThirtySeconds: 1,
                      connectedOverThirtySeconds: 1,
                    },
                    taskSummary: {
                      created: 2,
                      closed: 1,
                    },
                    meetingEvents: [
                      {
                        activityId: 'M-2',
                        createdAt: '2026-03-02T09:00:00.000Z',
                        timelineAt: '2026-03-02T10:00:00.000Z',
                        scheduledAt: '2026-03-02T10:00:00.000Z',
                        completed: false,
                        slotIndex: 2,
                        typeValue: 'Zoom',
                        placeValue: 'Офис К1',
                        calendarValue: null,
                        eventId: 'calendar-event-2',
                      },
                    ],
                  },
                  {
                    stageId: 'C10:LEGACY',
                    stageName: 'Старый ответ',
                    enteredAt: '2026-03-02T10:00:00.000Z',
                    leftAt: '2026-03-03T10:00:00.000Z',
                    durationHours: 24,
                  },
                ],
                lifecycleCard: {
                  dealId: 'D-1',
                  managerId: '78',
                  managerName: 'Егоров Андрей',
                  status: 'won',
                  stageId: 'C10:WON',
                  stageName: 'Передано в клуб',
                  dateCreate: '2026-03-01T10:00:00.000Z',
                  dateClosed: '2026-03-10T10:00:00.000Z',
                  dateModify: '2026-03-10T10:00:00.000Z',
                  cycleDays: 9,
                  sourceKey: 'LEADGEN_US',
                  sourceLabel: 'Лидген УС',
                  economics: {
                    revenueMode: 'actual',
                    attractionRevenueAmount: 300000,
                    membershipAmount: 700000,
                    saleCostAmount: 47000,
                    marginAmount: 253000,
                    costRows: [
                      {
                        id: 'lead:D-1:leadgen-ready-to-meet',
                        articleId: 'lead_purchase',
                        label: 'Лид',
                        amount: 40000,
                        basis: 'Созданная сделка источника/качества',
                        sourceSystem: 'rule',
                        confidence: 'inferred',
                      },
                    ],
                  },
                  eventSummary: {
                    callSummary: {
                      total: 1,
                      incoming: 0,
                      outgoing: 1,
                      successful: 1,
                      failed: 0,
                      overThirtySeconds: 1,
                      connectedOverThirtySeconds: 1,
                    },
                    taskSummary: {
                      created: 1,
                      closed: 1,
                    },
                    meetingSummary: { total: 0 },
                    conversionEventVisits: 1,
                  },
                  stageTimeline: [
                    {
                      stageId: 'C10:CALL',
                      stageName: 'Звонок-знакомство',
                      enteredAt: '2026-03-01T10:00:00.000Z',
                      leftAt: '2026-03-02T10:00:00.000Z',
                      durationHours: 24,
                      callSummary: {
                        total: 1,
                        incoming: 0,
                        outgoing: 1,
                        successful: 1,
                        failed: 0,
                        overThirtySeconds: 1,
                        connectedOverThirtySeconds: 1,
                      },
                      taskSummary: {
                        created: 1,
                        closed: 1,
                      },
                      meetingEvents: [],
                      events: [
                        {
                          id: 'conversion-event-visit:VISIT_1',
                          kind: 'conversion_event_visit',
                          occurredAt: '2026-03-02T09:00:00.000Z',
                          stageId: 'C10:CALL',
                          stageName: 'Звонок-знакомство',
                          title: 'Мероприятие: Гостевая встреча ClubFirst',
                          detail: 'пришел',
                          badgeLabel: 'Гостевая встреча ClubFirst · пришел',
                          linkConfidence: 'high',
                          payloadJson: '{"raw":"must not leak"}',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const dashboard = await apiClient.getDashboard({
      preset: 'custom',
      from: '2026-03-01T00:00:00.000+03:00',
      to: '2026-03-31T23:59:59.999+03:00',
    })

    expect(dashboard.managerGroups[0]?.deals[0]?.stageTimeline[0]).toMatchObject({
      callSummary: {
        total: 3,
        incoming: 1,
        outgoing: 2,
        successful: 2,
        failed: 1,
        overThirtySeconds: 1,
        connectedOverThirtySeconds: 1,
      },
      taskSummary: {
        created: 2,
        closed: 1,
      },
      meetingEvents: [
        expect.objectContaining({
          activityId: 'M-2',
          slotIndex: 2,
          typeValue: 'Zoom',
          placeValue: 'Офис К1',
          eventId: 'calendar-event-2',
        }),
      ],
    })
    expect(dashboard.managerGroups[0]?.deals[0]?.stageTimeline[1]).toMatchObject({
      callSummary: {
        total: 0,
        incoming: 0,
        outgoing: 0,
        successful: 0,
        failed: 0,
        overThirtySeconds: 0,
        connectedOverThirtySeconds: 0,
      },
      taskSummary: {
        created: 0,
        closed: 0,
      },
    })
    expect(dashboard.managerGroups[0]?.deals[0]?.lifecycleCard).toMatchObject({
      dealId: 'D-1',
      status: 'won',
      economics: {
        revenueMode: 'actual',
        saleCostAmount: 47000,
        marginAmount: 253000,
          costRows: [
            expect.objectContaining({
              id: 'lead:D-1:leadgen-ready-to-meet',
              articleId: 'lead_purchase',
              amount: 40000,
            }),
        ],
      },
      stageTimeline: [
        expect.objectContaining({
          events: [
            expect.objectContaining({
              id: 'conversion-event-visit:VISIT_1',
              badgeLabel: 'Гостевая встреча ClubFirst · пришел',
            }),
          ],
        }),
      ],
    })
    expect(
      dashboard.managerGroups[0]?.deals[0]?.lifecycleCard?.stageTimeline[0]
        ?.events[0],
    ).not.toHaveProperty('payloadJson')
  })

  it('loads and saves sales plan rows by report range', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-30T23:59:59.999+03:00',
          updatedAt: '2026-04-10T12:00:00.000Z',
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              plannedDeals: 3,
              plannedAmount: 2500000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-30T23:59:59.999+03:00',
          updatedAt: '2026-04-10T12:05:00.000Z',
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              plannedDeals: 4,
              plannedAmount: 3000000,
              updatedAt: '2026-04-10T12:05:00.000Z',
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const loaded = await apiClient.getSalesPlan({
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
    })

    const [loadUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedLoadUrl = new URL(loadUrl, window.location.origin)

    expect(parsedLoadUrl.pathname).toBe('/api/sales-plan')
    expect(parsedLoadUrl.searchParams.get('from')).toBe('2026-04-01T00:00:00.000+03:00')
    expect(parsedLoadUrl.searchParams.get('to')).toBe('2026-04-30T23:59:59.999+03:00')
    expect(loaded.rows[0]).toMatchObject({
      managerId: '78',
      targetGroupKey: 'ClubFirst Russia',
      plannedDeals: 3,
      plannedAmount: 2500000,
    })

    const saved = await apiClient.saveSalesPlan({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          plannedDeals: 4,
          plannedAmount: 3000000,
        },
      ],
    })

    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toEqual({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          plannedDeals: 4,
          plannedAmount: 3000000,
        },
      ],
    })
    expect(saved.updatedAt).toBe('2026-04-10T12:05:00.000Z')
    expect(saved.rows[0]?.plannedAmount).toBe(3000000)
  })

  it('loads unit economics report and saves unit economics cost rules', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          range: {
            from: '2026-04-01T00:00:00.000Z',
            to: '2026-04-30T23:59:59.999Z',
          },
          summary: {
            createdDeals: '3',
            wonDeals: 2,
            purchasedLeads: 2,
            attractionRevenue: 600000,
            clubRevenue: 2000000,
            leadPurchaseCost: 80000,
            eventCost: 0,
            ambassadorActivityCost: 0,
            ctuCertificateCost: 0,
            contractationCost: 10000,
            otherVariableCost: 0,
            variableCosts: 90000,
            contributionResult: 510000,
            contributionMargin: 0.85,
            aboveEbitdaCosts: 91500,
            ebitda: 418500,
            ebitdaMargin: 0.6975,
            belowEbitdaCosts: 0,
            netProfit: 418500,
            netProfitMargin: 0.6975,
            attractionAverageCheck: 300000,
            clubAverageCheck: 1000000,
            costPerWonDeal: 90750,
            costPerCreatedDeal: 60500,
          },
          sourceQualityRows: [
            {
              sourceKey: 'LEADGEN_US',
              sourceLabel: 'Лидген УС',
              qualityValue: 'Готов к встрече',
              createdDeals: 2,
              wonDeals: 1,
              purchasedLeads: 2,
              attractionRevenue: 300000,
              clubRevenue: 1000000,
              leadPurchaseCost: 80000,
              contractationCost: 5000,
              variableCosts: 85000,
              financialResult: 215000,
              margin: 0.7167,
              warnings: [],
            },
          ],
          managerRows: [
            {
              managerId: '78',
              managerName: 'Мария Потапова',
              createdDeals: 2,
              wonDeals: 1,
              purchasedLeads: 2,
              attractionRevenue: 300000,
              clubRevenue: 1000000,
              leadPurchaseCost: 80000,
              eventCost: 0,
              ambassadorActivityCost: 0,
              ctuCertificateCost: 0,
              contractationCost: 5000,
              variableCosts: 85000,
              financialResult: 215000,
              margin: 0.7167,
              warnings: [],
              revenueRows: [
                {
                  clubLabel: 'ClubFirst One',
                  tariffLabel: 'Федеральный',
                  wonDeals: 1,
                  attractionRevenue: 300000,
                  clubRevenue: 1000000,
                },
              ],
              productionCostRows: [
                {
                  articleId: 'demo_events',
                  articleLabel: 'События',
                  productLabel: 'Гостевая встреча ClubFirst',
                  quantity: 1,
                  unitLabel: 'участник',
                  unitPrice: 15000,
                  percent: null,
                  amount: 15000,
                  basis: 'Посещенные мероприятия периода',
                  warnings: [],
                },
              ],
              directCostRows: [
                {
                  articleId: 'community_integrators_fixed',
                  articleLabel: 'Комьюнити-интеграторы',
                  productLabel: '120 000 оклад + 40% налог',
                  quantity: 1,
                  unitLabel: 'КИ',
                  unitPrice: 168000,
                  percent: null,
                  amount: 168000,
                  basis: 'Правило периода',
                  warnings: [],
                },
              ],
              taxAndFinanceRows: [
                {
                  articleId: 'ctg_finance_service',
                  articleLabel: 'Финансово-юридический сервис',
                  productLabel: '2% от общего дохода',
                  quantity: null,
                  unitLabel: null,
                  unitPrice: null,
                  percent: 2,
                  amount: 6000,
                  basis: 'Общий доход всех',
                  warnings: [],
                },
              ],
            },
          ],
          costRows: [],
          warnings: ['warning'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          articles: [],
          rules: [
            {
              id: 'leadgen-ready-to-meet',
              articleId: 'lead_purchase',
              pnlLevel: 'variable_contribution',
              costBehavior: 'variable',
              calculationMethod: 'amount_per_lead',
              unitPrice: 40000,
              percent: null,
              amount: null,
              sourceKey: 'LEADGEN_US',
              qualityValue: 'Готов к встрече',
              enabled: true,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
              sortOrder: 10,
            },
          ],
          eventParticipantMode: 'attended',
          updatedAt: '2026-06-02T08:00:00.000Z',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getUnitEconomicsReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      sourceKeys: ['LEADGEN_US'],
    })
    const saved = await apiClient.saveUnitEconomicsCostRules({
      eventParticipantMode: 'attended',
      rules: [
        {
          id: 'leadgen-ready-to-meet',
          articleId: 'lead_purchase',
          pnlLevel: 'variable_contribution',
          costBehavior: 'variable',
          calculationMethod: 'amount_per_lead',
          unitPrice: 40000,
          percent: null,
          amount: null,
          sourceKey: 'LEADGEN_US',
          qualityValue: 'Готов к встрече',
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          sortOrder: 10,
        },
      ],
    })

    const [reportUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedReportUrl = new URL(reportUrl, window.location.origin)

    expect(parsedReportUrl.pathname).toBe('/api/reports/unit-economics')
    expect(parsedReportUrl.searchParams.get('sourceKeys')).toBe('LEADGEN_US')
    expect(report.summary.createdDeals).toBe(3)
    expect(report.summary.contributionMargin).toBe(0.85)
    expect(report.sourceQualityRows[0]).toMatchObject({
      sourceLabel: 'Лидген УС',
      qualityValue: 'Готов к встрече',
      financialResult: 215000,
    })
    expect(report.managerRows[0]).toMatchObject({
      managerName: 'Мария Потапова',
      purchasedLeads: 2,
      leadPurchaseCost: 80000,
      financialResult: 215000,
    })
    expect(report.managerRows[0]?.revenueRows[0]).toMatchObject({
      clubLabel: 'ClubFirst One',
      tariffLabel: 'Федеральный',
      clubRevenue: 1000000,
    })
    expect(report.managerRows[0]?.productionCostRows[0]).toMatchObject({
      articleId: 'demo_events',
      productLabel: 'Гостевая встреча ClubFirst',
      amount: 15000,
    })

    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toMatchObject({
      eventParticipantMode: 'attended',
    })
    expect(saved.rules[0]?.unitPrice).toBe(40000)
    expect(saved.eventParticipantMode).toBe('attended')
    expect(saved.updatedAt).toBe('2026-06-02T08:00:00.000Z')
  })

  it('returns a dashboard comment to development as a rework thread reply', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comment: {
          id: 'comment-1',
          moduleId: 'attraction',
          sceneId: 'sales',
          x: 0.25,
          y: 0.4,
          text: 'Дата встречи есть в атрибутах',
          status: 'open',
          archivedAt: null,
          createdAt: '2026-05-12T15:00:00.000Z',
          updatedAt: '2026-05-12T16:00:00.000Z',
          paperclipIssueId: 'issue-143570',
          paperclipIssueIdentifier: 'BIT-6',
          paperclipStatus: 'in_work',
          paperclipSyncStatus: 'sent',
          paperclipError: null,
          paperclipLastSyncedAt: '2026-05-12T16:00:00.000Z',
          paperclipRetryCount: 0,
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const client = apiClient as typeof apiClient & {
      reworkComment(id: string, input: { text: string }): Promise<{
        comment: {
          id: string
          paperclipStatus?: string
          paperclipSyncStatus?: string
        }
      }>
    }
    const result = await client.reworkComment('comment-1', {
      text: 'Покажите предупреждение: дата встречи раньше создания сделки',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(new URL(url, window.location.origin).pathname).toBe('/api/comments/comment-1/rework')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'Покажите предупреждение: дата встречи раньше создания сделки',
    })
    expect(result.comment.id).toBe('comment-1')
    expect(result.comment.paperclipStatus).toBe('in_work')
    expect(result.comment.paperclipSyncStatus).toBe('sent')
  })

  it('normalizes Paperclip ready reports on comments and notifications', async () => {
    const readyReport = {
      id: 'paperclip-comment-ready',
      body: '## Готово к проверке\n\n- Проверено: web vitest.',
      authorAgentId: 'agent-1',
      authorUserId: null,
      createdAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:01:00.000Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-1',
              moduleId: 'attraction',
              sceneId: 'sales',
              x: 0.25,
              y: 0.4,
              text: 'Проверить готовую доработку',
              status: 'open',
              archivedAt: null,
              createdAt: '2026-05-12T15:00:00.000Z',
              updatedAt: '2026-05-13T12:00:00.000Z',
              paperclipIssueId: 'issue-143570',
              paperclipIssueIdentifier: 'BIT-6',
              paperclipStatus: 'done',
              paperclipSyncStatus: 'sent',
              paperclipError: null,
              paperclipReadyReport: readyReport,
            },
          ],
          updatedAt: '2026-05-13T12:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            {
              id: 'comment-1',
              sceneId: 'sales',
              text: 'Проверить готовую доработку',
              status: 'done',
              paperclipSyncStatus: 'sent',
              paperclipIssueIdentifier: 'BIT-6',
              paperclipError: null,
              updatedAt: '2026-05-13T12:00:00.000Z',
              paperclipReadyReport: readyReport,
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const comments = await apiClient.getComments()
    const notifications = await apiClient.getCommentNotifications()

    expect(comments.comments[0]?.paperclipReadyReport).toEqual(readyReport)
    expect(notifications.notifications[0]?.paperclipReadyReport?.body).toContain(
      'Проверено: web vitest',
    )
  })

  it('keeps failed rework response payload on ApiClientError', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({
        code: 'PAPERCLIP_REWORK_FAILED',
        comment: {
          id: 'comment-1',
          moduleId: 'attraction',
          sceneId: 'sales',
          x: 0.25,
          y: 0.4,
          text: 'Дата встречи есть в атрибутах',
          status: 'open',
          archivedAt: null,
          createdAt: '2026-05-12T15:00:00.000Z',
          updatedAt: '2026-05-12T16:05:00.000Z',
          paperclipIssueId: 'issue-143570',
          paperclipIssueIdentifier: 'BIT-6',
          paperclipStatus: 'failed',
          paperclipSyncStatus: 'failed',
          paperclipError: 'Paperclip issue comment failed.',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    let caught: unknown = null
    try {
      await apiClient.reworkComment('comment-1', {
        text: 'Покажите предупреждение в таймлайне',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiClientError)
    expect(caught).toMatchObject({
      message: 'PAPERCLIP_REWORK_FAILED',
      status: 502,
      payload: expect.objectContaining({
        comment: expect.objectContaining({
          id: 'comment-1',
          paperclipStatus: 'failed',
          paperclipSyncStatus: 'failed',
        }),
      }),
    })
  })

  it('loads effective and quarterly sales plans', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-07T23:59:59.999+03:00',
          updatedAt: '2026-04-10T12:00:00.000Z',
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              plannedDeals: 2,
              plannedAmount: 1166667,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          year: 2026,
          quarter: 2,
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-06-30T23:59:59.999+03:00',
          months: [
            {
              month: '2026-04',
              label: 'Апрель',
              periodStart: '2026-04-01T00:00:00.000+03:00',
              periodEnd: '2026-04-30T23:59:59.999+03:00',
            },
            {
              month: '2026-05',
              label: 'Май',
              periodStart: '2026-05-01T00:00:00.000+03:00',
              periodEnd: '2026-05-31T23:59:59.999+03:00',
            },
            {
              month: '2026-06',
              label: 'Июнь',
              periodStart: '2026-06-01T00:00:00.000+03:00',
              periodEnd: '2026-06-30T23:59:59.999+03:00',
            },
          ],
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              quarterPlannedDeals: 9,
              quarterPlannedAmount: 9000000,
              months: [
                {
                  month: '2026-04',
                  periodStart: '2026-04-01T00:00:00.000+03:00',
                  periodEnd: '2026-04-30T23:59:59.999+03:00',
                  plannedDeals: 3,
                  plannedAmount: 3000000,
                  updatedAt: '2026-04-10T12:00:00.000Z',
                },
              ],
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
          updatedAt: '2026-04-10T12:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          year: 2026,
          quarter: 2,
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-06-30T23:59:59.999+03:00',
          months: [],
          rows: [],
          updatedAt: '2026-04-10T12:05:00.000Z',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const effective = await apiClient.getEffectiveSalesPlan({
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-07T23:59:59.999+03:00',
    })
    const [effectiveUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedEffectiveUrl = new URL(effectiveUrl, window.location.origin)

    expect(parsedEffectiveUrl.pathname).toBe('/api/sales-plan/effective')
    expect(effective.rows[0]?.plannedDeals).toBe(2)
    expect(effective.rows[0]?.plannedAmount).toBe(1166667)

    const quarter = await apiClient.getSalesPlanQuarter({ year: 2026, quarter: 2 })
    const [quarterUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
    const parsedQuarterUrl = new URL(quarterUrl, window.location.origin)

    expect(parsedQuarterUrl.pathname).toBe('/api/sales-plan/quarter')
    expect(parsedQuarterUrl.searchParams.get('year')).toBe('2026')
    expect(parsedQuarterUrl.searchParams.get('quarter')).toBe('2')
    expect(quarter.months.map((month) => month.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    expect(quarter.rows[0]?.quarterPlannedDeals).toBe(9)

    await apiClient.saveSalesPlanQuarter({
      year: 2026,
      quarter: 2,
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000,
          months: [
            { month: '2026-04', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-05', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-06', plannedDeals: 3, plannedAmount: 3000000 },
          ],
        },
      ],
    })

    const [, saveInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toMatchObject({
      year: 2026,
      quarter: 2,
      rows: [
        {
          managerId: '78',
          quarterPlannedDeals: 9,
          months: [
            { month: '2026-04', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-05', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-06', plannedDeals: 3, plannedAmount: 3000000 },
          ],
        },
      ],
    })
  })

  it('serializes compare ranges and normalizes comparison snapshots', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
              totalDealCount: 2,
              totalCreatedCount: 5,
              totalRescheduledCount: 0,
              totalClosedCount: 2,
              totalMeetingCount: 1,
              warnings: ['reschedule disabled'],
              conversionEventRows: [
                {
                  eventKey: 'E1',
                  eventName: 'Бизнес-диалог: Виктор Найшуллер, 28.05',
                  eventDate: '2026-05-28T00:00:00.000Z',
                  invitedCount: 8,
                  attendedCount: 0,
                  refusedCount: 8,
                  waitingCount: 0,
                  stageBreakdown: [
                    { stageId: 'C10:UC_61CBCU', stageName: 'Активация', invitedCount: 5 },
                    {
                      stageId: 'C10:UC_9E0XYG',
                      stageName: 'Встреча-знакомство',
                      invitedCount: 1,
                    },
                  ],
                },
              ],
              managerRows: [],
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
              totalDealCount: 1,
              totalCreatedCount: 3,
              totalRescheduledCount: 0,
              totalClosedCount: 1,
              totalMeetingCount: 0,
              warnings: [],
              conversionEventRows: [],
              managerRows: [],
            },
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getActivitiesWorkloadReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['7', '9'],
      sourceKeys: ['WEB'],
      businessClubKeys: ['ClubFirst Russia'],
      targetGroupKeys: ['ClubFirst Future', 'ClubFirst Ladies'],
      compareRanges: [
        {
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-31T23:59:59.999Z',
        },
      ],
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.searchParams.get('from')).toBe('2026-04-01T00:00:00.000Z')
    expect(parsedUrl.searchParams.get('to')).toBe('2026-04-30T23:59:59.999Z')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('7,9')
    expect(parsedUrl.searchParams.get('sourceKeys')).toBe('WEB')
    expect(parsedUrl.searchParams.get('businessClubKeys')).toBe('ClubFirst Russia')
    expect(parsedUrl.searchParams.get('targetGroupKeys')).toBe(
      'ClubFirst Future,ClubFirst Ladies',
    )
    expect(parsedUrl.searchParams.get('compareFrom')).toBe(
      '2026-03-01T00:00:00.000Z',
    )
    expect(parsedUrl.searchParams.get('compareTo')).toBe(
      '2026-03-31T23:59:59.999Z',
    )

    expect(report.warnings).toEqual(['reschedule disabled'])
    expect(report.conversionEventRows).toEqual([
      {
        eventKey: 'E1',
        eventName: 'Бизнес-диалог: Виктор Найшуллер, 28.05',
        eventDate: '2026-05-28T00:00:00.000Z',
        invitedCount: 8,
        attendedCount: 0,
        refusedCount: 8,
        waitingCount: 0,
        stageBreakdown: [
          { stageId: 'C10:UC_61CBCU', stageName: 'Активация', invitedCount: 5 },
          {
            stageId: 'C10:UC_9E0XYG',
            stageName: 'Встреча-знакомство',
            invitedCount: 1,
          },
        ],
      },
    ])
    expect(report.comparisons).toEqual([
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
            totalDealCount: 1,
            totalCreatedCount: 3,
            totalRescheduledCount: 0,
            totalClosedCount: 1,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: [],
          },
      },
    ])
  })

  it('preserves activities workload manager hourly heatmaps', async () => {
    const createdTasksHourlyHeatmap = {
      basis: { key: 'created_tasks', label: 'Созданные задачи' },
      hours: [9, 10],
      weekdays: [
        { weekday: 1, label: 'Пн' },
        { weekday: 2, label: 'Вт' },
      ],
      cells: [
        {
          weekday: 1,
          weekdayLabel: 'Пн',
          hour: 9,
          count: 2,
          intensity: 5,
          segments: [
            { key: 'created_tasks', label: 'Созданные задачи', count: 2, intensity: 5 },
          ],
        },
        { weekday: 2, weekdayLabel: 'Вт', hour: 10, count: 0, intensity: 0 },
      ],
      total: 3,
      gridTotal: 2,
      outsideGridTotal: 1,
      peak: { weekday: 1, weekdayLabel: 'Пн', hour: 9, count: 2, intensity: 5 },
    }
    const tasksHourlyHeatmap = {
      basis: { key: 'tasks', label: 'Задачи' },
      hours: [9, 10],
      weekdays: [
        { weekday: 1, label: 'Пн' },
        { weekday: 2, label: 'Вт' },
      ],
      cells: [
        {
          weekday: 1,
          weekdayLabel: 'Пн',
          hour: 9,
          count: 4,
          intensity: 5,
          segments: [
            { key: 'created_tasks', label: 'Созданные задачи', count: 2, intensity: 5 },
            { key: 'closed_tasks', label: 'Закрытые задачи', count: 2, intensity: 5 },
          ],
        },
        { weekday: 2, weekdayLabel: 'Вт', hour: 10, count: 0, intensity: 0 },
      ],
      total: 5,
      gridTotal: 4,
      outsideGridTotal: 1,
      peak: { weekday: 1, weekdayLabel: 'Пн', hour: 9, count: 4, intensity: 5 },
    }
    const closedTasksHourlyHeatmap = {
      basis: { key: 'closed_tasks', label: 'Закрытые задачи' },
      hours: [9, 10],
      weekdays: [
        { weekday: 1, label: 'Пн' },
        { weekday: 2, label: 'Вт' },
      ],
      cells: [
        { weekday: 1, weekdayLabel: 'Пн', hour: 9, count: 2, intensity: 5 },
        { weekday: 2, weekdayLabel: 'Вт', hour: 10, count: 0, intensity: 0 },
      ],
      total: 2,
      gridTotal: 2,
      outsideGridTotal: 0,
      peak: { weekday: 1, weekdayLabel: 'Пн', hour: 9, count: 2, intensity: 5 },
    }
    const meetingsHourlyHeatmap = {
      basis: { key: 'meetings', label: 'Встречи' },
      hours: [15],
      weekdays: [{ weekday: 3, label: 'Ср' }],
      cells: [
        {
          weekday: 3,
          weekdayLabel: 'Ср',
          hour: 15,
          count: 3,
          intensity: 5,
          segments: [
            { key: 'meeting_slot_1', label: 'Встреча 1', count: 1, intensity: 5 },
            { key: 'meeting_slot_2', count: 1, intensity: 5 },
            { key: 'meeting_slot_3', label: 'Встреча 3', count: 1, intensity: 5 },
          ],
        },
      ],
      total: 3,
      gridTotal: 3,
      outsideGridTotal: 0,
      peak: {
        weekday: 3,
        weekdayLabel: 'Ср',
        hour: 15,
        count: 3,
        intensity: 5,
        segments: [
          { key: 'meeting_slot_1', label: 'Встреча 1', count: 1, intensity: 5 },
          { key: 'meeting_slot_2', count: 1, intensity: 5 },
          { key: 'meeting_slot_3', label: 'Встреча 3', count: 1, intensity: 5 },
        ],
      },
    }
    const expectedMeetingsHourlyHeatmap = {
      ...meetingsHourlyHeatmap,
      cells: [
        {
          ...meetingsHourlyHeatmap.cells[0],
          segments: [
            { key: 'meeting_slot_1', label: 'Встреча 1', count: 1, intensity: 5 },
            { key: 'meeting_slot_2', label: 'Встреча 2', count: 1, intensity: 5 },
            { key: 'meeting_slot_3', label: 'Встреча 3', count: 1, intensity: 5 },
          ],
        },
      ],
      peak: {
        ...meetingsHourlyHeatmap.peak,
        segments: [
          { key: 'meeting_slot_1', label: 'Встреча 1', count: 1, intensity: 5 },
          { key: 'meeting_slot_2', label: 'Встреча 2', count: 1, intensity: 5 },
          { key: 'meeting_slot_3', label: 'Встреча 3', count: 1, intensity: 5 },
        ],
      },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalDealCount: 1,
        totalCreatedCount: 2,
        totalRescheduledCount: 0,
        totalClosedCount: 1,
        totalMeetingCount: 1,
        warnings: [],
        conversionEventRows: [],
        managerRows: [
          {
            managerId: '7',
            managerName: 'Анна Куратор',
            dealCount: 1,
            createdCount: 2,
            rescheduledCount: 0,
            closedCount: 1,
            meetingCount: 1,
            averageCreatedPerDeal: 2,
            averageRescheduledPerDeal: 0,
            averageClosedPerDeal: 1,
            averageMeetingsPerDeal: 1,
            meetingTypeBreakdown: [],
            businessClubBreakdown: [],
            meetingBusinessClubBreakdown: [],
            tasksHourlyHeatmap,
            createdTasksHourlyHeatmap,
            closedTasksHourlyHeatmap,
            meetingsHourlyHeatmap,
            slaMetrics: [],
            stageBreakdown: [],
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getActivitiesWorkloadReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
    })

    expect(report.managerRows[0]?.tasksHourlyHeatmap).toEqual(tasksHourlyHeatmap)
    expect(report.managerRows[0]?.createdTasksHourlyHeatmap).toEqual(
      createdTasksHourlyHeatmap,
    )
    expect(report.managerRows[0]?.closedTasksHourlyHeatmap).toEqual(
      closedTasksHourlyHeatmap,
    )
    expect(report.managerRows[0]?.meetingsHourlyHeatmap).toEqual(
      expectedMeetingsHourlyHeatmap,
    )
  })

  it('loads and normalizes conversion events report', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalInvitedCount: 10,
        totalConfirmedCount: 0,
        totalAttendedCount: 6,
        totalRefusedCount: 2,
        totalMissedCount: 4,
        attendanceRate: 60,
        nextStepEligibleCount: 6,
        nextStepCount: 3,
        nextStepRate: 50,
        warnings: ['Conversion event visit V5 is not linked to an attraction deal.'],
        rows: [
          {
            eventKey: '2026-04-29::Знакомство с клубом 29.04.',
            eventName: 'Знакомство с клубом 29.04.',
            eventDate: '2026-04-29T00:00:00.000Z',
            invitedCount: 10,
            confirmedCount: 0,
            attendedCount: 6,
            refusedCount: 2,
            missedCount: 4,
            attendanceRate: 60,
            nextStepEligibleCount: 6,
            nextStepCount: 3,
            nextStepRate: 50,
            unlinkedCount: 1,
            unknownStatusCount: 0,
            managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 6 }],
            sourceBreakdown: [{ key: 'WEB', label: 'Веб', count: 6 }],
            businessClubBreakdown: [{ key: 'ClubOne', label: 'ClubOne', count: 6 }],
          },
        ],
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getConversionEventsReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['78'],
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.pathname).toBe('/api/reports/conversion-events')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('78')
    expect(report.rows[0]).toMatchObject({
      eventName: 'Знакомство с клубом 29.04.',
      attendedCount: 6,
      attendanceRate: 60,
      nextStepRate: 50,
      managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 6 }],
    })
  })

  it('passes cohort breakdown mode through query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalCreatedDeals: 0,
        totalClosedDeals: 0,
        totalWonDeals: 0,
        closureMonths: [],
        relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
        rows: [],
        breakdownRows: [],
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.getCohortConversionReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['78'],
      includeBreakdown: false,
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.pathname).toBe('/api/reports/cohort-conversion')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('78')
    expect(parsedUrl.searchParams.get('includeBreakdown')).toBe('false')
  })

  it('loads and saves conversion event type settings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          options: [
            {
              id: '128',
              title: 'Гостевая встреча',
              categoryId: 34,
              stageId: null,
              selectedForPlannedInventory: true,
            },
          ],
          settings: [
            {
              moduleKey: 'attraction',
              eventTypeId: '128',
              eventTypeLabel: 'Гостевая встреча',
              enabled: true,
              updatedAt: '2026-05-24T10:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          options: [
            {
              id: '128',
              title: 'Гостевая встреча',
              categoryId: 34,
              stageId: null,
              selectedForPlannedInventory: true,
            },
          ],
          settings: [
            {
              moduleKey: 'attraction',
              eventTypeId: '128',
              eventTypeLabel: 'Гостевая встреча',
              enabled: true,
              updatedAt: '2026-05-24T10:05:00.000Z',
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const settings = await apiClient.getConversionEventTypeSettings()
    const saved = await apiClient.saveConversionEventTypeSettings({
      eventTypeIds: ['128'],
    })

    const [getUrl, getInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [saveUrl, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]

    expect(new URL(getUrl, window.location.origin).pathname).toBe(
      '/api/settings/conversion-event-types',
    )
    expect(getInit.method).toBe('GET')
    expect(new URL(saveUrl, window.location.origin).pathname).toBe(
      '/api/settings/conversion-event-types',
    )
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toEqual({
      eventTypeIds: ['128'],
    })
    expect(settings.options[0]).toMatchObject({
      id: '128',
      title: 'Гостевая встреча',
      categoryId: 34,
      selectedForPlannedInventory: true,
    })
    expect(saved.settings[0]).toMatchObject({
      moduleKey: 'attraction',
      eventTypeId: '128',
      eventTypeLabel: 'Гостевая встреча',
      enabled: true,
    })
  })

  it('loads and saves manager whitelist settings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          options: [
            {
              id: '13020',
              name: 'Илья Какулия',
            },
            {
              id: '7538',
              name: 'Мария Саличева',
              callAttributionPolicy: 'direct_only',
            },
          ],
          settings: [
            {
              moduleKey: 'attraction',
              managerId: '13020',
              managerName: 'Илья Какулия',
              enabled: true,
              sortOrder: 0,
              updatedAt: '2026-05-24T10:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          options: [
            {
              id: '13020',
              name: 'Илья Какулия',
            },
            {
              id: '7538',
              name: 'Мария Саличева',
              callAttributionPolicy: 'direct_only',
            },
          ],
          settings: [
            {
              moduleKey: 'attraction',
              managerId: '13020',
              managerName: 'Илья Какулия',
              enabled: true,
              sortOrder: 0,
              updatedAt: '2026-05-24T10:05:00.000Z',
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const settings = await apiClient.getManagerWhitelistSettings()
    const saved = await apiClient.saveManagerWhitelistSettings({
      managerIds: ['13020'],
    })

    const [getUrl, getInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [saveUrl, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]

    expect(new URL(getUrl, window.location.origin).pathname).toBe(
      '/api/settings/manager-whitelist',
    )
    expect(getInit.method).toBe('GET')
    expect(new URL(saveUrl, window.location.origin).pathname).toBe(
      '/api/settings/manager-whitelist',
    )
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toEqual({
      managerIds: ['13020'],
    })
    expect(settings.options[0]).toMatchObject({
      id: '13020',
      name: 'Илья Какулия',
    })
    expect(settings.options[1]).toMatchObject({
      id: '7538',
      name: 'Мария Саличева',
      callAttributionPolicy: 'direct_only',
    })
    expect(saved.options[1]).toMatchObject({
      id: '7538',
      callAttributionPolicy: 'direct_only',
    })
    expect(saved.settings[0]).toMatchObject({
      moduleKey: 'attraction',
      managerId: '13020',
      managerName: 'Илья Какулия',
      enabled: true,
    })
  })

  it('normalizes acquisition outcome reports defensively', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalNewDeals: 3,
        totalLostDeals: 1,
        newDealsByManager: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            totalNewDeals: 2,
            sources: [
              {
                sourceKey: 'WEB',
                sourceLabel: 'Сайт',
                totalNewDeals: 2,
                qualities: [{ qualityKey: 'A', qualityLabel: 'A', count: 2 }],
              },
            ],
          },
        ],
        lostDealsByManager: [],
        lostStages: [{ stageId: 'C10:LOSE', stageName: 'Корзина', count: 1 }],
        businessClubByManager: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            totalDeals: 2,
            businessClubs: [
              { businessClubKey: 'ClubOne', businessClubLabel: 'ClubOne', count: 2 },
            ],
            targetGroups: [
              { targetGroupKey: 'ClubFirst', targetGroupLabel: 'ClubFirst', count: 2 },
            ],
          },
        ],
        topLossReasons: [
          {
            stageId: 'C10:LOSE',
            stageName: 'Корзина',
            managerId: '78',
            managerName: 'Егоров Андрей',
            reasonKey: 'Клиенту не интересен формат',
            reasonLabel: 'Клиенту не интересен формат',
            count: 1,
          },
        ],
        lostDealDetails: [
          {
            dealId: 'D-1',
            managerId: '78',
            managerName: 'Егоров Андрей',
            sourceKey: 'WEB',
            sourceLabel: 'Сайт',
            businessClubValue: 'ClubOne',
            stageId: 'C10:LOSE',
            stageName: 'Корзина',
            reasonKey: 'Клиенту не интересен формат',
            reasonLabel: 'Клиенту не интересен формат',
            reasonDetail: 'Нет интереса',
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getAcquisitionOutcomesReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['78'],
      sourceKeys: ['WEB'],
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.pathname).toBe('/api/reports/acquisition-outcomes')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('78')
    expect(parsedUrl.searchParams.get('sourceKeys')).toBe('WEB')
    expect(report.totalNewDeals).toBe(3)
    expect(report.newDealsByManager[0]?.sources[0]?.qualities[0]).toEqual({
      qualityKey: 'A',
      qualityLabel: 'A',
      count: 2,
    })
    expect(report.lostStages).toEqual([
      { stageId: 'C10:LOSE', stageName: 'Корзина', count: 1 },
    ])
    expect(report.topLossReasons[0]?.reasonLabel).toBe('Клиенту не интересен формат')
    expect(report.businessClubByManager[0]?.businessClubs[0]).toEqual({
      businessClubKey: 'ClubOne',
      businessClubLabel: 'ClubOne',
      count: 2,
    })
    expect(report.businessClubByManager[0]?.targetGroups[0]).toEqual({
      targetGroupKey: 'ClubFirst',
      targetGroupLabel: 'ClubFirst',
      count: 2,
    })
    expect(report.lostDealDetails[0]?.reasonDetail).toBe('Нет интереса')
  })

  it('normalizes sync health from meta responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stageCatalog: [],
        managerCatalog: [
          {
            id: '7538',
            name: 'Мария Саличева',
            callAttributionPolicy: 'direct_only',
          },
        ],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: {
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18,
        },
        syncHealth: {
          status: 'blocked',
          blocking: true,
          checkedAt: '2026-04-10T12:00:00.000Z',
          lastSuccessfulSync: null,
          issues: [
            {
              code: 'MISSING_COVERAGE',
              severity: 'blocking',
              message: 'Нет покрытия',
            },
          ],
          warnings: ['Нет покрытия'],
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.getMeta()).resolves.toMatchObject({
      syncHealth: {
        status: 'blocked',
        blocking: true,
        warnings: ['Нет покрытия'],
        issues: [
          {
            code: 'MISSING_COVERAGE',
            severity: 'blocking',
            message: 'Нет покрытия',
          },
        ],
      },
      snapshotStats: {
        deals: 42,
        activities: 12,
        calls: 7,
        stageHistory: 18,
      },
      managerCatalog: [
        {
          id: '7538',
          name: 'Мария Саличева',
          callAttributionPolicy: 'direct_only',
        },
      ],
    })
  })

  it('loads and normalizes the attraction sync journal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        runs: [
          {
            id: 42,
            startedAt: '2026-06-03T06:00:00.000Z',
            finishedAt: '2026-06-03T06:01:00.000Z',
            durationMs: 60000,
            status: 'success',
            mode: 'delta',
            modifiedAfter: '2026-06-03T05:00:00.000Z',
            scopeKey: 'category:10:assigned:78',
            leadsSynced: 0,
            dealsSynced: 4,
            dealBreakdown: {
              total: 4,
              created: 1,
              updated: 2,
              closed: 1,
              reopened: 0,
              unchanged: 0,
            },
            diagnostics: ['activityBindingError=Error'],
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.getSyncRuns({ limit: 5 })).resolves.toEqual({
      runs: [
        {
          id: 42,
          startedAt: '2026-06-03T06:00:00.000Z',
          finishedAt: '2026-06-03T06:01:00.000Z',
          durationMs: 60000,
          status: 'success',
          mode: 'delta',
          modifiedAfter: '2026-06-03T05:00:00.000Z',
          scopeKey: 'category:10:assigned:78',
          leadsSynced: 0,
          dealsSynced: 4,
          dealBreakdown: {
            total: 4,
            created: 1,
            updated: 2,
            closed: 1,
            reopened: 0,
            unchanged: 0,
          },
          diagnostics: ['activityBindingError=Error'],
        },
      ],
    })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(url, window.location.origin)
    expect(parsedUrl.pathname).toBe('/api/sync-runs')
    expect(parsedUrl.searchParams.get('limit')).toBe('5')
  })

  it('loads and normalizes attraction ontology data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        moduleKey: 'attraction',
        title: 'Онтология Привлечения',
        governance: {
          decisionRole: 'Технолог бизнес-процессов',
          decisionUnit: 'Центр Технологизации',
        },
        lastReviewedAt: '2026-05-29',
        sources: [
          {
            id: 'regulation_incoming_leads',
            label: 'Регламент обработки входящих лидов',
            kind: 'google-doc',
            href: 'https://docs.google.com/document/d/example/edit',
            canonicality: 'supporting',
          },
        ],
        concepts: [
          {
            id: 'incoming_base',
            type: 'stage',
            label: 'База входящая',
            status: 'needs-sync',
            definition: 'Входящий этап.',
            not: ['факт покупки'],
            bitrix: {
              categoryId: '10',
              stageId: 'C10:NEW',
            },
            sourceIds: ['regulation_incoming_leads'],
            reportBindingIds: ['attraction-funnel-flow'],
          },
        ],
        transitions: [
          {
            id: 'incoming_to_intro_call_manual',
            label: 'База входящая -> Звонок-знакомство',
            status: 'confirmed',
            fromConceptId: 'incoming_base',
            toConceptId: 'intro_call',
            definition: 'Ручное принятие.',
            trigger: 'Перевод этапа.',
            sourceIds: ['regulation_incoming_leads'],
            reportBindingIds: ['attraction-funnel-flow'],
          },
        ],
        reportBindings: [
          {
            id: 'attraction-funnel-flow',
            label: 'Поток стадий',
            sceneId: 'sales',
            blockId: 'attraction-funnel-flow',
            href: '#attraction-funnel-flow',
          },
        ],
        drift: [
          {
            kind: 'stage',
            severity: 'warning',
            label: 'Новый этап',
            message: 'Стадии нет в онтологии.',
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const ontology = await apiClient.getAttractionOntology()

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(requestUrl, window.location.origin).pathname).toBe('/api/ontology')
    expect(ontology).toMatchObject({
      moduleKey: 'attraction',
      governance: {
        decisionRole: 'Технолог бизнес-процессов',
        decisionUnit: 'Центр Технологизации',
      },
      sources: [
        {
          id: 'regulation_incoming_leads',
          kind: 'google-doc',
        },
      ],
      concepts: [
        {
          id: 'incoming_base',
          status: 'needs-sync',
          bitrix: {
            categoryId: '10',
            stageId: 'C10:NEW',
          },
        },
      ],
      drift: [
        {
          severity: 'warning',
          label: 'Новый этап',
        },
      ],
    })
  })

  it('uses module-aware ontology paths outside attraction', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Онтология Привлечения',
        governance: {},
        sources: [],
        concepts: [],
        transitions: [],
        reportBindings: [],
        drift: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.getAttractionOntology('leadgen')

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(requestUrl, window.location.origin).pathname).toBe(
      '/api/modules/leadgen/ontology',
    )
  })

  it('loads and normalizes an attraction ontology source document', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        moduleKey: 'attraction',
        source: {
          id: 'module_ontology',
          label: 'MODULE_ONTOLOGY.md',
          kind: 'markdown',
          href: 'docs/modules/attraction/MODULE_ONTOLOGY.md',
          canonicality: 'canonical',
        },
        content: '# Онтология модуля «Привлечение»',
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const document = await (
      apiClient as typeof apiClient & {
        getAttractionOntologySourceDocument(sourceId: string): Promise<{
          moduleKey: 'attraction'
          source: { id: string; href: string }
          content: string
        }>
      }
    ).getAttractionOntologySourceDocument('module_ontology')

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(requestUrl, window.location.origin).pathname).toBe(
      '/api/ontology/sources/module_ontology',
    )
    expect(document).toMatchObject({
      moduleKey: 'attraction',
      source: {
        id: 'module_ontology',
        href: 'docs/modules/attraction/MODULE_ONTOLOGY.md',
      },
      content: '# Онтология модуля «Привлечение»',
    })
  })

  it('normalizes sync summary counters and snapshot stats', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        syncRunId: 18,
        leadsSynced: 0,
        dealsSynced: 5,
        mode: 'delta',
        modifiedAfter: '2026-04-08T00:00:00.000Z',
        finishedAt: '2026-04-08T12:00:00.000Z',
        snapshotBefore: {
          deals: 40,
          activities: 10,
          calls: 5,
          stageHistory: 16,
        },
        snapshotAfter: {
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18,
        },
        changes: {
          deals: 5,
          activities: 2,
          calls: 2,
          stageHistory: 2,
          managers: 1,
        },
        diagnostics: ['dealCursor=2026-04-08T12:00:00.000Z'],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.triggerSync()).resolves.toMatchObject({
      syncRunId: 18,
      dealsSynced: 5,
      snapshotAfter: {
        deals: 42,
        activities: 12,
        calls: 7,
        stageHistory: 18,
      },
      changes: {
        deals: 5,
        activities: 2,
        calls: 2,
        stageHistory: 2,
        managers: 1,
      },
    })
  })

  it('streams sync progress events when a progress callback is provided', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'event: progress\ndata: {"syncRunId":18,"phase":"fetch_deals","progress":35,"message":"Получено обновлений сделок: 5"}\n\n',
          ),
        )
        controller.enqueue(
          encoder.encode(
            'event: complete\ndata: {"syncRunId":18,"leadsSynced":0,"dealsSynced":5,"mode":"delta","modifiedAfter":null,"finishedAt":"2026-04-08T12:00:00.000Z","snapshotBefore":{"deals":40,"activities":10,"calls":5,"stageHistory":16},"snapshotAfter":{"deals":42,"activities":12,"calls":7,"stageHistory":18},"changes":{"deals":5,"activities":2,"calls":2,"stageHistory":2,"managers":1},"diagnostics":[]}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    })
    const progress = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    const summary = await apiClient.triggerSync(progress)

    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'fetch_deals',
        progress: 35,
        message: 'Получено обновлений сделок: 5',
      }),
    )
    expect(summary.syncRunId).toBe(18)
    expect(summary.changes.deals).toBe(5)
  })

  it('surfaces safe sync stream diagnostics from error events', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'event: error\ndata: {"error":"SYNC_FAILED","code":"SYNC_FAILED","details":{"diagnostics":["network=UND_ERR_CONNECT_TIMEOUT"]}}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.triggerSync(vi.fn())).rejects.toThrow(
      'SYNC_FAILED: network=UND_ERR_CONNECT_TIMEOUT',
    )
  })

  it('stores csrf in memory after auth and sends it only in request headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            login: 'admin',
            role: 'admin',
          },
          csrfToken: 'csrf-from-login',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: [],
          updatedAt: '2026-04-10T12:05:00.000Z',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.login({
      login: 'admin',
      password: 'correct-password',
    })
    await apiClient.savePricingSettings({ rules: [] })

    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]

    expect(new URL(loginUrl, window.location.origin).pathname).toBe(
      '/api/auth/login',
    )
    expect(loginInit.credentials).toBe('include')
    expect(String(loginInit.body)).toContain('correct-password')
    expect(window.localStorage.getItem('csrf-from-login')).toBeNull()
    expect(saveInit.credentials).toBe('include')
    expect(saveInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-login',
    })
  })

  it('sends csrf on streamed sync requests too', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'event: complete\ndata: {"syncRunId":18,"leadsSynced":0,"dealsSynced":5,"mode":"delta","modifiedAfter":null,"finishedAt":"2026-04-08T12:00:00.000Z","snapshotBefore":{"deals":40,"activities":10,"calls":5,"stageHistory":16},"snapshotAfter":{"deals":42,"activities":12,"calls":7,"stageHistory":18},"changes":{"deals":5,"activities":2,"calls":2,"stageHistory":2,"managers":1},"diagnostics":[]}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            login: 'admin',
            role: 'admin',
          },
          csrfToken: 'csrf-from-me',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.getCurrentUser()
    await apiClient.triggerSync(vi.fn())

    const [, syncInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(syncInit.headers).toMatchObject({
      Accept: 'text/event-stream',
      'X-CSRF-Token': 'csrf-from-me',
    })
  })

  it('creates dashboard comments and manages module users through the module API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 1,
            login: 'leader@example.com',
            role: 'admin',
            modules: [
              {
                id: 'attraction',
                slug: 'attraction',
                name: 'Привлечение',
                role: 'leader',
                permissions: ['comments:create', 'module-users:manage'],
                defaultManagerId: '13020',
              },
            ],
          },
          csrfToken: 'csrf-from-me',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'comment-1',
            moduleId: 'attraction',
            authorUserId: 1,
            authorLogin: 'leader@example.com',
            sceneId: 'sales',
            x: 0.25,
            y: 0.5,
            text: 'Проверь блок',
            status: 'open',
            archivedAt: null,
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:00:00.000Z',
            paperclipIssueId: 'issue-1',
            paperclipIssueIdentifier: 'BIT-1',
            paperclipStatus: 'sent',
            paperclipSyncStatus: 'sent',
            paperclipError: null,
            paperclipRetryCount: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            {
              id: 'comment-1',
              sceneId: 'sales',
              text: 'Проверь блок',
              status: 'in_work',
              paperclipSyncStatus: 'sent',
              paperclipIssueIdentifier: 'BIT-1',
              paperclipError: null,
              updatedAt: '2026-04-10T12:05:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 2,
            login: 'employee@example.com',
            disabled: false,
            moduleId: 'attraction',
            moduleRole: 'employee',
            membershipStatus: 'active',
            defaultManagerId: '13020',
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:00:00.000Z',
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const auth = await apiClient.getCurrentUser()
    const created = await apiClient.createComment({
      sceneId: 'sales',
      x: 0.25,
      y: 0.5,
      text: 'Проверь блок',
      context: {
        filters: {
          managers: ['78'],
        },
      },
    })
    const notifications = await apiClient.getCommentNotifications()
    const moduleUser = await apiClient.createModuleUser({
      login: 'employee@example.com',
      password: 'correct-password',
      role: 'employee',
      defaultManagerId: '13020',
    })

    expect(auth.user.modules[0]).toMatchObject({
      id: 'attraction',
      role: 'leader',
      permissions: ['comments:create', 'module-users:manage'],
      defaultManagerId: '13020',
    })
    expect(created.comment.paperclipStatus).toBe('sent')
    expect(notifications.notifications[0]?.status).toBe('in_work')
    expect(moduleUser.user.moduleRole).toBe('employee')
    expect(moduleUser.user.defaultManagerId).toBe('13020')

    const [, createCommentInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    const [notificationsUrl] = fetchMock.mock.calls[2] as [string, RequestInit]
    const [createUserUrl, createUserInit] = fetchMock.mock.calls[3] as [
      string,
      RequestInit,
    ]

    expect(new URL(notificationsUrl, window.location.origin).pathname).toBe(
      '/api/comment-notifications',
    )
    expect(createCommentInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-me',
    })
    expect(new URL(createUserUrl, window.location.origin).pathname).toBe(
      '/api/admin/module-users',
    )
    expect(createUserInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-me',
    })
    expect(JSON.parse(String(createUserInit.body))).toMatchObject({
      defaultManagerId: '13020',
    })
  })

  it('loads and updates platform module access for super admins', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 1,
            login: 'owner@example.com',
            role: 'admin',
            isSuperAdmin: true,
            modules: [
              {
                id: 'attraction',
                slug: 'attraction',
                name: 'Привлечение',
                role: 'leader',
                permissions: ['module-users:manage'],
              },
            ],
          },
          csrfToken: 'csrf-from-me',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          modules: [
            {
              id: 'attraction',
              slug: 'attraction',
              name: 'Привлечение',
            },
            {
              id: 'leadgen',
              slug: 'leadgen',
              name: 'Лидогенерация',
              bitrixCategoryId: '28',
            },
          ],
          users: [
            {
              id: 2,
              login: 'leader@example.com',
              firstName: 'Мария',
              lastName: 'Потапова',
              disabled: false,
              isSuperAdmin: false,
              memberships: [
                {
                  id: 2,
                  login: 'leader@example.com',
                  firstName: 'Мария',
                  lastName: 'Потапова',
                  disabled: false,
                  moduleId: 'attraction',
                  moduleRole: 'leader',
                  membershipStatus: 'active',
                  createdAt: '2026-04-10T12:00:00.000Z',
                  updatedAt: '2026-04-10T12:00:00.000Z',
                },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 2,
            login: 'leader@example.com',
            firstName: 'Мария',
            lastName: 'Потапова',
            disabled: false,
            isSuperAdmin: false,
            memberships: [
              {
                id: 2,
                login: 'leader@example.com',
                firstName: 'Мария',
                lastName: 'Потапова',
                disabled: false,
                moduleId: 'leadgen',
                moduleRole: 'employee',
                membershipStatus: 'active',
                createdAt: '2026-04-10T12:00:00.000Z',
                updatedAt: '2026-04-10T12:05:00.000Z',
              },
            ],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.getCurrentUser()
    const access = await apiClient.getPlatformAccess()
    const updated = await apiClient.updatePlatformUserMemberships(2, [
      {
        moduleId: 'leadgen',
        role: 'employee',
        status: 'active',
      },
    ])

    expect(access.modules.map((module) => module.id)).toEqual(['attraction', 'leadgen'])
    expect(access.users[0]).toMatchObject({
      id: 2,
      login: 'leader@example.com',
      memberships: [
        {
          moduleId: 'attraction',
          moduleRole: 'leader',
          membershipStatus: 'active',
        },
      ],
    })
    expect(updated.user.memberships[0]).toMatchObject({
      moduleId: 'leadgen',
      moduleRole: 'employee',
    })

    const [accessUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
    const [patchUrl, patchInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(new URL(accessUrl, window.location.origin).pathname).toBe(
      '/api/admin/platform/access',
    )
    expect(new URL(patchUrl, window.location.origin).pathname).toBe(
      '/api/admin/platform/users/2/module-memberships',
    )
    expect(patchInit.method).toBe('PATCH')
    expect(patchInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-me',
    })
    expect(JSON.parse(String(patchInit.body))).toEqual({
      memberships: [
        {
          moduleId: 'leadgen',
          role: 'employee',
          status: 'active',
        },
      ],
    })
  })

  it('uses module-aware API paths for leadgen comments, users, funnel, and workload reports', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          updatedAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stageCatalog: [],
          managerCatalog: [],
          sourceCatalog: [],
          wonStageIds: [],
          defaultPeriodDays: 30,
          lastSync: null,
          snapshotStats: {
            deals: 4140,
            activities: 306,
            calls: 119,
            stageHistory: 13166,
          },
          syncHealth: {
            status: 'ready',
            blocking: false,
            checkedAt: '2026-05-14T12:00:00.000Z',
            lastSuccessfulSync: null,
            issues: [],
            warnings: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          range: {
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-05-31T23:59:59.999Z',
          },
          totalDeals: 4,
          createdDeals: 3,
          activeDeals: 2,
          closedDeals: 1,
          stageRows: [
            {
              stageId: 'C28:NEW',
              stageName: 'Новый лид',
              sortOrder: 10,
              activeDeals: 2,
              createdDeals: 3,
              closedDeals: 0,
            },
          ],
          sourceRows: [],
          managerRows: [],
          reasonRows: [],
          warnings: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          range: {
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-05-31T23:59:59.999Z',
          },
          totalDealCount: 4,
          totalCreatedCount: 12,
          totalRescheduledCount: 0,
          totalClosedCount: 9,
          totalMeetingCount: 0,
          warnings: [],
          managerRows: [],
          comparisons: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          range: {
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-05-31T23:59:59.999Z',
          },
          totalDealCount: 4,
          totalCalls: 18,
          totalIncomingCalls: 2,
          totalOutgoingCalls: 16,
          totalOtherOutgoingCalls: 3,
          totalConnectedCalls: 12,
          totalFailedCalls: 4,
          totalCallsOverThirtySeconds: 10,
          totalConnectedCallsOverThirtySeconds: 9,
          warnings: [],
          managerRows: [],
          comparisons: [],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const query = {
      preset: 'custom' as const,
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.999Z',
      managerIds: ['501'],
    }

    await apiClient.getComments('leadgen')
    await apiClient.getModuleUsers('leadgen')
    await apiClient.getMeta('leadgen')
    const report = await apiClient.getLeadgenFunnelReport('leadgen', query)
    const activities = await apiClient.getLeadgenActivitiesWorkloadReport('leadgen', query)
    const calls = await apiClient.getLeadgenCallsWorkloadReport('leadgen', query)

    expect(report.totalDeals).toBe(4)
    expect(activities.totalCreatedCount).toBe(12)
    expect(calls.totalCalls).toBe(18)
    expect(report.stageRows[0]).toMatchObject({
      stageId: 'C28:NEW',
      stageName: 'Новый лид',
    })
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url), window.location.origin).pathname),
    ).toEqual([
      '/api/modules/leadgen/comments',
      '/api/modules/leadgen/admin/module-users',
      '/api/modules/leadgen/meta',
      '/api/modules/leadgen/reports/funnel',
      '/api/modules/leadgen/reports/activities-workload',
      '/api/modules/leadgen/reports/calls-workload',
    ])
  })

  it('normalizes call attribution policy diagnostics in calls workload reports', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-06-15T00:00:00.000Z',
          to: '2026-06-21T23:59:59.999Z',
        },
        totalDealCount: 1,
        totalCalls: 2,
        totalIncomingCalls: 0,
        totalMissedIncomingCalls: 0,
        totalOutgoingCalls: 2,
        totalOtherOutgoingCalls: 0,
        totalConnectedCalls: 2,
        totalFailedCalls: 0,
        totalCallsOverThirtySeconds: 2,
        totalConnectedCallsOverThirtySeconds: 2,
        linkedDealCalls: {
          totalDealCount: 1,
          totalCalls: 1,
          outgoingCalls: 1,
          connectedCalls: 1,
          excludedByPolicyCalls: {
            totalCalls: 1,
            outgoingCalls: 1,
            connectedCalls: 1,
          },
        },
        warnings: [],
        managerRows: [
          {
            managerId: '7538',
            managerName: 'Мария Саличева',
            callAttributionPolicy: 'direct_only',
            dealCount: 1,
            totalCalls: 2,
            outgoingCalls: 2,
            otherOutgoingCalls: 0,
            connectedCalls: 2,
            failedCalls: 0,
            callsOverThirtySeconds: 2,
            connectedCallsOverThirtySeconds: 2,
            averageCallsPerDeal: 1,
            averageDurationSeconds: 135,
            linkedDealCalls: {
              dealCount: 1,
              totalCalls: 1,
              outgoingCalls: 1,
              connectedCalls: 1,
              averageCallsPerDeal: 1,
              excludedByPolicyCalls: {
                totalCalls: 1,
                outgoingCalls: 1,
                connectedCalls: 1,
              },
              stageBreakdown: [],
            },
            stageBreakdown: [],
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const calls = await apiClient.getCallsWorkloadReport({
      preset: 'custom',
      from: '2026-06-15T00:00:00.000Z',
      to: '2026-06-21T23:59:59.999Z',
    })

    expect(calls.linkedDealCalls?.excludedByPolicyCalls?.totalCalls).toBe(1)
    expect(calls.managerRows[0]?.callAttributionPolicy).toBe('direct_only')
    expect(
      calls.managerRows[0]?.linkedDealCalls?.excludedByPolicyCalls?.outgoingCalls,
    ).toBe(1)
  })

  it('preserves calls workload manager hourly heatmaps', async () => {
    const callsHourlyHeatmap = {
      basis: { key: 'outgoing_calls', label: 'Исходящие звонки' },
      hours: [9, 21],
      weekdays: [
        { weekday: 1, label: 'Пн' },
        { weekday: 7, label: 'Вс' },
      ],
      cells: [
        {
          weekday: 1,
          weekdayLabel: 'Пн',
          hour: 9,
          count: 2,
          intensity: 5,
          segments: [
            {
              key: 'successful_outgoing_calls',
              label: 'Успешные >30 сек',
              count: 1,
              intensity: 5,
            },
            {
              key: 'other_outgoing_calls',
              label: 'Прочие исходящие',
              count: 1,
              intensity: 5,
            },
            {
              key: 'no_answer_outgoing_calls',
              label: 'Недозвоны',
              count: 0,
              intensity: 0,
            },
          ],
        },
        { weekday: 7, weekdayLabel: 'Вс', hour: 21, count: 1, intensity: 3 },
      ],
      total: 3,
      gridTotal: 3,
      outsideGridTotal: 0,
      peak: { weekday: 1, weekdayLabel: 'Пн', hour: 9, count: 2, intensity: 5 },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-06-15T00:00:00.000Z',
          to: '2026-06-21T23:59:59.999Z',
        },
        totalDealCount: 1,
        totalCalls: 3,
        totalIncomingCalls: 0,
        totalMissedIncomingCalls: 0,
        totalOutgoingCalls: 3,
        totalOtherOutgoingCalls: 0,
        totalConnectedCalls: 3,
        totalFailedCalls: 0,
        totalCallsOverThirtySeconds: 2,
        totalConnectedCallsOverThirtySeconds: 2,
        warnings: [],
        managerRows: [
          {
            managerId: '7538',
            managerName: 'Мария Саличева',
            dealCount: 1,
            totalCalls: 3,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 3,
            otherOutgoingCalls: 0,
            connectedCalls: 3,
            failedCalls: 0,
            callsOverThirtySeconds: 2,
            connectedCallsOverThirtySeconds: 2,
            averageCallsPerDeal: 3,
            averageDurationSeconds: 90,
            allCalls: {
              totalCalls: 3,
              incomingCalls: 0,
              missedIncomingCalls: 0,
              outgoingCalls: 3,
              otherOutgoingCalls: 0,
              connectedCalls: 3,
              failedCalls: 0,
              callsOverThirtySeconds: 2,
              connectedCallsOverThirtySeconds: 2,
              averageDurationSeconds: 90,
            },
            linkedDealCalls: {
              dealCount: 1,
              totalCalls: 3,
              incomingCalls: 0,
              missedIncomingCalls: 0,
              outgoingCalls: 3,
              otherOutgoingCalls: 0,
              connectedCalls: 3,
              failedCalls: 0,
              callsOverThirtySeconds: 2,
              connectedCallsOverThirtySeconds: 2,
              averageCallsPerDeal: 3,
              averageDurationSeconds: 90,
              stageBreakdown: [],
            },
            callsHourlyHeatmap,
            stageBreakdown: [],
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getCallsWorkloadReport({
      preset: 'custom',
      from: '2026-06-15T00:00:00.000Z',
      to: '2026-06-21T23:59:59.999Z',
    })

    expect(report.managerRows[0]?.callsHourlyHeatmap).toEqual(callsHourlyHeatmap)
  })

  it('runs and loads manual call analysis through the API client', async () => {
    const result = {
      callId: 'CALL1',
      runId: 'run-1',
      status: 'ready',
      transcriptByRoles: [
        {
          role: 'manager',
          start: 8,
          end: 16,
          text: 'Добрый день. Расскажите, что сейчас не устраивает?',
        },
      ],
      fullTranscriptText: 'Менеджер: Добрый день. Расскажите, что сейчас не устраивает?',
      aiEvaluation: {
        score: 76,
        callClassification: {
          type: 'qualification',
          confidence: 0.95,
          reason: 'Менеджер проводит квалификацию.',
        },
        rubricApplicability: {
          level: 'high',
          reason: 'Полный квалификационный звонок.',
        },
        communicationScore: {
          score: 96,
          rationale: 'Менеджер слушает и ведет разговор.',
          evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
        },
        narrativeScore: {
          score: 84,
          rationale: 'Часть нарративов раскрыта.',
          evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
          applicableNarratives: ['Квалификация объясняется уважительно'],
          missedNarratives: ['Club First не продается как календарь мероприятий'],
        },
        callTypeInterpretation: 'Первичный исходящий звонок.',
        summary: 'Менеджер выяснил базовую боль, но не закрепил следующий шаг датой.',
        strengths: ['Есть открытый вопрос'],
        risks: ['Следующий шаг без даты'],
        nextStepQuality: 'weak',
        suggestedNextStep: 'Назначить дату следующего контакта.',
        emotionalBackground: {
          managerTone: 'спокойный',
          clientTone: 'нейтральный',
          frictionSignals: ['нет конкретной даты'],
          confidence: 0.8,
        },
        evidenceQuotes: ['Тогда могу прислать материалы'],
        confidence: 0.82,
      },
      rawAiEvaluation: {
        score: '76',
        providerPayloadVersion: 'raw-calls-v2',
        nested: {
          kept: true,
        },
      },
      attributes: {
        managerName: 'Мария',
        dealId: '23841',
        stageAtCallName: 'Квалификация',
      },
      model: 'google/gemini-3.5-flash',
      promptVersion: 'calls-v2',
      analyzedAt: '2026-06-09T10:00:00.000Z',
      updatedAt: '2026-06-09T10:00:00.000Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          reusedExistingResult: false,
          result,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          result,
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const analyzed = await apiClient.analyzeCall('CALL1')
    const loaded = await apiClient.getCallAnalysis('CALL1')

    expect(analyzed.reusedExistingResult).toBe(false)
    expect(analyzed.result.aiEvaluation.score).toBe(76)
    expect(analyzed.result.aiEvaluation.callClassification).toMatchObject({
      type: 'qualification',
      confidence: 0.95,
    })
    expect(analyzed.result.aiEvaluation.rubricApplicability).toMatchObject({
      level: 'high',
    })
    expect(analyzed.result.aiEvaluation.communicationScore).toMatchObject({
      score: 96,
      rationale: 'Менеджер слушает и ведет разговор.',
    })
    expect(analyzed.result.aiEvaluation.narrativeScore.missedNarratives).toContain(
      'Club First не продается как календарь мероприятий',
    )
    expect(analyzed.result.rawAiEvaluation).toMatchObject({
      providerPayloadVersion: 'raw-calls-v2',
      nested: {
        kept: true,
      },
    })
    expect(analyzed.result.transcriptByRoles[0]).toMatchObject({
      role: 'manager',
      start: 8,
      end: 16,
    })
    expect(loaded.result.attributes).toMatchObject({
      managerName: 'Мария',
      stageAtCallName: 'Квалификация',
    })
    expect(loaded.result.rawAiEvaluation).toMatchObject({
      providerPayloadVersion: 'raw-calls-v2',
      nested: {
        kept: true,
      },
    })
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url), window.location.origin).pathname),
    ).toEqual(['/api/calls/CALL1/analyze', '/api/calls/CALL1/analysis'])
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.method).toBe('POST')
  })

  it('loads call analysis queue with filters and status metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-06-09T00:00:00.000+03:00',
          to: '2026-06-09T23:59:59.999+03:00',
        },
        totals: {
          total: 2,
          notAnalyzed: 1,
          analyzing: 0,
          ready: 1,
          error: 0,
          averageScore: 88,
        },
        items: [
          {
            callId: '221930',
            crmActivityId: 'A1',
            startedAt: '2026-06-09T08:40:00.000Z',
            managerId: '7',
            managerName: 'Мария',
            callType: 'outgoing_over_30',
            callTypeLabel: 'Исх >30',
            durationSeconds: 318,
            dealId: '23841',
            dealSourceId: 'LEADGEN_US',
            dealCurrentStageId: 'C10:NEW',
            dealCurrentStageName: 'Новая',
            stageAtCallId: 'C10:QUALIFICATION',
            stageAtCallName: 'Квалификация',
            analysisStatus: 'ready',
            score: 88,
            promptVersion: 'calls-v2',
            model: 'google/gemini-3.5-flash',
            analyzedAt: '2026-06-09T12:00:30.000Z',
            updatedAt: '2026-06-09T12:00:31.000Z',
            errorCode: null,
            errorMessage: null,
            bitrixUrl: 'https://example.bitrix24.ru/crm/deal/details/23841/',
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const queue = await apiClient.getCallAnalysisQueue({
      from: '2026-06-09T00:00:00.000+03:00',
      to: '2026-06-09T23:59:59.999+03:00',
      managerIds: ['7'],
      sourceKeys: ['LEADGEN_US'],
      stageIds: ['C10:QUALIFICATION'],
      callTypes: ['outgoing_over_30'],
      analysisStatuses: ['ready'],
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(url, window.location.origin)

    expect(init.method).toBe('GET')
    expect(parsedUrl.pathname).toBe('/api/calls/analysis-queue')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('7')
    expect(parsedUrl.searchParams.get('sourceKeys')).toBe('LEADGEN_US')
    expect(parsedUrl.searchParams.get('stageIds')).toBe('C10:QUALIFICATION')
    expect(parsedUrl.searchParams.get('callTypes')).toBe('outgoing_over_30')
    expect(parsedUrl.searchParams.get('analysisStatuses')).toBe('ready')
    expect(queue.totals).toMatchObject({
      total: 2,
      ready: 1,
      averageScore: 88,
    })
    expect(queue.items[0]).toMatchObject({
      callId: '221930',
      analysisStatus: 'ready',
      score: 88,
      stageAtCallName: 'Квалификация',
      bitrixUrl: 'https://example.bitrix24.ru/crm/deal/details/23841/',
    })
  })

  it('uses module-aware sync paths for non-attraction modules', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        syncRunId: 28,
        leadsSynced: 0,
        dealsSynced: 3,
        mode: 'delta',
        modifiedAfter: null,
        finishedAt: '2026-05-14T12:00:00.000Z',
        snapshotBefore: {
          deals: 0,
          activities: 0,
          calls: 0,
          stageHistory: 0,
        },
        snapshotAfter: {
          deals: 3,
          activities: 0,
          calls: 0,
          stageHistory: 0,
        },
        changes: {
          deals: 3,
          activities: 0,
          calls: 0,
          stageHistory: 0,
          managers: 1,
        },
        diagnostics: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.triggerSync('leadgen')).resolves.toMatchObject({
      syncRunId: 28,
      dealsSynced: 3,
    })

    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url), window.location.origin).pathname),
    ).toEqual(['/api/modules/leadgen/sync'])
  })
})
