import { expect, test } from 'vitest'

import { attendancePackageNote } from './package-expiry'

const pack = (from: string, until: string, used = 0, sessions = 4) => ({
  sessions,
  sessions_used: used,
  valid_from: from,
  valid_until: until,
})

test('shows the expiry of the package that attendance consumes first', () => {
  const note = attendancePackageNote(
    [pack('2026-12-01', '2026-12-31'), pack('2026-11-01', '2026-11-30')],
    0,
    '2026-11-20',
  )
  expect(note).toBe('expiră pe 30 noiembrie 2026')
})

test('skips used up and not yet started packages', () => {
  const note = attendancePackageNote(
    [pack('2026-11-01', '2026-11-30', 4), pack('2026-11-15', '2026-12-14')],
    0,
    '2026-11-20',
  )
  expect(note).toBe('expiră pe 14 decembrie 2026')
})

test('shows nothing for courses without expiring packages', () => {
  expect(attendancePackageNote([], 5, '2026-11-20')).toBeNull()
  expect(attendancePackageNote(undefined, 0, '2026-11-20')).toBeNull()
})

test('keeps quiet when only non-expiring sessions are left', () => {
  expect(attendancePackageNote([pack('2026-10-01', '2026-10-31')], 3, '2026-11-20')).toBeNull()
})

test('says there is no valid package when nothing is left to consume', () => {
  expect(attendancePackageNote([pack('2026-10-01', '2026-10-31')], 0, '2026-11-20')).toBe(
    'fără pachet valabil',
  )
})
