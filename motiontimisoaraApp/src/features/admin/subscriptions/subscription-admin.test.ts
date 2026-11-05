import { expect, test } from 'vitest'

import { adminSubscription, inDays } from '@/test/admin-subscription-fixture'
import {
  NO_PLAN,
  NO_SUBSCRIPTION_FILTERS,
  extensionPreview,
  filterSubscriptions,
  groupByStatus,
  isEndingSoon,
  planOptions,
  recurringBani,
  statusCounts,
  subscriptionTotals,
} from './subscription-admin'

const NOW = Date.parse('2026-11-05T10:00:00Z')

const coach = adminSubscription()
const club = adminSubscription({
  id: 's2',
  subscriber_type: 'CLUB',
  subscriber_name: 'Club Delfinii',
  subscriber_email: 'office@delfinii.ro',
  plan_code: 'CLUB_START',
  plan_name: 'Club Start',
  price_bani: 19900,
  coach_count: 2,
})
const trial = adminSubscription({
  id: 's3',
  subscriber_name: 'Ioana Șerban',
  subscriber_email: 'ioana@test.ro',
  plan_code: null,
  plan_name: null,
  price_bani: null,
  status: 'trialing',
  trial_end: inDays(5, NOW),
  access_end: inDays(5, NOW),
  has_stripe_subscription: false,
})
const failed = adminSubscription({
  id: 's4',
  subscriber_name: 'Zeno Pop',
  subscriber_email: 'zeno@test.ro',
  status: 'past_due',
  access_end: inDays(3, NOW),
})
const stopping = adminSubscription({
  id: 's5',
  subscriber_name: 'Maria Stan',
  subscriber_email: 'maria@test.ro',
  cancel_at_period_end: true,
})
const expired = adminSubscription({
  id: 's6',
  subscriber_name: 'Ana Dinu',
  subscriber_email: 'ana@test.ro',
  status: 'expired',
  access_end: null,
})
const all = [coach, club, trial, failed, stopping, expired]

test('monthly revenue counts only active subscriptions that renew', () => {
  expect(recurringBani(coach)).toBe(10000)
  expect(recurringBani(stopping)).toBe(0)
  expect(recurringBani(trial)).toBe(0)
  expect(recurringBani(failed)).toBe(0)
  const totals = subscriptionTotals(all, NOW)
  expect(totals.monthlyBani).toBe(10000 + 19900)
  expect(totals.payingCount).toBe(2)
  expect(totals.trialingCount).toBe(1)
  expect(totals.pastDueCount).toBe(1)
})

test('ending soon looks 14 days ahead and ignores ended subscriptions', () => {
  expect(isEndingSoon(trial, NOW)).toBe(true)
  expect(isEndingSoon(failed, NOW)).toBe(true)
  expect(isEndingSoon(coach, NOW)).toBe(false)
  expect(isEndingSoon(expired, NOW)).toBe(false)
  expect(isEndingSoon(adminSubscription({ status: 'canceled', access_end: inDays(2, NOW) }), NOW)).toBe(false)
  expect(isEndingSoon(adminSubscription({ access_end: inDays(-1, NOW) }), NOW)).toBe(false)
})

test('filters combine state, type, plan and a search that ignores diacritics and case', () => {
  const ids = (filters: Partial<typeof NO_SUBSCRIPTION_FILTERS>) =>
    filterSubscriptions(all, { ...NO_SUBSCRIPTION_FILTERS, ...filters }).map((s) => s.id)
  expect(ids({})).toHaveLength(6)
  expect(ids({ status: 'active' })).toEqual(['s1', 's2', 's5'])
  expect(ids({ type: 'CLUB' })).toEqual(['s2'])
  expect(ids({ plan: 'CLUB_START' })).toEqual(['s2'])
  expect(ids({ plan: NO_PLAN })).toEqual(['s3'])
  expect(ids({ query: 'serban' })).toEqual(['s3'])
  expect(ids({ query: 'DELFINII' })).toEqual(['s2'])
  expect(ids({ query: 'office@' })).toEqual(['s2'])
  expect(ids({ status: 'active', type: 'COACH', query: 'andrei' })).toEqual(['s1'])
})

test('status counts and plan options come from all rows', () => {
  expect(statusCounts(all)).toEqual({
    all: 6,
    past_due: 1,
    trialing: 1,
    active: 3,
    canceled: 0,
    expired: 1,
  })
  expect(planOptions(all)).toEqual([
    { id: NO_PLAN, name: 'Fără pachet ales', count: 1 },
    { id: 'COACH', name: 'Antrenor', count: 4 },
    { id: 'CLUB_START', name: 'Club Start', count: 1 },
  ])
})

test('groups follow the state order and sort by the nearest end', () => {
  const groups = groupByStatus(all)
  expect(groups.map((g) => g.status)).toEqual(['past_due', 'trialing', 'active', 'expired'])
  const active = groups.find((g) => g.status === 'active')!
  expect(active.subscriptions.map((s) => s.id)).toEqual(['s1', 's2', 's5'])
  expect(active.monthlyBani).toBe(29900)
})

test('the extension preview starts from the later of the current end and now', () => {
  const day = 86_400_000
  expect(extensionPreview(trial, 30, NOW)).toBe(new Date(Date.parse(trial.access_end!) + 30 * day).toISOString())
  const ended = adminSubscription({ status: 'expired', access_end: null })
  expect(extensionPreview(ended, 7, NOW)).toBe(new Date(NOW + 7 * day).toISOString())
  const past = adminSubscription({ status: 'canceled', access_end: inDays(-10, NOW) })
  expect(extensionPreview(past, 7, NOW)).toBe(new Date(NOW + 7 * day).toISOString())
  expect(extensionPreview(trial, 0, NOW)).toBeNull()
  expect(extensionPreview(trial, 367, NOW)).toBeNull()
  expect(extensionPreview(trial, 1.5, NOW)).toBeNull()
  expect(extensionPreview(adminSubscription({ status: 'trialing', access_end: null }), 7, NOW)).toBeNull()
})
