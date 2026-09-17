import { describe, expect, test } from 'vitest'

import {
  courseProgramIssue,
  emptyCourseProgram,
  formatCourseProgramPreview,
  isEndAfterStart,
  normalizeTime,
  parseRecurrenceRule,
  serializeRecurrenceRule,
  weekdayLabel,
} from './recurrence'

test('empty program has seven disabled days and no implicit hours', () => {
  const program = emptyCourseProgram()
  expect(program).toHaveLength(7)
  expect(program.every((day) => !day.enabled && day.start === '' && day.end === '')).toBe(true)
  expect(courseProgramIssue(program)).toBe('Selectează cel puțin o zi și completează orele.')
})

test('serialize omits disabled days and normalizes HH:MM:SS', () => {
  const program = emptyCourseProgram()
  program[0].enabled = true
  program[0].start = '18:00:00'
  program[0].end = '19:30:00'
  program[2].enabled = true
  program[2].start = '16:00'
  program[2].end = '17:00'
  expect(JSON.parse(serializeRecurrenceRule(program))).toEqual({
    daySchedules: {
      '1': { start: '18:00', end: '19:30' },
      '3': { start: '16:00', end: '17:00' },
    },
  })
})

test('parse restores daySchedules and the legacy shared-time format', () => {
  const modern = parseRecurrenceRule(
    '{"daySchedules":{"2":{"start":"08:00","end":"09:00"},"5":{"start":"18:00:00","end":"19:00"}}}',
  )
  expect(modern[1]).toMatchObject({ iso: 2, enabled: true, start: '08:00', end: '09:00' })
  expect(modern[4]).toMatchObject({ iso: 5, enabled: true, start: '18:00', end: '19:00' })
  expect(modern.filter((day) => day.enabled)).toHaveLength(2)

  const legacy = parseRecurrenceRule('{"days":[1,4],"start":"18:00","end":"19:00"}')
  expect(legacy[0].enabled).toBe(true)
  expect(legacy[3].enabled).toBe(true)
  expect(legacy[0].start).toBe('18:00')
  expect(legacy.filter((day) => day.enabled)).toHaveLength(2)
})

test('parse does not invent a program from empty or malformed JSON', () => {
  expect(parseRecurrenceRule(null).every((day) => !day.enabled)).toBe(true)
  expect(parseRecurrenceRule('{').every((day) => !day.enabled)).toBe(true)
  expect(parseRecurrenceRule('{"daySchedules":{}}').every((day) => !day.enabled)).toBe(true)
})

test('validation names the missing hours and rejects end before start', () => {
  const program = emptyCourseProgram()
  program[0].enabled = true
  expect(courseProgramIssue(program)).toBe('Completează orele pentru Luni.')
  program[0].start = '19:00'
  program[0].end = '18:00'
  expect(courseProgramIssue(program)).toBe(
    'Ora de final trebuie să fie după ora de început pentru Luni.',
  )
  program[0].end = '19:30'
  expect(courseProgramIssue(program)).toBeNull()
})

test('preview lists only completed selected days', () => {
  const program = emptyCourseProgram()
  program[0].enabled = true
  program[0].start = '18:00'
  program[0].end = '19:00'
  program[4].enabled = true
  expect(formatCourseProgramPreview(program)).toBe('Luni 18:00–19:00')
})

describe('time helpers', () => {
  test('normalize and compare', () => {
    expect(normalizeTime('7:05')).toBe('')
    expect(normalizeTime('07:05:00')).toBe('07:05')
    expect(isEndAfterStart('18:00', '18:00')).toBe(false)
    expect(isEndAfterStart('18:00', '18:01')).toBe(true)
    expect(weekdayLabel(6)).toBe('Sâmbătă')
  })
})
