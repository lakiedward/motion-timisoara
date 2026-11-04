import { supabase } from '@/lib/supabase'

export type SubscriberType = 'COACH' | 'CLUB'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export type Subscription = {
  id: string
  subscriberType: SubscriberType
  planCode: string | null
  scheduledPlanCode: string | null
  status: SubscriptionStatus
  trialEnd: string | null
  currentPeriodEnd: string | null
  pastDueSince: string | null
  cancelAtPeriodEnd: boolean
  hasStripeCustomer: boolean
  hasStripeSubscription: boolean
}

export type SubscriptionPlan = {
  code: string
  subscriberType: SubscriberType
  name: string
  priceBani: number
  coachLimit: number | null
}

export type SubscriptionSettings = {
  launchAt: string | null
  launchTrialDays: number
  signupTrialDays: number
}

export const SUBSCRIPTION_QUERY_KEY = ['my-subscription'] as const
export const SUBSCRIPTION_PLANS_QUERY_KEY = ['subscription-plans'] as const
export const SUBSCRIPTION_SETTINGS_QUERY_KEY = ['subscription-settings'] as const

const STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
]

const SUBSCRIPTION_COLUMNS =
  'id,subscriber_type,plan_code,scheduled_plan_code,status,trial_end,current_period_end,past_due_since,cancel_at_period_end,stripe_customer_id,stripe_subscription_id'

export async function getMySubscription(type: SubscriberType): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('subscriber_type', type)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('Nu am putut încărca abonamentul.', { cause: error })
  if (!data) return null
  const status = STATUSES.includes(data.status as SubscriptionStatus)
    ? (data.status as SubscriptionStatus)
    : 'expired'
  return {
    id: data.id,
    subscriberType: data.subscriber_type as SubscriberType,
    planCode: data.plan_code,
    scheduledPlanCode: data.scheduled_plan_code,
    status,
    trialEnd: data.trial_end,
    currentPeriodEnd: data.current_period_end,
    pastDueSince: data.past_due_since,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    hasStripeCustomer: Boolean(data.stripe_customer_id),
    hasStripeSubscription: Boolean(data.stripe_subscription_id),
  }
}

export async function getSubscriptionPlans(type: SubscriberType): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('code,subscriber_type,name,price_bani,coach_limit')
    .eq('subscriber_type', type)
    .eq('active', true)
    .order('price_bani')
  if (error) throw new Error('Nu am putut încărca pachetele.', { cause: error })
  return (data ?? []).map((row) => ({
    code: row.code,
    subscriberType: row.subscriber_type as SubscriberType,
    name: row.name,
    priceBani: row.price_bani,
    coachLimit: row.coach_limit,
  }))
}

export async function getSubscriptionSettings(): Promise<SubscriptionSettings> {
  const { data, error } = await supabase
    .from('subscription_settings')
    .select('launch_at,launch_trial_days,signup_trial_days')
    .limit(1)
    .maybeSingle()
  if (error || !data) {
    throw new Error('Nu am putut încărca setările abonamentelor.', { cause: error ?? undefined })
  }
  return {
    launchAt: data.launch_at,
    launchTrialDays: data.launch_trial_days,
    signupTrialDays: data.signup_trial_days,
  }
}
