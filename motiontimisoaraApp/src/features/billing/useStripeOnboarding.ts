import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getStripeDashboardLink,
  isStripeUnavailable,
  refreshStripeStatus,
  startStripeOnboarding,
} from '@/api/stripe-connect'
import { SCOPES, type StripeScope } from './stripe-scopes'

export type StripePhase = 'idle' | 'verifying' | 'verified' | 'redirecting'

export type StripeActionError = { action: 'onboarding' | 'verify' | 'dashboard'; message: string }

export function useStripeOnboarding(scope: StripeScope) {
  const config = SCOPES[scope]
  const location = useLocation()
  const qc = useQueryClient()
  const isReturn = location.pathname.endsWith('/complete')
  const isRefresh = location.pathname.endsWith('/refresh')

  const query = useQuery({
    queryKey: config.queryKey,
    queryFn: config.queryFn,
    select: config.select,
    retry: false,
  })

  const [phase, setPhase] = useState<StripePhase>(
    isRefresh ? 'redirecting' : isReturn ? 'verifying' : 'idle',
  )
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)
  const [actionError, setActionError] = useState<StripeActionError | null>(null)
  const [verifiedComplete, setVerifiedComplete] = useState<boolean | null>(null)
  const started = useRef(false)

  const fail = useCallback(
    (action: StripeActionError['action'], err: unknown, fallback: string) => {
      if (isStripeUnavailable(err)) setUnavailable(err.message)
      else
        setActionError({
          action,
          message: err instanceof Error && err.message ? err.message : fallback,
        })
    },
    [],
  )

  const startOnboarding = useCallback(async () => {
    setBusy(true)
    setActionError(null)
    try {
      const url = await startStripeOnboarding()
      window.location.assign(url)
    } catch (err) {
      fail('onboarding', err, 'Nu am putut deschide configurarea Stripe.')
      setPhase('idle')
      setBusy(false)
    }
  }, [fail])

  const verify = useCallback(async () => {
    setPhase('verifying')
    setActionError(null)
    try {
      const status = await refreshStripeStatus()
      setVerifiedComplete(Boolean(status?.onboardingComplete))
      await qc.invalidateQueries({ queryKey: config.queryKey })
      setPhase('verified')
    } catch (err) {
      fail('verify', err, 'Nu am putut verifica contul Stripe.')
      setPhase('idle')
    }
  }, [fail, qc, config.queryKey])

  const openDashboard = useCallback(async () => {
    setBusy(true)
    setActionError(null)
    try {
      const { url } = await getStripeDashboardLink()
      window.location.assign(url)
    } catch (err) {
      fail('dashboard', err, 'Nu am putut deschide dashboard-ul Stripe.')
      setBusy(false)
    }
  }, [fail])

  useEffect(() => {
    if (started.current) return
    if (!isRefresh && !isReturn) return
    started.current = true
    void Promise.resolve().then(isRefresh ? startOnboarding : verify)
  }, [isRefresh, isReturn, startOnboarding, verify])

  const retry = useCallback(() => {
    if (actionError?.action === 'verify') void verify()
    else if (actionError?.action === 'dashboard') void openDashboard()
    else void startOnboarding()
  }, [actionError, verify, openDashboard, startOnboarding])

  const entity = query.data ?? null

  return {
    config,
    query,
    entity,
    complete: verifiedComplete ?? entity?.complete ?? false,
    phase,
    busy,
    unavailable,
    actionError,
    startOnboarding,
    openDashboard,
    retry,
  }
}

export type StripeOnboardingState = ReturnType<typeof useStripeOnboarding>
