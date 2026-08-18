import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

import { AuthLayout } from './AuthLayout'
import { StepDots, SportPicker } from './wizard-bits'
import { useReturnUrl, withReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchSports } from '@/api/sports'
import { registerCoach, roleHome } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  invitationCode: z.string().min(5, 'Cod invalid'),
  name: z.string().min(3, 'Minim 3 caractere'),
  email: z.string().email('Email invalid'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid')
    .optional()
    .or(z.literal('')),
  password: z.string().min(6, 'Minim 6 caractere'),
  bio: z.string().optional(),
})
type Values = z.infer<typeof schema>

const STEP_FIELDS: (keyof Values)[][] = [['invitationCode'], ['name', 'email', 'phone', 'password']]
/** The confirmation step — the only one allowed to register anything. */
const CONFIRM_STEP = 2

export default function CoachSignupPage() {
  const navigate = useNavigate()
  const returnUrl = useReturnUrl()
  const { user, loading, refresh } = useAuth()
  const [step, setStep] = useState(0)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const { data: sports = [] } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' })

  const next = async () => {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1)
  }

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const res = await registerCoach({
      email: v.email,
      password: v.password,
      name: v.name,
      phone: v.phone || undefined,
      invitationCode: v.invitationCode,
      bio: v.bio || undefined,
      sportIds,
    })
    if ('error' in res && res.error) {
      setServerError(res.error.message)
      setStep(0)
      return
    }
    await refresh()
    // This page only ever creates coaches, so their panel is the destination
    // unless the visitor was already on their way somewhere specific.
    navigate(returnUrl || roleHome('COACH'))
  }

  // Enter inside a field submits the form. On the first two steps that has to
  // move the wizard along, never register the coach.
  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (step < CONFIRM_STEP) void next()
    else void handleSubmit(onSubmit)()
  }

  if (loading) {
    return (
      <AuthLayout title="Înregistrare antrenor" subtitle="Necesită un cod de invitație">
        <p className="text-muted-foreground text-sm">Se verifică sesiunea…</p>
      </AuthLayout>
    )
  }

  // Someone already signed in cannot create a second account from here; send
  // them where they were headed, or to the panel their role belongs to.
  if (user) return <Navigate to={returnUrl || roleHome(user.role)} replace />

  return (
    <AuthLayout
      title="Înregistrare antrenor"
      subtitle="Necesită un cod de invitație"
      footer={
        <Link to={withReturnUrl('/signup', returnUrl)} className="text-primary font-semibold">
          Înapoi
        </Link>
      }
    >
      <StepDots count={3} current={step} />
      {serverError && (
        <p className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm">
          {serverError}
        </p>
      )}
      <form onSubmit={onFormSubmit} className="space-y-4" noValidate>
        {step === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="invitationCode">Cod de invitație</Label>
            <Input id="invitationCode" {...register('invitationCode')} aria-invalid={!!errors.invitationCode} />
            {errors.invitationCode && (
              <p className="text-destructive text-xs">{errors.invitationCode.message}</p>
            )}
          </div>
        )}

        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nume complet</Label>
              <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon (opțional)</Label>
              <Input id="phone" type="tel" placeholder="+40..." {...register('phone')} aria-invalid={!!errors.phone} />
              {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Parolă</Label>
              <Input id="password" type="password" {...register('password')} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Sporturi</Label>
              <SportPicker sports={sports} value={sportIds} onChange={setSportIds} />
            </div>
          </>
        )}

        {step === CONFIRM_STEP && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Verifică datele înainte de finalizare:</p>
            <div className="bg-muted space-y-1 rounded-2xl p-4">
              <div>
                <span className="text-muted-foreground">Nume:</span> {getValues('name')}
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span> {getValues('email')}
              </div>
              <div>
                <span className="text-muted-foreground">Sporturi:</span>{' '}
                {sports
                  .filter((s) => sportIds.includes(s.id))
                  .map((s) => s.name)
                  .join(', ') || '—'}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              Înapoi
            </Button>
          )}
          {step < CONFIRM_STEP ? (
            <Button type="button" className="flex-1" onClick={next}>
              Continuă
            </Button>
          ) : (
            // Both buttons render in the same slot, so React hands the new one
            // the DOM node the previous click landed on. A type="submit" here
            // would inherit that click and register the coach the moment the
            // confirmation step appeared, so registering stays an explicit
            // onClick that only a second, deliberate press can reach.
            <Button
              type="button"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void handleSubmit(onSubmit)()}
            >
              {isSubmitting ? 'Se creează…' : 'Finalizează'}
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
