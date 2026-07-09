import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { apiClient } from '@/lib/api-client'
import { RevenueVelocityScene, SourceCohortsScene, UnitEconomicsScene } from '@/proto/scenes'
import type {
  ConversionEventTypeSettingsInput,
  DealPricingRuleInput,
  ManagerActionOutcomeReport,
  OperationalThresholdSettingsInput,
  RevenueVelocityReport,
  SalesPlanQuarterInput,
  SourceCohortConversionReport,
} from '@/lib/dashboard-types'
import type { ProtoFilterState, ProtoRuntimeData } from '@/proto/types'

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
      businessClubCatalog: [],
      targetGroupCatalog: [],
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
      trajectoryStatus: 'available',
      trajectoryUnavailableReason: null,
      trajectory: {
        range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
        totalDeals: 77,
        stageNodes: [
          {
            stageId: 'C10:NEW',
            stageName: 'База входящая',
            sortOrder: 10,
            reachedDeals: 77,
            reachedRate: 100,
            medianDaysFromCreate: 0,
            medianDaysOnStage: 1,
          },
          {
            stageId: 'C10:MEETING',
            stageName: 'Встреча-знакомство',
            sortOrder: 40,
            reachedDeals: 32,
            reachedRate: 41.56,
            medianDaysFromCreate: 3,
            medianDaysOnStage: 7,
          },
          {
            stageId: 'C10:CONTRACT',
            stageName: 'Контракт (договор+счёт)',
            sortOrder: 70,
            reachedDeals: 8,
            reachedRate: 10.39,
            medianDaysFromCreate: 14,
            medianDaysOnStage: 5,
          },
          {
            stageId: 'C10:LOSE',
            stageName: 'Корзина',
            sortOrder: 90,
            reachedDeals: 16,
            reachedRate: 20.78,
            medianDaysFromCreate: 9,
            medianDaysOnStage: null,
          },
        ],
        stageTransitions: [
          {
            id: 'stage-transition-START-C10:NEW',
            fromStageId: null,
            fromStageName: null,
            fromSortOrder: null,
            toStageId: 'C10:NEW',
            toStageName: 'База входящая',
            toSortOrder: 10,
            deals: 77,
            conversionRate: 100,
          },
          {
            id: 'stage-transition-C10:NEW-C10:MEETING',
            fromStageId: 'C10:NEW',
            fromStageName: 'База входящая',
            fromSortOrder: 10,
            toStageId: 'C10:MEETING',
            toStageName: 'Встреча-знакомство',
            toSortOrder: 40,
            deals: 32,
            conversionRate: 41.56,
          },
          {
            id: 'stage-transition-C10:MEETING-C10:CONTRACT',
            fromStageId: 'C10:MEETING',
            fromStageName: 'Встреча-знакомство',
            fromSortOrder: 40,
            toStageId: 'C10:CONTRACT',
            toStageName: 'Контракт (договор+счёт)',
            toSortOrder: 70,
            deals: 8,
            conversionRate: 25,
          },
        ],
        actionNodes: [
          {
            actionKey: 'first_successful_call',
            label: 'Первый успешный исходящий звонок',
            reachedDeals: 45,
            reachedRate: 58.44,
            medianDaysFromCreate: 1,
            evidence: 'Прямой доверенный исходящий звонок после создания сделки.',
          },
          {
            actionKey: 'completed_meeting',
            label: 'Факт проведенной встречи',
            reachedDeals: 20,
            reachedRate: 25.97,
            medianDaysFromCreate: 5,
            evidence: 'В CRM есть факт проведенной встречи.',
          },
          {
            actionKey: 'attended_event',
            label: 'Факт посещения события',
            reachedDeals: 9,
            reachedRate: 11.69,
            medianDaysFromCreate: 8,
            evidence: 'Есть фактическое посещение мероприятия.',
          },
        ],
        factSteps: [
          {
            stepKey: 'created',
            label: 'Создано',
            deals: 77,
            rateFromCohort: 100,
            rateFromPrevious: 100,
            medianDaysFromCreate: 0,
            evidence: 'Сделка создана в выбранной когорте.',
          },
          {
            stepKey: 'first_successful_call',
            label: 'Первый успешный звонок',
            deals: 45,
            rateFromCohort: 58.44,
            rateFromPrevious: 58.44,
            medianDaysFromCreate: 1,
            evidence: 'Прямой исходящий звонок с соединением и разговором дольше 30 секунд.',
          },
          {
            stepKey: 'meeting_stage',
            label: 'Этап встречи в CRM',
            deals: 32,
            rateFromCohort: 41.56,
            rateFromPrevious: 71.11,
            medianDaysFromCreate: 3,
            evidence: 'Сделка дошла до CRM-этапа встречи.',
          },
          {
            stepKey: 'completed_meeting',
            label: 'Факт встречи',
            deals: 20,
            rateFromCohort: 25.97,
            rateFromPrevious: 62.5,
            medianDaysFromCreate: 5,
            evidence: 'В CRM есть факт проведенной встречи.',
          },
          {
            stepKey: 'attended_event',
            label: 'Посещение события',
            deals: 9,
            rateFromCohort: 11.69,
            rateFromPrevious: 45,
            medianDaysFromCreate: 8,
            evidence: 'Есть фактическое посещение мероприятия.',
          },
          {
            stepKey: 'contract_stage',
            label: 'Контракт',
            deals: 8,
            rateFromCohort: 10.39,
            rateFromPrevious: 88.89,
            medianDaysFromCreate: 14,
            evidence: 'Сделка дошла до CRM-этапа контракта.',
          },
          {
            stepKey: 'won',
            label: 'Продажа',
            deals: 1,
            rateFromCohort: 1.3,
            rateFromPrevious: 12.5,
            medianDaysFromCreate: 21,
            evidence: 'Сделка дошла до успешного финального статуса.',
          },
        ],
        conversionGaps: [
          {
            gapKey: 'no_successful_call',
            label: 'Нет успешного звонка',
            deals: 32,
            rate: 41.56,
            denominatorStepKey: 'created',
            evidence: 'Нет прямого успешного исходящего звонка дольше 30 секунд.',
            managementQuestion: 'Почему не довели до успешного дозвона?',
          },
          {
            gapKey: 'successful_call_without_meeting_stage',
            label: 'Звонок есть, этапа встречи нет',
            deals: 13,
            rate: 28.89,
            denominatorStepKey: 'first_successful_call',
            evidence: 'Успешный звонок есть, но этап встречи не достигнут.',
            managementQuestion: 'Почему после дозвона не назначили встречу?',
          },
          {
            gapKey: 'meeting_stage_without_fact',
            label: 'Этап встречи без факта встречи',
            deals: 12,
            rate: 37.5,
            denominatorStepKey: 'meeting_stage',
            evidence: 'Этап встречи достигнут, но факта проведенной встречи нет.',
            managementQuestion: 'Почему этап встречи не подтвержден фактом?',
          },
          {
            gapKey: 'completed_meeting_without_next_stage',
            label: 'Факт встречи без следующего этапа',
            deals: 6,
            rate: 30,
            denominatorStepKey: 'completed_meeting',
            evidence: 'Факт встречи есть, но следующего перехода по CRM-стадиям нет.',
            managementQuestion: 'Почему после встречи нет следующего шага?',
          },
          {
            gapKey: 'attended_event_without_contract',
            label: 'Событие без контракта',
            deals: 2,
            rate: 22.22,
            denominatorStepKey: 'attended_event',
            evidence: 'Посещение события есть, но этап контракта не достигнут.',
            managementQuestion: 'Почему после события не дошли до контракта?',
          },
          {
            gapKey: 'contract_without_win',
            label: 'Контракт без продажи',
            deals: 7,
            rate: 87.5,
            denominatorStepKey: 'contract_stage',
            evidence: 'Этап контракта достигнут, но продажи нет.',
            managementQuestion: 'Что блокирует закрытие контракта?',
          },
        ],
        speedSteps: [
          {
            stepKey: 'first_successful_call',
            label: 'Первый успешный звонок',
            totalDeals: 77,
            medianDays: 1,
            slaDays: 3,
            slowDeals: 4,
            slowRate: 5.19,
            buckets: [
              { bucketKey: '0-1', label: '0-1 дн.', minDays: 0, maxDays: 1, deals: 28, rate: 36.36 },
              { bucketKey: '1-3', label: '1-3 дн.', minDays: 1, maxDays: 3, deals: 13, rate: 16.88 },
              { bucketKey: '3-7', label: '3-7 дн.', minDays: 3, maxDays: 7, deals: 4, rate: 5.19 },
              { bucketKey: '7+', label: '7+ дн.', minDays: 7, maxDays: null, deals: 0, rate: 0 },
              { bucketKey: 'no_fact', label: 'Нет факта', minDays: null, maxDays: null, deals: 32, rate: 41.56 },
            ],
          },
          {
            stepKey: 'completed_meeting',
            label: 'Факт встречи',
            totalDeals: 77,
            medianDays: 5,
            slaDays: 7,
            slowDeals: 3,
            slowRate: 3.9,
            buckets: [
              { bucketKey: '0-3', label: '0-3 дн.', minDays: 0, maxDays: 3, deals: 6, rate: 7.79 },
              { bucketKey: '3-7', label: '3-7 дн.', minDays: 3, maxDays: 7, deals: 11, rate: 14.29 },
              { bucketKey: '7-14', label: '7-14 дн.', minDays: 7, maxDays: 14, deals: 3, rate: 3.9 },
              { bucketKey: '14+', label: '14+ дн.', minDays: 14, maxDays: null, deals: 0, rate: 0 },
              { bucketKey: 'no_fact', label: 'Нет факта', minDays: null, maxDays: null, deals: 57, rate: 74.03 },
            ],
          },
          {
            stepKey: 'attended_event',
            label: 'Посещение события',
            totalDeals: 77,
            medianDays: 8,
            slaDays: 14,
            slowDeals: 1,
            slowRate: 1.3,
            buckets: [
              { bucketKey: '0-7', label: '0-7 дн.', minDays: 0, maxDays: 7, deals: 3, rate: 3.9 },
              { bucketKey: '7-14', label: '7-14 дн.', minDays: 7, maxDays: 14, deals: 5, rate: 6.49 },
              { bucketKey: '14-30', label: '14-30 дн.', minDays: 14, maxDays: 30, deals: 1, rate: 1.3 },
              { bucketKey: '30+', label: '30+ дн.', minDays: 30, maxDays: null, deals: 0, rate: 0 },
              { bucketKey: 'no_fact', label: 'Нет факта', minDays: null, maxDays: null, deals: 68, rate: 88.31 },
            ],
          },
          {
            stepKey: 'contract_stage',
            label: 'Контракт',
            totalDeals: 77,
            medianDays: 14,
            slaDays: 14,
            slowDeals: 2,
            slowRate: 2.6,
            buckets: [
              { bucketKey: '0-7', label: '0-7 дн.', minDays: 0, maxDays: 7, deals: 2, rate: 2.6 },
              { bucketKey: '7-14', label: '7-14 дн.', minDays: 7, maxDays: 14, deals: 4, rate: 5.19 },
              { bucketKey: '14-30', label: '14-30 дн.', minDays: 14, maxDays: 30, deals: 2, rate: 2.6 },
              { bucketKey: '30+', label: '30+ дн.', minDays: 30, maxDays: null, deals: 0, rate: 0 },
              { bucketKey: 'no_fact', label: 'Нет факта', minDays: null, maxDays: null, deals: 69, rate: 89.61 },
            ],
          },
          {
            stepKey: 'post_meeting_next_stage',
            label: 'После встречи до следующего этапа',
            totalDeals: 20,
            medianDays: 3,
            slaDays: 7,
            slowDeals: 1,
            slowRate: 5,
            buckets: [
              { bucketKey: '0-3', label: '0-3 дн.', minDays: 0, maxDays: 3, deals: 7, rate: 35 },
              { bucketKey: '3-7', label: '3-7 дн.', minDays: 3, maxDays: 7, deals: 6, rate: 30 },
              { bucketKey: '7-14', label: '7-14 дн.', minDays: 7, maxDays: 14, deals: 1, rate: 5 },
              { bucketKey: '14+', label: '14+ дн.', minDays: 14, maxDays: null, deals: 0, rate: 0 },
              { bucketKey: 'no_fact', label: 'Нет факта', minDays: null, maxDays: null, deals: 6, rate: 30 },
            ],
          },
        ],
        overallSignals: {
          noSuccessfulCallDeals: 32,
          firstSuccessfulCallDeals: 45,
          firstSuccessfulCallFallbackDeals: 3,
          successfulCallWithoutMeetingStageDeals: 13,
          meetingStageDeals: 32,
          meetingStageWithoutFactDeals: 12,
          completedMeetingDeals: 20,
          completedMeetingWithoutNextStageDeals: 6,
          attendedEventDeals: 12,
          attendedEventWithoutContractDeals: 2,
          contractWithoutWinDeals: 7,
          slowFirstSuccessfulCallDeals: 4,
          slowCompletedMeetingDeals: 3,
          slowAttendedEventDeals: 1,
          slowContractStageDeals: 2,
          staleAfterCompletedMeetingDeals: 2,
          staleOpenContractStageDeals: 1,
          repeatAttendedEventDeals: 3,
          repeatAttendedEventVisits: 4,
          contractStageDeals: 8,
          contractStageRate: 10.39,
          medianDaysToContractStage: 14,
          medianDaysOnContractStage: 5,
          wonDeals: 1,
          lostDeals: 22,
          openDeals: 54,
        },
        managerDiagnostics: [
          {
            managerId: '501',
            managerName: 'Анастасия Кузнецова',
            totalDeals: 20,
            status: 'bottleneck',
            headline:
              'Анастасия Кузнецова: главное узкое место - CRM-встреча без факта.',
            strengths: [],
            bottlenecks: [
              {
                signalKey: 'meeting_stage_without_fact',
                label: 'CRM-встреча без факта',
                value: 60,
                benchmarkValue: 37.5,
                delta: 22.5,
                unit: '%',
                severity: 'warning',
              },
            ],
            recommendedFocus:
              'Проверить назначение встреч: этап встречи есть, факта встречи нет.',
            sampleWarning: null,
          },
        ],
        managerRows: [
          {
            key: '501',
            label: 'Анастасия Кузнецова',
            managerId: '501',
            managerName: 'Анастасия Кузнецова',
            totalDeals: 20,
            firstSuccessfulCallDeals: 12,
            firstSuccessfulCallFallbackDeals: 1,
            firstSuccessfulCallRate: 60,
            medianDaysToFirstSuccessfulCall: 1,
            meetingStageDeals: 10,
            meetingStageRate: 50,
            completedMeetingDeals: 4,
            completedMeetingRate: 20,
            medianDaysToCompletedMeeting: 5,
            attendedEventDeals: 2,
            attendedEventRate: 10,
            medianDaysToAttendedEvent: 8,
            wonDeals: 1,
            wonRate: 5,
            lostDeals: 8,
            openDeals: 11,
            noSuccessfulCallDeals: 8,
            successfulCallWithoutMeetingStageDeals: 2,
            meetingStageWithoutFactDeals: 6,
            completedMeetingWithoutNextStageDeals: 2,
            attendedEventWithoutContractDeals: 1,
            slowFirstSuccessfulCallDeals: 2,
            slowCompletedMeetingDeals: 1,
            slowAttendedEventDeals: 1,
            slowContractStageDeals: 1,
            staleAfterCompletedMeetingDeals: 1,
            staleOpenContractStageDeals: 0,
            repeatAttendedEventDeals: 1,
            repeatAttendedEventVisits: 1,
            contractStageDeals: 2,
            contractStageRate: 10,
            contractWithoutWinDeals: 1,
            medianDaysToContractStage: 14,
            medianDaysOnContractStage: 5,
            dataQualityStatus: 'limited',
            lossShape: {
              dominantShapeKey: 'meeting_stage_without_fact',
              dominantShapeLabel: 'Этап встречи без факта',
              dominantDeals: 6,
              dominantRate: 30,
              terminalLossDeals: 8,
              openWipDeals: 11,
              reasons: [
                {
                  shapeKey: 'meeting_stage_without_fact',
                  label: 'Этап встречи без факта',
                  deals: 6,
                  rate: 30,
                  evidence: 'Этап встречи достигнут, но факта проведенной встречи нет.',
                  recommendedQuestion: 'Почему этап встречи не подтвержден фактом?',
                },
              ],
            },
          },
        ],
        sourceRows: [
          {
            key: 'LIDGEN',
            label: 'Лидген УС',
            totalDeals: 38,
            firstSuccessfulCallDeals: 24,
            firstSuccessfulCallFallbackDeals: 2,
            firstSuccessfulCallRate: 63.16,
            medianDaysToFirstSuccessfulCall: 1,
            meetingStageDeals: 18,
            meetingStageRate: 47.37,
            completedMeetingDeals: 9,
            completedMeetingRate: 23.68,
            medianDaysToCompletedMeeting: 5,
            attendedEventDeals: 5,
            attendedEventRate: 13.16,
            medianDaysToAttendedEvent: 8,
            wonDeals: 1,
            wonRate: 2.63,
            lostDeals: 16,
            openDeals: 21,
            noSuccessfulCallDeals: 14,
            successfulCallWithoutMeetingStageDeals: 6,
            meetingStageWithoutFactDeals: 9,
            completedMeetingWithoutNextStageDeals: 4,
            attendedEventWithoutContractDeals: 2,
            slowFirstSuccessfulCallDeals: 3,
            slowCompletedMeetingDeals: 2,
            slowAttendedEventDeals: 1,
            slowContractStageDeals: 1,
            staleAfterCompletedMeetingDeals: 2,
            staleOpenContractStageDeals: 1,
            repeatAttendedEventDeals: 2,
            repeatAttendedEventVisits: 3,
            contractStageDeals: 4,
            contractStageRate: 10.53,
            contractWithoutWinDeals: 3,
            medianDaysToContractStage: 14,
            medianDaysOnContractStage: 5,
            dataQualityStatus: 'reliable',
            lossShape: {
              dominantShapeKey: 'terminal_loss',
              dominantShapeLabel: 'Терминальный проигрыш',
              dominantDeals: 16,
              dominantRate: 42.11,
              terminalLossDeals: 16,
              openWipDeals: 21,
              reasons: [
                {
                  shapeKey: 'terminal_loss',
                  label: 'Терминальный проигрыш',
                  deals: 16,
                  rate: 42.11,
                  evidence: 'Сделка находится в проигрышном исходе.',
                  recommendedQuestion: 'Какая причина проигрыша повторяется?',
                },
                {
                  shapeKey: 'meeting_stage_without_fact',
                  label: 'Этап встречи без факта',
                  deals: 9,
                  rate: 23.68,
                  evidence: 'Этап встречи достигнут, но факта проведенной встречи нет.',
                  recommendedQuestion: 'Почему этап встречи не подтвержден фактом?',
                },
              ],
            },
          },
        ],
        customerRows: [
          {
            key: 'ClubFirst Future',
            label: 'ClubFirst Future',
            totalDeals: 38,
            firstSuccessfulCallDeals: 24,
            firstSuccessfulCallFallbackDeals: 2,
            firstSuccessfulCallRate: 63.16,
            medianDaysToFirstSuccessfulCall: 1,
            meetingStageDeals: 18,
            meetingStageRate: 47.37,
            completedMeetingDeals: 9,
            completedMeetingRate: 23.68,
            medianDaysToCompletedMeeting: 5,
            attendedEventDeals: 5,
            attendedEventRate: 13.16,
            medianDaysToAttendedEvent: 8,
            wonDeals: 1,
            wonRate: 2.63,
            lostDeals: 16,
            openDeals: 21,
            noSuccessfulCallDeals: 14,
            successfulCallWithoutMeetingStageDeals: 6,
            meetingStageWithoutFactDeals: 9,
            completedMeetingWithoutNextStageDeals: 4,
            attendedEventWithoutContractDeals: 2,
            slowFirstSuccessfulCallDeals: 3,
            slowCompletedMeetingDeals: 2,
            slowAttendedEventDeals: 1,
            slowContractStageDeals: 1,
            staleAfterCompletedMeetingDeals: 2,
            staleOpenContractStageDeals: 1,
            repeatAttendedEventDeals: 2,
            repeatAttendedEventVisits: 3,
            contractStageDeals: 4,
            contractStageRate: 10.53,
            contractWithoutWinDeals: 3,
            medianDaysToContractStage: 14,
            medianDaysOnContractStage: 5,
            dataQualityStatus: 'reliable',
            lossShape: {
              dominantShapeKey: 'contract_without_win',
              dominantShapeLabel: 'Контракт без продажи',
              dominantDeals: 3,
              dominantRate: 7.89,
              terminalLossDeals: 16,
              openWipDeals: 21,
              reasons: [
                {
                  shapeKey: 'contract_without_win',
                  label: 'Контракт без продажи',
                  deals: 3,
                  rate: 7.89,
                  evidence: 'Этап контракта достигнут, но продажи нет.',
                  recommendedQuestion: 'Что блокирует закрытие контракта?',
                },
              ],
            },
          },
        ],
        dataQuality: {
          totalDeals: 77,
          stageHistoryDeals: 70,
          stageHistoryCoverageRate: 90.91,
          touchpointDeals: 55,
          touchpointCoverageRate: 71.43,
          eventVisitDeals: 12,
          eventVisitCoverageRate: 15.58,
          businessClubDeals: 55,
          businessClubCoverageRate: 71.43,
          businessClubMissingDeals: 22,
          warnings: ['Разрезы с N < 10 нельзя использовать для жесткого ранжирования.'],
        },
      },
      comparisons: [],
    })),
    getOperationalDashboardReport: vi.fn(async () => ({
      range: { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' },
      generatedAt: '2026-06-01T09:00:00.000Z',
      createdDeals: 37,
      meetingsHeld: {
        total: 54,
        bySlot: [
          { slotIndex: 1, slotLabel: 'Встреча 1', count: 28 },
          { slotIndex: 2, slotLabel: 'Встреча 2', count: 17 },
          { slotIndex: 3, slotLabel: 'Встреча 3', count: 9 },
        ],
      },
      sales: {
        total: 6,
        byClub: [
          {
            targetGroupKey: 'clubfirst-russia',
            targetGroupLabel: 'ClubFirst Russia',
            wonDeals: 4,
            averageDaysToWin: 41,
          },
          {
            targetGroupKey: 'clubfirst-one',
            targetGroupLabel: 'ClubFirst One',
            wonDeals: 2,
            averageDaysToWin: 28,
          },
        ],
      },
      lostDeals: 12,
      openDeals: 215,
      riskSummary: {
        total: 3,
        critical: 1,
        risk: 2,
        byRule: [
          { rule: 'stage_aging', label: 'Застряли на этапе', count: 1 },
          { rule: 'no_open_activity', label: 'Нет запланированных дел', count: 1 },
          { rule: 'no_recent_calls', label: 'Нет звонков', count: 1 },
        ],
        byStage: [
          { stageId: 'C10:PREPARATION', stageName: 'Звонок-знакомство', count: 1 },
          { stageId: 'C10:UC_9E0XYG', stageName: 'Встреча-знакомство', count: 2 },
        ],
      },
      stageWip: [
        {
          stageId: 'C10:PREPARATION',
          stageName: 'Звонок-знакомство',
          openDeals: 56,
          riskDeals: 1,
        },
        {
          stageId: 'C10:UC_9E0XYG',
          stageName: 'Встреча-знакомство',
          openDeals: 29,
          riskDeals: 2,
        },
      ],
      sla: [
        {
          slaKey: 'sla2',
          label: 'Первый контакт',
          thresholdBusinessHours: 5,
          onTimeCount: 21,
          lateCount: 9,
          noTouchCount: 7,
          medianHours: 3.2,
        },
      ],
      planned: {
        meetingsToday: [
          { slotIndex: 1, slotLabel: 'Встреча 1', count: 3 },
          { slotIndex: 2, slotLabel: 'Встреча 2', count: 2 },
          { slotIndex: 3, slotLabel: 'Встреча 3', count: 2 },
        ],
        meetingsTomorrow: [
          { slotIndex: 1, slotLabel: 'Встреча 1', count: 2 },
          { slotIndex: 2, slotLabel: 'Встреча 2', count: 2 },
          { slotIndex: 3, slotLabel: 'Встреча 3', count: 1 },
        ],
        tasksToday: 23,
        tasksTomorrow: 18,
      },
      managers: [
        {
          managerId: '13020',
          managerName: 'Какулия Илья',
          createdDeals: 9,
          meetingsBySlot: [
            { slotIndex: 1, slotLabel: 'Встреча 1', count: 8 },
            { slotIndex: 2, slotLabel: 'Встреча 2', count: 4 },
            { slotIndex: 3, slotLabel: 'Встреча 3', count: 2 },
          ],
          wonDeals: 1,
          slaLateCount: 4,
          slaNoTouchCount: 2,
          openDeals: 75,
          riskDeals: 1,
        },
        {
          managerId: '6994',
          managerName: 'Кузнецова Анастасия',
          createdDeals: 7,
          meetingsBySlot: [
            { slotIndex: 1, slotLabel: 'Встреча 1', count: 6 },
            { slotIndex: 2, slotLabel: 'Встреча 2', count: 4 },
            { slotIndex: 3, slotLabel: 'Встреча 3', count: 2 },
          ],
          wonDeals: 2,
          slaLateCount: 1,
          slaNoTouchCount: 1,
          openDeals: 31,
          riskDeals: 2,
        },
      ],
      risks: [
        {
          dealId: '48213',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/48213/',
          managerId: '13020',
          managerName: 'Какулия Илья',
          stageId: 'C10:PREPARATION',
          stageName: 'Звонок-знакомство',
          daysOnStage: 21,
          stageMaxDays: 3,
          sourceLabel: 'Лидген УС',
          customerClubLabel: 'ClubFirst One',
          flags: [
            {
              rule: 'stage_aging',
              label: 'застрял: 21 дн · порог 3',
              severity: 'critical',
            },
          ],
          severity: 'critical',
          overdueRatio: 7,
        },
        {
          dealId: '48544',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/48544/',
          managerId: '6994',
          managerName: 'Кузнецова Анастасия',
          stageId: 'C10:UC_9E0XYG',
          stageName: 'Встреча-знакомство',
          daysOnStage: 8,
          stageMaxDays: 14,
          sourceLabel: 'Лидген УС',
          customerClubLabel: 'ClubFirst Future',
          flags: [
            {
              rule: 'no_open_activity',
              label: 'нет запланированных дел',
              severity: 'risk',
            },
          ],
          severity: 'risk',
          overdueRatio: 0.57,
        },
        {
          dealId: '48671',
          dealUrl: 'https://example.bitrix24.ru/crm/deal/details/48671/',
          managerId: '6994',
          managerName: 'Кузнецова Анастасия',
          stageId: 'C10:UC_9E0XYG',
          stageName: 'Встреча-знакомство',
          daysOnStage: 2,
          stageMaxDays: 14,
          sourceLabel: 'Самостоятельно',
          customerClubLabel: 'Без клуба',
          flags: [
            {
              rule: 'no_recent_calls',
              label: 'нет звонков 7+ дн',
              severity: 'risk',
            },
          ],
          severity: 'risk',
          overdueRatio: 0.14,
        },
      ],
      thresholdsUpdatedAt: null,
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
    getOperationalThresholdSettings: vi.fn(async () => ({
      stageAging: [
        {
          stageId: 'C10:NEW',
          stageName: 'База входящая',
          maxDaysOnStage: 1,
        },
        {
          stageId: 'C10:PREPARATION',
          stageName: 'Звонок-знакомство',
          maxDaysOnStage: 3,
        },
      ],
      noCallsMaxDays: 7,
      noActivityMaxDays: 5,
      slaBusinessHours: {
        sla1: 24,
        sla2: 5,
        sla3: 72,
      },
      updatedAt: null,
    })),
    saveOperationalThresholdSettings: vi.fn(
      async (input: OperationalThresholdSettingsInput) => ({
        stageAging: input.stageAging.map((row) => ({
          stageId: row.stageId,
          stageName:
            row.stageId === 'C10:NEW'
              ? 'База входящая'
              : row.stageId === 'C10:PREPARATION'
                ? 'Звонок-знакомство'
                : row.stageId,
          maxDaysOnStage: row.maxDaysOnStage,
        })),
        noCallsMaxDays: input.noCallsMaxDays,
        noActivityMaxDays: input.noActivityMaxDays,
        slaBusinessHours: input.slaBusinessHours,
        updatedAt: '2026-04-10T12:05:00.000Z',
      }),
    ),
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

function createSceneFilters(
  overrides: Partial<ProtoFilterState> = {},
): ProtoFilterState {
  return {
    rangeStart: '2026-07-01',
    rangeEnd: '2026-07-05',
    compareRanges: [],
    managers: [],
    sources: [],
    businessClubs: [],
    targetGroups: [],
    ...overrides,
  }
}

const readyRuntimeData: ProtoRuntimeData = {
  managerOptions: [],
  sourceOptions: [],
  operationalStatus: 'ready',
  operationalError: null,
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
      screen.getByRole('button', { name: /^режим комментариев$/i }),
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

  it('renders the operational dashboard tab with risks, SLA and filters', async () => {
    render(<App />)
    await waitForDashboardShell()

    const analyticsTabs = document.querySelector('[aria-label="Аналитические дашборды"]')
    expect(analyticsTabs?.querySelector('button')?.textContent).toBe('Операционный')

    fireEvent.click(await screen.findByRole('button', { name: /операционный/i }))

    await waitFor(() =>
      expect(apiClient.getOperationalDashboardReport).toHaveBeenCalledWith(
        expect.objectContaining({ preset: 'custom' }),
      ),
    )
    expect(screen.getAllByText('Создано').length).toBeGreaterThan(0)
    expect(screen.getByText('37')).toBeInTheDocument()
    expect(screen.getAllByText('Встреча 1').length).toBeGreaterThan(0)
    expect(screen.getByText('28')).toBeInTheDocument()
    expect(screen.getByText('ClubFirst Russia')).toBeInTheDocument()
    expect(screen.getByText(/Порог 5 ч из настроек/i)).toBeInTheDocument()
    const criticalRiskChip = screen.getByRole('button', { name: /Критично · 1/i })
    expect(criticalRiskChip).toBeInTheDocument()
    expect(criticalRiskChip).not.toHaveAttribute('title')
    const slaHintButton = screen.getByRole('button', {
      name: /Как считается: SLA первого касания/i,
    })
    expect(slaHintButton).toBeInTheDocument()
    expect(slaHintButton).not.toHaveAttribute('title')
    expect(screen.getByText(/CRM-активность - дело\/активность в карточке сделки/i)).toBeInTheDocument()

    const dealLink = screen.getByRole('link', { name: /Сделка #48213/i })
    expect(dealLink).toHaveAttribute(
      'href',
      'https://example.bitrix24.ru/crm/deal/details/48213/',
    )

    for (const blockId of [
      'attraction-operations-summary',
      'attraction-operations-flow',
      'attraction-operations-sla-planned',
      'attraction-operations-stage-wip',
      'attraction-operations-risks',
      'attraction-operations-managers',
    ]) {
      expect(document.querySelector(`[data-comment-block-id="${blockId}"]`)).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', { name: /Без дел · 1/i }))
    expect(screen.queryByText(/Сделка #48213/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Сделка #48544/i)).toBeInTheDocument()
  })

  it('renders the source cohort conversion tab with month selector and manager breakdown', async () => {
    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /^конверсии$/i }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /^конверсии$/i }),
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
    expect(
      screen.getByRole('heading', { name: /конверсии по этапам и фактам/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /диагностика переходов/i })).toBeInTheDocument()
    expect(screen.getAllByText(/фактическая цепочка/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/где разрывается движение/i)).toBeInTheDocument()
    expect(screen.getByText(/этап встречи в CRM/i)).toBeInTheDocument()
    expect(screen.getByText(/нет успешного звонка/i)).toBeInTheDocument()
    expect(screen.getByText(/почему после дозвона не назначили встречу/i)).toBeInTheDocument()
    expect(screen.queryByText(/successful_call_without_meeting_stage/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /сроки и зависания/i })).toBeInTheDocument()
    expect(screen.getAllByText(/нет факта/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/норма 3 дн/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/медленно/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/no_fact/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /траектория участника/i })).toBeInTheDocument()
    expect(screen.getAllByText(/первый успешный звонок/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/повторные мероприятия/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/контракт/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /сроки на этапах/i })).toBeInTheDocument()
    expect(screen.getAllByText(/CRM-встреча без факта/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/звонок позже нормы/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/зависли на контракте/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/после встречи без движения/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /диагностика менеджеров/i })).toBeInTheDocument()
    expect(screen.getByText(/оценка по текущему ответственному сделки/i)).toBeInTheDocument()
    expect(screen.getByText(/Проверить назначение встреч/i)).toBeInTheDocument()
    expect(screen.queryByText(/повторные события/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/meeting_stage_without_fact/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Анастасия Кузнецова/i).length).toBeGreaterThan(0)

    const trajectoryBlock = document.querySelector(
      '[data-comment-block-id="attraction-source-cohort-trajectory-conversions"]',
    )
    expect(trajectoryBlock).toBeInTheDocument()
    expect(
      within(trajectoryBlock as HTMLElement).getByRole('columnheader', { name: 'Проигрыш' }),
    ).toBeInTheDocument()
    expect(
      within(trajectoryBlock as HTMLElement).queryByRole('columnheader', { name: 'Корзина' }),
    ).not.toBeInTheDocument()

    const successfulCallHintButton = within(trajectoryBlock as HTMLElement).getAllByRole('button', {
      name: /Считается первый прямой доверенный исходящий звонок/i,
    })[0]
    expect(successfulCallHintButton).toBeDefined()
    const successfulCallHintButtonElement = successfulCallHintButton as HTMLElement
    fireEvent.focus(successfulCallHintButtonElement)
    const successfulCallTooltip = screen.getByRole('tooltip')
    expect(successfulCallTooltip).toHaveTextContent(/Короткие соединения и неуспешные попытки/i)
    expect(successfulCallTooltip).toHaveClass('fixed')
    expect(trajectoryBlock as HTMLElement).not.toContainElement(successfulCallTooltip)
    fireEvent.blur(successfulCallHintButtonElement)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.click(
      within(trajectoryBlock as HTMLElement).getByRole('button', { name: 'Источники' }),
    )
    expect(
      screen.getByRole('heading', { name: /какие источники где теряют движение/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Лидген УС').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/профиль потерь/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/терминальный проигрыш/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/какая причина проигрыша повторяется/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Егоров Андрей/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/terminal_loss/i)).not.toBeInTheDocument()

    fireEvent.click(
      within(trajectoryBlock as HTMLElement).getByRole('button', { name: 'Заказчики' }),
    )
    expect(
      screen.getByRole('heading', { name: /какие заказчики как проходят траекторию/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/контракт без продажи/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/что блокирует закрытие контракта/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /раскрыть строку/i }))
    expect(screen.getByText(/Егоров Андрей/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /по менеджерам/i }))
    expect(await screen.findByText(/1 разрез/i)).toBeInTheDocument()
    expect(screen.getByText(/Егоров Андрей/i)).toBeInTheDocument()
    expect(apiClient.getAttractionOntology).not.toHaveBeenCalled()
  })

  it('passes customer filters into the source cohort conversion tab request', async () => {
    render(
      <SourceCohortsScene
        commentMode={false}
        filters={{
          rangeStart: '2026-07-01',
          rangeEnd: '2026-07-05',
          compareRanges: [],
          managers: [],
          sources: ['LIDGEN'],
          businessClubs: ['ClubFirst One'],
          targetGroups: ['ClubFirst Future'],
        }}
      />,
    )

    await waitFor(() =>
      expect(apiClient.getSourceCohortConversionReport).toHaveBeenCalledWith(
        expect.objectContaining({
          businessClubKeys: ['ClubFirst One'],
          targetGroupKeys: ['ClubFirst Future'],
        }),
      ),
    )
  })

  it('reloads the revenue velocity scene when customer filters change', async () => {
    const initialFilters = createSceneFilters()
    const customerFilters = createSceneFilters({
      businessClubs: ['ClubFirst One'],
      targetGroups: ['ClubFirst Future'],
    })
    const { rerender } = render(
      <RevenueVelocityScene
        filters={initialFilters}
        runtimeData={readyRuntimeData}
        commentMode={false}
      />,
    )

    await waitFor(() => expect(apiClient.getRevenueVelocityReport).toHaveBeenCalled())
    vi.mocked(apiClient.getRevenueVelocityReport).mockClear()

    rerender(
      <RevenueVelocityScene
        filters={customerFilters}
        runtimeData={readyRuntimeData}
        commentMode={false}
      />,
    )

    await waitFor(() =>
      expect(apiClient.getRevenueVelocityReport).toHaveBeenCalledWith(
        expect.objectContaining({
          businessClubKeys: ['ClubFirst One'],
          targetGroupKeys: ['ClubFirst Future'],
        }),
      ),
    )
  })

  it('reloads the unit economics scene when customer filters change', async () => {
    const initialFilters = createSceneFilters()
    const customerFilters = createSceneFilters({
      businessClubs: ['ClubFirst One'],
      targetGroups: ['ClubFirst Future'],
    })
    const { rerender } = render(
      <UnitEconomicsScene
        filters={initialFilters}
        runtimeData={readyRuntimeData}
        commentMode={false}
      />,
    )

    await waitFor(() => expect(apiClient.getUnitEconomicsReport).toHaveBeenCalled())
    vi.mocked(apiClient.getUnitEconomicsReport).mockClear()

    rerender(
      <UnitEconomicsScene
        filters={customerFilters}
        runtimeData={readyRuntimeData}
        commentMode={false}
      />,
    )

    await waitFor(() =>
      expect(apiClient.getUnitEconomicsReport).toHaveBeenCalledWith(
        expect.objectContaining({
          businessClubKeys: ['ClubFirst One'],
          targetGroupKeys: ['ClubFirst Future'],
        }),
      ),
    )
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
      trajectoryStatus: 'unavailable',
      trajectoryUnavailableReason: 'Траектория конверсии не рассчитана для этого ответа.',
    }
    vi.mocked(apiClient.getSourceCohortConversionReport).mockResolvedValue(loadedReport)

    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /^конверсии$/i }),
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
    const emptySourceCohortReport: SourceCohortConversionReport = {
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
      trajectoryStatus: 'unavailable',
      trajectoryUnavailableReason: 'В выбранной когорте нет сделок.',
      comparisons: [],
    }
    vi.mocked(apiClient.getSourceCohortConversionReport)
      .mockResolvedValueOnce(emptySourceCohortReport)
      .mockResolvedValueOnce(emptySourceCohortReport)

    render(<App />)
    await waitForDashboardShell()

    fireEvent.click(
      await screen.findByRole('button', { name: /^конверсии$/i }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /^конверсии$/i }),
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
