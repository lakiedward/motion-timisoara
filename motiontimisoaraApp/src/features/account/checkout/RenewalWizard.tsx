import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { EnrollmentRequestError, type BillingDetails, type PaymentMethod } from '@/api/checkout'
import { renewEnrollment, validateRenewal } from '@/api/payments/renewal'
import { startStripeCheckout } from '@/api/payments/checkout-session'
import { paymentResultMessage, processEnrollmentPayments } from '@/api/payments/process'
import { AcceptedPriceDetails } from '@/components/AcceptedPriceDetails'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { formatRonOffer } from '@/lib/money'
import { stripeConfigured } from '@/lib/stripe'
import type { Offering } from '../CheckoutPage'
import { CheckoutBillingFields } from './CheckoutBillingFields'
import { CheckoutOrderSummary } from './CheckoutOrderSummary'
import { CheckoutPackagePicker } from './CheckoutPackagePicker'
import { CheckoutPaymentStep } from './CheckoutPaymentStep'
import { CheckoutRulesConsent } from './CheckoutRulesConsent'
import { CheckoutSteps } from './CheckoutSteps'
import { TERMS_VERSION, acceptanceResetCode } from './checkout-acceptance'
import { advanceHint, quoteIsPriced, STEP_COPY } from './checkout-flow'
import { usePaymentAdapter } from './usePaymentAdapter'

const DEFAULT_PACKAGE = 10
const MAX_RENEWAL_SESSIONS = 100

const RENEWAL_COPY = {
  title: 'Câte ședințe cumperi?',
  text: 'Ședințele noi se adaugă la cele rămase, după ce plata este confirmată.',
}

function sessionsLeft(count: number) {
  if (count === 1) return 'mai are o ședință'
  if (count === 0) return 'nu mai are ședințe'
  return `mai are ${count} ședințe`
}

export default function RenewalWizard({
  enrollmentId,
  offering,
  initialMethod,
}: {
  enrollmentId: string
  offering: Offering
  initialMethod: PaymentMethod
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const payment = usePaymentAdapter()
  const attempt = useRef<AbortController | null>(null)
  const saved = useRef(false)
  useEffect(() => () => attempt.current?.abort(), [user?.id])

  const [step, setStep] = useState(0)
  const [packageSize, setPackageSize] = useState(DEFAULT_PACKAGE)
  const [accepted, setAccepted] = useState(false)
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>(stripeConfigured ? initialMethod : 'CASH')
  const [billing, setBilling] = useState<BillingDetails>(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    addressLine1: '',
    city: '',
    postalCode: '',
  }))
  const [progress, setProgress] = useState<string | null>(null)

  const validation = useQuery({
    queryKey: ['validate-renewal', enrollmentId, packageSize],
    queryFn: () => validateRenewal(enrollmentId, packageSize),
    placeholderData: keepPreviousData,
  })
  const quote = validation.data?.renewal
  const open = quote?.openPayment ?? null
  const blocked = open?.started === true
  const priced = quoteIsPriced(quote) && !blocked && !validation.isPlaceholderData
  const total = priced ? quote!.amount! : 0
  const allowCash = validation.data?.allowCash ?? true
  const paymentAvailable = stripeConfigured || allowCash
  const steps = method === 'CARD' ? ['Pachet', 'Facturare', 'Plată'] : ['Pachet', 'Plată']
  const lastStep = steps.length - 1
  const hasAccepted = accepted && acceptedVersion === (quote?.priceVersion ?? null)
  const billingValid =
    billing.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(billing.email) &&
    billing.addressLine1.trim().length > 2 &&
    billing.city.trim().length > 1 &&
    billing.postalCode.trim().length > 2
  const canAdvance =
    step === 0 ? priced && hasAccepted : steps[step] === 'Facturare' ? billingValid : true

  const finalize = useMutation({
    mutationFn: async () => {
      if (!quote || !priced || !hasAccepted) {
        throw new Error('Verifică din nou pachetul și suma înainte de plată.')
      }
      if (method === 'CARD' && (!billingValid || !payment.ready)) {
        throw new Error('Plata nu este pregătită. Verifică datele de facturare și reîncearcă.')
      }
      if (saved.current) throw new Error('Cumpărarea este deja salvată. Reia plata din Înscrieri.')
      attempt.current = new AbortController()
      setProgress('Se salvează cumpărarea…')
      const created = await renewEnrollment({
        enrollmentId,
        sessionPackageSize: packageSize,
        paymentMethod: method,
        priceVersion: quote.priceVersion!,
        billingDetails: method === 'CARD' ? billing : undefined,
        acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: offering.rulesFingerprint },
      })
      saved.current = true
      if (method === 'CASH' || !created.requiresPaymentIntent) return { cash: true as const }
      if (!payment.android) {
        setProgress('Te ducem la Stripe…')
        const started = await startStripeCheckout(created.enrollmentIds)
        if (started === 'redirected') return { redirected: true as const }
        return { message: 'Plată confirmată. Ședințele au fost adăugate.' }
      }
      const result = await processEnrollmentPayments(
        created.enrollmentIds,
        payment.adapter,
        (value) => setProgress(value.confirming ? 'Confirmăm plata…' : 'Plata cu cardul'),
        attempt.current.signal,
      )
      return { message: paymentResultMessage(result), ready: result.outcome === 'ready' }
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['enrollments'] })
      if (attempt.current?.signal.aborted || 'redirected' in result) return
      setProgress(null)
      if ('cash' in result) {
        toast.success('Cumpărare înregistrată. Ședințele se adaugă după ce antrenorul confirmă plata cash.')
      } else if (!('ready' in result) || result.ready) {
        toast.success(result.message)
      } else {
        toast.message(result.message)
      }
      navigate('/account/enrollments')
    },
    onError: (e: Error) => {
      if (attempt.current?.signal.aborted) return
      setProgress(null)
      if (e instanceof EnrollmentRequestError && acceptanceResetCode(e.code)) {
        setAccepted(false)
        setStep(0)
        void validation.refetch()
        void qc.invalidateQueries({ queryKey: ['checkout-offering'] })
      }
      toast.error(e.message)
      if (saved.current) navigate('/account/enrollments')
    },
  })

  const busy = finalize.isPending || Boolean(finalize.data && 'redirected' in finalize.data)
  const copy = step === 0 ? RENEWAL_COPY : STEP_COPY[steps[step]]
  const hint =
    step < lastStep && !canAdvance && !open && quote?.eligible !== false
      ? advanceHint(step === 0 ? 'Detalii' : steps[step], 1, hasAccepted)
      : null

  function switchMethod(next: PaymentMethod) {
    setMethod(next)
    if (next === 'CARD' && !billingValid) {
      toast.message('Completează datele de facturare pentru plata cu cardul.')
      setStep(1)
    } else {
      setStep(next === 'CARD' ? 2 : 1)
    }
  }

  const priceBox = quote && priced && (
    <div className="space-y-5">
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3 py-1 text-sm">
          <div className="min-w-0">
            <span>{quote.name}</span>
            <AcceptedPriceDetails snapshot={quote.pricingSnapshot} />
          </div>
          <span className="shrink-0 font-medium tabular-nums">{formatRonOffer(total)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 font-semibold">
          <span>Total</span>
          <span className="shrink-0 tabular-nums">{formatRonOffer(total)}</span>
        </div>
      </div>
      <CheckoutRulesConsent
        kind="COURSE"
        title={offering.title}
        rules={offering.rules}
        checked={hasAccepted}
        onCheckedChange={(value) => {
          setAccepted(value)
          setAcceptedVersion(quote.priceVersion ?? null)
        }}
      />
    </div>
  )

  const firstStep = validation.isPending ? (
    <Skeleton className="h-40 rounded-xl" />
  ) : validation.isError ? (
    <StatusView
      state="error"
      title="Nu am putut pregăti cumpărarea."
      text={validation.error instanceof Error ? validation.error.message : 'Încearcă din nou.'}
      onRetry={() => void validation.refetch()}
    />
  ) : quote ? (
    <section className="space-y-5" data-section="renewal-package">
      <p className="text-sm">
        Pentru <strong>{quote.name}</strong>, care {sessionsLeft(quote.remainingSessions)} la acest
        curs.
      </p>
      {open && blocked ? (
        <div role="status" className="bg-muted space-y-3 rounded-xl p-4 text-sm sm:p-5">
          <p className="font-semibold">
            Ai o plată cu cardul începută
            {open.sessions ? ` pentru ${open.sessions} ședințe` : ''} ({formatRonOffer(open.amount)}).
          </p>
          <p className="text-muted-foreground">
            Finalizeaz-o din Înscrieri. După confirmare poți cumpăra din nou.
          </p>
          <Button asChild variant="outline">
            <Link to="/account/enrollments">Mergi la Înscrieri</Link>
          </Button>
        </div>
      ) : quote.eligible === false ? (
        <p role="alert" className="text-destructive text-sm">
          {quote.reason ?? 'Nu poți cumpăra ședințe la acest curs acum.'}
        </p>
      ) : (
        <>
          {open && (
            <div role="status" className="bg-muted space-y-1 rounded-xl p-4 text-sm sm:p-5">
              <p className="font-semibold">
                Ai deja o plată în așteptare
                {open.sessions ? ` pentru ${open.sessions} ședințe` : ''} ({formatRonOffer(open.amount)}).
              </p>
              <p className="text-muted-foreground">
                {open.method === 'CASH'
                  ? 'Dacă ai dat deja banii antrenorului, așteaptă să confirme. Dacă alegi acum alt pachet, cererea de mai sus se înlocuiește.'
                  : 'Dacă alegi acum alt pachet sau altă metodă, cererea de mai sus se înlocuiește.'}
              </p>
            </div>
          )}
          <CheckoutPackagePicker
            packages={offering.packages}
            value={packageSize}
            onChange={(size) => {
              setPackageSize(Math.min(size, MAX_RENEWAL_SESSIONS))
              setAccepted(false)
            }}
          />
          {validation.isPlaceholderData ? <Skeleton className="h-24 rounded-xl" /> : priceBox}
        </>
      )}
    </section>
  ) : null

  const body =
    step === 0 ? (
      firstStep
    ) : steps[step] === 'Facturare' ? (
      <CheckoutBillingFields billing={billing} setBilling={setBilling} />
    ) : (
      <CheckoutPaymentStep
        summary={
          <CheckoutOrderSummary
            title={offering.title}
            kindLabel="Curs"
            packageSize={packageSize}
            lines={quote ? [{ id: quote.childId, name: quote.name, amount: total, snapshot: quote.pricingSnapshot }] : []}
            total={priced ? total : undefined}
          />
        }
        childCount={1}
        total={priced ? total : undefined}
        method={method}
        allowCash={allowCash}
        cashBlocked={false}
        paymentAvailable={paymentAvailable}
        switchMethod={switchMethod}
        cashNote="Ședințele se adaugă după ce antrenorul confirmă că a primit"
      />
    )

  return (
    <div className="mx-auto max-w-2xl pb-20 lg:pb-0">
      <Link
        to="/account/enrollments"
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex min-h-touch-target items-center gap-1 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft className="size-4" /> Înapoi la Înscrieri
      </Link>
      <div className="mt-2 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Cumpără ședințe</h1>
          <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Curs</Badge>
            <span>{offering.title}</span>
          </p>
        </div>
        <CheckoutSteps steps={steps} current={step} />
        <div className="bg-card rounded-xl border">
          <div className="space-y-6 p-5 sm:p-6">
            <div>
              <h2 className="font-display text-lg font-semibold">{copy?.title ?? steps[step]}</h2>
              {copy && <p className="text-muted-foreground mt-1 text-sm">{copy.text}</p>}
            </div>
            {body}
          </div>
          <div className="space-y-3 border-t p-5 sm:px-6">
            {hint && (
              <p id="renewal-advance-hint" className="text-muted-foreground text-sm">
                {hint}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              {step > 0 ? (
                <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)} disabled={busy}>
                  Înapoi
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              {step < lastStep ? (
                <Button
                  className="w-full sm:w-auto"
                  size="lg"
                  onClick={() => setStep(step + 1)}
                  disabled={!canAdvance}
                  aria-describedby={hint ? 'renewal-advance-hint' : undefined}
                >
                  Continuă
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  className="w-full sm:w-auto"
                  size="lg"
                  onClick={() => finalize.mutate()}
                  disabled={
                    busy ||
                    !priced ||
                    !hasAccepted ||
                    !paymentAvailable ||
                    (method === 'CARD' && !payment.ready)
                  }
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {busy
                    ? (progress ?? 'Se procesează…')
                    : method === 'CARD' && !payment.android
                      ? `Plătește ${formatRonOffer(total)} pe Stripe`
                      : 'Finalizează'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
