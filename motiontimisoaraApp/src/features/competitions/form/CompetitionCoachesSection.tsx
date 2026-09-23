import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  getCompetitionCoaches,
  inviteCompetitionCoach,
  removeCompetitionCoach,
  searchCompetitionCoaches,
  type CompetitionCoach,
} from '@/api/competition/competition-coaches'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const statusLabel: Record<
  CompetitionCoach['status'],
  { text: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  accepted: { text: 'A acceptat', variant: 'default' },
  invited: { text: 'Așteaptă răspuns', variant: 'secondary' },
  declined: { text: 'A refuzat', variant: 'destructive' },
}

export function CompetitionCoachesSection({ competitionId }: { competitionId: string }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const coachesQuery = useQuery({
    queryKey: ['competition-coaches', competitionId],
    queryFn: () => getCompetitionCoaches(competitionId),
  })
  const coaches = coachesQuery.data ?? []
  const excludedIds = coaches.map((coach) => coach.coachProfileId)
  const candidatesQuery = useQuery({
    queryKey: ['competition-coach-search', search, excludedIds.join(',')],
    queryFn: () => searchCompetitionCoaches(search, excludedIds),
    enabled: search.trim().length >= 2,
  })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['competition-coaches', competitionId] })
    void queryClient.invalidateQueries({ queryKey: ['competition-public-coaches', competitionId] })
    void queryClient.invalidateQueries({ queryKey: ['competition-invitations'] })
  }

  const invite = useMutation({
    mutationFn: (coachProfileId: string) => inviteCompetitionCoach(competitionId, coachProfileId),
    onSuccess: () => {
      toast.success('Invitație trimisă. Antrenorul apare public după ce acceptă.')
      setSearch('')
      refresh()
    },
    onError: () => toast.error('Nu am putut trimite invitația.'),
  })

  const remove = useMutation({
    mutationFn: (coachProfileId: string) => removeCompetitionCoach(competitionId, coachProfileId),
    onSuccess: () => {
      toast.success('Antrenorul a fost scos din concurs.')
      setConfirmRemoveId(null)
      refresh()
    },
    onError: () => toast.error('Nu am putut scoate antrenorul.'),
  })

  return (
    <fieldset className="space-y-4 rounded-2xl border p-5">
      <legend className="px-2 font-semibold">Antrenorii asociați</legend>
      <p className="text-muted-foreground text-sm">
        Poți invita un antrenor la concurs. Numele și poza lui apar pe pagina publică doar după
        acceptare.
      </p>

      {coachesQuery.isPending ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : coachesQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p>Nu am putut încărca antrenorii asociați.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void coachesQuery.refetch()}
          >
            Reîncearcă
          </Button>
        </div>
      ) : (
        <>
          {coaches.length === 0 ? (
            <p role="status" className="text-muted-foreground text-sm">
              Niciun antrenor invitat încă.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Antrenorii asociați concursului">
              {coaches.map((coach) => (
                <li
                  key={coach.coachProfileId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  {coach.photoUrl ? (
                    <img
                      src={coach.photoUrl}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                      {coach.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 font-medium">{coach.name}</span>
                  <Badge variant={statusLabel[coach.status].variant}>
                    {coach.status === 'invited' && (
                      <Clock aria-hidden="true" className="mr-1 size-3" />
                    )}
                    {coach.status === 'accepted' && (
                      <Check aria-hidden="true" className="mr-1 size-3" />
                    )}
                    {statusLabel[coach.status].text}
                  </Badge>
                  <Button
                    type="button"
                    variant={confirmRemoveId === coach.coachProfileId ? 'destructive' : 'ghost'}
                    className="min-h-11"
                    disabled={remove.isPending}
                    onClick={() =>
                      confirmRemoveId === coach.coachProfileId
                        ? remove.mutate(coach.coachProfileId)
                        : setConfirmRemoveId(coach.coachProfileId)
                    }
                    aria-label={
                      confirmRemoveId === coach.coachProfileId
                        ? `Confirmă scoaterea lui ${coach.name}`
                        : `Scoate-l pe ${coach.name} din concurs`
                    }
                  >
                    <X aria-hidden="true" className="size-4" />
                    {confirmRemoveId === coach.coachProfileId && 'Confirmă'}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label htmlFor="competition-coach-search">Caută un antrenor</Label>
            <Input
              id="competition-coach-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Scrie cel puțin două litere din nume"
              className="h-11 lg:h-9"
            />
          </div>
          {search.trim().length >= 2 && (
            <div className="space-y-2">
              {candidatesQuery.isPending ? (
                <p role="status" className="text-muted-foreground text-sm">
                  Caut antrenori…
                </p>
              ) : candidatesQuery.isError ? (
                <div role="alert" className="space-y-2">
                  <p>Nu am putut căuta antrenori.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void candidatesQuery.refetch()}
                  >
                    Reîncearcă căutarea
                  </Button>
                </div>
              ) : candidatesQuery.data.length === 0 ? (
                <p role="status" className="text-muted-foreground text-sm">
                  Niciun antrenor nou găsit. Cei deja invitați nu apar aici.
                </p>
              ) : (
                <ul className="space-y-2" aria-label="Rezultatele căutării">
                  {candidatesQuery.data.map((candidate) => (
                    <li
                      key={candidate.coachProfileId}
                      className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                    >
                      {candidate.photoUrl ? (
                        <img
                          src={candidate.photoUrl}
                          alt=""
                          className="size-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="bg-muted flex size-10 items-center justify-center rounded-full text-sm font-medium">
                          {candidate.name.charAt(0)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 font-medium">{candidate.name}</span>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={invite.isPending}
                        onClick={() => invite.mutate(candidate.coachProfileId)}
                      >
                        <UserPlus aria-hidden="true" className="size-4" /> Invită
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  )
}
