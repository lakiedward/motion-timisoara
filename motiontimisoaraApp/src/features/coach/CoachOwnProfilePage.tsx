import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyCoachProfile, updateMyCoachProfile } from '@/api/coach'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  phone: z.string().optional(),
  bio: z.string().optional(),
})
type Values = z.infer<typeof schema>

export default function CoachOwnProfilePage() {
  const qc = useQueryClient()
  const { refresh } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['my-coach-profile'], queryFn: getMyCoachProfile })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        phone: data.phone ?? '',
        bio: data.bio,
      })
    }
  }, [data, reset])

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (!data) return <p className="text-muted-foreground">Nu am găsit profilul de antrenor.</p>

  const onSubmit = async (v: Values) => {
    try {
      await updateMyCoachProfile({
        name: v.name,
        phone: v.phone || null,
        bio: v.bio || null,
      })
      await refresh()
      qc.invalidateQueries({ queryKey: ['my-coach-profile'] })
      toast.success('Profil actualizat.')
    } catch {
      toast.error('Nu am putut salva profilul.')
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Profil antrenor</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="bg-card shadow-card space-y-4 rounded-3xl border p-6">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nume</Label>
            <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" type="tel" {...register('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              rows={4}
              {...register('bio')}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            />
          </div>
        </section>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
    </div>
  )
}
