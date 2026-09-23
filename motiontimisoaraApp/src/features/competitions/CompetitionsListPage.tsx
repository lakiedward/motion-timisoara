import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { getConcursurileMele, urlHeroConcurs } from '@/api/competition/competitions'
import { Button } from '@/components/ui/button'
import type { CompetitionPortalBaza } from './competition-portal'
import { useCompetitionOwner } from './useCompetitionOwner'
import { CompetitionInvitations } from './CompetitionInvitations'

export default function CompetitionsListPage({ baza }: { baza: CompetitionPortalBaza }) {
  const { owner, gata, eroare, reincearca } = useCompetitionOwner()
  const {
    data: concursuri = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['concursurile-mele', owner.role, owner.clubId, owner.coachUserId],
    queryFn: () => getConcursurileMele(owner),
    enabled: gata,
  })

  if (eroare || isError) {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca concursurile.</p>
        <Button
          className="mt-4 h-11 min-h-11"
          type="button"
          onClick={() => (eroare ? reincearca() : void refetch())}
        >
          Reîncearcă
        </Button>
      </div>
    )
  }

  return (
    <div>
      {owner.role === 'COACH' && <CompetitionInvitations />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Concursuri</h1>
        <Button asChild className="h-11 min-h-11">
          <Link to={`${baza}/new`}>
            <Plus className="size-4" /> Concurs nou
          </Link>
        </Button>
      </div>

      {!gata || isLoading ? (
        <p className="text-muted-foreground mt-8 text-sm">Se încarcă…</p>
      ) : concursuri.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-8 text-center">
          <p className="text-foreground font-medium">Niciun concurs încă.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Adaugă programul și locația, apoi traseele GPX și categoriile de vârstă.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {concursuri.map((concurs) => {
            const hero = urlHeroConcurs(concurs.hero_photo_storage_path)
            return (
              <li key={concurs.id}>
                <Link
                  to={`${baza}/${concurs.id}/edit`}
                  className="focus-visible:ring-ring/50 block h-full overflow-hidden rounded-2xl border outline-none transition-colors hover:border-foreground/20 focus-visible:ring-[3px]"
                >
                  {hero && <img src={hero} alt="" className="h-36 w-full object-cover" />}
                  <div className="p-5">
                    <h2 className="font-display text-lg font-semibold">{concurs.title}</h2>
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                      {concurs.description}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
