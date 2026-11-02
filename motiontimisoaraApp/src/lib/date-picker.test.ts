import { describe, expect, test } from 'vitest'

import {
  addDays,
  cursorFor,
  joinDateTime,
  monthGrid,
  monthLabel,
  normalizeTime,
  parseIsoDate,
  shiftMonth,
  splitDateTime,
  timeSlots,
} from './date-picker'

describe('date picker helpers', () => {
  test('month grid starts on Monday and covers whole weeks', () => {
    const grid = monthGrid({ year: 2026, month: 10 })
    expect(grid[0]).toEqual({ iso: '2026-10-26', day: 26, inMonth: false })
    expect(grid).toHaveLength(42)
    expect(grid.filter((day) => day.inMonth)).toHaveLength(30)
    expect(monthGrid({ year: 2027, month: 1 })).toHaveLength(28)
  })

  test('months shift across years and get Romanian labels', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 })
    expect(monthLabel({ year: 2026, month: 10 })).toBe('Noiembrie 2026')
    expect(cursorFor('2027-07-10')).toEqual({ year: 2027, month: 6 })
  })

  test('invalid dates are rejected and days roll over months', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('typed times are normalized and out-of-range ones refused', () => {
    expect(normalizeTime('9:05')).toBe('09:05')
    expect(normalizeTime('1010')).toBe('10:10')
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('10:60')).toBeNull()
    expect(normalizeTime('abc')).toBeNull()
  })

  test('slots follow the step and date-time values split and join', () => {
    expect(timeSlots(15)).toHaveLength(96)
    expect(timeSlots(30, '07:00', '08:00')).toEqual(['07:00', '07:30', '08:00'])
    expect(splitDateTime('2030-01-01T12:00')).toEqual({ date: '2030-01-01', time: '12:00' })
    expect(splitDateTime('')).toEqual({ date: '', time: '' })
    expect(joinDateTime('2030-01-01', '12:00')).toBe('2030-01-01T12:00')
    expect(joinDateTime('', '12:00')).toBe('')
  })
})
