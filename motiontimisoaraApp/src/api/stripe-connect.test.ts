import { beforeEach, expect, test, vi } from 'vitest'

import { isStripeUnavailable, startStripeOnboarding } from './stripe-connect'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  invoke.mockReset()
})

test('startStripeOnboarding creates the account then returns the onboarding URL', async () => {
  invoke
    .mockResolvedValueOnce({ data: { accountId: 'acct_1' }, error: null })
    .mockResolvedValueOnce({ data: { url: 'https://connect.stripe.com/setup' }, error: null })

  await expect(startStripeOnboarding()).resolves.toBe('https://connect.stripe.com/setup')
  expect(invoke).toHaveBeenNthCalledWith(1, 'stripe-connect', { body: { action: 'create-account' } })
  expect(invoke).toHaveBeenNthCalledWith(2, 'stripe-connect', {
    body: { action: 'onboarding-link' },
  })
})

test('startStripeOnboarding surfaces the Edge Function error text', async () => {
  invoke.mockResolvedValueOnce({
    data: { error: 'Club not found' },
    error: { message: 'Edge Function returned a non-2xx status code' },
  } as never)

  await expect(startStripeOnboarding()).rejects.toThrow('Club not found')
})

test('a missing STRIPE_SECRET_KEY reads as unavailable, not as a failure', async () => {
  invoke.mockResolvedValueOnce({
    data: { error: 'Plățile cu cardul nu sunt încă activate pe platformă.', code: 'stripe_not_configured' },
    error: { message: 'Edge Function returned a non-2xx status code' },
  } as never)

  await expect(startStripeOnboarding()).rejects.toSatisfy(
    (err: unknown) => isStripeUnavailable(err) && err.reason === 'not_configured',
  )
})

test('an undeployed function reads as unavailable rather than a raw transport error', async () => {
  invoke.mockResolvedValueOnce({
    data: null,
    error: { message: 'Failed to send a request to the Edge Function' },
  } as never)

  await expect(startStripeOnboarding()).rejects.toSatisfy(
    (err: unknown) => isStripeUnavailable(err) && err.reason === 'unreachable',
  )
})

test('a 404 from the platform still reads as unavailable', async () => {
  invoke.mockResolvedValueOnce({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { status: 404, json: async () => ({}) },
    },
  } as never)

  await expect(startStripeOnboarding()).rejects.toSatisfy(
    (err: unknown) => isStripeUnavailable(err) && err.reason === 'unreachable',
  )
})
