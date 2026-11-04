import type { Subscription, SubscriptionPlan } from '@/api/subscriptions/subscriptions'
import { formatShortDate } from '@/lib/panel-date'
import {
  canStartCheckout,
  hasLiveStripeSubscription,
  type SubscriptionView,
} from '@/features/subscriptions/subscription-state'

export type PlanAction =
  | { kind: 'current'; keepScheduled: boolean }
  | { kind: 'scheduled'; effectiveAt: string | null }
  | { kind: 'checkout' }
  | { kind: 'upgrade' }
  | { kind: 'downgrade'; effectiveAt: string | null }
  | { kind: 'blocked'; coachesToRemove: number }
  | { kind: 'none' }

export type PlanContext = {
  view: SubscriptionView
  subscription: Subscription | null
  plans: SubscriptionPlan[]
  coachCount: number
}

export function currentPlan(context: PlanContext): SubscriptionPlan | null {
  if (!hasLiveStripeSubscription(context.view, context.subscription)) return null
  return context.plans.find((plan) => plan.code === context.subscription?.planCode) ?? null
}

export function coachesToRemove(plan: SubscriptionPlan, coachCount: number): number {
  return plan.coachLimit === null ? 0 : Math.max(0, coachCount - plan.coachLimit)
}

export function planAction(plan: SubscriptionPlan, context: PlanContext): PlanAction {
  const { view, subscription, coachCount } = context
  const tooSmall = coachesToRemove(plan, coachCount)
  if (canStartCheckout(view, subscription)) {
    return tooSmall > 0 ? { kind: 'blocked', coachesToRemove: tooSmall } : { kind: 'checkout' }
  }
  const current = currentPlan(context)
  if (!current) return { kind: 'none' }
  const changeable = view.kind === 'active' || view.kind === 'trialing'
  const scheduled = subscription?.scheduledPlanCode ?? null
  const effectiveAt =
    view.kind === 'active' ? view.nextChargeAt : view.kind === 'trialing' ? view.endsAt : null
  if (plan.code === current.code) {
    return {
      kind: 'current',
      keepScheduled: changeable && scheduled !== null && scheduled !== current.code,
    }
  }
  if (plan.code === scheduled) return { kind: 'scheduled', effectiveAt }
  if (!changeable) return { kind: 'none' }
  if (tooSmall > 0) return { kind: 'blocked', coachesToRemove: tooSmall }
  return plan.priceBani > current.priceBani
    ? { kind: 'upgrade' }
    : { kind: 'downgrade', effectiveAt }
}

export type LimitWarning = {
  planName: string
  coachCount: number
  coachLimit: number
  over: boolean
}

export function limitWarning(context: PlanContext): LimitWarning | null {
  const current = currentPlan(context)
  if (!current || current.coachLimit === null) return null
  if (context.coachCount < current.coachLimit) return null
  return {
    planName: current.name,
    coachCount: context.coachCount,
    coachLimit: current.coachLimit,
    over: context.coachCount > current.coachLimit,
  }
}

export function nextLargerPlan(context: PlanContext): SubscriptionPlan | null {
  const current = currentPlan(context)
  if (!current) return null
  return (
    context.plans
      .filter((plan) => plan.priceBani > current.priceBani)
      .sort((a, b) => a.priceBani - b.priceBani)[0] ?? null
  )
}

export function coachUsageText(coachCount: number, coachLimit: number | null): string {
  const used = coachCount === 1 ? '1 antrenor' : `${coachCount} antrenori`
  return coachLimit === null
    ? `Nelimitat · ai ${used}`
    : `${coachCount} din ${coachLimit} antrenori`
}

export function downgradeHint(action: PlanAction): string | null {
  if (action.kind !== 'downgrade') return null
  return action.effectiveAt
    ? `Intră de la ${formatShortDate(action.effectiveAt)}`
    : 'Intră de luna viitoare'
}
