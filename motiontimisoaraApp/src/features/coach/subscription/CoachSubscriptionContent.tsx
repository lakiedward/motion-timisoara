import { PageHeader } from '@/components/page-header/PageHeader'
import { CardPaymentsMonthCard } from '@/features/payments/CardPaymentsMonthCard'
import { PRICE_NOTE } from '@/features/public/pricing/pricing-content'
import { CheckoutReturnNotice } from '@/features/subscriptions/CheckoutReturnNotice'
import { SubscriptionStatusCard } from '@/features/subscriptions/SubscriptionStatusCard'
import { subscriptionQueryKey } from '@/features/subscriptions/use-subscription'
import { CoachPlanSection } from './CoachPlanSection'
import {
  ClubCoverNotice,
  CoachPortalButton,
  CoachSubscriptionError,
} from './CoachSubscriptionParts'
import type { CoachSubscriptionState } from './use-coach-subscription'

const RETURN_KEYS = [subscriptionQueryKey('COACH')]

export function CoachSubscriptionContent({ state }: { state: CoachSubscriptionState }) {
  const { view, planLabel } = state
  if (!view) return null
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <PageHeader title="Abonament" className="mb-1" />
        <p className="text-muted-foreground">
          Abonamentul ține profilul și ofertele tale vizibile pe Motion România.
        </p>
      </div>
      <CheckoutReturnNotice queryKeys={RETURN_KEYS} />
      <CoachSubscriptionError state={state} />
      <SubscriptionStatusCard view={view} plan={planLabel}>
        <CoachPortalButton state={state} />
      </SubscriptionStatusCard>
      <ClubCoverNotice state={state} />
      <CoachPlanSection state={state} />
      <p className="text-muted-foreground max-w-3xl text-sm">{PRICE_NOTE}</p>
      <CardPaymentsMonthCard
        enabled={state.stripeComplete}
        offersLabel="ofertele tale"
        netLabel="Primești tu"
      />
    </div>
  )
}
