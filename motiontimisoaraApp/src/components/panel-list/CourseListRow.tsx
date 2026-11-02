import type { ReactNode } from 'react'
import { CircleOff, MapPin, UsersRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { courseAgeLabel } from '@/features/club/courses/club-course-filters'
import type { Tables } from '@/lib/database.types'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export type CourseListItem = Pick<
  Tables<'courses'>,
  'id' | 'name' | 'active' | 'price' | 'currency' | 'age_from' | 'age_to'
> & {
  sport: { name: string } | null
  location: { name: string } | null
  coach?: { name: string | null } | null
}

export function CourseListRow({
  course: c,
  showCoach = false,
  query = '',
  enrollment,
  note,
  actions,
}: {
  key?: string
  course: CourseListItem
  showCoach?: boolean
  query?: string
  enrollment?: ReactNode
  note?: ReactNode
  actions: ReactNode
}) {
  const ageLabel = courseAgeLabel(c.age_from, c.age_to)
  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5',
        !c.active && 'bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display min-w-0 text-base font-bold wrap-anywhere">
            <Highlight text={c.name} query={query} />
          </h3>
          {c.sport && <Badge variant="secondary">{c.sport.name}</Badge>}
          {c.active ? (
            <Badge variant="success">Activ</Badge>
          ) : (
            <Badge variant="outline">
              <CircleOff aria-hidden="true" /> Inactiv
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <Highlight text={c.location?.name ?? '—'} query={query} />
          </span>
          {ageLabel && (
            <span className="inline-flex items-center gap-1">
              <UsersRound aria-hidden="true" className="size-4 shrink-0" />
              {ageLabel}
            </span>
          )}
          {enrollment}
          <span className="text-foreground font-semibold">{formatMoney(c.price, c.currency)}</span>
        </p>
        {showCoach && (
          <p className="text-muted-foreground mt-1 text-sm wrap-anywhere">
            Antrenor: <Highlight text={c.coach?.name?.trim() || '—'} query={query} />
          </p>
        )}
        {note}
      </div>
      <div className="flex shrink-0 gap-2">{actions}</div>
    </li>
  )
}
