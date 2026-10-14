import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyCoachProfile, updateMyCoachProfile } from '@/api/coach'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { Textarea } from '@/components/ui/textarea'
import CoachClubsSection from './profile/CoachClubsSection'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  phone: z.string().optional(),
  bio: z.string().optional(),
})
type Values = z.infer<typeof schema>

export default function CoachOwnProfilePage() {
  const qc = useQueryClient()
  const { refresh } = useAuth()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-coach-profile'],
    queryFn: getMyCoachProfile,
  })

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

  if (isLoading) {
    return (
      <div role="status" aria-label="Se încarcă profilul" className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-84 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca profilul."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void refetch()}
        className="max-w-2xl"
      />
    )
  }

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
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Profil antrenor</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Card>
          <CardContent className="space-y-4">
            <Field id="name" label="Nume" autoComplete="name" error={errors.name?.message} {...register('name')} />
            <Field id="phone" label="Telefon" type="tel" autoComplete="tel" {...register('phone')} />
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={4} {...register('bio')} />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
      <CoachClubsSection />
    </div>
  )
}
