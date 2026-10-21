import { expect, test } from 'vitest'

import {
  filterInviteCodes,
  groupInviteCodes,
  inviteExpiryLabel,
  inviteStatusCounts,
} from './invite-code-overview'

const now = Date.parse('2026-10-20T12:00:00Z')
const codes = [
  { id: 'a', code: 'ABCD2345', current_uses: 0, max_uses: 2, expires_at: null },
  { id: 'u', code: 'USED7777', current_uses: 1, max_uses: 1, expires_at: '2026-10-01T09:14:00Z' },
  { id: 'e', code: 'OLDE9999', current_uses: 0, max_uses: 1, expires_at: '2026-10-19T09:00:00Z' },
  { id: 'f', code: 'NEXT8888', current_uses: 0, max_uses: 3, expires_at: '2026-11-01T09:00:00Z' },
]

test('counts every status and the total', () => {
  expect(inviteStatusCounts(codes, now)).toEqual({ all: 4, active: 2, used: 1, expired: 1 })
})

test('filters by status and by code, ignoring case', () => {
  expect(filterInviteCodes(codes, { query: '', status: 'active' }, now).map((c) => c.id)).toEqual([
    'a',
    'f',
  ])
  expect(
    filterInviteCodes(codes, { query: ' used ', status: 'all' }, now).map((c) => c.id),
  ).toEqual(['u'])
  expect(filterInviteCodes(codes, { query: 'used', status: 'active' }, now)).toEqual([])
})

test('groups in the order active, used, expired and drops empty groups', () => {
  const groups = groupInviteCodes(codes, now)
  expect(groups.map((g) => [g.key, g.name, g.codes.length])).toEqual([
    ['active', 'Active', 2],
    ['used', 'Folosite', 1],
    ['expired', 'Expirate', 1],
  ])
  expect(groupInviteCodes([codes[0]], now).map((g) => g.key)).toEqual(['active'])
})

test('a past expiry reads in the past tense whatever the status', () => {
  expect(inviteExpiryLabel(codes[1].expires_at, 'UTC', now)).toMatch(
    /^A expirat pe .*\d{2}:\d{2} \(UTC\)$/,
  )
  expect(inviteExpiryLabel(codes[3].expires_at, 'UTC', now)).toMatch(/^Expiră pe /)
  expect(inviteExpiryLabel(null, 'UTC', now)).toBe('Fără expirare')
})
