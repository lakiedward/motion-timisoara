import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { AlertCircle, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  EnrollmentRequestError,
  cancelDraftEnrollment,
  createEnrollment,
  createPaymentIntent,
  listenForEnrollmentReady,
  validateEnrollment,
  type BillingDetails,
  type EnrollmentKind,
  type PaymentMethod,
} from '@/api/checkout'
import { childAge, createChild, getMyChildren } from '@/api/account'
import { useAuth } from '@/lib/auth-context'
import { formatRon } from '@/lib/money'
import { stripeConfigured } from '@/lib/stripe'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import type { Offering } from '../CheckoutPage'
import { AddChildInline, Field } from './CheckoutFormFields'

const KIND_LABEL: Record<EnrollmentKind, string> = {
  COURSE: 'Curs',
  CAMP: 'Tabără',
  ACTIVITY: 'Activitate',
}

const DEFAULT_PACKAGE = 10

export default function CheckoutWizard({
  kind,
  offering,
  initialMethod,
}: {
  kind: EnrollmentKind
  offering: Offering
  initialMethod: PaymentMethod
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()

  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [packageSize, setPackageSize] = useState(DEFAULT_PACKAGE)
  const [accepted, setAccepted] = useState(false)
  const [acceptedCampPrices, setAcceptedCampPrices] = useState<string | null>(null)
  const [chosenMethod, setMethod] = useState<PaymentMethod>(
    stripeConfigured ? initialMethod : 'CASH'
  )
  const [billing, setBilling] = useState<BillingDetails>(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    addressLine1: '',
    city: '',
    postalCode: '',
  }))
  const [progress, setProgress] = useState<string | null>(null)

  const { data: children = [], isLoading: childrenLoading, isError: childrenFailed, refetch: refetchChildren } = useQuery({
    queryKey: ['children'],
    queryFn: getMyChildren,
  })
  const childIds = useMemo(() => children.map((c) => c.id), [children])
  const { data: validation, isSuccess: validationReady, isFetching: validationFetching, isError: validationFailed, error: validationError, refetch: refetchValidation } = useQuery({
    queryKey: ['validate-enrollment', kind, offering.id, childIds],
    queryFn: () => validateEnrollment(kind, offering.id, childIds),
    enabled: childIds.length > 0,
  })

  const verdictFor = (childId: string) => validation?.results.find((r) => r.childId === childId)
  const allowCash = validation?.allowCash ?? kind !== 'CAMP'
  const cashBlocked = selected.some((cid) => verdictFor(cid)?.severity === 'warning')
  const cashUnavailable = (cashBlocked || !allowCash) && stripeConfigured
  const method: PaymentMethod = cashUnavailable && chosenMethod === 'CASH' ? 'CARD' : chosenMethod

  const paymentAvailable = stripeConfigured || (allowCash && !cashBlocked)

  const steps = method === 'CARD' ? ['Copii', 'Detalii', 'Facturare', 'Plată'] : ['Copii', 'Detalii', 'Plată']
  const lastStep = steps.length - 1

  const unitPrice = Number.isFinite(offering.unitPrice) ? offering.unitPrice : 0
  const priceFor = (childId: string) => kind === 'CAMP'
    ? verdictFor(childId)?.amount
    : unitPrice * (offering.perSession ? packageSize : 1)
  const pricesReady = validationReady && !validationFetching && selected.every((childId) => {
    const verdict = verdictFor(childId)
    return verdict?.eligible === true && (kind !== 'CAMP' || (
      Number.isSafeInteger(verdict.amount) && verdict.amount! >= 0 &&
      verdict.currency === 'RON' && Boolean(verdict.priceVersion)
    ))
  })
  const total = pricesReady ? selected.reduce((sum, childId) => sum + (priceFor(childId) ?? 0), 0) : 0
  const priceVersions = kind === 'CAMP'
    ? Object.fromEntries(selected.map((childId) => [childId, verdictFor(childId)?.priceVersion ?? '']))
    : undefined
  const currentCampPrices = JSON.stringify(priceVersions)
  const hasAccepted = accepted && (kind !== 'CAMP' || acceptedCampPrices === currentCampPrices)

  const billingValid =
    billing.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(billing.email) &&
    billing.addressLine1.trim().length > 2 &&
    billing.city.trim().length > 1 &&
    billing.postalCode.trim().length > 2

  const capacityOk = (() => {
    if (validation?.capacity.available == null) return true
    const newSeatsNeeded = selected.filter((cid) => verdictFor(cid)?.severity !== 'warning').length
    return validation.capacity.available >= newSeatsNeeded
  })()

  const canAdvance = (() => {
    if (step === 0) {
      if (selected.length === 0) return false
      if (childIds.length > 0 && !validationReady) return false
      return capacityOk && pricesReady
    }
    if (step === 1) return hasAccepted && pricesReady && total > 0
    if (steps[step] === 'Facturare') return billingValid
    return true
  })()

  const finalize = useMutation({
    mutationFn: async () => {
      if (!validationReady || !pricesReady || !hasAccepted || selected.length === 0) {
        throw new Error('Verifică din nou copiii și prețurile înainte de înscriere.')
      }
      if (method === 'CARD' && !billingValid) {
        throw new Error('Completează datele de facturare')
      }
      if (method === 'CASH' && (cashBlocked || !allowCash)) {
        throw new Error(
          cashBlocked
            ? 'Există o înscriere neplătită; alege plata cu cardul.'
            : 'Plata cash nu este disponibilă pentru această ofertă.'
        )
      }
      if (!paymentAvailable) {
        throw new Error('Nu există o metodă de plată disponibilă pentru această înscriere.')
      }
      if (!capacityOk) {
        throw new Error('Nu mai sunt locuri suficiente pentru selecția ta.')
      }

      setProgress('Se creează înscrierile…')
      const created = await createEnrollment({
        kind,
        entityId: offering.id,
        childIds: selected,
        paymentMethod: method,
        priceVersions,
        sessionPackageSize: offering.perSession ? packageSize : undefined,
        billingDetails: method === 'CARD' ? billing : undefined,
      })

      if (method === 'CASH') return { ids: created.enrollmentIds, outcome: 'cash' as const }

      const card = elements?.getElement(CardElement)
      if (!stripe || !card) {
        await cancelDraftEnrollment(created.enrollmentIds)
        throw new Error('Formularul de card nu s-a încărcat. Reîncarcă pagina.')
      }
      const ids = created.enrollmentIds
      const listener = user ? listenForEnrollmentReady(user.id, ids) : null
      if (listener) {
        await Promise.race([
          listener.whenSubscribed,
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ])
      }

      for (let i = 0; i < ids.length; i++) {
        setProgress(ids.length > 1 ? `Se procesează plata ${i + 1} din ${ids.length}…` : 'Se procesează plata…')
        try {
          const { clientSecret, alreadySucceeded } = await createPaymentIntent(ids[i])
          if (alreadySucceeded) continue
          const { error } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
              card,
              billing_details: {
                name: billing.name,
                email: billing.email,
                address: {
                  line1: billing.addressLine1,
                  city: billing.city,
                  postal_code: billing.postalCode,
                  country: 'RO',
                },
              },
            },
          })
          if (error) throw new Error(error.message ?? 'Plata a eșuat')
        } catch (err) {
          listener?.dispose()
          await cancelDraftEnrollment(ids.slice(i)).catch(() => undefined)
          if (i > 0) {
            throw new Error(
              `Plata a reușit pentru ${i} din ${ids.length} copii. Restul au fost anulate — verifică în Înscrieri.`,
              { cause: err }
            )
          }
          throw err instanceof Error ? err : new Error('Plata a eșuat', { cause: err })
        }
      }

      setProgress('Confirmăm plata…')
      if (listener) listener.startWaiting()
      const outcome = listener ? await listener.outcome : 'timeout'
      return { ids, outcome }
    },
    onSuccess: ({ outcome }) => {
      setProgress(null)
      qc.invalidateQueries({ queryKey: ['enrollments'] })
      if (outcome === 'cash') {
        toast.success('Înscriere înregistrată. Plata se face cash la antrenor.')
      } else if (outcome === 'ready') {
        toast.success('Plată confirmată. Înscrierea este activă.')
      } else if (outcome === 'failed') {
        toast.error('Plata a fost respinsă. Verifică în secțiunea Înscrieri.')
      } else if (outcome === 'partial') {
        toast.message('Unele plăți s-au confirmat, altele nu. Verifică în Înscrieri.')
      } else {
        toast.message('Plata a fost trimisă. Confirmarea poate dura câteva momente.')
      }
      navigate('/account/enrollments')
    },
    onError: (e: Error) => {
      if (e instanceof EnrollmentRequestError && e.code === 'PRICE_CHANGED') {
        setAccepted(false)
        setStep(1)
        void refetchValidation()
      }
      setProgress(null)
      toast.error(e.message)
    },
  })

  const addChild = useMutation({
    mutationFn: (input: { name: string; birth_date: string }) => createChild(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['children'] })
      toast.success('Copil adăugat')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const goNext = () => setStep((s) => Math.min(s + 1, lastStep))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  function switchMethod(next: PaymentMethod) {
    setMethod(next)
    if (next === 'CARD' && !billingValid) {
      toast.message('Completează datele de facturare pentru plata cu cardul.')
      setStep(2)
    } else {
      setStep(next === 'CARD' ? 3 : 2)
    }
  }

  const busy = finalize.isPending

  return (
    <div>
      <Link
        to={-1 as unknown as string}
        onClick={(e) => {
          e.preventDefault()
          navigate(-1)
        }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>

      <h1 className="font-display text-2xl font-bold">Finalizează înscrierea</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        <Badge variant="outline">{KIND_LABEL[kind]}</Badge> <span className="ml-2">{offering.title}</span>
      </p>

      <ol className="mt-6 mb-8 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm',
              i === step ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground'
            )}
          >
            <span className="grid size-5 place-items-center rounded-full border text-xs">
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <section className="space-y-4">
          {childrenLoading ? (
            <Skeleton className="h-24 rounded-3xl" />
          ) : childrenFailed ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>Nu am putut încărca lista de copii.</p>
              <Button variant="outline" onClick={() => void refetchChildren()}>Reîncearcă</Button>
            </div>
          ) : children.length === 0 ? (
            <p className="text-muted-foreground rounded-3xl border border-dashed py-10 text-center">
              Nu ai copii înregistrați. Adaugă unul mai jos.
            </p>
          ) : (
            children.map((child) => {
              const verdict = verdictFor(child.id)
              const blocked = verdict?.eligible === false
              const checked = selected.includes(child.id)
              return (
                <label
                  key={child.id}
                  className={cn(
                    'bg-card shadow-card flex cursor-pointer items-start gap-3 rounded-3xl p-5',
                    blocked && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4"
                    checked={checked}
                    disabled={blocked}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, child.id] : prev.filter((c) => c !== child.id)
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{child.name}</span>
                      <span className="text-muted-foreground text-sm">{childAge(child.birth_date)} ani</span>
                      {verdict?.severity === 'error' && <Badge variant="destructive">Nu poate</Badge>}
                      {verdict?.severity === 'warning' && <Badge variant="outline">Atenție</Badge>}
                      {verdict && !verdict.severity && <Badge variant="success">Poate participa</Badge>}
                    </div>
                    {verdict?.reason && (
                      <p className="text-muted-foreground mt-1 flex items-start gap-1 text-sm">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        {verdict.reason}
                      </p>
                    )}
                  </div>
                </label>
              )
            })
          )}

          {validationFailed && (
            <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3 text-sm">
              <p className="text-destructive">
                Nu am putut verifica eligibilitatea:{' '}
                {validationError instanceof Error ? validationError.message : 'încearcă din nou.'}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetchValidation()}>
                Reîncearcă
              </Button>
            </div>
          )}

          {validation && !capacityOk && (
            <p className="text-destructive text-sm">
              Locuri insuficiente: mai sunt {validation.capacity.available}, ai nevoie de{' '}
              {selected.filter((cid) => verdictFor(cid)?.severity !== 'warning').length}.
            </p>
          )}

          <AddChildInline onAdd={(v) => addChild.mutate(v)} pending={addChild.isPending} />
        </section>
      )}
      {step === 1 && (
        <section className="space-y-6">
          {offering.perSession && (
            <div>
              <Label className="mb-2 block">Pachet de ședințe</Label>
              <div className="flex flex-wrap gap-2">
                {offering.packages.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPackageSize(size)}
                    className={cn(
                      'rounded-full border px-4 py-2 text-sm',
                      packageSize === size ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'
                    )}
                  >
                    {size} ședințe
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <Label htmlFor="custom-package" className="text-muted-foreground text-sm">
                    Altul
                  </Label>
                  <Input
                    id="custom-package"
                    type="number"
                    min={1}
                    className="w-24"
                    value={packageSize}
                    onChange={(e) => setPackageSize(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-card shadow-card rounded-3xl p-5">
            {selected.map((cid) => {
              const child = children.find((c) => c.id === cid)
              return (
                <div key={cid} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span className="min-w-0 truncate">{child?.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">{priceFor(cid) === undefined ? 'Preț indisponibil' : formatRon(priceFor(cid)!)}</span>
                </div>
              )
            })}
            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 font-semibold">
              <span>Total</span>
              <span className="shrink-0 tabular-nums">{pricesReady ? formatRon(total) : 'Preț indisponibil'}</span>
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={hasAccepted}
              onChange={(e) => { setAccepted(e.target.checked); setAcceptedCampPrices(currentCampPrices ?? null) }}
            />
            <span>
              Am citit și accept regulamentul și{' '}
              <Link to="/termeni" className="text-primary font-medium">
                termenii și condițiile
              </Link>
              .
            </span>
          </label>
        </section>
      )}
      {steps[step] === 'Facturare' && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Nume complet" value={billing.name} onChange={(v) => setBilling({ ...billing, name: v })} />
          <Field
            label="Email"
            type="email"
            value={billing.email}
            onChange={(v) => setBilling({ ...billing, email: v })}
          />
          <div className="sm:col-span-2">
            <Field
              label="Adresă"
              value={billing.addressLine1}
              onChange={(v) => setBilling({ ...billing, addressLine1: v })}
            />
          </div>
          <Field label="Oraș" value={billing.city} onChange={(v) => setBilling({ ...billing, city: v })} />
          <Field
            label="Cod poștal"
            value={billing.postalCode}
            onChange={(v) => setBilling({ ...billing, postalCode: v })}
          />
        </section>
      )}
      {step === lastStep && (
        <section className="space-y-6">
          <div className="bg-card shadow-card rounded-3xl p-5">
            <h2 className="mb-3 font-semibold">Sumar comandă</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{offering.title}</span>
              <span>{KIND_LABEL[kind]}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selected.length} {selected.length === 1 ? 'copil' : 'copii'}
                {offering.perSession && ` × ${packageSize} ședințe`}
              </span>
              <span className="font-semibold">{pricesReady ? formatRon(total) : 'Preț indisponibil'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Metodă de plată</Label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                checked={method === 'CARD'}
                disabled={!stripeConfigured}
                onChange={() => switchMethod('CARD')}
              />
              <span>Card bancar {!stripeConfigured && '(indisponibil — Stripe neconfigurat)'}</span>
            </label>
            {allowCash && (
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="radio"
                  checked={method === 'CASH'}
                  disabled={cashBlocked}
                  onChange={() => switchMethod('CASH')}
                />
                <span>Cash, la antrenor {cashBlocked && '(indisponibil — există o înscriere neplătită)'}</span>
              </label>
            )}
            {!paymentAvailable && (
              <p className="text-destructive text-sm">
                Nu există o metodă de plată disponibilă pentru această înscriere. Contactează clubul
                sau încearcă mai târziu.
              </p>
            )}
          </div>

          {method === 'CARD' ? (
            <div className="bg-card shadow-card rounded-3xl p-5">
              <Label className="mb-3 block">Date card</Label>
              <div className="rounded-xl border p-3">
                <CardElement options={{ hidePostalCode: true }} />
              </div>
            </div>
          ) : (
            <p className="bg-muted text-muted-foreground rounded-3xl p-5 text-sm">
              Înscrierea rămâne în așteptare până când antrenorul confirmă încasarea sumei de{' '}
              <strong>{pricesReady ? formatRon(total) : 'Preț indisponibil'}</strong>.
            </p>
          )}
        </section>
      )}
      {kind === 'CAMP' && !validationFetching && selected.length > 0 && (!pricesReady || (accepted && !hasAccepted)) && (
        <div role="alert" className="text-destructive mt-4 space-y-2 text-sm">
          <p>{pricesReady ? 'Prețurile s-au schimbat. Revino la Detalii și confirmă suma.' : 'Prețul sau eligibilitatea unui copil nu este disponibilă. Verifică din nou selecția.'}</p>
          <Button variant="outline" onClick={() => { setStep(pricesReady ? 1 : 0); setAccepted(false); void refetchValidation() }}>
            Verifică din nou
          </Button>
        </div>
      )}
      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={goBack} disabled={busy}>
            Înapoi
          </Button>
        )}
        {step < lastStep ? (
          <Button onClick={goNext} disabled={!canAdvance}>
            Continuă
          </Button>
        ) : (
          <Button
            onClick={() => finalize.mutate()}
            disabled={busy || selected.length === 0 || !paymentAvailable || !validationReady || !pricesReady || !hasAccepted}
          >
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {busy ? (progress ?? 'Se procesează…') : 'Finalizează'}
          </Button>
        )}
      </div>
    </div>
  )
}
