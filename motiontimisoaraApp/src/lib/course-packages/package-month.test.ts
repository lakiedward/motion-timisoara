import { expect, test } from 'vitest'

import {
  bucharestMonth,
  dateLabel,
  lastDayLabel,
  monthRange,
  packageMonthOptions,
} from './package-month'

test('the month follows Bucharest time around midnight', () => {
  expect(bucharestMonth(new Date('2026-11-30T21:30:00Z'))).toBe('2026-11')
  expect(bucharestMonth(new Date('2026-11-30T22:30:00Z'))).toBe('2026-12')
  expect(bucharestMonth(new Date('2026-12-10T10:00:00Z'), 1)).toBe('2027-01')
})

test('month labels show the whole calendar month', () => {
  expect(monthRange('2026-11')).toBe('1–30 noiembrie 2026')
  expect(lastDayLabel('2027-02')).toBe('28 februarie 2027')
  expect(lastDayLabel('2028-02')).toBe('29 februarie 2028')
  expect(dateLabel('2026-12-31')).toBe('31 decembrie 2026')
  expect(packageMonthOptions(new Date('2026-11-20T10:00:00Z'))).toEqual([
    {
      value: '2026-11',
      label: 'Luna aceasta (noiembrie 2026)',
      range: '1–30 noiembrie 2026',
      lastDay: '30 noiembrie 2026',
    },
    {
      value: '2026-12',
      label: 'Luna următoare (decembrie 2026)',
      range: '1–31 decembrie 2026',
      lastDay: '31 decembrie 2026',
    },
  ])
})
