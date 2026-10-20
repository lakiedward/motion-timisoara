import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startStripeCheckout } from './checkout-session'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@/api/checkout', () => ({ invokeCheckoutFunction: invoke }))

beforeEach(() => invoke.mockReset())

describe('Stripe Checkout start', () => {
  it('asks for one session for the whole order and sends the parent to Stripe', async () => {
    invoke.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })
    const go = vi.fn()
    expect(await startStripeCheckout(['a', 'b', 'a'], go)).toBe('redirected')
    expect(invoke).toHaveBeenCalledWith('create-checkout-session', { enrollmentIds: ['a', 'b'] })
    expect(go).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1')
  })

  it('does not redirect when the order is already paid', async () => {
    invoke.mockResolvedValue({ alreadyPaid: true })
    const go = vi.fn()
    expect(await startStripeCheckout(['a'], go)).toBe('paid')
    expect(go).not.toHaveBeenCalled()
  })

  it('refuses to redirect anywhere but Stripe Checkout', async () => {
    invoke.mockResolvedValue({ url: 'https://evil.example/pay' })
    const go = vi.fn()
    await expect(startStripeCheckout(['a'], go)).rejects.toThrow('nu a putut fi deschisă')
    expect(go).not.toHaveBeenCalled()
  })
})
