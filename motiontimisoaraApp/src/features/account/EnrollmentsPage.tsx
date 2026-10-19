import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getMyEnrollments } from '@/api/account'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { enrollmentPayable } from '@/api/payments/enrollments'
import { EnrollmentPaymentPanel } from './checkout/EnrollmentPaymentPanel'

const KIND_LABEL: Record<string, string> = {
  COURSE: 'Curs',
  CAMP: 'Tabără',
  ACTIVITY: 'Activitate',
  COMPETITION: 'Concurs',
}
const STATUS: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'outline' | 'destructive' }
> = {
  ACTIVE: { label: 'Activ', variant: 'success' },
  PENDING: { label: 'În așteptare', variant: 'outline' },
  CANCELLED: { label: 'Anulat', variant: 'destructive' },
}
const PAY: Record<string, string> = {
  SUCCEEDED: 'Plătit',
  PENDING: 'Plată în așteptare',
  FAILED: 'Plată eșuată',
  REFUNDED: 'Returnat',
  PARTIAL: 'Plată parțială',
}
const UNKNOWN_PAYMENT = 'Stare plată necunoscută'
const enrolledOn = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const CARD =
  'bg-card relative rounded-xl border p-6 shadow-card transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none'
const LINKED_CARD =
  'hover:shadow-card-hover hover:border-foreground/20 has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-ring'

function enrollmentDate(createdAt: string | null | undefined) {
  const date = createdAt ? new Date(createdAt) : null
  return date && !Number.isNaN(date.getTime()) ? enrolledOn.format(date) : null
}

function sessionsLine(e: { status: string; purchased_sessions: number; remaining_sessions: number }) {
  if (e.purchased_sessions > 0)
    return `Ședințe: ${e.remaining_sessions} rămase din ${e.purchased_sessions}`
  return e.status === 'PENDING' ? 'Începe după confirmarea plății' : null
}

export default function EnrollmentsPage() {
  const { user } = useAuth()
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const {
    data: enrollments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: getMyEnrollments,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Înscrieri și plăți</h1>
      {isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca înscrierile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <StatusView state="loading" title="Se încarcă înscrierile" rows={2} rowHeight={140} />
      ) : enrollments.length ? (
        <div className="space-y-4">
          {enrollments.map((e) => {
            const status = STATUS[e.status] ?? STATUS.PENDING
            const payment = e.payments?.[0]
            const titlu = e.offerTitle?.trim() || KIND_LABEL[e.kind] || e.kind
            const persoana = e.child?.name ?? (e.adult_profile_id ? 'Tu' : '')
            const titluId = `inscriere-${e.id}`
            const sedinte = e.kind === 'COURSE' ? sessionsLine(e) : null
            const data = enrollmentDate(e.created_at)
            return (
              <article
                key={e.id}
                aria-labelledby={titluId}
                className={e.offerPath ? `${CARD} ${LINKED_CARD}` : CARD}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 id={titluId} className="font-display text-lg font-bold">
                      {e.offerPath ? (
                        <Link
                          to={e.offerPath}
                          data-card-link
                          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
                        >
                          {titlu}
                        </Link>
                      ) : (
                        titlu
                      )}
                    </h2>
                    {persoana ? <p className="mt-1 font-medium">{persoana}</p> : null}
                    {data && (
                      <p className="text-muted-foreground mt-1 text-sm">Înscriere din {data}</p>
                    )}
                    {e.competition_registration && (
                      <p className="text-muted-foreground mt-1 text-sm">
                        {e.competition_registration.category_name_snapshot} ·{' '}
                        {e.competition_registration.route_name_snapshot}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>
                {sedinte && <p className="text-muted-foreground mt-3 text-sm">{sedinte}</p>}
                {payment && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {PAY[payment.status] ?? UNKNOWN_PAYMENT}
                    </span>
                    <div className="text-right">
                      <span className="font-semibold">
                        {formatMoney(payment.amount, payment.currency)}
                      </span>
                      <AcceptedPriceDetails snapshot={payment.pricing_snapshot} />
                    </div>
                  </div>
                )}
                {paymentId === e.id ? (
                  <div className="relative">
                    <EnrollmentPaymentPanel enrollmentId={e.id} onClose={() => setPaymentId(null)} />
                  </div>
                ) : enrollmentPayable(e) ? (
                  <Button
                    className="relative mt-4"
                    variant="outline"
                    onClick={() => setPaymentId(e.id)}
                  >
                    Finalizează plata
                  </Button>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <StatusView
          state="empty"
          title="Nicio înscriere încă."
          text="Înscrierile și plățile apar aici după ce alegi un curs, o tabără sau o activitate."
          action={
            <Button asChild className="mt-3">
              <Link to="/cursuri">Caută cursuri</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
