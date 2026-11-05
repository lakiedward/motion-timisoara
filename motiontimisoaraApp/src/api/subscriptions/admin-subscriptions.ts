import { invokeCheckoutFunction } from '@/api/checkout'
import { supabase } from '@/lib/supabase'
import type { SubscriberType, SubscriptionStatus } from './subscriptions'

export const ADMIN_SUBSCRIPTIONS_QUERY_KEY = ['admin-subscriptions'] as const

export type AdminSubscriptionAdjustment = {
  id: string
  days: number
  reason: string
  admin_name: string | null
  created_at: string
}

export type AdminSubscription = {
  id: string
  subscriber_type: SubscriberType
  subscriber_name: string
  subscriber_email: string | null
  plan_code: string | null
  plan_name: string | null
  price_bani: number | null
  scheduled_plan_name: string | null
  status: SubscriptionStatus
  trial_end: string | null
  current_period_end: string | null
  access_end: string | null
  cancel_at_period_end: boolean
  has_stripe_subscription: boolean
  coach_count: number | null
  created_at: string
  adjustments: AdminSubscriptionAdjustment[]
}

export async function getAdminSubscriptions(): Promise<AdminSubscription[]> {
  const { data, error } = await supabase.rpc('get_admin_subscriptions')
  if (error) throw new Error('Nu am putut încărca abonamentele.', { cause: error })
  return (data ?? []).map((row) => ({
    ...row,
    adjustments: Array.isArray(row.adjustments)
      ? (row.adjustments as AdminSubscriptionAdjustment[])
      : [],
  })) as AdminSubscription[]
}

export type ExtendSubscriptionInput = {
  subscriptionId: string
  days: number
  reason: string
}

export type ExtendSubscriptionResult = {
  adjustmentId: string
  newEnd: string
  stripeUpdated: boolean
}

export async function extendSubscription(
  input: ExtendSubscriptionInput,
): Promise<ExtendSubscriptionResult> {
  return invokeCheckoutFunction<ExtendSubscriptionResult>('admin-extend-subscription', input)
}
