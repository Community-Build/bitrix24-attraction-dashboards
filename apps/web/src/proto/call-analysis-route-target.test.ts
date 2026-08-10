import { describe, expect, it } from 'vitest'

import {
  buildCallAnalysisPath,
  formatCallAnalysisBusinessDate,
  readCallAnalysisTarget,
} from '@/proto/call-analysis-route-target'

describe('call analysis route target', () => {
  it('uses the attraction business timezone at the calendar-day boundary', () => {
    expect(formatCallAnalysisBusinessDate('2026-06-17T21:30:00.000Z')).toBe('2026-06-18')
  })

  it('keeps a selected call in a reload-safe URL', () => {
    const path = buildCallAnalysisPath({
      callId: 'call 99',
      startedAt: '2026-06-18T10:00:00.000Z',
    })
    const query = path.slice(path.indexOf('?'))

    expect(readCallAnalysisTarget(query)).toEqual({
      callId: 'call 99',
      startedAt: '2026-06-18T10:00:00.000Z',
    })
  })

  it('rejects incomplete or invalid targets', () => {
    expect(readCallAnalysisTarget('?callId=99')).toBeNull()
    expect(readCallAnalysisTarget('?callId=99&callStartedAt=not-a-date')).toBeNull()
  })
})
