import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  getMySubscription,
  getSubscriptionPlans,
  getSubscriptionSettings,
  SUBSCRIPTION_PLANS_QUERY_KEY,
  SUBSCRIPTION_QUERY_KEY,
  SUBSCRIPTION_SETTINGS_QUERY_KEY,
  type SubscriberType,
} from '@/api/subscriptions/subscriptions'
import { openBillingPortal, startSubscriptionCheckout } from '@/api/subscriptions/billing'
import { describeSubscription } from './subscription-state'

export function subscriptionQueryKey(type: SubscriberType) {
  return [...SUBSCRIPTION_QUERY_KEY, type] as const
}

export function useSubscription(type: SubscriberType) {
  const subscription = useQuery({
    queryKey: subscriptionQueryKey(type),
    queryFn: () => getMySubscription(type),
  })
  const settings = useQuery({
    queryKey: SUBSCRIPTION_SETTINGS_QUERY_KEY,
    queryFn: getSubscriptionSettings,
    staleTime: 5 * 60_000,
  })
  const plans = useQuery({
    queryKey: [...SUBSCRIPTION_PLANS_QUERY_KEY, type],
    queryFn: () => getSubscriptionPlans(type),
    staleTime: 5 * 60_000,
  })
  const [now] = useState(() => Date.now())
  const view =
    subscription.isSuccess && settings.isSuccess
      ? describeSubscription(subscription.data, settings.data, now)
      : null
  return {
    subscription,
    settings,
    plans,
    view,
    isLoading: subscription.isLoading || settings.isLoading || plans.isLoading,
    isError: subscription.isError || settings.isError || plans.isError,
    isFetching: subscription.isFetching || settings.isFetching || plans.isFetching,
    refetch: () =>
      Promise.all([subscription.refetch(), settings.refetch(), plans.refetch()]).then(
        () => undefined,
      ),
  }
}

export type BillingRedirect = 'checkout' | 'portal'

export function useBillingRedirect() {
  const [busy, setBusy] = useState<{ kind: BillingRedirect; planCode: string | null } | null>(null)
  const [error, setError] = useState<Error | null>(null)

  async function go(kind: BillingRedirect, planCode: string | null) {
    setBusy({ kind, planCode })
    setError(null)
    try {
      const url =
        kind === 'checkout' && planCode
          ? await startSubscriptionCheckout(planCode)
          : await openBillingPortal()
      window.location.assign(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(String(caught)))
      setBusy(null)
    }
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    checkout: (planCode: string) => go('checkout', planCode),
    portal: () => go('portal', null),
  }
}
