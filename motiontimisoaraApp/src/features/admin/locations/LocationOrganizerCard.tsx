import { ChevronDown } from 'lucide-react'

import type { AdminLocation } from '@/api/locations/admin-locations'
import { ClubLocationRow } from '@/features/club/locations/ClubLocationRow'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { countLocations, type LocationGroup } from './location-overview'
import { ORGANIZER_ICON } from './organizer-icon'

export const LOCATION_PREVIEW_LIMIT = 4

export function LocationOrganizerCard({
  group,
  open,
  expanded,
  query,
  pendingIds,
  onToggleLocation,
  onOpenChange,
  onExpand,
}: {
  group: LocationGroup
  open: boolean
  expanded: boolean
  query: string
  pendingIds: string[]
  onToggleLocation: (l: AdminLocation) => void
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const Icon = ORGANIZER_ICON[group.kind]
  const searching = query.trim().length > 0
  const shown =
    expanded || searching ? group.locations : group.locations.slice(0, LOCATION_PREVIEW_LIMIT)
  const hidden = group.locations.length - shown.length
  const panelId = `locatii-${group.key.replace(/[^a-z0-9-]/gi, '-')}`

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
                <strong className="text-foreground tabular-nums">{group.activeCount}</strong> active
                din {group.totalCount}
              </span>
              <span>
                <strong className="text-foreground tabular-nums">{group.courseCount}</strong>{' '}
                {plural(group.courseCount, 'curs', 'cursuri', true)}
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
            {shown.map((l) => (
              <ClubLocationRow
                key={l.id}
                locatie={l}
                seComuta={pendingIds.includes(l.id)}
                onToggle={() => onToggleLocation(l)}
                editTo={`/admin/locations/${l.id}/edit`}
                details={
                  l.usedBy.length > 0 && (
                    <p className="text-muted-foreground mt-1 text-sm wrap-anywhere">
                      Folosită și de:{' '}
                      <span className="text-foreground font-medium">
                        <Highlight text={l.usedBy.join(', ')} query={query} />
                      </span>
                    </p>
                  )
                }
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
                Vezi toate cele {countLocations(group.locations.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
