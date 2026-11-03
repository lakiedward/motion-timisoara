import { useQuery } from '@tanstack/react-query'
import { CreditCard, Info } from 'lucide-react'

import {
  CARD_PAYMENTS_MONTH_QUERY_KEY,
  getCardPaymentsMonth,
} from '@/api/payments/card-payments-month'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { formatRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { subscriptionSalesAllowed } from '@/lib/store-compliance'
import { cn } from '@/lib/utils'

const monthFormatter = new Intl.DateTimeFormat('ro-RO', { month: 'long', timeZone: 'UTC' })

function monthName(monthStart: string | undefined): string {
  const date = monthStart ? new Date(`${monthStart}T00:00:00Z`) : new Date()
  return monthFormatter.format(Number.isNaN(date.getTime()) ? new Date() : date)
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-xl border px-4 py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className={cn('font-display mt-1 text-2xl font-extrabold break-words', className)}>
        {value}
      </dd>
    </div>
  )
}

export function CardPaymentsMonthCard({
  enabled,
  offersLabel,
  netLabel,
}: {
  enabled: boolean
  offersLabel: string
  netLabel: string
}) {
  const query = useQuery({
    queryKey: CARD_PAYMENTS_MONTH_QUERY_KEY,
    queryFn: getCardPaymentsMonth,
    enabled,
    retry: false,
  })
  if (!enabled) return null
  const data = query.data
  const title = `Plăți online în ${monthName(data?.monthStart)}`

  return (
    <section
      data-testid="card-payments-month"
      aria-labelledby="card-payments-month-title"
      className="bg-card min-w-0 rounded-xl border p-5"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl"
        >
          <CreditCard className="size-5" />
        </span>
        <div className="min-w-0">
          <h2
            id="card-payments-month-title"
            className="font-display text-foreground text-lg font-bold break-words"
          >
            {title}
          </h2>
          {query.isPending ? (
            <Skeleton className="mt-1 h-4 w-48" />
          ) : data ? (
            <p className="text-muted-foreground text-sm break-words">
              {data.paymentCount === 0
                ? `Nicio plată cu cardul la ${offersLabel} luna aceasta.`
                : `${plural(data.paymentCount, 'plată', 'plăți')} cu cardul la ${offersLabel}, până azi`}
            </p>
          ) : null}
        </div>
      </div>

      {query.isPending ? (
        <div
          role="status"
          aria-label="Se încarcă: plățile online"
          className="mt-4 grid gap-3 sm:grid-cols-3"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca plățile online"
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          className="py-6"
        />
      ) : data && data.paymentCount > 0 ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Figure label="Încasat de la părinți" value={formatRon(data.collected)} />
            <Figure label="Cost Stripe reținut" value={`− ${formatRon(data.stripeFee)}`} />
            <Figure label={netLabel} value={formatRon(data.net)} className="text-primary" />
          </dl>
          {data.unsettledCount > 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Costul exact pentru {plural(data.unsettledCount, 'plată', 'plăți')} se confirmă în
              câteva minute. Până atunci arătăm costul maxim.
            </p>
          ) : null}
        </>
      ) : null}

      {!query.isError ? (
        <p className="text-muted-foreground mt-4 flex items-start gap-2 text-sm">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Costul Stripe (1,5% + 1 leu pe plată, mai mult la cardurile premium sau din afara UE) se
            reține automat din fiecare plată.
            {subscriptionSalesAllowed() ? ' Abonamentul se plătește separat.' : ''}
          </span>
        </p>
      ) : null}
    </section>
  )
}
