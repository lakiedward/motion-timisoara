import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getMyEnrollments } from '@/api/account'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
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
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="space-y-3">
          <p>Nu am putut încărca înscrierile și plățile.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : enrollments.length ? (
        <div className="space-y-4">
          {enrollments.map((e) => {
            const status = STATUS[e.status] ?? STATUS.PENDING
            const payment = e.payments?.[0]
            const titlu = e.offerTitle?.trim() || KIND_LABEL[e.kind] || e.kind
            const persoana = e.child?.name ?? (e.adult_profile_id ? 'Tu' : '')
            const titluId = `inscriere-${e.id}`
            return (
              <article
                key={e.id}
                aria-labelledby={titluId}
                className="bg-card shadow-card rounded-3xl p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 id={titluId} className="font-display text-lg font-bold">
                      {titlu}
                    </h2>
                    {persoana ? <p className="mt-1 font-medium">{persoana}</p> : null}
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
                {e.kind === 'COURSE' && (
                  <p className="text-muted-foreground mt-3 text-sm">
                    Ședințe: {e.remaining_sessions} rămase din {e.purchased_sessions}
                  </p>
                )}
                {payment && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {PAY[payment.status] ?? payment.status}
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
                  <EnrollmentPaymentPanel enrollmentId={e.id} onClose={() => setPaymentId(null)} />
                ) : enrollmentPayable(e) ? (
                  <Button className="mt-4" variant="outline" onClick={() => setPaymentId(e.id)}>
                    Reia plata
                  </Button>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Nicio înscriere încă.{' '}
          <Link to="/cursuri" className="text-primary font-semibold">
            Caută cursuri
          </Link>
        </div>
      )}
    </div>
  )
}
