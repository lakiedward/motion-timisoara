import { beforeEach, expect, test, vi } from 'vitest'

import { getCardPaymentsMonth } from './card-payments-month'

let response: { data: unknown; error: unknown } = { data: [], error: null }
const calls: string[] = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (name: string) => {
      calls.push(name)
      return response
    },
  },
}))

beforeEach(() => {
  calls.length = 0
})

test('reads the month summary through the RPC and maps it to camelCase', async () => {
  response = {
    data: [
      {
        month_start: '2026-11-01',
        collected: 80000,
        stripe_fee: 2495,
        net: 77505,
        payment_count: 2,
        unsettled_count: 1,
      },
    ],
    error: null,
  }
  await expect(getCardPaymentsMonth()).resolves.toEqual({
    monthStart: '2026-11-01',
    collected: 80000,
    stripeFee: 2495,
    net: 77505,
    paymentCount: 2,
    unsettledCount: 1,
  })
  expect(calls).toEqual(['get_card_payments_month'])
})

test('a refused or empty read becomes a Romanian error', async () => {
  response = { data: null, error: { message: 'Nu ai acces la plățile online' } }
  await expect(getCardPaymentsMonth()).rejects.toThrow('Nu am putut încărca plățile online.')
  response = { data: [], error: null }
  await expect(getCardPaymentsMonth()).rejects.toThrow('Nu am putut încărca plățile online.')
})
