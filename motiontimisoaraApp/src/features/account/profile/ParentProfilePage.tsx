import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { completeProfile, requestPasswordReset } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'
import { FormSection, RequiredFieldsNote, RequiredMark } from '@/components/FormSection'
import { Button } from '@/components/ui/button'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const parentProfileSchema = z.object({
  name: z.string().trim().min(2, 'Minim 2 caractere'),
  phone: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(z.string().regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid')),
})
type Values = z.input<typeof parentProfileSchema>
type Parsed = z.output<typeof parentProfileSchema>

export default function ParentProfilePage() {
  const { user, loading, refresh } = useAuth()
  const [sendingReset, setSendingReset] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Parsed>({ resolver: zodResolver(parentProfileSchema) })

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
    const { error } = await completeProfile(user.id, { name: v.name, phone: v.phone })
    if (error) {
      toast.error('Nu am putut salva profilul.')
      return
    }
    await refresh()
    toast.success('Profil actualizat.')
  }

  const onPasswordReset = async () => {
    setSendingReset(true)
    try {
      const { error } = await requestPasswordReset(
        user.email,
        `${window.location.origin}/reset-password`,
      )
      if (error) throw error
      toast.success('Ți-am trimis pe email linkul pentru parola nouă.')
    } catch {
      toast.error('Nu am putut trimite linkul. Verifică conexiunea și încearcă din nou.')
    } finally {
      setSendingReset(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-foreground text-2xl font-bold break-words">
          Profilul meu
        </h1>
        <RequiredFieldsNote />
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormSection
          title="Date de contact"
          description="Clubul și antrenorii te contactează la acest număr despre înscrierile copiilor."
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">
              Nume <RequiredMark />
            </Label>
            <Input
              id="profile-name"
              autoComplete="name"
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={fieldDescription('profile-name', undefined, errors.name?.message)}
              {...register('name')}
            />
            <FieldMessage id="profile-name" error={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">
              Telefon <RequiredMark />
            </Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+40..."
              aria-required="true"
              aria-invalid={!!errors.phone}
              aria-describedby={fieldDescription('profile-phone', undefined, errors.phone?.message)}
              {...register('phone')}
            />
            <FieldMessage id="profile-phone" error={errors.phone?.message} />
          </div>
        </FormSection>
        <FormSection
          title="Cont"
          description="Adresa de email cu care intri în cont nu se poate schimba de aici."
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={user.email}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              className="min-h-touch-target"
              disabled={sendingReset}
              onClick={() => void onPasswordReset()}
            >
              <KeyRound aria-hidden="true" />
              {sendingReset ? 'Se trimite…' : 'Schimbă parola'}
            </Button>
            <p className="text-muted-foreground text-xs">
              Îți trimitem pe email un link pentru parola nouă.
            </p>
          </div>
        </FormSection>
        <Button type="submit" disabled={isSubmitting} className="h-11 min-h-11">
          {isSubmitting ? 'Se salvează…' : 'Salvează'}
        </Button>
      </form>
    </div>
  )
}
