import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getConcurs } from '@/api/competition/competitions'
import { getCompetitionCategories } from '@/api/competition/competition-offers'
import {
  getCompetitionPodiumCandidates,
  getCompetitionPodiumManagement,
  publishCompetitionPodiumCategory,
  saveCompetitionPodiumPlace,
} from '@/api/competition/competition-podium'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { CompetitionPortalBaza } from '../competition-portal'
import { useCompetitionOwner } from '../useCompetitionOwner'
import { useState } from 'react'
import { useCompetitionClock } from '../useCompetitionClock'

export default function CompetitionPodiumPage({ baza }: { baza: CompetitionPortalBaza }) {
  const { id = '' } = useParams()
  const { owner } = useCompetitionOwner()
  const queryClient = useQueryClient()
  const [categoryId, setCategoryId] = useState('')

  const competition = useQuery({
    queryKey: ['concurs-de-editat', id],
    queryFn: () => getConcurs(id),
    enabled: Boolean(id),
  })
  const now = useCompetitionClock(competition.data?.end_at)
  const categories = useQuery({
    queryKey: ['competition-categories', id],
    queryFn: () => getCompetitionCategories(id),
    enabled: Boolean(id),
  })
  const podium = useQuery({
    queryKey: ['competition-podium-management', id],
    queryFn: () => getCompetitionPodiumManagement(id),
    enabled: Boolean(id),
  })
  const selectedCategoryId = categoryId || categories.data?.[0]?.id || ''
  const candidates = useQuery({
    queryKey: ['competition-podium-candidates', id, selectedCategoryId],
    queryFn: () => getCompetitionPodiumCandidates(id, selectedCategoryId),
    enabled: Boolean(
      id &&
      selectedCategoryId &&
      competition.data?.end_at &&
      Date.parse(competition.data.end_at) <= now,
    ),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['competition-podium-management', id] })
    void queryClient.invalidateQueries({ queryKey: ['competition-podium-public', id] })
  }
  const save = useMutation({
    mutationFn: saveCompetitionPodiumPlace,
    onSuccess: () => {
      toast.success('Podiumul a fost salvat.')
      refresh()
    },
    onError: (error: Error) => toast.error(error.message || 'Nu am putut salva podiumul.'),
  })
  const publish = useMutation({
    mutationFn: () => publishCompetitionPodiumCategory(id, selectedCategoryId),
    onSuccess: () => {
      toast.success('Podiumul categoriei este public.')
      refresh()
    },
    onError: (error: Error) => toast.error(error.message || 'Nu am putut publica podiumul.'),
  })

  if (competition.isLoading || categories.isLoading || podium.isLoading) {
    return <Skeleton className="h-80 rounded-3xl" />
  }
  if (competition.isError || categories.isError || podium.isError) {
    return (
      <div role="alert" className="space-y-3 py-10 text-center">
        <p>Nu am putut încărca podiumul.</p>
        <Button
          variant="outline"
          onClick={() =>
            void Promise.all([competition.refetch(), categories.refetch(), podium.refetch()])
          }
        >
          Reîncearcă
        </Button>
      </div>
    )
  }
  if (!competition.data) return <p>Concursul nu a fost găsit.</p>

  const canPublish =
    owner.role === 'ADMIN' ||
    (owner.role === 'CLUB' && owner.clubId === competition.data.club_id) ||
    (owner.role === 'COACH' && owner.coachUserId === competition.data.coach_id)
  const ended = Boolean(competition.data.end_at && Date.parse(competition.data.end_at) <= now)
  const results = podium.data?.results.filter((row) => row.category_id === selectedCategoryId) ?? []
  const publication = podium.data?.publications.find(
    (row) => row.category_id === selectedCategoryId,
  )
  const candidateCount = candidates.data?.length ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to={baza}
        className="text-primary inline-flex min-h-11 items-center text-sm font-medium"
      >
        ← Concursuri
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold">Podium · {competition.data.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Poți alege numai copii cu înscriere activă în categoria respectivă. Modificările după
          publicare apar imediat public.
        </p>
      </div>

      {!ended ? (
        <p className="rounded-2xl border p-5">
          Podiumul poate fi completat după finalul concursului.
        </p>
      ) : !categories.data?.length ? (
        <p className="rounded-2xl border border-dashed p-5">Concursul nu are categorii.</p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="podium-category">Categorie</Label>
            <select
              id="podium-category"
              value={selectedCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]"
            >
              {categories.data.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          {publication ? (
            <p role="status" className="bg-primary/10 rounded-xl p-3 text-sm font-medium">
              Publicat. Corecțiile făcute aici sunt vizibile imediat.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">Rezultatele sunt încă private.</p>
          )}

          {candidates.isLoading ? (
            <Skeleton className="h-52 rounded-2xl" />
          ) : candidates.isError ? (
            <div role="alert" className="space-y-3 rounded-2xl border p-5">
              <p>Nu am putut încărca participanții eligibili.</p>
              <Button variant="outline" onClick={() => void candidates.refetch()}>
                Reîncearcă
              </Button>
            </div>
          ) : candidateCount === 0 ? (
            <p className="rounded-2xl border border-dashed p-5">
              Niciun copil înscris și confirmat în această categorie.
            </p>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3].map((place) => {
                const current = results.find((row) => row.place === place)
                const taken = new Set(
                  results.filter((row) => row.place !== place).map((row) => row.registration_id),
                )
                return (
                  <div key={place} className="bg-card shadow-card space-y-2 rounded-2xl p-5">
                    <Label htmlFor={`podium-place-${place}`}>Locul {place}</Label>
                    <select
                      id={`podium-place-${place}`}
                      value={current?.registration_id ?? ''}
                      disabled={save.isPending}
                      onChange={(event) =>
                        save.mutate({
                          competitionId: id,
                          categoryId: selectedCategoryId,
                          place,
                          registrationId: event.target.value || null,
                          currentId: current?.id ?? null,
                        })
                      }
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]"
                    >
                      <option value="">Loc necompletat</option>
                      {candidates.data
                        ?.filter((candidate) => !taken.has(candidate.registration_id))
                        .map((candidate) => (
                          <option key={candidate.registration_id} value={candidate.registration_id}>
                            {candidate.child_name} · {candidate.age_at_registration} ani la
                            înscriere
                          </option>
                        ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
          {canPublish && !publication && results.length > 0 && (
            <Button
              className="h-11 min-h-11"
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? 'Se publică…' : 'Publică podiumul categoriei'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
