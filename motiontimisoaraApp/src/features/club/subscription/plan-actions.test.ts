import { describe, expect, test } from 'vitest'

import type { Subscription, SubscriptionPlan } from '@/api/subscriptions/subscriptions'
import type { SubscriptionView } from '@/features/subscriptions/subscription-state'
import { limitWarning, nextLargerPlan, planAction, type PlanContext } from './plan-actions'

const plans: SubscriptionPlan[] = [
  {
    code: 'CLUB_START',
    subscriberType: 'CLUB',
    name: 'Club Start',
    priceBani: 19900,
    coachLimit: 3,
  },
  { code: 'CLUB', subscriberType: 'CLUB', name: 'Club', priceBani: 34900, coachLimit: 10 },
  {
    code: 'CLUB_PRO',
    subscriberType: 'CLUB',
    name: 'Club Pro',
    priceBani: 59900,
    coachLimit: null,
  },
]
const [start, club, pro] = plans

function sub(patch: Partial<Subscription> = {}): Subscription {
  return {
    id: 'row',
    subscriberType: 'CLUB',
    planCode: 'CLUB',
    scheduledPlanCode: null,
    status: 'active',
    trialEnd: null,
    currentPeriodEnd: '2026-12-02T10:00:00Z',
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
    hasStripeSubscription: true,
    ...patch,
  }
}

const active: SubscriptionView = { kind: 'active', nextChargeAt: '2026-12-02T10:00:00Z' }

function ctx(patch: Partial<PlanContext> = {}): PlanContext {
  return { view: active, subscription: sub(), plans, coachCount: 2, ...patch }
}

describe('planAction', () => {
  test('during a free trial every plan that fits opens checkout', () => {
    const trial: PlanContext = ctx({
      view: { kind: 'trialing', endsAt: '2026-11-20T00:00:00Z', daysLeft: 16, paid: false },
      subscription: sub({ status: 'trialing', planCode: null, hasStripeSubscription: false }),
      coachCount: 5,
    })
    expect(planAction(start, trial)).toEqual({ kind: 'blocked', coachesToRemove: 2 })
    expect(planAction(club, trial)).toEqual({ kind: 'checkout' })
    expect(planAction(pro, trial)).toEqual({ kind: 'checkout' })
  })

  test('active club: current, immediate upgrade and downgrade at period end', () => {
    expect(planAction(club, ctx())).toEqual({ kind: 'current', keepScheduled: false })
    expect(planAction(pro, ctx())).toEqual({ kind: 'upgrade' })
    expect(planAction(start, ctx())).toEqual({
      kind: 'downgrade',
      effectiveAt: '2026-12-02T10:00:00Z',
    })
  })

  test('a downgrade below the coach count is blocked with the number to remove', () => {
    expect(planAction(start, ctx({ coachCount: 4 }))).toEqual({
      kind: 'blocked',
      coachesToRemove: 1,
    })
  })

  test('a scheduled downgrade shows on its plan and the current plan offers to keep it', () => {
    const scheduled = ctx({ subscription: sub({ scheduledPlanCode: 'CLUB_START' }) })
    expect(planAction(start, scheduled)).toEqual({
      kind: 'scheduled',
      effectiveAt: '2026-12-02T10:00:00Z',
    })
    expect(planAction(club, scheduled)).toEqual({ kind: 'current', keepScheduled: true })
  })

  test('past due and canceled allow no plan change, only the portal', () => {
    const pastDue = ctx({ view: { kind: 'past_due', graceEndsAt: '2026-11-08T00:00:00Z' } })
    expect(planAction(pro, pastDue)).toEqual({ kind: 'none' })
    expect(planAction(club, pastDue)).toEqual({ kind: 'current', keepScheduled: false })
    const canceled = ctx({ view: { kind: 'canceled', endsAt: '2026-11-20T00:00:00Z' } })
    expect(planAction(start, canceled)).toEqual({ kind: 'none' })
  })

  test('before launch nothing can be bought', () => {
    const pending = ctx({
      view: { kind: 'launch_pending', launchTrialDays: 90 },
      subscription: sub({ status: 'trialing', planCode: null, hasStripeSubscription: false }),
    })
    expect(plans.map((plan) => planAction(plan, pending).kind)).toEqual(['none', 'none', 'none'])
  })

  test('an expired club can subscribe again through checkout', () => {
    const expired = ctx({ view: { kind: 'expired' }, subscription: sub({ status: 'expired' }) })
    expect(planAction(club, expired)).toEqual({ kind: 'checkout' })
  })
})

describe('limitWarning', () => {
  test('warns at and over the limit of the current plan only', () => {
    const onStart = ctx({ subscription: sub({ planCode: 'CLUB_START' }), coachCount: 3 })
    expect(limitWarning(onStart)).toEqual({
      planName: 'Club Start',
      coachCount: 3,
      coachLimit: 3,
      over: false,
    })
    expect(nextLargerPlan(onStart)?.code).toBe('CLUB')
    expect(limitWarning({ ...onStart, coachCount: 2 })).toBeNull()
    expect(
      limitWarning(ctx({ subscription: sub({ planCode: 'CLUB_PRO' }), coachCount: 40 })),
    ).toBeNull()
  })
})
