import { Building2, ChevronDown, CircleAlert, UserRound } from 'lucide-react'

import { CourseListRow } from '@/components/panel-list/CourseListRow'
import { cn } from '@/lib/utils'
import { attentionReason, countCourses, type OrganizerGroup } from './course-overview'
import {
  AttentionNote,
  EnrollmentMeter,
  Highlight,
  type RenderCourseActions,
} from './CourseParts'

export const PREVIEW_LIMIT = 4

function OrganizerSummary({ group }: { group: OrganizerGroup }) {
  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span>
        <strong className="text-foreground tabular-nums">{group.activeCount}</strong> active din{' '}
        {group.totalCount}
      </span>
      <span>
        <strong className="text-foreground tabular-nums">{group.enrolledChildren}</strong> copii
        înscriși
      </span>
      {group.attentionCount > 0 && (
        <span className="text-highlight-ink flex items-center gap-1 font-semibold">
          <CircleAlert aria-hidden="true" className="size-3.5" />
          {group.attentionCount} de verificat
        </span>
      )}
    </span>
  )
}

export function OrganizerCard({
  group,
  open,
  expanded,
  query,
  renderActions,
  onOpenChange,
  onExpand,
}: {
  group: OrganizerGroup
  open: boolean
  expanded: boolean
  query: string
  renderActions: RenderCourseActions
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const Icon = group.kind === 'club' ? Building2 : UserRound
  const searching = query.trim().length > 0
  const shown = expanded || searching ? group.courses : group.courses.slice(0, PREVIEW_LIMIT)
  const hiddenInFilter = group.courses.length - shown.length
  const panelId = `organizator-${group.key.replace(/[^a-z0-9-]/gi, '-')}`
  const showCoach = group.kind === 'club'

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
            <OrganizerSummary group={group} />
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
            {shown.map((c) => (
              <CourseListRow
                key={c.id}
                course={c}
                showCoach={showCoach}
                query={query}
                enrollment={<EnrollmentMeter course={c} />}
                note={<AttentionNote reason={attentionReason(c)} />}
                actions={renderActions(c)}
              />
            ))}
          </ul>

          {hiddenInFilter > 0 && (
            <div className="border-t px-4 py-2 md:pl-5">
              <button
                type="button"
                onClick={onExpand}
                className="text-primary inline-flex min-h-touch-target items-center text-sm font-semibold lg:min-h-8"
              >
                Vezi toate cele {countCourses(group.courses.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
