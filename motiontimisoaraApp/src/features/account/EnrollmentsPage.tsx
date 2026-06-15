import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getMyEnrollments } from '@/api/account'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const KIND_LABEL: Record<string, string> = { COURSE: 'Curs', CAMP: 'Tabără', ACTIVITY: 'Activitate' }
const STATUS: Record<string, { label: string; variant: 'default' | 'success' | 'outline' | 'destructive' }> = {
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
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: getMyEnrollments,
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
      ) : enrollments.length ? (
        <div className="space-y-4">
          {enrollments.map((e) => {
            const status = STATUS[e.status] ?? STATUS.PENDING
            const payment = e.payments?.[0]
            return (
              <div key={e.id} className="bg-card shadow-card rounded-3xl p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <span className="text-muted-foreground ml-auto text-sm">{e.child?.name}</span>
                </div>
                {e.kind === 'COURSE' && (
                  <p className="text-muted-foreground mt-3 text-sm">
                    Ședințe: {e.remaining_sessions} rămase din {e.purchased_sessions}
                  </p>
                )}
                {payment && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{PAY[payment.status] ?? payment.status}</span>
                    <span className="font-semibold">{formatRon(payment.amount)}</span>
                  </div>
                )}
              </div>
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
