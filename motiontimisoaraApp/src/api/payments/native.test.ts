import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmNativePayment,
  getNativePaymentAvailability,
  nativePaymentsSupported,
  onNativePaymentResult,
} from './native'

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
  isPluginAvailable: vi.fn(),
  availability: vi.fn(),
  confirm: vi.fn(),
  addListener: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: mocks,
  registerPlugin: () => mocks,
}))

const billing = {
  name: 'Părinte Audit',
  email: 'audit@example.test',
  addressLine1: 'Strada Test 1',
  city: 'Timișoara',
  postalCode: '300001',
}
const request = { clientSecret: 'pi_audit_secret_test', billing }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_audit')
  mocks.isNativePlatform.mockReturnValue(true)
  mocks.getPlatform.mockReturnValue('android')
  mocks.isPluginAvailable.mockReturnValue(true)
})

afterEach(() => vi.unstubAllEnvs())

describe('native Android payment boundary', () => {
  it('requires Android and the registered bridge', () => {
    expect(nativePaymentsSupported()).toBe(true)
    mocks.isPluginAvailable.mockReturnValue(false)
    expect(nativePaymentsSupported()).toBe(false)
    mocks.isPluginAvailable.mockReturnValue(true)
    mocks.getPlatform.mockReturnValue('ios')
    expect(nativePaymentsSupported()).toBe(false)
    mocks.getPlatform.mockReturnValue('web')
    mocks.isNativePlatform.mockReturnValue(false)
    expect(nativePaymentsSupported()).toBe(false)
  })

  it('rejects live configuration before invoking the native SDK', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_live_forbidden')
    await expect(confirmNativePayment(request)).rejects.toThrow('numai în modul de test')
    await expect(getNativePaymentAvailability()).rejects.toThrow('numai în modul de test')
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.availability).not.toHaveBeenCalled()
  })

  it('preserves card availability when Google Pay is unavailable', async () => {
    mocks.availability.mockResolvedValue({ googlePay: false, testMode: true })
    await expect(getNativePaymentAvailability()).resolves.toEqual({
      googlePay: false,
      testMode: true,
    })
  })

  it('passes billing and the existing intent to the SDK without changing cancellation to success', async () => {
    mocks.confirm.mockResolvedValue({ status: 'canceled' })
    await expect(confirmNativePayment(request)).resolves.toBe('canceled')
    expect(mocks.confirm).toHaveBeenCalledWith({ ...request, publishableKey: 'pk_test_audit' })
    mocks.confirm.mockResolvedValue({ status: 'completed' })
    await expect(confirmNativePayment(request)).resolves.toBe('completed')
  })

  it('never exposes SDK failure details or accepts an unknown result', async () => {
    mocks.confirm.mockRejectedValue(new Error('sensitive gateway detail'))
    await expect(confirmNativePayment(request)).rejects.toThrow('Verifică înscrierea')
    mocks.confirm.mockResolvedValue({ status: 'processing' })
    await expect(confirmNativePayment(request)).rejects.toThrow('Verifică înscrierea')
  })

  it('rejects malformed intents before opening a sheet', async () => {
    await expect(confirmNativePayment({ ...request, clientSecret: 'invalid' })).rejects.toThrow(
      'nu sunt valide',
    )
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('subscribes to recovery only and never confirms a payment in response', async () => {
    const listener = vi.fn()
    const handle = { remove: vi.fn() }
    mocks.addListener.mockResolvedValue(handle)
    await expect(onNativePaymentResult(listener)).resolves.toBe(handle)
    expect(mocks.addListener).toHaveBeenCalledWith('paymentResult', listener)
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
})
