export interface CallAnalysisTarget {
  callId: string
  startedAt: string
}

const CALL_ANALYSIS_TIME_ZONE = 'Europe/Moscow'

export function formatCallAnalysisBusinessDate(startedAt: string): string | null {
  const date = new Date(startedAt)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CALL_ANALYSIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  const year = values.get('year')
  const month = values.get('month')
  const day = values.get('day')
  return year && month && day ? `${year}-${month}-${day}` : null
}

export function readCallAnalysisTarget(search: string): CallAnalysisTarget | null {
  const params = new URLSearchParams(search)
  const callId = params.get('callId')?.trim() ?? ''
  const startedAt = params.get('callStartedAt')?.trim() ?? ''
  if (!callId || callId.length > 128 || !formatCallAnalysisBusinessDate(startedAt)) return null
  return { callId, startedAt }
}

export function buildCallAnalysisPath(target: CallAnalysisTarget | null): string {
  if (!target) return '/calls'
  const params = new URLSearchParams({
    callId: target.callId,
    callStartedAt: target.startedAt,
  })
  return `/calls?${params.toString()}`
}
