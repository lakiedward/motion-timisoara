import { Banknote, ChevronRight, CreditCard } from 'lucide-react'

import type { AdminPayment } from '@/api/payments/admin-payments'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  cardLabel,
  dayTitle,
  describe,
  paymentTime,
  statusLabel,
  statusOf,
  statusVariant,
  timeOf,
  type PaymentDay,
} from './payment-history'

function PaymentRow({
  payment,
  onOpen,
}: {
  key?: string
  payment: AdminPayment
  onOpen: () => void
}) {
  const Icon = payment.method === 'CARD' ? CreditCard : Banknote
  const muted = statusOf(payment) === 'failed' || statusOf(payment) === 'pending'
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Detalii plată ${payment.payer_name ?? ''}, ${formatMoney(payment.amount, payment.currency)}`}
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
              {payment.payer_name ?? 'Plătitor necunoscut'}
            </span>
            <Badge variant={statusVariant(payment)}>{statusLabel(payment)}</Badge>
          </span>
          <span className="text-muted-foreground block text-sm wrap-anywhere">
            {describe(payment)}
            {payment.participant_name && payment.participant_name !== payment.payer_name
              ? ` · ${payment.participant_name}`
              : ''}
          </span>
          <span className="text-muted-foreground block text-xs">
            {timeOf(paymentTime(payment))} · {cardLabel(payment)} · către {payment.receiver_name}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              'font-display block font-bold tabular-nums',
              muted && 'text-muted-foreground line-through',
            )}
          >
            {formatMoney(payment.amount, payment.currency)}
          </span>
          {payment.amount_refunded > 0 && (
            <span className="text-destructive block text-xs tabular-nums">
              −{formatMoney(payment.amount_refunded, payment.currency)}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </button>
    </li>
  )
}

export function PaymentDayList({
  days,
  onOpen,
}: {
  days: PaymentDay[]
  onOpen: (payment: AdminPayment) => void
}) {
  return (
    <div className="space-y-4">
      {days.map((group) => (
        <section
          key={group.day}
          aria-label={dayTitle(group.day)}
          className="bg-card overflow-hidden rounded-xl border"
        >
          <header className="bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-2 sm:px-5">
            <h2 className="font-display text-sm font-semibold">{dayTitle(group.day)}</h2>
            <span className="text-muted-foreground text-sm tabular-nums">
              {formatMoney(group.total, 'RON')}
            </span>
          </header>
          <ul className="divide-y">
            {group.payments.map((payment) => (
              <PaymentRow
                key={`${payment.source}:${payment.id}`}
                payment={payment}
                onOpen={() => onOpen(payment)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
