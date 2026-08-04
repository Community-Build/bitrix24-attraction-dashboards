import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/lib/api-client'
import type {
  AttractionOntologyResponse,
  DashboardData,
  ConversionEventTypeSettingsInput,
  DealPricingRuleInput,
  ManagerWhitelistSettingsInput,
  MetaResponse,
  OperationalThresholdSettingsInput,
  SalesPlanData,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
  UnitEconomicsCostRulesInput,
  UnitEconomicsReport,
  UnitEconomicsSettings,
} from '@/lib/dashboard-types'
import { createCompareRange, ProtoApp } from '@/proto/proto-app'
import { createDefaultCallAnalysisFilters } from '@/proto/call-analysis-workspace'
import { createDefaultFilters } from '@/proto/scene-registry'
import type { AuthUser, PaperclipThreadEntry } from '@/proto/types'

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined
  let reject: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

function formatExpectedDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', { hour12: false })
}

async function openAccountTab(name: RegExp) {
  await userEvent.click(await screen.findByRole('tab', { name }))
}

async function openSalesScene() {
  await userEvent.click(await screen.findByRole('button', { name: /^отчет по продажам$/i }))
}

function renderProtoAppAt(value: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(value))
  const result = render(<ProtoApp />)
  vi.useRealTimers()
  return result
}

vi.mock('@/lib/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number | undefined
    readonly payload: unknown

    constructor(message: string, status?: number, payload?: unknown) {
      super(message)
      this.name = 'ApiClientError'
      this.status = status
      this.payload = payload
    }
  },
  apiClient: {
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
    getLeadgenFunnelReport: vi.fn(async () => ({
      range: {
        from: '2026-04-01T00:00:00.000+03:00',
        to: '2026-04-30T23:59:59.999+03:00',
      },
      totalDeals: 4,
      createdDeals: 4,
      activeDeals: 3,
      closedDeals: 1,
      stageRows: [
        {
          stageId: 'C28:NEW',
          stageName: 'Новый лид',
          sortOrder: 10,
          activeDeals: 3,
          createdDeals: 4,
          closedDeals: 1,
        },
      ],
      sourceRows: [
        {
          sourceKey: 'WEB',
          sourceLabel: 'Сайт',
          dealCount: 4,
        },
      ],
      utmRows: [
        {
          utmSource: 'google',
          utmMedium: 'cpc',
          utmCampaign: 'leadgen-us',
          dealCount: 4,
        },
      ],
      managerRows: [
        {
          managerId: '501',
          managerName: 'Лидген менеджер',
          dealCount: 4,
        },
      ],
      reasonRows: [
        {
          reasonKey: 'Корзина',
          reasonLabel: 'Корзина',
          dealCount: 1,
        },
      ],
      warnings: [],
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
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
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
      options: [
        {
          id: '13020',
          name: 'Илья Какулия',
        },
        {
          id: '78',
          name: 'Егоров Андрей',
        },
      ],
      settings: [
        {
          moduleKey: 'attraction',
          managerId: '13020',
          managerName: 'Илья Какулия',
          enabled: true,
          sortOrder: 0,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
        {
          moduleKey: 'attraction',
          managerId: '78',
          managerName: 'Егоров Андрей',
          enabled: true,
          sortOrder: 10,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })),
    saveManagerWhitelistSettings: vi.fn(async (input: ManagerWhitelistSettingsInput) => ({
      options: [
        {
          id: '13020',
          name: 'Илья Какулия',
        },
        {
          id: '78',
          name: 'Егоров Андрей',
        },
      ],
      settings: input.managerIds.map((managerId, index) => ({
        moduleKey: 'attraction',
        managerId,
        managerName: managerId === '13020' ? 'Илья Какулия' : 'Егоров Андрей',
        enabled: true,
        sortOrder: index * 10,
        updatedAt: '2026-04-10T12:05:00.000Z',
        teamId:
          input.teams?.find((team) => team.managerIds.includes(managerId))?.id ??
          input.teams?.find((team) => team.managerIds.includes(managerId))?.name ??
          null,
        teamName:
          input.teams?.find((team) => team.managerIds.includes(managerId))?.name ??
          null,
      })),
      teams: input.teams ?? [],
    })),
    getUnitEconomicsSettings: vi.fn(async () => createUnitEconomicsSettings()),
    saveUnitEconomicsCostRules: vi.fn(async (input: UnitEconomicsCostRulesInput) => ({
      ...createUnitEconomicsSettings(input.rules),
      eventParticipantMode: input.eventParticipantMode ?? 'invited',
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getUnitEconomicsReport: vi.fn(async () => createUnitEconomicsReport()),
    getSalesPlan: vi.fn(async () => ({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [],
      updatedAt: null,
    })),
    saveSalesPlan: vi.fn(async (input: SalesPlanInput) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: input.rows.map((row) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        plannedDeals: row.plannedDeals,
        plannedAmount: row.plannedAmount,
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
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
      rows: input.rows.map((row) => ({
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        quarterPlannedDeals: row.quarterPlannedDeals,
        quarterPlannedAmount: row.quarterPlannedAmount,
        months: row.months.map((month) => ({
          month: month.month,
          periodStart: `${month.month}-01T00:00:00.000+03:00`,
          periodEnd: `${month.month}-30T23:59:59.999+03:00`,
          plannedDeals: month.plannedDeals,
          plannedAmount: month.plannedAmount,
          updatedAt: '2026-04-10T12:05:00.000Z',
        })),
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getOperationalDashboardReport: vi.fn(async () => ({
      range: {
        from: '2026-04-01T00:00:00.000+03:00',
        to: '2026-04-30T23:59:59.999+03:00',
      },
      generatedAt: '2026-04-30T12:00:00.000Z',
      currentScope: {
        status: 'ready' as const,
        reconciledAt: '2026-04-30T11:55:00.000Z',
        dealCount: 0,
      },
      createdDeals: 0,
      meetingsHeld: {
        total: 0,
        bySlot: [
          { slotIndex: 1, slotLabel: 'Встреча 1', count: 0 },
          { slotIndex: 2, slotLabel: 'Встреча 2', count: 0 },
          { slotIndex: 3, slotLabel: 'Встреча 3', count: 0 },
        ],
      },
      sales: {
        total: 0,
        byClub: [],
      },
      lostDeals: 0,
      openDeals: 0,
      riskSummary: {
        total: 0,
        critical: 0,
        risk: 0,
        byRule: [],
        byStage: [],
      },
      stageWip: [],
      sla: [
        {
          slaKey: 'sla2',
          label: 'Первый контакт',
          thresholdBusinessHours: 5,
          onTimeCount: 0,
          lateCount: 0,
          noTouchCount: 0,
          medianHours: 0,
        },
      ],
      planned: {
        meetingsToday: [
          { slotIndex: 1, slotLabel: 'Встреча 1', count: 0 },
          { slotIndex: 2, slotLabel: 'Встреча 2', count: 0 },
          { slotIndex: 3, slotLabel: 'Встреча 3', count: 0 },
        ],
        meetingsTomorrow: [
          { slotIndex: 1, slotLabel: 'Встреча 1', count: 0 },
          { slotIndex: 2, slotLabel: 'Встреча 2', count: 0 },
          { slotIndex: 3, slotLabel: 'Встреча 3', count: 0 },
        ],
        tasksToday: 0,
        tasksTomorrow: 0,
      },
      managers: [],
      risks: [],
      thresholdsUpdatedAt: null,
    })),
    getActivitiesWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    })),
    getMessengerReportSummary: vi.fn(async (input: {
      managerIds: string[]
      from: string
      to: string
    }) => ({
      from: input.from,
      to: input.to,
      totalMessages: 0,
      outgoingMessages: 0,
      outgoingUnknownAuthorMessages: 0,
      incomingMessages: 0,
      unknownDirectionMessages: 0,
      uniqueOutgoingDialogs: 0,
      dealsWithOutgoingMessages: 0,
      messagesWithText: 0,
      attachmentOnlyMessages: 0,
      uniqueDialogs: 0,
      dealsWithMessages: 0,
      systemMessagesExcluded: 0,
      managerRows: [],
      directionAvailable: false as const,
      personalAuthorAvailable: false,
    })),
    getLeadgenActivitiesWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000+03:00', to: '2026-04-30T23:59:59.999+03:00' },
      totalDealCount: 4,
      totalCreatedCount: 12,
      totalRescheduledCount: 0,
      totalClosedCount: 9,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [
        {
          managerId: '501',
          managerName: 'Лидген менеджер',
          dealCount: 4,
          createdCount: 12,
          rescheduledCount: 0,
          closedCount: 9,
          meetingCount: 0,
          averageCreatedPerDeal: 3,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 2.25,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [
            {
              stageId: 'C28:NEW',
              stageName: 'Новый лид',
              dealCount: 4,
              createdCount: 12,
              rescheduledCount: 0,
              closedCount: 9,
              averageCreatedPerDeal: 3,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 2.25,
            },
          ],
        },
      ],
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
    getCallsWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCalls: 0,
      totalIncomingCalls: 0,
      totalOutgoingCalls: 0,
      totalConnectedCalls: 0,
      totalFailedCalls: 0,
      totalCallsOverThirtySeconds: 0,
      totalConnectedCallsOverThirtySeconds: 0,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })),
    getCallAnalysisQueue: vi.fn(async () => ({
      range: {
        from: '2026-06-09T00:00:00.000+03:00',
        to: '2026-06-09T23:59:59.999+03:00',
      },
      totals: {
        total: 1,
        notAnalyzed: 0,
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
        },
      ],
    })),
    getCallAnalysis: vi.fn(async () => ({
      status: 'ready',
      result: {
        callId: '221930',
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
          score: 88,
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
            score: 92,
            rationale: 'Менеджер слушает клиента.',
            evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
          },
          narrativeScore: {
            score: 84,
            rationale: 'Нарратив раскрыт частично.',
            evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
            applicableNarratives: ['Квалификация'],
            missedNarratives: ['Club First как социальная инфраструктура'],
          },
          callTypeInterpretation: 'Исходящий звонок больше 30 секунд.',
          summary: 'Менеджер провел диагностику и обозначил следующий шаг.',
          strengths: ['Есть открытый вопрос'],
          risks: ['Следующий шаг без даты'],
          nextStepQuality: 'ok',
          suggestedNextStep: 'Назначить дату следующего контакта.',
          emotionalBackground: {
            managerTone: 'спокойный',
            clientTone: 'нейтральный',
            frictionSignals: [],
            confidence: 0.8,
          },
          evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
          confidence: 0.86,
        },
        rawAiEvaluation: {
          score: 88,
          communicationScore: { score: 92 },
          narrativeScore: { score: 84 },
        },
        attributes: {
          managerName: 'Мария',
          dealId: '23841',
          stageAtCallName: 'Квалификация',
        },
        model: 'google/gemini-3.5-flash',
        promptVersion: 'calls-v2',
        analyzedAt: '2026-06-09T12:00:30.000Z',
        updatedAt: '2026-06-09T12:00:31.000Z',
      },
    })),
    analyzeCall: vi.fn(async () => ({
      status: 'ready',
      reusedExistingResult: true,
      result: {
        callId: '221930',
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
          score: 88,
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
            score: 92,
            rationale: 'Менеджер слушает клиента.',
            evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
          },
          narrativeScore: {
            score: 84,
            rationale: 'Нарратив раскрыт частично.',
            evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
            applicableNarratives: ['Квалификация'],
            missedNarratives: ['Club First как социальная инфраструктура'],
          },
          callTypeInterpretation: 'Исходящий звонок больше 30 секунд.',
          summary: 'Менеджер провел диагностику и обозначил следующий шаг.',
          strengths: ['Есть открытый вопрос'],
          risks: ['Следующий шаг без даты'],
          nextStepQuality: 'ok',
          suggestedNextStep: 'Назначить дату следующего контакта.',
          emotionalBackground: {
            managerTone: 'спокойный',
            clientTone: 'нейтральный',
            frictionSignals: [],
            confidence: 0.8,
          },
          evidenceQuotes: ['Расскажите, что сейчас не устраивает?'],
          confidence: 0.86,
        },
        rawAiEvaluation: {
          score: 88,
          communicationScore: { score: 92 },
          narrativeScore: { score: 84 },
        },
        attributes: {
          managerName: 'Мария',
          dealId: '23841',
          stageAtCallName: 'Квалификация',
        },
        model: 'google/gemini-3.5-flash',
        promptVersion: 'calls-v2',
        analyzedAt: '2026-06-09T12:00:30.000Z',
        updatedAt: '2026-06-09T12:00:31.000Z',
      },
    })),
    getLeadgenCallsWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000+03:00', to: '2026-04-30T23:59:59.999+03:00' },
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
      managerRows: [
        {
          managerId: '501',
          managerName: 'Лидген менеджер',
          dealCount: 4,
          totalCalls: 18,
          incomingCalls: 2,
          outgoingCalls: 16,
          otherOutgoingCalls: 3,
          connectedCalls: 12,
          failedCalls: 4,
          callsOverThirtySeconds: 10,
          connectedCallsOverThirtySeconds: 9,
          averageCallsPerDeal: 4.5,
          averageDurationSeconds: 72,
          stageBreakdown: [
            {
              stageId: 'C28:NEW',
              stageName: 'Новый лид',
              dealCount: 4,
              totalCalls: 18,
              incomingCalls: 2,
              outgoingCalls: 16,
              otherOutgoingCalls: 3,
              connectedCalls: 12,
              failedCalls: 4,
              callsOverThirtySeconds: 10,
              connectedCallsOverThirtySeconds: 9,
              averageCallsPerDeal: 4.5,
              averageDurationSeconds: 72,
            },
          ],
        },
      ],
      comparisons: [],
    })),
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
      businessDays: 0,
      warnings: [],
      estimatedGainPerDay: null,
      rows: [],
      bottleneck: null,
      comparisons: [],
    })),
    getAttractionOntology: vi.fn(async () => ({
      moduleKey: 'attraction' as const,
      title: 'Онтология Привлечения',
      governance: {
        decisionRole: 'Технолог бизнес-процессов',
        decisionUnit: 'Центр Технологизации',
      },
      lastReviewedAt: '2026-05-29',
      sources: [],
      concepts: [],
      transitions: [],
      reportBindings: [],
      drift: [],
    })),
    getRevenueVelocityReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      asOf: '2026-04-30T23:59:59.999Z',
      dimension: 'manager',
      actionWeights: {
        connectedCallOverThirtySeconds: 1,
        meeting: 3,
        conversionEvent: 5,
        closedTask: 0.5,
      },
      totals: {
        dimension: 'manager',
        key: 'total',
        label: 'Итого',
        managerId: null,
        managerName: null,
        sourceKey: null,
        sourceLabel: null,
        customerKey: null,
        customerLabel: null,
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
    })),
    triggerSync: vi.fn(async () => ({
      syncRunId: 1,
      leadsSynced: 0,
      dealsSynced: 12,
      mode: 'delta',
      modifiedAfter: '2026-04-19T16:19:09.990Z',
      finishedAt: '2026-04-26T16:00:00.000Z',
      snapshotBefore: {
        deals: 10,
        activities: 20,
        calls: 30,
        stageHistory: 40,
      },
      snapshotAfter: {
        deals: 22,
        activities: 25,
        calls: 34,
        stageHistory: 45,
      },
      changes: {
        deals: 12,
        activities: 5,
        calls: 4,
        stageHistory: 5,
        managers: 1,
      },
      diagnostics: ['dealCursor=2026-04-26T16:00:00.000Z'],
    })),
    getComments: vi.fn(async () => ({ comments: [], updatedAt: null })),
    createComment: vi.fn(async (input: unknown) => ({
      comment: {
        ...(input as object),
        id: 'comment-1',
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:00:00.000Z',
        status: 'open',
        archivedAt: null,
        paperclipStatus: 'sent',
        paperclipSyncStatus: 'sent',
      },
    })),
    updateComment: vi.fn(async (id: string, input: unknown) => ({
      comment: {
        ...(input as object),
        id,
        sceneId: 'sales',
        x: 0.1,
        y: 0.1,
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:05:00.000Z',
        status: 'open',
        archivedAt: null,
      },
    })),
    archiveComment: vi.fn(async (id: string) => ({
      comment: {
        id,
        sceneId: 'sales',
        x: 0.1,
        y: 0.1,
        text: 'Архив',
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:05:00.000Z',
        status: 'archived',
        archivedAt: '2026-04-10T12:05:00.000Z',
      },
    })),
    retryComment: vi.fn(async (id: string) => ({
      comment: {
        id,
        sceneId: 'sales',
        x: 0.1,
        y: 0.1,
        text: 'Повтор',
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:05:00.000Z',
        status: 'open',
        archivedAt: null,
        paperclipStatus: 'sent',
        paperclipSyncStatus: 'sent',
      },
    })),
    reworkComment: vi.fn(async (id: string) => ({
      comment: {
        id,
        sceneId: 'sales',
        x: 0.1,
        y: 0.1,
        text: 'На доработку',
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:05:00.000Z',
        status: 'open',
        archivedAt: null,
        paperclipStatus: 'in_work',
        paperclipSyncStatus: 'sent',
      },
    })),
    getCommentNotifications: vi.fn(async () => ({
      notifications: [],
    })),
    updateCurrentUser: vi.fn(async (input: { firstName?: string; lastName?: string }) => ({
      user: {
        id: 1,
        login: 'leader@example.com',
        firstName: input.firstName ?? 'Мария',
        lastName: input.lastName ?? 'Потапова',
        role: 'admin' as const,
        modules: [],
      },
    })),
    changeCurrentPassword: vi.fn(async () => undefined),
    getModuleUsers: vi.fn(async () => ({
      users: [],
    })),
    createModuleUser: vi.fn(async (input: { login: string; role: 'leader' | 'employee'; defaultManagerId?: string | null }) => ({
      user: {
        id: 2,
        login: input.login,
        firstName: null,
        lastName: null,
        disabled: false,
        moduleId: 'attraction',
        moduleRole: input.role,
        membershipStatus: 'active',
        defaultManagerId: input.defaultManagerId ?? null,
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:00:00.000Z',
      },
    })),
    updateModuleUser: vi.fn(async (id: number, input: { role?: 'leader' | 'employee'; defaultManagerId?: string | null }) => ({
      user: {
        id,
        login: 'employee@example.com',
        firstName: null,
        lastName: null,
        disabled: false,
        moduleId: 'attraction',
        moduleRole: input.role ?? 'employee',
        membershipStatus: 'active',
        defaultManagerId: input.defaultManagerId ?? null,
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:05:00.000Z',
      },
    })),
    deleteModuleUser: vi.fn(async (id: number) => ({
      user: {
        id,
        login: 'employee@example.com',
        firstName: null,
        lastName: null,
        disabled: false,
        moduleId: 'attraction',
        moduleRole: 'employee',
        membershipStatus: 'disabled',
        defaultManagerId: null,
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-10T12:05:00.000Z',
      },
    })),
    getPlatformAccess: vi.fn(async () => ({
      modules: [],
      users: [],
    })),
    updatePlatformUserMemberships: vi.fn(
      async (
        id: number,
        memberships: Array<{
          moduleId: string
          role: 'leader' | 'employee'
          status: 'active' | 'disabled'
        }>,
      ) => ({
        user: {
          id,
          login: 'employee@example.com',
          firstName: null,
          lastName: null,
          disabled: false,
          isSuperAdmin: false,
          memberships: memberships.map((membership) => ({
            id,
            login: 'employee@example.com',
            firstName: null,
            lastName: null,
            disabled: false,
            moduleId: membership.moduleId,
            moduleRole: membership.role,
            membershipStatus: membership.status,
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:05:00.000Z',
          })),
        },
      }),
    ),
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

function createQuarterSalesPlan(
  rows: SalesPlanQuarterData['rows'] = [],
): SalesPlanQuarterData {
  return {
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
    rows,
    updatedAt: rows[0]?.updatedAt ?? null,
  }
}

function createSalesDashboard(salesCount: number): DashboardData {
  return {
    salesSummary: {
      salesCount,
      salesAmount: 0,
      averageSaleAmount: 0,
      attractionRevenueAmount: 0,
      averageAttractionRevenueAmount: 0,
      membershipAmount: 0,
      averageMembershipAmount: 0,
      pricingWarnings: [],
      newDealsCount: 0,
      conversionRate: 0,
      meetingsCount: 0,
    },
    managerGroups: [],
    comparisons: [],
  }
}

function createUnitEconomicsSettings(
  rules: UnitEconomicsSettings['rules'] = [
    {
      id: 'leadgen-ready-to-meet',
      articleId: 'lead_purchase',
      pnlLevel: 'variable_contribution',
      costBehavior: 'variable',
      calculationMethod: 'amount_per_lead',
      unitPrice: 40000,
      percent: null,
      amount: null,
      sourceKey: 'Лидген УС',
      qualityValue: 'Готов к встрече',
      eventNamePattern: null,
      enabled: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      sortOrder: 10,
    },
    {
      id: 'contractation-per-won-default',
      articleId: 'contractation',
      pnlLevel: 'variable_contribution',
      costBehavior: 'variable',
      calculationMethod: 'amount_per_contract',
      unitPrice: 5000,
      percent: null,
      amount: null,
      sourceKey: null,
      qualityValue: null,
      eventNamePattern: null,
      enabled: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      sortOrder: 20,
    },
    {
      id: 'guest-meeting-participant-default',
      articleId: 'demo_events',
      pnlLevel: 'variable_contribution',
      costBehavior: 'variable',
      calculationMethod: 'amount_per_participant',
      unitPrice: 5000,
      percent: null,
      amount: null,
      sourceKey: null,
      qualityValue: null,
      eventNamePattern: 'Гостевая встреча',
      enabled: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      sortOrder: 30,
    },
    {
      id: 'other-conversion-event-participant-default',
      articleId: 'demo_events',
      pnlLevel: 'variable_contribution',
      costBehavior: 'variable',
      calculationMethod: 'amount_per_participant',
      unitPrice: 15000,
      percent: null,
      amount: null,
      sourceKey: null,
      qualityValue: null,
      eventNamePattern: null,
      enabled: true,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      sortOrder: 40,
    },
  ],
): UnitEconomicsSettings {
  return {
    articles: [
      {
        id: 'lead_purchase',
        name: 'Закупка лидов',
        pnlLevel: 'variable_contribution',
        costBehavior: 'variable',
        calculationMethod: 'amount_per_lead',
        enabled: true,
        sortOrder: 10,
        effectiveFrom: null,
        effectiveTo: null,
        updatedAt: null,
      },
      {
        id: 'contractation',
        name: 'Контрактация',
        pnlLevel: 'variable_contribution',
        costBehavior: 'variable',
        calculationMethod: 'amount_per_contract',
        enabled: true,
        sortOrder: 50,
        effectiveFrom: null,
        effectiveTo: null,
        updatedAt: null,
      },
      {
        id: 'demo_events',
        name: 'Демо-мероприятия',
        pnlLevel: 'variable_contribution',
        costBehavior: 'variable',
        calculationMethod: 'amount_per_participant',
        enabled: true,
        sortOrder: 40,
        effectiveFrom: null,
        effectiveTo: null,
        updatedAt: null,
      },
      {
        id: 'facility',
        name: 'Facility / АХО',
        pnlLevel: 'above_ebitda',
        costBehavior: 'fixed',
        calculationMethod: 'amount_per_period',
        enabled: true,
        sortOrder: 140,
        effectiveFrom: null,
        effectiveTo: null,
        updatedAt: null,
      },
    ],
    rules,
    eventParticipantMode: 'invited',
    updatedAt: null,
  }
}

function createUnitEconomicsReport(): UnitEconomicsReport {
  return {
    range: {
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
    },
    summary: {
      createdDeals: 3,
      wonDeals: 2,
      purchasedLeads: 2,
      attractionRevenue: 300000,
      clubRevenue: 1500000,
      leadPurchaseCost: 80000,
      eventCost: 5000,
      ambassadorActivityCost: 0,
      ctuCertificateCost: 0,
      contractationCost: 10000,
      otherVariableCost: 0,
      variableCosts: 140000,
      contributionResult: 160000,
      contributionMargin: 0.5333333333333333,
      aboveEbitdaCosts: 173000,
      ebitda: -13000,
      ebitdaMargin: -0.043333333333333335,
      belowEbitdaCosts: 6000,
      netProfit: -19000,
      netProfitMargin: -0.06333333333333334,
      attractionAverageCheck: 150000,
      clubAverageCheck: 750000,
      costPerWonDeal: 156500,
      costPerCreatedDeal: 104333.33,
    },
    sourceQualityRows: [
      {
        sourceKey: 'Лидген УС',
        sourceLabel: 'Лидген УС',
        qualityValue: 'Готов к встрече',
        createdDeals: 2,
        wonDeals: 2,
        purchasedLeads: 2,
        attractionRevenue: 300000,
        clubRevenue: 1500000,
        leadPurchaseCost: 80000,
        contractationCost: 10000,
        variableCosts: 140000,
        financialResult: 160000,
        margin: 0.5333333333333333,
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
        clubRevenue: 1500000,
        leadPurchaseCost: 80000,
        eventCost: 5000,
        ambassadorActivityCost: 0,
        ctuCertificateCost: 0,
        contractationCost: 10000,
        variableCosts: 140000,
        financialResult: -19000,
        margin: -0.06333333333333334,
        warnings: [],
        revenueRows: [
          {
            clubLabel: 'ClubFirst One',
            tariffLabel: 'Федеральный',
            wonDeals: 1,
            attractionRevenue: 300000,
            clubRevenue: 1500000,
          },
        ],
        productionCostRows: [
          {
            articleId: 'lead_purchase',
            articleLabel: 'Лидогенерация',
            productLabel: 'Лидген УС · Готов к встрече',
            quantity: 2,
            unitLabel: 'лид',
            unitPrice: 40000,
            percent: null,
            amount: 80000,
            basis: 'Созданные сделки периода',
            warnings: [],
          },
          {
            articleId: 'sales_bonus',
            articleLabel: 'Бонусы за продажу',
            productLabel: 'Бонусы за продажу',
            quantity: null,
            unitLabel: null,
            unitPrice: null,
            percent: 4,
            amount: 60000,
            basis: 'Стоимость членства клуба',
            warnings: [],
          },
        ],
        directCostRows: [
          {
            articleId: 'demo_events',
            articleLabel: 'Демо-мероприятия',
            productLabel: 'Гостевая встреча ClubFirst',
            quantity: 1,
            unitLabel: 'участник',
            unitPrice: 5000,
            percent: null,
            amount: 5000,
            basis: 'Приглашенные участники периода',
            warnings: [],
          },
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
    costRows: [
      {
        articleId: 'lead_purchase',
        label: 'Закупка лидов',
        pnlLevel: 'variable_contribution',
        costBehavior: 'variable',
        calculationMethod: 'amount_per_lead',
        amount: 80000,
        quantity: 2,
        unitPrice: 40000,
        percent: null,
        sourceKey: 'Лидген УС',
        qualityValue: 'Готов к встрече',
        confidence: 'manual',
        sourceSystem: 'rule',
        warnings: [],
      },
    ],
    warnings: [],
    comparisons: [],
  }
}

function createAttractionOntology(
  overrides: Partial<AttractionOntologyResponse> = {},
): AttractionOntologyResponse {
  return {
    moduleKey: 'attraction',
    title: 'Онтология Привлечения',
    governance: {
      decisionRole: 'Технолог бизнес-процессов',
      decisionUnit: 'Центр Технологизации',
    },
    lastReviewedAt: '2026-05-29',
    sources: [],
    concepts: [],
    transitions: [],
    reportBindings: [],
    drift: [],
    ...overrides,
  }
}

function createSalesPlan(plannedDeals: number): SalesPlanData {
  return {
    periodStart: '2026-04-01T00:00:00.000+03:00',
    periodEnd: '2026-04-30T23:59:59.999+03:00',
    rows: [
      {
        periodStart: '2026-04-01T00:00:00.000+03:00',
        periodEnd: '2026-04-30T23:59:59.999+03:00',
        managerId: '78',
        managerName: 'Потапова Мария',
        targetGroupKey: 'ClubFirst Russia',
        targetGroupLabel: 'ClubFirst Russia',
        plannedDeals,
        plannedAmount: 0,
        updatedAt: '2026-04-10T12:00:00.000Z',
      },
    ],
    updatedAt: '2026-04-10T12:00:00.000Z',
  }
}

function createLeadgenOwner(): AuthUser {
  return {
    id: 1,
    login: 'owner@example.com',
    firstName: 'Владислав',
    lastName: 'Богдан',
    role: 'admin',
    isSuperAdmin: true,
    modules: [
      {
        id: 'attraction',
        slug: 'attraction',
        name: 'Привлечение',
        role: 'leader',
        permissions: [
          'comments:create',
          'comments:update',
          'comments:archive',
          'module-users:manage',
        ],
        paperclipCompanyId: null,
        paperclipProjectId: null,
        paperclipGoalId: null,
        paperclipTriageAgentId: null,
      },
      {
        id: 'leadgen',
        slug: 'leadgen',
        name: 'Лидогенерация',
        role: 'leader',
        permissions: [
          'comments:create',
          'comments:update',
          'comments:archive',
          'module-users:manage',
        ],
        bitrixCategoryId: '28',
        paperclipCompanyId: null,
        paperclipProjectId: null,
        paperclipGoalId: null,
        paperclipTriageAgentId: null,
      },
    ],
  }
}

describe('ProtoApp', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.mocked(apiClient.getCommentNotifications).mockReset()
    vi.mocked(apiClient.getCommentNotifications).mockResolvedValue({
      notifications: [],
    })
    window.localStorage.clear()
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
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('renders the prototype shell with comment mode controls', async () => {
    render(<ProtoApp />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^режим комментариев$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/фильтры периода и среза/i)).toBeInTheDocument()
  })

  it('exposes ontology and KI playbook as top-level routes outside analytics scene tabs', async () => {
    render(<ProtoApp />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()

    const routeNav = screen.getByLabelText('Основные разделы дашборда')
    expect(within(routeNav).getByRole('button', { name: /^аналитика$/i })).toHaveClass(
      'tab-chip-active',
    )
    expect(
      within(routeNav).getByRole('button', { name: /^анализ звонков$/i }),
    ).toBeInTheDocument()
    expect(within(routeNav).getByRole('button', { name: /^онтология$/i })).toBeInTheDocument()
    expect(within(routeNav).getByRole('button', { name: /^плейбук ки$/i })).toBeInTheDocument()

    const analyticsTabs = screen.getByLabelText('Аналитические дашборды')
    expect(
      within(analyticsTabs).getByRole('button', { name: /^отчет по продажам$/i }),
    ).toBeInTheDocument()
    expect(
      within(analyticsTabs).getByRole('button', { name: /^движение по воронке$/i }),
    ).toBeInTheDocument()
    expect(
      within(analyticsTabs).queryByRole('button', { name: /^онтология$/i }),
    ).not.toBeInTheDocument()
    expect(
      within(analyticsTabs).queryByRole('button', { name: /^плейбук ки$/i }),
    ).not.toBeInTheDocument()

    await userEvent.click(within(routeNav).getByRole('button', { name: /^онтология$/i }))

    expect(await screen.findByRole('heading', { name: /^онтология$/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(apiClient.getAttractionOntology).toHaveBeenCalled()
    })
    expect(screen.queryByLabelText('Аналитические дашборды')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Фильтры периода и среза$/i)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/ontology')

    await userEvent.click(within(routeNav).getByRole('button', { name: /^плейбук ки$/i }))

    expect(await screen.findByTestId('playbook-scene')).toBeInTheDocument()
    expect(screen.getByTitle('Плейбук Комьюнити-Интегратора')).toHaveAttribute(
      'sandbox',
      'allow-scripts',
    )
    expect(screen.queryByLabelText('Аналитические дашборды')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Фильтры периода и среза$/i)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/playbook')
  })

  it('opens the call analysis section and renders queue analysis data', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^анализ звонков$/i }))

    expect(await screen.findByRole('heading', { name: /^анализ звонков$/i })).toBeInTheDocument()
    await waitFor(() => expect(apiClient.getCallAnalysisQueue).toHaveBeenCalled())
    expect(await screen.findAllByText(/ID 221930/i)).toHaveLength(2)
    expect(await screen.findByText(/Менеджер провел диагностику/i)).toBeInTheDocument()
    expect(screen.getByText(/Добрый день\. Расскажите/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^анализ готов$/i })).toBeDisabled()
    expect(screen.getAllByText('calls-v2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('google/gemini-3.5-flash')).toBeInTheDocument()
    expect(screen.getByText(formatExpectedDateTime('2026-06-09T12:00:30.000Z'))).toBeInTheDocument()
    expect(screen.getByText(/Классификация звонка/i)).toBeInTheDocument()
    expect(screen.getByText('qualification')).toBeInTheDocument()
    expect(screen.getByText(/Применимость prompt/i)).toBeInTheDocument()
    expect(screen.getByText(/Полный квалификационный звонок/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Следующий шаг$/i })).toBeInTheDocument()
    expect(screen.getByText(/Назначить дату следующего контакта/i)).toBeInTheDocument()
    expect(screen.getByText(/Эмоциональный фон/i)).toBeInTheDocument()
    expect(screen.getByText('спокойный')).toBeInTheDocument()
    expect(screen.getByText(/Raw JSON/i)).toBeInTheDocument()
    expect(screen.queryByText(/фильтры периода и среза/i)).not.toBeInTheDocument()
    expect(apiClient.analyzeCall).not.toHaveBeenCalled()
  })

  it('renders call analysis source filter with the shared command popover style', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^анализ звонков$/i }))

    const sourceFilter = await screen.findByRole('button', { name: /^Источник$/i })
    expect(screen.queryByRole('combobox', { name: /^Источник$/i })).not.toBeInTheDocument()

    await userEvent.click(sourceFilter)

    expect(await screen.findByPlaceholderText('Поиск источника')).toBeInTheDocument()
    expect(screen.getAllByText('Источник').length).toBeGreaterThan(0)
    expect(screen.getByText('Платный поиск')).toBeInTheDocument()
  })

  it('defaults call analysis filters to the previous calendar week', () => {
    const filters = createDefaultCallAnalysisFilters(new Date('2026-06-10T12:00:00+03:00'))

    expect(filters.rangeStart).toBe('2026-06-01')
    expect(filters.rangeEnd).toBe('2026-06-07')
  })

  it('clears the visible analysis result immediately when another call is selected', async () => {
    const pendingSecondAnalysis = createDeferred<never>()
    vi.mocked(apiClient.getCallAnalysisQueue).mockResolvedValueOnce({
      range: { from: '2026-06-09T00:00:00.000+03:00', to: '2026-06-09T23:59:59.999+03:00' },
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
        },
        {
          callId: '221931',
          crmActivityId: 'A2',
          startedAt: '2026-06-09T10:10:00.000Z',
          managerId: '8',
          managerName: 'Илья',
          callType: 'incoming',
          callTypeLabel: 'Входящий',
          durationSeconds: 61,
          dealId: '23842',
          dealSourceId: 'SITE',
          dealCurrentStageId: 'C10:NEW',
          dealCurrentStageName: 'Новая',
          stageAtCallId: 'C10:NEW',
          stageAtCallName: 'Новая',
          analysisStatus: 'not_analyzed',
          score: null,
          promptVersion: null,
          model: null,
          analyzedAt: null,
          updatedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      ],
    })
    vi.mocked(apiClient.getCallAnalysis)
      .mockResolvedValueOnce({
        status: 'ready',
        result: {
          callId: '221930',
          runId: 'run-1',
          status: 'ready',
          transcriptByRoles: [
            {
              role: 'manager',
              start: 8,
              end: 16,
              text: 'Первый звонок не должен остаться на экране.',
            },
          ],
          fullTranscriptText: 'Менеджер: Первый звонок не должен остаться на экране.',
          aiEvaluation: {
            score: 88,
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
              score: 92,
              rationale: 'Менеджер слушает клиента.',
              evidenceQuotes: ['Первый звонок не должен остаться на экране.'],
            },
            narrativeScore: {
              score: 84,
              rationale: 'Нарратив раскрыт частично.',
              evidenceQuotes: ['Первый звонок не должен остаться на экране.'],
              applicableNarratives: ['Квалификация'],
              missedNarratives: [],
            },
            callTypeInterpretation: 'Исходящий звонок больше 30 секунд.',
            summary: 'Первый анализ',
            strengths: [],
            risks: [],
            nextStepQuality: 'ok',
            suggestedNextStep: 'Назначить дату следующего контакта.',
            emotionalBackground: {
              managerTone: 'спокойный',
              clientTone: 'нейтральный',
              frictionSignals: [],
              confidence: 0.8,
            },
            evidenceQuotes: ['Первый звонок не должен остаться на экране.'],
            confidence: 0.86,
          },
          rawAiEvaluation: { score: 88 },
          attributes: {},
          model: 'google/gemini-3.5-flash',
          promptVersion: 'calls-v2',
          analyzedAt: '2026-06-09T12:00:30.000Z',
          updatedAt: '2026-06-09T12:00:31.000Z',
        },
      })
      .mockReturnValueOnce(pendingSecondAnalysis.promise)

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^анализ звонков$/i }))
    expect((await screen.findAllByText(/Первый звонок не должен остаться/i)).length).toBeGreaterThan(0)

    await userEvent.click(await screen.findByText(/ID 221931/i))

    expect(screen.queryAllByText(/Первый звонок не должен остаться/i)).toHaveLength(0)
    expect(screen.getByText(/Загружаю оценку/i)).toBeInTheDocument()
  })

  it('applies call analysis filters only after the apply button is pressed', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
      stageCatalog: [
        {
          entityType: 'deal',
          categoryId: '10',
          statusId: 'C10:QUALIFICATION',
          name: 'Квалификация',
          semanticId: 'P',
        },
        {
          entityType: 'deal',
          categoryId: '10',
          statusId: 'C10:CONTRACT',
          name: 'Договор',
          semanticId: 'P',
        },
      ],
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
    })
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^анализ звонков$/i }))
    await screen.findAllByText(/ID 221930/i)

    vi.mocked(apiClient.getCallAnalysisQueue).mockClear()

    const dateFromInput = screen.getByLabelText(/^Дата с$/i)
    fireEvent.change(dateFromInput, { target: { value: '2026-06-08' } })
    await userEvent.click(screen.getByRole('button', { name: /^Этап$/i }))
    const qualificationOptions = await screen.findAllByText('Квалификация')
    await userEvent.click(qualificationOptions.at(-1)!)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(apiClient.getCallAnalysisQueue).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^Применить$/i }))
    await waitFor(() => {
      expect(apiClient.getCallAnalysisQueue).toHaveBeenCalledTimes(1)
    })
    expect(apiClient.getCallAnalysisQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-06-08T00:00:00.000+03:00',
        stageIds: ['C10:QUALIFICATION'],
      }),
      'attraction',
    )
  })

  it('allows rerunning call analysis only when the selected call has an error', async () => {
    vi.mocked(apiClient.getCallAnalysisQueue).mockResolvedValueOnce({
      range: { from: '2026-06-09T00:00:00.000+03:00', to: '2026-06-09T23:59:59.999+03:00' },
      totals: {
        total: 1,
        notAnalyzed: 0,
        analyzing: 0,
        ready: 0,
        error: 1,
        averageScore: null,
      },
      items: [
        {
          callId: '221736',
          crmActivityId: 'activity-221736',
          startedAt: '2026-06-09T13:00:00.000+03:00',
          managerId: '7',
          managerName: 'Мария',
          callType: 'outgoing_over_30',
          callTypeLabel: 'Исх >30',
          durationSeconds: 301,
          dealId: '23841',
          dealSourceId: 'LEADGEN_US',
          dealCurrentStageId: 'C10:NEW',
          dealCurrentStageName: 'Новая',
          stageAtCallId: 'C10:QUALIFICATION',
          stageAtCallName: 'Квалификация',
          analysisStatus: 'error',
          score: null,
          promptVersion: null,
          model: null,
          analyzedAt: null,
          updatedAt: '2026-06-09T13:05:00.000Z',
          errorCode: 'AI_TIMEOUT',
          errorMessage: 'Модель не ответила за отведенное время.',
        },
      ],
    })
    vi.mocked(apiClient.getCallAnalysis).mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^анализ звонков$/i }))

    const retryButton = await screen.findByRole('button', { name: /^повторить после ошибки$/i })
    expect(retryButton).toBeEnabled()

    await userEvent.click(retryButton)

    await waitFor(() => {
      expect(apiClient.analyzeCall).toHaveBeenCalledWith('221736', 'attraction')
    })
  })

  it('navigates from ontology report bindings to the owning dashboard scene', async () => {
    window.history.pushState({}, '', '/docs/modules/attraction/MODULE_ONTOLOGY.md#stale')
    vi.mocked(apiClient.getAttractionOntology).mockResolvedValueOnce(
      createAttractionOntology({
        reportBindings: [
          {
            id: 'attraction-funnel-flow',
            label: 'Поток стадий Привлечения',
            sceneId: 'funnel-flow',
            blockId: 'attraction-funnel-flow',
            href: '#attraction-funnel-flow',
          },
        ],
      }),
    )

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^онтология$/i }))
    const reportLinks = await screen.findByTestId('ontology-report-links')
    await userEvent.click(
      within(reportLinks).getByRole('link', { name: /поток стадий привлечения/i }),
    )

    expect(screen.getByRole('button', { name: /^движение по воронке$/i })).toHaveClass(
      'tab-chip-active',
    )
    expect(window.location.pathname).toBe('/')
    expect(window.location.hash).toBe('#attraction-funnel-flow')
  })

  it('renders development team status notifications without requiring issue links', async () => {
    vi.mocked(apiClient.getCommentNotifications).mockResolvedValueOnce({
      notifications: [
        {
          id: 'comment-1',
          sceneId: 'sales',
          text: 'Проверить KPI',
          status: 'in_work',
          paperclipSyncStatus: 'sent',
          paperclipIssueIdentifier: 'BIT-1',
          paperclipError: null,
          updatedAt: '2026-04-10T12:05:00.000Z',
        },
        {
          id: 'comment-2',
          sceneId: 'sales',
          text: 'Уточнить фильтр',
          status: 'failed',
          paperclipSyncStatus: 'failed',
          paperclipIssueIdentifier: null,
          paperclipError: 'Paperclip unavailable',
          updatedAt: '2026-04-10T12:06:00.000Z',
        },
        {
          id: 'comment-3',
          sceneId: 'sales',
          text: 'Проверить готовую доработку',
          status: 'done',
          paperclipSyncStatus: 'sent',
          paperclipIssueIdentifier: 'BIT-3',
          paperclipError: null,
          updatedAt: '2026-04-10T12:07:00.000Z',
        },
      ],
    })

    render(<ProtoApp />)

    const notificationsButton = await screen.findByRole('button', {
      name: /уведомления команды разработки/i,
    })
    expect(screen.queryByText(/в работе · 1/i)).not.toBeInTheDocument()

    await userEvent.click(notificationsButton)

    expect(await screen.findByText(/в работе · 1/i)).toBeInTheDocument()
    expect(screen.getByText(/ошибка · 1/i)).toBeInTheDocument()
    expect(screen.getByText(/на проверку · 1/i)).toBeInTheDocument()
    expect(screen.getByText('Проверить KPI')).toBeInTheDocument()
    expect(screen.getByText('Уточнить фильтр')).toBeInTheDocument()
    expect(screen.getByText('Проверить готовую доработку')).toBeInTheDocument()
    expect(screen.getByText(/команда разработки unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/paperclip/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /bit-1/i })).not.toBeInTheDocument()
  })

  it('clears the unread development notification badge after opening notifications', async () => {
    vi.mocked(apiClient.getCommentNotifications).mockResolvedValue({
      notifications: [
        {
          id: 'comment-1',
          sceneId: 'sales',
          text: 'Проверить KPI',
          status: 'in_work',
          paperclipSyncStatus: 'sent',
          paperclipIssueIdentifier: 'BIT-1',
          paperclipError: null,
          updatedAt: '2026-04-10T12:05:00.000Z',
        },
      ],
    })

    render(<ProtoApp />)

    const notificationsButton = await screen.findByRole('button', {
      name: /1 новое/i,
    })
    expect(within(notificationsButton).getByText('1')).toBeInTheDocument()

    await userEvent.click(notificationsButton)

    expect(await screen.findByText('Проверить KPI')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /нет новых/i,
        }),
      ).toBeInTheDocument()
    })
    expect(within(notificationsButton).queryByText('1')).not.toBeInTheDocument()
  })

  it('shows the development team ready report in notifications and the comment review panel', async () => {
    const readyReport = {
      id: 'paperclip-comment-ready',
      body: [
        '## Готово к проверке',
        '',
        '- Сделано: предупреждение добавлено в таймлайн.',
        '- Root cause: дата встречи раньше создания сделки.',
        '- Теперь: данные показываются без случайного бейджа.',
        '- Проверено: web vitest и browser smoke.',
      ].join('\n'),
      createdAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:00:00.000Z',
    }
    const comment = {
      id: 'comment-ready-report',
      sceneId: 'sales',
      x: 0.5,
      y: 0.5,
      text: 'Проверить готовую доработку',
      status: 'open',
      archivedAt: null,
      createdAt: '2026-05-13T11:00:00.000Z',
      updatedAt: '2026-05-13T12:00:00.000Z',
      anchor: {
        blockId: 'deal-143570',
        blockLabel: '143570',
        blockSelector: '[data-comment-block-id="deal-143570"]',
        blockRole: null,
        elementSelector: '[data-comment-block-id="deal-143570"]',
        elementLabel: '143570',
        relativeX: 0.5,
        relativeY: 0.5,
      },
      paperclipIssueId: 'paperclip-issue-1',
      paperclipIssueIdentifier: 'BIT-42',
      paperclipStatus: 'done',
      paperclipSyncStatus: 'sent',
      paperclipError: null,
      paperclipReadyReport: readyReport,
    }

    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({
        comments: [comment],
        updatedAt: '2026-05-13T12:00:00.000Z',
      }),
    )
    vi.mocked(apiClient.getCommentNotifications).mockResolvedValueOnce({
      notifications: [
        {
          id: comment.id,
          sceneId: comment.sceneId,
          text: comment.text,
          status: 'done',
          paperclipSyncStatus: 'sent',
          paperclipIssueIdentifier: 'BIT-42',
          paperclipError: null,
          updatedAt: comment.updatedAt,
          paperclipReadyReport: readyReport,
        },
      ],
    })

    render(<ProtoApp />)
    await openSalesScene()

    await userEvent.click(
      await screen.findByRole('button', { name: /уведомления команды разработки/i }),
    )

    expect(await screen.findByText(/отчёт команды разработки/i)).toBeInTheDocument()
    expect(screen.getByText(/root cause: дата встречи раньше создания сделки/i)).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^комментарии$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /проверить готовую доработку/i }))

    expect(screen.getAllByText(/отчёт команды разработки/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/проверено: web vitest/i).length).toBeGreaterThan(0)
  })

  it('shows a missing ready report state for ready comments without a team report', async () => {
    const comment = {
      id: 'comment-ready-no-report',
      sceneId: 'sales',
      x: 0.5,
      y: 0.5,
      text: 'Проверить готовую доработку без отчёта',
      status: 'open',
      archivedAt: null,
      createdAt: '2026-05-13T11:00:00.000Z',
      updatedAt: '2026-05-13T12:00:00.000Z',
      paperclipIssueId: 'paperclip-issue-1',
      paperclipIssueIdentifier: 'BIT-42',
      paperclipStatus: 'done',
      paperclipSyncStatus: 'sent',
      paperclipError: null,
      paperclipReadyReport: null,
    }

    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({
        comments: [comment],
        updatedAt: '2026-05-13T12:00:00.000Z',
      }),
    )
    vi.mocked(apiClient.getCommentNotifications).mockResolvedValueOnce({
      notifications: [
        {
          id: comment.id,
          sceneId: comment.sceneId,
          text: comment.text,
          status: 'done',
          paperclipSyncStatus: 'sent',
          paperclipIssueIdentifier: 'BIT-42',
          paperclipError: null,
          updatedAt: comment.updatedAt,
          paperclipReadyReport: null,
        },
      ],
    })

    render(<ProtoApp />)
    await openSalesScene()

    await userEvent.click(
      await screen.findByRole('button', { name: /уведомления команды разработки/i }),
    )

    expect(await screen.findByText(/отчёт команды разработки не найден/i)).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^комментарии$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /без отчёта/i }))

    expect(screen.getAllByText(/отчёт команды разработки не найден/i).length).toBeGreaterThan(0)
  })

  it('does not show development team thread history in the comment review panel', async () => {
    const paperclipThread: PaperclipThreadEntry[] = [
      {
        id: 'thread-first-report',
        kind: 'development_report',
        body: 'Первый отчет команды: добавлены бейджи задач и звонков.',
        authorAgentId: 'agent-1',
        authorUserId: null,
        createdAt: '2026-05-14T09:00:00.000Z',
        updatedAt: '2026-05-14T09:00:00.000Z',
      },
      {
        id: 'thread-rework',
        kind: 'dashboard_rework',
        body: 'Возврат на доработку: бейдж должен называться Мероприятия.',
        authorAgentId: null,
        authorUserId: 'local-board',
        createdAt: '2026-05-14T10:00:00.000Z',
        updatedAt: '2026-05-14T10:00:00.000Z',
      },
      {
        id: 'thread-new-report',
        kind: 'development_report',
        body: 'Новый мини-отчет команды: бейдж переименован.',
        authorAgentId: 'agent-1',
        authorUserId: null,
        createdAt: '2026-05-14T11:00:00.000Z',
        updatedAt: '2026-05-14T11:00:00.000Z',
      },
    ]
    const comment = {
      id: 'comment-thread-history',
      sceneId: 'sales',
      x: 0.5,
      y: 0.5,
      text: 'Проверить историю команды',
      status: 'open',
      archivedAt: null,
      createdAt: '2026-05-14T09:00:00.000Z',
      updatedAt: '2026-05-14T11:00:00.000Z',
      paperclipIssueId: 'paperclip-issue-1',
      paperclipIssueIdentifier: 'BIT-42',
      paperclipStatus: 'in_work',
      paperclipSyncStatus: 'sent',
      paperclipError: null,
      paperclipReadyReport: null,
      paperclipThread,
    }

    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({
        comments: [comment],
        updatedAt: '2026-05-14T11:00:00.000Z',
      }),
    )
    vi.mocked(apiClient.getCommentNotifications).mockResolvedValueOnce({
      notifications: [
        {
          id: comment.id,
          sceneId: comment.sceneId,
          text: comment.text,
          status: 'in_work',
          paperclipSyncStatus: 'sent',
          paperclipIssueIdentifier: 'BIT-42',
          paperclipError: null,
          updatedAt: comment.updatedAt,
          paperclipReadyReport: null,
          paperclipThread: comment.paperclipThread,
        },
      ],
    })

    render(<ProtoApp />)
    await openSalesScene()

    await userEvent.click(await screen.findByRole('button', { name: /^комментарии$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /проверить историю команды/i }))

    expect(screen.getAllByText(/проверить историю команды/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/история команды разработки/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/первый отчет команды/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/возврат на доработку: бейдж/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/новый мини-отчет команды/i)).not.toBeInTheDocument()
  })

  it('closes the comments panel when the user clicks outside it', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^комментарии$/i }))

    const panel = screen.getByText('Комментарии модуля').closest('aside')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('translate-x-0')

    await userEvent.click(await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }))

    expect(panel).toHaveClass('translate-x-[calc(100%+1rem)]')
  })

  it('keeps the comments button as an explicit panel toggle', async () => {
    render(<ProtoApp />)

    const commentsButton = await screen.findByRole('button', { name: /^комментарии$/i })
    await userEvent.click(commentsButton)

    const panel = screen.getByText('Комментарии модуля').closest('aside')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('translate-x-0')

    await userEvent.click(commentsButton)

    expect(panel).toHaveClass('translate-x-[calc(100%+1rem)]')
  })

  it('keeps the development rework form inside a scrollable comments panel body', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: ['comments:create', 'comments:update', 'comments:archive'],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce(
      createResponse({
        comments: [
          {
            id: 'comment-143570',
            sceneId: 'sales',
            x: 0.5,
            y: 0.5,
            text: 'Дата встречи не видна в таймлайне',
            status: 'open',
            archivedAt: null,
            createdAt: '2026-05-13T07:55:00.000Z',
            updatedAt: '2026-05-13T07:55:00.000Z',
            anchor: {
              blockId: 'deal-143570',
              blockLabel: '143570',
              blockSelector: '[data-comment-block-id="deal-143570"]',
              blockRole: null,
              elementSelector: '[data-comment-block-id="deal-143570"]',
              elementLabel: '143570',
              relativeX: 0.5,
              relativeY: 0.5,
            },
            paperclipIssueId: 'issue-1',
            paperclipIssueIdentifier: 'BIT-1',
            paperclipStatus: 'done',
            paperclipSyncStatus: 'sent',
            paperclipError: null,
          },
        ],
        updatedAt: '2026-05-13T07:55:46.000Z',
      }),
    )

    render(<ProtoApp currentUser={leader} />)
    await openSalesScene()

    await userEvent.click(await screen.findByRole('button', { name: /^комментарии$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /дата встречи не видна/i }))

    const reworkTextarea = screen.getByPlaceholderText(/комментарий к доработке/i)
    const panelBody = reworkTextarea.closest('[data-comment-panel-body="true"]')

    expect(panelBody).not.toBeNull()
    expect(panelBody).toHaveClass('min-h-0', 'overflow-y-auto', 'overscroll-contain')
    expect(reworkTextarea).toHaveClass('min-h-40', 'max-h-64', 'overflow-y-auto', 'overscroll-contain')
    const reworkButton = screen.getByRole('button', { name: /на доработку/i })
    expect(reworkButton).toHaveClass('btn', 'btn-dark', 'w-full')
    expect(reworkButton.closest('[data-rework-actions="true"]')).toHaveClass(
      'sticky',
      'bottom-0',
    )
  })

  it('opens the account page and shows module admin only to attraction leaders', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers).mockResolvedValueOnce({
      users: [
        {
          id: 2,
          login: 'employee@example.com',
          firstName: 'Анна',
          lastName: 'Егорова',
          disabled: false,
          moduleId: 'attraction',
          moduleRole: 'employee',
          membershipStatus: 'active',
          createdAt: '2026-04-10T12:00:00.000Z',
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })

    const { unmount } = render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

	    expect(
	      await screen.findByRole('heading', { name: /^личный кабинет$/i }),
	    ).toBeInTheDocument()
	    expect(window.location.pathname).toBe('/account')
	    expect(screen.getByRole('tab', { name: /^профиль/i })).toBeInTheDocument()
	    expect(screen.getByRole('tab', { name: /^модуль/i })).toBeInTheDocument()
	    expect(screen.getByRole('tab', { name: /^настройки/i })).toHaveAttribute(
	      'aria-selected',
	      'true',
	    )
	    expect(screen.getByRole('tab', { name: /^пользователи/i })).toBeInTheDocument()
	    expect(
	      screen.getByRole('heading', { name: /^настройки модуля$/i }),
	    ).toBeInTheDocument()
	    expect(screen.getByText('ClubFirst Russia / One')).toBeInTheDocument()
    expect(screen.getByText('Федеральный')).toBeInTheDocument()
	    expect(screen.getByRole('heading', { name: /плановые мероприятия/i })).toBeInTheDocument()
	    expect(screen.getByText('Гостевая встреча')).toBeInTheDocument()
	    expect(screen.getByRole('heading', { name: /вайтлист менеджеров/i })).toBeInTheDocument()
	    expect(screen.getByRole('heading', { name: /расходы и финрезультат/i })).toBeInTheDocument()
	    expect(screen.getAllByText('Илья Какулия').length).toBeGreaterThan(0)
	    expect(screen.queryByText(/запланировано/i)).not.toBeInTheDocument()

	    await openAccountTab(/^профиль/i)
	    expect(screen.getByDisplayValue('Мария')).toBeInTheDocument()
	    expect(screen.getByDisplayValue('Потапова')).toBeInTheDocument()
	    expect(screen.getByText(/логин для входа/i)).toBeInTheDocument()

	    await openAccountTab(/^модуль/i)
	    expect(screen.getByRole('heading', { name: /^привлечение$/i })).toBeInTheDocument()
	    expect(screen.getByText('Лидер модуля')).toBeInTheDocument()

	    await openAccountTab(/^пользователи/i)
	    expect(screen.getByText(/пользователи модуля/i)).toBeInTheDocument()
	    expect(screen.getByText('employee@example.com')).toBeInTheDocument()
	    expect(
      screen.queryByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /к дашборду/i }))

    expect(window.location.pathname).toBe('/')
    await openSalesScene()
    expect(await screen.findByText(/отчет продаж подключен/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^настройки$/i })).not.toBeInTheDocument()
    unmount()

    render(
      <ProtoApp
        currentUser={{
          ...leader,
          modules: [
            {
              ...leader.modules[0]!,
              role: 'employee',
              permissions: ['comments:create', 'comments:update'],
            },
          ],
        }}
      />,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

    expect(window.location.pathname).toBe('/account')
    expect(screen.queryByText(/пользователи модуля/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^настройки модуля$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /сохранить цены/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /сохранить расходы/i })).not.toBeInTheDocument()
  })

  it('loads the unit economics scene lazily and expands manager economics details', async () => {
    render(<ProtoApp />)

    const unitEconomicsTab = await screen.findByRole('button', {
      name: /^финрезультат$/i,
    })
    await userEvent.click(unitEconomicsTab)

    expect(
      await screen.findByRole('heading', { name: /^финрезультат$/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(apiClient.getUnitEconomicsReport).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          eventParticipantMode: 'invited',
          compareRanges: [],
        }),
      ),
    )
    await waitFor(() =>
      expect(screen.queryByText('Источник × качество')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Период: 01.04.26 - 30.04.26')).toBeInTheDocument()
    const invitedModeButton = screen.getByRole('button', { name: /^Приглашенные$/i })
    const attendedModeButton = screen.getByRole('button', { name: /^Дошедшие$/i })
    expect(invitedModeButton).toHaveAttribute('aria-pressed', 'true')
    expect(attendedModeButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getAllByText('Менеджеры').length).toBeGreaterThan(0)
    const managerSection = screen.getByRole('heading', { name: /^Менеджеры$/i }).closest('section')
    expect(managerSection).not.toBeNull()
    expect(within(managerSection!).getByRole('columnheader', { name: 'С/с производства' }))
      .toBeInTheDocument()
    expect(within(managerSection!).getByRole('columnheader', { name: 'Прямые расходы' }))
      .toBeInTheDocument()
    expect(within(managerSection!).getByRole('columnheader', { name: 'Налоги и финсервис' }))
      .toBeInTheDocument()
    expect(within(managerSection!).getByRole('columnheader', { name: 'Все расходы' }))
      .toBeInTheDocument()
    expect(within(managerSection!).getByRole('columnheader', { name: 'Прибыль' }))
      .toBeInTheDocument()
    const managerButton = within(managerSection!).getByRole('button', { name: /Мария Потапова/i })
    const managerRow = managerButton.closest('tr')
    expect(managerRow).not.toBeNull()
    expect(within(managerRow!).getByText('140 000 ₽')).toHaveClass('text-rose-700')
    expect(within(managerRow!).getByText('173 000 ₽')).toHaveClass('text-rose-700')
    expect(within(managerRow!).getByText('6 000 ₽')).toHaveClass('text-rose-700')
    expect(within(managerRow!).getByText('319 000 ₽')).toHaveClass('text-rose-700')
    await userEvent.click(screen.getByRole('button', { name: /Мария Потапова/i }))
    expect(screen.getByText('Доходы')).toBeInTheDocument()
    expect(screen.getByText('ClubFirst One')).toBeInTheDocument()
    expect(screen.getByText('Федеральный')).toBeInTheDocument()
    expect(screen.getByText('Себестоимость производства')).toBeInTheDocument()
    expect(screen.getByText('Лидген УС · Готов к встрече')).toBeInTheDocument()
    expect(screen.getByText('Гостевая встреча ClubFirst')).toBeInTheDocument()
    expect(screen.getByText('Бонусы за продажу')).toBeInTheDocument()
    expect(screen.getAllByText('Прямые расходы').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Налоги и финсервис').length).toBeGreaterThan(0)
    expect(screen.queryByText('Итого Доходы:')).not.toBeInTheDocument()
    expect(screen.queryByText('Итого с/с производства:')).not.toBeInTheDocument()
    expect(screen.queryByText('Итого расходы (выше Ebitda):')).not.toBeInTheDocument()
    expect(screen.queryByText('Итого расходы (ниже Ebitda):')).not.toBeInTheDocument()
    expect(screen.queryByText('Итого по блоку')).not.toBeInTheDocument()
    expect(screen.getByText('Итого доходы')).toBeInTheDocument()
    expect(screen.getByText('Итого себестоимость производства')).toBeInTheDocument()
    expect(screen.getByText('Итого прямые расходы')).toBeInTheDocument()
    expect(screen.getByText('Итого налоги и финсервис')).toBeInTheDocument()
    expect(screen.getByText('Gross margin, Р.:')).toBeInTheDocument()
    expect(screen.getByText('Gross margin, %:')).toBeInTheDocument()
    expect(screen.getByText('Ebitda, Р.:')).toBeInTheDocument()
    expect(screen.getByText('Ebitda, %:')).toBeInTheDocument()
    expect(screen.getByText('Чистая прибыль (Net Profit), Р.:')).toBeInTheDocument()
    expect(screen.getByText('Чистая прибыль (Net Profit), %:')).toBeInTheDocument()
    const leadCostDetailRow = screen.getByText('Лидген УС · Готов к встрече').closest('tr')
    expect(leadCostDetailRow).not.toBeNull()
    expect(within(leadCostDetailRow!).getByText('80 000 ₽')).toHaveClass('text-rose-700')
    expect(screen.getAllByText('-19 000 ₽').length).toBeGreaterThan(0)
    await userEvent.click(attendedModeButton)
    await waitFor(() =>
      expect(apiClient.getUnitEconomicsReport).toHaveBeenLastCalledWith(
        expect.objectContaining({
          eventParticipantMode: 'attended',
          compareRanges: [],
        }),
      ),
    )
  })

  it('loads heavyweight attraction scenes only after opening their tabs', async () => {
    render(<ProtoApp />)

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    expect(apiClient.getActivitiesWorkloadReport).not.toHaveBeenCalled()
    expect(apiClient.getCallsWorkloadReport).not.toHaveBeenCalled()
    expect(apiClient.getCohortConversionReport).not.toHaveBeenCalled()
    expect(apiClient.getManagerActionOutcomeReport).not.toHaveBeenCalled()
    expect(apiClient.getTocFlowReport).not.toHaveBeenCalled()
    expect(apiClient.getAttractionOntology).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))
    await waitFor(() => expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalled())
    expect(apiClient.getCallsWorkloadReport).toHaveBeenCalled()
    expect(apiClient.getCohortConversionReport).not.toHaveBeenCalled()
    expect(apiClient.getManagerActionOutcomeReport).not.toHaveBeenCalled()
    expect(apiClient.getTocFlowReport).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^когортный отчет$/i }))
    await waitFor(() => expect(apiClient.getCohortConversionReport).toHaveBeenCalled())
    expect(apiClient.getManagerActionOutcomeReport).toHaveBeenCalled()
    expect(apiClient.getTocFlowReport).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^движение по воронке$/i }))
    await waitFor(() => expect(apiClient.getTocFlowReport).toHaveBeenCalled())
  })

  it('does not block the cohort scene while manager action outcomes are still loading', async () => {
    const managerActionDeferred = createDeferred<
      Awaited<ReturnType<typeof apiClient.getManagerActionOutcomeReport>>
    >()
    vi.mocked(apiClient.getManagerActionOutcomeReport).mockImplementationOnce(
      async () => managerActionDeferred.promise,
    )

    render(<ProtoApp />)

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /^когортный отчет$/i }))

    await waitFor(() => expect(apiClient.getCohortConversionReport).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: /^когортная матрица$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^действия → результат$/i })).toBeInTheDocument()
    expect(screen.getByText('загружается')).toBeInTheDocument()
  })

  it('settles the activity report under StrictMode after all lazy live reports resolve', async () => {
    render(
      <StrictMode>
        <ProtoApp />
      </StrictMode>,
    )

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))

    await waitFor(() => {
      expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalled()
      expect(apiClient.getCallsWorkloadReport).toHaveBeenCalled()
      expect(apiClient.getAcquisitionOutcomesReport).toHaveBeenCalled()
      expect(apiClient.getTargetGroupConversionReport).toHaveBeenCalled()
      expect(apiClient.getConversionEventsReport).toHaveBeenCalled()
    })
    expect(await screen.findByRole('heading', { name: /^сводка по менеджерам$/i })).toBeInTheDocument()
    expect(
      screen.queryByText(/загружаю live-данные отч[её]та активности/i),
    ).not.toBeInTheDocument()
  })

  it('finishes a lazy attraction scene request after leaving and returning to its tab', async () => {
    const activitiesDeferred = createDeferred<
      Awaited<ReturnType<typeof apiClient.getActivitiesWorkloadReport>>
    >()
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockImplementationOnce(
      async () => activitiesDeferred.promise,
    )

    render(<ProtoApp />)

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))
    await waitFor(() => expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText(/загружаю live-данные отч[её]та активности/i),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^отчет по продажам$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))

    activitiesDeferred.resolve({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    })

    await waitFor(() => {
      expect(
        screen.queryByText(/загружаю live-данные отч[её]та активности/i),
      ).not.toBeInTheDocument()
    })
    expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalledTimes(1)
  })

  it('lets module leaders edit and save unit economics cost rules', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

    expect(
      await screen.findByRole('heading', { name: /расходы и финрезультат/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Все остальные конверсионные мероприятия')).toBeInTheDocument()
    expect(
      screen.getByRole('spinbutton', {
        name: /демо-мероприятия.*все остальные конверсионные мероприятия/i,
      }),
    ).toHaveValue(15000)

    const leadPriceInput = screen.getByRole('spinbutton', {
      name: /закупка лидов.*лидген ус.*готов к встрече/i,
    })
    await userEvent.clear(leadPriceInput)
    await userEvent.type(leadPriceInput, '45000')

    const contractationInput = screen.getByRole('spinbutton', {
      name: /контрактация/i,
    })
    await userEvent.clear(contractationInput)
    await userEvent.type(contractationInput, '6000')

    await userEvent.click(screen.getByRole('button', { name: /сохранить расходы/i }))

    await waitFor(() =>
      expect(apiClient.saveUnitEconomicsCostRules).toHaveBeenCalledWith({
        eventParticipantMode: 'invited',
        rules: expect.arrayContaining([
          expect.objectContaining({
            id: 'leadgen-ready-to-meet',
            articleId: 'lead_purchase',
            calculationMethod: 'amount_per_lead',
            unitPrice: 45000,
            sourceKey: 'Лидген УС',
            qualityValue: 'Готов к встрече',
          }),
          expect.objectContaining({
            id: 'contractation-per-won-default',
            articleId: 'contractation',
            calculationMethod: 'amount_per_contract',
            unitPrice: 6000,
          }),
        ]),
      }),
    )
  })

  it('lets module leaders edit and save operational threshold settings', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

    const baseStageInput = await screen.findByRole('spinbutton', {
      name: /порог этапа база входящая/i,
    })
    expect(baseStageInput).toHaveValue(1)

    await userEvent.clear(baseStageInput)
    await userEvent.type(baseStageInput, '2')

    const sla2Input = screen.getByRole('spinbutton', { name: /sla2, часов/i })
    expect(sla2Input).toHaveValue(5)
    await userEvent.clear(sla2Input)
    await userEvent.type(sla2Input, '6')

    await userEvent.click(screen.getByRole('button', { name: /сохранить пороги/i }))

    await waitFor(() =>
      expect(apiClient.saveOperationalThresholdSettings).toHaveBeenCalledWith({
        stageAging: expect.arrayContaining([
          {
            stageId: 'C10:NEW',
            maxDaysOnStage: 2,
          },
          {
            stageId: 'C10:PREPARATION',
            maxDaysOnStage: 3,
          },
        ]),
        noCallsMaxDays: 7,
        noActivityMaxDays: 5,
        slaBusinessHours: {
          sla1: 24,
          sla2: 6,
          sla3: 72,
        },
      }),
    )
  })

  it('does not request a new sync when manager whitelist settings are unchanged', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )
    await screen.findByRole('checkbox', { name: /илья какулия/i })
    await screen.findByRole('checkbox', { name: /егоров андрей/i })
    await userEvent.click(screen.getByRole('button', { name: /сохранить менеджеров/i }))

    await waitFor(() =>
      expect(apiClient.saveManagerWhitelistSettings).toHaveBeenCalledWith({
        managerIds: ['13020', '78'],
        teams: [],
      }),
    )
    expect(screen.queryByText(/в[аa]йтлист менеджеров изменен/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/нужна синхронизация данных/i)).not.toBeInTheDocument()
  })

  it('keeps default manager choices empty after saving an empty manager whitelist', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers).mockResolvedValueOnce({ users: [] })

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

    await userEvent.click(
      await screen.findByRole('checkbox', { name: /илья какулия/i }),
    )
    await userEvent.click(screen.getByRole('checkbox', { name: /егоров андрей/i }))
    await userEvent.click(screen.getByRole('button', { name: /сохранить менеджеров/i }))

	    await waitFor(() =>
	      expect(apiClient.saveManagerWhitelistSettings).toHaveBeenCalledWith({
	        managerIds: [],
	        teams: [],
	      }),
	    )

	    await openAccountTab(/^пользователи/i)
	    await waitFor(() => {
	      const newManagerSelect = screen.getByLabelText(
	        /менеджер по умолчанию для нового сотрудника/i,
	      ) as HTMLSelectElement
      const optionLabels = Array.from(newManagerSelect.options).map((option) =>
        option.textContent?.trim(),
      )

      expect(optionLabels).toEqual(['Не выбран'])
    })
  })

  it('lets module leaders create teams once and assign managers with a dropdown', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers).mockResolvedValueOnce({ users: [] })

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

    expect(screen.queryByRole('textbox', { name: /^команда$/i })).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /создать команду/i }))
    await userEvent.type(screen.getByLabelText(/название команды/i), 'Привлечение')
    await userEvent.click(screen.getByRole('button', { name: /добавить команду/i }))

    await userEvent.click(
      await screen.findByRole('button', { name: /команда менеджера илья какулия/i }),
    )
    await userEvent.click(await screen.findByRole('option', { name: /привлечение/i }))
    await userEvent.click(
      screen.getByRole('button', { name: /команда менеджера егоров андрей/i }),
    )
    await userEvent.click(await screen.findByRole('option', { name: /привлечение/i }))
    await userEvent.click(screen.getByRole('button', { name: /сохранить менеджеров/i }))

    await waitFor(() =>
      expect(apiClient.saveManagerWhitelistSettings).toHaveBeenCalledWith({
        managerIds: ['13020', '78'],
        teams: [
          {
            id: 'Привлечение',
            name: 'Привлечение',
            managerIds: ['13020', '78'],
          },
        ],
      }),
    )
  })

  it('preserves saved manager team ids when assigning teams from the settings picker', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers).mockResolvedValueOnce({ users: [] })
    vi.mocked(apiClient.getManagerWhitelistSettings).mockResolvedValueOnce({
      options: [
        { id: '13020', name: 'Илья Какулия' },
        { id: '78', name: 'Егоров Андрей' },
      ],
      settings: [
        {
          moduleKey: 'attraction',
          managerId: '13020',
          managerName: 'Илья Какулия',
          enabled: true,
          sortOrder: 0,
          updatedAt: '2026-04-10T12:00:00.000Z',
          teamId: 'attraction',
          teamName: 'Привлечение',
        },
        {
          moduleKey: 'attraction',
          managerId: '78',
          managerName: 'Егоров Андрей',
          enabled: true,
          sortOrder: 10,
          updatedAt: '2026-04-10T12:00:00.000Z',
          teamId: null,
          teamName: null,
        },
      ],
      teams: [
        {
          id: 'attraction',
          name: 'Привлечение',
          managerIds: ['13020'],
          sortOrder: 0,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )

    expect(screen.queryAllByRole('combobox', { name: /команда менеджера/i })).toHaveLength(0)

    await userEvent.click(
      await screen.findByRole('button', { name: /команда менеджера егоров андрей/i }),
    )
    await userEvent.click(await screen.findByRole('option', { name: /привлечение/i }))
    await userEvent.click(screen.getByRole('button', { name: /сохранить менеджеров/i }))

    await waitFor(() =>
      expect(apiClient.saveManagerWhitelistSettings).toHaveBeenCalledWith({
        managerIds: ['13020', '78'],
        teams: [
          {
            id: 'attraction',
            name: 'Привлечение',
            managerIds: ['13020', '78'],
          },
        ],
      }),
    )
  })

  it('keeps unsaved manager team drafts after leaving and returning to account settings', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers).mockResolvedValueOnce({ users: [] })

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )
    await userEvent.click(await screen.findByRole('button', { name: /создать команду/i }))
    await userEvent.type(screen.getByLabelText(/название команды/i), 'Привлечение штрих')
    await userEvent.click(screen.getByRole('button', { name: /добавить команду/i }))
    await userEvent.click(
      await screen.findByRole('button', { name: /команда менеджера егоров андрей/i }),
    )
    await userEvent.click(await screen.findByRole('option', { name: /привлечение штрих/i }))

    await userEvent.click(screen.getByRole('button', { name: /^к дашборду$/i }))
    await userEvent.click(await screen.findByRole('button', { name: /^личный кабинет$/i }))

    expect(await screen.findAllByText('Привлечение штрих')).toHaveLength(2)
    expect(
      await screen.findByRole('button', { name: /команда менеджера егоров андрей/i }),
    ).toHaveTextContent('Привлечение штрих')
    expect(apiClient.saveManagerWhitelistSettings).not.toHaveBeenCalled()
  })

  it('keeps unsaved manager team drafts when switching account tabs', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers).mockResolvedValueOnce({ users: [] })

    render(<ProtoApp currentUser={leader} />)

    await userEvent.click(
      await screen.findByRole('button', { name: /^личный кабинет$/i }),
    )
    await userEvent.click(await screen.findByRole('button', { name: /создать команду/i }))
    await userEvent.type(screen.getByLabelText(/название команды/i), 'Привлечение штрих')
    await userEvent.click(screen.getByRole('button', { name: /добавить команду/i }))
    await userEvent.click(
      await screen.findByRole('button', { name: /команда менеджера егоров андрей/i }),
    )
    await userEvent.click(await screen.findByRole('option', { name: /привлечение штрих/i }))

    await openAccountTab(/^профиль/i)
    expect(screen.getByRole('heading', { name: /имя и вход/i })).toBeInTheDocument()
    await openAccountTab(/^настройки/i)

    expect(await screen.findAllByText('Привлечение штрих')).toHaveLength(2)
    expect(
      await screen.findByRole('button', { name: /команда менеджера егоров андрей/i }),
    ).toHaveTextContent('Привлечение штрих')
    expect(apiClient.saveManagerWhitelistSettings).not.toHaveBeenCalled()
  })

  it('warns module leaders when saved whitelist clears employee default managers', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    const employee = {
      id: 2,
      login: 'employee@example.com',
      firstName: 'Анна',
      lastName: 'Егорова',
      disabled: false,
      moduleId: 'attraction',
      moduleRole: 'employee' as const,
      membershipStatus: 'active' as const,
      defaultManagerId: '13020',
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
    }
    vi.mocked(apiClient.getModuleUsers)
      .mockResolvedValueOnce({ users: [employee] })
      .mockResolvedValueOnce({
        users: [
          {
            ...employee,
            defaultManagerId: null,
            updatedAt: '2026-04-10T12:05:00.000Z',
          },
        ],
      })

    render(<ProtoApp currentUser={leader} />)

	    await userEvent.click(
	      await screen.findByRole('button', { name: /^личный кабинет$/i }),
	    )
	    await openAccountTab(/^пользователи/i)
	    expect(await screen.findByText('employee@example.com')).toBeInTheDocument()

	    await openAccountTab(/^настройки/i)
	    await userEvent.click(
	      await screen.findByRole('checkbox', { name: /илья какулия/i }),
	    )
    await userEvent.click(screen.getByRole('button', { name: /сохранить менеджеров/i }))

    await waitFor(() =>
      expect(apiClient.saveManagerWhitelistSettings).toHaveBeenCalledWith({
        managerIds: ['78'],
        teams: [],
      }),
    )
    expect(
      await screen.findByText(/нужно переназначить менеджера/i),
    ).toBeInTheDocument()
  })

  it('lets module leaders choose default managers for new and existing employees', async () => {
    const leader: AuthUser = {
      id: 1,
      login: 'leader@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getModuleUsers)
      .mockResolvedValueOnce({
        users: [
          {
            id: 2,
            login: 'employee@example.com',
            firstName: 'Анна',
            lastName: 'Егорова',
            disabled: false,
            moduleId: 'attraction',
            moduleRole: 'employee',
            membershipStatus: 'active',
            defaultManagerId: null,
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
      users: [
        {
          id: 2,
          login: 'employee@example.com',
          firstName: 'Анна',
          lastName: 'Егорова',
          disabled: false,
          moduleId: 'attraction',
          moduleRole: 'employee',
          membershipStatus: 'active',
          defaultManagerId: null,
          createdAt: '2026-04-10T12:00:00.000Z',
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })

    render(<ProtoApp currentUser={leader} />)

	    await userEvent.click(
	      await screen.findByRole('button', { name: /^личный кабинет$/i }),
	    )
	    await openAccountTab(/^пользователи/i)

	    await userEvent.type(screen.getByPlaceholderText('логин'), 'ilya@example.com')
    await userEvent.type(screen.getByPlaceholderText('пароль'), 'correct-password')
    await userEvent.selectOptions(
      await screen.findByLabelText(/менеджер по умолчанию для нового сотрудника/i),
      '13020',
    )
    await userEvent.click(screen.getByRole('button', { name: /создать сотрудника/i }))

    await waitFor(() =>
      expect(apiClient.createModuleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          login: 'ilya@example.com',
          defaultManagerId: '13020',
        }),
        'attraction',
      ),
    )

    const employeeManagerSelect = await screen.findByLabelText(
      /employee@example.com: менеджер по умолчанию/i,
    )
    await userEvent.selectOptions(employeeManagerSelect, '78')
    const employeeRow = employeeManagerSelect.closest('[data-module-user-row="true"]')
    expect(employeeRow).not.toBeNull()
    await userEvent.click(
      within(employeeRow as HTMLElement).getByRole('button', { name: /обновить/i }),
    )

    await waitFor(() =>
      expect(apiClient.updateModuleUser).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          defaultManagerId: '78',
        }),
        'attraction',
      ),
    )
  })

  it('starts employee dashboard filters from their default manager and still allows clearing to all managers', async () => {
    const employee = {
      id: 2,
      login: 'ilya@example.com',
      firstName: 'Илья',
      lastName: 'Какулия',
      role: 'admin',
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'employee',
          permissions: ['comments:create', 'comments:update'],
          defaultManagerId: '13020',
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    } as unknown as AuthUser
    const metaWithEmployeeManager: MetaResponse = {
      stageCatalog: [],
      managerCatalog: [
        {
          id: '13020',
          name: 'Илья Какулия',
        },
        {
          id: '78',
          name: 'Егоров Андрей',
        },
      ],
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
    }
    vi.mocked(apiClient.getMeta)
      .mockResolvedValueOnce(metaWithEmployeeManager)
      .mockResolvedValueOnce(metaWithEmployeeManager)

    render(<ProtoApp currentUser={employee} />)

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    expect(vi.mocked(apiClient.getDashboard).mock.calls[0]?.[0]).toMatchObject({
      managerIds: ['13020'],
    })
    expect(await screen.findByText(/менеджеры:\s*илья какулия/i)).toBeInTheDocument()

    const callsBeforeClear = vi.mocked(apiClient.getDashboard).mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: /^менеджер \/ команда$/i }))
    const managerChoices = await screen.findAllByText('Илья Какулия')
    await userEvent.click(managerChoices[managerChoices.length - 1]!)
    await userEvent.click(screen.getByRole('button', { name: /применить фильтры/i }))

    await waitFor(() =>
      expect(vi.mocked(apiClient.getDashboard).mock.calls.length).toBeGreaterThan(
        callsBeforeClear,
      ),
    )
    const newDashboardCalls = vi.mocked(apiClient.getDashboard).mock.calls.slice(
      callsBeforeClear,
    )
    expect(
      newDashboardCalls.some(([query]) => (query.managerIds ?? []).length === 0),
    ).toBe(true)
  })

  it('does not expose the global manager fallback to employees while whitelist settings load', async () => {
    const employee = {
      id: 2,
      login: 'ilya@example.com',
      firstName: 'Илья',
      lastName: 'Какулия',
      role: 'admin',
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'employee',
          permissions: ['comments:create', 'comments:update'],
          defaultManagerId: '13020',
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    } as unknown as AuthUser
    vi.mocked(apiClient.getManagerWhitelistSettings).mockReturnValueOnce(
      new Promise(() => {}),
    )

    render(<ProtoApp currentUser={employee} />)

    await userEvent.click(screen.getByRole('button', { name: /^менеджер \/ команда$/i }))

    expect(screen.getAllByText('Какулия Илья').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Егоров Андрей')).toHaveLength(0)

  })

  it('lets a super admin switch to the leadgen module and loads its isolated funnel report', async () => {
    const attractionMeta: MetaResponse = {
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [],
      businessClubCatalog: [],
      targetGroupCatalog: [],
      wonStageIds: [],
      defaultPeriodDays: 30,
      lastSync: {
        finishedAt: '2026-05-19T20:14:33.000Z',
        leadsSynced: 0,
        dealsSynced: 113,
        mode: 'delta',
        dealBreakdown: {
          total: 113,
          created: 28,
          updated: 83,
          closed: 2,
          reopened: 0,
          unchanged: 0,
        },
      },
      snapshotStats: {
        deals: 3734,
        activities: 19994,
        calls: 8155,
        stageHistory: 13166,
      },
      syncHealth: {
        status: 'ready',
        blocking: false,
        checkedAt: '2026-05-19T20:14:33.000Z',
        lastSuccessfulSync: '2026-05-19T20:14:33.000Z',
        issues: [],
        warnings: [],
      },
    }
    const leadgenMeta: MetaResponse = {
      ...attractionMeta,
      lastSync: {
        finishedAt: '2026-05-19T20:18:39.000Z',
        leadsSynced: 0,
        dealsSynced: 333,
        mode: 'delta',
        dealBreakdown: {
          total: 333,
          created: 300,
          updated: 30,
          closed: 3,
          reopened: 0,
          unchanged: 0,
        },
      },
      snapshotStats: {
        deals: 4140,
        activities: 306,
        calls: 119,
        stageHistory: 13166,
      },
      syncHealth: {
        status: 'ready',
        blocking: false,
        checkedAt: '2026-05-19T20:18:39.000Z',
        lastSuccessfulSync: '2026-05-19T20:18:39.000Z',
        issues: [],
        warnings: [],
      },
    }
    vi.mocked(apiClient.getMeta)
      .mockResolvedValueOnce(attractionMeta)
      .mockResolvedValueOnce(leadgenMeta)
    const owner = createLeadgenOwner()

    render(<ProtoApp currentUser={owner} />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    const attractionModuleButton = screen.getByRole('button', { name: /^привлечение$/i })
    const leadgenModuleButton = screen.getByRole('button', { name: /^лидогенерация$/i })
    expect(attractionModuleButton).toHaveClass('tab-chip', 'tab-chip-active')
    expect(leadgenModuleButton).toHaveClass('tab-chip')
    expect(screen.queryByText(/дизайна из лидогенерации/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^отчет активности$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^онтология$/i })).toBeInTheDocument()

    vi.mocked(apiClient.getActivitiesWorkloadReport).mockClear()
    vi.mocked(apiClient.getCallsWorkloadReport).mockClear()
    vi.mocked(apiClient.getLeadgenActivitiesWorkloadReport).mockClear()
    vi.mocked(apiClient.getLeadgenCallsWorkloadReport).mockClear()
    vi.mocked(apiClient.getAttractionOntology).mockClear()
    await userEvent.click(leadgenModuleButton)

    expect(
      await screen.findByRole('heading', { name: /^лидогенерация$/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/4\s*140 сделок/i)).toBeInTheDocument()
    expect(screen.getByText(/306 активностей/i)).toBeInTheDocument()
    expect(screen.getByText(/119 звонков/i)).toBeInTheDocument()
    expect(screen.getByText(/^Последнее обновление$/i)).toBeInTheDocument()
    expect(screen.getByText(formatExpectedDateTime('2026-05-19T20:18:39.000Z'))).toBeInTheDocument()
    expect(screen.getByText(/delta · новых 300 · обновлено 30 · закрыто 3/i)).toBeInTheDocument()
    expect(apiClient.getMeta).toHaveBeenCalledWith('leadgen')
    expect(attractionModuleButton).toHaveClass('tab-chip')
    expect(attractionModuleButton).not.toHaveClass('tab-chip-active')
    expect(leadgenModuleButton).toHaveClass('tab-chip', 'tab-chip-active')
    const leadgenSalesReportButton = screen.getByRole('button', {
      name: /^отчет по продажам$/i,
    })
    expect(screen.queryByRole('button', { name: /^отчет звонков$/i })).not.toBeInTheDocument()
    const leadgenActivityReportButton = screen.getByRole('button', {
      name: /^отчет активности$/i,
    })
    expect(leadgenSalesReportButton).toHaveClass('tab-chip', 'tab-chip-active')
    expect(leadgenActivityReportButton).toHaveClass('tab-chip')
    expect(
      within(screen.getByLabelText('Основные разделы дашборда')).getByRole('button', {
        name: /^онтология$/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Отчеты лидогенерации')).queryByRole('button', {
        name: /^онтология$/i,
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^воронка лидген ус$/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/сводка по отдельной воронке/i)).not.toBeInTheDocument()
    expect(screen.getByText('Всего сделок')).toBeInTheDocument()
    expect(screen.getByText('Новый лид')).toBeInTheDocument()
    expect(screen.queryByText('Ответственные')).not.toBeInTheDocument()
    expect(apiClient.getLeadgenActivitiesWorkloadReport).not.toHaveBeenCalled()
    expect(apiClient.getLeadgenCallsWorkloadReport).not.toHaveBeenCalled()

    await userEvent.click(leadgenActivityReportButton)

    await waitFor(() => {
      expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledTimes(1)
      expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledTimes(1)
    })

    expect(leadgenSalesReportButton).toHaveClass('tab-chip')
    expect(leadgenSalesReportButton).not.toHaveClass('tab-chip-active')
    expect(leadgenActivityReportButton).toHaveClass('tab-chip', 'tab-chip-active')
    expect(screen.queryByText('Всего сделок')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^отчет звонков$/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /лидген: звонки и дела по менеджерам/i }),
    ).not.toBeInTheDocument()
    const workloadSummary = await screen.findByRole('heading', {
      name: /сводка по менеджерам/i,
    })
    const workloadSection = workloadSummary.closest('section')
    expect(workloadSection).not.toBeNull()
    expect(workloadSection).toHaveAttribute(
      'data-comment-block-id',
      'leadgen-workload-managers',
    )
    expect(workloadSection).toHaveAttribute(
      'data-comment-block-label',
      'Лидогенерация: Отчет звонков',
    )
    expect(within(workloadSection as HTMLElement).getByText('Лидген менеджер')).toBeInTheDocument()
    expect(within(workloadSection as HTMLElement).getByText('12')).toBeInTheDocument()
    expect(within(workloadSection as HTMLElement).getByText('16')).toBeInTheDocument()
    const workloadHeaders = within(workloadSection as HTMLElement)
      .getAllByRole('columnheader')
      .map((header) =>
        header.textContent
          ?.replace(/\s+/g, ' ')
          .replace(/\s*(сорт|убыв|возр)$/i, '')
          .trim(),
      )
    expect(workloadHeaders).not.toContain('Сделки')
    expect(screen.queryByText('Лидген: нагрузка по этапам')).not.toBeInTheDocument()
    expect(screen.queryByText('leadgen-workload-stages')).not.toBeInTheDocument()
    expect(screen.queryByText('Источники и UTM')).not.toBeInTheDocument()
    expect(screen.queryByText('Ответственные')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(apiClient.getLeadgenFunnelReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({ preset: 'custom' }),
      )
      expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({ preset: 'custom' }),
      )
      expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({ preset: 'custom' }),
      )
      expect(apiClient.getActivitiesWorkloadReport).not.toHaveBeenCalled()
      expect(apiClient.getCallsWorkloadReport).not.toHaveBeenCalled()
      expect(apiClient.getAttractionOntology).not.toHaveBeenCalled()
    })

    await userEvent.click(leadgenSalesReportButton)
    await userEvent.click(leadgenActivityReportButton)

    expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledTimes(1)
    expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledTimes(1)
  })

  it('reloads leadgen workload for changed filters only when the activity report is active', async () => {
    render(<ProtoApp currentUser={createLeadgenOwner()} />)

    await userEvent.click(await screen.findByRole('button', { name: /^лидогенерация$/i }))
    expect(await screen.findByRole('heading', { name: /^лидогенерация$/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(apiClient.getLeadgenFunnelReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({ preset: 'custom' }),
      )
    })
    vi.mocked(apiClient.getLeadgenFunnelReport).mockClear()
    vi.mocked(apiClient.getLeadgenActivitiesWorkloadReport).mockClear()
    vi.mocked(apiClient.getLeadgenCallsWorkloadReport).mockClear()

    const startInput = screen.getByLabelText(
      'Дата начала основного диапазона',
    ) as HTMLInputElement
    const endInput = screen.getByLabelText(
      'Дата конца основного диапазона',
    ) as HTMLInputElement
    const applyButton = screen.getByRole('button', { name: /^применить фильтры$/i })

    fireEvent.input(startInput, { target: { value: '2026-05-01' } })
    fireEvent.input(endInput, { target: { value: '2026-05-31' } })
    await userEvent.click(applyButton)

    await waitFor(() => {
      expect(apiClient.getLeadgenFunnelReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({
          from: '2026-05-01T00:00:00.000+03:00',
          to: '2026-05-31T23:59:59.999+03:00',
        }),
      )
    })
    expect(apiClient.getLeadgenActivitiesWorkloadReport).not.toHaveBeenCalled()
    expect(apiClient.getLeadgenCallsWorkloadReport).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))

    await waitFor(() => {
      expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({
          from: '2026-05-01T00:00:00.000+03:00',
          to: '2026-05-31T23:59:59.999+03:00',
        }),
      )
      expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({
          from: '2026-05-01T00:00:00.000+03:00',
          to: '2026-05-31T23:59:59.999+03:00',
        }),
      )
    })
    expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledTimes(1)
    expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledTimes(1)

    fireEvent.input(startInput, { target: { value: '2026-06-01' } })
    fireEvent.input(endInput, { target: { value: '2026-06-30' } })
    await userEvent.click(applyButton)

    await waitFor(() => {
      expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledTimes(2)
      expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledTimes(2)
    })
    expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenLastCalledWith(
      'leadgen',
      expect.objectContaining({
        from: '2026-06-01T00:00:00.000+03:00',
        to: '2026-06-30T23:59:59.999+03:00',
      }),
    )
    expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenLastCalledWith(
      'leadgen',
      expect.objectContaining({
        from: '2026-06-01T00:00:00.000+03:00',
        to: '2026-06-30T23:59:59.999+03:00',
      }),
    )
  })

  it('keeps the leadgen sales report usable when the activity workload fails', async () => {
    render(<ProtoApp currentUser={createLeadgenOwner()} />)

    await userEvent.click(await screen.findByRole('button', { name: /^лидогенерация$/i }))
    expect(await screen.findByRole('heading', { name: /^лидогенерация$/i })).toBeInTheDocument()
    expect(screen.getByText('Всего сделок')).toBeInTheDocument()
    expect(screen.getByText('Новый лид')).toBeInTheDocument()

    vi.mocked(apiClient.getLeadgenActivitiesWorkloadReport).mockClear()
    vi.mocked(apiClient.getLeadgenCallsWorkloadReport).mockClear()
    vi.mocked(apiClient.getLeadgenActivitiesWorkloadReport).mockRejectedValueOnce(
      new Error('Workload offline'),
    )

    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))

    expect(await screen.findByText('Workload offline')).toBeInTheDocument()
    expect(screen.queryByText('Всего сделок')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^отчет по продажам$/i }))

    expect(screen.queryByText('Workload offline')).not.toBeInTheDocument()
    expect(screen.getByText('Всего сделок')).toBeInTheDocument()
    expect(screen.getByText('Новый лид')).toBeInTheDocument()
  })

  it('lets a super admin grant explicit module access and role from the account page', async () => {
    const owner: AuthUser = {
      id: 1,
      login: 'owner@example.com',
      firstName: 'Владислав',
      lastName: 'Богдан',
      role: 'admin' as const,
      isSuperAdmin: true,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
        {
          id: 'leadgen',
          slug: 'leadgen',
          name: 'Лидогенерация',
          role: 'leader' as const,
          permissions: [
            'comments:create',
            'comments:update',
            'comments:archive',
            'module-users:manage',
          ],
          bitrixCategoryId: '28',
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    const targetUser = {
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
          moduleRole: 'leader' as const,
          membershipStatus: 'active' as const,
          createdAt: '2026-04-10T12:00:00.000Z',
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    }
    vi.mocked(apiClient.getPlatformAccess).mockResolvedValueOnce({
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
      users: [targetUser],
    })
    vi.mocked(apiClient.updatePlatformUserMemberships)
      .mockResolvedValueOnce({
        user: {
          ...targetUser,
          memberships: [
            targetUser.memberships[0]!,
            {
              ...targetUser.memberships[0]!,
              moduleId: 'leadgen',
              moduleRole: 'employee',
              updatedAt: '2026-04-10T12:05:00.000Z',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        user: {
          ...targetUser,
          memberships: [
            targetUser.memberships[0]!,
            {
              ...targetUser.memberships[0]!,
              moduleId: 'leadgen',
              moduleRole: 'leader',
              updatedAt: '2026-04-10T12:06:00.000Z',
            },
          ],
        },
      })

    render(<ProtoApp currentUser={owner} />)

	    await userEvent.click(
	      await screen.findByRole('button', { name: /^личный кабинет$/i }),
	    )
	    await openAccountTab(/^пользователи/i)

	    expect(
	      await screen.findByRole('heading', { name: /^доступы платформы$/i }),
    ).toBeInTheDocument()
    const leadgenAccess = screen.getByRole('checkbox', {
      name: 'leader@example.com: доступ к модулю Лидогенерация',
    })
    expect(leadgenAccess).not.toBeChecked()

    await userEvent.click(leadgenAccess)

    await waitFor(() => {
      expect(apiClient.updatePlatformUserMemberships).toHaveBeenCalledWith(2, [
        {
          moduleId: 'attraction',
          role: 'leader',
          status: 'active',
        },
        {
          moduleId: 'leadgen',
          role: 'employee',
          status: 'active',
        },
      ])
    })

    const leadgenRole = screen.getByRole('combobox', {
      name: 'leader@example.com: роль в модуле Лидогенерация',
    })
    await waitFor(() => expect(leadgenRole).not.toBeDisabled())
    await userEvent.selectOptions(leadgenRole, 'leader')

    await waitFor(() => {
      expect(apiClient.updatePlatformUserMemberships).toHaveBeenLastCalledWith(2, [
        {
          moduleId: 'attraction',
          role: 'leader',
          status: 'active',
        },
        {
          moduleId: 'leadgen',
          role: 'leader',
          status: 'active',
        },
      ])
    })
  })

  it('loads cohort source breakdowns from the main cohort report without per-source requests', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [
        { key: 'paid', label: 'Платный поиск' },
        { key: 'webinar', label: 'Вебинары' },
        { key: 'partner', label: 'Партнёры' },
        { key: 'organic', label: 'Органика' },
        { key: 'event', label: 'Мероприятия' },
        { key: 'referral', label: 'Рекомендации' },
        { key: 'leadgen-us', label: 'Лидген US' },
        { key: 'internal', label: 'Внутренняя база' },
      ],
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
    })
    vi.mocked(apiClient.getCohortConversionReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 8,
      totalClosedDeals: 3,
      totalWonDeals: 2,
      closureMonths: [],
      relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
      rows: [],
      breakdownRows: [
        {
          id: 'cohort:2026-04',
          level: 'cohort',
          parentId: null,
          cohortMonth: '2026-04',
          cohortLabel: '2026-04',
          sourceKey: null,
          sourceLabel: null,
          qualityKey: null,
          qualityLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 8,
          closedDeals: 3,
          wonDeals: 2,
          closedRate: 37.5,
          wonConversionRate: 25,
          averageDaysToClose: 20,
          averageDaysToWin: 18,
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 1, wonDeals: 0, closedRate: 12.5, wonConversionRate: 0 },
          ],
        },
        {
          id: 'source:2026-04/referral',
          level: 'source',
          parentId: 'cohort:2026-04',
          cohortMonth: '2026-04',
          cohortLabel: '2026-04',
          sourceKey: 'referral',
          sourceLabel: 'Рекомендации',
          qualityKey: null,
          qualityLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 8,
          closedDeals: 3,
          wonDeals: 2,
          closedRate: 37.5,
          wonConversionRate: 25,
          averageDaysToClose: 20,
          averageDaysToWin: 18,
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 1, wonDeals: 0, closedRate: 12.5, wonConversionRate: 0 },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^когортный отчет$/i }))

    await waitFor(() => {
      expect(apiClient.getCohortConversionReport).toHaveBeenCalledTimes(6)
    })
    const cohortQueries = vi.mocked(apiClient.getCohortConversionReport).mock.calls.map(
      ([query]) => query,
    )
    expect(cohortQueries.some((query) => query.sourceKeys && query.sourceKeys.length > 0)).toBe(
      false,
    )
    expect(cohortQueries[0]).not.toHaveProperty('includeBreakdown')
    expect(
      cohortQueries.slice(1).every((query) =>
        query.includeBreakdown === false && query.managerIds?.length === 1
      ),
    ).toBe(true)
  })

  it('renders live sales by manager with deal details inside the prototype sales scene', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 1_250_000,
        averageSaleAmount: 1_250_000,
        attractionRevenueAmount: 1_250_000,
        averageAttractionRevenueAmount: 1_250_000,
        membershipAmount: 1_250_000,
        averageMembershipAmount: 1_250_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
        meetingsCount: 2,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 1_250_000,
          totalAttractionRevenueAmount: 1_250_000,
          averageAttractionRevenueAmount: 1_250_000,
          totalMembershipAmount: 1_250_000,
          averageMembershipAmount: 1_250_000,
          deals: [
            {
              dealId: 'D-100',
              dealTitle: 'ООО Альфа',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 1_250_000,
              attractionRevenueAmount: 1_250_000,
              membershipAmount: 1_250_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-03-12T09:00:00.000Z',
              dateClosed: '2026-04-10T15:00:00.000Z',
              cycleDays: 29,
              sourceKey: 'STORE',
              sourceLabel: 'Сайт',
              qualityValue: '3.1 Готов ко встрече',
              businessClubValue: 'ClubOne',
              targetGroupValue: 'ClubFirst',
              meetingTypeValue: 'Очная',
              meetingDateValue: '2026-03-14T16:00:00.000Z',
              tariffValue: 'Федеральный Москва',
              cohortContext: {
                createdMonth: '2026-03',
                cohortCreatedDeals: 42,
                cohortWonDeals: 7,
                cohortWonConversionRate: 16.67,
              },
              callSummary: {
                total: 8,
                incoming: 1,
                outgoing: 7,
                successful: 5,
                failed: 2,
                overThirtySeconds: 4,
                connectedOverThirtySeconds: 4,
              },
              taskSummary: {
                created: 6,
                closed: 5,
              },
              meetingSummary: {
                total: 2,
              },
              stageTimeline: [
                {
                  stageId: 'C10:CALL',
                  stageName: 'Звонок-знакомство',
                  enteredAt: '2026-03-13T10:00:00.000Z',
                  leftAt: '2026-03-14T10:00:00.000Z',
                  durationHours: 24,
                  meetingEvents: [
                    {
                      activityId: 'M-1',
                      createdAt: '2026-03-13T11:00:00.000Z',
                      timelineAt: '2026-03-13T11:00:00.000Z',
                      scheduledAt: '2026-03-14T16:00:00.000Z',
                      completed: false,
                    },
                  ],
                },
                {
                  stageId: 'C10:MEETING',
                  stageName: 'Встреча-знакомство',
                  enteredAt: '2026-03-14T10:00:00.000Z',
                  leftAt: '2026-03-15T10:00:00.000Z',
                  durationHours: 24,
                  meetingEvents: [
                    {
                      activityId: 'M-2',
                      createdAt: '2026-03-14T11:00:00.000Z',
                      timelineAt: '2026-03-14T11:00:00.000Z',
                      scheduledAt: '2026-03-14T16:00:00.000Z',
                      completed: false,
                      slotIndex: 2,
                      typeValue: 'Zoom',
                      placeValue: null,
                      calendarValue: null,
                      eventId: 'calendar-event-2',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)
    await openSalesScene()

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    expect(await within(salesSection!).findByText('Егоров Андрей')).toBeInTheDocument()
    expect(within(salesSection!).getByText('D-100')).toBeInTheDocument()
    expect(within(salesSection!).queryByText('ООО Альфа')).not.toBeInTheDocument()
    expect(within(salesSection!).getAllByText('1,3 млн').length).toBeGreaterThan(0)
    expect(within(salesSection!).getByText('29 д')).toBeInTheDocument()
    expect(within(salesSection!).getByText('8 всего')).toBeInTheDocument()
    expect(within(salesSection!).getByText('6 / 5')).toBeInTheDocument()
    expect(screen.getByLabelText('KPI продаж')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).getByText('План месяца')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).getByText('План квартала')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).queryByText('Встречи')).not.toBeInTheDocument()
    expect(screen.queryByText('Продажи по месяцам')).not.toBeInTheDocument()
    expect(screen.queryByText('Матрица по источникам')).not.toBeInTheDocument()
    expect(screen.queryByText('Точки конверсии')).not.toBeInTheDocument()
    expect(screen.queryByText('Давление воронки')).not.toBeInTheDocument()

    await userEvent.click(
      await within(salesSection!).findByRole('button', { name: /подробнее/i }),
    )

    expect(within(salesSection!).getByText('Когорта 2026-03')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Итоговое качество')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Источник')).toBeInTheDocument()
    expect(within(salesSection!).getByText('3.1 Готов ко встрече')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Сайт')).toBeInTheDocument()
    expect(within(salesSection!).getByText('ClubFirst')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Федеральный Москва')).toBeInTheDocument()
    expect(within(salesSection!).getByText('2 встреч')).toBeInTheDocument()
    expect(within(salesSection!).getByText(/Встреча 13 мар/i)).toBeInTheDocument()
    expect(within(salesSection!).getByText(/Встреча 2 14 мар/i)).toBeInTheDocument()
    expect(within(salesSection!).getAllByText(/Встреча 2 14 мар/i)).toHaveLength(1)
    const firstMeetingBadge = within(salesSection!).getByText(/Встреча 13 мар/i).closest('span')
    const secondMeetingBadge = within(salesSection!).getByText(/Встреча 2 14 мар/i).closest('span')
    expect(firstMeetingBadge).toHaveAttribute('data-meeting-slot-index', '1')
    expect(secondMeetingBadge).toHaveAttribute('data-meeting-slot-index', '2')
    expect(firstMeetingBadge).toHaveClass('border-amber-100')
    expect(secondMeetingBadge).toHaveClass('border-violet-100')
    expect(firstMeetingBadge).toHaveClass('bg-white')
    expect(secondMeetingBadge).toHaveClass('bg-white')
    expect(within(salesSection!).getByText('Звонок-знакомство')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Встреча-знакомство')).toBeInTheDocument()
    expect(within(salesSection!).getAllByText('24 ч').length).toBeGreaterThan(0)
  })

  it('renders a fallback meeting date only on the next stage when it equals a stage boundary', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 1_250_000,
        averageSaleAmount: 1_250_000,
        attractionRevenueAmount: 1_250_000,
        averageAttractionRevenueAmount: 1_250_000,
        membershipAmount: 1_250_000,
        averageMembershipAmount: 1_250_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
        meetingsCount: 1,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 1_250_000,
          totalAttractionRevenueAmount: 1_250_000,
          averageAttractionRevenueAmount: 1_250_000,
          totalMembershipAmount: 1_250_000,
          averageMembershipAmount: 1_250_000,
          deals: [
            {
              dealId: 'D-101',
              dealTitle: 'Deal D-101',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 1_250_000,
              attractionRevenueAmount: 1_250_000,
              membershipAmount: 1_250_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-03-12T09:00:00.000Z',
              dateClosed: '2026-04-10T15:00:00.000Z',
              cycleDays: 29,
              sourceKey: 'STORE',
              sourceLabel: 'Сайт',
              qualityValue: '3.1 Готов ко встрече',
              businessClubValue: 'ClubOne',
              targetGroupValue: 'ClubFirst',
              meetingTypeValue: 'Очная',
              meetingDateValue: '2026-03-14T10:00:00.000Z',
              tariffValue: 'Федеральный Москва',
              cohortContext: {
                createdMonth: '2026-03',
                cohortCreatedDeals: 42,
                cohortWonDeals: 7,
                cohortWonConversionRate: 16.67,
              },
              callSummary: {
                total: 8,
                incoming: 1,
                outgoing: 7,
                successful: 5,
                failed: 2,
                overThirtySeconds: 4,
                connectedOverThirtySeconds: 4,
              },
              taskSummary: {
                created: 6,
                closed: 5,
              },
              meetingSummary: {
                total: 1,
              },
              stageTimeline: [
                {
                  stageId: 'C10:CALL',
                  stageName: 'Звонок-знакомство',
                  enteredAt: '2026-03-13T10:00:00.000Z',
                  leftAt: '2026-03-14T10:00:00.000Z',
                  durationHours: 24,
                  meetingEvents: [],
                },
                {
                  stageId: 'C10:MEETING',
                  stageName: 'Встреча-знакомство',
                  enteredAt: '2026-03-14T10:00:00.000Z',
                  leftAt: '2026-03-15T10:00:00.000Z',
                  durationHours: 24,
                  meetingEvents: [],
                },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)
    await openSalesScene()

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    await userEvent.click(
      await within(salesSection!).findByRole('button', { name: /подробнее/i }),
    )

    const callStageRow = within(salesSection!)
      .getByText('Звонок-знакомство')
      .closest('.grid')
    const meetingStageRow = within(salesSection!)
      .getByText('Встреча-знакомство')
      .closest('.grid')

    expect(callStageRow).not.toBeNull()
    expect(meetingStageRow).not.toBeNull()
    expect(within(salesSection!).getAllByText(/Встреча 14 мар/i)).toHaveLength(1)
    expect(within(callStageRow as HTMLElement).queryByText(/Встреча 14 мар/i)).not.toBeInTheDocument()
    expect(within(meetingStageRow as HTMLElement).getByText(/Встреча 14 мар/i)).toBeInTheDocument()
  })

  it('warns instead of placing a meeting badge when deal 143570 has meeting date before creation', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 300_000,
        averageSaleAmount: 300_000,
        attractionRevenueAmount: 300_000,
        averageAttractionRevenueAmount: 300_000,
        membershipAmount: 1_100_000,
        averageMembershipAmount: 1_100_000,
        pricingWarnings: [],
        newDealsCount: 1,
        conversionRate: 100,
        meetingsCount: 0,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 300_000,
          totalAttractionRevenueAmount: 300_000,
          averageAttractionRevenueAmount: 300_000,
          totalMembershipAmount: 1_100_000,
          averageMembershipAmount: 1_100_000,
          deals: [
            {
              dealId: '143570',
              dealTitle: 'Deal 143570',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 300_000,
              attractionRevenueAmount: 300_000,
              membershipAmount: 1_100_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-02-13T14:26:19.000+03:00',
              dateClosed: '2026-05-07T18:37:24.000+03:00',
              cycleDays: 83,
              sourceKey: 'RC_GENERATOR',
              sourceLabel: 'Рекомендация от сотрудника',
              qualityValue: '5 Готов к заключению Договора',
              businessClubValue: 'ClubFirst One',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: 'Zoom',
              meetingDateValue: '2026-02-02T00:00:00.000+03:00',
              tariffValue: 'Федеральный Москва',
              cohortContext: {
                createdMonth: '2026-02',
                cohortCreatedDeals: 10,
                cohortWonDeals: 1,
                cohortWonConversionRate: 10,
              },
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
                created: 10,
                closed: 10,
              },
              meetingSummary: {
                total: 0,
              },
              stageTimeline: [
                {
                  stageId: 'C10:NEW',
                  stageName: 'База входящая',
                  enteredAt: '2026-02-13T14:26:19.000+03:00',
                  leftAt: '2026-03-11T17:51:27.000+03:00',
                  durationHours: 627,
                  meetingEvents: [],
                },
                {
                  stageId: 'C10:UC_9E0XYG',
                  stageName: 'Встреча-знакомство',
                  enteredAt: '2026-03-11T17:51:27.000+03:00',
                  leftAt: '2026-03-11T17:55:15.000+03:00',
                  durationHours: 0,
                  meetingEvents: [],
                },
                {
                  stageId: 'C10:UC_5KZT6Y',
                  stageName: 'Адмиссия',
                  enteredAt: '2026-03-11T17:55:15.000+03:00',
                  leftAt: '2026-03-11T17:55:21.000+03:00',
                  durationHours: 0,
                  meetingEvents: [],
                },
                {
                  stageId: 'C10:UC_M1M5WM',
                  stageName: 'Контракт (договор+счёт)',
                  enteredAt: '2026-03-11T17:55:21.000+03:00',
                  leftAt: '2026-05-07T17:10:17.000+03:00',
                  durationHours: 1367,
                  meetingEvents: [],
                },
                {
                  stageId: 'C10:UC_7CLBFT',
                  stageName: 'На передаче',
                  enteredAt: '2026-05-07T17:10:17.000+03:00',
                  leftAt: '2026-05-07T18:37:24.000+03:00',
                  durationHours: 1,
                  meetingEvents: [],
                },
                {
                  stageId: 'C10:WON',
                  stageName: 'Передано в клуб',
                  enteredAt: '2026-05-07T18:37:24.000+03:00',
                  leftAt: '2026-05-07T18:37:24.000+03:00',
                  durationHours: 0,
                  meetingEvents: [],
                },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)
    await openSalesScene()

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    await userEvent.click(
      await within(salesSection!).findByRole('button', { name: /подробнее/i }),
    )

    expect(within(salesSection!).getByText('143570')).toBeInTheDocument()
    expect(within(salesSection!).getByText(/^02 февр\.$/i)).toBeInTheDocument()
    expect(
      within(salesSection!).getByText(/дата встречи раньше создания сделки/i),
    ).toBeInTheDocument()
    expect(within(salesSection!).queryByText(/Встреча 02 февр/i)).not.toBeInTheDocument()
    expect(within(salesSection!).getByText('Встреча-знакомство')).toBeInTheDocument()
  })

  it('does not warn when the meeting date is on the deal creation day', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 300_000,
        averageSaleAmount: 300_000,
        attractionRevenueAmount: 300_000,
        averageAttractionRevenueAmount: 300_000,
        membershipAmount: 1_100_000,
        averageMembershipAmount: 1_100_000,
        pricingWarnings: [],
        newDealsCount: 1,
        conversionRate: 100,
        meetingsCount: 0,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 300_000,
          totalAttractionRevenueAmount: 300_000,
          averageAttractionRevenueAmount: 300_000,
          totalMembershipAmount: 1_100_000,
          averageMembershipAmount: 1_100_000,
          deals: [
            {
              dealId: '143570',
              dealTitle: 'Deal 143570',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 300_000,
              attractionRevenueAmount: 300_000,
              membershipAmount: 1_100_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-02-13T14:26:19.000+03:00',
              dateClosed: '2026-05-07T18:37:24.000+03:00',
              cycleDays: 83,
              sourceKey: 'RC_GENERATOR',
              sourceLabel: 'Рекомендация от сотрудника',
              qualityValue: '5 Готов к заключению Договора',
              businessClubValue: 'ClubFirst One',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: 'Zoom',
              meetingDateValue: '2026-02-13T00:00:00.000+03:00',
              tariffValue: 'Федеральный Москва',
              cohortContext: {
                createdMonth: '2026-02',
                cohortCreatedDeals: 10,
                cohortWonDeals: 1,
                cohortWonConversionRate: 10,
              },
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
                created: 10,
                closed: 10,
              },
              meetingSummary: {
                total: 0,
              },
              stageTimeline: [
                {
                  stageId: 'C10:NEW',
                  stageName: 'База входящая',
                  enteredAt: '2026-02-13T14:26:19.000+03:00',
                  leftAt: '2026-03-11T17:51:27.000+03:00',
                  durationHours: 627,
                  meetingEvents: [],
                },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)
    await openSalesScene()

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    await userEvent.click(
      await within(salesSection!).findByRole('button', { name: /подробнее/i }),
    )

    expect(within(salesSection!).getAllByText(/^13 февр\.$/i).length).toBeGreaterThan(0)
    expect(
      within(salesSection!).queryByText(/дата встречи раньше создания сделки/i),
    ).not.toBeInTheDocument()
    expect(within(salesSection!).queryByText(/Встреча 13 февр/i)).not.toBeInTheDocument()
  })

  it('renders stage timeline interaction badges for calls, tasks, and reserved channels', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 1_250_000,
        averageSaleAmount: 1_250_000,
        attractionRevenueAmount: 1_250_000,
        averageAttractionRevenueAmount: 1_250_000,
        membershipAmount: 1_250_000,
        averageMembershipAmount: 1_250_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
        meetingsCount: 1,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 1_250_000,
          totalAttractionRevenueAmount: 1_250_000,
          averageAttractionRevenueAmount: 1_250_000,
          totalMembershipAmount: 1_250_000,
          averageMembershipAmount: 1_250_000,
          deals: [
            {
              dealId: 'D-102',
              dealTitle: 'Deal D-102',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 1_250_000,
              attractionRevenueAmount: 1_250_000,
              membershipAmount: 1_250_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-03-12T09:00:00.000Z',
              dateClosed: '2026-04-10T15:00:00.000Z',
              cycleDays: 29,
              sourceKey: 'STORE',
              sourceLabel: 'Сайт',
              qualityValue: '3.1 Готов ко встрече',
              businessClubValue: 'ClubOne',
              targetGroupValue: 'ClubFirst',
              meetingTypeValue: 'Очная',
              meetingDateValue: '2026-03-14T16:00:00.000Z',
              tariffValue: 'Федеральный Москва',
              cohortContext: {
                createdMonth: '2026-03',
                cohortCreatedDeals: 42,
                cohortWonDeals: 7,
                cohortWonConversionRate: 16.67,
              },
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
              meetingSummary: {
                total: 1,
              },
              stageTimeline: [
                {
                  stageId: 'C10:CALL',
                  stageName: 'Звонок-знакомство',
                  enteredAt: '2026-03-13T10:00:00.000Z',
                  leftAt: '2026-03-14T10:00:00.000Z',
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
                      createdAt: '2026-03-13T11:00:00.000Z',
                      timelineAt: '2026-03-13T11:00:00.000Z',
                      scheduledAt: '2026-03-14T16:00:00.000Z',
                      completed: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)
    await openSalesScene()

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    await userEvent.click(await within(salesSection!).findByRole('button', { name: /подробнее/i }))

    const callStageRow = within(salesSection!)
      .getByText('Звонок-знакомство')
      .closest('[data-stage-timeline-row]')

    expect(callStageRow).not.toBeNull()
    expect(within(callStageRow as HTMLElement).getByText(/Звонки 3/i)).toBeInTheDocument()
    expect(within(callStageRow as HTMLElement).getByText(/1 вход. · 2 исход. · 1 >30с/i)).toBeInTheDocument()
    expect(within(callStageRow as HTMLElement).getByText(/Дела 2 \/ 1/i)).toBeInTheDocument()
    expect(within(callStageRow as HTMLElement).getByText(/Мероприятия недоступны/i)).toBeInTheDocument()
    expect(within(callStageRow as HTMLElement).queryByText(/Конверсии недоступны/i)).not.toBeInTheDocument()
    expect(within(callStageRow as HTMLElement).getByText(/Сообщения недоступны/i)).toBeInTheDocument()
    expect(within(callStageRow as HTMLElement).getAllByText(/Встреча 13 мар/i)).toHaveLength(1)
    expect(callStageRow as HTMLElement).toHaveClass('grid-cols-1')
    expect((callStageRow as HTMLElement).className).toContain('sm:grid-cols-[minmax(0,1fr)_7rem_6rem]')
    expect(within(callStageRow as HTMLElement).getByText(/Звонки 3/i)).toHaveClass(
      'max-w-full',
      'whitespace-normal',
      'break-words',
    )
  })

  it('renders lifecycle card economics and timeline events when the API provides the shared card', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 300_000,
        averageSaleAmount: 300_000,
        attractionRevenueAmount: 300_000,
        averageAttractionRevenueAmount: 300_000,
        membershipAmount: 1_100_000,
        averageMembershipAmount: 1_100_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
        meetingsCount: 1,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Ромашова Ольга',
          totalWonDeals: 1,
          totalSalesAmount: 300_000,
          totalAttractionRevenueAmount: 300_000,
          averageAttractionRevenueAmount: 300_000,
          totalMembershipAmount: 1_100_000,
          averageMembershipAmount: 1_100_000,
          deals: [
            {
              dealId: 'D-LIFE',
              dealTitle: 'D-LIFE',
              managerId: '78',
              managerName: 'Ромашова Ольга',
              amount: 300_000,
              attractionRevenueAmount: 300_000,
              membershipAmount: 1_100_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-04-10T09:00:00.000Z',
              dateClosed: '2026-04-20T12:00:00.000Z',
              cycleDays: 10,
              sourceKey: 'LEADGEN_US',
              sourceLabel: 'Лидген УС',
              qualityValue: 'Готов к встрече',
              businessClubValue: 'ClubFirst One',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: 'Очная',
              meetingDateValue: '2026-04-18T12:00:00.000Z',
              tariffValue: 'Федеральный',
              cohortContext: {
                createdMonth: '2026-04',
                cohortCreatedDeals: 12,
                cohortWonDeals: 1,
                cohortWonConversionRate: 8.33,
              },
              callSummary: {
                total: 1,
                incoming: 0,
                outgoing: 1,
                successful: 1,
                failed: 0,
                overThirtySeconds: 1,
                connectedOverThirtySeconds: 1,
              },
              taskSummary: { created: 1, closed: 1 },
              meetingSummary: { total: 1 },
              stageTimeline: [],
              lifecycleCard: {
                dealId: 'D-LIFE',
                managerId: '78',
                managerName: 'Ромашова Ольга',
                status: 'won',
                stageId: 'C10:WON',
                stageName: 'Передано в клуб',
                dateCreate: '2026-04-10T09:00:00.000Z',
                dateClosed: '2026-04-20T12:00:00.000Z',
                dateModify: '2026-04-20T12:00:00.000Z',
                cycleDays: 10,
                sourceKey: 'LEADGEN_US',
                sourceLabel: 'Лидген УС',
                qualityValue: 'Готов к встрече',
                businessClubValue: 'ClubFirst One',
                targetGroupValue: 'ClubFirst Russia',
                meetingTypeValue: 'Очная',
                meetingDateValue: '2026-04-18T12:00:00.000Z',
                tariffValue: 'Федеральный',
                cohortContext: {
                  createdMonth: '2026-04',
                  cohortCreatedDeals: 12,
                  cohortWonDeals: 1,
                  cohortWonConversionRate: 8.33,
                },
                economics: {
                  revenueMode: 'actual',
                  attractionRevenueAmount: 300_000,
                  membershipAmount: 1_100_000,
                  saleCostAmount: 52_000,
                  marginAmount: 248_000,
                  allocatedFixedCostAmount: 260_000,
                  fullyLoadedCostAmount: 312_000,
                  fullyLoadedMarginAmount: -12_000,
                  costRows: [
                    {
                      id: 'lead:143536:leadgen-ready-to-meet',
                      articleId: 'lead_purchase',
                      label: 'Лид',
                      amount: 40_000,
                      basis: 'Созданная сделка источника/качества',
                      sourceSystem: 'rule',
                      confidence: 'inferred',
                    },
                    {
                      id: 'contract:143536:contractation-per-won',
                      articleId: 'contractation',
                      label: 'Контрактация',
                      amount: 5_000,
                      basis: 'Выигранная сделка',
                      sourceSystem: 'rule',
                      confidence: 'inferred',
                    },
                  ],
                  allocatedFixedCostRows: [
                    {
                      id: 'fixed-other:2026-04:78:other-fixed-expenses',
                      articleId: 'other_fixed_expenses',
                      label: 'Другие постоянные расходы',
                      amount: 260_000,
                      basis: 'Общемодульные расходы за 2026-04 / 1 выигранная сделка модуля',
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
                  taskSummary: { created: 1, closed: 1 },
                  meetingSummary: { total: 1 },
                  conversionEventVisits: 1,
                },
                stageTimeline: [
                  {
                    stageId: 'C10:WON',
                    stageName: 'Передано в клуб',
                    enteredAt: '2026-04-10T09:00:00.000Z',
                    leftAt: '2026-04-20T12:00:00.000Z',
                    durationHours: 243,
                    callSummary: {
                      total: 1,
                      incoming: 0,
                      outgoing: 1,
                      successful: 1,
                      failed: 0,
                      overThirtySeconds: 1,
                      connectedOverThirtySeconds: 1,
                    },
                    taskSummary: { created: 1, closed: 1 },
                    meetingEvents: [],
                    events: [
                      {
                        id: 'call:CALL_1',
                        kind: 'call',
                        occurredAt: '2026-04-16T10:00:00.000Z',
                        stageId: 'C10:WON',
                        stageName: 'Передано в клуб',
                        title: 'Звонок',
                        detail: 'исходящий · 90с · >30с · успешный',
                        badgeLabel: null,
                        linkConfidence: 'high',
                      },
                      {
                        id: 'task-created:TASK_1',
                        kind: 'task_created',
                        occurredAt: '2026-04-17T10:00:00.000Z',
                        stageId: 'C10:WON',
                        stageName: 'Передано в клуб',
                        title: 'Дело создано',
                        detail: null,
                        badgeLabel: null,
                        linkConfidence: 'high',
                      },
                      {
                        id: 'task-completed:TASK_1',
                        kind: 'task_completed',
                        occurredAt: '2026-04-17T12:00:00.000Z',
                        stageId: 'C10:WON',
                        stageName: 'Передано в клуб',
                        title: 'Дело закрыто',
                        detail: null,
                        badgeLabel: null,
                        linkConfidence: 'high',
                      },
                      {
                        id: 'conversion-event-visit:VISIT_1',
                        kind: 'conversion_event_visit',
                        occurredAt: '2026-04-18T12:00:00.000Z',
                        stageId: 'C10:WON',
                        stageName: 'Передано в клуб',
                        title: 'Мероприятие: Гостевая встреча ClubFirst',
                        detail: 'пришел',
                        badgeLabel: 'Гостевая встреча ClubFirst · пришел',
                        linkConfidence: 'high',
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
    })

    render(<ProtoApp />)
    await openSalesScene()

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    expect(within(salesSection!).getByText('Прибыль')).toBeInTheDocument()
    expect(within(salesSection!).getByText('-12 000')).toHaveClass('text-rose-700')

    await userEvent.click(await within(salesSection!).findByRole('button', { name: /подробнее/i }))

    expect(within(salesSection!).getByText('Маржинальная себестоимость')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Полная себестоимость')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Полный результат')).toBeInTheDocument()
    const totalExpenseAmounts = within(salesSection!).getAllByText('-52 000')
    expect(totalExpenseAmounts).toHaveLength(1)
    for (const amount of totalExpenseAmounts) {
      expect(amount).toHaveClass('text-rose-700')
    }
    expect(within(salesSection!).getByText('-312 000')).toHaveClass('text-rose-700')
    for (const amount of within(salesSection!).getAllByText('-260 000')) {
      expect(amount).toHaveClass('text-rose-700')
    }
    expect(within(salesSection!).getByText('-40 000')).toHaveClass('text-rose-700')
    expect(within(salesSection!).getByText('-5 000')).toHaveClass('text-rose-700')
    expect(within(salesSection!).getByText('Гостевая встреча ClubFirst · пришел')).toBeInTheDocument()
    expect(within(salesSection!).getByText(/Звонки 1/i)).toBeInTheDocument()
    expect(within(salesSection!).getByText(/Дела 1 \/ 1/i)).toBeInTheDocument()
    expect(
      within(salesSection!).queryByText(/Звонок · исходящий · 90с · >30с · успешный/i),
    ).not.toBeInTheDocument()
    expect(within(salesSection!).queryByText('Дело создано')).not.toBeInTheDocument()
    expect(within(salesSection!).queryByText('Дело закрыто')).not.toBeInTheDocument()
    expect(within(salesSection!).getByText('Лид')).toBeInTheDocument()
    expect(within(salesSection!).queryByText(/Мероприятия недоступны/i)).not.toBeInTheDocument()
  })

  it('shows monthly and quarterly plan completion in sales KPI cards', async () => {
    vi.mocked(apiClient.getDashboard)
      .mockResolvedValueOnce(createSalesDashboard(7))
      .mockResolvedValueOnce(createSalesDashboard(10))
      .mockResolvedValueOnce(createSalesDashboard(40))
    vi.mocked(apiClient.getEffectiveSalesPlan)
      .mockResolvedValueOnce(createSalesPlan(5))
      .mockResolvedValueOnce(createSalesPlan(20))
    vi.mocked(apiClient.getSalesPlanQuarter).mockResolvedValueOnce(
      createQuarterSalesPlan([
        {
          managerId: '78',
          managerName: 'Потапова Мария',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          quarterPlannedDeals: 80,
          quarterPlannedAmount: 0,
          months: [
            {
              month: '2026-04',
              periodStart: '2026-04-01T00:00:00.000+03:00',
              periodEnd: '2026-04-30T23:59:59.999+03:00',
              plannedDeals: 20,
              plannedAmount: 0,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
            {
              month: '2026-05',
              periodStart: '2026-05-01T00:00:00.000+03:00',
              periodEnd: '2026-05-31T23:59:59.999+03:00',
              plannedDeals: 30,
              plannedAmount: 0,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
            {
              month: '2026-06',
              periodStart: '2026-06-01T00:00:00.000+03:00',
              periodEnd: '2026-06-30T23:59:59.999+03:00',
              plannedDeals: 30,
              plannedAmount: 0,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ]),
    )

    render(<ProtoApp />)
    await openSalesScene()

    const kpiSection = screen.getByLabelText('KPI продаж')
    expect(await within(kpiSection).findByText('План месяца')).toBeInTheDocument()
    expect(await within(kpiSection).findByText('План квартала')).toBeInTheDocument()
    expect(await within(kpiSection).findByText('10 / 20 продаж')).toBeInTheDocument()
    expect(await within(kpiSection).findByText('40 / 80 продаж')).toBeInTheDocument()
    expect(within(kpiSection).getAllByText('50%')).toHaveLength(2)
    expect(within(kpiSection).queryByText('Новые сделки / конверсия')).not.toBeInTheDocument()
    expect(within(kpiSection).queryByText('Встречи')).not.toBeInTheDocument()
  })

  it('edits a quarterly sales plan and compares effective plan with actual sales', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 1_250_000,
        averageSaleAmount: 1_250_000,
        attractionRevenueAmount: 1_250_000,
        averageAttractionRevenueAmount: 1_250_000,
        membershipAmount: 1_250_000,
        averageMembershipAmount: 1_250_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 1_250_000,
          totalAttractionRevenueAmount: 1_250_000,
          averageAttractionRevenueAmount: 1_250_000,
          totalMembershipAmount: 1_250_000,
          averageMembershipAmount: 1_250_000,
          deals: [
            {
              dealId: 'D-100',
              dealTitle: 'ООО Альфа',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 1_250_000,
              attractionRevenueAmount: 1_250_000,
              membershipAmount: 1_250_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-03-12T09:00:00.000Z',
              dateClosed: '2026-04-10T15:00:00.000Z',
              cycleDays: 29,
              sourceKey: 'STORE',
              sourceLabel: 'Сайт',
              qualityValue: null,
              businessClubValue: 'ClubFirst Russia',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: null,
              tariffValue: null,
              cohortContext: {
                createdMonth: '2026-03',
                cohortCreatedDeals: 42,
                cohortWonDeals: 7,
                cohortWonConversionRate: 16.67,
              },
              callSummary: {
                total: 0,
                incoming: 0,
                outgoing: 0,
                successful: 0,
                failed: 0,
                overThirtySeconds: 0,
                connectedOverThirtySeconds: 0,
              },
              taskSummary: { created: 0, closed: 0 },
              meetingSummary: { total: 0 },
              stageTimeline: [],
            },
          ],
        },
      ],
      comparisons: [],
    })
    vi.mocked(apiClient.getEffectiveSalesPlan).mockResolvedValueOnce({
      periodStart: '2026-04-20T00:00:00.000+03:00',
      periodEnd: '2026-04-26T23:59:59.999+03:00',
      updatedAt: '2026-04-10T12:00:00.000Z',
      rows: [
        {
          periodStart: '2026-04-20T00:00:00.000+03:00',
          periodEnd: '2026-04-26T23:59:59.999+03:00',
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          plannedDeals: 2,
          plannedAmount: 1_166_667,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })
    vi.mocked(apiClient.getSalesPlanQuarter).mockResolvedValueOnce(
      createQuarterSalesPlan([
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9_000_000,
          months: [
            {
              month: '2026-04',
              periodStart: '2026-04-01T00:00:00.000+03:00',
              periodEnd: '2026-04-30T23:59:59.999+03:00',
              plannedDeals: 3,
              plannedAmount: 3_000_000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
            {
              month: '2026-05',
              periodStart: '2026-05-01T00:00:00.000+03:00',
              periodEnd: '2026-05-31T23:59:59.999+03:00',
              plannedDeals: 3,
              plannedAmount: 3_000_000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
            {
              month: '2026-06',
              periodStart: '2026-06-01T00:00:00.000+03:00',
              periodEnd: '2026-06-30T23:59:59.999+03:00',
              plannedDeals: 3,
              plannedAmount: 3_000_000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ]),
    )

    renderProtoAppAt('2026-04-10T12:00:00+03:00')
    await openSalesScene()

    const expectedDefaultFilters = createDefaultFilters(new Date('2026-04-10T12:00:00+03:00'))
    await waitFor(() => {
      expect(apiClient.getEffectiveSalesPlan).toHaveBeenCalledWith({
        from: `${expectedDefaultFilters.rangeStart}T00:00:00.000+03:00`,
        to: `${expectedDefaultFilters.rangeEnd}T23:59:59.999+03:00`,
      })
    })

    const planFactHeading = await screen.findByRole('heading', {
      name: /план \/ факт продаж/i,
    })
    const planFactSection = planFactHeading.closest('section')
    expect(planFactSection).not.toBeNull()
    await waitFor(() => {
      expect(within(planFactSection as HTMLElement).getByText('ClubFirst Russia')).toBeInTheDocument()
      expect(within(planFactSection as HTMLElement).getAllByText('50%').length).toBeGreaterThan(0)
      expect(
        within(planFactSection as HTMLElement).getByText(/1 \/ 2 сделок/i),
      ).toBeInTheDocument()
    })

    await userEvent.click(await screen.findByRole('button', { name: /^План продаж$/i }))

    expect(await screen.findByRole('heading', { name: /^План продаж$/i })).toBeInTheDocument()
    expect(screen.queryByText('Разрез плана')).not.toBeInTheDocument()
    expect(screen.queryByText('Поля плана')).not.toBeInTheDocument()
    expect(screen.queryByText('Источник факта')).not.toBeInTheDocument()
    expect(screen.queryByText('Сохранение')).not.toBeInTheDocument()
    expect(screen.getByText('2 квартал 2026')).toBeInTheDocument()
    expect(screen.getAllByText('Доход, млн ₽').length).toBeGreaterThan(0)
    expect(screen.queryByText('Апрель доход')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Таргет-группа 1').tagName).toBe('SELECT')
    expect(
      screen.getByLabelText('Квартальный план дохода, млн ₽ Егоров Андрей ClubFirst Russia'),
    ).toHaveValue(9)
    const quarterDealsInput = screen.getByLabelText(
      'Квартальный план сделок Егоров Андрей ClubFirst Russia',
    )
    await userEvent.clear(quarterDealsInput)
    await userEvent.type(quarterDealsInput, '10')
    const aprilDealsInput = screen.getByLabelText(
      'План сделок Апрель Егоров Андрей ClubFirst Russia',
    )
    const mayDealsInput = screen.getByLabelText(
      'План сделок Май Егоров Андрей ClubFirst Russia',
    )
    const juneDealsInput = screen.getByLabelText(
      'План сделок Июнь Егоров Андрей ClubFirst Russia',
    )
    expect(aprilDealsInput).toHaveValue(4)
    expect(mayDealsInput).toHaveValue(3)
    expect(juneDealsInput).toHaveValue(3)

    const quarterAmountInput = screen.getByLabelText(
      'Квартальный план дохода, млн ₽ Егоров Андрей ClubFirst Russia',
    )
    await userEvent.clear(quarterAmountInput)
    await userEvent.type(quarterAmountInput, '12')
    expect(screen.getByLabelText('План дохода, млн ₽ Апрель Егоров Андрей ClubFirst Russia')).toHaveValue(4)
    expect(screen.getByLabelText('План дохода, млн ₽ Май Егоров Андрей ClubFirst Russia')).toHaveValue(4)
    expect(screen.getByLabelText('План дохода, млн ₽ Июнь Егоров Андрей ClubFirst Russia')).toHaveValue(4)

    await userEvent.clear(mayDealsInput)
    await userEvent.type(mayDealsInput, '2')
    const mismatchedRow = mayDealsInput.closest('tr')
    expect(mismatchedRow).toHaveAttribute('data-plan-mismatch', 'true')
    expect(
      within(mismatchedRow as HTMLElement).getByText(/Сумма месяцев не равна квартальному плану/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Исправьте строки перед сохранением/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /сохранить план/i })).toBeDisabled()

    await userEvent.clear(aprilDealsInput)
    await userEvent.type(aprilDealsInput, '5')
    await waitFor(() => {
      expect(screen.queryByText(/Сумма месяцев не равна квартальному плану/i)).not.toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /сохранить план/i }))

    await waitFor(() => {
      expect(apiClient.saveSalesPlanQuarter).toHaveBeenCalledWith({
        year: 2026,
        quarter: 2,
        rows: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            targetGroupKey: 'ClubFirst Russia',
            targetGroupLabel: 'ClubFirst Russia',
            quarterPlannedDeals: 10,
            quarterPlannedAmount: 12_000_000,
            months: [
              { month: '2026-04', plannedDeals: 5, plannedAmount: 4_000_000 },
              { month: '2026-05', plannedDeals: 2, plannedAmount: 4_000_000 },
              { month: '2026-06', plannedDeals: 3, plannedAmount: 4_000_000 },
            ],
          },
        ],
      })
    })
  })

  it('offers target-group choices for the first quarterly plan even when the report slice is empty', async () => {
    vi.mocked(apiClient.getSalesPlanQuarter).mockResolvedValueOnce(createQuarterSalesPlan())

    render(<ProtoApp />)
    await openSalesScene()

    await userEvent.click(await screen.findByRole('button', { name: /^План продаж$/i }))

    const targetGroupSelect = await screen.findByLabelText('Таргет-группа 1')
    expect(
      within(targetGroupSelect).getByRole('option', { name: 'ClubFirst Russia' }),
    ).toBeInTheDocument()
  })

  it('does not allow saving the previous quarter plan while another quarter is loading', async () => {
    let resolveNextPlan: (value: Awaited<ReturnType<typeof apiClient.getSalesPlanQuarter>>) => void =
      () => undefined
    const nextPlanPromise = new Promise<Awaited<ReturnType<typeof apiClient.getSalesPlanQuarter>>>(
      (resolve) => {
        resolveNextPlan = resolve
      },
    )

    vi.mocked(apiClient.getSalesPlanQuarter)
      .mockResolvedValueOnce(
        createQuarterSalesPlan([
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            targetGroupKey: 'ClubFirst Russia',
            targetGroupLabel: 'ClubFirst Russia',
            quarterPlannedDeals: 9,
            quarterPlannedAmount: 9_000_000,
            months: [
              {
                month: '2026-04',
                periodStart: '2026-04-01T00:00:00.000+03:00',
                periodEnd: '2026-04-30T23:59:59.999+03:00',
                plannedDeals: 3,
                plannedAmount: 3_000_000,
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
              {
                month: '2026-05',
                periodStart: '2026-05-01T00:00:00.000+03:00',
                periodEnd: '2026-05-31T23:59:59.999+03:00',
                plannedDeals: 3,
                plannedAmount: 3_000_000,
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
              {
                month: '2026-06',
                periodStart: '2026-06-01T00:00:00.000+03:00',
                periodEnd: '2026-06-30T23:59:59.999+03:00',
                plannedDeals: 3,
                plannedAmount: 3_000_000,
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
            ],
            updatedAt: '2026-04-10T12:00:00.000Z',
          },
        ]),
      )
      .mockImplementationOnce(async () => nextPlanPromise)

    renderProtoAppAt('2026-04-10T12:00:00+03:00')

    await userEvent.click(await screen.findByRole('button', { name: /^План продаж$/i }))
    expect(
      await screen.findByLabelText('Квартальный план сделок Егоров Андрей ClubFirst Russia'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /следующий квартал/i }))

    await waitFor(() => {
      expect(apiClient.getSalesPlanQuarter).toHaveBeenLastCalledWith({
        year: 2026,
        quarter: 3,
      })
    })
    expect(screen.getByRole('button', { name: /загружаю план/i })).toBeDisabled()
    expect(
      screen.queryByLabelText('Квартальный план сделок Егоров Андрей ClubFirst Russia'),
    ).not.toBeInTheDocument()

    resolveNextPlan({
      ...createQuarterSalesPlan(),
      quarter: 3,
      periodStart: '2026-07-01T00:00:00.000+03:00',
      periodEnd: '2026-09-30T23:59:59.999+03:00',
      months: [
        {
          month: '2026-07',
          label: 'Июль',
          periodStart: '2026-07-01T00:00:00.000+03:00',
          periodEnd: '2026-07-31T23:59:59.999+03:00',
        },
        {
          month: '2026-08',
          label: 'Август',
          periodStart: '2026-08-01T00:00:00.000+03:00',
          periodEnd: '2026-08-31T23:59:59.999+03:00',
        },
        {
          month: '2026-09',
          label: 'Сентябрь',
          periodStart: '2026-09-01T00:00:00.000+03:00',
          periodEnd: '2026-09-30T23:59:59.999+03:00',
        },
      ],
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /сохранить план/i })).toBeEnabled()
    })
  })

  it('moves the action-to-result block to cohorts without compare subrows', async () => {
    vi.mocked(apiClient.getTargetGroupConversionReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 3,
      totalWonDeals: 2,
      rows: [
        {
          targetGroupKey: 'ClubFirst',
          targetGroupLabel: 'ClubFirst',
          createdDeals: 2,
          wonDeals: 1,
          winRate: 0.5,
          salesAmount: 120000,
          averageSaleAmount: 120000,
          averageCycleDays: 10,
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            totalCreatedDeals: 2,
            totalWonDeals: 1,
            rows: [
              {
                targetGroupKey: 'ClubFirst',
                targetGroupLabel: 'ClubFirst',
                createdDeals: 1,
                wonDeals: 1,
                winRate: 1,
                salesAmount: 90000,
                averageSaleAmount: 90000,
                averageCycleDays: 8,
              },
            ],
          },
        },
      ],
    })
    vi.mocked(apiClient.getManagerActionOutcomeReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      warnings: ['198 сделок без заказчика/таргет-группы для оценки активной воронки'],
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          createdTasks: 5,
          closedTasks: 4,
          totalCalls: 10,
          successfulCallsOverThirtySeconds: 6,
          meetingsCount: 2,
          sla1OnTimeCount: 2,
          sla1LateCount: 0,
          sla1NoTouchCount: 0,
          sla1MedianHours: 1.5,
          sla2OnTimeCount: 2,
          sla2LateCount: 0,
          sla2NoTouchCount: 0,
          sla2MedianHours: 3,
          sla3OnTimeCount: 1,
          sla3LateCount: 1,
          sla3NoTouchCount: 0,
          sla3MedianHours: 5,
          newDealsCount: 3,
          wonDealsCount: 1,
          winRate: 0.3333,
          salesAmount: 120000,
          averageSaleAmount: 120000,
          averageCycleDays: 10,
        },
      ],
      cohortMonths: [
        { cohortMonth: '2026-04', cohortLabel: '2026-04', totalCreatedDeals: 3 },
      ],
      cohortStatusRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: null,
          statusKey: 'won',
          statusLabel: 'Выиграно',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 1,
          closedTasksPerDeal: 1,
          totalCallsPerDeal: 2,
          successfulCallsOverThirtySecondsPerDeal: 2,
          meetingsPerDeal: 1,
          sla1OnTimeRate: 1,
          sla2OnTimeRate: 1,
          sla3OnTimeRate: 1,
          financialAmount: 120000,
          averageFinancialAmount: 120000,
          dealDetails: [
            {
              dealId: 'D1',
              stageId: 'C10:WON',
              stageName: 'Передано в клуб',
              amount: 120000,
              dateCreate: '2026-04-01T10:00:00.000Z',
              dateClosed: '2026-04-04T10:00:00.000Z',
              dateModify: '2026-04-04T10:00:00.000Z',
              sourceKey: 'WEB',
              sourceLabel: 'Сайт',
              qualityValue: '2 Пришёл на мероприятие',
              businessClubValue: 'ClubFirst One',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: 'Мероприятие',
              meetingDateValue: '2026-04-04T12:00:00.000Z',
              tariffValue: 'Федеральный Москва',
              taskSummary: { created: 1, closed: 1 },
              callSummary: {
                total: 2,
                incoming: 0,
                outgoing: 2,
                successful: 2,
                failed: 0,
                overThirtySeconds: 2,
                connectedOverThirtySeconds: 2,
              },
              meetingSummary: { total: 1 },
              sla: {
                sla1: { status: 'onTime', hours: 1 },
                sla2: { status: 'onTime', hours: 2 },
                sla3: { status: 'onTime', hours: 3 },
              },
              stageTimeline: [
                {
                  stageId: 'C10:WON',
                  stageName: 'Передано в клуб',
                  enteredAt: '2026-04-04T10:00:00.000Z',
                  leftAt: '2026-04-05T10:00:00.000Z',
                  durationHours: 24,
                  meetingEvents: [],
                },
              ],
              lifecycleCard: {
                dealId: 'D1',
                managerId: '78',
                managerName: 'Егоров Андрей',
                status: 'won',
                stageId: 'C10:WON',
                stageName: 'Передано в клуб',
                dateCreate: '2026-04-01T10:00:00.000Z',
                dateClosed: '2026-04-04T10:00:00.000Z',
                dateModify: '2026-04-04T10:00:00.000Z',
                cycleDays: 3,
                sourceKey: 'WEB',
                sourceLabel: 'Сайт',
                qualityValue: '2 Пришёл на мероприятие',
                businessClubValue: 'ClubFirst One',
                targetGroupValue: 'ClubFirst Russia',
                meetingTypeValue: 'Мероприятие',
                meetingDateValue: '2026-04-04T12:00:00.000Z',
                tariffValue: 'Федеральный Москва',
                economics: {
                  revenueMode: 'actual',
                  attractionRevenueAmount: 120000,
                  membershipAmount: 120000,
                  saleCostAmount: 15000,
                  marginAmount: 105000,
                  allocatedFixedCostAmount: 0,
                  fullyLoadedCostAmount: 15000,
                  fullyLoadedMarginAmount: 105000,
                  costRows: [
                    {
                      id: 'event:VISIT_1:event-participant',
                      articleId: 'event_participant',
                      label: 'Мероприятие',
                      amount: 15000,
                      basis: 'Участие в гостевой встрече',
                      sourceSystem: 'rule',
                      confidence: 'inferred',
                    },
                  ],
                  allocatedFixedCostRows: [],
                },
                eventSummary: {
                  callSummary: {
                    total: 2,
                    incoming: 0,
                    outgoing: 2,
                    successful: 2,
                    failed: 0,
                    overThirtySeconds: 2,
                    connectedOverThirtySeconds: 2,
                  },
                  taskSummary: { created: 1, closed: 1 },
                  meetingSummary: { total: 1 },
                  conversionEventVisits: 1,
                },
                sla: {
                  sla1: { status: 'onTime', hours: 1 },
                  sla2: { status: 'onTime', hours: 2 },
                  sla3: { status: 'onTime', hours: 3 },
                },
                stageTimeline: [
                  {
                    stageId: 'C10:WON',
                    stageName: 'Передано в клуб',
                    enteredAt: '2026-04-04T10:00:00.000Z',
                    leftAt: '2026-04-05T10:00:00.000Z',
                    durationHours: 24,
                    callSummary: {
                      total: 2,
                      incoming: 0,
                      outgoing: 2,
                      successful: 2,
                      failed: 0,
                      overThirtySeconds: 2,
                      connectedOverThirtySeconds: 2,
                    },
                    taskSummary: { created: 1, closed: 1 },
                    meetingEvents: [],
                    events: [
                      {
                        id: 'call:MANAGER_ACTION_CALL_1',
                        kind: 'call',
                        occurredAt: '2026-04-04T11:00:00.000Z',
                        stageId: 'C10:WON',
                        stageName: 'Передано в клуб',
                        title: 'Звонок',
                        detail: 'исходящий · 120с · >30с · успешный',
                        badgeLabel: null,
                        linkConfidence: 'high',
                      },
                      {
                        id: 'conversion-event-visit:MANAGER_ACTION_VISIT_1',
                        kind: 'conversion_event_visit',
                        occurredAt: '2026-04-04T12:00:00.000Z',
                        stageId: 'C10:WON',
                        stageName: 'Передано в клуб',
                        title: 'Мероприятие: Гостевая встреча ClubFirst',
                        detail: 'пришел',
                        badgeLabel: 'Гостевая встреча ClubFirst · пришел',
                        linkConfidence: 'high',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: null,
          statusKey: 'lost',
          statusLabel: 'Проиграно',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 1,
          closedTasksPerDeal: 0,
          totalCallsPerDeal: 1,
          successfulCallsOverThirtySecondsPerDeal: 0,
          meetingsPerDeal: 0,
          sla1OnTimeRate: 0,
          sla2OnTimeRate: 0,
          sla3OnTimeRate: 0,
          financialAmount: 50000,
          averageFinancialAmount: 50000,
          dealDetails: [],
        },
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: null,
          statusKey: 'wip',
          statusLabel: 'В работе сейчас',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 0,
          closedTasksPerDeal: 0,
          totalCallsPerDeal: 0,
          successfulCallsOverThirtySecondsPerDeal: 0,
          meetingsPerDeal: 0,
          sla1OnTimeRate: 0,
          sla2OnTimeRate: 0,
          sla3OnTimeRate: 0,
          financialAmount: 70000,
          averageFinancialAmount: 70000,
          dealDetails: [],
        },
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: '2026-04',
          statusKey: 'won',
          statusLabel: 'Выиграно',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 1,
          closedTasksPerDeal: 1,
          totalCallsPerDeal: 2,
          successfulCallsOverThirtySecondsPerDeal: 2,
          meetingsPerDeal: 1,
          sla1OnTimeRate: 1,
          sla2OnTimeRate: 1,
          sla3OnTimeRate: 1,
          financialAmount: 120000,
          averageFinancialAmount: 120000,
          dealDetails: [],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            warnings: [],
            rows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                createdTasks: 4,
                closedTasks: 3,
                totalCalls: 8,
                successfulCallsOverThirtySeconds: 5,
                meetingsCount: 1,
                sla1OnTimeCount: 1,
                sla1LateCount: 1,
                sla1NoTouchCount: 0,
                sla1MedianHours: 2,
                sla2OnTimeCount: 1,
                sla2LateCount: 1,
                sla2NoTouchCount: 0,
                sla2MedianHours: 4,
                sla3OnTimeCount: 1,
                sla3LateCount: 0,
                sla3NoTouchCount: 0,
                sla3MedianHours: 4,
                newDealsCount: 2,
                wonDealsCount: 1,
                winRate: 0.5,
                salesAmount: 90000,
                averageSaleAmount: 90000,
                averageCycleDays: 8,
              },
            ],
            cohortMonths: [],
            cohortStatusRows: [],
          },
        },
      ],
    })

    render(<ProtoApp />)
    await openSalesScene()

    await screen.findByRole('heading', { name: /продажи по менеджерам/i })
    expect(screen.queryByRole('heading', { name: /действия → результат/i })).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /когортный отчет/i }))

    const actionHeading = await screen.findByRole('heading', { name: /действия → результат/i })
    const actionSection = actionHeading.closest('section')

    expect(screen.queryByRole('heading', { name: /конверсия по таргет-группам/i })).not.toBeInTheDocument()
    expect(actionSection).not.toBeNull()
    expect(within(actionSection as HTMLElement).getAllByText('Егоров Андрей')).toHaveLength(1)
    expect(within(actionSection as HTMLElement).getByText('Все когорты')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('2026-04')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getAllByText('В работе сейчас').length).toBeGreaterThan(0)
    expect(within(actionSection as HTMLElement).getAllByRole('row')).toHaveLength(4)
    expect(within(actionSection as HTMLElement).getByText('SLA on-time')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).queryByText(/^С1:/)).not.toBeInTheDocument()
    expect(within(actionSection as HTMLElement).queryByText(/Предупреждения расчёта/i)).not.toBeInTheDocument()
    expect(within(actionSection as HTMLElement).queryByText(/без заказчика/i)).not.toBeInTheDocument()

    await userEvent.click(
      within(actionSection as HTMLElement).getByRole('button', {
        name: /раскрыть статус выиграно/i,
      }),
    )
    expect(within(actionSection as HTMLElement).getByText('ID D1')).toBeInTheDocument()

    await userEvent.click(within(actionSection as HTMLElement).getByRole('button', { name: 'Подробнее' }))
    expect(within(actionSection as HTMLElement).getByText('Атрибуты сделки')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('Маржинальная себестоимость')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('Полная себестоимость')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('Полный результат')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('2 Пришёл на мероприятие')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('Передано в клуб')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText(/Встреча 04 апр/i)).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('Гостевая встреча ClubFirst · пришел')).toBeInTheDocument()
    expect(
      within(actionSection as HTMLElement).getByText(/Звонки 2 · 0 вход\. · 2 исход\. · 2 >30с/i),
    ).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText(/Дела 1 \/ 1/i)).toBeInTheDocument()
    expect(
      within(actionSection as HTMLElement).queryByText(/Звонок · исходящий · 120с · >30с · успешный/i),
    ).not.toBeInTheDocument()
    expect(within(actionSection as HTMLElement).queryByText(/Мероприятия недоступны/i)).not.toBeInTheDocument()
  })

  it('keeps the manager filter prebuilt to the attraction team fallback list', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^Менеджер \/ команда$/i }))

    expect(screen.getByText('Егоров Андрей')).toBeInTheDocument()
    expect(screen.getByText('Илья Какулия')).toBeInTheDocument()
    expect(screen.queryByText('Каньков Вячеслав')).not.toBeInTheDocument()
    expect(screen.queryByText('Анна Петрова')).not.toBeInTheDocument()
  })

  it('applies a manager team filter as its member manager ids', async () => {
    const admin: AuthUser = {
      id: 1,
      login: 'admin@example.com',
      firstName: 'Мария',
      lastName: 'Потапова',
      role: 'admin' as const,
      isSuperAdmin: true,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: ['comments:create', 'comments:update', 'comments:archive'],
          paperclipCompanyId: null,
          paperclipProjectId: null,
          paperclipGoalId: null,
          paperclipTriageAgentId: null,
        },
      ],
    }
    vi.mocked(apiClient.getManagerWhitelistSettings).mockResolvedValueOnce({
      options: [
        { id: '13020', name: 'Илья Какулия' },
        { id: '78', name: 'Егоров Андрей' },
        { id: '11234', name: 'Анна Петрова' },
      ],
      settings: [
        {
          moduleKey: 'attraction',
          managerId: '13020',
          managerName: 'Илья Какулия',
          enabled: true,
          sortOrder: 0,
          updatedAt: '2026-04-10T12:00:00.000Z',
          teamId: 'attraction',
          teamName: 'Привлечение',
        },
        {
          moduleKey: 'attraction',
          managerId: '78',
          managerName: 'Егоров Андрей',
          enabled: true,
          sortOrder: 10,
          updatedAt: '2026-04-10T12:00:00.000Z',
          teamId: 'attraction',
          teamName: 'Привлечение',
        },
        {
          moduleKey: 'attraction',
          managerId: '11234',
          managerName: 'Анна Петрова',
          enabled: true,
          sortOrder: 20,
          updatedAt: '2026-04-10T12:00:00.000Z',
          teamId: 'attraction-stroke',
          teamName: 'Привлечение штрих',
        },
      ],
      teams: [
        {
          id: 'attraction',
          name: 'Привлечение',
          managerIds: ['13020', '78'],
          sortOrder: 0,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
        {
          id: 'attraction-stroke',
          name: 'Привлечение штрих',
          managerIds: ['11234'],
          sortOrder: 20,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })

    render(<ProtoApp currentUser={admin} />)

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    vi.mocked(apiClient.getDashboard).mockClear()
    await userEvent.click(await screen.findByRole('button', { name: /^Менеджер \/ команда$/i }))
    await userEvent.click(screen.getByText('Привлечение штрих'))
    await userEvent.click(screen.getByRole('button', { name: /^применить фильтры$/i }))

    await waitFor(() =>
      expect(apiClient.getDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ managerIds: ['11234'] }),
      ),
    )
  })

  it('applies business club and target group filters from one customer picker', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [],
      businessClubCatalog: [
        { key: 'ClubFirst Russia', label: 'ClubFirst Russia' },
        { key: 'ClubFirst GlobAll', label: 'ClubFirst GlobAll' },
      ],
      targetGroupCatalog: [
        { key: 'ClubFirst Future', label: 'ClubFirst Future' },
        { key: 'ClubFirst Ladies', label: 'ClubFirst Ladies' },
      ],
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
    } as MetaResponse)

    render(<ProtoApp />)

    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())
    vi.mocked(apiClient.getDashboard).mockClear()

    await userEvent.click(await screen.findByRole('button', { name: /^Заказчик$/i }))
    expect(screen.getAllByText('Бизнес-клуб заказчика').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Таргет-группа').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByText('ClubFirst Russia'))
    await userEvent.click(screen.getByText('ClubFirst Future'))
    expect(screen.getByRole('button', { name: /^Заказчик$/i })).toHaveTextContent(
      '1 клуб · 1 таргет',
    )

    await userEvent.click(screen.getByRole('button', { name: /^применить фильтры$/i }))

    await waitFor(() =>
      expect(apiClient.getDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          businessClubKeys: ['ClubFirst Russia'],
          targetGroupKeys: ['ClubFirst Future'],
        }),
      ),
    )
    expect(screen.getByText(/Заказчик: 1 клуб · 1 таргет/i)).toBeInTheDocument()
  })

  it('defaults the main range and added compare ranges to sequential previous calendar weeks', () => {
    const filters = createDefaultFilters(new Date('2026-04-19T12:00:00+03:00'))
    const firstCompare = createCompareRange(filters)
    const secondCompare = createCompareRange({
      ...filters,
      compareRanges: [firstCompare],
    })

    expect(filters.rangeStart).toBe('2026-04-06')
    expect(filters.rangeEnd).toBe('2026-04-12')
    expect(firstCompare).toEqual(
      expect.objectContaining({ start: '2026-03-30', end: '2026-04-05' }),
    )
    expect(secondCompare).toEqual(
      expect.objectContaining({ start: '2026-03-23', end: '2026-03-29' }),
    )
  })

  it('creates and persists a comment pin at the clicked coordinate', async () => {
    render(<ProtoApp />)

    await userEvent.click(screen.getByRole('button', { name: /^режим комментариев$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    const filterHeading = screen.getByText(/фильтры периода и среза/i)
    const filterPanel = filterHeading.closest('.panel') as HTMLElement
    vi.spyOn(filterPanel, 'getBoundingClientRect').mockReturnValue({
      x: 50,
      y: 100,
      width: 500,
      height: 400,
      top: 100,
      left: 50,
      right: 550,
      bottom: 500,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(filterHeading, { clientX: 100, clientY: 200 })

    const textarea = screen.getByPlaceholderText(/комментарий к точке интерфейса/i)
    await userEvent.type(textarea, 'Проверка точки')
    await userEvent.click(screen.getByRole('button', { name: /^сохранить$/i }))

    const pin = await screen.findByRole('button', { name: /^Комментарий 1$/ })
    expect(pin).toHaveStyle({ left: '10%', top: '20%' })
    const saveCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')
    const savedBody = JSON.parse(String(saveCall?.[1]?.body)) as {
      comments: Array<{ anchor?: Record<string, unknown> }>
    }
    expect(savedBody.comments[0]?.anchor).toEqual(
      expect.objectContaining({
        blockLabel: expect.stringMatching(/фильтры периода и среза/i),
        relativeX: 0.1,
        relativeY: 0.25,
      }),
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/комментарий к точке интерфейса/i)).toBeDisabled()
    })
  })

  it('uses the lost deals card label when a comment is placed inside its reasons table', async () => {
    vi.mocked(apiClient.getAcquisitionOutcomesReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalNewDeals: 0,
      totalLostDeals: 2,
      newDealsByManager: [],
      lostDealsByManager: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalLostDeals: 2,
          stages: [{ stageId: 'C10:LOSE', stageName: 'Корзина', count: 2 }],
        },
      ],
      lostStages: [{ stageId: 'C10:LOSE', stageName: 'Корзина', count: 2 }],
      businessClubByManager: [],
      topLossReasons: [
        {
          stageId: 'C10:LOSE',
          stageName: 'Корзина',
          managerId: '78',
          managerName: 'Егоров Андрей',
          reasonKey: 'Клиенту не интересен формат',
          reasonLabel: 'Клиенту не интересен формат',
          count: 2,
        },
      ],
      lostDealDetails: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    await userEvent.click(screen.getByRole('button', { name: /^режим комментариев$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    const reasonLabel = await screen.findByText('Клиенту не интересен формат')
    const lostDealsBlock = screen.getByText('Проигранные сделки').closest('article') as HTMLElement
    expect(lostDealsBlock).not.toBeNull()
    vi.spyOn(lostDealsBlock, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 120,
      width: 600,
      height: 500,
      top: 120,
      left: 20,
      right: 620,
      bottom: 620,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(reasonLabel, { clientX: 320, clientY: 420 })

    const textarea = screen.getByPlaceholderText(/комментарий к точке интерфейса/i)
    const draftPanel = screen.getByText('Новая заметка').closest('.panel') as HTMLElement
    await userEvent.type(textarea, 'Проверить причины потерь')
    await userEvent.click(within(draftPanel).getByRole('button', { name: /^сохранить$/i }))

    const saveCall = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')
    const savedBody = saveCall
      ? (JSON.parse(String(saveCall[1]?.body)) as {
          comments: Array<{ anchor?: Record<string, unknown> }>
        })
      : null
    const createCommentCall = vi.mocked(apiClient.createComment).mock.calls.at(-1)
    const savedComment = createCommentCall?.[0] as
      | { anchor?: Record<string, unknown> }
      | undefined
    const savedAnchor = savedComment?.anchor ?? savedBody?.comments.at(-1)?.anchor
    expect(savedAnchor).toEqual(
      expect.objectContaining({
        blockLabel: 'Проигранные сделки',
        elementLabel: 'Клиенту не интересен формат',
      }),
    )
  })

  it('blocks repeated comment saves while the first save is still pending', async () => {
    const saveGate: { resolve?: () => void } = {}
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init || init.method === 'GET') {
        return createResponse({ comments: [], updatedAt: null })
      }

      const payload = JSON.parse(String(init.body)) as { comments: unknown[] }
      await new Promise<void>((resolve) => {
        saveGate.resolve = resolve
      })
      return createResponse({
        comments: payload.comments,
        updatedAt: '2026-04-10T12:00:00.000Z',
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ProtoApp />)

    await userEvent.click(screen.getByRole('button', { name: /^режим комментариев$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(screen.getByText(/фильтры периода и среза/i), {
      clientX: 100,
      clientY: 200,
    })

    await userEvent.type(
      screen.getByPlaceholderText(/комментарий к точке интерфейса/i),
      'Проверка без дублей',
    )

    const saveButton = screen.getByRole('button', { name: /^сохранить$/i })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /сохраняем/i })).toBeDisabled()
    })
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)

    expect(saveGate.resolve).toBeDefined()
    saveGate.resolve?.()
    await screen.findByRole('button', { name: /^Комментарий 1$/ })
  })

  it('allows comment pins on the filter panel chrome without blocking form controls', async () => {
    render(<ProtoApp />)

    await userEvent.click(screen.getByRole('button', { name: /^режим комментариев$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(screen.getByText(/фильтры периода и среза/i), {
      clientX: 180,
      clientY: 90,
    })

    expect(screen.getByPlaceholderText(/комментарий к точке интерфейса/i)).not.toBeDisabled()
  })

  it('keeps disabled deadline-reschedule UI hidden in the activity report', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [
        'Deadline reschedule counts are disabled until a trustworthy Bitrix history source is available.',
      ],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    await screen.findByRole('heading', { name: /сводка по менеджерам/i })
    await waitFor(() => {
      expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalled()
    })

    expect(screen.queryByRole('heading', { name: /матрица активности/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('Создано задач').length).toBeGreaterThan(0)
    expect(screen.queryByText('Перенесён дедлайн')).not.toBeInTheDocument()
    expect(screen.queryByText(/Deadline reschedule counts are disabled/i)).not.toBeInTheDocument()
  })

  it('shows a sales error state instead of an empty sales report when live loading fails', async () => {
    vi.mocked(apiClient.getDashboard).mockRejectedValueOnce(new Error('Тестовый сбой live-данных'))

    render(<ProtoApp />)
    await openSalesScene()

    expect(
      await screen.findAllByText('Тестовый сбой live-данных'),
    ).toHaveLength(2)
    expect(
      screen.queryByText('В выбранном периоде нет выигранных сделок.'),
    ).not.toBeInTheDocument()
  })

  it('uses the refresh button to synchronize Bitrix without applying draft filters', async () => {
    render(<ProtoApp />)
    await openSalesScene()

    expect(await screen.findByText('В выбранном периоде нет выигранных сделок.')).toBeInTheDocument()
    vi.mocked(apiClient.getDashboard).mockClear()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0]!, { target: { value: '2026-01-01' } })

    await userEvent.click(screen.getByRole('button', { name: /^обновить данные$/i }))

    await waitFor(() => expect(apiClient.triggerSync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())

    const [query] = vi.mocked(apiClient.getDashboard).mock.calls.at(-1)!
    expect(query.preset).toBe('custom')
    expect('from' in query ? query.from : '').not.toContain('2026-01-01')
  })

  it('keeps the recent attraction sync journal collapsed until explicitly opened', async () => {
    vi.mocked(apiClient.getSyncRuns).mockResolvedValueOnce({
      runs: [
        {
          id: 42,
          startedAt: '2026-06-03T06:00:00.000Z',
          finishedAt: '2026-06-03T06:01:00.000Z',
          durationMs: 60000,
          status: 'failed',
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
          diagnostics: ['SYNC_FAILED', 'error=API_FAIL'],
        },
      ],
    })

    render(<ProtoApp />)

    const journalToggle = await screen.findByRole('button', { name: /журнал синхронизаций/i })
    expect(journalToggle).toHaveAttribute('aria-expanded', 'false')
    expect(apiClient.getSyncRuns).not.toHaveBeenCalled()
    expect(screen.queryByText(/автосинхронизация: привлечение раз в час/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Ошибка')).not.toBeInTheDocument()
    expect(screen.queryByText(/SYNC_FAILED · error=API_FAIL/)).not.toBeInTheDocument()

    await userEvent.click(journalToggle)

    await waitFor(() => expect(apiClient.getSyncRuns).toHaveBeenCalledTimes(1))
    expect(journalToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/автосинхронизация: привлечение раз в час/i)).toBeInTheDocument()
    expect(await screen.findByText('Ошибка')).toBeInTheDocument()
    expect(screen.getByText(/SYNC_FAILED · error=API_FAIL/)).toBeInTheDocument()
  })

  it('keeps the attraction dashboard usable when the sync journal fails to load', async () => {
    vi.mocked(apiClient.getSyncRuns).mockRejectedValueOnce(new Error('Журнал недоступен'))

    render(<ProtoApp />)
    await openSalesScene()

    expect(await screen.findByText('В выбранном периоде нет выигранных сделок.')).toBeInTheDocument()
    const journalToggle = screen.getByRole('button', { name: /журнал синхронизаций/i })
    expect(journalToggle).toHaveAttribute('aria-expanded', 'false')
    expect(apiClient.getSyncRuns).not.toHaveBeenCalled()
    expect(screen.queryByText('Пока нет записей журнала')).not.toBeInTheDocument()
    expect(screen.queryByText('Журнал недоступен')).not.toBeInTheDocument()

    await userEvent.click(journalToggle)

    await waitFor(() => expect(apiClient.getSyncRuns).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Пока нет записей журнала')).toBeInTheDocument()
  })

  it('shows filter apply loading state and applies the visible date field values', async () => {
    render(<ProtoApp />)

    const applyButton = await screen.findByRole('button', { name: /^применить фильтры$/i })
    await waitFor(() => expect(applyButton).not.toBeDisabled())
    vi.mocked(apiClient.getDashboard).mockClear()

    let resolveDashboard: (value: DashboardData) => void = () => {}
    const pendingDashboard = new Promise<DashboardData>((resolve) => {
      resolveDashboard = resolve
    })
    vi.mocked(apiClient.getDashboard).mockImplementationOnce(async () => pendingDashboard)

    const startInput = screen.getByLabelText(
      'Дата начала основного диапазона',
    ) as HTMLInputElement
    const endInput = screen.getByLabelText(
      'Дата конца основного диапазона',
    ) as HTMLInputElement
    startInput.value = '2026-05-25'
    endInput.value = '2026-05-31'

    await userEvent.click(applyButton)

    await waitFor(() => {
      expect(apiClient.getDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          from: '2026-05-25T00:00:00.000+03:00',
          to: '2026-05-31T23:59:59.999+03:00',
        }),
      )
    })
    expect(screen.getByRole('button', { name: /^загружаю$/i })).toBeDisabled()
    expect(
      screen.getByText('Загружаю данные за 25.05.2026..31.05.2026'),
    ).toBeInTheDocument()

    resolveDashboard(createSalesDashboard(3))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^применить фильтры$/i })).not.toBeDisabled()
    })
  })

  it('shows filter apply loading state while an active lazy scene waits for sales refresh', async () => {
    render(<ProtoApp />)

    const applyButton = await screen.findByRole('button', { name: /^применить фильтры$/i })
    await waitFor(() => expect(applyButton).not.toBeDisabled())

    await userEvent.click(screen.getByRole('button', { name: /^отчет активности$/i }))
    await waitFor(() => expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: /^сводка по менеджерам$/i })).toBeInTheDocument()

    vi.mocked(apiClient.getDashboard).mockClear()
    const pendingDashboard = createDeferred<DashboardData>()
    vi.mocked(apiClient.getDashboard).mockImplementationOnce(async () => pendingDashboard.promise)

    const startInput = screen.getByLabelText(
      'Дата начала основного диапазона',
    ) as HTMLInputElement
    const endInput = screen.getByLabelText(
      'Дата конца основного диапазона',
    ) as HTMLInputElement
    startInput.value = '2026-05-25'
    endInput.value = '2026-05-31'

    await userEvent.click(applyButton)

    await waitFor(() => {
      expect(apiClient.getDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'custom',
          from: '2026-05-25T00:00:00.000+03:00',
          to: '2026-05-31T23:59:59.999+03:00',
        }),
      )
    })
    expect(screen.getByRole('button', { name: /^загружаю$/i })).toBeDisabled()
    expect(
      screen.getByText('Загружаю данные за 25.05.2026..31.05.2026'),
    ).toBeInTheDocument()

    pendingDashboard.resolve(createSalesDashboard(3))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^применить фильтры$/i })).not.toBeDisabled()
    })
  })

  it('uses the active leadgen module when refreshing data', async () => {
    const owner: AuthUser = {
      id: 1,
      login: 'owner@example.com',
      firstName: 'Владислав',
      lastName: 'Богдан',
      role: 'admin' as const,
      isSuperAdmin: true,
      modules: [
        {
          id: 'attraction',
          slug: 'attraction',
          name: 'Привлечение',
          role: 'leader' as const,
          permissions: ['comments:create', 'comments:update', 'comments:archive'],
        },
        {
          id: 'leadgen',
          slug: 'leadgen',
          name: 'Лидогенерация',
          role: 'leader' as const,
          permissions: ['comments:create', 'comments:update', 'comments:archive'],
          bitrixCategoryId: '28',
        },
      ],
    }

    render(<ProtoApp currentUser={owner} />)

    await userEvent.click(await screen.findByRole('button', { name: /^обновить данные$/i }))
    await waitFor(() => expect(apiClient.triggerSync).toHaveBeenCalledWith(
      'attraction',
      expect.any(Function),
    ))
    await waitFor(() => expect(screen.getByText(/обновлено 12/i)).toBeInTheDocument())

    await userEvent.click(await screen.findByRole('button', { name: /^лидогенерация$/i }))
    expect(await screen.findByRole('heading', { name: /^лидогенерация$/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Готов к запуску')).toBeInTheDocument())
    expect(screen.queryByText(/обновлено 12/i)).not.toBeInTheDocument()

    vi.mocked(apiClient.triggerSync).mockClear()
    vi.mocked(apiClient.getDashboard).mockClear()
    vi.mocked(apiClient.getLeadgenFunnelReport).mockClear()

    await userEvent.click(screen.getByRole('button', { name: /^обновить данные$/i }))

    await waitFor(() => {
      expect(apiClient.triggerSync).toHaveBeenCalledWith('leadgen', expect.any(Function))
    })
    await waitFor(() => {
      expect(apiClient.getLeadgenFunnelReport).toHaveBeenCalledWith(
        'leadgen',
        expect.objectContaining({ preset: 'custom' }),
      )
    })
    expect(apiClient.getDashboard).not.toHaveBeenCalled()
  })

  it('loads cached operational reports while warning that sync health is stale', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
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
        status: 'blocked',
        blocking: true,
        checkedAt: '2026-04-10T12:00:00.000Z',
        lastSuccessfulSync: null,
        issues: [
          {
            code: 'MISSING_COVERAGE',
            severity: 'blocking',
            message: 'Локальный снимок данных не подтвержден последней синхронизацией.',
          },
        ],
        warnings: ['Локальный снимок данных не подтвержден последней синхронизацией.'],
      },
    })
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 940_000,
        averageSaleAmount: 940_000,
        attractionRevenueAmount: 940_000,
        averageAttractionRevenueAmount: 940_000,
        membershipAmount: 940_000,
        averageMembershipAmount: 940_000,
        pricingWarnings: [],
        newDealsCount: 66,
        conversionRate: 0,
        meetingsCount: 1,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Потапова Мария',
          totalWonDeals: 1,
          totalSalesAmount: 940_000,
          totalAttractionRevenueAmount: 940_000,
          averageAttractionRevenueAmount: 940_000,
          totalMembershipAmount: 940_000,
          averageMembershipAmount: 940_000,
          deals: [],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)
    await openSalesScene()

    expect(
      (
        await screen.findAllByText(
          'Локальный снимок данных не подтвержден последней синхронизацией.',
        )
      ).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Потапова Мария')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).getAllByText('1').length).toBeGreaterThan(0)
    expect(apiClient.getDashboard).toHaveBeenCalled()
    expect(apiClient.getCallsWorkloadReport).not.toHaveBeenCalled()
    expect(screen.queryByText(/live-данные недоступны/i)).not.toBeInTheDocument()
  })

  it('keeps scene filter signatures bound to applied filters until the user applies draft changes', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /когортный отчет/i }))

    const cohortSection = (await screen.findByRole('heading', { name: /когортная матрица/i }))
      .closest('section')
    expect(cohortSection).not.toBeNull()
    expect(
      within(cohortSection as HTMLElement).getByText('Срез: все менеджеры / все источники'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Менеджер \/ команда$/i }))
    await userEvent.click(screen.getAllByText('Егоров Андрей').at(-1)!)

    expect(
      within(cohortSection as HTMLElement).getByText('Срез: все менеджеры / все источники'),
    ).toBeInTheDocument()
    expect(screen.getByText(/менеджеры: егоров андрей/i)).toBeInTheDocument()
  })

  it('does not render prototype fallback activity data after an operational live error', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockRejectedValueOnce(
      new Error('Отчёт активности недоступен'),
    )

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    expect(await screen.findByText('Отчёт активности недоступен')).toBeInTheDocument()
    expect(screen.queryByText('Анна Петрова')).not.toBeInTheDocument()
    expect(screen.queryByText('486')).not.toBeInTheDocument()
  })

  it('renders attraction deal outcome blocks below the activity manager summary', async () => {
    vi.mocked(apiClient.getAcquisitionOutcomesReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalNewDeals: 3,
      totalLostDeals: 4,
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
              qualities: [
                { qualityKey: 'Готов ко встрече', qualityLabel: 'Готов ко встрече', count: 2 },
              ],
            },
          ],
        },
      ],
      lostDealsByManager: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalLostDeals: 4,
          stages: [
            { stageId: 'C10:LOSE', stageName: 'Корзина', count: 2 },
            { stageId: 'C10:RETURN', stageName: 'Возврат в Лидген(неквал)', count: 2 },
          ],
        },
      ],
      lostStages: [
        { stageId: 'C10:LOSE', stageName: 'Корзина', count: 2 },
        { stageId: 'C10:RETURN', stageName: 'Возврат в Лидген(неквал)', count: 2 },
      ],
      businessClubByManager: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalDeals: 4,
          businessClubs: [
            { businessClubKey: 'ClubOne', businessClubLabel: 'ClubOne', count: 3 },
            { businessClubKey: 'ClubTwo', businessClubLabel: 'ClubTwo', count: 1 },
          ],
          targetGroups: [
            { targetGroupKey: 'ClubFirst', targetGroupLabel: 'ClubFirst', count: 3 },
            { targetGroupKey: 'ClubFuture', targetGroupLabel: 'ClubFuture', count: 1 },
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
          count: 2,
        },
        {
          stageId: 'C10:RETURN',
          stageName: 'Возврат в Лидген(неквал)',
          managerId: '78',
          managerName: 'Егоров Андрей',
          reasonKey: 'Не соответствует критериям',
          reasonLabel: 'Не соответствует критериям',
          count: 2,
        },
      ],
      lostDealDetails: [
        {
          dealId: 'D-4',
          managerId: '78',
          managerName: 'Егоров Андрей',
          sourceKey: 'WEB',
          sourceLabel: 'Сайт',
          businessClubValue: 'ClubTwo',
          stageId: 'C10:RETURN',
          stageName: 'Возврат в Лидген(неквал)',
          reasonKey: 'Не соответствует критериям',
          reasonLabel: 'Не соответствует критериям',
          reasonDetail: 'Нет совпадения по профилю',
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    const outcomesSection = await screen.findByRole('heading', { name: /сделки и потери/i })
    expect(outcomesSection).toBeInTheDocument()
    const newDealsBlock = screen.getByText('Новые сделки').closest('article')
    const lostDealsBlock = screen.getByText('Проигранные сделки').closest('article')

    expect(newDealsBlock).not.toBeNull()
    expect(lostDealsBlock).not.toBeNull()
    expect(within(newDealsBlock as HTMLElement).getByText('Готов ко встрече')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getAllByText('Корзина').length).toBeGreaterThan(0)
    expect(within(lostDealsBlock as HTMLElement).getAllByText('Возврат в Лидген(неквал)').length).toBeGreaterThan(0)
    expect(within(lostDealsBlock as HTMLElement).getByText('Клиенту не интересен формат')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByText('Не соответствует критериям')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByText('Причины по стадиям')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByRole('columnheader', { name: 'Стадия' })).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByRole('columnheader', { name: 'Причины' })).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getAllByRole('columnheader', { name: 'Потери' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /drill-down потерь/i })).toBeInTheDocument()
    const businessClubHeading = screen.getByRole('heading', { name: /нагрузка по заказчикам/i })
    const businessClubSection = businessClubHeading.closest('section')

    expect(businessClubSection).not.toBeNull()
    expect(within(businessClubSection as HTMLElement).getByRole('columnheader', { name: 'Бизнес-клуб заказчика' })).toBeInTheDocument()
    expect(within(businessClubSection as HTMLElement).getByRole('columnheader', { name: 'Таргет-группа' })).toBeInTheDocument()
    expect(within(businessClubSection as HTMLElement).getAllByText('ClubTwo').length).toBeGreaterThan(0)
    expect(within(businessClubSection as HTMLElement).getAllByText('ClubFuture').length).toBeGreaterThan(0)
  })

  it('renders meetings and SLA blocks in the activity scene', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 2,
      totalCreatedCount: 4,
      totalRescheduledCount: 0,
      totalClosedCount: 3,
      totalMeetingCount: 3,
      warnings: [],
      conversionEventRows: [
        {
          eventKey: 'club-2026-04-29',
          eventName: 'Знакомство с клубом 29.04.',
          eventDate: '2026-04-29T00:00:00.000Z',
          invitedCount: 5,
          attendedCount: 2,
          refusedCount: 1,
          waitingCount: 2,
          stageBreakdown: [
            { stageId: 'C10:UC_61CBCU', stageName: 'Активация', invitedCount: 3 },
            { stageId: 'C10:UC_9E0XYG', stageName: 'Встреча-знакомство', invitedCount: 2 },
          ],
        },
      ],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 64,
          createdCount: 4,
          rescheduledCount: 0,
          closedCount: 3,
          meetingCount: 3,
          averageCreatedPerDeal: 2,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.5,
          averageMeetingsPerDeal: 1,
          meetingTypeBreakdown: [
            { meetingTypeKey: 'Очная', meetingTypeLabel: 'Очная', count: 1 },
            { meetingTypeKey: 'Zoom', meetingTypeLabel: 'Zoom', count: 1 },
            { meetingTypeKey: 'Офлайн', meetingTypeLabel: 'Офлайн', count: 1 },
          ],
          businessClubBreakdown: [
            { businessClubKey: 'ClubOne', businessClubLabel: 'ClubOne', dealCount: 2 },
          ],
          meetingBusinessClubBreakdown: [
            {
              businessClubKey: 'ClubOne',
              businessClubLabel: 'ClubOne',
              meetingSlotIndex: 1,
              meetingSlotLabel: 'Встреча',
              meetingTypeKey: 'Очная',
              meetingTypeLabel: 'Очная',
              count: 1,
            },
            {
              businessClubKey: 'ClubOne',
              businessClubLabel: 'ClubOne',
              meetingSlotIndex: 2,
              meetingSlotLabel: 'Встреча 2',
              meetingTypeKey: 'Zoom',
              meetingTypeLabel: 'Zoom',
              count: 1,
            },
            {
              businessClubKey: 'ClubOne',
              businessClubLabel: 'ClubOne',
              meetingSlotIndex: 3,
              meetingSlotLabel: 'Встреча 3',
              meetingTypeKey: 'Офлайн',
              meetingTypeLabel: 'Офлайн',
              count: 1,
            },
          ],
          slaMetrics: [
            {
              slaKey: 'sla1',
              label: 'Время в работу',
              onTimeCount: 8,
              lateCount: 0,
              noTouchCount: 0,
              medianHours: 1.5,
            },
          ],
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    })
    vi.mocked(apiClient.getConversionEventsReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalInvitedCount: 5,
      totalConfirmedCount: 0,
      totalAttendedCount: 2,
      totalRefusedCount: 1,
      totalMissedCount: 3,
      attendanceRate: 40,
      nextStepEligibleCount: 2,
      nextStepCount: 1,
      nextStepRate: 50,
      warnings: [],
      rows: [
        {
          eventKey: 'club-2026-04-29',
          eventName: 'Знакомство с клубом 29.04.',
          eventDate: '2026-04-29T00:00:00.000Z',
          invitedCount: 5,
          confirmedCount: 0,
          attendedCount: 2,
          refusedCount: 1,
          missedCount: 3,
          attendanceRate: 40,
          nextStepEligibleCount: 2,
          nextStepCount: 1,
          nextStepRate: 50,
          unlinkedCount: 0,
          unknownStatusCount: 0,
          managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 5 }],
          sourceBreakdown: [{ key: 'WEB', label: 'Веб', count: 5 }],
          businessClubBreakdown: [{ key: 'ClubOne', label: 'ClubOne', count: 5 }],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const meetingsHeading = await screen.findByRole('heading', { name: /встречи/i })
    const meetingsSection = meetingsHeading.closest('section')

    expect(meetingsSection).not.toBeNull()
    expect(within(meetingsSection as HTMLElement).queryByRole('columnheader', { name: /на сделку/i })).not.toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByRole('columnheader', { name: /клуб \/ тип встречи/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^sla$/i })).toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByText('ClubOne')).toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByText('Встреча · Очная')).toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByText('Встреча 2 · Zoom')).toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByText('Встреча 3 · Офлайн')).toBeInTheDocument()
    const slotOneBadge = within(meetingsSection as HTMLElement)
      .getByText('Встреча · Очная')
      .closest('[data-meeting-slot-index]')
    const slotTwoBadge = within(meetingsSection as HTMLElement)
      .getByText('Встреча 2 · Zoom')
      .closest('[data-meeting-slot-index]')
    const slotThreeBadge = within(meetingsSection as HTMLElement)
      .getByText('Встреча 3 · Офлайн')
      .closest('[data-meeting-slot-index]')
    expect(slotOneBadge).toHaveAttribute('data-meeting-slot-index', '1')
    expect(slotTwoBadge).toHaveAttribute('data-meeting-slot-index', '2')
    expect(slotThreeBadge).toHaveAttribute('data-meeting-slot-index', '3')
    expect(slotOneBadge).toHaveClass('border-amber-100')
    expect(slotTwoBadge).toHaveClass('border-violet-100')
    expect(slotThreeBadge).toHaveClass('border-rose-100')
    expect(slotOneBadge).toHaveClass('bg-white')
    expect(slotTwoBadge).toHaveClass('bg-white')
    expect(slotThreeBadge).toHaveClass('bg-white')
    const conversionHeading = screen.getByRole('heading', { name: /конверсионные мероприятия/i })
    const conversionSection = conversionHeading.closest('section')

    expect(conversionSection).not.toBeNull()
    expect(within(conversionSection as HTMLElement).getByText('Знакомство с клубом 29.04.')).toBeInTheDocument()
    expect(within(conversionSection as HTMLElement).getByRole('columnheader', { name: /с каких этапов звали/i })).toBeInTheDocument()
    expect(within(conversionSection as HTMLElement).getByText('3 Активация, 2 Встреча-знакомство')).toBeInTheDocument()
    expect(screen.queryByText('Данные появятся после настройки.')).not.toBeInTheDocument()
    expect(screen.getByText(/8 сделок в SLA/i)).toBeInTheDocument()
    expect(screen.queryByText(/64 сделок в работе/i)).not.toBeInTheDocument()
    expect(screen.getByText(/on-time 8/i)).toBeInTheDocument()
    expect(screen.getByText(/SLA считается только для новых сделок/i)).toBeInTheDocument()
    const zeroLateBadge = screen.getByText(/late 0/i)
    expect(zeroLateBadge).toHaveClass('bg-slate-100')
    expect(zeroLateBadge).toHaveClass('text-slate-700')
  })

  it('renders conversion events table in the activity report without client names', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [
        {
          eventKey: '2026-04-29::Знакомство с клубом 29.04.',
          eventName: 'Знакомство с клубом 29.04.',
          eventDate: '2026-04-29T00:00:00.000Z',
          invitedCount: 10,
          attendedCount: 6,
          refusedCount: 2,
          waitingCount: 2,
          stageBreakdown: [
            { stageId: 'C10:UC_61CBCU', stageName: 'Активация', invitedCount: 5 },
            {
              stageId: 'C10:UC_9E0XYG',
              stageName: 'Встреча-знакомство',
              invitedCount: 1,
            },
            { stageId: 'C10:UC_A249EJ', stageName: 'Демонстрация', invitedCount: 1 },
            { stageId: 'C10:PREPARATION', stageName: 'Звонок-знакомство', invitedCount: 1 },
          ],
        },
      ],
      managerRows: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    const section = await screen.findByRole('heading', {
      name: /конверсионные мероприятия/i,
    })
    expect(section).toBeInTheDocument()
    expect(screen.getByText('Знакомство с клубом 29.04.')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Мероприятие' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Пригласили' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Дошли' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Отказ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Еще ждут' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'С каких этапов звали' })).toBeInTheDocument()
    expect(
      screen.getByText(
        '5 Активация, 1 Встреча-знакомство, 1 Демонстрация, 1 Звонок-знакомство',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Омаров/i)).not.toBeInTheDocument()
  })

  it('shows conversion event sync coverage warning instead of a not-found empty state', async () => {
    vi.mocked(apiClient.getConversionEventsReport).mockResolvedValueOnce({
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
      warnings: [
        'Снимок конверсионных мероприятий не загружен: проверьте доступ вебхука к smart-process «Посещения мероприятий» и запустите обновление данных.',
      ],
      rows: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    expect(
      screen.getAllByText(/снимок конверсионных мероприятий не загружен/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/проверьте доступ вебхука к smart-process/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText(/конверсионные мероприятия не найдены/i),
    ).not.toBeInTheDocument()
  })

  it('renders stable manager leaders in the funnel-flow scene', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
      stageCatalog: [],
      managerCatalog: [
        { id: '78', name: 'Егоров Андрей' },
        { id: '11234', name: 'Ромашова Ольга' },
      ],
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
    })
    vi.mocked(apiClient.getTocFlowReport)
      .mockResolvedValueOnce({
        range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 20,
            movedNextDeals: 12,
            throughputPerDay: 0.5,
            queueEnd: 8,
            queueBufferDays: 16,
            averageStageDurationDays: 4,
          },
        ],
        bottleneck: null,
        comparisons: [],
      })
      .mockResolvedValueOnce({
        range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 8,
            movedNextDeals: 5,
            throughputPerDay: 0,
            queueEnd: 0,
            queueBufferDays: null,
            averageStageDurationDays: 0,
          },
        ],
        bottleneck: null,
        comparisons: [
          {
            compareIndex: 1,
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            snapshot: {
              range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
              businessDays: 21,
              warnings: [],
              estimatedGainPerDay: null,
              rows: [
                {
                  stageId: 'CALL',
                  stageName: 'Звонок-знакомство',
                  stageSemanticId: null,
                  sortOrder: 10,
                  enteredDeals: 9,
                  movedNextDeals: 6,
                  throughputPerDay: 0,
                  queueEnd: 0,
                  queueBufferDays: null,
                  averageStageDurationDays: 0,
                },
              ],
              bottleneck: null,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 7,
            movedNextDeals: 6,
            throughputPerDay: 0,
            queueEnd: 0,
            queueBufferDays: null,
            averageStageDurationDays: 0,
          },
        ],
        bottleneck: null,
        comparisons: [
          {
            compareIndex: 1,
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            snapshot: {
              range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
              businessDays: 21,
              warnings: [],
              estimatedGainPerDay: null,
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
              ],
              bottleneck: null,
            },
          },
        ],
      })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /движение по воронке/i }))
    const stableLeadersHeading = await screen.findByRole('heading', { name: /сильные менеджеры по этапам/i })
    const stableLeadersSection = stableLeadersHeading.closest('section')

    expect(stableLeadersSection).not.toBeNull()
    expect(within(stableLeadersSection as HTMLElement).getAllByText('Ромашова Ольга').length).toBeGreaterThan(0)
    expect(within(stableLeadersSection as HTMLElement).getByText('Устойчив')).toBeInTheDocument()
  })

  it('explains that calls are not linked to deals when calls-per-deal cannot be calculated', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [],
    })
    vi.mocked(apiClient.getCallsWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 0,
      totalCalls: 12,
      totalIncomingCalls: 0,
      totalOutgoingCalls: 12,
      totalOtherOutgoingCalls: 0,
      totalConnectedCalls: 8,
      totalFailedCalls: 4,
      totalCallsOverThirtySeconds: 5,
      totalConnectedCallsOverThirtySeconds: 4,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const callsKpi = (await screen.findByText('Звонков на сделку')).closest('.metric')
    expect(callsKpi).not.toBeNull()
    expect(within(callsKpi as HTMLElement).getByText('—')).toBeInTheDocument()
    expect(within(callsKpi as HTMLElement).getByText('нет привязки')).toBeInTheDocument()
    expect(within(callsKpi as HTMLElement).getByText('есть звонки, но они не привязаны к сделкам')).toBeInTheDocument()
    expect(within(callsKpi as HTMLElement).queryByText('0%')).not.toBeInTheDocument()
  })

  it('puts created and closed tasks first and explains outgoing call composition', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 3,
      totalCreatedCount: 7,
      totalRescheduledCount: 0,
      totalClosedCount: 5,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 3,
          createdCount: 7,
          rescheduledCount: 0,
          closedCount: 5,
          meetingCount: 0,
          averageCreatedPerDeal: 2.3,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.7,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    })
    vi.mocked(apiClient.getCallsWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 3,
      totalCalls: 10,
      totalIncomingCalls: 1,
      totalOutgoingCalls: 9,
      totalOtherOutgoingCalls: 2,
      totalConnectedCalls: 4,
      totalFailedCalls: 3,
      totalCallsOverThirtySeconds: 4,
      totalConnectedCallsOverThirtySeconds: 4,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 3,
          totalCalls: 10,
          incomingCalls: 1,
          outgoingCalls: 9,
          otherOutgoingCalls: 2,
          connectedCalls: 4,
          failedCalls: 3,
          callsOverThirtySeconds: 4,
          connectedCallsOverThirtySeconds: 4,
          averageCallsPerDeal: 3,
          averageDurationSeconds: 60,
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const summarySection = (await screen.findByRole('heading', { name: /сводка по менеджерам/i }))
      .closest('section')
    expect(summarySection).not.toBeNull()

    await within(summarySection!).findByText('Егоров Андрей')
    const headers = within(summarySection!)
      .getAllByRole('columnheader')
      .map((header) =>
        header.textContent
          ?.replace(/\s+/g, ' ')
          .replace(/\s*(сорт|убыв|возр)$/i, '')
          .trim(),
      )

    expect(headers[0]).toBe('Менеджер')
    expect(headers[1]).toBe('Создано задач')
    expect(headers[2]).toBe('Закрыто задач')
    expect(headers[3]).toContain('Исходящие')
    expect(headers[3]).toContain('успешные + прочие + недозвоны')
    expect(headers[4]).toBe('Успешные >30 сек')
    expect(headers[5]).toBe('Прочие исходящие')
    expect(headers[6]).toBe('Недозвоны')
    expect(headers[7]).toBe('Пропущенные')
    expect(headers[8]).toBe('Входящие')
    expect(within(summarySection!).getByText('= 4 + 2 + 3')).toBeInTheDocument()
  })

  it('shows absolute calls inside activity blocks and supports compact sortable compare values', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 8,
      totalCreatedCount: 14,
      totalRescheduledCount: 0,
      totalClosedCount: 10,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 5,
          createdCount: 10,
          rescheduledCount: 0,
          closedCount: 6,
          meetingCount: 0,
          averageCreatedPerDeal: 2,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.2,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 5,
              createdCount: 6,
              rescheduledCount: 0,
              closedCount: 4,
              averageCreatedPerDeal: 1.2,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 0.8,
            },
          ],
        },
        {
          managerId: '11234',
          managerName: 'Ромашова Ольга',
          dealCount: 3,
          createdCount: 4,
          rescheduledCount: 0,
          closedCount: 4,
          meetingCount: 0,
          averageCreatedPerDeal: 1.3,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.3,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
            totalDealCount: 8,
            totalCreatedCount: 8,
            totalRescheduledCount: 0,
            totalClosedCount: 8,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                createdCount: 8,
                rescheduledCount: 0,
                closedCount: 5,
                meetingCount: 0,
                averageCreatedPerDeal: 1.6,
                averageRescheduledPerDeal: 0,
                averageClosedPerDeal: 1,
                averageMeetingsPerDeal: 0,
                meetingTypeBreakdown: [],
                businessClubBreakdown: [],
                slaMetrics: [],
                stageBreakdown: [],
              },
            ],
          },
        },
        {
          compareIndex: 2,
          range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
            totalDealCount: 8,
            totalCreatedCount: 5,
            totalRescheduledCount: 0,
            totalClosedCount: 5,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                createdCount: 5,
                rescheduledCount: 0,
                closedCount: 4,
                meetingCount: 0,
                averageCreatedPerDeal: 1,
                averageRescheduledPerDeal: 0,
                averageClosedPerDeal: 0.8,
                averageMeetingsPerDeal: 0,
                meetingTypeBreakdown: [],
                businessClubBreakdown: [],
                slaMetrics: [],
                stageBreakdown: [],
              },
            ],
          },
        },
      ],
    })
    vi.mocked(apiClient.getCallsWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 8,
      totalCalls: 20,
      totalIncomingCalls: 2,
      totalOutgoingCalls: 18,
      totalOtherOutgoingCalls: 3,
      totalConnectedCalls: 12,
      totalFailedCalls: 5,
      totalCallsOverThirtySeconds: 10,
      totalConnectedCallsOverThirtySeconds: 10,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 5,
          totalCalls: 14,
          incomingCalls: 1,
          outgoingCalls: 13,
          otherOutgoingCalls: 2,
          connectedCalls: 9,
          failedCalls: 2,
          callsOverThirtySeconds: 9,
          connectedCallsOverThirtySeconds: 9,
          averageCallsPerDeal: 2.8,
          averageDurationSeconds: 70,
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 5,
              totalCalls: 14,
              incomingCalls: 1,
              outgoingCalls: 13,
              otherOutgoingCalls: 2,
              connectedCalls: 9,
              failedCalls: 2,
              callsOverThirtySeconds: 9,
              connectedCallsOverThirtySeconds: 9,
              averageCallsPerDeal: 2.8,
              averageDurationSeconds: 70,
            },
          ],
        },
        {
          managerId: '11234',
          managerName: 'Ромашова Ольга',
          dealCount: 3,
          totalCalls: 6,
          incomingCalls: 1,
          outgoingCalls: 5,
          otherOutgoingCalls: 1,
          connectedCalls: 3,
          failedCalls: 1,
          callsOverThirtySeconds: 3,
          connectedCallsOverThirtySeconds: 3,
          averageCallsPerDeal: 2,
          averageDurationSeconds: 55,
          stageBreakdown: [],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
            totalDealCount: 8,
            totalCalls: 12,
            totalIncomingCalls: 1,
            totalOutgoingCalls: 11,
            totalOtherOutgoingCalls: 1,
            totalConnectedCalls: 8,
            totalFailedCalls: 2,
            totalCallsOverThirtySeconds: 8,
            totalConnectedCallsOverThirtySeconds: 8,
            warnings: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                totalCalls: 10,
                incomingCalls: 1,
                outgoingCalls: 9,
                otherOutgoingCalls: 1,
                connectedCalls: 7,
                failedCalls: 1,
                callsOverThirtySeconds: 7,
                connectedCallsOverThirtySeconds: 7,
                averageCallsPerDeal: 2,
                averageDurationSeconds: 60,
                stageBreakdown: [],
              },
            ],
          },
        },
        {
          compareIndex: 2,
          range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
            totalDealCount: 8,
            totalCalls: 8,
            totalIncomingCalls: 1,
            totalOutgoingCalls: 7,
            totalOtherOutgoingCalls: 1,
            totalConnectedCalls: 5,
            totalFailedCalls: 1,
            totalCallsOverThirtySeconds: 5,
            totalConnectedCallsOverThirtySeconds: 5,
            warnings: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                totalCalls: 8,
                incomingCalls: 1,
                outgoingCalls: 7,
                otherOutgoingCalls: 1,
                connectedCalls: 5,
                failedCalls: 1,
                callsOverThirtySeconds: 5,
                connectedCallsOverThirtySeconds: 5,
                averageCallsPerDeal: 1.6,
                averageDurationSeconds: 60,
                stageBreakdown: [],
              },
            ],
          },
        },
      ],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const summarySection = (await screen.findByRole('heading', { name: /сводка по менеджерам/i }))
      .closest('section')
    expect(summarySection).not.toBeNull()

    expect(screen.queryByRole('heading', { name: /матрица активности/i })).not.toBeInTheDocument()
    expect(within(summarySection!).getByText('С1 9 / +44%')).toBeInTheDocument()
    expect(within(summarySection!).getByText('С2 7 / +86%')).toBeInTheDocument()
    expect(within(summarySection!).queryByText(/^сорт$/i)).not.toBeInTheDocument()
    expect(within(summarySection!).queryByText(/^убыв$/i)).not.toBeInTheDocument()
    expect(within(summarySection!).queryByText(/^возр$/i)).not.toBeInTheDocument()

    const rowsInitialDescending = within(summarySection!).getAllByRole('row')
    expect(within(rowsInitialDescending[1]!).getByText('Егоров Андрей')).toBeInTheDocument()
    expect(
      within(summarySection!).getByRole('button', { name: /^исходящие/i }).querySelector('svg'),
    ).not.toBeNull()

    await userEvent.click(within(summarySection!).getByRole('button', { name: /^исходящие/i }))
    const rowsAscending = within(summarySection!).getAllByRole('row')
    expect(within(rowsAscending[1]!).getByText('Ромашова Ольга')).toBeInTheDocument()

    await userEvent.click(within(summarySection!).getByRole('button', { name: /^исходящие/i }))
    const rowsDescending = within(summarySection!).getAllByRole('row')
    expect(within(rowsDescending[1]!).getByText('Егоров Андрей')).toBeInTheDocument()
  })
})
