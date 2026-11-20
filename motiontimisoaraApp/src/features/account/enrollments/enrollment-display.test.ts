import { expect, test } from 'vitest'

import { sessionsLines } from './enrollment-display'

const base = { kind: 'COURSE', status: 'ACTIVE', purchased_sessions: 0, remaining_sessions: 0 }
const november = {
  id: 'm1',
  sessions: 8,
  sessions_used: 5,
  valid_from: '2026-11-01',
  valid_until: '2026-11-30',
}
const december = {
  ...november,
  id: 'm2',
  sessions_used: 0,
  valid_from: '2026-12-01',
  valid_until: '2026-12-31',
}

test('enrollments without monthly packages keep the old line', () => {
  expect(
    sessionsLines({ ...base, purchased_sessions: 10, remaining_sessions: 4 }, '2026-11-20'),
  ).toEqual(['Ședințe: 4 rămase din 10'])
  expect(sessionsLines({ ...base, status: 'PENDING' }, '2026-11-20')).toEqual([
    'Începe după confirmarea plății',
  ])
})

test('a running monthly package shows what is left and when it expires', () => {
  expect(sessionsLines({ ...base, monthly_packages: [december, november] }, '2026-11-20')).toEqual([
    'Pachet lunar noiembrie 2026: 3 rămase din 8, expiră pe 30 noiembrie 2026',
    'Pachet lunar decembrie 2026: 8 ședințe, începe pe 1 decembrie 2026',
  ])
})

test('sessions that never expire are named apart from the monthly package', () => {
  expect(
    sessionsLines(
      { ...base, purchased_sessions: 4, remaining_sessions: 2, monthly_packages: [november] },
      '2026-11-30',
    ),
  ).toEqual([
    'Ședințe fără expirare: 2 rămase din 4',
    'Pachet lunar noiembrie 2026: 3 rămase din 8, expiră pe 30 noiembrie 2026',
  ])
})

test('an expired package says so the day after the month ends', () => {
  expect(sessionsLines({ ...base, monthly_packages: [november] }, '2026-12-01')).toEqual([
    'Pachetul lunar din noiembrie 2026 a expirat pe 30 noiembrie 2026',
  ])
})
