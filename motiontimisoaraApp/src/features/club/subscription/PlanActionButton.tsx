import { Link } from 'react-router-dom'

import type { SubscriptionPlan } from '@/api/subscriptions/subscriptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatShortDate } from '@/lib/panel-date'
import { cn } from '@/lib/utils'
import type { PlanAction } from './plan-actions'
import type { ClubSubscriptionState } from './useClubSubscription'

export function PlanBadge({ action }: { action: PlanAction }) {
  if (action.kind === 'current') return <Badge variant="success">Pachetul tău</Badge>
  if (action.kind === 'scheduled') {
    return (
      <Badge variant="highlight">
        {action.effectiveAt ? `De la ${formatShortDate(action.effectiveAt)}` : 'Luna viitoare'}
      </Badge>
    )
  }
  return null
}

export function PlanActionButton({
  plan,
  action,
  state,
  className,
}: {
  plan: SubscriptionPlan
  action: PlanAction
  state: ClubSubscriptionState
  className?: string
}) {
  const { redirect, change, setPending, busy } = state
  const working = (redirect.busy?.planCode === plan.code || change.variables === plan.code) && busy
  const size = 'h-touch-target min-h-touch-target'
  switch (action.kind) {
    case 'checkout':
      return (
        <Button
          type="button"
          className={cn(size, className)}
          disabled={busy}
          onClick={() => void redirect.checkout(plan.code)}
          data-testid={`plan-action-${plan.code}`}
        >
          {working ? 'Se deschide plata…' : `Alege ${plan.name}`}
        </Button>
      )
    case 'upgrade':
      return (
        <Button
          type="button"
          className={cn(size, className)}
          disabled={busy}
          onClick={() => setPending({ plan, direction: 'upgrade' })}
          data-testid={`plan-action-${plan.code}`}
        >
          Treci la {plan.name}
        </Button>
      )
    case 'downgrade':
      return (
        <Button
          type="button"
          variant="outline"
          className={cn(size, className)}
          disabled={busy}
          onClick={() => setPending({ plan, direction: 'downgrade' })}
          data-testid={`plan-action-${plan.code}`}
        >
          Treci la {plan.name}
        </Button>
      )
    case 'current':
      return action.keepScheduled ? (
        <Button
          type="button"
          variant="outline"
          className={cn(size, className)}
          disabled={busy}
          onClick={() => change.mutate(plan.code)}
          data-testid={`plan-action-${plan.code}`}
        >
          {working ? 'Se salvează…' : `Păstrează ${plan.name}`}
        </Button>
      ) : null
    case 'blocked':
      return (
        <p
          className={cn('text-muted-foreground text-sm', className)}
          data-testid={`plan-blocked-${plan.code}`}
        >
          {action.coachesToRemove === 1
            ? 'Clubul are un antrenor peste limită.'
            : `Clubul are ${action.coachesToRemove} antrenori peste limită.`}{' '}
          <Link
            to="/club/coaches"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Vezi antrenorii
          </Link>
        </p>
      )
    default:
      return null
  }
}
