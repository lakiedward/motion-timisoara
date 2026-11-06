import { useQuery } from '@tanstack/react-query'

import { getPublicCompetitionCoaches } from '@/api/competition/competition-coaches'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CoachCardList, type CoachCard } from '@/features/public/components/OrganizerCoaches'

export const COMPETITION_COACHES_SECTION =
  'manual:section:antrenorii-concursului:ed899e4a-2861-41db-90de-8919d7569fb6'

export function CompetitionCoachesSection({ competitionId }: { competitionId: string }) {
  const coaches = useQuery({
    queryKey: ['competition-public-coaches', competitionId],
    queryFn: () => getPublicCompetitionCoaches(competitionId),
  })
  const cards: CoachCard[] = (coaches.data ?? []).map((coach) => ({
    id: coach.coachProfileId,
    nume: coach.name,
    pozaUrl: coach.photoUrl,
    link: coach.userId ? `/antrenori/${coach.userId}` : null,
  }))

  return (
    <section
      data-section={COMPETITION_COACHES_SECTION}
      aria-labelledby="competition-coaches-title"
      className="mt-8"
    >
      <h2 id="competition-coaches-title" className="font-display mb-3 text-xl font-bold">
        Antrenorii concursului
      </h2>
      {coaches.isLoading ? (
        <Skeleton role="status" aria-label="Se încarcă antrenorii" className="h-24 rounded-xl" />
      ) : coaches.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-4">
          <p>Nu am putut încărca antrenorii.</p>
          <Button variant="outline" onClick={() => void coaches.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : cards.length ? (
        <CoachCardList antrenori={cards} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Nu există încă antrenori confirmați pentru acest concurs.
        </p>
      )}
    </section>
  )
}
