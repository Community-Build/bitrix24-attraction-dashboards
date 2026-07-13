import { useState } from 'react'

import { ArrowDown01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import type {
  SourceCohortConversionJourney,
  SourceCohortConversionJourneyStep,
  SourceCohortConversionJourneyStepKey,
} from '@/lib/dashboard-types'
import { formatInteger, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'

function formatJourneyPercent(value: number) {
  return `${formatPercent(value)}%`
}

function formatJourneyDays(value: number | null) {
  if (value === null) {
    return '—'
  }

  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)} дн.`
}

function getLargestDropoff(journey: SourceCohortConversionJourney) {
  return journey.coreSteps.reduce<{
    step: SourceCohortConversionJourneyStep
    previous: SourceCohortConversionJourneyStep
  } | null>((largest, step, index, steps) => {
    const previous = steps[index - 1]
    if (!previous || step.dropoffDeals <= 0) {
      return largest
    }

    if (!largest || step.dropoffDeals > largest.step.dropoffDeals) {
      return { step, previous }
    }

    return largest
  }, null)
}

function getDropoffRecommendation(stepKey: SourceCohortConversionJourneyStepKey) {
  switch (stepKey) {
    case 'first_call':
      return 'Проверить скорость первого контакта и сделки без исходящего звонка.'
    case 'confirmed_conversation':
      return 'Проверить качество дозвона и долю разговоров после первой попытки.'
    case 'meeting_scheduled':
      return 'Разобрать, почему подтвержденный разговор не заканчивается назначением встречи.'
    case 'meeting_completed':
      return 'Проверить отмены, переносы и встречи без подтвержденного факта проведения.'
    case 'contract':
      return 'Разобрать сделки после встречи, которые не дошли до контракта.'
    case 'transferred':
      return 'Проверить задержки и возвраты после входа сделки в этап контракта.'
    default:
      return 'Разобрать сделки, которые не перешли на следующий подтвержденный шаг.'
  }
}

function JourneyStepButton({
  step,
  previousStep,
  isSelected,
  isLargestDropoff,
  onSelect,
}: {
  step: SourceCohortConversionJourneyStep
  previousStep: SourceCohortConversionJourneyStep | null
  isSelected: boolean
  isLargestDropoff: boolean
  onSelect: () => void
}) {
  const isCreated = previousStep === null
  const isSuccess = step.stepKey === 'contract' || step.stepKey === 'transferred'
  const transitionText = isCreated
    ? 'Точка отсчета'
    : `${formatInteger(step.transitionDeals)} из ${formatInteger(previousStep.deals)}`
  const ariaLabel = isCreated
    ? `${step.label}: ${formatInteger(step.deals)} сделок, ${formatJourneyPercent(step.rateFromCohort)} когорты, точка отсчета`
    : `${step.label}: ${formatInteger(step.deals)} сделок с фактом, ${formatJourneyPercent(step.rateFromCohort)} когорты. Строгий переход: ${transitionText}, ${formatJourneyPercent(step.rateFromPrevious)}`

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      onClick={onSelect}
      className={cn(
        'group relative flex min-h-[9.5rem] w-full min-w-0 select-none flex-col rounded-lg border border-transparent bg-white p-3 text-left',
        'shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_1px_2px_rgba(15,23,42,0.06)] transition-[scale,background-color,box-shadow] duration-150 ease-out',
        'hover:bg-blue-50/40 hover:shadow-[0_0_0_1px_rgba(96,165,250,0.70),0_4px_12px_rgba(15,23,42,0.08)] active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        isSuccess && 'bg-emerald-50/35 shadow-[0_0_0_1px_rgba(110,231,183,0.58),0_1px_2px_rgba(15,23,42,0.05)] hover:bg-emerald-50/70',
        isLargestDropoff && !isSelected && 'bg-amber-50/70 shadow-[0_0_0_1px_rgba(251,191,36,0.72),0_2px_7px_rgba(146,64,14,0.08)]',
        isSelected && 'bg-blue-50 shadow-[0_0_0_2px_rgb(59,130,246),0_6px_16px_rgba(37,99,235,0.14)]',
      )}
    >
      {isLargestDropoff ? (
        <span className="absolute inset-x-3 top-0 h-1 rounded-b bg-amber-400" aria-hidden="true" />
      ) : null}
      <span className="flex min-h-11 min-w-0 items-start">
        <span className="min-w-0 break-words text-balance text-xs font-bold leading-snug text-slate-900">
          {step.label}
        </span>
      </span>

      <span className="mt-2 flex items-baseline gap-1.5">
        <span className="tabular-nums text-2xl font-extrabold leading-none text-slate-950">
          {formatInteger(step.deals)}
        </span>
        <span className="text-xs font-semibold text-slate-500">сделок</span>
      </span>
      <span className="mt-1 tabular-nums text-xs font-semibold text-slate-600">
        {formatJourneyPercent(step.rateFromCohort)} когорты
      </span>

      <span className="mt-auto border-t border-slate-200 pt-2 text-xs text-slate-600">
        <span className="block">{isCreated ? 'Начало когорты' : 'Строгий переход'}</span>
        <span className="mt-0.5 block tabular-nums font-bold text-slate-900">
          {transitionText}
          {isCreated ? null : ` · ${formatJourneyPercent(step.rateFromPrevious)}`}
        </span>
      </span>
    </button>
  )
}

function SelectedStepDetails({
  step,
  previousStep,
}: {
  step: SourceCohortConversionJourneyStep
  previousStep: SourceCohortConversionJourneyStep | null
}) {
  const unchainedDeals = previousStep ? Math.max(step.deals - step.transitionDeals, 0) : 0

  return (
    <div
      className="mt-4 overflow-hidden rounded-lg bg-slate-200 shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_3px_10px_rgba(15,23,42,0.05)]"
      aria-live="polite"
    >
      <div className="grid gap-px lg:grid-cols-[minmax(16rem,1.8fr)_repeat(4,minmax(0,1fr))]">
        <div className="min-w-0 bg-white px-4 py-3.5">
          <p className="text-xs font-bold uppercase text-blue-700">Выбранный шаг</p>
          <p className="mt-1 text-balance text-base font-bold leading-snug text-slate-950">{step.label}</p>
          <p className="mt-1 max-w-[60ch] text-pretty text-sm leading-relaxed text-slate-600">{step.evidence}</p>
        </div>

        <dl className="contents">
          <div className="bg-white px-3 py-3.5">
            <dt className="text-xs font-semibold text-slate-500">Строгий переход</dt>
            <dd className="mt-1 tabular-nums text-base font-bold text-slate-950">
              {previousStep
                ? `${formatInteger(step.transitionDeals)} из ${formatInteger(previousStep.deals)}`
                : `${formatInteger(step.deals)} · 100%`}
            </dd>
            <dd className="mt-0.5 tabular-nums text-xs text-slate-500">
              {previousStep ? formatJourneyPercent(step.rateFromPrevious) : 'точка отсчета'}
            </dd>
          </div>
          <div className="bg-white px-3 py-3.5">
            <dt className="text-xs font-semibold text-slate-500">От предыдущего шага</dt>
            <dd className="mt-1 tabular-nums text-base font-bold text-slate-950">
              {previousStep ? formatJourneyDays(step.medianDaysFromPrevious) : '—'}
            </dd>
            <dd className="mt-0.5 text-xs text-slate-500">медиана</dd>
          </div>
          <div className="bg-white px-3 py-3.5">
            <dt className="text-xs font-semibold text-slate-500">От создания</dt>
            <dd className="mt-1 tabular-nums text-base font-bold text-slate-950">
              {formatJourneyDays(step.medianDaysFromCreate)}
            </dd>
            <dd className="mt-0.5 text-xs text-slate-500">медиана</dd>
          </div>
          <div className="bg-white px-3 py-3.5">
            <dt className="text-xs font-semibold text-slate-500">Не дошли до шага</dt>
            <dd className="mt-1 tabular-nums text-base font-bold text-amber-900">
              {previousStep ? formatInteger(step.dropoffDeals) : '—'}
            </dd>
            <dd className="mt-0.5 text-xs text-slate-500">из фактов предыдущего шага</dd>
          </div>
        </dl>
      </div>

      {unchainedDeals > 0 ? (
        <p className="bg-amber-50 px-4 py-2.5 text-pretty text-xs leading-relaxed text-amber-950">
          У {formatInteger(unchainedDeals)} сделок есть факт шага «{step.label}», но переход после предыдущего шага не подтвержден по времени. Они входят в крупное число на карточке, но не в строгую конверсию.
        </p>
      ) : null}
    </div>
  )
}

export function SourceCohortConversionJourneySection({
  journey,
  selectedMonthLabel,
  totalDeals,
}: {
  journey: SourceCohortConversionJourney
  selectedMonthLabel: string
  totalDeals: number
}) {
  const largestDropoff = getLargestDropoff(journey)
  const defaultStepKey =
    largestDropoff?.step.stepKey ?? journey.coreSteps[1]?.stepKey ?? journey.coreSteps[0]?.stepKey ?? 'created'
  const [selectedStepKey, setSelectedStepKey] =
    useState<SourceCohortConversionJourneyStepKey>(defaultStepKey)
  const selectedStep =
    journey.coreSteps.find((step) => step.stepKey === selectedStepKey) ?? journey.coreSteps[0] ?? null
  const selectedStepIndex = selectedStep
    ? journey.coreSteps.findIndex((step) => step.stepKey === selectedStep.stepKey)
    : -1
  const selectedPreviousStep = selectedStepIndex > 0 ? journey.coreSteps[selectedStepIndex - 1] ?? null : null
  const largestDropoffRate = largestDropoff
    ? (largestDropoff.step.dropoffDeals / Math.max(largestDropoff.previous.deals, 1)) * 100
    : 0
  const completedMeetingDeals = journey.eventDepthRows.reduce((total, row) => total + row.deals, 0)
  const totalContractDeals = journey.eventDepthRows.reduce((total, row) => total + row.contractDeals, 0)
  const totalTransferredDeals = journey.eventDepthRows.reduce((total, row) => total + row.transferredDeals, 0)

  return (
    <section
      className="-mx-5 -mt-5 mb-5 border-y border-slate-200 bg-slate-50/50"
      data-comment-block-id="attraction-source-cohort-conversion-journey"
      data-comment-block-label="Конверсии — основная траектория участника"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="max-w-[70ch]">
          <h4 className="text-base font-bold leading-snug text-slate-950">Конверсия по траектории</h4>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600">
            Когорта {selectedMonthLabel || '—'}: сделки, созданные в «Базе входящей», и подтвержденные факты до передачи в клуб.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge-chip badge-neutral">{formatInteger(totalDeals)} сделок</span>
          <span className="badge-chip badge-neutral">месяц создания</span>
        </div>
      </header>

      {largestDropoff ? (
        <div className="flex items-start justify-between gap-6 border-t border-amber-200 bg-amber-50 px-5 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-amber-800">Управленческий фокус</p>
            <p className="mt-1 text-balance text-sm font-bold text-slate-950">
              {largestDropoff.previous.label} → {largestDropoff.step.label}
            </p>
            <p className="mt-1 tabular-nums text-sm text-slate-700">
              Не дошли {formatInteger(largestDropoff.step.dropoffDeals)} из {formatInteger(largestDropoff.previous.deals)} сделок · {formatJourneyPercent(largestDropoffRate)}.
            </p>
          </div>
          <p className="max-w-[48ch] text-pretty text-sm leading-relaxed text-amber-950">
            {getDropoffRecommendation(largestDropoff.step.stepKey)}
          </p>
        </div>
      ) : null}

      <div className="border-t border-slate-200 bg-white/80 px-5 py-4">
        <div className="mb-3">
          <h4 className="text-sm font-bold leading-snug text-slate-900">Основная траектория</h4>
          <p className="mt-1 max-w-[70ch] text-pretty text-xs leading-relaxed text-slate-500">
            Крупное число — сделки с фактом шага. Нижняя строка — строгий переход от предыдущего шага.
          </p>
        </div>

        <div
          className="overflow-x-auto pb-1"
          role="region"
          aria-label="Основная траектория конверсии"
          tabIndex={0}
        >
          <ol className="grid min-w-[900px] grid-cols-7 gap-2">
            {journey.coreSteps.map((step, index) => {
              const previousStep = journey.coreSteps[index - 1] ?? null
              const isLargestDropoff = largestDropoff?.step.stepKey === step.stepKey

              return (
                <li key={step.stepKey} className="relative min-w-0">
                  <JourneyStepButton
                    step={step}
                    previousStep={previousStep}
                    isSelected={selectedStep?.stepKey === step.stepKey}
                    isLargestDropoff={isLargestDropoff}
                    onSelect={() => setSelectedStepKey(step.stepKey)}
                  />
                  {index < journey.coreSteps.length - 1 ? (
                    <span
                      className="pointer-events-none absolute -right-3 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 translate-x-px items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_0_0_1px_rgba(148,163,184,0.45),0_1px_3px_rgba(15,23,42,0.10)]"
                      aria-hidden="true"
                    >
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>

        {selectedStep ? (
          <SelectedStepDetails step={selectedStep} previousStep={selectedPreviousStep} />
        ) : null}
      </div>

      <div className="grid border-t border-slate-200 lg:grid-cols-2">
        <div className="min-w-0 border-b border-slate-200 px-5 py-4 lg:border-b-0 lg:border-r">
          <h4 className="text-sm font-bold text-slate-900">Глубина событий после встречи</h4>
          <p className="mt-1 max-w-[65ch] text-pretty text-xs leading-relaxed text-slate-500">
            Распределение {formatInteger(completedMeetingDeals)} сделок с состоявшейся встречей по числу уникальных посещенных событий до контракта.
          </p>

          <div className="mt-4 space-y-3">
            {journey.eventDepthRows.map((row) => (
              <div
                key={row.depthKey}
                role="img"
                aria-label={`${row.label}: ${formatInteger(row.deals)} сделок, ${formatJourneyPercent(row.rateFromCompletedMeeting)} от состоявшихся встреч`}
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-800">{row.label}</span>
                  <span className="whitespace-nowrap tabular-nums font-bold text-slate-950">
                    {formatInteger(row.deals)} · {formatJourneyPercent(row.rateFromCompletedMeeting)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-200">
                  <div
                    className="h-full rounded bg-teal-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.min(Math.max(row.rateFromCompletedMeeting, 0), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Контракт после встречи</h4>
              <p className="mt-1 max-w-[60ch] text-pretty text-xs leading-relaxed text-slate-500">
                Сравнение по глубине событий. Это наблюдаемая связь, а не доказанная причина.
              </p>
            </div>
            {totalContractDeals > 0 ? (
              <p className="tabular-nums text-xs font-semibold text-slate-600">
                Контрактов {formatInteger(totalContractDeals)} · передано {formatInteger(totalTransferredDeals)}
              </p>
            ) : null}
          </div>

          {totalContractDeals === 0 ? (
            <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
              <p className="text-sm font-bold text-amber-950">Недостаточно данных для сравнения</p>
              <p className="mt-1 max-w-[60ch] text-pretty text-sm leading-relaxed text-amber-900">
                В выбранной когорте нет контрактов после подтвержденной встречи в строгой последовательности. Сравнивать глубину событий пока нельзя.
              </p>
              <p className="mt-2 tabular-nums text-xs font-semibold text-amber-800">
                Основание: {formatInteger(completedMeetingDeals)} сделок с состоявшейся встречей.
              </p>
            </div>
          ) : (
            <>
              <div
                className="mt-3 overflow-x-auto"
                role="region"
                aria-label="Таблица контрактов по глубине событий"
                tabIndex={0}
              >
                <table className="w-full min-w-[30rem] text-sm" aria-label="Контракт по глубине посещенных событий">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">
                      <th className="px-2 py-2">Глубина</th>
                      <th className="px-2 py-2 text-right">Сделок</th>
                      <th className="px-2 py-2 text-right">Контракт</th>
                      <th className="px-2 py-2 text-right">Передано</th>
                      <th className="px-2 py-2 text-right">До контракта</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journey.eventDepthRows.map((row) => (
                      <tr key={row.depthKey} className="border-b border-slate-100 last:border-b-0">
                        <th className="px-2 py-2 text-left font-semibold text-slate-800">{row.label}</th>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-700">{formatInteger(row.deals)}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-slate-900">
                          {formatInteger(row.contractDeals)} · {formatJourneyPercent(row.contractRate)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-emerald-700">
                          {formatInteger(row.transferredDeals)} · {formatJourneyPercent(row.transferredRate)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                          {formatJourneyDays(row.medianDaysToContract)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Строки с выборкой меньше 10 сделок нельзя использовать для жесткого рейтинга.
              </p>
            </>
          )}
        </div>
      </div>

      <details className="group border-t border-slate-200 bg-white px-5 py-2 text-sm text-slate-600">
        <summary className="flex min-h-10 cursor-pointer list-none select-none items-center gap-2 font-semibold text-slate-800 transition-[color] duration-150 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="h-4 w-4 shrink-0 -rotate-90 transition-transform duration-150 ease-out group-open:rotate-0"
            aria-hidden="true"
          />
          <span>Как считаем шаги</span>
        </summary>
        <div className="mb-2 mt-1 grid max-w-5xl gap-x-8 gap-y-2 text-pretty text-sm leading-relaxed md:grid-cols-2">
          <p><strong>Создана:</strong> дата создания сделки; это вход в «Базу входящую» и начало когорты.</p>
          <p><strong>Первый звонок:</strong> первая прямая исходящая попытка после создания, включая недозвон.</p>
          <p><strong>Подтвержденный разговор:</strong> исходящее соединение с разговором дольше 30 секунд.</p>
          <p><strong>Встреча:</strong> отдельно считаем назначение даты и подтвержденный факт проведения.</p>
          <p><strong>События:</strong> уникальные подтвержденные посещения после встречи и до контракта.</p>
          <p><strong>Контракт и передача:</strong> последовательные CRM-этапы; посещение события не обязательно.</p>
        </div>
      </details>
    </section>
  )
}
