import { StripeOnboardingPanel } from '@/features/billing/StripeOnboardingPanel'

/** Also serves /stripe/onboarding/{complete,refresh} — the return URLs the
 *  stripe-connect Edge Function gives Stripe for coach accounts. */
export default function CoachStripePage() {
  return <StripeOnboardingPanel scope="coach" />
}
