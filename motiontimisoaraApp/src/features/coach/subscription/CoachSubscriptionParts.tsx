import { Building2, CircleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NoticeRow } from '@/features/billing/StripeNotice'
import type { CoachSubscriptionState } from './use-coach-subscription'

export function CoachSubscriptionActions({ state }: { state: CoachSubscriptionState }) {
  const { checkoutAllowed, manageAllowed, plan, billing, view } = state
  const working = billing.busy !== null
  return (
    <>
      {checkoutAllowed && plan ? (
        <Button type="button" disabled={working} onClick={() => void billing.checkout(plan.code)}>
          {billing.busy?.kind === 'checkout' ? 'Se deschide plata…' : 'Alege abonamentul'}
        </Button>
      ) : null}
      {manageAllowed ? (
        <Button
          type="button"
          variant={view?.kind === 'past_due' ? 'default' : 'outline'}
          disabled={working}
          onClick={() => void billing.portal()}
        >
          {billing.busy?.kind === 'portal' ? 'Se deschide Stripe…' : 'Gestionează abonamentul'}
        </Button>
      ) : null}
    </>
  )
}

export function CoachSubscriptionError({ state }: { state: CoachSubscriptionState }) {
  const { error } = state.billing
  if (!error) return null
  return (
    <NoticeRow
      role="alert"
      tone="error"
      icon={<CircleAlert aria-hidden="true" className="text-destructive mt-0.5 size-5 shrink-0" />}
    >
      <p data-testid="subscription-error" className="font-semibold">
        {error.message}
      </p>
    </NoticeRow>
  )
}

export function ClubCoverNotice({ state }: { state: CoachSubscriptionState }) {
  const names = state.coveringClubs.map((club) => club.name)
  if (names.length === 0) return null
  return (
    <NoticeRow
      icon={
        <Building2 aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />
      }
    >
      <p data-testid="club-cover-notice" className="font-semibold">
        {names.length === 1 ? `Clubul ${names[0]}` : `Cluburile ${names.join(', ')}`} acoperă
        ofertele făcute prin club.
      </p>
      <p className="text-muted-foreground">
        Abonamentul tău este necesar doar pentru ofertele pe care le publici în nume propriu.
      </p>
    </NoticeRow>
  )
}
