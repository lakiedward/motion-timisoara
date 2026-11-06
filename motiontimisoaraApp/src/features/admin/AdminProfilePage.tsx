import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { completeProfile } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'
import { FormSection, RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const adminProfileSchema = z.object({
  name: z.string().trim().min(2, 'Minim 2 caractere'),
  phone: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(z.union([z.literal(''), z.string().regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid')])),
})
type Values = z.input<typeof adminProfileSchema>
type Parsed = z.output<typeof adminProfileSchema>

export default function AdminProfilePage() {
  const { user, loading, refresh } = useAuth()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Parsed>({ resolver: zodResolver(adminProfileSchema) })

  useEffect(() => {
    if (user) reset({ name: user.name, phone: user.phone ?? '' })
  }, [user, reset])

  if (loading || !user)
    return (
      <div role="status" aria-label="Se încarcă profilul" className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )

  const onSubmit = async (v: Parsed) => {
    const { error } = await completeProfile(user.id, { name: v.name, phone: v.phone || null })
    if (error) {
      toast.error('Nu am putut salva profilul.')
      return
    }
    await refresh()
    toast.success('Profil actualizat.')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-foreground text-2xl font-bold break-words">
          Profil administrator
        </h1>
        <RequiredFieldsNote />
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormSection
          title="Date de contact"
          description="Numele apare în meniul de administrare; telefonul e pentru contact."
        >
          <div className="space-y-1.5">
            <Label htmlFor="admin-profile-name">
              Nume <RequiredMark />
            </Label>
            <Input
              id="admin-profile-name"
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={fieldDescription(
                'admin-profile-name',
                undefined,
                errors.name?.message,
              )}
              {...register('name')}
            />
            <FieldMessage id="admin-profile-name" error={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-profile-phone">Telefon</Label>
            <Input
              id="admin-profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+40..."
              aria-invalid={!!errors.phone}
              aria-describedby={fieldDescription(
                'admin-profile-phone',
                undefined,
                errors.phone?.message,
              )}
              {...register('phone')}
            />
            <FieldMessage id="admin-profile-phone" error={errors.phone?.message} />
          </div>
        </FormSection>
        <Button type="submit" disabled={isSubmitting} className="h-11 min-h-touch-target">
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
    </div>
  )
}
