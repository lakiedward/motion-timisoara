import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import {
  createCoachAccount,
  deleteInviteCode,
  generateCoachInviteCode,
  getCoachInviteCodes,
  type CreatedCoach,
} from '@/api/admin'
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

export default function AdminInviteCodesPage() {
  const qc = useQueryClient()
  const { data: codes = [], isLoading } = useQuery({ queryKey: ['invite-codes'], queryFn: getCoachInviteCodes })
  const [created, setCreated] = useState<CreatedCoach | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CoachValues>({ resolver: zodResolver(coachSchema) })

  const onCreateCoach = async (v: CoachValues) => {
    try {
      const result = await createCoachAccount({ name: v.name, email: v.email, phone: v.phone || undefined })
      setCreated(result)
      reset()
      toast.success('Antrenor creat.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nu am putut crea antrenorul.')
    }
  }

  const gen = useMutation({
    mutationFn: () => generateCoachInviteCode(1),
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ['invite-codes'] })
      navigator.clipboard?.writeText(code)
      toast.success(`Cod generat și copiat: ${code}`)
    },
    onError: () => toast.error('Nu am putut genera codul.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteInviteCode(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite-codes'] }),
    onError: () => toast.error('Nu am putut șterge codul.'),
  })

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h1 className="font-display mb-2 text-2xl font-bold text-foreground">Adaugă antrenor direct</h1>
        <p className="text-muted-foreground mb-4 text-sm">
          Creezi un cont de antrenor independent (fără club). Vei primi o parolă temporară de
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
            <Button type="submit" disabled={isSubmitting}>
              <UserPlus /> {isSubmitting ? 'Se creează…' : 'Creează antrenor'}
            </Button>
          </div>
        </form>
      </section>

      <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">Coduri invitație antrenori</h2>
        <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
          <Plus /> Generează cod
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : codes.length ? (
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(c.code)
                      toast.success('Copiat.')
                    }}
                  >
                    <Copy />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={del.isPending} onClick={() => del.mutate(c.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun cod. Generează unul pentru a invita un antrenor.
        </div>
      )}
      </section>
    </div>
  )
}
