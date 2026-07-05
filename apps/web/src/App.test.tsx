import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { apiClient } from '@/lib/api-client'
import type {
  ConversionEventTypeSettingsInput,
  DealPricingRuleInput,
  ManagerActionOutcomeReport,
  RevenueVelocityReport,
  SalesPlanQuarterInput,
  SourceCohortConversionReport,
} from '@/lib/dashboard-types'

const mockState = vi.hoisted(() => ({
  unauthorizedListener: null as null | (() => void),
}))

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number | undefined

    constructor(message: string, status?: number) {
      super(message)
      this.name = 'ApiClientError'
      this.status = status
    }
  },
  apiClient: {
    getCurrentUser: vi.fn(async () => ({
      user: {
        id: 1,
        login: 'admin',
        firstName: null,
        lastName: null,
        role: 'admin',
        modules: [],
      },
      csrfToken: 'csrf-token',
    })),
    login: vi.fn(async () => ({
      user: {
        id: 1,
        login: 'admin',
        firstName: null,
        lastName: null,
        role: 'admin',
        modules: [],
      },
      csrfToken: 'csrf-token',
    })),
    logout: vi.fn(async () => undefined),
    getCommentNotifications: vi.fn(async () => ({
      notifications: [],
    })),
    getModuleUsers: vi.fn(async () => ({
      users: [],
    })),
    onUnauthorized: vi.fn((listener: () => void) => {
      mockState.unauthorizedListener = listener
      return () => {
        if (mockState.unauthorizedListener === listener) {
          mockState.unauthorizedListener = null
        }
      }
    }),
    getMeta: vi.fn(async () => ({
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [],
      wonStageIds: [],
      defaultPeriodDays: 30,
      lastSync: null,
      snapshotStats: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
      },
      syncHealth: {
        status: 'ready',
        blocking: false,
        checkedAt: '2026-04-10T12:00:00.000Z',
        lastSuccessfulSync: null,
        issues: [],
        warnings: [],
      },
    })),
    getSyncRuns: vi.fn(async () => ({
      runs: [],
    })),
    getDashboard: vi.fn(async () => ({
      salesSummary: {
        salesCount: 0,
        salesAmount: 0,
        averageSaleAmount: 0,
        newDealsCount: 0,
        conversionRate: 0,
      },
      managerGroups: [],
      comparisons: [],
    })),
    getSourceCohortConversionReport: vi.fn(async () => ({
      range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
      totalCreatedDeals: 77,
      totalWonDeals: 1,
      totalLostDeals: 22,
      totalOpenDeals: 54,
      winRate: 1.3,
      averageDaysToWin: 11,
      cohortMonths: [
        { cohortMonth: '2024-12', cohortLabel: 'Декабрь 2024', totalCreatedDeals: 12 },
        { cohortMonth: '2025-01', cohortLabel: 'Январь 2025', totalCreatedDeals: 25 },
        { cohortMonth: '2026-04', cohortLabel: 'Апрель 2026', totalCreatedDeals: 42 },
        { cohortMonth: '2026-05', cohortLabel: 'Май 2026', totalCreatedDeals: 77 },
      ],
      rows: [
        {
          id: 'LIDGEN|3.1|ClubFirst Future',
          sourceKey: 'LIDGEN',
          sourceLabel: 'Лидген УС',
          qualityKey: '3.1',
          qualityLabel: '3.1 Готов ко встрече',
          customerKey: 'ClubFirst Future',
          customerLabel: 'ClubFirst Future',
          createdDeals: 38,
          wonDeals: 1,
          lostDeals: 16,
          openDeals: 21,
          winRate: 2.6,
          averageDaysToWin: 11,
          openStageBreakdown: [
            { stageId: 'C10:MEETING', stageName: 'Встреча-знакомство', openDeals: 6 },
            { stageId: 'C10:ACTIVATION', stageName: 'Активация', openDeals: 6 },
          ],
          targetGroupBreakdown: [
            {
              targetGroupKey: 'UNSPECIFIED',
              targetGroupLabel: 'Без таргет-группы',
              wonDeals: 1,
              averageDaysToWin: 11,
            },
          ],
          managerBreakdown: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              createdDeals: 20,
              wonDeals: 1,
              lostDeals: 8,
              openDeals: 11,
              winRate: 5,
              averageDaysToWin: 11,
              openStageBreakdown: [
                { stageId: 'C10:MEETING', stageName: 'Встреча-знакомство', openDeals: 4 },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })),
    getPricingSettings: vi.fn(async () => ({
      rules: [
        {
          id: 'clubfirst-federal',
          customerLabel: 'ClubFirst Russia / One',
          tariffLabel: 'Федеральный',
          attractionRevenueAmount: 300000,
          enabled: true,
          sortOrder: 10,
          updatedAt: null,
        },
      ],
      updatedAt: null,
    })),
    savePricingSettings: vi.fn(async (input: { rules: DealPricingRuleInput[] }) => ({
      rules: input.rules.map((rule: DealPricingRuleInput, index: number) => ({
        id: rule.id,
        customerLabel: rule.customerLabel,
        tariffLabel: rule.tariffLabel,
        attractionRevenueAmount: rule.attractionRevenueAmount,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder ?? index * 10,
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getConversionEventTypeSettings: vi.fn(async () => ({
      options: [],
      settings: [],
    })),
    saveConversionEventTypeSettings: vi.fn(
      async (input: ConversionEventTypeSettingsInput) => ({
        options: input.eventTypeIds.map((id) => ({
          id,
          title: id,
          categoryId: null,
          stageId: null,
          selectedForPlannedInventory: true,
        })),
        settings: input.eventTypeIds.map((id) => ({
          moduleKey: 'attraction',
          eventTypeId: id,
          eventTypeLabel: id,
          enabled: true,
          updatedAt: '2026-04-10T12:05:00.000Z',
        })),
      }),
    ),
    getManagerWhitelistSettings: vi.fn(async () => ({
      options: [],
      settings: [],
    })),
    saveManagerWhitelistSettings: vi.fn(async (input: { managerIds: string[] }) => ({
      options: input.managerIds.map((id) => ({
        id,
        name: id,
      })),
      settings: input.managerIds.map((id, index) => ({
        moduleKey: 'attraction',
        managerId: id,
        managerName: id,
        enabled: true,
        sortOrder: index * 10,
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
    })),
    getUnitEconomicsSettings: vi.fn(async () => ({
      articles: [],
      rules: [],
      eventParticipantMode: 'invited',
      updatedAt: null,
    })),
    saveUnitEconomicsCostRules: vi.fn(
      async (input: {
        rules: Array<Record<string, unknown>>
        eventParticipantMode?: 'invited' | 'attended'
      }) => ({
        articles: [],
        rules: input.rules,
        eventParticipantMode: input.eventParticipantMode ?? 'invited',
        updatedAt: '2026-04-10T12:05:00.000Z',
      }),
    ),
    getUnitEconomicsReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      summary: {
        createdDeals: 0,
        wonDeals: 0,
        purchasedLeads: 0,
        attractionRevenue: 0,
        clubRevenue: 0,
        leadPurchaseCost: 0,
        eventCost: 0,
        ambassadorActivityCost: 0,
        ctuCertificateCost: 0,
        contractationCost: 0,
        otherVariableCost: 0,
        variableCosts: 0,
        contributionResult: 0,
        contributionMargin: null,
        aboveEbitdaCosts: 0,
        ebitda: 0,
        ebitdaMargin: null,
        belowEbitdaCosts: 0,
        netProfit: 0,
        netProfitMargin: null,
        attractionAverageCheck: null,
        clubAverageCheck: null,
        costPerWonDeal: null,
        costPerCreatedDeal: null,
      },
      sourceQualityRows: [],
      costRows: [],
      warnings: [],
      comparisons: [],
    })),
    getSalesPlan: vi.fn(async () => ({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [],
      updatedAt: null,
    })),
    saveSalesPlan: vi.fn(async (input) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: [],
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getEffectiveSalesPlan: vi.fn(async () => ({
      periodStart: '2026-04-20T00:00:00.000+03:00',
      periodEnd: '2026-04-26T23:59:59.999+03:00',
      rows: [],
      updatedAt: null,
    })),
    getSalesPlanQuarter: vi.fn(async () => ({
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
      rows: [],
      updatedAt: null,
    })),
    saveSalesPlanQuarter: vi.fn(async (input: SalesPlanQuarterInput) => ({
      year: input.year,
      quarter: input.quarter,
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-06-30T23:59:59.999+03:00',
      months: [],
      rows: [],
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getActivitiesWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })),
    getCallsWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
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
      comparisons: [],
    })),
    getCallAnalysisQueue: vi.fn(async () => ({
      range: { from: '2026-06-09T00:00:00.000+03:00', to: '2026-06-09T23:59:59.999+03:00' },
      totals: {
        total: 0,
        notAnalyzed: 0,
        analyzing: 0,
        ready: 0,
        error: 0,
        averageScore: null,
      },
      items: [],
    })),
    getCallAnalysis: vi.fn(async () => {
      throw new Error('CALL_ANALYSIS_NOT_FOUND')
    }),
    analyzeCall: vi.fn(async () => {
      throw new Error('CALL_ANALYSIS_NOT_CONFIGURED')
    }),
    getAcquisitionOutcomesReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalNewDeals: 0,
      totalLostDeals: 0,
      newDealsByManager: [],
      lostDealsByManager: [],
      lostStages: [],
      businessClubByManager: [],
      topLossReasons: [],
      lostDealDetails: [],
      comparisons: [],
    })),
    getTargetGroupConversionReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      rows: [],
      comparisons: [],
    })),
    getManagerActionOutcomeReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      rows: [],
      cohortMonths: [],
      cohortStatusRows: [],
      comparisons: [],
    })),
    getConversionEventsReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalInvitedCount: 0,
      totalConfirmedCount: 0,
      totalAttendedCount: 0,
      totalRefusedCount: 0,
      totalMissedCount: 0,
      attendanceRate: null,
      nextStepEligibleCount: 0,
      nextStepCount: 0,
      nextStepRate: null,
      warnings: [],
      rows: [],
      comparisons: [],
    })),
    getCohortConversionReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 0,
      totalClosedDeals: 0,
      totalWonDeals: 0,
      closureMonths: [],
      relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
      rows: [],
      comparisons: [],
    })),
    getTocFlowReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      businessDays: 10,
      warnings: [],
      estimatedGainPerDay: null,
      rows: [
        {
          stageId: 'CALL',
          stageName: 'Звонок-знакомство',
          stageSemanticId: 'P',
          sortOrder: 1,
          enteredDeals: 10,
          movedNextDeals: 8,
          throughputPerDay: 1,
          queueEnd: 2,
          queueBufferDays: 2,
          averageStageDurationDays: 1.1,
        },
        {
          stageId: 'MEETING',
          stageName: 'Встреча-знакомство',
          stageSemanticId: 'P',
          sortOrder: 2,
          enteredDeals: 5,
          movedNextDeals: 4,
          throughputPerDay: 0.5,
          queueEnd: 1,
          queueBufferDays: 2,
          averageStageDurationDays: 1.4,
        },
        {
          stageId: 'CONTRACT',
          stageName: 'Контрактация',
          stageSemanticId: 'P',
          sortOrder: 3,
          enteredDeals: 3,
          movedNextDeals: 2,
          throughputPerDay: 0.3,
          queueEnd: 1,
          queueBufferDays: 3.3,
          averageStageDurationDays: 2.1,
        },
      ],
      bottleneck: {
        stageId: 'CONTRACT',
        stageName: 'Контрактация',
        throughputPerDay: 0.3,
        queueEnd: 1,
        queueBufferDays: 3.3,
      },
      stageDistribution: {
        totalCreatedDeals: 10,
        nodes: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            sortOrder: 1,
            dealCount: 10,
            shareOfCreatedDeals: 100,
          },
          {
            stageId: 'MEETING',
            stageName: 'Встреча-знакомство',
            sortOrder: 2,
            dealCount: 5,
            shareOfCreatedDeals: 50,
          },
          {
            stageId: 'CONTRACT',
            stageName: 'Контрактация',
            sortOrder: 3,
            dealCount: 3,
            shareOfCreatedDeals: 30,
          },
          {
            stageId: 'HANDOFF',
            stageName: 'На передаче',
            sortOrder: 4,
            dealCount: 2,
            shareOfCreatedDeals: 20,
          },
          {
            stageId: 'WON',
            stageName: 'Передано в клуб',
            sortOrder: 5,
            dealCount: 2,
            shareOfCreatedDeals: 20,
          },
        ],
        edges: [
          {
            fromStageId: null,
            fromStageName: null,
            toStageId: 'CALL',
            toStageName: 'Звонок-знакомство',
            dealCount: 10,
            conversionRate: 100,
          },
          {
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStageId: 'MEETING',
            toStageName: 'Встреча-знакомство',
            dealCount: 5,
            conversionRate: 50,
          },
          {
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStageId: 'CONTRACT',
            toStageName: 'Контрактация',
            dealCount: 3,
            conversionRate: 30,
          },
          {
            fromStageId: 'CONTRACT',
            fromStageName: 'Контрактация',
            toStageId: 'HANDOFF',
            toStageName: 'На передаче',
            dealCount: 2,
            conversionRate: 66.67,
          },
          {
            fromStageId: 'HANDOFF',
            fromStageName: 'На передаче',
            toStageId: 'WON',
            toStageName: 'Передано в клуб',
            dealCount: 2,
            conversionRate: 100,
          },
        ],
        routeNodes: [
          {
            step: 0,
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            sortOrder: 1,
            dealCount: 10,
            shareOfCreatedDeals: 100,
          },
          {
            step: 1,
            stageId: 'MEETING',
            stageName: 'Встреча-знакомство',
            sortOrder: 2,
            dealCount: 5,
            shareOfCreatedDeals: 50,
          },
          {
            step: 1,
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            sortOrder: 1,
            dealCount: 5,
            shareOfCreatedDeals: 50,
          },
          {
            step: 2,
            stageId: 'CONTRACT',
            stageName: 'Контрактация',
            sortOrder: 3,
            dealCount: 3,
            shareOfCreatedDeals: 30,
          },
          {
            step: 3,
            stageId: 'HANDOFF',
            stageName: 'На передаче',
            sortOrder: 4,
            dealCount: 2,
            shareOfCreatedDeals: 20,
          },
          {
            step: 4,
            stageId: 'WON',
            stageName: 'Передано в клуб',
            sortOrder: 5,
            dealCount: 2,
            shareOfCreatedDeals: 20,
          },
        ],
        routeEdges: [
          {
            fromStep: 0,
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStep: 1,
            toStageId: 'MEETING',
            toStageName: 'Встреча-знакомство',
            dealCount: 5,
            conversionRate: 50,
          },
          {
            fromStep: 1,
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStep: 2,
            toStageId: 'CONTRACT',
            toStageName: 'Контрактация',
            dealCount: 3,
            conversionRate: 60,
          },
          {
            fromStep: 2,
            fromStageId: 'CONTRACT',
            fromStageName: 'Контрактация',
            toStep: 3,
            toStageId: 'HANDOFF',
            toStageName: 'На передаче',
            dealCount: 2,
            conversionRate: 66.67,
          },
          {
            fromStep: 3,
            fromStageId: 'HANDOFF',
            fromStageName: 'На передаче',
            toStep: 4,
            toStageId: 'WON',
            toStageName: 'Передано в клуб',
            dealCount: 2,
            conversionRate: 100,
          },
        ],
      },
      comparisons: [],
    })),
    getAttractionOntology: vi.fn(async () => ({
      moduleKey: 'attraction',
      title: 'Привлечение',
      governance: {
        decisionRole: 'owner',
        decisionUnit: 'module',
      },
      lastReviewedAt: '2026-04-10',
      sources: [],
      concepts: [],
      transitions: [],
      reportBindings: [],
      drift: [],
    })),
    getRevenueVelocityReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      asOf: '2026-05-15T00:00:00.000Z',
      previousAsOf: '2026-03-31T23:59:59.999Z',
      dimension: 'manager',
      view: 'systemState',
      actionWeights: {
        connectedCallOverThirtySeconds: 1,
        meeting: 3,
        conversionEvent: 5,
        closedTask: 0.5,
      },
      totals: {
        dimension: 'manager',
        view: 'systemState',
        key: 'total',
        label: 'Итого',
        managerId: null,
        managerName: null,
        sourceKey: null,
        sourceLabel: null,
        customerKey: null,
        customerLabel: null,
        createdDeals: 5,
        activeDeals: 4,
        wonDeals: 2,
        lostDeals: 1,
        wipDeals: 2,
        salesAmount: 300000,
        averageCheck: 150000,
        winRate: 0.4,
        averageCycleDays: 15,
        medianCycleDays: 15,
        revenueVelocityPerDay: 20000,
        activePipelineAmount: 500000,
        expectedPipelineAmount: 420000,
        previousExpectedPipelineAmount: 300000,
        expectedPipelineDelta: 120000,
        liveRevenueVelocity: 20000,
        previousLiveRevenueVelocity: 12000,
        velocityDelta: 8000,
        velocityDeltaPercent: 0.67,
        averageRemainingDays: 21,
        realizedWonAmountInPeriod: 300000,
        wonDealsInPeriod: 2,
        lostDealsInPeriod: 1,
        systemValueCreated: 420000,
        actionPointsDelta: 5,
        systemValuePerActionPoint: 27096.77,
        realizedMoneyPerActionPoint: 19354.84,
        historicalMoneyPerActionPoint: 18000,
        estimatedFutureMoneyFromPeriodActions: 279000,
        actions: {
          totalCalls: 9,
          connectedCallsOverThirtySeconds: 4,
          meetingsCount: 3,
          conversionEventsCount: 0,
          createdTasks: 8,
          closedTasks: 5,
          weightedActionPoints: 15.5,
          weightedActionPointsPerDeal: 3.1,
          weightedActionPointsPerWin: 7.75,
        },
        moneyPerAction: {
          moneyPerMeeting: 100000,
          moneyPerConnectedCallOverThirtySeconds: 75000,
          moneyPerConversionEvent: null,
          moneyPerClosedTask: 60000,
          moneyPerWeightedActionPoint: 19354.84,
          actionEfficiencyIndex: 100,
        },
        bottleneckStageId: 'C10:DEMO',
        bottleneckStageName: 'Демонстрация',
        warnings: [
          'Конверсионные мероприятия пока не подключены. Колонка зарезервирована под будущие данные на этапах Активация и Демонстрация.',
        ],
      },
      rows: [
        {
          dimension: 'manager',
          view: 'systemState',
          key: 'slow',
          label: 'Медленная строка',
          managerId: '91',
          managerName: 'Медленная строка',
          sourceKey: null,
          sourceLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 2,
          activeDeals: 2,
          wonDeals: 1,
          lostDeals: 0,
          wipDeals: 1,
          salesAmount: 50000,
          averageCheck: 50000,
          winRate: 0.5,
          averageCycleDays: 25,
          medianCycleDays: 25,
          revenueVelocityPerDay: 2000,
          activePipelineAmount: 100000,
          expectedPipelineAmount: 50000,
          previousExpectedPipelineAmount: 60000,
          expectedPipelineDelta: -10000,
          liveRevenueVelocity: 2000,
          previousLiveRevenueVelocity: 3000,
          velocityDelta: -1000,
          velocityDeltaPercent: -0.33,
          averageRemainingDays: 25,
          realizedWonAmountInPeriod: 50000,
          wonDealsInPeriod: 1,
          lostDealsInPeriod: 0,
          systemValueCreated: 40000,
          actionPointsDelta: 1,
          systemValuePerActionPoint: 8888.89,
          realizedMoneyPerActionPoint: 11111.11,
          historicalMoneyPerActionPoint: 12000,
          estimatedFutureMoneyFromPeriodActions: 54000,
          actions: {
            totalCalls: 2,
            connectedCallsOverThirtySeconds: 1,
            meetingsCount: 1,
            conversionEventsCount: 0,
            createdTasks: 2,
            closedTasks: 1,
            weightedActionPoints: 4.5,
            weightedActionPointsPerDeal: 2.25,
            weightedActionPointsPerWin: 4.5,
          },
          moneyPerAction: {
            moneyPerMeeting: 50000,
            moneyPerConnectedCallOverThirtySeconds: 50000,
            moneyPerConversionEvent: null,
            moneyPerClosedTask: 50000,
            moneyPerWeightedActionPoint: 11111.11,
            actionEfficiencyIndex: 57.41,
          },
          bottleneckStageId: 'C10:DEMO',
          bottleneckStageName: 'Демонстрация',
          warnings: [],
        },
        {
          dimension: 'manager',
          view: 'systemState',
          key: 'fast',
          label: 'Быстрая строка',
          managerId: '78',
          managerName: 'Быстрая строка',
          sourceKey: null,
          sourceLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 3,
          activeDeals: 2,
          wonDeals: 1,
          lostDeals: 1,
          wipDeals: 1,
          salesAmount: 250000,
          averageCheck: 250000,
          winRate: 0.33,
          averageCycleDays: 12,
          medianCycleDays: 12,
          revenueVelocityPerDay: 20833.33,
          revenueVelocityFormula: {
            source: 'rollingQuarterCohort',
            sourceLabel: 'Когорта за последние 90 дней',
            averageRevenueAmount: 250000,
            opportunitiesCount: 2,
            conversionRate: 0.33,
            averageCycleDays: 12,
            value: 20833.33,
            benchmarkFrom: '2026-02-14T00:00:00.000Z',
            benchmarkTo: '2026-05-15T00:00:00.000Z',
            missingReason: null,
          },
          activePipelineAmount: 400000,
          expectedPipelineAmount: 370000,
          previousExpectedPipelineAmount: 240000,
          expectedPipelineDelta: 130000,
          liveRevenueVelocity: 20833.33,
          previousLiveRevenueVelocity: 9000,
          velocityDelta: 11833.33,
          velocityDeltaPercent: 1.31,
          averageRemainingDays: 18,
          realizedWonAmountInPeriod: 250000,
          wonDealsInPeriod: 1,
          lostDealsInPeriod: 1,
          systemValueCreated: 380000,
          actionPointsDelta: 4,
          systemValuePerActionPoint: 34545.45,
          realizedMoneyPerActionPoint: 22727.27,
          historicalMoneyPerActionPoint: 20000,
          estimatedFutureMoneyFromPeriodActions: 220000,
          actions: {
            totalCalls: 7,
            connectedCallsOverThirtySeconds: 3,
            meetingsCount: 2,
            conversionEventsCount: 0,
            createdTasks: 6,
            closedTasks: 4,
            weightedActionPoints: 11,
            weightedActionPointsPerDeal: 3.67,
            weightedActionPointsPerWin: 11,
          },
          moneyPerAction: {
            moneyPerMeeting: 125000,
            moneyPerConnectedCallOverThirtySeconds: 83333.33,
            moneyPerConversionEvent: null,
            moneyPerClosedTask: 62500,
            moneyPerWeightedActionPoint: 22727.27,
            actionEfficiencyIndex: 117.42,
          },
          bottleneckStageId: 'C10:ACTIVATION',
          bottleneckStageName: 'Активация',
          warnings: [],
        },
      ],
      formulaTooltips: [
        {
          key: 'revenueVelocityPerDay',
          label: 'Денежная скорость',
          formula: 'Средний чек × Количество возможностей × Конверсия / Средний цикл сделки',
          description: 'Показывает денежную скорость.',
        },
      ],
      warnings: [
        'Конверсионные мероприятия пока не подключены. Колонка зарезервирована под будущие данные на этапах Активация и Демонстрация.',
      ],
      comparisons: [],
    })),
    triggerSync: vi.fn(async () => ({
      syncRunId: 1,
      leadsSynced: 0,
      dealsSynced: 0,
      mode: 'delta',
      modifiedAfter: null,
      finishedAt: '2026-04-19T12:00:00.000Z',
      snapshotBefore: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
      },
      snapshotAfter: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
      },
      changes: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
        managers: 0,
      },
      diagnostics: [],
    })),
    getComments: vi.fn(async () => []),
    createComment: vi.fn(async (input: {
      sceneId: string
      x: number
      y: number
      text: string
      anchor?: Record<string, unknown>
      context?: Record<string, unknown> | null
    }) => ({
      id: 'comment-1',
      sceneId: input.sceneId,
      x: input.x,
      y: input.y,
      text: input.text,
      status: 'open',
      archivedAt: null,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
      anchor: input.anchor,
      context: input.context,
      paperclipStatus: 'sent',
    })),
    updateComment: vi.fn(async (commentId: string, input: { text: string }) => ({
      id: commentId,
      sceneId: 'sales',
      x: 0.1,
      y: 0.2,
      text: input.text,
      status: 'open',
      archivedAt: null,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:05:00.000Z',
      paperclipStatus: 'sent',
    })),
    archiveComment: vi.fn(async (commentId: string) => ({
      id: commentId,
      sceneId: 'sales',
      x: 0.1,
      y: 0.2,
      text: 'archived',
      status: 'archived',
      archivedAt: '2026-04-10T12:05:00.000Z',
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:05:00.000Z',
      paperclipStatus: 'sent',
    })),
    createModuleUser: vi.fn(async (input: {
      login: string
      password: string
      role: 'leader' | 'employee'
    }) => ({
      id: 2,
      login: input.login,
      disabled: false,
      moduleRole: input.role,
    })),
    updateModuleUser: vi.fn(async (userId: number, input: { disabled?: boolean }) => ({
      id: userId,
      login: 'employee',
      disabled: input.disabled ?? false,
      moduleRole: 'employee',
    })),
  },
}))

function createResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createEmptyRevenueVelocityReport(
  overrides: Partial<RevenueVelocityReport> = {},
): RevenueVelocityReport {
  const base: RevenueVelocityReport = {
    range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
    asOf: '2026-05-15T00:00:00.000Z',
    previousAsOf: '2026-03-31T23:59:59.999Z',
    dimension: 'manager',
    view: 'systemState',
    actionWeights: {
      connectedCallOverThirtySeconds: 1,
      meeting: 3,
      conversionEvent: 5,
      closedTask: 0.5,
    },
    totals: {
      dimension: 'manager',
      view: 'systemState',
      key: 'total',
      label: 'Итого',
      createdDeals: 0,
      activeDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      wipDeals: 0,
      salesAmount: 0,
      averageCheck: null,
      winRate: null,
      averageCycleDays: null,
      medianCycleDays: null,
      revenueVelocityPerDay: null,
      activePipelineAmount: 0,
      expectedPipelineAmount: 0,
      previousExpectedPipelineAmount: null,
      expectedPipelineDelta: null,
      liveRevenueVelocity: null,
      previousLiveRevenueVelocity: null,
      velocityDelta: null,
      velocityDeltaPercent: null,
      averageRemainingDays: null,
      realizedWonAmountInPeriod: 0,
      wonDealsInPeriod: 0,
      lostDealsInPeriod: 0,
      systemValueCreated: null,
      actionPointsDelta: null,
      systemValuePerActionPoint: null,
      realizedMoneyPerActionPoint: null,
      historicalMoneyPerActionPoint: null,
      estimatedFutureMoneyFromPeriodActions: null,
      actions: {
        totalCalls: 0,
        connectedCallsOverThirtySeconds: 0,
        meetingsCount: 0,
        conversionEventsCount: 0,
        createdTasks: 0,
        closedTasks: 0,
        weightedActionPoints: 0,
        weightedActionPointsPerDeal: null,
        weightedActionPointsPerWin: null,
      },
      moneyPerAction: {
        moneyPerMeeting: null,
        moneyPerConnectedCallOverThirtySeconds: null,
        moneyPerConversionEvent: null,
        moneyPerClosedTask: null,
        moneyPerWeightedActionPoint: null,
        actionEfficiencyIndex: null,
      },
      bottleneckStageId: null,
      bottleneckStageName: null,
      warnings: [],
    },
    rows: [],
    formulaTooltips: [],
    warnings: [],
    comparisons: [],
  }

  return { ...base, ...overrides }
}

function createEmptyManagerActionOutcomeReport(
  overrides: Partial<ManagerActionOutcomeReport> = {},
): ManagerActionOutcomeReport {
  return {
    range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
    warnings: [],
    rows: [],
    cohortMonths: [],
    cohortStatusRows: [],
    comparisons: [],
    ...overrides,
  }
}

async function waitForDashboardShell() {
  expect(await screen.findByText(/фильтры периода и среза/i)).toBeInTheDocument()
  await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.unauthorizedListener = null
    window.history.pushState({}, '', '/')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (!init || init.method === 'GET') {
          return createResponse({ comments: [], updatedAt: null })
        }

        const next = JSON.parse(String(init.body)) as { comments: unknown[] }
        return createResponse({
          comments: next.comments,
          updatedAt: '2026-04-10T12:00:00.000Z',
        })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts on the login screen when the session is missing', async () => {
    vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce(
      Object.assign(new Error('UNAUTHORIZED'), { status: 401 }),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /вход в дашборд/i }),
    ).toBeInTheDocument()
    expect(apiClient.getDashboard).not.toHaveBeenCalled()
  })

  it('does not show an expired-session warning before the first login attempt', async () => {
    vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce(
      Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /вход в дашборд/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/сессия истекла/i)).not.toBeInTheDocument()
  })

  it('loads the dashboard shell when auth endpoints are disabled locally', async () => {
    vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce(
      Object.assign(new Error('NOT_FOUND'), { status: 404 }),
    )

    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^вход в дашборд$/i })).not.toBeInTheDocument()
  })

  it('logs in and then loads the dashboard shell', async () => {
    vi.mocked(apiClient.getCurrentUser)
      .mockRejectedValueOnce(Object.assign(new Error('UNAUTHORIZED'), { status: 401 }))
      .mockResolvedValueOnce({
        user: {
          id: 1,
          login: 'admin',
          firstName: null,
          lastName: null,
          role: 'admin',
          modules: [],
        },
        csrfToken: 'csrf-token',
      })

    render(<App />)

    fireEvent.change(await screen.findByLabelText(/логин/i), {
      target: { value: 'admin' },
    })
    fireEvent.change(screen.getByLabelText(/пароль/i), {
      target: { value: 'correct-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /войти/i }))

    expect(apiClient.login).toHaveBeenCalledWith({
      login: 'admin',
      password: 'correct-password',
    })
    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
  })

  it('returns to login when an API request gets 401 during runtime', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()

    act(() => {
      mockState.unauthorizedListener?.()
    })

    expect(
      await screen.findByRole('heading', { name: /вход в дашборд/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/сессия истекла/i)).toBeInTheDocument()
  })

  it('renders the prototype dashboard shell as the main app', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^comment mode$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/фильтры периода и среза/i),
    ).toBeInTheDocument()
    expect(apiClient.getRevenueVelocityReport).not.toHaveBeenCalled()
  })

  it('renders factual stage distribution below the funnel throughput report', async () => {
    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /движение по воронке/i }),
    )

    const throughput = await screen.findByText(/пропускная способность и очереди/i)
    const distribution = await screen.findByText(/распределение этапов воронки/i)

    expect(
      throughput.compareDocumentPosition(distribution) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByText(/карта маршрутов/i)).toBeInTheDocument()
    const routeMap = screen.getByRole('img', {
      name: /визуальная карта фактических переходов/i,
    })
    expect(routeMap).toBeInTheDocument()
    expect(Number.parseFloat(routeMap.style.width)).toBeGreaterThan(980)
    expect(screen.getByText(/1-й этап/i)).toBeInTheDocument()
    expect(screen.getByText(/2-й этап/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Звонок-знакомство -> Контрактация: 60% · 3 сдел/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/ПС сравнения\/день/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Очередь \(сравнение\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Сравнение 1:/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Контрактация -> На передаче: 67% · 2 сдел/i)).toBeInTheDocument()
    expect(screen.getByText(/На передаче -> Передано в клуб: 100% · 2 сдел/i)).toBeInTheDocument()
    expect(document.querySelectorAll('rect[fill="#ecfdf5"]').length).toBeGreaterThanOrEqual(3)
  })

  it('renders the source cohort conversion tab with month selector and manager breakdown', async () => {
    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /конверсия источников/i }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /конверсия источников/i }),
      ).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(apiClient.getSourceCohortConversionReport).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          from: expect.stringMatching(/^2026-05-01/),
          to: expect.stringMatching(/^2026-05-31/),
        }),
      ),
    )
    expect(
      screen.getByRole('button', { name: /май 2026 · 77/i }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /апрель 2026 · 42/i }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '2025' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2024' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /декабрь 2024 · 12/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('77').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1[,.]3%/).length).toBeGreaterThan(0)
    expect(screen.getByText('Лидген УС')).toBeInTheDocument()
    expect(screen.getAllByText(/ClubFirst Future/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Встреча-знакомство 6/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Без таргет-группы/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Егоров Андрей/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /раскрыть строку/i }))
    expect(screen.getByText(/Егоров Андрей/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /по менеджерам/i }))
    expect(await screen.findByText(/1 разрез/i)).toBeInTheDocument()
    expect(screen.getByText(/Егоров Андрей/i)).toBeInTheDocument()
    expect(apiClient.getAttractionOntology).not.toHaveBeenCalled()
  })

  it('does not keep stale source cohort rows while a selected month is loading', async () => {
    const loadedReport: SourceCohortConversionReport = {
      range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
      totalCreatedDeals: 77,
      totalWonDeals: 1,
      totalLostDeals: 22,
      totalOpenDeals: 54,
      winRate: 1.3,
      averageDaysToWin: 11,
      cohortMonths: [
        { cohortMonth: '2026-04', cohortLabel: 'Апрель 2026', totalCreatedDeals: 42 },
        { cohortMonth: '2026-05', cohortLabel: 'Май 2026', totalCreatedDeals: 77 },
      ],
      rows: [
        {
          id: 'LIDGEN|3.1|ClubFirst Future',
          sourceKey: 'LIDGEN',
          sourceLabel: 'Лидген УС',
          qualityKey: '3.1',
          qualityLabel: '3.1 Готов ко встрече',
          customerKey: 'ClubFirst Future',
          customerLabel: 'ClubFirst Future',
          createdDeals: 38,
          wonDeals: 1,
          lostDeals: 16,
          openDeals: 21,
          winRate: 2.6,
          averageDaysToWin: 11,
          managerBreakdown: [],
          openStageBreakdown: [
            { stageId: 'C10:MEETING', stageName: 'Встреча-знакомство', openDeals: 6 },
          ],
          targetGroupBreakdown: [],
        },
      ],
      comparisons: [],
    }
    vi.mocked(apiClient.getSourceCohortConversionReport).mockResolvedValue(loadedReport)

    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /конверсия источников/i }),
    )

    expect(await screen.findByText('Лидген УС')).toBeInTheDocument()

    const callsBeforeMonthChange = vi.mocked(apiClient.getSourceCohortConversionReport)
      .mock.calls.length
    vi.mocked(apiClient.getSourceCohortConversionReport).mockImplementation(
      () => new Promise<SourceCohortConversionReport>(() => {}),
    )

    fireEvent.click(screen.getByRole('button', { name: /апрель 2026 · 42/i }))

    await waitFor(() =>
      expect(vi.mocked(apiClient.getSourceCohortConversionReport).mock.calls.length)
        .toBeGreaterThan(callsBeforeMonthChange),
    )
    expect(screen.queryByText('Лидген УС')).not.toBeInTheDocument()
    expect(screen.getByText(/считаю когорту/i)).toBeInTheDocument()
  })

  it('renders an empty state for a source cohort month without rows', async () => {
    const emptySourceCohortReport = {
      range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      totalLostDeals: 0,
      totalOpenDeals: 0,
      winRate: 0,
      averageDaysToWin: 0,
      cohortMonths: [
        { cohortMonth: '2026-05', cohortLabel: 'Май 2026', totalCreatedDeals: 0 },
      ],
      rows: [],
      comparisons: [],
    }
    vi.mocked(apiClient.getSourceCohortConversionReport)
      .mockResolvedValueOnce(emptySourceCohortReport)
      .mockResolvedValueOnce(emptySourceCohortReport)

    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /конверсия источников/i }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /конверсия источников/i }),
      ).toBeInTheDocument(),
    )
    await waitFor(() =>
      expect(apiClient.getSourceCohortConversionReport).toHaveBeenCalled(),
    )
    expect(
      await screen.findByText(/за выбранный месяц нет сделок/i),
    ).toBeInTheDocument()
  })

  it('renders the revenue velocity tab with KPI, sortable table, formula tooltip and conversion-event warning', async () => {
    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))

    expect(await screen.findByRole('heading', { name: /денежная скорость/i })).toBeInTheDocument()
    await waitFor(() =>
      expect(apiClient.getRevenueVelocityReport).toHaveBeenCalledWith(
        expect.objectContaining({ view: 'systemState', dimension: 'manager' }),
      ),
    )
    expect(screen.getByRole('button', { name: /состояние системы/i })).toBeInTheDocument()
    expect(screen.queryByText(/сумма выигранных сделок когорты/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Факт денег периода/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Активная воронка/i).length).toBeGreaterThan(0)
    expect(screen.getByText('300 000 ₽')).toBeInTheDocument()
    expect(
      screen.getAllByTitle(/Сумма дохода Привлечения активных сделок/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(/Конверсионные мероприятия пока не подключены/i),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(9)
    expect(
      screen.getByRole('columnheader', { name: /Денежная скорость/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('20 833 ₽/день')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Исторический ₽ \/ балл/i })).not.toBeInTheDocument()

    const fastRow = screen.getByText('Быстрая строка')
    const slowRow = screen.getByText('Медленная строка')
    expect(
      fastRow.compareDocumentPosition(slowRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Активная воронка/i }))
    expect(
      slowRow.compareDocumentPosition(fastRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    fireEvent.click(fastRow)
    expect(
      screen.getByText(/Денежная скорость = средний доход × активные возможности × конверсия ÷ цикл/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/20 833 ₽\/день = 250 000 ₽ × 2 × 33% ÷ 12 дн\./i),
    ).toBeInTheDocument()
    expect(
      screen.getByTitle(/Конверсия берётся когортная за последние 90 дней/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Исторический ₽ \/ балл/i)).toBeInTheDocument()
  })

  it('summarizes long revenue velocity warning lists instead of dumping every deal warning', async () => {
    const warningReport = createEmptyRevenueVelocityReport({
      warnings: [
        ...Array.from(
          { length: 10 },
          (_, index) =>
            `Deal ${1000 + index}: target group and tariff are required for pipelinePlan pricing.`,
        ),
        'Недостаточно данных для вероятностной оценки воронки.',
      ],
    })
    vi.mocked(apiClient.getRevenueVelocityReport).mockResolvedValueOnce(warningReport)

    render(<App />)
    await waitForDashboardShell()
    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))

    expect(
      await screen.findByText(/10 сделок без заказчика\/таргет-группы/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 системное предупреждение/i)).toBeInTheDocument()
    expect(screen.getByText(/Показать детали/i)).toBeInTheDocument()
    expect(screen.getByText(/Ещё 3 предупреждений скрыто/i)).toBeInTheDocument()
    expect(screen.queryByText(/Deal 1009:/i)).not.toBeInTheDocument()
  })

  it('keeps manager action outcome pricing warnings out of the cohort report UI', async () => {
    vi.mocked(apiClient.getManagerActionOutcomeReport).mockResolvedValueOnce(
      createEmptyManagerActionOutcomeReport({
        warnings: [
          ...Array.from(
            { length: 9 },
            (_, index) =>
              `Deal ${2000 + index}: target group and tariff are required for finalWon pricing.`,
          ),
          'Deal 3001: no pricing rule for customer "ClubFirst Guest" and tariff "Федеральный".',
        ],
      }),
    )

    render(<App />)
    await waitForDashboardShell()
    fireEvent.click(await screen.findByRole('button', { name: /когортный отчет/i }))

    expect(
      await screen.findByRole('heading', { name: /^Действия → результат$/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/9 выигранных сделок без договорных полей/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 сделка без правила цены/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Предупреждения расчёта/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ещё 2 предупреждений скрыто/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Deal 2008:/i)).not.toBeInTheDocument()
  })

  it('shows an empty cohort state in the revenue velocity tab', async () => {
    vi.mocked(apiClient.getRevenueVelocityReport)
      .mockResolvedValueOnce(createEmptyRevenueVelocityReport())
      .mockResolvedValueOnce(
        createEmptyRevenueVelocityReport({
          view: 'createdCohort',
          totals: {
            ...createEmptyRevenueVelocityReport().totals,
            view: 'createdCohort',
          },
        }),
      )

    render(<App />)
    await waitForDashboardShell()
    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^когорты$/i }))

    expect(await screen.findByText(/Нет сделок в выбранной когорте/i)).toBeInTheDocument()
    expect(apiClient.getRevenueVelocityReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'createdCohort' }),
    )
  })

  it('shows a no-won-deals state in the revenue velocity tab', async () => {
    vi.mocked(apiClient.getRevenueVelocityReport)
      .mockResolvedValueOnce(createEmptyRevenueVelocityReport())
      .mockResolvedValueOnce(
        createEmptyRevenueVelocityReport({
          view: 'createdCohort',
          totals: {
            ...createEmptyRevenueVelocityReport().totals,
            view: 'createdCohort',
            createdDeals: 3,
            wipDeals: 3,
          },
          rows: [],
        }),
      )

    render(<App />)
    await waitForDashboardShell()
    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^когорты$/i }))

    expect(
      await screen.findByText(/пока нет выигранных сделок/i),
    ).toBeInTheDocument()
  })
})
