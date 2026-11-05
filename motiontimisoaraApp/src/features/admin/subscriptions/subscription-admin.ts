import type { AdminSubscription } from '@/api/subscriptions/admin-subscriptions'
import type { SubscriberType, SubscriptionStatus } from '@/api/subscriptions/subscriptions'
import { fold } from '@/features/admin/courses/course-overview'

const DAY_MS = 86_400_000
export const ENDING_SOON_DAYS = 14

export type SubscriptionStateFilter = 'all' | SubscriptionStatus
export type SubscriptionTypeFilter = '' | SubscriberType

export type SubscriptionFilters = {
  status: SubscriptionStateFilter
  type: SubscriptionTypeFilter
  plan: string
  query: string
}

export const NO_SUBSCRIPTION_FILTERS: SubscriptionFilters = {
  status: 'all',
  type: '',
  plan: '',
  query: '',
}

export const NO_PLAN = '__none__'

export const STATUS_ORDER: SubscriptionStatus[] = [
  'past_due',
  'trialing',
  'active',
  'canceled',
  'expired',
]

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  past_due: 'Plată eșuată',
  trialing: 'Perioadă gratuită',
  active: 'Active',
  canceled: 'Anulate',
  expired: 'Expirate',
}

export const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  past_due: 'Plată eșuată',
  trialing: 'Perioadă gratuită',
  active: 'Activ',
  canceled: 'Anulat',
  expired: 'Expirat',
}

export function statusVariant(status: SubscriptionStatus) {
  if (status === 'active' || status === 'trialing') return 'success' as const
  if (status === 'past_due') return 'destructive' as const
  return 'outline' as const
}

export const TYPE_LABEL: Record<SubscriberType, string> = {
  COACH: 'Antrenor',
  CLUB: 'Club',
}

export function planKey(subscription: AdminSubscription): string {
  return subscription.plan_code ?? NO_PLAN
}

export function planLabel(subscription: AdminSubscription): string {
  return subscription.plan_name ?? 'Fără pachet ales'
}

export function filterSubscriptions(
  subscriptions: AdminSubscription[],
  filters: SubscriptionFilters,
): AdminSubscription[] {
  const query = fold(filters.query.trim())
  return subscriptions.filter((s) => {
    if (filters.status !== 'all' && s.status !== filters.status) return false
    if (filters.type && s.subscriber_type !== filters.type) return false
    if (filters.plan && planKey(s) !== filters.plan) return false
    if (!query) return true
    return fold([s.subscriber_name, s.subscriber_email ?? '', s.plan_name ?? ''].join(' ')).includes(
      query,
    )
  })
}

export function hasSubscriptionFilters(filters: SubscriptionFilters): boolean {
  return (
    filters.status !== 'all' || filters.type !== '' || filters.plan !== '' || filters.query !== ''
  )
}

export function statusCounts(
  subscriptions: AdminSubscription[],
): Record<SubscriptionStateFilter, number> {
  const counts: Record<SubscriptionStateFilter, number> = {
    all: subscriptions.length,
    past_due: 0,
    trialing: 0,
    active: 0,
    canceled: 0,
    expired: 0,
  }
  for (const s of subscriptions) counts[s.status] += 1
  return counts
}

export function planOptions(
  subscriptions: AdminSubscription[],
): { id: string; name: string; count: number }[] {
  const byPlan = new Map<string, { id: string; name: string; count: number; price: number }>()
  for (const s of subscriptions) {
    const key = planKey(s)
    const entry = byPlan.get(key) ?? {
      id: key,
      name: planLabel(s),
      count: 0,
      price: s.price_bani ?? -1,
    }
    entry.count += 1
    byPlan.set(key, entry)
  }
  return [...byPlan.values()]
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'ro'))
    .map(({ id, name, count }) => ({ id, name, count }))
}

export function recurringBani(subscription: AdminSubscription): number {
  if (subscription.status !== 'active' || subscription.cancel_at_period_end) return 0
  return subscription.price_bani ?? 0
}

export type SubscriptionTotals = {
  monthlyBani: number
  payingCount: number
  trialingCount: number
  pastDueCount: number
  endingSoonCount: number
}

export function isEndingSoon(subscription: AdminSubscription, now: number): boolean {
  if (!subscription.access_end) return false
  if (subscription.status === 'canceled' || subscription.status === 'expired') return false
  const left = Date.parse(subscription.access_end) - now
  return left >= 0 && left <= ENDING_SOON_DAYS * DAY_MS
}

export function subscriptionTotals(
  subscriptions: AdminSubscription[],
  now: number,
): SubscriptionTotals {
  const totals: SubscriptionTotals = {
    monthlyBani: 0,
    payingCount: 0,
    trialingCount: 0,
    pastDueCount: 0,
    endingSoonCount: 0,
  }
  for (const s of subscriptions) {
    const recurring = recurringBani(s)
    if (recurring > 0) {
      totals.monthlyBani += recurring
      totals.payingCount += 1
    }
    if (s.status === 'trialing') totals.trialingCount += 1
    if (s.status === 'past_due') totals.pastDueCount += 1
    if (isEndingSoon(s, now)) totals.endingSoonCount += 1
  }
  return totals
}

export type SubscriptionGroup = {
  status: SubscriptionStatus
  subscriptions: AdminSubscription[]
  monthlyBani: number
}

function endTime(subscription: AdminSubscription): number {
  return subscription.access_end ? Date.parse(subscription.access_end) : Number.POSITIVE_INFINITY
}

export function groupByStatus(subscriptions: AdminSubscription[]): SubscriptionGroup[] {
  return STATUS_ORDER.flatMap((status) => {
    const inGroup = subscriptions
      .filter((s) => s.status === status)
      .sort(
        (a, b) =>
          endTime(a) - endTime(b) || a.subscriber_name.localeCompare(b.subscriber_name, 'ro'),
      )
    if (inGroup.length === 0) return []
    return [
      {
        status,
        subscriptions: inGroup,
        monthlyBani: inGroup.reduce((sum, s) => sum + recurringBani(s), 0),
      },
    ]
  })
}

export function daysUntil(value: string, now: number): number {
  return Math.ceil((Date.parse(value) - now) / DAY_MS)
}

export function extensionBase(subscription: AdminSubscription, now: number): number | null {
  if (subscription.status === 'trialing' && !subscription.access_end) return null
  const end = subscription.access_end ? Date.parse(subscription.access_end) : now
  return Math.max(end, now)
}

export function extensionPreview(
  subscription: AdminSubscription,
  days: number,
  now: number,
): string | null {
  const base = extensionBase(subscription, now)
  if (base === null || !Number.isInteger(days) || days < 1 || days > 366) return null
  return new Date(base + days * DAY_MS).toISOString()
}

export const EXTENSION_PRESETS = [7, 14, 30, 60, 90] as const
