import { useQuery } from '@tanstack/react-query'

import { getPublishedCompetitionPodium } from '@/api/competition/competition-podium'
import type { CompetitionCategory } from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const COMPETITION_RESULTS_SECTION =
  'manual:section:rezultate:db258617-6fc6-4840-be2d-b18895fe3766'

export function CompetitionResultsSection({
  competitionId,
  categories,
  categoriesLoading,
}: {
  competitionId: string
  categories: CompetitionCategory[]
  categoriesLoading: boolean
}) {
  const podium = useQuery({
    queryKey: ['competition-podium-public', competitionId],
    queryFn: () => getPublishedCompetitionPodium(competitionId),
  })
  const results = podium.data ?? []
  const withResults = categories.filter((category) =>
    results.some((result) => result.category_id === category.id),
  )

  return (
    <section
      data-section={COMPETITION_RESULTS_SECTION}
      aria-labelledby="competition-results-title"
      className="mt-8"
    >
      <h2 id="competition-results-title" className="font-display mb-3 text-xl font-bold">
        Rezultate
      </h2>
      {podium.isLoading || categoriesLoading ? (
        <Skeleton role="status" aria-label="Se încarcă rezultatele" className="h-32 rounded-xl" />
      ) : podium.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5">
          <p>Nu am putut încărca rezultatele.</p>
          <Button variant="outline" onClick={() => void podium.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : withResults.length ? (
        <div className="space-y-4">
          {withResults.map((category) => (
            <div key={category.id} className="bg-card rounded-xl border p-5">
              <h3 className="font-display text-lg font-bold">{category.name}</h3>
              <ol className="mt-3 space-y-2">
                {results
                  .filter((result) => result.category_id === category.id)
                  .sort((a, b) => a.place - b.place)
                  .map((result) => (
                    <li
                      key={result.place}
                      className="flex justify-between gap-3 rounded-xl border p-3 text-sm"
                    >
                      <span>Locul {result.place}</span>
                      <strong className="text-right break-words">{result.participant_name}</strong>
                    </li>
                  ))}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-5 text-sm">
          Podiumul nu a fost publicat încă.
        </p>
      )}
    </section>
  )
}
