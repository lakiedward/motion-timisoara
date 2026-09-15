import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePaymentAdapter } from './usePaymentAdapter'

const mocks = vi.hoisted(() => ({
  native: true,
  platform: 'android',
  configured: true,
  supported: vi.fn(() => true),
  availability: vi.fn(),
  nativeConfirm: vi.fn(),
  webConfirm: vi.fn(),
  card: { id: 'web-card' },
  stripeLoaded: true,
  elementLoaded: true,
}))
vi.mock('@/lib/platform', () => ({ isNative: () => mocks.native, platform: () => mocks.platform }))
vi.mock('@/lib/stripe', () => ({
  get stripeConfigured() {
    return mocks.configured
  },
}))
vi.mock('@/api/payments/native', () => ({
  nativePaymentsSupported: mocks.supported,
  getNativePaymentAvailability: mocks.availability,
  confirmNativePayment: mocks.nativeConfirm,
}))
vi.mock('@stripe/react-stripe-js', () => ({
  CardElement: 'CardElement',
  useStripe: () => (mocks.stripeLoaded ? { confirmCardPayment: mocks.webConfirm } : null),
  useElements: () => ({ getElement: () => (mocks.elementLoaded ? mocks.card : null) }),
}))

const input = {
  clientSecret: 'payment-secret',
  billing: {
    name: 'Părinte Audit',
    email: 'audit@example.test',
    addressLine1: 'Strada Audit 1',
    city: 'Timișoara',
    postalCode: '300001',
  },
}

function renderAdapter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(usePaymentAdapter, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.native = true
  mocks.platform = 'android'
  mocks.configured = true
  mocks.stripeLoaded = true
  mocks.elementLoaded = true
  mocks.supported.mockReturnValue(true)
  mocks.availability.mockResolvedValue({ googlePay: false, testMode: true })
  mocks.nativeConfirm.mockResolvedValue('completed')
  mocks.webConfirm.mockResolvedValue({})
})

describe('payment platform adapters', () => {
  it('uses the Android test adapter even before web Stripe.js is available', async () => {
    mocks.stripeLoaded = false
    const { result } = renderAdapter()
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.adapter.testOnly).toBe(true)
    expect(await result.current.adapter.confirm(input)).toBe('completed')
    expect(mocks.nativeConfirm).toHaveBeenCalledExactlyOnceWith(input)
    expect(mocks.webConfirm).not.toHaveBeenCalled()
  })

  it('keeps native cancel distinct from success', async () => {
    mocks.nativeConfirm.mockResolvedValue('canceled')
    const { result } = renderAdapter()
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(await result.current.adapter.confirm(input)).toBe('canceled')
  })

  it('requires native availability and permits an explicit retry', async () => {
    mocks.availability
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ googlePay: true, testMode: true })
    const { result } = renderAdapter()
    await waitFor(() => expect(result.current.availability.isError).toBe(true))
    expect(result.current.ready).toBe(false)
    expect(mocks.nativeConfirm).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.availability.refetch()
    })
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(mocks.nativeConfirm).not.toHaveBeenCalled()
  })

  it('does not query the native bridge when the installed plugin is absent', () => {
    mocks.supported.mockReturnValue(false)
    const { result } = renderAdapter()
    expect(result.current.ready).toBe(false)
    expect(mocks.availability).not.toHaveBeenCalled()
  })

  it('retains web Stripe confirmation and saved billing without the native bridge', async () => {
    mocks.native = false
    mocks.platform = 'web'
    const { result } = renderAdapter()
    expect(result.current.ready).toBe(true)
    expect(result.current.adapter.testOnly).toBe(false)
    expect(await result.current.adapter.confirm(input)).toBe('completed')
    expect(mocks.webConfirm).toHaveBeenCalledWith('payment-secret', {
      payment_method: {
        card: mocks.card,
        billing_details: {
          name: input.billing.name,
          email: input.billing.email,
          address: {
            line1: input.billing.addressLine1,
            city: input.billing.city,
            postal_code: input.billing.postalCode,
            country: 'RO',
          },
        },
      },
    })
    expect(mocks.availability).not.toHaveBeenCalled()
    expect(mocks.nativeConfirm).not.toHaveBeenCalled()
  })

  it('fails web confirmation when card entry has not mounted', async () => {
    mocks.native = false
    mocks.platform = 'web'
    mocks.elementLoaded = false
    const { result } = renderAdapter()
    await expect(result.current.adapter.confirm(input)).rejects.toThrow(
      'Formularul de card nu s-a încărcat',
    )
    expect(mocks.webConfirm).not.toHaveBeenCalled()
  })
})
