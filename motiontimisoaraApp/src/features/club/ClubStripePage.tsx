import { StripeOnboardingPanel } from '@/features/billing/StripeOnboardingPanel'

/** Also serves /club/stripe/onboarding/{complete,refresh} — the return URLs the
 *  stripe-connect Edge Function gives Stripe for club accounts. */
export default function ClubStripePage() {
  return <StripeOnboardingPanel scope="club" />
}
