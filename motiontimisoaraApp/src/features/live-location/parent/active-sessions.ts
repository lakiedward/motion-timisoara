import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getActiveLocationSessions,
  type ActiveLocationSession,
} from '@/api/live-location/discovery'
import { campLocationKey } from '@/api/live-location/target'
import { useAuth } from '@/lib/auth-context'

export function sessionTarget(session: ActiveLocationSession) {
  return session.campId ? campLocationKey(session.campId, session.coachId) : session.occurrenceId!
}

export function useActiveCoachSessions() {
  const { user } = useAuth()
  const actorId = user?.id ?? ''
  const parent = user?.role === 'PARENT'
  const [visible, setVisible] = useState(() => !document.hidden)
  const [now, setNow] = useState(Date.now)
  const query = useQuery({
    queryKey: ['active-location-sessions', actorId],
    queryFn: () => getActiveLocationSessions(actorId),
    enabled: !!actorId && parent && visible,
    refetchInterval: 5_000,
    staleTime: 0,
    retry: false,
  })
  useEffect(() => {
    const visibility = () => setVisible(!document.hidden)
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  const sessions =
    visible && !query.isError
      ? (query.data?.filter((session) => Date.parse(session.expiresAt) > now) ?? [])
      : []
  return { parent, actorId, query, sessions }
}
