import { Card } from '@/components/ui/card'
import { formatPlanPrice } from '@/features/public/pricing/pricing-content'
import { cn } from '@/lib/utils'
import { PlanActionButton, PlanBadge } from './PlanActionButton'
import { downgradeHint, planAction, type PlanContext } from './plan-actions'
import { PlanUsage } from './PlanUsage'
import type { ClubSubscriptionState } from './useClubSubscription'

export function ClubPlanList({
  context,
  state,
}: {
  context: PlanContext
  state: ClubSubscriptionState
}) {
  return (
    <Card className="gap-0 py-0">
      <ul className="divide-border divide-y">
        {context.plans.map((plan) => {
          const action = planAction(plan, context)
          const hint = downgradeHint(action)
          return (
            <li
              key={plan.code}
              data-plan={plan.code}
              data-action={action.kind}
              className={cn(
                'grid gap-3 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
                action.kind === 'current' && 'bg-primary/6',
              )}
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-foreground font-semibold">{plan.name}</p>
                  <PlanBadge action={action} />
                </div>
                <PlanUsage
                  coachCount={context.coachCount}
                  coachLimit={plan.coachLimit}
                  className="max-w-xs"
                />
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <p className="whitespace-nowrap sm:text-right">
                  <span className="font-display text-foreground text-2xl font-extrabold">
                    {formatPlanPrice(plan.priceBani)}
                  </span>{' '}
                  <span className="text-muted-foreground text-sm">lei / lună</span>
                </p>
                <PlanActionButton
                  plan={plan}
                  action={action}
                  state={state}
                  className="sm:min-w-44"
                />
                {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
