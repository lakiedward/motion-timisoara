import { ChevronDown } from 'lucide-react'

import { Highlight } from '@/features/admin/courses/CourseParts'
import { ORGANIZER_ICON } from '@/features/admin/locations/organizer-icon'
import { cn } from '@/lib/utils'
import { AdminSessionRow } from './AdminSessionRow'
import { countSessions, type SessionGroup } from './attendance-overview'

export const SESSION_PREVIEW_LIMIT = 5

export function SessionGroupCard({
  group,
  open,
  expanded,
  query,
  onOpenChange,
  onExpand,
}: {
  group: SessionGroup
  open: boolean
  expanded: boolean
  query: string
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const Icon = ORGANIZER_ICON[group.kind]
  const searching = query.trim().length > 0
  const shown = expanded || searching ? group.items : group.items.slice(0, SESSION_PREVIEW_LIMIT)
  const hidden = group.items.length - shown.length
  const panelId = `sedinte-${group.key.replace(/[^a-z0-9-]/gi, '-')}`

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
            <span className="text-muted-foreground text-sm">
              {group.unmarkedCount > 0 ? (
                <>
                  <strong className="text-foreground tabular-nums">{group.unmarkedCount}</strong>{' '}
                  nepontate din {group.totalCount}
                </>
              ) : (
                `${countSessions(group.totalCount)}, toate pontate`
              )}
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
            {shown.map((s) => (
              <AdminSessionRow key={s.id} session={s} query={query} />
            ))}
          </ul>
          {hidden > 0 && (
            <div className="border-t px-4 py-2 md:pl-5">
              <button
                type="button"
                onClick={onExpand}
                className="text-primary inline-flex min-h-touch-target items-center text-sm font-semibold lg:min-h-8"
              >
                Vezi toate cele {countSessions(group.items.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
