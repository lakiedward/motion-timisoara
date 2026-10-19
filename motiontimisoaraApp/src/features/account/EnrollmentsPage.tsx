import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getMyEnrollments } from '@/api/account'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { EnrollmentPhotoCards } from './enrollments/EnrollmentPhotoCards'

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
        <StatusView state="loading" title="Se încarcă înscrierile" rows={2} rowHeight={160} />
      ) : enrollments.length ? (
        <EnrollmentPhotoCards enrollments={enrollments} paymentId={paymentId} setPaymentId={setPaymentId} />
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
