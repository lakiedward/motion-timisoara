import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserMinus } from 'lucide-react'
import { toast } from 'sonner'

import { getClubCoaches, removeClubCoach } from '@/api/club'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubCoachList({ clubId }: { clubId: string | undefined }) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: () => getClubCoaches(clubId!),
    enabled: !!clubId,
  })
  const removeCoach = useMutation({
    mutationFn: (coachProfileId: string) => removeClubCoach(clubId!, coachProfileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['club-coaches', clubId] })
      toast.success('Antrenor eliminat din club.')
    },
    onError: () => toast.error('Nu am putut elimina antrenorul.'),
  })
  const coaches = query.data ?? []

  if (query.isPending)
    return (
      <div role="status" aria-label="Se încarcă antrenorii">
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    )
  if (query.isError)
    return (
      <div role="alert" className="space-y-3 rounded-2xl border p-4">
        <p className="text-destructive text-sm">Nu am putut încărca antrenorii clubului.</p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
        </Button>
      </div>
    )
  if (!coaches.length)
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
        Niciun antrenor în club. Adaugă unul mai jos sau generează un cod de invitație.
      </div>
    )
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {coaches.map((c) => (
        <li
          key={c.coach_profile_id}
          className="bg-card shadow-card flex min-w-0 items-center gap-3 rounded-2xl p-4"
        >
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full font-bold"
          >
            {c.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{c.name}</div>
            <div className="text-muted-foreground truncate text-xs">{c.email}</div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive min-h-11 min-w-11"
            aria-label={`Elimină antrenorul ${c.name}`}
            disabled={removeCoach.isPending}
            onClick={() => {
              if (confirm(`Elimini antrenorul ${c.name} din club?`))
                removeCoach.mutate(c.coach_profile_id)
            }}
          >
            <UserMinus />
          </Button>
        </li>
      ))}
    </ul>
  )
}
