import type { ReactNode } from 'react'
import { MapPin, Users } from 'lucide-react'

import type { AdminSession } from '@/api/attendance/admin-sessions'
import { formatTime } from '@/features/admin/attendance/attendance-overview'
import { MarkBadge } from '@/features/admin/attendance/AdminSessionRow'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { groupByDay } from './coach-session-list'

export function SessionDayList({
  title,
  items,
  query,
  selectedId,
  hideOthers,
  onSelect,
  renderInline,
  footer,
}: {
  title: string
  items: AdminSession[]
  query: string
  selectedId: string | null
  hideOthers: boolean
  onSelect: (s: AdminSession) => void
  renderInline: (s: AdminSession) => ReactNode
  footer?: ReactNode
}) {
  if (!items.length) return null
  return (
    <section aria-label={title} className="space-y-2">
      <h2
        className={cn(
          'text-muted-foreground pt-2 text-xs font-semibold tracking-wider uppercase',
          hideOthers && 'hidden md:block',
        )}
      >
        {title} · {items.length}
      </h2>
      {groupByDay(items).map((day) => {
        const hasSelected = day.items.some((s) => s.id === selectedId)
        return (
          <div
            key={day.key}
            className={cn(
              'bg-card overflow-hidden rounded-xl border',
              hideOthers && !hasSelected && 'hidden md:block',
            )}
          >
            <h3
              className={cn(
                'bg-muted/40 text-foreground border-b px-4 py-2 text-sm font-semibold',
                hideOthers && 'hidden md:block',
              )}
            >
              {day.label}
            </h3>
            <ul className="divide-y">
              {day.items.map((s) => {
                const active = s.id === selectedId
                return (
                  <li key={s.id} className={cn(hideOthers && !active && 'hidden md:block')}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => onSelect(s)}
                      className={cn(
                        'relative flex min-h-16 w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                        active
                          ? 'bg-accent before:bg-primary before:absolute before:inset-y-0 before:left-0 before:w-1'
                          : 'hover:bg-muted/60',
                      )}
                    >
                      <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-foreground tabular-nums font-semibold">
                          {formatTime(s.startsAt)}
                        </span>
                        <span className="font-display min-w-0 flex-1 font-bold wrap-anywhere line-clamp-2">
                          <Highlight text={s.courseName} query={query} />
                        </span>
                        <MarkBadge s={s} />
                      </span>
                      <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
                          <MapPin aria-hidden="true" className="size-4 shrink-0" />
                          <Highlight text={s.locationName ?? '—'} query={query} />
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users aria-hidden="true" className="size-4 shrink-0" />
                          {plural(s.enrolledCount, 'copil', 'copii')}
                        </span>
                      </span>
                    </button>
                    {active && renderInline(s)}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {footer}
    </section>
  )
}
