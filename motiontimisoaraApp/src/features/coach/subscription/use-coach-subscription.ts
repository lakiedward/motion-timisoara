import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/lib/auth-context'
import { formatPlanPrice } from '@/features/public/pricing/pricing-content'
import {
  canStartCheckout,
  hasLiveStripeSubscription,
} from '@/features/subscriptions/subscription-state'
import { useBillingRedirect, useSubscription } from '@/features/subscriptions/use-subscription'
import { COACH_CLUB_COVER_QUERY_KEY, getCoachClubCover } from './coach-club-cover'

export function useCoachSubscription() {
  const { user } = useAuth()
  const isCoach = user?.role === 'COACH'
  const data = useSubscription('COACH')
  const cover = useQuery({
    queryKey: COACH_CLUB_COVER_QUERY_KEY,
    queryFn: getCoachClubCover,
    enabled: isCoach,
    retry: false,
  })
  const billing = useBillingRedirect()

  const subscription = data.subscription.data ?? null
  const plans = data.plans.data ?? []
  const plan = plans.find((p) => p.code === (subscription?.planCode ?? 'COACH')) ?? plans[0] ?? null
  const view = data.view
  const launched = Boolean(data.settings.data?.launchAt)
  const coveringClubs = view && launched ? (cover.data ?? []) : []

  return {
    isCoach,
    data,
    view,
    plan,
    planLabel: plan ? { name: plan.name, priceLei: formatPlanPrice(plan.priceBani) } : null,
    coveringClubs,
    coverSettled: cover.isSuccess || cover.isError,
    billing,
    checkoutAllowed: Boolean(view && plan && canStartCheckout(view, subscription)),
    manageAllowed: Boolean(
      view && view.kind !== 'launch_pending' && hasLiveStripeSubscription(view, subscription),
    ),
  }
}

export type CoachSubscriptionState = ReturnType<typeof useCoachSubscription>
