import type { CashPayment } from '@/api/payments/cash-payments'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'

function day(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Bucharest',
  })
}

export function CashPaymentRow({
  payment,
  armed,
  busy,
  onConfirm,
}: {
  key?: string
  payment: CashPayment
  armed: boolean
  busy: boolean
  onConfirm: () => void
}) {
  const pending = payment.status === 'PENDING'
  const details = [
    formatMoney(payment.amount, payment.currency),
    payment.sessions ? plural(payment.sessions, 'ședință', 'ședințe') : null,
    pending
      ? `înscris pe ${day(payment.created_at)}`
      : payment.paid_at
        ? `confirmată pe ${day(payment.paid_at)}`
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
      </div>
      {pending && (
        <Button
          type="button"
          variant={armed ? 'default' : 'outline'}
          className="h-touch-target min-h-touch-target shrink-0 lg:h-9 lg:min-h-9"
          disabled={busy}
          aria-label={
            armed
              ? `Confirmă suma încasată: ${formatMoney(payment.amount, payment.currency)} de la ${payment.participant_name}`
              : undefined
          }
          onClick={onConfirm}
        >
          {armed ? 'Confirmă suma încasată' : 'Confirmă încasarea'}
        </Button>
      )}
    </li>
  )
}
