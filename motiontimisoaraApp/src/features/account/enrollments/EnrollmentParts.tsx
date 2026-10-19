import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'

import type { EnrollmentRow } from '@/api/account'
import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { scheduleLabel } from '@/lib/enrollment-schedule'
import { cn } from '@/lib/utils'
import { EnrollmentPaymentPanel } from '../checkout/EnrollmentPaymentPanel'
import { STATUS, enrollmentTitle, needsPayment, paymentLabel, sessionsLine } from './enrollment-display'

export const CARD =
  'bg-card relative rounded-xl border transition-[border-color] duration-200 motion-reduce:transition-none'
export const LINKED =
  'hover:border-primary/40 has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-ring'

export function CardTitle({ e, id, className }: { e: EnrollmentRow; id: string; className?: string }) {
  const title = enrollmentTitle(e)
  return (
    <h2 id={id} className={cn('font-display text-lg font-bold', className)}>
      {e.offerPath ? (
        <Link
          to={e.offerPath}
          data-card-link
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
        >
          {title}
        </Link>
      ) : (
        title
      )}
    </h2>
  )
}

export function StatusBadge({ e }: { e: EnrollmentRow }) {
  const status = STATUS[e.status] ?? STATUS.PENDING
  return <Badge variant={status.variant}>{status.label}</Badge>
}

export function WhenLine({ e }: { e: EnrollmentRow }) {
  const when = scheduleLabel(e.offer?.schedule ?? null) ?? sessionsLine(e)
  if (!when) return null
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
      <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{when}</span>
    </p>
  )
}

export function SessionsLeft({ e }: { e: EnrollmentRow }) {
  const line = e.offer?.schedule ? sessionsLine(e) : null
  return line ? <p className="text-muted-foreground text-sm">{line}</p> : null
}

export function PaymentSummary({ e, className }: { e: EnrollmentRow; className?: string }) {
  const payment = e.payments?.[0]
  if (!payment) return null
  return (
    <div className={cn('flex items-start justify-between gap-3 text-sm', className)}>
      <span
        className={cn(
          needsPayment(e) ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {paymentLabel(payment.status)}
      </span>
      <div className="text-right">
        <span className="text-base font-semibold">{formatMoney(payment.amount, payment.currency)}</span>
        <AcceptedPriceDetails snapshot={payment.pricing_snapshot} />
      </div>
    </div>
  )
}

export function PayButton({
  e,
  onOpen,
  className,
}: {
  e: EnrollmentRow
  onOpen: () => void
  className?: string
}) {
  if (!needsPayment(e)) return null
  return (
    <Button className={cn('relative', className)} onClick={onOpen}>
      Finalizează plata
    </Button>
  )
}

export function PayPanel({ e, onClose }: { e: EnrollmentRow; onClose: () => void }) {
  return (
    <div className="bg-muted relative -mx-5 mt-4 -mb-5 p-5 sm:-mx-6 sm:-mb-6 sm:p-6">
      <EnrollmentPaymentPanel enrollmentId={e.id} onClose={onClose} />
    </div>
  )
}

const enrolledOn = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function EnrolledOn({ e, className }: { e: EnrollmentRow; className?: string }) {
  const date = e.created_at ? new Date(e.created_at) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return (
    <p className={cn('text-muted-foreground text-xs', className)}>
      Înscriere din {enrolledOn.format(date)}
    </p>
  )
}
