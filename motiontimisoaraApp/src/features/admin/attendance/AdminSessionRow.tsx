import { useState } from 'react'
import { ChevronDown, Clock, MapPin, UserRound, Users } from 'lucide-react'

import type { AdminSession } from '@/api/attendance/admin-sessions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { SessionRoster } from './SessionRoster'
import { formatDay, formatTime, isStarted, isUnmarked } from './attendance-overview'

export function MarkBadge({ s }: { s: AdminSession }) {
  if (!isStarted(s)) return <Badge variant="outline">Urmează</Badge>
  if (!s.enrolledCount) return <Badge variant="outline">Fără copii</Badge>
  if (isUnmarked(s))
    return (
      <Badge variant="highlight">
        {s.markedCount ? `${s.markedCount} din ${s.enrolledCount} pontați` : 'Nepontată'}
      </Badge>
    )
  return <Badge variant="success">Pontată</Badge>
}

export function AdminSessionRow({ session: s, query }: { session: AdminSession; query: string }) {
  const [open, setOpen] = useState(false)
  const panelId = `prezenta-${s.id}`

  return (
    <li className={cn('px-4 py-3 sm:px-5', open && 'bg-muted/40')}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display min-w-0 text-base font-bold wrap-anywhere">
              <Highlight text={s.courseName} query={query} />
            </h3>
            <MarkBadge s={s} />
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="size-4 shrink-0" />
              <time dateTime={s.startsAt}>
                {`${formatDay(s.startsAt)} · ${formatTime(s.startsAt)}`}
              </time>
            </span>
            {s.coachName && s.organizerKind === 'club' && (
              <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
                <UserRound aria-hidden="true" className="size-4 shrink-0" />
                <Highlight text={s.coachName} query={query} />
              </span>
            )}
            {s.locationName && (
              <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                <Highlight text={s.locationName} query={query} />
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users aria-hidden="true" className="size-4 shrink-0" />
              {plural(s.enrolledCount, 'copil', 'copii')}
            </span>
          </p>
        </div>
        <Button
          type="button"
          variant={open ? 'secondary' : 'outline'}
          className="h-touch-target min-h-touch-target shrink-0 lg:h-9 lg:min-h-9"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Închide' : 'Pontează'}
          <ChevronDown
            aria-hidden="true"
            className={cn('transition-transform', !open && '-rotate-90')}
          />
        </Button>
      </div>
      {open && (
        <div id={panelId} className="mt-3">
          <SessionRoster courseId={s.courseId} occurrenceId={s.id} listKey="admin-sessions" />
        </div>
      )}
    </li>
  )
}
