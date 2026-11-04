import { CircleCheck, Clock, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PlanFeatureList, PlanPrice } from '@/features/public/pricing/PlanFeatureList'
import { COACH_PLAN, PRICE_NOTE } from '@/features/public/pricing/pricing-content'
import { CheckoutReturnNotice } from '@/features/subscriptions/CheckoutReturnNotice'
import { subscriptionCopy } from '@/features/subscriptions/subscription-copy'
import type { SubscriptionView } from '@/features/subscriptions/subscription-state'
import { subscriptionQueryKey } from '@/features/subscriptions/use-subscription'
import {
  ClubCoverNotice,
  CoachSubscriptionActions,
  CoachSubscriptionError,
} from './CoachSubscriptionParts'
import type { CoachSubscriptionState } from './use-coach-subscription'

function HeroFigure({ view }: { view: SubscriptionView }) {
  if (view.kind === 'trialing' && !view.paid) {
    return (
      <p className="flex items-baseline gap-2">
        <span className="font-display text-primary text-6xl font-extrabold">{view.daysLeft}</span>
        <span className="text-muted-foreground text-sm font-medium">
          {view.daysLeft === 1 ? 'zi gratuită rămasă' : 'zile gratuite rămase'}
        </span>
      </p>
    )
  }
  const Icon =
    view.kind === 'past_due' || view.kind === 'expired'
      ? TriangleAlert
      : view.kind === 'missing' || view.kind === 'launch_pending'
        ? Clock
        : CircleCheck
  const alert = view.kind === 'past_due' || view.kind === 'expired'
  return (
    <span
      className={cn(
        'grid size-14 place-items-center rounded-xl',
        alert ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
      )}
    >
      <Icon aria-hidden="true" className="size-7" />
    </span>
  )
}

export function CoachSubscriptionLayoutB({ state }: { state: CoachSubscriptionState }) {
  const { view, planLabel } = state
  if (!view) return null
  const copy = subscriptionCopy(view, planLabel)
  const counting = view.kind === 'trialing' && !view.paid
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-foreground text-3xl font-extrabold">Abonament</h1>
        <p className="text-muted-foreground mt-1">
          Abonamentul tău de antrenor: starea lui, plata și facturile.
        </p>
      </div>
      <CheckoutReturnNotice queryKeys={[subscriptionQueryKey('COACH')]} />
      <CoachSubscriptionError state={state} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="gap-5 px-6" data-testid="subscription-status" data-state={view.kind}>
          <HeroFigure view={view} />
          <div className="space-y-2">
            <Badge variant={copy.tone}>{copy.badge}</Badge>
            <h2 className="font-display text-foreground text-xl font-bold">
              {counting ? 'Perioada ta gratuită' : copy.title}
            </h2>
            <p className="text-muted-foreground text-sm">{copy.detail}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CoachSubscriptionActions state={state} />
          </div>
        </Card>
        <Card className="gap-5 px-6">
          <div className="space-y-1">
            <h2 className="font-display text-foreground text-lg font-bold">{COACH_PLAN.name}</h2>
            <p className="text-muted-foreground text-sm">{COACH_PLAN.audience}</p>
          </div>
          <PlanPrice priceBani={state.plan?.priceBani ?? COACH_PLAN.priceBani} />
          <PlanFeatureList items={COACH_PLAN.features} />
          <p className="text-muted-foreground border-t pt-4 text-xs">{PRICE_NOTE}</p>
        </Card>
      </div>
      <ClubCoverNotice state={state} />
    </div>
  )
}
