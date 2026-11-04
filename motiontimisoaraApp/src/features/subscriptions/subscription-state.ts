import type { Subscription, SubscriptionSettings } from '@/api/subscriptions/subscriptions'

const DAY_MS = 86_400_000
const PAST_DUE_GRACE_DAYS = 7

export type SubscriptionView =
  | { kind: 'missing' }
  | { kind: 'launch_pending'; launchTrialDays: number }
  | { kind: 'trialing'; endsAt: string; daysLeft: number; paid: boolean }
  | { kind: 'active'; nextChargeAt: string | null }
  | { kind: 'past_due'; graceEndsAt: string | null }
  | { kind: 'canceled'; endsAt: string | null }
  | { kind: 'expired' }

export function effectiveTrialEnd(
  subscription: Pick<Subscription, 'trialEnd'>,
  settings: Pick<SubscriptionSettings, 'launchAt' | 'launchTrialDays'>,
): string | null {
  if (subscription.trialEnd) return subscription.trialEnd
  if (!settings.launchAt) return null
  return new Date(Date.parse(settings.launchAt) + settings.launchTrialDays * DAY_MS).toISOString()
}

export function daysLeft(endsAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / DAY_MS))
}

function addDays(value: string, days: number): string {
  return new Date(Date.parse(value) + days * DAY_MS).toISOString()
}

export function describeSubscription(
  subscription: Subscription | null,
  settings: Pick<SubscriptionSettings, 'launchAt' | 'launchTrialDays'>,
  now: number,
): SubscriptionView {
  if (!subscription) return { kind: 'missing' }
  const periodEnd = subscription.currentPeriodEnd
  switch (subscription.status) {
    case 'trialing': {
      const endsAt = effectiveTrialEnd(subscription, settings)
      if (!endsAt) return { kind: 'launch_pending', launchTrialDays: settings.launchTrialDays }
      if (Date.parse(endsAt) <= now) return { kind: 'expired' }
      if (subscription.cancelAtPeriodEnd && subscription.hasStripeSubscription) {
        return { kind: 'canceled', endsAt: periodEnd ?? endsAt }
      }
      return {
        kind: 'trialing',
        endsAt,
        daysLeft: daysLeft(endsAt, now),
        paid: subscription.hasStripeSubscription,
      }
    }
    case 'active':
      if (periodEnd && Date.parse(periodEnd) + DAY_MS <= now) return { kind: 'expired' }
      if (subscription.cancelAtPeriodEnd) return { kind: 'canceled', endsAt: periodEnd }
      return { kind: 'active', nextChargeAt: periodEnd }
    case 'past_due': {
      const graceEndsAt = subscription.pastDueSince
        ? addDays(subscription.pastDueSince, PAST_DUE_GRACE_DAYS)
        : null
      if (graceEndsAt && Date.parse(graceEndsAt) <= now) return { kind: 'expired' }
      return { kind: 'past_due', graceEndsAt }
    }
    case 'canceled':
      if (periodEnd && Date.parse(periodEnd) <= now) return { kind: 'expired' }
      return { kind: 'canceled', endsAt: periodEnd }
    default:
      return { kind: 'expired' }
  }
}

export function canStartCheckout(
  view: SubscriptionView,
  subscription: Subscription | null,
): boolean {
  if (view.kind === 'expired') return true
  return view.kind === 'trialing' && !subscription?.hasStripeSubscription
}

export function hasLiveStripeSubscription(
  view: SubscriptionView,
  subscription: Subscription | null,
): boolean {
  return (
    Boolean(subscription?.hasStripeSubscription) &&
    view.kind !== 'expired' &&
    view.kind !== 'missing'
  )
}
