import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import {
  createManagedCoach,
  deleteClubCode,
  generateClubCode,
  getClubCoaches,
  getClubCodes,
  getMyClub,
  removeClubCoach,
  type CreateManagedCoachResult,
} from '@/api/club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const coachSchema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  email: z.string().email('Email invalid'),
  phone: z.string().optional(),
})
type CoachValues = z.infer<typeof coachSchema>

export default function ClubCoachesPage() {
  const qc = useQueryClient()
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id
  const [created, setCreated] = useState<CreateManagedCoachResult | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CoachValues>({ resolver: zodResolver(coachSchema) })

  const onCreateCoach = async (v: CoachValues) => {
    try {
      const result = await createManagedCoach({ name: v.name, email: v.email, phone: v.phone || undefined })
      setCreated(result)
      reset()
      qc.invalidateQueries({ queryKey: ['club-coaches', clubId] })
      toast.success('Antrenor creat.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nu am putut crea antrenorul.')
    }
  }

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
        <h2 className="font-display mb-4 text-xl font-bold text-foreground">Adaugă antrenor direct</h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Creezi un cont de antrenor adăugat automat în club. Vei primi o parolă temporară de
          transmis antrenorului.
        </p>

        {created && (
          <div className="bg-success/10 border-success/30 mb-4 rounded-2xl border p-4">
            <p className="text-sm font-semibold">Antrenor creat: {created.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Parolă temporară:</span>
              <code className="bg-muted rounded px-2 py-1 font-mono text-sm">{created.tempPassword}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(created.tempPassword)
                  toast.success('Parolă copiată.')
                }}
              >
                <Copy />
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Transmite aceste date antrenorului. Îi recomandăm să schimbe parola la prima
              autentificare.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onCreateCoach)} className="grid gap-3 sm:grid-cols-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="coach-name">Nume</Label>
            <Input id="coach-name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-email">Email</Label>
            <Input id="coach-email" type="email" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-phone">Telefon (opțional)</Label>
            <Input id="coach-phone" {...register('phone')} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting || !clubId}>
              <UserPlus /> {isSubmitting ? 'Se creează…' : 'Creează antrenor'}
            </Button>
          </div>
        </form>
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
