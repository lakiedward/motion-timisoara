import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, ChevronRight, CircleAlert } from 'lucide-react'

import { CASH_PAYMENTS_QUERY_KEY, getCashPayments } from '@/api/payments/cash-payments'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'

const noticeClass = cn(
  'bg-card flex items-center gap-4 rounded-xl border p-6 transition-colors',
  'hover:border-primary/40 hover:bg-accent',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
)

export function CashPaymentsNotice({ to }: { to: string }) {
  const { data, isError } = useQuery({
    queryKey: CASH_PAYMENTS_QUERY_KEY,
    queryFn: getCashPayments,
    retry: false,
  })
  const pending = (data ?? []).filter((p) => p.status === 'PENDING')
  if (!isError && pending.length === 0) return null
  const total = pending.reduce((sum, p) => sum + p.amount, 0)
  const title = isError
    ? 'Plăți cash'
    : `${plural(pending.length, 'plată cash', 'plăți cash')} de confirmat`

  return (
    <Link to={to} data-testid="cash-payments-notice" className={noticeClass}>
      <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
        <Banknote aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg font-bold">{title}</div>
        {isError ? (
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <CircleAlert aria-hidden="true" className="size-5 shrink-0" /> Nu am putut verifica
            plățile cash. Deschide pagina ca să reîncerci.
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">
            {formatMoney(total, pending[0].currency)} de încasat. Confirmă după ce primești banii,
            ca înscrierile să devină active.
          </p>
        )}
      </div>
      <ChevronRight aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
    </Link>
  )
}
