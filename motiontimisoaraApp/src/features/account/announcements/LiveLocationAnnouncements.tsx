import { Link } from 'react-router-dom'
import { ChevronRight, Clock, MapPin, UserRound } from 'lucide-react'
import type { ActiveLocationSession } from '@/api/live-location/discovery'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { COACH_LOCATION_PATH } from '@/features/live-location/parent/LiveLocationBanner'
import { useActiveCoachSessions } from '@/features/live-location/parent/active-sessions'

const time = new Intl.DateTimeFormat('ro-RO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

function LiveLocationCard({ session }: { session: ActiveLocationSession }) {
  return (
    <article className="bg-card border-primary min-w-0 space-y-3 rounded-xl border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display min-w-0 text-lg font-bold wrap-anywhere">{session.title}</h3>
        <Badge variant="success">
          <MapPin aria-hidden="true" /> Live
        </Badge>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-foreground flex min-w-0 items-center gap-1.5 font-medium">
          <UserRound aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <span className="wrap-anywhere">{session.coachName}</span>
          <span aria-hidden="true" className="text-muted-foreground font-normal">
            ·
          </span>
          <span className="text-muted-foreground font-normal">
            {session.campId ? 'Tabără' : 'Curs'}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          <span>
            Până la{' '}
            <time dateTime={session.expiresAt}>{time.format(Date.parse(session.expiresAt))}</time>
          </span>
        </span>
      </div>
      <p className="font-semibold wrap-anywhere">Antrenorul {session.coachName} a pornit locația</p>
      <p className="text-foreground/90 leading-relaxed">
        Poți vedea pe hartă unde este antrenorul cât timp partajează locația.
      </p>
      <Button asChild variant="outline">
        <Link to={COACH_LOCATION_PATH}>
          Vezi pe hartă <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </article>
  )
}

export function LiveLocationAnnouncements() {
  const { sessions } = useActiveCoachSessions()
  if (sessions.length === 0) return null
  return (
    <section aria-label="Acum" className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Acum</h2>
        <span className="text-muted-foreground text-sm">
          {plural(sessions.length, 'locație live', 'locații live')}
        </span>
      </div>
      <ul className="space-y-3" aria-label="Locații live">
        {sessions.map((session) => (
          <li key={session.sessionId} className="min-w-0">
            <LiveLocationCard session={session} />
          </li>
        ))}
      </ul>
    </section>
  )
}
