import { useEffect, useRef, useState } from 'react'
import { CardElement, Elements, useElements } from '@stripe/react-stripe-js'
import type { StripeCardElementChangeEvent } from '@stripe/stripe-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { stripeElementsOptions, stripePromise } from '@/lib/stripe'
import { useAuth } from '@/lib/auth-context'
import { formatOfferPrice } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  enrollmentPaid,
  enrollmentPayable,
  getEnrollmentPayments,
} from '@/api/payments/enrollments'
import { paymentResultMessage, processEnrollmentPayments } from '@/api/payments/process'
import { PaymentEntry } from './PaymentEntry'
import { usePaymentAdapter } from './usePaymentAdapter'

type CardState = { complete: boolean; empty: boolean; message: string | null }

const EMPTY_CARD: CardState = { complete: false, empty: true, message: null }

export function EnrollmentPaymentPanel(props: { enrollmentId: string; onClose: () => void }) {
  return (
    <Elements stripe={stripePromise} options={stripeElementsOptions}>
      <SavedPayment {...props} />
    </Elements>
  )
}

function missingCardMessage(card: CardState) {
  if (card.message) return card.message
  return card.empty ? 'Completează datele cardului.' : 'Datele cardului sunt incomplete.'
}

function SavedPayment({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const payment = usePaymentAdapter()
  const elements = useElements()
  const attempt = useRef<AbortController | null>(null)
  const [card, setCard] = useState<CardState>(EMPTY_CARD)
  const [cardError, setCardError] = useState<string | null>(null)
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
      if (result.outcome === 'ready') toast.success(paymentResultMessage(result))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['enrollments'] })
      if (attempt.current?.signal.aborted) return
      void state.refetch()
    },
  })
  const onCardChange = (event: StripeCardElementChangeEvent) => {
    const next = {
      complete: event.complete,
      empty: event.empty,
      message: event.error?.message ?? null,
    }
    setCard(next)
    if (cardError) setCardError(next.complete ? null : missingCardMessage(next))
  }
  const submit = () => {
    if (!payment.android && !card.complete) {
      setCardError(missingCardMessage(card))
      elements?.getElement(CardElement)?.focus()
      return
    }
    setCardError(null)
    pay.mutate()
  }
  const enrollment = state.data?.[0]
  const saved = enrollment?.payments[0]
  const canPay = enrollment && enrollmentPayable(enrollment)
  const paid = enrollment ? enrollmentPaid(enrollment) : false
  const showPay = Boolean(enrollment && saved && !paid && canPay)
  const failure = pay.error
    ? pay.error.message
    : pay.data && pay.data.outcome !== 'ready'
      ? paymentResultMessage(pay.data)
      : null
  return (
    <section aria-label="Reia plata înscrierii" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="bg-background text-primary flex size-9 shrink-0 items-center justify-center rounded-full border">
          <Lock aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h3 className="font-semibold">Plata înscrierii</h3>
          {showPay && (
            <p className="text-muted-foreground text-sm">
              Reiei plata existentă, cu suma confirmată inițial. Nu se creează o înscriere nouă.
            </p>
          )}
        </div>
      </div>
      {state.isPending ? (
        <div role="status" aria-label="Verificăm plata" className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-touch-target w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-12 flex-1" />
          </div>
        </div>
      ) : state.isError ? (
        <div role="alert" className="space-y-3 text-sm">
          <p>Nu am putut verifica starea plății. Reîncearcă înainte să plătești.</p>
          <Button variant="outline" onClick={() => void state.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : enrollment && saved ? (
        paid ? (
          <p role="status" className="text-success-ink flex items-center gap-2 text-sm font-medium">
            <CircleCheck aria-hidden="true" className="size-5 shrink-0" />
            Plata este confirmată. Nu mai trebuie să plătești.
          </p>
        ) : canPay ? (
          <PaymentEntry framed={false} onCardChange={onCardChange} cardError={cardError} />
        ) : (
          <p role="status" className="text-muted-foreground text-sm">
            Această înscriere nu mai poate fi plătită. Verifică starea sau contactează clubul.
          </p>
        )
      ) : null}
      {failure && (
        <p role="alert" className="text-destructive text-sm">
          {failure}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          size="lg"
          className="px-4 text-sm sm:px-6 sm:text-base"
          disabled={pay.isPending}
          onClick={onClose}
        >
          Închide
        </Button>
        {showPay && saved && (
          <Button
            size="lg"
            className="h-auto min-h-12 min-w-0 flex-1 px-4 py-2 text-sm leading-tight whitespace-normal sm:px-6 sm:text-base"
            disabled={pay.isPending || state.isFetching || !payment.ready}
            onClick={submit}
          >
            {pay.isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                <span>Verificăm și confirmăm plata…</span>
              </>
            ) : (
              <>
                <Lock aria-hidden="true" className="hidden size-4 sm:block" />
                <span>Plătește {formatOfferPrice(saved.amount, saved.currency)}</span>
              </>
            )}
          </Button>
        )}
      </div>
    </section>
  )
}
