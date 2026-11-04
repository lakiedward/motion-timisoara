import { describe, expect, test } from 'vitest'

import type { Subscription } from '@/api/subscriptions/subscriptions'
import { canStartCheckout, describeSubscription, effectiveTrialEnd } from './subscription-state'

const NOW = Date.parse('2026-11-04T12:00:00Z')
const noLaunch = { launchAt: null, launchTrialDays: 90 }
const launched = { launchAt: '2026-11-06T00:00:00Z', launchTrialDays: 90 }

function row(patch: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-row',
    subscriberType: 'CLUB',
    planCode: null,
    scheduledPlanCode: null,
    status: 'trialing',
    trialEnd: null,
    currentPeriodEnd: null,
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: false,
    hasStripeSubscription: false,
    ...patch,
  }
}

describe('describeSubscription', () => {
  test('no row is a missing subscription', () => {
    expect(describeSubscription(null, noLaunch, NOW)).toEqual({ kind: 'missing' })
  })

  test('a launch promotion row before launch has no end date and no checkout', () => {
    const view = describeSubscription(row(), noLaunch, NOW)
    expect(view).toEqual({ kind: 'launch_pending', launchTrialDays: 90 })
    expect(canStartCheckout(view, row())).toBe(false)
  })

  test('after launch the promotion ends launch_trial_days after launch_at', () => {
    expect(effectiveTrialEnd(row(), launched)).toBe('2027-02-04T00:00:00.000Z')
    const view = describeSubscription(row(), launched, NOW)
    expect(view).toMatchObject({ kind: 'trialing', daysLeft: 92, paid: false })
    expect(canStartCheckout(view, row())).toBe(true)
  })

  test('a concrete trial end wins and counts whole days left', () => {
    const trial = row({ trialEnd: '2026-11-06T13:00:00Z' })
    expect(describeSubscription(trial, noLaunch, NOW)).toMatchObject({
      kind: 'trialing',
      endsAt: '2026-11-06T13:00:00Z',
      daysLeft: 3,
    })
  })

  test('a trial already paid through Stripe cannot start another checkout', () => {
    const trial = row({ trialEnd: '2026-12-01T00:00:00Z', hasStripeSubscription: true })
    const view = describeSubscription(trial, noLaunch, NOW)
    expect(view).toMatchObject({ kind: 'trialing', paid: true })
    expect(canStartCheckout(view, trial)).toBe(false)
  })

  test('a trial past its end reads as expired', () => {
    const view = describeSubscription(row({ trialEnd: '2026-11-04T11:59:59Z' }), noLaunch, NOW)
    expect(view).toEqual({ kind: 'expired' })
  })

  test('active shows the next charge and keeps one day of tolerance', () => {
    const active = row({ status: 'active', currentPeriodEnd: '2026-12-02T10:00:00Z' })
    expect(describeSubscription(active, noLaunch, NOW)).toEqual({
      kind: 'active',
      nextChargeAt: '2026-12-02T10:00:00Z',
    })
    const late = row({ status: 'active', currentPeriodEnd: '2026-11-03T13:00:00Z' })
    expect(describeSubscription(late, noLaunch, NOW).kind).toBe('active')
    const gone = row({ status: 'active', currentPeriodEnd: '2026-11-03T12:00:00Z' })
    expect(describeSubscription(gone, noLaunch, NOW).kind).toBe('expired')
  })

  test('past due keeps access for 7 days after the failed payment', () => {
    const pastDue = row({ status: 'past_due', pastDueSince: '2026-11-01T12:00:00Z' })
    expect(describeSubscription(pastDue, noLaunch, NOW)).toEqual({
      kind: 'past_due',
      graceEndsAt: '2026-11-08T12:00:00.000Z',
    })
    const over = row({ status: 'past_due', pastDueSince: '2026-10-28T12:00:00Z' })
    expect(describeSubscription(over, noLaunch, NOW).kind).toBe('expired')
  })

  test('canceled stays usable until the paid period ends', () => {
    const canceled = row({ status: 'canceled', currentPeriodEnd: '2026-11-20T00:00:00Z' })
    expect(describeSubscription(canceled, noLaunch, NOW)).toEqual({
      kind: 'canceled',
      endsAt: '2026-11-20T00:00:00Z',
    })
  })

  test('a paid trial or active plan set to cancel at period end reads as canceled', () => {
    const trial = row({
      trialEnd: '2026-11-24T10:00:00Z',
      currentPeriodEnd: '2026-11-24T10:00:00Z',
      cancelAtPeriodEnd: true,
      hasStripeSubscription: true,
    })
    expect(describeSubscription(trial, noLaunch, NOW)).toEqual({
      kind: 'canceled',
      endsAt: '2026-11-24T10:00:00Z',
    })
    const active = row({
      status: 'active',
      currentPeriodEnd: '2026-12-01T00:00:00Z',
      cancelAtPeriodEnd: true,
      hasStripeSubscription: true,
    })
    expect(describeSubscription(active, noLaunch, NOW)).toEqual({
      kind: 'canceled',
      endsAt: '2026-12-01T00:00:00Z',
    })
  })

  test('expired can subscribe again', () => {
    const expired = row({ status: 'expired', hasStripeSubscription: true })
    const view = describeSubscription(expired, noLaunch, NOW)
    expect(view).toEqual({ kind: 'expired' })
    expect(canStartCheckout(view, expired)).toBe(true)
  })
})
