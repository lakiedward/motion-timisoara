import {
  addCampInclusiveDays,
  campInclusiveDayCount,
  campIsoDate,
  campPeriodDurationLabel,
} from './camp-period'

test('rejects incomplete or impossible calendar dates', () => {
  expect(campIsoDate('')).toBe(false)
  expect(campIsoDate('2026-9-13')).toBe(false)
  expect(campIsoDate('2026-02-31')).toBe(false)
  expect(campIsoDate('2026-09-13')).toBe(true)
})

test('counts inclusive camp days on the local calendar', () => {
  expect(campInclusiveDayCount('2026-09-13', '2026-09-20')).toBe(8)
  expect(campInclusiveDayCount('2026-09-13', '2026-09-13')).toBe(1)
  expect(campInclusiveDayCount('2026-09-20', '2026-09-13')).toBeNull()
  expect(campInclusiveDayCount('', '2026-09-13')).toBeNull()
})

test('adds an inclusive length without leaving the calendar month incorrectly', () => {
  expect(addCampInclusiveDays('2026-09-13', 8)).toBe('2026-09-20')
  expect(addCampInclusiveDays('2026-01-28', 7)).toBe('2026-02-03')
})

test('labels the inclusive length in Romanian', () => {
  expect(campPeriodDurationLabel('2026-09-13', '2026-09-20')).toBe('8 zile')
  expect(campPeriodDurationLabel('2026-09-13', '2026-09-13')).toBe('1 zi')
  expect(campPeriodDurationLabel('2026-09-13', '')).toBeNull()
})
