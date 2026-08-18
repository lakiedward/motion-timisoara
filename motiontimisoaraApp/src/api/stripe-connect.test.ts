import { beforeEach, expect, test, vi } from 'vitest'

import { startStripeOnboarding } from './stripe-connect'
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
