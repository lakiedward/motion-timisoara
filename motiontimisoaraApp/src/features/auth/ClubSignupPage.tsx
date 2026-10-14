import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { StepDots, SportsField } from './wizard-bits'
import { useReturnUrl, withReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { fetchSports } from '@/api/sports'
import { registerClub, roleHome } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  email: z.string().email('Email invalid'),
  phone: z
    .string()
    .regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid')
    .optional()
    .or(z.literal('')),
  password: z.string().min(6, 'Minim 6 caractere'),
  clubName: z.string().min(2, 'Minim 2 caractere'),
  clubDescription: z.string().optional(),
  clubCity: z.string().optional(),
  clubEmail: z.string().email('Email invalid').optional().or(z.literal('')),
  clubPhone: z.string().optional(),
})
type Values = z.infer<typeof schema>

const STEP_FIELDS: (keyof Values)[][] = [
  ['name', 'email', 'phone', 'password'],
  ['clubName', 'clubEmail'],
]
const CONFIRM_STEP = 2

export default function ClubSignupPage() {
  const navigate = useNavigate()
  const returnUrl = useReturnUrl()
  const { user, loading, refresh } = useAuth()
  const [step, setStep] = useState(0)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const sportsQuery = useQuery({ queryKey: ['sports'], queryFn: fetchSports })

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onTouched' })

  const next = async () => {
    if (await trigger(STEP_FIELDS[step], { shouldFocus: true })) setStep((s) => s + 1)
  }

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const res = await registerClub({
      email: v.email,
      password: v.password,
      name: v.name,
      phone: v.phone || undefined,
      clubName: v.clubName,
      clubDescription: v.clubDescription || undefined,
      clubCity: v.clubCity || undefined,
      clubEmail: v.clubEmail || undefined,
      clubPhone: v.clubPhone || undefined,
      sportIds,
    })
    if ('error' in res && res.error) {
      setServerError(res.error.message)
      setStep(0)
      return
    }
    await refresh()
    navigate(returnUrl || roleHome('CLUB'))
  }

  const onInvalid = (invalide: FieldErrors<Values>) => {
    const primul = Object.keys(invalide)[0] as keyof Values | undefined
    if (!primul) return
    const pas = STEP_FIELDS.findIndex((campuri) => campuri.includes(primul))
    if (pas >= 0) setStep(pas)
  }

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (step < CONFIRM_STEP) void next()
    else void handleSubmit(onSubmit, onInvalid)()
  }

  if (loading) {
    return (
      <AuthLayout title="Înregistrare club" subtitle="Creează contul administratorului și clubul">
        <p className="text-muted-foreground text-sm">Se verifică sesiunea…</p>
      </AuthLayout>
    )
  }

  if (user) return <Navigate to={returnUrl || roleHome(user.role)} replace />

  return (
    <AuthLayout
      title="Înregistrare club"
      subtitle="Creează contul administratorului și clubul"
      footer={
        step === 0 ? (
          <Link to={withReturnUrl('/signup', returnUrl)} className="text-primary font-semibold">
            Înapoi
          </Link>
        ) : undefined
      }
    >
      <StepDots count={3} current={step} />
      {serverError && (
        <p
          className="bg-destructive/10 text-destructive mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm"
          role="alert"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {serverError}
        </p>
      )}
      <form onSubmit={onFormSubmit} className="space-y-4" noValidate>
        {step === 0 && (
          <>
            <Field
              id="name"
              label="Nume administrator"
              autoComplete="name"
              error={errors.name?.message}
              {...register('name')}
            />
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Field
              id="phone"
              label="Telefon (opțional)"
              type="tel"
              autoComplete="tel"
              placeholder="+40..."
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Field
              id="password"
              label="Parolă"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Field
              id="clubName"
              label="Nume club"
              autoComplete="organization"
              error={errors.clubName?.message}
              {...register('clubName')}
            />
            <Field
              id="clubCity"
              label="Oraș (opțional)"
              autoComplete="address-level2"
              {...register('clubCity')}
            />
            <Field
              id="clubEmail"
              label="Email club (opțional)"
              type="email"
              error={errors.clubEmail?.message}
              {...register('clubEmail')}
            />
            <SportsField
              sports={sportsQuery.data ?? []}
              loading={sportsQuery.isPending}
              failed={sportsQuery.isError}
              onRetry={() => void sportsQuery.refetch()}
              value={sportIds}
              onChange={setSportIds}
            />
          </>
        )}

        {step === CONFIRM_STEP && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Verifică datele înainte de finalizare:</p>
            <div className="bg-muted space-y-1 rounded-2xl p-4">
              <div>
                <span className="text-muted-foreground">Administrator:</span> {getValues('name')}
              </div>
              <div>
                <span className="text-muted-foreground">Club:</span> {getValues('clubName')}
              </div>
              <div>
                <span className="text-muted-foreground">Oraș:</span> {getValues('clubCity') || '—'}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Configurarea Stripe pentru încasări se face din panoul de club, după înregistrare.
            </p>
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
            <Button
              type="button"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void handleSubmit(onSubmit, onInvalid)()}
            >
              {isSubmitting ? 'Se creează…' : 'Finalizează'}
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
