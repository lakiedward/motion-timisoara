import { Link } from 'react-router-dom'
import { CalendarClock, CircleOff, MapPin, Pencil, Power, Users } from 'lucide-react'

import type { AdminActivity } from '@/api/activities/admin-activities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { activityWhen } from './activity-overview'

export function AdminActivityRow({
  activity: a,
  query,
  past,
  showCoach,
  pending,
  onToggle,
}: {
  activity: AdminActivity
  query: string
  past: boolean
  showCoach: boolean
  pending: boolean
  onToggle: () => void
}) {
  const capacity = a.capacity && a.capacity > 0 ? a.capacity : null
  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5',
        (!a.active || past) && 'bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display min-w-0 text-base font-bold wrap-anywhere">
            <Highlight text={a.name} query={query} />
          </h3>
          {a.sport && <Badge variant="secondary">{a.sport.name}</Badge>}
          {!a.active ? (
            <Badge variant="outline">
              <CircleOff aria-hidden="true" /> Inactivă
            </Badge>
          ) : past ? (
            <Badge variant="outline">Încheiată</Badge>
          ) : (
            <Badge variant="success">Activă</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
            {activityWhen(a)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <Highlight text={a.location?.name ?? '—'} query={query} />
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users aria-hidden="true" className="size-4 shrink-0" />
            {capacity ? `${a.enrolled}/${capacity}` : a.enrolled} înscriși
          </span>
          <span className="text-foreground font-semibold">{formatMoney(a.price, a.currency)}</span>
        </p>
        {showCoach && (
          <p className="text-muted-foreground mt-1 text-sm wrap-anywhere">
            Antrenor: <Highlight text={a.coach?.name?.trim() || '—'} query={query} />
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild variant="outline" className="h-11 lg:h-9">
          <Link to={`/admin/activities/${a.id}/edit`} aria-label={`Editează ${a.name}`}>
            <Pencil aria-hidden="true" /> Editează
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 lg:h-9"
          disabled={pending}
          aria-label={`${a.active ? 'Dezactivează' : 'Activează'} ${a.name}`}
          onClick={onToggle}
        >
          <Power aria-hidden="true" />
          {a.active ? 'Dezactivează' : 'Activează'}
        </Button>
      </div>
    </li>
  )
}
