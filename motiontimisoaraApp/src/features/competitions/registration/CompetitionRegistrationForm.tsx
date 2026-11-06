import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { childAge, getMyChildren } from '@/api/account'
import { EnrollmentRequestError, type BillingDetails, type PaymentMethod } from '@/api/checkout'
import type { CompetitionCategory } from '@/api/competition/competition-offers'
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
import { cn } from '@/lib/utils'
import { BackLink } from '@/components/page-header/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { SelectMenu } from '@/components/ui/select-menu'
import { CheckoutBillingFields } from '@/features/account/checkout/CheckoutBillingFields'
import { CheckoutPaymentStep } from '@/features/account/checkout/CheckoutPaymentStep'
import { CheckoutOrderSummary } from '@/features/account/checkout/CheckoutOrderSummary'
import { usePaymentAdapter } from '@/features/account/checkout/usePaymentAdapter'
import { useCompetitionClock } from '../useCompetitionClock'
import { Checkbox } from '@/components/ui/checkbox'

type Props = { competition: PublicCompetition; categories: CompetitionCategory[] }

function selectionKey(
  selections: CompetitionSelection[],
  versions: Record<string, string>,
): string {
  return JSON.stringify(
    selections.map((selection) => [
      participantKey(selection),
      selection.categoryId,
      'selfBirthDate' in selection ? selection.selfBirthDate : null,
      versions[participantKey(selection)] ?? '',
    ]),
  )
}

function participantKey(selection: CompetitionSelection): string {
  return selection.childId ?? 'self'
}

function validBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value <= new Date().toISOString().slice(0, 10)
  )
}

export function CompetitionRegistrationForm({ competition, categories }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const payment = usePaymentAdapter()
  const now = useCompetitionClock(competition.registrationDeadlineAt)
  const createdIds = useRef<string[]>([])
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [includeSelf, setIncludeSelf] = useState(false)
  const [selfBirthDate, setSelfBirthDate] = useState('')
  const [selfCategoryId, setSelfCategoryId] = useState('')
  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: `${category.name} · ${category.age_from}–${category.age_to} ani · ${formatRonOffer(category.price_bani)}`,
  }))
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
  const childSelections: CompetitionSelection[] = Object.entries(choice)
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

  if (!user) {
    return (
      <p role="alert" className="py-10">
        Autentifică-te pentru a te înscrie la concurs.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <BackLink to={`/concursuri/${competition.slug}`}>Înapoi la concurs</BackLink>
        <h1 className="font-display text-2xl font-bold">Finalizează înscrierea</h1>
        <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">Concurs</Badge>
          <span>{competition.title}</span>
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          Alege categoriile participanților pe care dorești să îi înscrii.
        </p>
      </div>

      {closed ? (
        <StatusView state="empty" title="Termenul înscrierilor a trecut." />
      ) : categories.length === 0 ? (
        <StatusView state="empty" title="Organizatorul nu a adăugat încă nicio categorie." />
      ) : (
        <>
          {user.role === 'PARENT' &&
            (children.isLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : children.isError ? (
              <StatusView
                state="error"
                title="Nu am putut încărca lista de copii."
                onRetry={() => void children.refetch()}
              />
            ) : children.data?.length === 0 ? (
              <StatusView
                state="empty"
                title="Nu ai copii adăugați. Te poți înscrie pe tine mai jos."
                action={
                  <Button
                    asChild
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                  >
                    <Link to="/account/child/new">Adaugă copil</Link>
                  </Button>
                }
              />
            ) : (
              <section className="space-y-4" aria-label="Copii și categorii">
                {children.data?.map((child) => {
                  const verdict = verdictFor(child.id)
                  return (
                    <div
                      key={child.id}
                      className={cn(
                        'bg-card rounded-xl border p-4',
                        verdict?.eligible && 'border-primary',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full font-bold"
                        >
                          {child.name.charAt(0)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Label
                            htmlFor={`competition-category-${child.id}`}
                            className="font-semibold"
                          >
                            {child.name}
                          </Label>
                          <span className="text-muted-foreground text-sm">
                            {childAge(child.birth_date)} ani
                          </span>
                          {verdict?.eligible && <Badge variant="success">Poate participa</Badge>}
                          {verdict && !verdict.eligible && (
                            <Badge variant="destructive">Nu poate</Badge>
                          )}
                        </div>
                      </div>
                      <SelectMenu
                        id={`competition-category-${child.id}`}
                        value={choice[child.id] ?? ''}
                        onValueChange={(value) => {
                          setChoice((previous) => ({ ...previous, [child.id]: value }))
                          setAcceptedKey(null)
                        }}
                        emptyLabel="Nu înscrie acest copil"
                        options={categoryOptions}
                        className="mt-3"
                      />
                      {verdict && !verdict.eligible && (
                        <p role="alert" className="text-destructive mt-2 text-sm">
                          {verdict.reason ?? 'Categoria nu este disponibilă pentru acest copil.'}
                        </p>
                      )}
                      {verdict?.eligible && typeof verdict.amount === 'number' && (
                        <p className="text-muted-foreground mt-2 text-sm">
                          Preț verificat: {formatRonOffer(verdict.amount)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}

          <section
            className="bg-card space-y-4 rounded-xl border p-5"
            aria-label="Înscriere proprie"
          >
            <label className="flex min-h-11 items-center gap-3 font-semibold">
              <Checkbox
                checked={includeSelf}
                onChange={(event) => {
                  setIncludeSelf(event.target.checked)
                  setAcceptedKey(null)
                }}
              />
              Mă înscriu eu
            </label>
            {includeSelf && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Data nașterii este folosită pentru categoria de vârstă la data înscrierii.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="competition-self-birth-date">Data mea de naștere</Label>
                  <Input
                    id="competition-self-birth-date"
                    type="date"
                    value={selfBirthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => {
                      setSelfBirthDate(event.target.value)
                      setAcceptedKey(null)
                    }}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competition-self-category">Categoria mea</Label>
                  <SelectMenu
                    id="competition-self-category"
                    value={selfCategoryId}
                    onValueChange={(value) => {
                      setSelfCategoryId(value)
                      setAcceptedKey(null)
                    }}
                    emptyLabel="Alege categoria"
                    options={categoryOptions}
                  />
                </div>
                {!selfComplete && (
                  <p className="text-muted-foreground text-sm">
                    Completează data nașterii și categoria pentru verificarea prețului.
                  </p>
                )}
                {verdictFor('self') && !verdictFor('self')?.eligible && (
                  <p role="alert" className="text-destructive text-sm">
                    {verdictFor('self')?.reason ?? 'Categoria nu este disponibilă pentru tine.'}
                  </p>
                )}
                {verdictFor('self')?.eligible && typeof verdictFor('self')?.amount === 'number' && (
                  <p className="text-muted-foreground text-sm">
                    Preț verificat: {formatRonOffer(verdictFor('self')!.amount!)}
                  </p>
                )}
              </div>
            )}
          </section>

          {selections.length > 0 && (
            <section className="space-y-5">
              {validation.isPending && <Skeleton className="h-24 rounded-2xl" />}
              {validation.isError && (
                <StatusView
                  state="error"
                  title="Nu am putut verifica eligibilitatea și prețul."
                  onRetry={() => void validation.refetch()}
                />
              )}
              {validation.isSuccess && (
                <>
                  <div className="bg-card rounded-xl border p-5">
                    <h2 className="font-display text-lg font-bold">Prețul înscrierii</h2>
                    {selections.map((selection) => (
                      <div
                        key={participantKey(selection)}
                        className="mt-3 flex justify-between gap-3 text-sm"
                      >
                        <span>
                          {'childId' in selection
                            ? children.data?.find((child) => child.id === selection.childId)?.name
                            : user.name}{' '}
                          ·{' '}
                          {
                            categories.find((category) => category.id === selection.categoryId)
                              ?.name
                          }
                        </span>
                        <strong>
                          {verdictFor(participantKey(selection))?.amount === undefined
                            ? 'Indisponibil'
                            : formatRonOffer(verdictFor(participantKey(selection))!.amount!)}
                        </strong>
                      </div>
                    ))}
                    <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
                      <span>Total</span>
                      <span>{pricesReady ? formatRonOffer(total) : 'Indisponibil'}</span>
                    </div>
                  </div>

                  <label className="flex min-h-11 items-start gap-3 text-sm">
                    <Checkbox
                      checked={accepted}
                      disabled={!pricesReady}
                      onChange={(event) => setAcceptedKey(event.target.checked ? currentKey : null)}
                    />
                    <span>
                      Confirm categoriile și suma finală în lei și accept{' '}
                      <Link to="/termeni" className="text-primary font-medium">
                        termenii și condițiile
                      </Link>
                      .
                    </span>
                  </label>

                  {pricesReady && !free && (
                    <>
                      {method === 'CARD' && (
                        <CheckoutBillingFields billing={billing} setBilling={setBilling} />
                      )}
                      <CheckoutPaymentStep
                        summary={
                          <CheckoutOrderSummary
                            title={competition.title}
                            kindLabel="Concurs"
                            lines={selections.map((selection) => ({
                              id: participantKey(selection),
                              name:
                                ('childId' in selection
                                  ? children.data?.find((child) => child.id === selection.childId)
                                      ?.name
                                  : user.name) ?? '',
                              adult: !('childId' in selection),
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
                        switchMethod={setMethod}
                      />
                    </>
                  )}

                  <Button
                    className="h-11 min-h-11"
                    disabled={
                      !pricesReady ||
                      !accepted ||
                      !methodAvailable ||
                      (!free && paymentMethod === 'CARD' && !billingValid) ||
                      finalize.isPending ||
                      finalize.data === 'redirected'
                    }
                    onClick={() => finalize.mutate()}
                  >
                    {finalize.isPending || finalize.data === 'redirected'
                      ? (progress ?? 'Se procesează…')
                      : free
                        ? 'Confirmă înscrierea gratuită'
                        : 'Finalizează înscrierea'}
                  </Button>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
