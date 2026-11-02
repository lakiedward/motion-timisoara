import { describe, expect, it } from 'vitest'

import { activityWhen, formatShortDate, formatShortDateTime, formatTimeRange } from './panel-date'

describe('panel dates', () => {
  it('formats a civil date without shifting the day', () => {
    expect(formatShortDate('2026-12-12')).toBe('12.12.2026')
    expect(formatShortDate('2027-01-01')).toBe('01.01.2027')
  })

  it('formats an instant in Bucharest time', () => {
    expect(formatShortDate('2026-10-04T22:30:00Z')).toBe('05.10.2026')
    expect(formatShortDateTime('2026-08-27T07:05:00Z')).toBe('27.08.2026, 10:05')
  })

  it('formats a time range from database times', () => {
    expect(formatTimeRange('10:00:00', '12:30:00')).toBe('10:00–12:30')
  })

  it('describes when an activity happens', () => {
    expect(
      activityWhen({ activity_date: '2026-11-21', start_time: '10:00:00', end_time: '12:00:00' }),
    ).toBe('21.11.2026 · 10:00–12:00')
  })
})
