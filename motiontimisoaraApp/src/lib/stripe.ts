const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

export const stripeConfigured = Boolean(key)
