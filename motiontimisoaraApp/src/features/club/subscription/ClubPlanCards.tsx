import type { SubscriptionPlan } from '@/api/subscriptions/subscriptions'
import { Card } from '@/components/ui/card'
import { PlanPrice } from '@/features/public/pricing/PlanFeatureList'
import { cn } from '@/lib/utils'
import { PlanActionButton, PlanBadge } from './PlanActionButton'
import { downgradeHint, planAction, type PlanContext } from './plan-actions'
import { PlanUsage } from './PlanUsage'
import type { ClubSubscriptionState } from './useClubSubscription'

export function ClubPlanCards({
  context,
  state,
}: {
  context: PlanContext
  state: ClubSubscriptionState
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {context.plans.map((plan: SubscriptionPlan) => {
        const action = planAction(plan, context)
        const hint = downgradeHint(action)
        return (
          <Card
            key={plan.code}
            data-plan={plan.code}
            data-action={action.kind}
            className={cn('gap-4 px-6', action.kind === 'current' && 'border-primary')}
          >
            <div className="flex min-h-6 items-center justify-between gap-2">
              <h3 className="font-display text-foreground text-xl font-bold">{plan.name}</h3>
              <PlanBadge action={action} />
            </div>
            <PlanPrice priceBani={plan.priceBani} />
            <PlanUsage coachCount={context.coachCount} coachLimit={plan.coachLimit} />
            <div className="mt-auto space-y-2 pt-2">
              <PlanActionButton plan={plan} action={action} state={state} className="w-full" />
              {hint && <p className="text-muted-foreground text-center text-xs">{hint}</p>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
