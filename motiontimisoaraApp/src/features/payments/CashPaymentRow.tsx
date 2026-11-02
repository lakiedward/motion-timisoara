import type { CashPayment } from '@/api/payments/cash-payments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AttentionNote } from '@/features/admin/courses/CourseParts'
import { formatMoney } from '@/lib/money'
import { formatShortDate } from '@/lib/panel-date'
import { plural } from '@/lib/plural'
import { OVERDUE_DAYS, pendingDays } from './cash-payment-list'

export function CashPaymentRow({
  payment,
  busy,
  onConfirm,
}: {
  key?: string
  payment: CashPayment
  busy: boolean
  onConfirm: () => void
}) {
  const pending = payment.status === 'PENDING'
  const waiting = pendingDays(payment)
  const details = [
    formatMoney(payment.amount, payment.currency),
    payment.sessions ? plural(payment.sessions, 'ședință', 'ședințe') : null,
    pending
      ? `înscris pe ${formatShortDate(payment.created_at)}`
      : payment.paid_at
        ? `confirmată pe ${formatShortDate(payment.paid_at)}`
        : null,
  ].filter(Boolean)

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display min-w-0 font-semibold wrap-anywhere">
            {payment.participant_name}
          </h3>
          {payment.is_adult && <Badge variant="outline">Adult</Badge>}
          <Badge variant={pending ? 'outline' : 'success'}>
            {pending ? 'În așteptare' : 'Încasată'}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{details.join(' · ')}</p>
        <AttentionNote
          reason={
            waiting > OVERDUE_DAYS ? `În așteptare de ${plural(waiting, 'zi', 'zile')}` : null
          }
        />
      </div>
      {pending && (
        <Button
          type="button"
          variant="outline"
          className="h-touch-target min-h-touch-target shrink-0 lg:h-9 lg:min-h-9"
          disabled={busy}
          aria-label={`Confirmă încasarea de la ${payment.participant_name}`}
          onClick={onConfirm}
        >
          Confirmă încasarea
        </Button>
      )}
    </li>
  )
}
