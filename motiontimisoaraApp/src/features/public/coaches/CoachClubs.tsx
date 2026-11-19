import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Crown } from 'lucide-react'

import type { CoachClubRole } from '@/api/club-team'
import { HEAD_COACH_LABEL } from '../club-detail/head-coach'

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function ClubLine({ clubs, head }: { clubs: CoachClubRole[]; head: boolean }) {
  if (clubs.length === 0) return null
  const Icon = head ? Crown : Building2
  return (
    <p className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-sm sm:justify-start">
      <Icon aria-hidden="true" className="text-primary size-4 shrink-0" />
      {head ? `${HEAD_COACH_LABEL} la` : 'Antrenor la'}
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

export function CoachClubs({ clubs }: { clubs: CoachClubRole[] }) {
  return (
    <>
      <ClubLine clubs={clubs.filter((club) => club.isHead)} head />
      <ClubLine clubs={clubs.filter((club) => !club.isHead)} head={false} />
    </>
  )
}
