import { expect, test } from 'vitest'

import { addDays, bucharestDate, daysPackageLastDay } from './package-days'

test('the last day counts the payment day as day 1, in Bucharest', () => {
  expect(addDays('2026-11-20', 44)).toBe('2027-01-03')
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  expect(bucharestDate(new Date('2026-11-30T22:30:00Z'))).toBe('2026-12-01')
  expect(daysPackageLastDay(45, new Date('2026-11-20T10:00:00Z'))).toBe('3 ianuarie 2027')
  expect(daysPackageLastDay(7, new Date('2026-11-30T22:30:00Z'))).toBe('7 decembrie 2026')
})
