import { beforeEach, expect, test, vi } from 'vitest'

import {
  changeSubscriptionPlan,
  openBillingPortal,
  startSubscriptionCheckout,
  SubscriptionBillingError,
} from './billing'

type Invoke = { data: unknown; error: unknown }
let response: Invoke = { data: null, error: null }
const calls: { name: string; body: unknown }[] = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        calls.push({ name, body: options.body })
        return response
      },
    },
  },
}))

function httpError(status: number, body: unknown) {
  return { context: new Response(JSON.stringify(body), { status }) }
}

beforeEach(() => {
  calls.length = 0
})

test('checkout and portal call their functions and return the Stripe URL', async () => {
  response = { data: { url: 'https://checkout.stripe.com/c/pay/cs_test' }, error: null }
  await expect(startSubscriptionCheckout('CLUB')).resolves.toBe(
    'https://checkout.stripe.com/c/pay/cs_test',
  )
  response = { data: { url: 'https://billing.stripe.com/p/session/x' }, error: null }
  await expect(openBillingPortal()).resolves.toBe('https://billing.stripe.com/p/session/x')
  expect(calls).toEqual([
    { name: 'create-subscription-checkout', body: { planCode: 'CLUB' } },
    { name: 'billing-portal', body: {} },
  ])
})

test('a refusal keeps the server code, message and coach numbers', async () => {
  response = {
    data: null,
    error: httpError(409, {
      code: 'PLAN_BELOW_COACH_COUNT',
      error: 'Clubul are mai mulți antrenori decât permite planul ales.',
      coachCount: 5,
      coachLimit: 3,
      coachesToRemove: 2,
    }),
  }
  const error = await startSubscriptionCheckout('CLUB_START').catch((caught) => caught)
  expect(error).toBeInstanceOf(SubscriptionBillingError)
  expect(error.code).toBe('PLAN_BELOW_COACH_COUNT')
  expect(error.message).toBe('Clubul are mai mulți antrenori decât permite planul ales.')
  expect(error.details).toEqual({ coachCount: 5, coachLimit: 3, coachesToRemove: 2 })
})

test('no response at all reads as an unreachable service', async () => {
  response = { data: null, error: new Error('Failed to fetch') }
  await expect(openBillingPortal()).rejects.toThrow('Serviciul de plăți nu răspunde deocamdată.')
})

test('a non-https URL is refused', async () => {
  response = { data: { url: 'javascript:alert(1)' }, error: null }
  await expect(startSubscriptionCheckout('CLUB')).rejects.toThrow('Nu am putut deschide plata.')
})

test('a plan change returns the result and the date it takes effect', async () => {
  response = {
    data: { result: 'scheduled', planCode: 'CLUB_START', effectiveAt: '2026-12-02T10:00:00.000Z' },
    error: null,
  }
  await expect(changeSubscriptionPlan('CLUB_START')).resolves.toEqual({
    result: 'scheduled',
    planCode: 'CLUB_START',
    effectiveAt: '2026-12-02T10:00:00.000Z',
  })
  expect(calls.at(-1)).toEqual({
    name: 'change-subscription-plan',
    body: { planCode: 'CLUB_START' },
  })
  response = { data: { result: 'weird' }, error: null }
  await expect(changeSubscriptionPlan('CLUB')).rejects.toThrow('Nu am putut schimba pachetul.')
})
