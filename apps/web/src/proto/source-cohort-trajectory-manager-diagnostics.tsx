import type { ReactNode } from 'react'

import type { SourceCohortTrajectoryManagerDiagnostic } from '@/lib/dashboard-types'
import { formatInteger, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatSourceCohortPercent(value: number) {
  return `${formatPercent(value)}%`
}

function formatTrajectoryDays(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${formatNumber(value)} дн.` : '—'
}

function SourceCohortSectionHeading({
  title,
  description,
  right,
}: {
  title: string
  description?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {right}
    </div>
  )
}

type SourceCohortManagerDiagnosticSignal =
  SourceCohortTrajectoryManagerDiagnostic['strengths'][number]

function formatManagerDiagnosticSignalValue(signal: SourceCohortManagerDiagnosticSignal) {
  if (signal.unit === '%') {
    return formatSourceCohortPercent(signal.value)
  }

  if (signal.unit === 'дн.') {
    return formatTrajectoryDays(signal.value)
  }

  if (signal.unit) {
    return `${formatNumber(signal.value)} ${signal.unit}`
  }

  return formatNumber(signal.value)
}

function formatManagerDiagnosticDelta(signal: SourceCohortManagerDiagnosticSignal) {
  if (signal.delta === null) {
    return null
  }

  const prefix = signal.delta > 0 ? '+' : ''
  const value =
    signal.unit === '%'
      ? formatSourceCohortPercent(signal.delta)
      : `${formatNumber(signal.delta)}${signal.unit ? ` ${signal.unit}` : ''}`
  return `${prefix}${value} к когорте`
}

function getManagerDiagnosticStatusLabel(
  diagnostic: SourceCohortTrajectoryManagerDiagnostic,
) {
  const strengthCount = diagnostic.strengths?.length ?? 0
  const bottleneckCount = diagnostic.bottlenecks?.length ?? 0

  if (diagnostic.status === 'bottleneck') {
    return 'узкое место'
  }

  if (diagnostic.status === 'strength') {
    return 'сильная сторона'
  }

  if (diagnostic.status === 'low_sample') {
    return 'малая выборка'
  }

  if (strengthCount === 0 && bottleneckCount === 0) {
    return 'без отклонения'
  }

  return 'смешано'
}

function getManagerDiagnosticStatusClasses(
  diagnostic: SourceCohortTrajectoryManagerDiagnostic,
) {
  const strengthCount = diagnostic.strengths?.length ?? 0
  const bottleneckCount = diagnostic.bottlenecks?.length ?? 0

  if (diagnostic.status === 'bottleneck') {
    return 'border-amber-200 bg-amber-50 text-amber-900'
  }

  if (diagnostic.status === 'strength') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }

  if (
    diagnostic.status === 'low_sample' ||
    (strengthCount === 0 && bottleneckCount === 0)
  ) {
    return 'border-slate-200 bg-slate-50 text-slate-600'
  }

  return 'border-blue-200 bg-blue-50 text-blue-900'
}

export function SourceCohortManagerDiagnosticsSection({
  diagnostics,
}: {
  diagnostics: SourceCohortTrajectoryManagerDiagnostic[]
}) {
  return (
    <section className="mt-4 scroll-mt-36 rounded-2xl border border-slate-200 bg-white/75 p-3">
      <SourceCohortSectionHeading
        title="Диагностика менеджеров"
        description="Оценка по текущему ответственному сделки в снимке CRM; историческая атрибуция действий пока не считается."
        right={
          <span className="badge-chip badge-neutral">
            {formatInteger(diagnostics.length)} менеджеров
          </span>
        }
      />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {diagnostics.map((diagnostic) => {
          const mainSignal = diagnostic.bottlenecks[0] ?? diagnostic.strengths[0] ?? null
          const delta = mainSignal ? formatManagerDiagnosticDelta(mainSignal) : null

          return (
            <article
              key={diagnostic.managerId}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-black text-slate-950">{diagnostic.managerName}</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatInteger(diagnostic.totalDeals)} сделок в когорте
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-bold',
                    getManagerDiagnosticStatusClasses(diagnostic),
                  )}
                >
                  {getManagerDiagnosticStatusLabel(diagnostic)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {diagnostic.headline}
              </p>
              {mainSignal ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                    {mainSignal.severity === 'positive' ? 'Сильный сигнал' : 'Главный сигнал'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-slate-900">{mainSignal.label}</p>
                    <p
                      className={cn(
                        'font-black',
                        mainSignal.severity === 'positive'
                          ? 'text-emerald-700'
                          : 'text-amber-800',
                      )}
                    >
                      {formatManagerDiagnosticSignalValue(mainSignal)}
                    </p>
                  </div>
                  {delta ? <p className="mt-1 text-xs text-slate-500">{delta}</p> : null}
                </div>
              ) : null}
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {diagnostic.recommendedFocus}
              </p>
              {diagnostic.sampleWarning ? (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {diagnostic.sampleWarning}
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
