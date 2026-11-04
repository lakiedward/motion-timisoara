import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanFeatureList } from '@/features/public/pricing/PlanFeatureList'
import { COACH_PLAN, PRICE_NOTE } from '@/features/public/pricing/pricing-content'
import { CheckoutReturnNotice } from '@/features/subscriptions/CheckoutReturnNotice'
import { SubscriptionStatusCard } from '@/features/subscriptions/SubscriptionStatusCard'
import { subscriptionQueryKey } from '@/features/subscriptions/use-subscription'
import {
  ClubCoverNotice,
  CoachSubscriptionActions,
  CoachSubscriptionError,
} from './CoachSubscriptionParts'
import type { CoachSubscriptionState } from './use-coach-subscription'

export function CoachSubscriptionLayoutA({ state }: { state: CoachSubscriptionState }) {
  const { view, planLabel } = state
  if (!view) return null
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-foreground text-3xl font-extrabold">Abonament</h1>
        <p className="text-muted-foreground mt-1">
          Abonamentul tău de antrenor: starea lui, plata și facturile.
        </p>
      </div>
      <CheckoutReturnNotice queryKeys={[subscriptionQueryKey('COACH')]} />
      <CoachSubscriptionError state={state} />
      <SubscriptionStatusCard view={view} plan={planLabel}>
        <CoachSubscriptionActions state={state} />
      </SubscriptionStatusCard>
      <ClubCoverNotice state={state} />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Ce include abonamentul</CardTitle>
          <CardDescription>{PRICE_NOTE}</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanFeatureList items={COACH_PLAN.features} />
        </CardContent>
      </Card>
    </div>
  )
}
