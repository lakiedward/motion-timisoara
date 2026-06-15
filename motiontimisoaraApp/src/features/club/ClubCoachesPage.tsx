import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, Trash2, UserMinus } from 'lucide-react'
import { toast } from 'sonner'

import {
  deleteClubCode,
  generateClubCode,
  getClubCoaches,
  getClubCodes,
  getMyClub,
  removeClubCoach,
} from '@/api/club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubCoachesPage() {
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id

  const { data: coaches = [], isLoading } = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: () => getClubCoaches(clubId!),
    enabled: !!clubId,
  })
  const { data: codes = [] } = useQuery({
    queryKey: ['club-codes', clubId],
    queryFn: () => getClubCodes(clubId!),
    enabled: !!clubId,
  })

  const gen = useMutation({
    mutationFn: () => generateClubCode(clubId!, 1),
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ['club-codes', clubId] })
      navigator.clipboard?.writeText(code)
      toast.success(`Cod generat și copiat: ${code}`)
    },
    onError: () => toast.error('Nu am putut genera codul.'),
  })
  const delCode = useMutation({
    mutationFn: (id: string) => deleteClubCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-codes', clubId] }),
  })
  const removeCoach = useMutation({
    mutationFn: (coachProfileId: string) => removeClubCoach(clubId!, coachProfileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-coaches', clubId] })
      toast.success('Antrenor eliminat din club.')
    },
    onError: () => toast.error('Nu am putut elimina antrenorul.'),
  })

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Antrenori</h1>
        {isLoading ? (
          <Skeleton className="h-32 rounded-3xl" />
        ) : coaches.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {coaches.map((c) => (
              <div key={c.coach_profile_id} className="bg-card shadow-card flex items-center gap-3 rounded-2xl p-4">
                <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-full font-bold">
                  {c.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-muted-foreground truncate text-xs">{c.email}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={removeCoach.isPending}
                  onClick={() => {
                    if (confirm(`Elimini antrenorul ${c.name} din club?`)) removeCoach.mutate(c.coach_profile_id)
                  }}
                >
                  <UserMinus />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
            Niciun antrenor în club. Generează un cod de invitație mai jos.
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">Coduri de invitație</h2>
          <Button onClick={() => gen.mutate()} disabled={gen.isPending || !clubId}>
            <Plus /> Generează cod
          </Button>
        </div>
        <p className="text-muted-foreground mb-3 text-sm">
          Un antrenor poate folosi codul pentru a se alătura clubului tău.
        </p>
        {codes.length ? (
          <ul className="space-y-2">
            {codes.map((c) => {
              const used = c.current_uses >= c.max_uses
              return (
                <li key={c.id} className="bg-card flex items-center justify-between rounded-2xl border p-3">
                  <div className="flex items-center gap-3">
                    <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{c.code}</code>
                    <Badge variant={used ? 'outline' : 'success'}>
                      {used ? 'Folosit' : `${c.current_uses}/${c.max_uses}`}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(c.code); toast.success('Copiat.') }}>
                      <Copy />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delCode.mutate(c.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Niciun cod generat.</p>
        )}
      </section>
    </div>
  )
}
