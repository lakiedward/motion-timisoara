import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { getMyChildren } from '@/api/account'
import { EnrollmentRequestError, type BillingDetails, type PaymentMethod } from '@/api/checkout'
import type { CompetitionCategory, CompetitionRoute } from '@/api/competition/competition-offers'
import type { PublicCompetition } from '@/api/competition/competitions'
import {
  createCompetitionRegistration,
  validateCompetitionRegistration,
  type CompetitionSelection,
} from '@/api/competition/competition-registration'
import { processEnrollmentPayments, paymentResultMessage } from '@/api/payments/process'
import { startStripeCheckout } from '@/api/payments/checkout-session'
import { useAuth } from '@/lib/auth-context'
import { formatRonOffer } from '@/lib/money'
import { stripeConfigured } from '@/lib/stripe'
import { BackLink } from '@/components/page-header/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { CheckoutBillingFields } from '@/features/account/checkout/CheckoutBillingFields'
import { CheckoutPaymentStep } from '@/features/account/checkout/CheckoutPaymentStep'
import { CheckoutOrderSummary } from '@/features/account/checkout/CheckoutOrderSummary'
import { CheckoutSteps } from '@/features/account/checkout/CheckoutSteps'
import { STEP_COPY, checkoutStepLabels } from '@/features/account/checkout/checkout-flow'
import { usePaymentAdapter } from '@/features/account/checkout/usePaymentAdapter'
import { useCompetitionClock } from '../useCompetitionClock'
import { CompetitionParticipantsStep } from './CompetitionParticipantsStep'
import { CompetitionPriceStep } from './CompetitionPriceStep'
import {
  PARTICIPANTS_COPY,
  competitionAdvanceHint,
  participantKey,
  selectionKey,
  validBirthDate,
} from './competition-registration-flow'

type Props = {
  competition: PublicCompetition
  categories: CompetitionCategory[]
  routes: CompetitionRoute[]
}

export function CompetitionRegistrationForm({ competition, categories, routes }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const payment = usePaymentAdapter()
  const now = useCompetitionClock(competition.registrationDeadlineAt)
  const createdIds = useRef<string[]>([])
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [includeSelfChoice, setIncludeSelf] = useState<boolean | null>(null)
  const [selfBirthDate, setSelfBirthDate] = useState('')
  const [selfCategoryChoice, setSelfCategoryId] = useState<string | null>(null)
  const categoryOptions = categories.map((category) => {
    const route = routes.find((item) => item.id === category.route_id)
    const range = `${category.age_from}–${category.age_to} ani · ${formatRonOffer(category.price_bani)}`
    return {
      value: category.id,
      label:
        routes.length > 1 && route
          ? `${route.name} · ${category.name} · ${range}`
          : `${category.name} · ${range}`,
    }
  })
  function categoryTitle(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId)
    const route = routes.find((item) => item.id === category?.route_id)
    return routes.length > 1 && route ? `${route.name} · ${category?.name}` : category?.name
  }
  const [acceptedKey, setAcceptedKey] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('CARD')
  const [billing, setBilling] = useState<BillingDetails>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    addressLine1: '',
    city: '',
    postalCode: '',
  })
  const [progress, setProgress] = useState<string | null>(null)

  const children = useQuery({
    queryKey: ['children'],
    queryFn: getMyChildren,
    enabled: user?.role === 'PARENT',
  })
  const presetCategoryId = categories.find(
    (category) => category.id === searchParams.get('categorie'),
  )?.id
  const presetChildId = presetCategoryId ? children.data?.[0]?.id : undefined
  const presetSelf = Boolean(presetCategoryId) && children.isSuccess && !children.data.length
  const includeSelf = includeSelfChoice ?? presetSelf
  const selfCategoryId = selfCategoryChoice ?? (presetSelf ? (presetCategoryId ?? '') : '')
  const effectiveChoice: Record<string, string> =
    presetChildId && presetCategoryId && !(presetChildId in choice)
      ? { [presetChildId]: presetCategoryId, ...choice }
      : choice
  const childSelections: CompetitionSelection[] = Object.entries(effectiveChoice)
    .filter(([, categoryId]) => Boolean(categoryId))
    .map(([childId, categoryId]) => ({ childId, categoryId }))
    .sort((a, b) => participantKey(a).localeCompare(participantKey(b)))
  const selfComplete = !includeSelf || (validBirthDate(selfBirthDate) && Boolean(selfCategoryId))
  const selections: CompetitionSelection[] = [
    ...childSelections,
    ...(includeSelf && selfComplete ? [{ selfBirthDate, categoryId: selfCategoryId }] : []),
  ]
  const validation = useQuery({
    queryKey: ['competition-registration-validation', competition.id, selections],
    queryFn: () => validateCompetitionRegistration(competition.id, selections),
    enabled: Boolean(user && selections.length > 0 && selfComplete),
    retry: false,
  })
  const verdicts = validation.data?.results ?? []
  const verdictFor = (key: string) => verdicts.find((verdict) => verdict.participantKey === key)
  const pricesReady =
    selfComplete &&
    validation.isSuccess &&
    verdicts.length === selections.length &&
    selections.every((selection) => {
      const verdict = verdictFor(participantKey(selection))
      return (
        verdict?.eligible &&
        verdict.categoryId === selection.categoryId &&
        ('selfBirthDate' in selection
          ? verdict.adultBirthDate === selection.selfBirthDate &&
            verdict.adultProfileId === user?.id
          : verdict.childId === selection.childId) &&
        typeof verdict.amount === 'number' &&
        Boolean(verdict.priceVersion)
      )
    })
  const total = pricesReady
    ? selections.reduce(
        (sum, selection) => sum + (verdictFor(participantKey(selection))?.amount ?? 0),
        0,
      )
    : 0
  const free = pricesReady && total === 0
  const versions = Object.fromEntries(
    selections.map((selection) => [
      participantKey(selection),
      verdictFor(participantKey(selection))?.priceVersion ?? '',
    ]),
  )
  const currentKey = selectionKey(selections, versions)
  const accepted = acceptedKey === currentKey
  const allowCash = validation.data?.allowCash ?? competition.allowCash
  const paymentMethod: PaymentMethod = free ? 'CARD' : method
  const billingValid =
    billing.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(billing.email) &&
    billing.addressLine1.trim().length > 2 &&
    billing.city.trim().length > 1 &&
    billing.postalCode.trim().length > 2
  const methodAvailable =
    free || (paymentMethod === 'CASH' ? allowCash : stripeConfigured && payment.ready)
  const closed = Boolean(
    competition.registrationDeadlineAt && Date.parse(competition.registrationDeadlineAt) <= now,
  )

  const finalize = useMutation({
    mutationFn: async () => {
      if (closed) throw new Error('Înscrierile la acest concurs sunt închise.')
      if (!selfComplete || !pricesReady || !accepted || selections.length === 0) {
        throw new Error('Verifică selecția și confirmă prețul înainte de înscriere.')
      }
      if (!methodAvailable || (paymentMethod === 'CARD' && !free && !billingValid)) {
        throw new Error('Alege o metodă de plată disponibilă și completează facturarea.')
      }
      if (createdIds.current.length) {
        throw new Error('Înscrierile sunt deja salvate. Reia plata din Înscrieri.')
      }
      setProgress('Verificăm din nou categoriile și prețurile…')
      const fresh = await validateCompetitionRegistration(competition.id, selections)
      const freshVersions = Object.fromEntries(
        fresh.results.map((result) => [result.participantKey, result.priceVersion ?? '']),
      )
      if (
        fresh.results.length !== selections.length ||
        fresh.results.some(
          (result) =>
            !result.eligible ||
            !selections.some(
              (selection) =>
                result.participantKey === participantKey(selection) &&
                result.categoryId === selection.categoryId &&
                ('selfBirthDate' in selection
                  ? result.adultBirthDate === selection.selfBirthDate &&
                    result.adultProfileId === user?.id
                  : result.childId === selection.childId),
            ),
        ) ||
        selectionKey(selections, freshVersions) !== currentKey
      ) {
        throw new EnrollmentRequestError(
          'Categoria sau prețul s-a schimbat. Confirmă noua ofertă.',
          'PRICE_CHANGED',
        )
      }
      setProgress('Salvăm înscrierile…')
      const created = await createCompetitionRegistration({
        competitionId: competition.id,
        selections,
        paymentMethod,
        priceVersions: versions,
        billingDetails: free || paymentMethod !== 'CARD' ? undefined : billing,
      })
      createdIds.current = created.enrollmentIds
      if (created.enrollmentIds.length === 0)
        throw new Error('Nu s-au creat înscrieri. Încearcă din nou.')
      if (free) return 'free'
      if (paymentMethod === 'CASH') return 'cash'
      if (!created.requiresPaymentIntent) return 'pending'
      if (!payment.android) {
        setProgress('Te ducem la Stripe…')
        return (await startStripeCheckout(created.enrollmentIds)) === 'paid' ? 'paid' : 'redirected'
      }
      const result = await processEnrollmentPayments(
        created.enrollmentIds,
        payment.adapter,
        (value) => {
          setProgress(
            value.confirming
              ? 'Confirmăm plata…'
              : `Plata ${value.index} din ${value.total} · ${value.child}`,
          )
        },
      )
      return result
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      if (result === 'redirected') return
      if (result === 'paid') toast.success('Plata este deja confirmată.')
      else if (result === 'free') toast.success('Înscriere confirmată. Nu este nevoie de plată.')
      else if (result === 'cash')
        toast.success('Înscriere înregistrată. Plata cash așteaptă confirmarea organizatorului.')
      else if (result === 'pending')
        toast.message('Înscrierea este salvată. Verifică plata în Înscrieri.')
      else toast.message(paymentResultMessage(result))
      navigate('/account/enrollments')
    },
    onError: (error: Error) => {
      setProgress(null)
      if (error instanceof EnrollmentRequestError && error.code === 'PRICE_CHANGED') {
        setAcceptedKey(null)
        void validation.refetch()
      }
      toast.error(error.message)
      if (createdIds.current.length) navigate('/account/enrollments')
    },
  })

  const steps = checkoutStepLabels(free, method, true)
  const lastStep = steps.length - 1
  const [rawStep, setStep] = useState(0)
  const step = Math.min(rawStep, lastStep)
  const stepName = steps[step]
  const checking = validation.isFetching
  const canAdvance =
    stepName === 'Participanți'
      ? selections.length > 0 && selfComplete && pricesReady && !checking
      : stepName === 'Detalii'
        ? pricesReady && accepted
        : stepName === 'Facturare'
          ? billingValid
          : true
  const hint =
    step < lastStep && !canAdvance
      ? competitionAdvanceHint({
          step: stepName,
          selectionCount: selections.length,
          includeSelf,
          selfComplete,
          checking,
          pricesReady,
          accepted,
        })
      : null
  const copy = stepName === 'Participanți' ? PARTICIPANTS_COPY : STEP_COPY[stepName]
  const busy = finalize.isPending || finalize.data === 'redirected'

  function participantName(selection: CompetitionSelection) {
    return (
      ('childId' in selection && selection.childId
        ? children.data?.find((child) => child.id === selection.childId)?.name
        : user?.name) ?? ''
    )
  }

  function switchMethod(next: PaymentMethod) {
    setMethod(next)
    if (next === 'CARD' && !billingValid) {
      toast.message('Completează datele de facturare pentru plata cu cardul.')
      setStep(2)
    } else {
      setStep(next === 'CARD' ? 3 : 2)
    }
  }

  function resetAcceptance() {
    setAcceptedKey(null)
  }

  if (!user) {
    return (
      <p role="alert" className="py-10">
        Autentifică-te pentru a te înscrie la concurs.
      </p>
    )
  }

  const priceStale = step > 0 && !checking && (!pricesReady || (step > 1 && !accepted))

  const primary =
    step < lastStep ? (
      <Button
        className="w-full sm:w-auto"
        size="lg"
        onClick={() => setStep(step + 1)}
        disabled={!canAdvance}
        aria-describedby={hint ? 'competition-advance-hint' : undefined}
      >
        Continuă
        <ArrowRight aria-hidden="true" />
      </Button>
    ) : (
      <Button
        className="w-full sm:w-auto"
        size="lg"
        disabled={
          !pricesReady ||
          !accepted ||
          !methodAvailable ||
          (!free && paymentMethod === 'CARD' && !billingValid) ||
          busy
        }
        onClick={() => finalize.mutate()}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy
          ? (progress ?? 'Se procesează…')
          : free
            ? 'Confirmă înscrierea gratuită'
            : paymentMethod === 'CARD' && !payment.android && pricesReady
              ? `Plătește ${formatRonOffer(total)} pe Stripe`
              : 'Finalizează înscrierea'}
      </Button>
    )

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20 lg:pb-0">
      <div>
        <BackLink to={`/concursuri/${competition.slug}`}>Înapoi la concurs</BackLink>
        <h1 className="font-display text-2xl font-bold">Finalizează înscrierea</h1>
        <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">Concurs</Badge>
          <span>{competition.title}</span>
        </p>
      </div>

      {closed ? (
        <StatusView state="empty" title="Termenul înscrierilor a trecut." />
      ) : categories.length === 0 ? (
        <StatusView state="empty" title="Organizatorul nu a adăugat încă nicio categorie." />
      ) : (
        <>
          <CheckoutSteps steps={steps} current={step} />
          <div className="bg-card rounded-xl border">
            <div className="space-y-6 p-5 sm:p-6">
              <div>
                <h2 className="font-display text-lg font-semibold">{copy?.title ?? stepName}</h2>
                {copy && <p className="text-muted-foreground mt-1 text-sm">{copy.text}</p>}
              </div>
              {stepName === 'Participanți' && (
                <CompetitionParticipantsStep
                  showChildren={user.role === 'PARENT'}
                  children={children.data}
                  childrenLoading={children.isLoading}
                  childrenFailed={children.isError}
                  retryChildren={() => void children.refetch()}
                  choice={effectiveChoice}
                  onChoice={(childId, categoryId) => {
                    setChoice((previous) => ({ ...previous, [childId]: categoryId }))
                    resetAcceptance()
                  }}
                  categoryOptions={categoryOptions}
                  verdictFor={verdictFor}
                  includeSelf={includeSelf}
                  onIncludeSelf={(value) => {
                    setIncludeSelf(value)
                    resetAcceptance()
                  }}
                  selfBirthDate={selfBirthDate}
                  onSelfBirthDate={(value) => {
                    setSelfBirthDate(value)
                    resetAcceptance()
                  }}
                  selfCategoryId={selfCategoryId}
                  onSelfCategory={(value) => {
                    setSelfCategoryId(value)
                    resetAcceptance()
                  }}
                  validationFailed={validation.isError}
                  retryValidation={() => void validation.refetch()}
                />
              )}
              {stepName === 'Detalii' && (
                <CompetitionPriceStep
                  lines={selections.map((selection) => ({
                    key: participantKey(selection),
                    label: `${participantName(selection)} · ${categoryTitle(selection.categoryId)}`,
                    amount: verdictFor(participantKey(selection))?.amount,
                  }))}
                  total={pricesReady ? total : undefined}
                  accepted={accepted}
                  disabled={!pricesReady}
                  onAcceptedChange={(value) => setAcceptedKey(value ? currentKey : null)}
                />
              )}
              {stepName === 'Facturare' && (
                <CheckoutBillingFields billing={billing} setBilling={setBilling} />
              )}
              {stepName === 'Plată' && (
                <CheckoutPaymentStep
                  summary={
                    <CheckoutOrderSummary
                      title={competition.title}
                      kindLabel="Concurs"
                      lines={selections.map((selection) => ({
                        id: participantKey(selection),
                        name: participantName(selection),
                        adult: !('childId' in selection && selection.childId),
                        amount: verdictFor(participantKey(selection))?.amount,
                        snapshot: verdictFor(participantKey(selection))?.pricingSnapshot,
                      }))}
                      total={pricesReady ? total : undefined}
                    />
                  }
                  childCount={selections.length}
                  total={pricesReady ? total : undefined}
                  method={method}
                  allowCash={allowCash}
                  cashBlocked={false}
                  paymentAvailable={allowCash || stripeConfigured}
                  switchMethod={switchMethod}
                />
              )}
              {priceStale && (
                <div role="alert" className="text-destructive space-y-2 text-sm">
                  <p>
                    {pricesReady
                      ? 'Prețurile s-au schimbat. Revino la Detalii și confirmă suma.'
                      : 'Prețul sau eligibilitatea unui participant nu este disponibilă. Verifică din nou selecția.'}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep(pricesReady ? 1 : 0)
                      resetAcceptance()
                      void validation.refetch()
                    }}
                  >
                    Verifică din nou
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-3 border-t p-5 sm:px-6">
              {hint && (
                <p id="competition-advance-hint" className="text-muted-foreground text-sm">
                  {hint}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                {step > 0 ? (
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setStep(step - 1)}
                    disabled={busy}
                  >
                    Înapoi
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
                {primary}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
