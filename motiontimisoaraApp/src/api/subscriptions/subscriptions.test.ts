import { beforeEach, expect, test, vi } from 'vitest'

import { getMySubscription, getSubscriptionPlans, getSubscriptionSettings } from './subscriptions'

let result: { data: unknown; error: unknown } = { data: null, error: null }
const calls: unknown[][] = []

function builder() {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit']) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return chain
    }
  }
  chain.maybeSingle = async () => result
  chain.then = (resolve: (value: unknown) => void) => resolve(result)
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      calls.push(['from', table])
      return builder()
    },
  },
}))

beforeEach(() => {
  calls.length = 0
})

test('reads the own subscription row and hides the Stripe ids', async () => {
  result = {
    data: {
      id: 'row-1',
      subscriber_type: 'CLUB',
      plan_code: 'CLUB',
      scheduled_plan_code: 'CLUB_START',
      status: 'active',
      trial_end: null,
      current_period_end: '2026-12-02T10:00:00Z',
      past_due_since: null,
      cancel_at_period_end: false,
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    },
    error: null,
  }
  const row = await getMySubscription('CLUB')
  expect(row).toEqual({
    id: 'row-1',
    subscriberType: 'CLUB',
    planCode: 'CLUB',
    scheduledPlanCode: 'CLUB_START',
    status: 'active',
    trialEnd: null,
    currentPeriodEnd: '2026-12-02T10:00:00Z',
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
    hasStripeSubscription: true,
  })
  expect(JSON.stringify(row)).not.toContain('sub_1')
  expect(calls).toContainEqual(['from', 'subscriptions'])
  expect(calls).toContainEqual(['eq', 'subscriber_type', 'CLUB'])
})

test('no row is null and an error is a Romanian message', async () => {
  result = { data: null, error: null }
  await expect(getMySubscription('COACH')).resolves.toBeNull()
  result = { data: null, error: { message: 'denied' } }
  await expect(getMySubscription('COACH')).rejects.toThrow('Nu am putut încărca abonamentul.')
})

test('plans are read by subscriber type, cheapest first', async () => {
  result = {
    data: [
      {
        code: 'CLUB_START',
        subscriber_type: 'CLUB',
        name: 'Club Start',
        price_bani: 19900,
        coach_limit: 3,
      },
      {
        code: 'CLUB_PRO',
        subscriber_type: 'CLUB',
        name: 'Club Pro',
        price_bani: 59900,
        coach_limit: null,
      },
    ],
    error: null,
  }
  await expect(getSubscriptionPlans('CLUB')).resolves.toEqual([
    {
      code: 'CLUB_START',
      subscriberType: 'CLUB',
      name: 'Club Start',
      priceBani: 19900,
      coachLimit: 3,
    },
    {
      code: 'CLUB_PRO',
      subscriberType: 'CLUB',
      name: 'Club Pro',
      priceBani: 59900,
      coachLimit: null,
    },
  ])
  expect(calls).toContainEqual(['order', 'price_bani'])
})

test('settings map launch_at and trial lengths', async () => {
  result = { data: { launch_at: null, launch_trial_days: 90, signup_trial_days: 30 }, error: null }
  await expect(getSubscriptionSettings()).resolves.toEqual({
    launchAt: null,
    launchTrialDays: 90,
    signupTrialDays: 30,
  })
  result = { data: null, error: null }
  await expect(getSubscriptionSettings()).rejects.toThrow('Nu am putut încărca setările')
})
