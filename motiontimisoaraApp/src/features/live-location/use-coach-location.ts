import { useCallback, useEffect, useRef, useState } from 'react'
import { locationRequest, subscribeToLocation, type LocationResponse } from '@/api/live-location'
import { useAuth } from '@/lib/auth-context'

type ViewerState = {
  identity: string
  metadata: LocationResponse | null
  point: LocationResponse['location']
  loading: boolean
  busy: boolean
  error: string | null
}

export function useCoachLocation(occurrenceId: string) {
  const { user } = useAuth()
  const actorId = user?.id
  const parent = user?.role === 'PARENT'
  const camp = occurrenceId.startsWith('camp:')
  const identity = `${actorId}:${user?.role}:${occurrenceId}`
  const generation = useRef(0)
  const invalidate = useCallback(() => {
    ++generation.current
  }, [])
  const mutationPending = useRef(false)
  const mutationToken = useRef(0)
  const refreshing = useRef<number | null>(null)
  const suppressRead = useRef(false)
  const [state, setState] = useState<ViewerState>({
    identity,
    metadata: null,
    point: null,
    loading: true,
    busy: false,
    error: null,
  })
  const current = state.identity === identity ? state : null
  const metadata = current?.metadata
  const refresh = useCallback(
    async (read = true, message: string | null = null, preserve = false) => {
      const version = ++generation.current
      if (!actorId || document.hidden) {
        refreshing.current = null
        setState({
          identity,
          metadata: null,
          point: null,
          loading: false,
          busy: false,
          error: null,
        })
        return
      }
      refreshing.current = version
      const keepPoint = (previous: ViewerState, next = previous.metadata) =>
        read &&
        preserve &&
        !suppressRead.current &&
        previous.identity === identity &&
        !previous.error &&
        previous.point &&
        next &&
        previous.metadata?.sessionId === next.sessionId &&
        (!parent || next.consentGranted) &&
        Date.parse(next.expiresAt) > Date.now() &&
        Date.parse(previous.point.capturedAt) + 120_000 > Date.now()
          ? previous.point
          : null
      setState((previous) => ({
        identity,
        metadata: previous.identity === identity ? previous.metadata : null,
        point: keepPoint(previous),
        loading: true,
        busy: false,
        error: message,
      }))
      let status: LocationResponse | null = null
      try {
        status = await locationRequest({ action: 'status', occurrenceId }, actorId)
        if (version !== generation.current || document.hidden) return
        if (Date.parse(status.expiresAt) <= Date.now()) throw new Error('Partajarea a expirat.')
        setState((previous) => ({
          identity,
          metadata: status,
          point: keepPoint(previous, status),
          loading: false,
          busy: false,
          error: message,
        }))
        if (!read || suppressRead.current || (parent && !status.consentGranted)) return
        const result = await locationRequest(
          { action: 'read', occurrenceId, sessionId: status.sessionId },
          actorId,
        )
        if (version !== generation.current || document.hidden) return
        if (Date.parse(result.expiresAt) <= Date.now()) throw new Error('Partajarea a expirat.')
        const point =
          result.location && Date.parse(result.location.capturedAt) > Date.now() - 120_000
            ? result.location
            : null
        setState({
          identity,
          metadata: status,
          point,
          loading: false,
          busy: false,
          error:
            point || !result.location
              ? message
              : 'Ultima poziție este prea veche. Așteptăm o actualizare.',
        })
      } catch (error) {
        if (version !== generation.current) return
        setState({
          identity,
          metadata: status,
          point: null,
          loading: false,
          busy: false,
          error: error instanceof Error ? error.message : 'Nu am putut încărca locația.',
        })
      } finally {
        if (refreshing.current === version) refreshing.current = null
      }
    },
    [actorId, identity, occurrenceId, parent],
  )

  useEffect(() => {
    let disposed = false
    suppressRead.current = false
    mutationPending.current = false
    ++mutationToken.current
    queueMicrotask(() => {
      if (!disposed) void refresh()
    })
    const visibility = () => {
      ++generation.current
      if (document.hidden) {
        setState((previous) => ({ ...previous, point: null, loading: false }))
      } else if (!mutationPending.current) void refresh()
    }
    document.addEventListener('visibilitychange', visibility)
    const timer = window.setInterval(() => {
      if (!mutationPending.current && refreshing.current === null && !document.hidden)
        void refresh(true, null, true)
    }, 5_000)
    return () => {
      disposed = true
      invalidate()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [invalidate, refresh])

  useEffect(() => {
    if (!metadata?.sessionId) return
    return subscribeToLocation(metadata.sessionId, () => {
      setState((previous) => ({ ...previous, point: null }))
      if (!mutationPending.current) void refresh()
    })
  }, [metadata?.sessionId, refresh])

  useEffect(() => {
    if (!metadata?.expiresAt) return
    const expiry = window.setTimeout(
      () => {
        ++generation.current
        setState((previous) => ({
          ...previous,
          point: null,
          metadata: null,
          loading: false,
          busy: false,
          error: 'Partajarea a expirat.',
        }))
      },
      Math.max(0, Date.parse(metadata.expiresAt) - Date.now()),
    )
    return () => window.clearTimeout(expiry)
  }, [metadata?.expiresAt])

  useEffect(() => {
    const capturedAt = current?.point?.capturedAt
    if (!capturedAt) return
    const freshness = window.setTimeout(
      () => {
        setState((previous) =>
          previous.point?.capturedAt === capturedAt
            ? {
                ...previous,
                point: null,
                error: 'Ultima poziție este prea veche. Așteptăm o actualizare.',
              }
            : previous,
        )
      },
      Math.max(0, Date.parse(capturedAt) + 120_000 - Date.now()),
    )
    return () => window.clearTimeout(freshness)
  }, [current?.point?.capturedAt])

  const consent = async (granted: boolean) => {
    if (!metadata || !actorId || mutationPending.current) return
    const version = ++generation.current
    const token = ++mutationToken.current
    mutationPending.current = true
    if (!granted) suppressRead.current = true
    setState((previous) => ({ ...previous, point: null, busy: true, error: null }))
    try {
      await locationRequest(
        {
          action: 'consent',
          occurrenceId,
          sessionId: metadata.sessionId,
          consent: granted,
          expectedVersion: metadata.consentVersion ?? 0,
        },
        actorId,
      )
      if (version !== generation.current) return
      suppressRead.current = !granted
      mutationPending.current = false
      await refresh(granted)
    } catch (error) {
      if (version !== generation.current) return
      mutationPending.current = false
      await refresh(
        false,
        error instanceof Error ? error.message : 'Nu am putut actualiza acordul. Reîncearcă.',
      )
    } finally {
      if (token === mutationToken.current) {
        mutationPending.current = false
        setState((previous) => ({ ...previous, busy: false }))
        if (version !== generation.current && document.hidden)
          setState((previous) => ({ ...previous, point: null }))
      }
    }
  }

  return { user, parent, camp, current, metadata, refresh, consent }
}
