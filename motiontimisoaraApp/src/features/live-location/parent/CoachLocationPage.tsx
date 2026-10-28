import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Clock, LocateFixed } from 'lucide-react'
import type { ActiveLocationSession } from '@/api/live-location/discovery'
import type { LocationPoint } from '@/api/live-location'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { useCoachLocation } from '../use-coach-location'
import { CoachesMap, type CoachPoint } from './CoachesMap'
import { sessionTarget, useActiveCoachSessions } from './active-sessions'

const ora = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('ro-RO'))
    .join('')
}

function CoachIdentity({ session }: { session: ActiveLocationSession }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar className="size-10">
        <AvatarFallback className="bg-primary/12 text-primary font-display font-bold">
          {initials(session.coachName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-semibold">{session.coachName}</p>
        <p className="text-muted-foreground truncate text-sm">
          {session.campId ? 'Tabără' : 'Curs'} · {session.title}
        </p>
      </div>
    </div>
  )
}

function CoachRow({
  session,
  onPoint,
}: {
  session: ActiveLocationSession
  onPoint: (key: string, point: LocationPoint | null) => void
}) {
  const { current, metadata, consent } = useCoachLocation(sessionTarget(session))
  const point = current?.point && !current.error ? current.point : null
  useEffect(() => {
    onPoint(session.sessionId, point)
  }, [onPoint, session.sessionId, point])
  useEffect(() => () => onPoint(session.sessionId, null), [onPoint, session.sessionId])
  const granted = !!metadata?.consentGranted
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
      <CoachIdentity session={session} />
      <div className="text-sm sm:text-right">
        {current?.error ? (
          <p className="text-destructive flex items-center gap-1.5 font-medium sm:justify-end">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {current.error}
          </p>
        ) : point ? (
          <>
            <p className="flex items-center gap-1.5 font-medium sm:justify-end">
              <Clock aria-hidden="true" className="text-muted-foreground size-4" />
              Actualizată la {new Date(point.capturedAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-muted-foreground">
              Precizie aproximativă {Math.round(point.accuracy)} m
            </p>
          </>
        ) : granted ? (
          <p
            role="status"
            className="text-muted-foreground flex items-center gap-1.5 sm:justify-end"
          >
            <LocateFixed aria-hidden="true" className="size-4" />
            Așteptăm o poziție actuală.
          </p>
        ) : (
          <p className="text-muted-foreground">Fără acord pentru această partajare</p>
        )}
        <p className="text-muted-foreground">Până la {ora.format(new Date(session.expiresAt))}</p>
      </div>
      {metadata && (
        <Button
          type="button"
          variant={granted ? 'outline' : 'default'}
          className="w-full shrink-0 sm:w-auto"
          disabled={current?.busy}
          onClick={() => void consent(!granted)}
        >
          {granted ? 'Retrage acordul' : 'Accept și văd locația'}
        </Button>
      )}
    </li>
  )
}

function SharedMapLayout({ sessions }: { sessions: ActiveLocationSession[] }) {
  const [points, setPoints] = useState<Record<string, LocationPoint | null>>({})
  const onPoint = useCallback((key: string, point: LocationPoint | null) => {
    setPoints((previous) => (previous[key] === point ? previous : { ...previous, [key]: point }))
  }, [])
  const mapPoints: CoachPoint[] = sessions.flatMap((session) => {
    const point = points[session.sessionId]
    return point ? [{ key: session.sessionId, name: session.coachName, point }] : []
  })
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      {mapPoints.length ? (
        <CoachesMap points={mapPoints} className="rounded-none" />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-40 items-center justify-center px-6 text-center text-sm">
          Harta apare după ce accepți să vezi locația unui antrenor.
        </div>
      )}
      <ul className="divide-y border-t" aria-label="Antrenori care partajează locația">
        {sessions.map((session) => (
          <CoachRow key={session.sessionId} session={session} onPoint={onPoint} />
        ))}
      </ul>
    </div>
  )
}

export default function CoachLocationPage() {
  const { query, sessions } = useActiveCoachSessions()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Unde e antrenorul</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Locația antrenorilor care partajează acum, la ședințele și taberele copiilor tăi. Vezi
          locația doar dacă accepți, iar acordul îl poți retrage oricând.{' '}
          <Link to="/confidentialitate" className="text-primary font-medium underline">
            Confidențialitate
          </Link>
        </p>
      </div>
      {query.isPending ? (
        <StatusView state="loading" title="Se încarcă locațiile" rows={1} rowHeight={240} />
      ) : query.isError ? (
        <StatusView
          state="error"
          title="Nu am putut verifica locațiile partajate."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void query.refetch()}
        />
      ) : sessions.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun antrenor nu partajează locația acum."
          text="Când antrenorul pornește locația la ședința sau tabăra copilului tău, o vezi aici și pe Panou."
          action={
            <Button asChild variant="outline" className="mt-3">
              <Link to="/account/attendance">Vezi prezența</Link>
            </Button>
          }
        />
      ) : (
        <SharedMapLayout sessions={sessions} />
      )}
    </div>
  )
}
