import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { completeProfile } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  name: z.string().min(2, 'Minim 2 caractere'),
  phone: z.string().optional(),
})
type Values = z.infer<typeof schema>

export default function AdminProfilePage() {
  const { user, refresh } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? '' })
  }, [user, reset])

  if (!user) return null

  const onSubmit = async (v: Values) => {
    const { error } = await completeProfile(user.id, { name: v.name, phone: v.phone ?? '' })
    if (error) {
      toast.error('Nu am putut salva profilul.')
      return
    }
    await refresh()
    toast.success('Profil actualizat.')
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display mb-6 text-2xl font-bold break-words text-foreground">Profil</h1>
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
        </section>
        <Button type="submit" disabled={isSubmitting} className="h-11 min-h-11">
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
    </div>
  )
}
