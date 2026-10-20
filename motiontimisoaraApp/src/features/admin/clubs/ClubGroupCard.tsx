import { Building2, ChevronDown, GraduationCap } from 'lucide-react'

import { Highlight } from '@/features/admin/courses/CourseParts'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { ClubGroup, ClubSummary } from './club-overview'

export const CLUB_PREVIEW_LIMIT = 4

const countClubs = (n: number) => plural(n, 'club', 'cluburi')

function dashIfMissing(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

export function ClubCourseCount({ club }: { club: ClubSummary }) {
  if (club.totalCourses === 0)
    return <span className="text-muted-foreground text-sm">Niciun curs</span>
  return (
    <span className="text-muted-foreground text-sm">
      <strong className="text-foreground tabular-nums">{club.activeCourses}</strong>{' '}
      {club.activeCourses === 1 ? 'activ' : 'active'} din{' '}
      {plural(club.totalCourses, 'curs', 'cursuri')}
    </span>
  )
}

export function ClubRow({
  club,
  query,
  coursesKnown,
}: {
  club: ClubSummary
  query: string
  coursesKnown: boolean
}) {
  return (
    <li className="flex min-h-16 min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:px-5">
      <span className="bg-accent text-primary grid size-10 shrink-0 place-items-center rounded-full">
        <Building2 aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display text-foreground block font-semibold break-words">
          <Highlight text={club.name} query={query} />
        </span>
        <span className="text-muted-foreground flex flex-wrap gap-x-2 text-sm">
          <span className="break-words">
            <Highlight text={dashIfMissing(club.city)} query={query} />
          </span>
          <span aria-hidden="true">·</span>
          <span className="break-all">
            <Highlight text={dashIfMissing(club.email)} query={query} />
          </span>
        </span>
      </span>
      {coursesKnown && (
        <span className="w-full pl-13 md:w-auto md:pl-0">
          <ClubCourseCount club={club} />
        </span>
      )}
    </li>
  )
}

export function ClubGroupCard({
  group,
  open,
  expanded,
  query,
  coursesKnown,
  onOpenChange,
  onExpand,
}: {
  group: ClubGroup
  open: boolean
  expanded: boolean
  query: string
  coursesKnown: boolean
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const searching = query.trim().length > 0
  const shown = expanded || searching ? group.clubs : group.clubs.slice(0, CLUB_PREVIEW_LIMIT)
  const hidden = group.clubs.length - shown.length
  const panelId = `cluburi-${group.key.replace(/[^a-z0-9-]/gi, '-')}`

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
          <span className="bg-secondary text-muted-foreground grid size-10 shrink-0 place-items-center rounded-full">
            <GraduationCap aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-foreground block font-semibold">{group.name}</span>
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <strong className="text-foreground tabular-nums">{group.clubs.length}</strong>{' '}
                {plural(group.clubs.length, 'club', 'cluburi', true)}
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
            {shown.map((club) => (
              <ClubRow key={club.id} club={club} query={query} coursesKnown={coursesKnown} />
            ))}
          </ul>
          {hidden > 0 && (
            <div className="border-t px-4 py-2 md:pl-5">
              <button
                type="button"
                onClick={onExpand}
                className="text-primary min-h-touch-target inline-flex items-center text-sm font-semibold lg:min-h-8"
              >
                Vezi toate cele {countClubs(group.clubs.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
