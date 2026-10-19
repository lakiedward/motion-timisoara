import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveCoachSessions } from './active-sessions'

export const COACH_LOCATION_PATH = '/account/locatie'

export function LiveLocationBanner({ always = false }: { always?: boolean }) {
  const { parent, sessions } = useActiveCoachSessions()
  if (!parent || (!always && sessions.length === 0)) return null
  const live = sessions.length > 0
  const names = [...new Set(sessions.map((session) => session.coachName))]
  return (
    <Link
      to={COACH_LOCATION_PATH}
      aria-label={
        live ? `Unde e antrenorul: ${names.join(', ')} partajează acum` : 'Unde e antrenorul'
      }
      className={cn(
        'bg-card hover:bg-muted/50 focus-visible:outline-ring flex min-h-touch-target items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-6',
        live && 'border-primary',
      )}
    >
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground relative flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        <MapPin className="size-5" />
        {live && (
          <span className="bg-success border-card absolute -top-0.5 -right-0.5 size-3 rounded-full border-2" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {live ? 'Antrenorul partajează locația acum' : 'Unde e antrenorul'}
        </span>
        <span className="text-muted-foreground block truncate text-sm">
          {live
            ? names.join(', ')
            : 'Locația antrenorului apare aici cât timp e ședința copilului.'}
        </span>
      </span>
      <span className="text-primary flex shrink-0 items-center gap-1 text-sm font-semibold">
        <span className="hidden sm:inline">{live ? 'Vezi pe hartă' : 'Deschide'}</span>
        <ChevronRight aria-hidden="true" className="size-5" />
      </span>
    </Link>
  )
}
