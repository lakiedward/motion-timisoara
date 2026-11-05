import { beforeEach, expect, test, vi } from 'vitest'

import { extendSubscription, getAdminSubscriptions } from './admin-subscriptions'

let rpcResult: { data: unknown; error: unknown } = { data: [], error: null }
let invokeResult: { data: unknown; error: unknown } = { data: null, error: null }
const invoked: { name: string; body: unknown }[] = []
const rpcCalls: string[] = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: async (name: string) => {
      rpcCalls.push(name)
      return rpcResult
    },
    functions: {
      invoke: async (name: string, options: { body: unknown }) => {
        invoked.push({ name, body: options.body })
        return invokeResult
      },
    },
  },
}))

beforeEach(() => {
  rpcCalls.length = 0
  invoked.length = 0
})

test('lists subscriptions through the admin function and keeps the adjustment log', async () => {
  rpcResult = {
    data: [
      { id: 's1', status: 'trialing', adjustments: [{ id: 'a1', days: 7, reason: 'Test' }] },
      { id: 's2', status: 'active', adjustments: null },
    ],
    error: null,
  }
  const rows = await getAdminSubscriptions()
  expect(rpcCalls).toEqual(['get_admin_subscriptions'])
  expect(rows.map((row) => row.adjustments.length)).toEqual([1, 0])
})

test('a failed listing becomes a Romanian message', async () => {
  rpcResult = { data: null, error: { code: '42501', message: 'x' } }
  await expect(getAdminSubscriptions()).rejects.toThrow('Nu am putut încărca abonamentele.')
})

test('extending sends the subscription, days and reason to the server function', async () => {
  invokeResult = { data: { adjustmentId: 'a1', newEnd: '2026-12-01T00:00:00Z', stripeUpdated: true }, error: null }
  const result = await extendSubscription({ subscriptionId: 's1', days: 30, reason: 'Test' })
  expect(invoked).toEqual([
    { name: 'admin-extend-subscription', body: { subscriptionId: 's1', days: 30, reason: 'Test' } },
  ])
  expect(result.stripeUpdated).toBe(true)
})
