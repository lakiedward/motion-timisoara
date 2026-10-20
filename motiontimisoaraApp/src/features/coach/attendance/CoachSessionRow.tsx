import { ChevronDown, Clock, MapPin, Users } from 'lucide-react'

import type { AdminSession } from '@/api/attendance/admin-sessions'
import { Button } from '@/components/ui/button'
import { MarkBadge } from '@/features/admin/attendance/AdminSessionRow'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { CoachSessionCatalog } from './CoachSessionCatalog'
import { sessionWhen } from './coach-session-list'

export function CoachSessionRow({
  session: s,
  open,
  onToggle,
}: {
  session: AdminSession
  open: boolean
  onToggle: () => void
}) {
  const panelId = `prezenta-${s.id}`
  return (
    <li className={cn('px-4 py-3 sm:px-5', open && 'bg-muted/40')}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="inline-flex items-center gap-1 font-semibold">
              <Clock aria-hidden="true" className="size-4 shrink-0" />
              <time dateTime={s.startsAt}>{sessionWhen(s)}</time>
            </h4>
            <MarkBadge s={s} />
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              {s.locationName ?? '—'}
            </span>
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
          onClick={onToggle}
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
          <CoachSessionCatalog session={s} />
        </div>
      )}
    </li>
  )
}
