import { CircleAlert, TriangleAlert } from 'lucide-react'

import { PageHeader } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { NoticeRow } from '@/features/billing/StripeNotice'
import { CardPaymentsMonthCard } from '@/features/payments/CardPaymentsMonthCard'
import { formatPlanPrice, PRICE_NOTE } from '@/features/public/pricing/pricing-content'
import { CheckoutReturnNotice } from '@/features/subscriptions/CheckoutReturnNotice'
import { SubscriptionStatusCard } from '@/features/subscriptions/SubscriptionStatusCard'
import { subscriptionQueryKey } from '@/features/subscriptions/use-subscription'
import { SubscriptionBillingError } from '@/api/subscriptions/billing'
import { formatShortDate } from '@/lib/panel-date'
import { ClubPlanList } from './ClubPlanList'
import { PlanChangeDialog } from './PlanChangeDialog'
import { currentPlan, limitWarning, nextLargerPlan, type PlanContext } from './plan-actions'
import { useClubSubscription, type ClubSubscriptionState } from './useClubSubscription'

const RETURN_KEYS = [subscriptionQueryKey('CLUB')]

function plansNote(context: PlanContext): string | null {
  switch (context.view.kind) {
    case 'launch_pending':
      return 'Pachetele se pot alege după lansarea abonamentelor. Până atunci, clubul are acces complet, fără limită de antrenori.'
    case 'trialing':
      return context.subscription?.hasStripeSubscription
        ? null
        : 'În perioada gratuită clubul nu are limită de antrenori. Alege un pachet în care încap antrenorii clubului.'
    case 'past_due':
      return 'Ca să schimbi pachetul, actualizează întâi cardul din „Gestionează abonamentul”.'
    case 'canceled':
      return 'Ca să schimbi pachetul, reactivează întâi abonamentul din „Gestionează abonamentul”.'
    case 'missing':
      return 'Pachetele apar aici imediat ce abonamentul clubului este pregătit.'
    default:
      return null
  }
}

function ActionError({ state }: { state: ClubSubscriptionState }) {
  const error = state.redirect.error ?? state.change.error
  if (!error) return null
  const remove =
    error instanceof SubscriptionBillingError ? error.details.coachesToRemove : undefined
  return (
    <NoticeRow
      role="alert"
      tone="error"
      icon={<CircleAlert aria-hidden="true" className="text-destructive mt-0.5 size-5 shrink-0" />}
    >
      <p className="font-semibold" data-testid="subscription-action-error">
        {error.message}
      </p>
      {remove ? (
        <p className="text-muted-foreground">
          Scoate {remove === 1 ? 'un antrenor' : `${remove} antrenori`} din club ca să alegi acest
          pachet.
        </p>
      ) : null}
    </NoticeRow>
  )
}

function LimitNotice({ context }: { context: PlanContext }) {
  const warning = limitWarning(context)
  if (!warning) return null
  const larger = nextLargerPlan(context)
  return (
    <NoticeRow
      role="status"
      tone="error"
      icon={
        <TriangleAlert aria-hidden="true" className="text-destructive mt-0.5 size-5 shrink-0" />
      }
    >
      <p className="font-semibold" data-testid="coach-limit-warning">
        {warning.over
          ? `Clubul are ${warning.coachCount} antrenori, peste limita de ${warning.coachLimit} a pachetului ${warning.planName}.`
          : `Ai ajuns la limita pachetului ${warning.planName}: ${warning.coachCount} din ${warning.coachLimit} antrenori.`}
      </p>
      <p className="text-muted-foreground">
        {larger
          ? `Pentru un antrenor nou, treci la ${larger.name}. Schimbarea e imediată.`
          : 'Pentru un antrenor nou, scoate întâi un antrenor din club.'}
      </p>
    </NoticeRow>
  )
}

function scheduledNote(context: PlanContext) {
  const code = context.subscription?.scheduledPlanCode
  const current = currentPlan(context)
  if (!code || !current || code === current.code) return null
  const next = context.plans.find((plan) => plan.code === code)
  if (!next) return null
  const end = context.view.kind === 'active' ? context.view.nextChargeAt : null
  return (
    <p className="text-foreground text-sm font-medium" data-testid="scheduled-plan-note">
      {end ? `De la ${formatShortDate(end)}` : 'De luna viitoare'} treci la {next.name} (
      {formatPlanPrice(next.priceBani)} lei / lună).
    </p>
  )
}

export default function ClubSubscriptionPage() {
  const state = useClubSubscription()

  if (state.isLoading) {
    return (
      <div className="max-w-5xl">
        <PageHeader title="Abonament" />
        <StatusView state="loading" title="Se încarcă abonamentul" rows={3} />
      </div>
    )
  }
  if (state.isError || !state.context) {
    return (
      <div className="max-w-5xl">
        <PageHeader title="Abonament" />
        <StatusView
          state="error"
          title="Nu am putut încărca abonamentul clubului"
          onRetry={() => void state.refetch()}
          retrying={state.isFetching}
        />
      </div>
    )
  }

  const { context, redirect, busy } = state
  const plan =
    currentPlan(context) ??
    context.plans.find((p) => p.code === context.subscription?.planCode) ??
    null
  const note = plansNote(context)
  const canManage = context.subscription?.hasStripeCustomer && context.view.kind !== 'missing'

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <PageHeader title="Abonament" className="mb-1" />
        <p className="text-muted-foreground">
          Abonamentul ține clubul și ofertele lui vizibile pe Motion România. Antrenorii clubului
          sunt incluși.
        </p>
      </div>
      <CheckoutReturnNotice queryKeys={RETURN_KEYS} />
      <ActionError state={state} />
      <SubscriptionStatusCard
        view={context.view}
        plan={plan ? { name: plan.name, priceLei: formatPlanPrice(plan.priceBani) } : null}
        note={scheduledNote(context)}
      >
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            className="h-touch-target min-h-touch-target"
            disabled={busy}
            onClick={() => void redirect.portal()}
            data-testid="billing-portal"
          >
            {redirect.busy?.kind === 'portal' ? 'Se deschide…' : 'Gestionează abonamentul'}
          </Button>
        ) : null}
      </SubscriptionStatusCard>
      <LimitNotice context={context} />
      <section className="space-y-3" aria-labelledby="club-plans-title">
        <div>
          <h2 id="club-plans-title" className="font-display text-foreground text-xl font-bold">
            Pachete
          </h2>
          <p className="text-muted-foreground text-sm">
            Clubul are acum{' '}
            {context.coachCount === 1 ? 'un antrenor' : `${context.coachCount} antrenori`}. Treci
            imediat la un pachet mai mare; unul mai mic intră de la luna următoare.
          </p>
          {note && <p className="text-muted-foreground mt-1 text-sm">{note}</p>}
        </div>
        <ClubPlanList context={context} state={state} />
      </section>
      <p className="text-muted-foreground max-w-3xl text-sm">{PRICE_NOTE}</p>
      <CardPaymentsMonthCard
        enabled={state.club.data?.stripe_onboarding_complete === true}
        offersLabel="ofertele clubului"
        netLabel="Primește clubul"
      />
      <PlanChangeDialog state={state} />
    </div>
  )
}
