import { Building2, ChevronRight, UserRound } from 'lucide-react'

import type { AdminSubscription } from '@/api/subscriptions/admin-subscriptions'
import { Badge } from '@/components/ui/badge'
import { formatRon } from '@/lib/money'
import { formatShortDate } from '@/lib/panel-date'
import { plural } from '@/lib/plural'
import {
  STATUS_BADGE,
  STATUS_LABEL,
  TYPE_LABEL,
  daysUntil,
  planLabel,
  statusVariant,
  type SubscriptionGroup,
} from './subscription-admin'

function typeText(subscription: AdminSubscription): string {
  const type = TYPE_LABEL[subscription.subscriber_type]
  return planLabel(subscription).startsWith(type) ? '' : type
}

function endLine(subscription: AdminSubscription, now: number): string {
  if (!subscription.access_end) {
    return subscription.status === 'trialing' ? 'Fără dată de încheiere încă' : 'Fără acces'
  }
  const left = daysUntil(subscription.access_end, now)
  const date = formatShortDate(subscription.access_end)
  if (subscription.status === 'expired') return `Expirat pe ${date}`
  if (left < 0) return `Încheiat pe ${date}`
  if (left === 0) return `Se încheie azi, ${date}`
  return `Până pe ${date} · ${plural(left, 'zi', 'zile')}`
}

function SubscriptionRow({
  subscription,
  now,
  onOpen,
}: {
  key?: string
  subscription: AdminSubscription
  now: number
  onOpen: () => void
}) {
  const Icon = subscription.subscriber_type === 'CLUB' ? Building2 : UserRound
  const price = subscription.price_bani
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Detalii abonament ${subscription.subscriber_name}`}
        className="hover:bg-secondary [&:hover]:bg-secondary focus-visible:outline-ring flex min-h-touch-target w-full cursor-pointer items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-5"
      >
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary hidden size-10 shrink-0 place-items-center rounded-xl sm:grid"
        >
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display min-w-0 font-semibold wrap-anywhere">
              {subscription.subscriber_name}
            </span>
            <Badge variant={statusVariant(subscription.status)}>
              {STATUS_BADGE[subscription.status]}
            </Badge>
            {subscription.cancel_at_period_end && subscription.status === 'active' && (
              <Badge variant="outline">Se oprește la final</Badge>
            )}
          </span>
          <span className="text-muted-foreground block text-sm wrap-anywhere">
            {[typeText(subscription), planLabel(subscription)].filter(Boolean).join(' · ')}
            {subscription.adjustments.length > 0
              ? ` · ${plural(subscription.adjustments.length, 'prelungire', 'prelungiri')}`
              : ''}
          </span>
          <span className="text-muted-foreground block text-xs">{endLine(subscription, now)}</span>
        </span>
        {price !== null && (
          <span className="shrink-0 text-right">
            <span className="font-display block font-bold tabular-nums">{formatRon(price)}</span>
            <span className="text-muted-foreground block text-xs">pe lună</span>
          </span>
        )}
        <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </button>
    </li>
  )
}

export function SubscriptionGroupList({
  groups,
  now,
  onOpen,
}: {
  groups: SubscriptionGroup[]
  now: number
  onOpen: (subscription: AdminSubscription) => void
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.status}
          aria-label={STATUS_LABEL[group.status]}
          className="bg-card overflow-hidden rounded-xl border"
        >
          <header className="bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2 sm:px-5">
            <h2 className="font-display text-sm font-semibold">
              {STATUS_LABEL[group.status]}{' '}
              <span className="text-muted-foreground tabular-nums">
                {group.subscriptions.length}
              </span>
            </h2>
            {group.monthlyBani > 0 && (
              <span className="text-muted-foreground text-sm tabular-nums">
                {formatRon(group.monthlyBani)} pe lună
              </span>
            )}
          </header>
          <ul className="divide-y">
            {group.subscriptions.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                now={now}
                onOpen={() => onOpen(subscription)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
