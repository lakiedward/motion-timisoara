import { describe, expect, test } from 'vitest'

import {
  descriptionParagraphs,
  formatWeeklyProgram,
  upcomingSessions,
  weeklyProgram,
} from '@/lib/course-detail'

const now = new Date('2026-10-14T10:00:00Z')

const occurrence = (id: string, start: string, end: string | null) => ({
  id,
  starts_at: start,
  ends_at: end,
})

describe('upcomingSessions', () => {
  test('drops past sessions and sorts the rest by start', () => {
    const sessions = upcomingSessions(
      [
        occurrence('c', '2026-10-16T15:00:00Z', '2026-10-16T16:00:00Z'),
        occurrence('a', '2026-10-07T12:00:00Z', '2026-10-07T14:00:00Z'),
        occurrence('b', '2026-10-14T12:00:00Z', '2026-10-14T13:00:00Z'),
      ],
      now,
    )
    expect(sessions.map((s) => s.id)).toEqual(['b', 'c'])
  })

  test('keeps a session that is still running', () => {
    const sessions = upcomingSessions(
      [occurrence('live', '2026-10-14T09:30:00Z', '2026-10-14T10:30:00Z')],
      now,
    )
    expect(sessions).toHaveLength(1)
  })

  test('shows weekday, date and the time range in Romanian time', () => {
    const [session] = upcomingSessions(
      [occurrence('x', '2026-10-14T12:00:00Z', '2026-10-14T13:00:00Z')],
      now,
    )
    expect(session).toEqual({ id: 'x', weekday: 'Miercuri', date: '14.10.2026', time: '15:00–16:00' })
  })

  test('shows only the start when the end is missing', () => {
    const [session] = upcomingSessions([occurrence('x', '2026-10-15T12:00:00Z', null)], now)
    expect(session?.time).toBe('15:00')
  })

  test('returns at most eight sessions', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      occurrence(String(i), `2026-10-${20 + (i % 9)}T12:0${i % 10}:00Z`, null),
    )
    expect(upcomingSessions(many, now)).toHaveLength(8)
  })

  test('is empty when every session is in the past', () => {
    expect(upcomingSessions([occurrence('a', '2026-06-17T18:00:00Z', null)], now)).toEqual([])
  })
})

describe('weeklyProgram', () => {
  test('reads the weekly rule first', () => {
    const rule = JSON.stringify({
      daySchedules: { 1: { start: '15:00', end: '16:00' }, 5: { start: '18:00', end: '19:00' } },
    })
    const slots = weeklyProgram({ recurrence_rule: rule, occurrences: [] }, now)
    expect(formatWeeklyProgram(slots)).toBe('Luni 15:00–16:00 · Vineri 18:00–19:00')
  })

  test('falls back to future sessions without a rule', () => {
    const slots = weeklyProgram(
      {
        recurrence_rule: null,
        occurrences: [
          occurrence('a', '2026-10-15T15:00:00Z', '2026-10-15T16:00:00Z'),
          occurrence('b', '2026-10-22T15:00:00Z', '2026-10-22T16:00:00Z'),
          occurrence('old', '2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z'),
        ],
      },
      now,
    )
    expect(formatWeeklyProgram(slots)).toBe('Joi 18:00–19:00')
  })

  test('formats nothing without slots', () => {
    expect(formatWeeklyProgram([])).toBeNull()
  })
})

test('descriptionParagraphs splits on blank lines', () => {
  expect(descriptionParagraphs('Unu.\n\n  Doi.\n')).toEqual(['Unu.', 'Doi.'])
  expect(descriptionParagraphs('Un rând\naltul')).toEqual(['Un rând\naltul'])
})
