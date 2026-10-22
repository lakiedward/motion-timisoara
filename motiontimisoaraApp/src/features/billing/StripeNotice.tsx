import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Clock, Info, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StripeOnboardingState } from './useStripeOnboarding'

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="border-primary mt-0.5 size-5 shrink-0 animate-spin rounded-full border-2 border-t-transparent"
    />
  )
}

function Row({
  icon,
  role,
  tone = 'muted',
  children,
}: {
  icon: ReactNode
  role?: 'status' | 'alert'
  tone?: 'muted' | 'success' | 'error'
  children: ReactNode
}) {
  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-3 rounded-xl p-4 text-sm',
        tone === 'success' && 'bg-success/14 text-foreground',
        tone === 'error' && 'bg-destructive/14 text-foreground',
        tone === 'muted' && 'bg-muted text-foreground',
      )}
    >
      {icon}
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  )
}

export function StripeNotice({ state }: { state: StripeOnboardingState }) {
  const { phase, unavailable, actionError, entity, complete, retry, busy } = state
  if (unavailable) {
    return (
      <Row
        role="status"
        icon={<Clock aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
      >
        <p data-testid="stripe-unavailable" className="font-semibold">
          {unavailable}
        </p>
        <p className="text-muted-foreground">
          Nu e nimic de făcut din contul tău. Până atunci, înscrierile se pot plăti cash.
        </p>
      </Row>
    )
  }
  if (phase === 'redirecting') {
    return (
      <Row role="status" icon={<Spinner />}>
        <p className="font-semibold">Linkul Stripe a expirat. Te ducem înapoi la Stripe…</p>
        <p className="text-muted-foreground">Durează câteva secunde.</p>
      </Row>
    )
  }
  if (phase === 'verifying') {
    return (
      <Row role="status" icon={<Spinner />}>
        <p className="font-semibold">Verificăm contul la Stripe…</p>
        <p className="text-muted-foreground">Durează câteva secunde.</p>
      </Row>
    )
  }
  if (actionError) {
    return (
      <Row
        role="alert"
        tone="error"
        icon={
          <CircleAlert aria-hidden="true" className="text-destructive mt-0.5 size-5 shrink-0" />
        }
      >
        <p className="font-semibold">{actionError.message}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-2 h-11 min-h-11"
          disabled={busy}
          onClick={retry}
        >
          <RefreshCw aria-hidden="true" />
          Reîncearcă
        </Button>
      </Row>
    )
  }
  if (phase === 'verified' && entity) {
    return complete ? (
      <Row
        role="status"
        tone="success"
        icon={
          <CircleCheck aria-hidden="true" className="text-success-ink mt-0.5 size-5 shrink-0" />
        }
      >
        <p className="font-semibold">Gata! Plățile cu cardul sunt active.</p>
        <p className="text-muted-foreground">Părinții pot plăti înscrierile cu cardul.</p>
      </Row>
    ) : (
      <Row
        role="status"
        icon={<Info aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
      >
        <p className="font-semibold">Stripe mai are nevoie de câteva date.</p>
        <p className="text-muted-foreground">
          Continuă configurarea ca să activezi plățile cu cardul.
        </p>
      </Row>
    )
  }
  return null
}
