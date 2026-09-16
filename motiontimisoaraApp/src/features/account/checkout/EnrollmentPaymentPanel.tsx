import { useEffect, useRef } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { stripePromise } from '@/lib/stripe'
import { useAuth } from '@/lib/auth-context'
import { formatOfferPrice } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import {
  enrollmentPaid,
  enrollmentPayable,
  getEnrollmentPayments,
} from '@/api/payments/enrollments'
import { paymentResultMessage, processEnrollmentPayments } from '@/api/payments/process'
import { PaymentEntry } from './PaymentEntry'
import { usePaymentAdapter } from './usePaymentAdapter'

export function EnrollmentPaymentPanel(props: { enrollmentId: string; onClose: () => void }) {
  return (
    <Elements stripe={stripePromise}>
      <SavedPayment {...props} />
    </Elements>
  )
}

function SavedPayment({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const payment = usePaymentAdapter()
  const attempt = useRef<AbortController | null>(null)
  useEffect(() => () => attempt.current?.abort(), [user?.id])
  const state = useQuery({
    queryKey: ['enrollment-payment', user?.id, enrollmentId],
    queryFn: () => getEnrollmentPayments([enrollmentId]),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const pay = useMutation({
    mutationFn: async () => {
      if (!payment.ready) throw new Error('Plata nu este pregătită. Reîncearcă.')
      attempt.current = new AbortController()
      return processEnrollmentPayments(
        [enrollmentId],
        payment.adapter,
        () => undefined,
        attempt.current.signal,
      )
    },
    onSuccess: (result) => {
      if (attempt.current?.signal.aborted) return
      const message = paymentResultMessage(result)
      if (result.outcome === 'ready') toast.success(message)
      else toast.message(message)
    },
    onError: (error: Error) => {
      if (!attempt.current?.signal.aborted) toast.error(error.message)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['enrollments'] })
      if (attempt.current?.signal.aborted) return
      void state.refetch()
    },
  })
  const enrollment = state.data?.[0]
  const saved = enrollment?.payments[0]
  const canPay = enrollment && enrollmentPayable(enrollment)
  return (
    <section aria-label="Reia plata înscrierii" className="mt-4 space-y-4 border-t pt-4">
      <h2 className="font-semibold">Plata înscrierii</h2>
      {state.isPending ? (
        <div role="status" aria-label="Verificăm plata">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : state.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>Nu am putut verifica starea plății. Reîncearcă înainte să plătești.</p>
          <Button variant="outline" onClick={() => void state.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : enrollment && saved ? (
        <>
          <p className="text-sm">
            {enrollment.child?.name} · <strong>{formatOfferPrice(saved.amount, saved.currency)}</strong>
          </p>
          <AcceptedPriceDetails snapshot={saved.pricing_snapshot} />
          {enrollmentPaid(enrollment) ? (
            <p role="status" className="text-sm">
              Plata este confirmată. Nu mai trebuie să plătești.
            </p>
          ) : canPay ? (
            <>
              <p className="text-muted-foreground text-sm">
                Reiei plata existentă, cu suma confirmată inițial. Nu se creează o înscriere nouă.
              </p>
              <PaymentEntry />
              {pay.data && pay.data.outcome !== 'ready' && (
                <p role="status" className="text-muted-foreground text-sm">
                  {paymentResultMessage(pay.data)}
                </p>
              )}
              <Button
                disabled={pay.isPending || state.isFetching || !payment.ready}
                onClick={() => pay.mutate()}
              >
                {pay.isPending
                  ? 'Verificăm și confirmăm plata…'
                  : `Plătește ${formatOfferPrice(saved.amount, saved.currency)}`}
              </Button>
            </>
          ) : (
            <p role="status" className="text-muted-foreground text-sm">
              Această înscriere nu mai poate fi plătită. Verifică starea sau contactează clubul.
            </p>
          )}
        </>
      ) : null}
      <div>
        <Button variant="outline" disabled={pay.isPending} onClick={onClose}>
          Închide
        </Button>
      </div>
    </section>
  )
}
