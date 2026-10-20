import { Building2, ChevronDown, CircleAlert, UserRound } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { attentionReason, countCourses, type OrganizerGroup } from './course-overview'
import {
  AttentionNote,
  EnrollmentMeter,
  Highlight,
  StatusBadge,
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
          <table className="hidden w-full border-t text-sm md:table">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold md:pl-5">
                  Curs
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Sport
                </th>
                {showCoach && (
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Antrenor
                  </th>
                )}
                <th scope="col" className="px-4 py-3 font-semibold">
                  Înscriși
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Preț
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Acțiuni</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="hover:bg-accent border-t transition-colors">
                  <td className="px-4 py-3 md:pl-5">
                    <span className="font-medium">
                      <Highlight text={c.name} query={query} />
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {c.location?.name ?? '—'}
                    </span>
                    <AttentionNote reason={attentionReason(c)} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{c.sport?.name ?? '—'}</td>
                  {showCoach && (
                    <td className="text-muted-foreground px-4 py-3">
                      <Highlight text={c.coach?.name ?? '—'} query={query} />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <EnrollmentMeter course={c} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatMoney(c.price, c.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={c.active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">{renderActions(c, 'table')}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="list-none border-t md:hidden">
            {shown.map((c) => (
              <li key={c.id} className="border-t p-4 first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium">
                      <Highlight text={c.name} query={query} />
                    </span>
                    <span className="text-muted-foreground block text-sm">
                      {c.location?.name ?? '—'}
                    </span>
                  </div>
                  <StatusBadge active={c.active} />
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {c.sport?.name ?? '—'} · <Highlight text={c.coach?.name ?? '—'} query={query} /> ·{' '}
                  {c.club?.name ?? 'Antrenor independent'}
                </p>
                <AttentionNote reason={attentionReason(c)} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="font-display font-bold">
                      {formatMoney(c.price, c.currency)}
                    </span>
                    <EnrollmentMeter course={c} />
                  </span>
                  <div className="flex gap-2">{renderActions(c, 'card')}</div>
                </div>
              </li>
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
