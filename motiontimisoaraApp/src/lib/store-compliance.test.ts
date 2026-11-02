import { afterEach, describe, expect, it, vi } from 'vitest'

const platform = vi.hoisted(() => ({ native: false }))

vi.mock('@/lib/platform', () => ({ isNative: () => platform.native }))

import {
  NATIVE_BUILD,
  SUBSCRIPTION_HIDDEN_NOTICE,
  subscriptionSalesAllowed,
  webOnly,
} from '@/lib/store-compliance'

afterEach(() => {
  platform.native = false
})

describe('store compliance', () => {
  it('allows subscription sales in the web build on the web', () => {
    expect(NATIVE_BUILD).toBe(false)
    expect(subscriptionSalesAllowed()).toBe(true)
    expect(webOnly([{ path: '/preturi' }])).toEqual([{ path: '/preturi' }])
  })

  it('hides subscription sales when a web build runs inside the native shell', () => {
    platform.native = true
    expect(subscriptionSalesAllowed()).toBe(false)
    expect(webOnly([{ path: '/preturi' }])).toEqual([])
  })

  it('keeps the native notice free of prices, links and payment instructions', () => {
    expect(SUBSCRIPTION_HIDDEN_NOTICE).not.toMatch(/lei|abonament|plăt|http|\//i)
  })
})
