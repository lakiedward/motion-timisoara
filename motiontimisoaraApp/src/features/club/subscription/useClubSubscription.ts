import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getClubCoaches, getMyClub } from '@/api/club'
import { changeSubscriptionPlan, type PlanChangeResult } from '@/api/subscriptions/billing'
import type { SubscriptionPlan } from '@/api/subscriptions/subscriptions'
import { formatShortDate } from '@/lib/panel-date'
import {
  subscriptionQueryKey,
  useBillingRedirect,
  useSubscription,
} from '@/features/subscriptions/use-subscription'
import type { PlanContext } from './plan-actions'

export type PendingChange = { plan: SubscriptionPlan; direction: 'upgrade' | 'downgrade' }

function successMessage(result: PlanChangeResult, plans: SubscriptionPlan[]): string {
  const name = plans.find((plan) => plan.code === result.planCode)?.name ?? result.planCode
  if (result.result === 'upgraded') return `Ai trecut la ${name}.`
  if (result.result === 'scheduled') {
    return result.effectiveAt
      ? `${name} începe pe ${formatShortDate(result.effectiveAt)}.`
      : `${name} începe de luna viitoare.`
  }
  return `Rămâi pe ${name}.`
}

export function useClubSubscription() {
  const queryClient = useQueryClient()
  const club = useQuery({ queryKey: ['my-club'], queryFn: getMyClub, retry: false })
  const clubId = club.data?.id
  const coaches = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: () => getClubCoaches(clubId!),
    enabled: !!clubId,
  })
  const data = useSubscription('CLUB')
  const redirect = useBillingRedirect()
  const [pending, setPending] = useState<PendingChange | null>(null)
  const plans = data.plans.data ?? []

  const change = useMutation({
    mutationFn: (planCode: string) => changeSubscriptionPlan(planCode),
    onSuccess: async (result) => {
      setPending(null)
      toast.success(successMessage(result, plans))
      await queryClient.invalidateQueries({ queryKey: subscriptionQueryKey('CLUB') })
    },
    onError: () => setPending(null),
  })

  const context: PlanContext | null =
    data.view && coaches.isSuccess && data.plans.isSuccess
      ? {
          view: data.view,
          subscription: data.subscription.data ?? null,
          plans,
          coachCount: coaches.data.length,
        }
      : null

  return {
    club,
    coaches,
    data,
    context,
    redirect,
    pending,
    setPending,
    change,
    isLoading: club.isLoading || coaches.isLoading || data.isLoading,
    isError: club.isError || coaches.isError || data.isError,
    isFetching: club.isFetching || coaches.isFetching || data.isFetching,
    refetch: () =>
      Promise.all([club.refetch(), coaches.refetch(), data.refetch()]).then(() => undefined),
    busy: redirect.busy !== null || change.isPending,
  }
}

export type ClubSubscriptionState = ReturnType<typeof useClubSubscription>
