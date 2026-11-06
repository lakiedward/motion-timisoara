import { Building2, ChevronDown, UserRound } from 'lucide-react'

import { Highlight } from '@/features/admin/courses/CourseParts'
import { PREVIEW_LIMIT } from '@/features/admin/courses/OrganizerCard'
import { cn } from '@/lib/utils'
import { CompetitionRow } from './CompetitionRows'
import { countCompetitions, type CompetitionOrganizerGroup } from './competition-list'

export function CompetitionOrganizerCard({
  group,
  baza,
  open,
  expanded,
  query,
  onOpenChange,
  onExpand,
}: {
  key?: string
  group: CompetitionOrganizerGroup
  baza: string
  open: boolean
  expanded: boolean
  query: string
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const Icon = group.kind === 'club' ? Building2 : UserRound
  const searching = query.trim().length > 0
  const shown = expanded || searching ? group.items : group.items.slice(0, PREVIEW_LIMIT)
  const hidden = group.items.length - shown.length
  const panelId = `organizator-concursuri-${group.key.replace(/[^a-z0-9-]/gi, '-')}`

  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-label={group.name}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:-outline-offset-2 md:px-5"
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
                <strong className="text-foreground tabular-nums">{group.openCount}</strong> active
                din {group.totalCount}
              </span>
              <span>
                <strong className="text-foreground tabular-nums">{group.registered}</strong>{' '}
                înscriși
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

      <div id={panelId} hidden={!open}>
        {open && (
          <>
            <ul className="divide-y border-t">
              {shown.map((c) => (
                <CompetitionRow key={c.id} item={c} baza={baza} titleAs="h4" />
              ))}
            </ul>
            {hidden > 0 && (
              <div className="border-t px-4 py-2 md:pl-5">
                <button
                  type="button"
                  onClick={onExpand}
                  className="text-primary inline-flex min-h-touch-target items-center text-sm font-semibold lg:min-h-8"
                >
                  Vezi toate cele {countCompetitions(group.items.length)}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
