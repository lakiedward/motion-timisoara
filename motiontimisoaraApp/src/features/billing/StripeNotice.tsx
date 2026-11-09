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

export function NoticeRow({
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
      <NoticeRow
        role="status"
        icon={<Clock aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
      >
        <p data-testid="stripe-unavailable" className="font-semibold">
          {unavailable}
        </p>
        <p className="text-muted-foreground">
          Nu e nimic de făcut din contul tău. Până atunci, înscrierile se pot plăti cash.
        </p>
      </NoticeRow>
    )
  }
  if (phase === 'redirecting') {
    return (
      <NoticeRow role="status" icon={<Spinner />}>
        <p className="font-semibold">Linkul Stripe a expirat. Te ducem înapoi la Stripe…</p>
        <p className="text-muted-foreground">Durează câteva secunde.</p>
      </NoticeRow>
    )
  }
  if (phase === 'verifying') {
    return (
      <NoticeRow role="status" icon={<Spinner />}>
        <p className="font-semibold">Verificăm contul la Stripe…</p>
        <p className="text-muted-foreground">Durează câteva secunde.</p>
      </NoticeRow>
    )
  }
  if (actionError) {
    return (
      <NoticeRow
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
          className="mt-2 h-touch-target min-h-touch-target"
          disabled={busy}
          onClick={retry}
        >
          <RefreshCw aria-hidden="true" />
          Reîncearcă
        </Button>
      </NoticeRow>
    )
  }
  if (phase === 'verified' && entity) {
    return complete ? (
      <NoticeRow
        role="status"
        tone="success"
        icon={
          <CircleCheck aria-hidden="true" className="text-success-ink mt-0.5 size-5 shrink-0" />
        }
      >
        <p className="font-semibold">Gata! Plățile cu cardul sunt active.</p>
        <p className="text-muted-foreground">Părinții pot plăti înscrierile cu cardul.</p>
      </NoticeRow>
    ) : (
      <NoticeRow
        role="status"
        icon={<Info aria-hidden="true" className="text-muted-foreground mt-0.5 size-5 shrink-0" />}
      >
        <p className="font-semibold">Stripe mai are nevoie de câteva date.</p>
        <p className="text-muted-foreground">
          Continuă configurarea ca să activezi plățile cu cardul.
        </p>
      </NoticeRow>
    )
  }
  return null
}
