import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, type Club } from '@/api/club'
import { getMyCoachStripeStatus, type CoachStripeStatus } from '@/api/coach'
import {
  getStripeDashboardLink,
  isStripeUnavailable,
  refreshStripeStatus,
  startStripeOnboarding,
} from '@/api/stripe-connect'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export type StripeScope = 'club' | 'coach'

/** null = the signed-in user has no club / coach profile to bill through. */
type Billable = { label: string; complete: boolean } | null

interface ScopeConfig {
  queryKey: string[]
  /**
   * Must stay the canonical fetcher for `queryKey`. Eight club pages read the
   * full club row from ['my-club'] and the coach dashboard reads
   * CoachStripeStatus from ['my-coach-stripe']; caching a narrowed shape under
   * either key would hand them the wrong object for as long as it stays fresh.
   * Narrowing happens in `select`, which transforms per render and leaves the
   * cache alone.
   */
  queryFn: () => Promise<unknown>
  select: (data: unknown) => Billable
  description: (label: string) => string
  missing: string
  loadError: string
  backTo: string
}

const SCOPES: Record<StripeScope, ScopeConfig> = {
  club: {
    queryKey: ['my-club'],
    queryFn: getMyClub,
    select: (data) => {
      const club = data as Club | null
      return club ? { label: club.name, complete: club.stripe_onboarding_complete } : null
    },
    description: (label) =>
      `Cont Stripe Connect pentru ${label}, ca părinții să poată plăti cursurile clubului cu cardul.`,
    missing: 'Niciun club asociat contului.',
    loadError: 'Nu am putut încărca clubul.',
    backTo: '/club',
  },
  coach: {
    queryKey: ['my-coach-stripe'],
    queryFn: getMyCoachStripeStatus,
    select: (data) => {
      const status = data as CoachStripeStatus | undefined
      return status?.hasProfile ? { label: 'contul tău', complete: status.onboardingComplete } : null
    },
    description: () =>
      'Cont Stripe Connect pentru tine, ca părinții să poată plăti cursurile tale cu cardul.',
    missing: 'Niciun profil de antrenor asociat contului.',
    loadError: 'Nu am putut încărca profilul de antrenor.',
    backTo: '/coach',
  },
}

/**
 * Stripe Connect setup screen, shared by the club and coach portals.
 *
 * It also backs the return URLs the stripe-connect Edge Function hands to
 * Stripe: `.../onboarding/complete` re-reads Connect status, `.../onboarding/refresh`
 * mints a fresh onboarding link because Stripe only sends users there when the
 * previous one expired.
 */
export function StripeOnboardingPanel({ scope }: { scope: StripeScope }) {
  const config = SCOPES[scope]
  const location = useLocation()
  const qc = useQueryClient()
  const isReturn = location.pathname.endsWith('/complete')
  const isRefresh = location.pathname.endsWith('/refresh')

  const {
    data: entity,
    isLoading,
    isError,
  } = useQuery({
    queryKey: config.queryKey,
    queryFn: config.queryFn,
    select: config.select,
    retry: false,
  })

  const [busy, setBusy] = useState(false)
  /** Set when Stripe itself is unavailable — a platform gap, not a user error. */
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const refreshStarted = useRef(false)

  const goToOnboarding = useCallback(async () => {
    setBusy(true)
    try {
      const url = await startStripeOnboarding()
      window.location.assign(url)
    } catch (err) {
      if (isStripeUnavailable(err)) setUnavailable(err.message)
      else toast.error(err instanceof Error ? err.message : 'Nu am putut deschide configurarea Stripe.')
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!isRefresh || refreshStarted.current) return
    refreshStarted.current = true
    void goToOnboarding()
  }, [isRefresh, goToOnboarding])

  useEffect(() => {
    if (!isReturn) return
    let cancelled = false
    ;(async () => {
      try {
        await refreshStripeStatus()
        if (!cancelled) await qc.invalidateQueries({ queryKey: config.queryKey })
      } catch (err) {
        if (cancelled) return
        if (isStripeUnavailable(err)) setUnavailable(err.message)
        else toast.error('Nu am putut actualiza statusul Stripe.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isReturn, qc, config.queryKey])

  const goToDashboard = async () => {
    setBusy(true)
    try {
      const { url } = await getStripeDashboardLink()
      window.location.assign(url)
    } catch (err) {
      if (isStripeUnavailable(err)) setUnavailable(err.message)
      else toast.error(err instanceof Error ? err.message : 'Nu am putut deschide dashboard-ul Stripe.')
      setBusy(false)
    }
  }

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />
  if (isError) {
    return (
      <p role="alert" className="bg-card text-muted-foreground shadow-card rounded-3xl p-6">
        {config.loadError}
      </p>
    )
  }
  if (!entity) {
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
        {config.missing}
      </div>
    )
  }

  const complete = entity.complete

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Configurare plăți</h1>
        <p className="text-muted-foreground mt-1">{config.description(entity.label)}</p>
      </div>

      <div className="bg-card shadow-card rounded-3xl p-6">
        <div className="text-sm font-semibold">Stripe</div>

        {unavailable ? (
          <>
            <div
              role="status"
              data-testid="stripe-unavailable"
              className="text-muted-foreground mt-2 flex items-start gap-2 text-sm"
            >
              <Clock className="mt-0.5 size-5 shrink-0" />
              <span>{unavailable}</span>
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              Nu e nimic de făcut din contul tău. Până atunci, înscrierile se pot plăti cash.
            </p>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-sm">
            {complete ? (
              <>
                <CheckCircle2 className="text-success size-5" /> Configurat
              </>
            ) : (
              <>
                <XCircle className="text-muted-foreground size-5" /> Neconfigurat
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!unavailable &&
            (complete ? (
              <Button
                type="button"
                className="h-11 min-h-11"
                disabled={busy}
                onClick={() => void goToDashboard()}
              >
                Deschide dashboard Stripe
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 min-h-11"
                disabled={busy}
                onClick={() => void goToOnboarding()}
              >
                Configurează Stripe
              </Button>
            ))}
          <Button asChild variant="outline" className="h-11 min-h-11">
            <Link to={config.backTo}>Înapoi la panou</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
