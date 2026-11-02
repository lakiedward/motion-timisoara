import { CalendarClock, CircleOff, MapPin, Users } from 'lucide-react'

import type { Tables } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { formatOfferPrice } from '@/lib/money'
import { activityWhen } from '@/lib/panel-date'
import { cn } from '@/lib/utils'
import { PanelEditAction, PanelToggleAction } from './PanelRowActions'

export type ActivityListItem = Pick<
  Tables<'activities'>,
  | 'id'
  | 'name'
  | 'active'
  | 'activity_date'
  | 'start_time'
  | 'end_time'
  | 'capacity'
  | 'price'
  | 'currency'
> & {
  sport: { name: string } | null
  location: { name: string } | null
  coach?: { name: string | null } | null
  enrolled?: number
}

export function ActivityListRow({
  activity: a,
  editTo,
  past,
  showCoach = false,
  query = '',
  pending,
  onToggle,
}: {
  key?: string
  activity: ActivityListItem
  editTo: string
  past: boolean
  showCoach?: boolean
  query?: string
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
          {a.enrolled !== undefined && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Users aria-hidden="true" className="size-4 shrink-0" />
              {capacity ? `${a.enrolled}/${capacity}` : a.enrolled} înscriși
            </span>
          )}
          <span className="text-foreground font-semibold">
            {formatOfferPrice(a.price, a.currency)}
          </span>
        </p>
        {showCoach && (
          <p className="text-muted-foreground mt-1 text-sm wrap-anywhere">
            Antrenor: <Highlight text={a.coach?.name?.trim() || '—'} query={query} />
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <PanelEditAction to={editTo} name={a.name} />
        <PanelToggleAction active={a.active} name={a.name} pending={pending} onToggle={onToggle} />
      </div>
    </li>
  )
}
