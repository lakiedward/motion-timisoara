import { invokeCheckoutFunction } from '@/api/checkout'

export type CheckoutSessionResult = { url: string } | { alreadyPaid: true }

export function createCheckoutSession(enrollmentIds: string[]): Promise<CheckoutSessionResult> {
  return invokeCheckoutFunction<CheckoutSessionResult>('create-checkout-session', {
    enrollmentIds: [...new Set(enrollmentIds)],
  })
}

export async function startStripeCheckout(
  enrollmentIds: string[],
  go: (url: string) => void = (url) => window.location.assign(url),
): Promise<'redirected' | 'paid'> {
  const result = await createCheckoutSession(enrollmentIds)
  if ('alreadyPaid' in result) return 'paid'
  if (!result.url?.startsWith('https://checkout.stripe.com/')) {
    throw new Error('Plata Stripe nu a putut fi deschisă. Reîncearcă.')
  }
  go(result.url)
  return 'redirected'
}
