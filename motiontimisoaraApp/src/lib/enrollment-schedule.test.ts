import { expect, test } from 'vitest'

import { scheduleLabel } from './enrollment-schedule'

test('a course shows its next session in Romanian, in local time', () => {
  expect(scheduleLabel({ type: 'session', startsAt: '2026-10-22T14:00:00Z' })).toBe(
    'Următoarea ședință: Joi, 22 octombrie, 17:00',
  )
})

test('a camp shows its whole period', () => {
  expect(scheduleLabel({ type: 'period', start: '2026-07-12', end: '2026-07-18' })).toBe(
    '12 iulie – 18 iulie 2026',
  )
})

test('an activity shows its day and hours', () => {
  expect(
    scheduleLabel({ type: 'day', date: '2026-10-25', startTime: '10:00:00', endTime: '12:30:00' }),
  ).toBe('Duminică, 25 octombrie, 10:00–12:30')
})

test('missing or broken dates give no line', () => {
  expect(scheduleLabel(null)).toBeNull()
  expect(scheduleLabel({ type: 'session', startsAt: 'nu' })).toBeNull()
})
