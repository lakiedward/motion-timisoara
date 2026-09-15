import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { isNative, platform } from './platform'

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

export const stripePromise: Promise<Stripe | null> =
  key && !(isNative() && platform() === 'android') ? loadStripe(key) : Promise.resolve(null)

export const stripeConfigured = Boolean(key)
