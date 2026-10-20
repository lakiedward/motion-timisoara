import { ChevronDown } from 'lucide-react'

import type { AdminActivity } from '@/api/activities/admin-activities'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { ORGANIZER_ICON } from '@/features/admin/locations/organizer-icon'
import { cn } from '@/lib/utils'
import { AdminActivityRow } from './AdminActivityRow'
import { countActivities, type ActivityGroup } from './activity-overview'

export const ACTIVITY_PREVIEW_LIMIT = 4

export function ActivityOrganizerCard({
  group,
  open,
  expanded,
  query,
  today,
  pendingIds,
  onToggleActivity,
  onOpenChange,
  onExpand,
}: {
  group: ActivityGroup
  open: boolean
  expanded: boolean
  query: string
  today: string
  pendingIds: string[]
  onToggleActivity: (a: AdminActivity) => void
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const Icon = ORGANIZER_ICON[group.kind]
  const searching = query.trim().length > 0
  const shown =
    expanded || searching ? group.activities : group.activities.slice(0, ACTIVITY_PREVIEW_LIMIT)
  const hidden = group.activities.length - shown.length
  const panelId = `activitati-${group.key.replace(/[^a-z0-9-]/gi, '-')}`

  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-label={group.name}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors md:px-5"
        >
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full',
              group.kind === 'club'
                ? 'bg-accent text-primary'
                : 'bg-secondary text-muted-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-foreground block font-semibold">
              <Highlight text={group.name} query={query} />
            </span>
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <strong className="text-foreground tabular-nums">{group.upcomingCount}</strong>{' '}
                viitoare din {group.totalCount}
              </span>
              <span>
                <strong className="text-foreground tabular-nums">{group.enrolled}</strong> înscriși
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground size-5 shrink-0 transition-transform',
              !open && '-rotate-90',
            )}
          />
        </button>
      </h3>

      {open && (
        <div id={panelId}>
          <ul className="divide-y border-t">
            {shown.map((a) => (
              <AdminActivityRow
                key={a.id}
                activity={a}
                query={query}
                past={a.activity_date < today}
                showCoach={group.kind === 'club'}
                pending={pendingIds.includes(a.id)}
                onToggle={() => onToggleActivity(a)}
              />
            ))}
          </ul>
          {hidden > 0 && (
            <div className="border-t px-4 py-2 md:pl-5">
              <button
                type="button"
                onClick={onExpand}
                className="text-primary inline-flex min-h-touch-target items-center text-sm font-semibold lg:min-h-8"
              >
                Vezi toate cele {countActivities(group.activities.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
