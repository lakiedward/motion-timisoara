import { loadStripe, type Stripe } from '@stripe/stripe-js'

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

/**
 * Lazily loaded Stripe singleton. Resolves to null when no publishable key is
 * configured so the checkout can degrade to cash-only instead of crashing on
 * a dev machine without Stripe credentials.
 */
export const stripePromise: Promise<Stripe | null> = key
  ? loadStripe(key)
  : Promise.resolve(null)

export const stripeConfigured = Boolean(key)
