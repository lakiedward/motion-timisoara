import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { getActiveLocationSessions } from '@/api/live-location/discovery'
import { campLocationKey } from '@/api/live-location/target'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { LocationViewer } from '../LocationViewer'

export function ActiveLocationAnnouncements() {
  const { user } = useAuth()
  const actorId = user?.id ?? ''
  const [selection, setSelection] = useState<{ actor: string; session: string } | null>(null)
  const [visible, setVisible] = useState(() => !document.hidden)
  const [now, setNow] = useState(Date.now)
  const sessions = useQuery({
    queryKey: ['active-location-announcements', actorId],
    queryFn: () => getActiveLocationSessions(actorId),
    enabled: !!actorId && user?.role === 'PARENT' && visible,
    refetchInterval: 5_000,
    staleTime: 0,
    gcTime: 0,
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
  if (user?.role !== 'PARENT') return null
  const active =
    visible && !sessions.isError
      ? (sessions.data?.filter((session) => Date.parse(session.expiresAt) > now) ?? [])
      : []
  return (
    <section aria-label="Locații partajate acum" className="mb-6 space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="size-5" /> Locații partajate acum
      </h2>
      {sessions.isPending ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : sessions.isError ? (
        <div role="alert" className="space-y-2 rounded-2xl border p-4">
          <p className="text-destructive text-sm">Nu am putut verifica locațiile partajate.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void sessions.refetch()}>
            Reîncearcă locațiile
          </Button>
        </div>
      ) : active.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nicio locație partajată acum.</p>
      ) : (
        <ul className="space-y-3">
          {active.map((session) => {
            const selected = selection?.actor === actorId && selection.session === session.sessionId
            const target = session.campId
              ? campLocationKey(session.campId, session.coachId)
              : session.occurrenceId!
            return (
              <li key={session.sessionId} className="bg-card space-y-3 rounded-2xl border p-4">
                <div>
                  <h3 className="font-semibold">{session.coachName} partajează locația</h3>
                  <p className="text-muted-foreground text-sm">{session.title}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={selected}
                  onClick={() =>
                    setSelection(selected ? null : { actor: actorId, session: session.sessionId })
                  }
                >
                  {selected ? 'Ascunde locația' : 'Vezi locația'}
                </Button>
                {selected && (
                  <LocationViewer key={`${actorId}:${session.sessionId}`} occurrenceId={target} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
