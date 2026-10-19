import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getEnrollmentPayments } from '@/api/payments/enrollments'
import { startStripeCheckout } from '@/api/payments/checkout-session'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'

const CONFIRM_WAIT_MS = 12000

function EnrollmentsLink({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  return (
    <Button asChild variant={variant}>
      <Link to="/account/enrollments">Vezi înscrierile</Link>
    </Button>
  )
}

export default function PaymentReturnPage() {
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const result = params.get('rezultat')
  const ids = (params.get('inscrieri') ?? '').split(',').filter(Boolean).slice(0, 10)
  const [waited, setWaited] = useState(false)

  const payments = useQuery({
    queryKey: ['payment-return', ids],
    queryFn: () => getEnrollmentPayments(ids),
    enabled: ids.length > 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.every((row) => row.payments[0].status === 'SUCCEEDED') ? false : 2000,
  })
  const paid = Boolean(payments.data?.every((row) => row.payments[0].status === 'SUCCEEDED'))

  useEffect(() => {
    if (result !== 'reusita') return
    const timer = window.setTimeout(() => setWaited(true), CONFIRM_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [result])

  useEffect(() => {
    if (paid) void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
  }, [paid, queryClient])

  const retry = useMutation({ mutationFn: () => startStripeCheckout(ids) })

  let content
  if (!ids.length || (result !== 'reusita' && result !== 'anulata')) {
    content = (
      <StatusView
        state="empty"
        title="Nu găsim plata."
        text="Vezi starea plăților în Înscrieri."
        action={
          <div className="mt-3">
            <EnrollmentsLink />
          </div>
        }
      />
    )
  } else if (payments.isError) {
    content = (
      <StatusView
        state="error"
        title="Nu am putut verifica plata."
        text={payments.error.message}
        onRetry={() => void payments.refetch()}
      />
    )
  } else if (paid || retry.data === 'paid') {
    content = (
      <StatusView
        state="success"
        title="Plată confirmată"
        text="Înscrierea este activă. Primești chitanța de la Stripe pe email."
        action={
          <div className="mt-3">
            <EnrollmentsLink />
          </div>
        }
      />
    )
  } else if (result === 'anulata') {
    const redirecting = retry.isPending || retry.data === 'redirected'
    content = (
      <div className="grid justify-items-center pb-8">
        <StatusView
          state="error"
          title="Plata nu a fost finalizată"
          text={
            retry.isError
              ? retry.error.message
              : 'Nu s-a încasat nimic. Poți relua plata acum sau mai târziu, din Înscrieri.'
          }
          onRetry={redirecting || !payments.data ? undefined : () => retry.mutate()}
          retryLabel="Reia plata"
          className="pb-4"
        />
        {redirecting ? (
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            Te ducem la Stripe…
          </p>
        ) : null}
        <Button asChild variant="ghost">
          <Link to="/account/enrollments">Înapoi la Înscrieri</Link>
        </Button>
      </div>
    )
  } else if (waited) {
    content = (
      <StatusView
        state="empty"
        title="Plata e în curs de confirmare"
        text="Stripe a primit plata, iar confirmarea poate dura câteva minute. Starea se actualizează în Înscrieri."
        action={
          <div className="mt-3">
            <EnrollmentsLink />
          </div>
        }
      />
    )
  } else {
    content = <StatusView state="loading" title="Confirmăm plata…" rows={1} rowHeight={200} />
  }

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Plata înscrierii</h1>
      <div className="bg-card rounded-2xl border">{content}</div>
    </div>
  )
}
