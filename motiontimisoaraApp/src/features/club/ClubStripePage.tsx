import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub } from '@/api/club'
import {
  getStripeDashboardLink,
  refreshStripeStatus,
  startStripeOnboarding,
} from '@/api/stripe-connect'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubStripePage() {
  const location = useLocation()
  const qc = useQueryClient()
  const isReturn = location.pathname.endsWith('/complete')
  const isRefresh = location.pathname.endsWith('/refresh')
  const {
    data: club,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    retry: false,
  })
  const [busy, setBusy] = useState(false)
  const refreshStarted = useRef(false)

  const goToOnboarding = useCallback(async () => {
    setBusy(true)
    try {
      const url = await startStripeOnboarding()
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nu am putut deschide configurarea Stripe.')
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
        if (!cancelled) await qc.invalidateQueries({ queryKey: ['my-club'] })
      } catch {
        if (!cancelled) toast.error('Nu am putut actualiza statusul Stripe.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isReturn, qc])

  const goToDashboard = async () => {
    setBusy(true)
    try {
      const { url } = await getStripeDashboardLink()
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nu am putut deschide dashboard-ul Stripe.')
      setBusy(false)
    }
  }

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />
  if (isError) {
    return (
      <p role="alert" className="bg-card text-muted-foreground shadow-card rounded-3xl p-6">
        Nu am putut încărca clubul.
      </p>
    )
  }
  if (!club) {
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
        Niciun club asociat contului.
      </div>
    )
  }

  const complete = club.stripe_onboarding_complete

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">Configurare plăți</h1>
        <p className="text-muted-foreground mt-1">
          Cont Stripe Connect pentru {club.name}, ca părinții să poată plăti cursurile clubului cu
          cardul.
        </p>
      </div>

      <div className="bg-card shadow-card rounded-3xl p-6">
        <div className="text-sm font-semibold">Stripe</div>
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
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {complete ? (
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
          )}
          <Button asChild variant="outline" className="h-11 min-h-11">
            <Link to="/club">Înapoi la panou</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
