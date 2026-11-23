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

test('a pending monthly payment uses the same reference date as the package lines', () => {
  const enrollment = {
    ...base,
    status: 'PENDING',
    payments: [
      {
        id: 'payment',
        created_at: '2026-11-01T00:00:00Z',
        method: 'CASH',
        status: 'PENDING',
        amount: 20000,
        currency: 'RON',
        paid_at: null,
        pricing_snapshot: { validity: 'CALENDAR_MONTH', validMonth: '2026-11' },
      },
    ],
  }
  expect(sessionsLines(enrollment, '2026-11-30')).toEqual(['Începe după confirmarea plății'])
  expect(sessionsLines(enrollment, '2026-12-01')).toEqual([])
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

test('a package that expires after N days shows its purchase date and its own expiry', () => {
  const first = {
    id: 'd1',
    sessions: 8,
    sessions_used: 6,
    valid_from: '2026-11-20',
    valid_until: '2027-01-03',
    validity: 'DAYS',
  }
  const second = {
    ...first,
    id: 'd2',
    sessions_used: 0,
    valid_from: '2026-12-28',
    valid_until: '2027-02-10',
  }
  expect(sessionsLines({ ...base, monthly_packages: [second, first] }, '2026-12-28')).toEqual([
    'Pachet din 20 noiembrie 2026: 2 rămase din 8, expiră pe 3 ianuarie 2027',
    'Pachet din 28 decembrie 2026: 8 rămase din 8, expiră pe 10 februarie 2027',
  ])
  expect(sessionsLines({ ...base, monthly_packages: [first] }, '2027-01-04')).toEqual([
    'Pachetul din 20 noiembrie 2026 a expirat pe 3 ianuarie 2027',
  ])
})
