import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'

import type { CoachClub } from '@/api/public'

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function CoachClubs({ clubs }: { clubs: CoachClub[] }) {
  if (clubs.length === 0) return null
  return (
    <p className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm sm:justify-start">
      <Building2 aria-hidden="true" className="text-primary size-4 shrink-0" />
      Antrenor la
      {clubs.map((club, index) => (
        <Fragment key={club.id}>
          {index > 0 && <span aria-hidden="true">·</span>}
          <Link
            to={`/cluburi/${club.id}`}
            className={`text-primary min-h-touch-target inline-flex items-center rounded-sm font-semibold underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            {club.name}
          </Link>
        </Fragment>
      ))}
    </p>
  )
}
