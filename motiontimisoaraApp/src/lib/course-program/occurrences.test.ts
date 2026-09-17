import { expect, test } from 'vitest'

import { generateOccurrenceSlots, zonedCivilTimeToUtc } from './occurrences'

const RULE = {
  daySchedules: {
    '1': { start: '18:00', end: '19:30' },
    '3': { start: '16:00', end: '17:00' },
  },
}

test('maps Bucharest civil time through summer and winter offsets', () => {
  expect(zonedCivilTimeToUtc('2026-09-21', '18:00', 'Europe/Bucharest').toISOString()).toBe(
    '2026-09-21T15:00:00.000Z',
  )
  expect(zonedCivilTimeToUtc('2026-11-02', '18:00', 'Europe/Bucharest').toISOString()).toBe(
    '2026-11-02T16:00:00.000Z',
  )
})

test('generates eight inclusive weeks and skips a slot that already started', () => {
  const fromThursdayNoon = generateOccurrenceSlots(RULE, new Date('2026-09-17T09:00:00.000Z'))
  expect(fromThursdayNoon).toHaveLength(16)
  expect(fromThursdayNoon[0].startsAt.toISOString()).toBe('2026-09-21T15:00:00.000Z')
  expect(fromThursdayNoon[0].endsAt.toISOString()).toBe('2026-09-21T16:30:00.000Z')
  expect(fromThursdayNoon.at(-1)?.startsAt.toISOString()).toBe('2026-11-11T14:00:00.000Z')

  const duringMondaySlot = generateOccurrenceSlots(RULE, new Date('2026-09-21T15:10:00.000Z'))
  expect(duringMondaySlot[0].startsAt.toISOString()).toBe('2026-09-23T13:00:00.000Z')
  expect(
    duringMondaySlot.some((slot) => slot.startsAt.toISOString() === '2026-09-21T15:00:00.000Z'),
  ).toBe(false)
})

test('does not invent days that are missing from the rule', () => {
  const slots = generateOccurrenceSlots(
    { daySchedules: { '5': { start: '09:00', end: '10:00' } } },
    new Date('2026-09-17T09:00:00.000Z'),
  )
  expect(slots.every((slot) => slot.startsAt.getUTCDay() === 5)).toBe(true)
})
