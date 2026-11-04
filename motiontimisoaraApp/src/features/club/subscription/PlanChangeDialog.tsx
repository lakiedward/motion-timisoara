import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatPlanPrice } from '@/features/public/pricing/pricing-content'
import { formatShortDate } from '@/lib/panel-date'
import type { SubscriptionView } from '@/features/subscriptions/subscription-state'
import type { ClubSubscriptionState } from './useClubSubscription'

function periodEnd(view: SubscriptionView | null): string | null {
  if (view?.kind === 'active') return view.nextChargeAt
  if (view?.kind === 'trialing') return view.endsAt
  return null
}

export function PlanChangeDialog({ state }: { state: ClubSubscriptionState }) {
  const { pending, setPending, change, data } = state
  const view = data.view
  const end = periodEnd(view)
  const date = end ? formatShortDate(end) : 'luna viitoare'
  const plan = pending?.plan
  const price = plan ? `${formatPlanPrice(plan.priceBani)} lei pe lună` : ''
  const limit =
    plan?.coachLimit === null || plan?.coachLimit === undefined
      ? 'antrenori nelimitați'
      : `cel mult ${plan.coachLimit} antrenori`
  const inTrial = view?.kind === 'trialing'

  const upgrade = pending?.direction === 'upgrade'
  const title = plan
    ? upgrade
      ? `Treci la ${plan.name} acum?`
      : `Treci la ${plan.name} de la ${date}?`
    : ''
  const description = upgrade
    ? inTrial
      ? `Schimbarea e imediată și nu plătești nimic acum. Prima plată, ${price}, este pe ${date}.`
      : `Schimbarea e imediată. Plătești acum, cu cardul salvat, doar diferența pentru zilele rămase din lună. De la ${date} plătești ${price}.`
    : `Până pe ${date} rămâi pe pachetul actual. Apoi plătești ${price} și clubul poate avea ${limit}.`

  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={title}
      description={description}
      confirmLabel={upgrade ? 'Treci acum' : 'Programează schimbarea'}
      pending={change.isPending}
      onConfirm={() => plan && change.mutate(plan.code)}
    />
  )
}
