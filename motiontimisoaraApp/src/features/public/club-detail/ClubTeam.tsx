import { useQuery } from '@tanstack/react-query'
import { Crown } from 'lucide-react'

import { getPublicClubTeam } from '@/api/club-team'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { CoachCard } from '../coaches/CoachCard'
import { HEAD_COACH_LABEL } from './head-coach'

const SECTION_KEY = 'motion-react:page:/cluburi/:id:section:antrenorii-clubului'
const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function ClubTeam({ clubId }: { clubId: string }) {
  const team = useQuery({
    queryKey: ['club-team', clubId],
    queryFn: () => getPublicClubTeam(clubId),
  })
  const loading = team.isPending || (team.isError && team.isFetching)
  if (!loading && !team.isError && !team.data?.length) return null

  return (
    <section data-section={SECTION_KEY} aria-labelledby="club-team-title" className="mt-10">
      <h2 id="club-team-title" className="font-display mb-4 text-xl font-bold">
        Antrenorii clubului
      </h2>
      {loading ? (
        <ul role="status" aria-label="Se încarcă antrenorii clubului" className={GRID}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="min-w-0">
              <Skeleton className="h-24 rounded-xl sm:h-56" />
            </li>
          ))}
        </ul>
      ) : team.isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca antrenorii clubului."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void team.refetch()}
        />
      ) : (
        <ul className={GRID}>
          {team.data.map(({ isHead, coach }) => (
            <li key={coach.id} className="min-w-0">
              <CoachCard
                coach={coach}
                badge={
                  isHead ? (
                    <Badge variant="highlight">
                      <Crown aria-hidden="true" />
                      {HEAD_COACH_LABEL}
                    </Badge>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
