import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

import { AuthLayout } from './AuthLayout'
import { GoogleSignInButton } from './GoogleSignInButton'
import { StepDots, SportPicker } from './wizard-bits'
import { useReturnUrl, withReturnUrl } from './return-url'
import { coachContinuation, coachReturnPath } from './coach/continuation'
import {
  clearCoachInvitationDraft,
  readCoachInvitationDraft,
  saveCoachInvitationDraft,
} from './coach/invitation-draft'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchSports } from '@/api/sports'
import { registerCoach, roleHome } from '@/api/auth'
import { redeemCoachInvitation } from '@/api/coach-registration'
import { useAuth } from '@/lib/auth-context'

function coachSchema(signedIn: boolean) {
  return z.object({
    invitationCode: z.string().trim().min(5, 'Cod invalid').max(128, 'Cod invalid'),
    name: z.string().trim().min(3, 'Minim 3 caractere').max(200, 'Maxim 200 de caractere'),
    email: signedIn ? z.string() : z.string().email('Email invalid'),
    phone: z
      .string()
      .regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid')
      .or(z.literal('')),
    password: signedIn ? z.string() : z.string().min(6, 'Minim 6 caractere'),
    bio: z.string().max(4000, 'Maxim 4000 de caractere'),
  })
}

type Values = z.infer<ReturnType<typeof coachSchema>>
const CONFIRM_STEP = 2

export default function CoachSignupPage() {
  const navigate = useNavigate()
  const returnUrl = coachReturnPath(useReturnUrl())
  const { user, loading, profileError, refresh } = useAuth()
  const [step, setStep] = useState(0)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const [draftLoading, setDraftLoading] = useState(true)
  const [completed, setCompleted] = useState<{ userId?: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const prefilledUserId = useRef<string | null>(null)
  const sportsQuery = useQuery({ queryKey: ['sports'], queryFn: fetchSports })
  const sports = sportsQuery.data ?? []

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(coachSchema(!!user)),
    mode: 'onTouched',
    defaultValues: { invitationCode: '', name: '', email: '', phone: '', password: '', bio: '' },
  })

  useEffect(() => {
    let active = true
    void readCoachInvitationDraft()
      .then(async (code) => {
        if (!active) return
        if (code) {
          setValue('invitationCode', code)
          setStep(1)
          await clearCoachInvitationDraft()
        }
      })
      .catch(() => {
        if (active) setServerError('Nu am putut recupera invitația. Introdu codul din nou.')
      })
      .finally(() => {
        if (active) setDraftLoading(false)
      })
    return () => {
      active = false
    }
  }, [setValue])

  useEffect(() => {
    if (!user || user.id === prefilledUserId.current) return
    prefilledUserId.current = user.id
    setValue('name', user.name)
    setValue('email', user.email)
    setValue('phone', user.phone ?? '')
    setValue('password', '')
  }, [user, setValue])

  const next = async () => {
    const fields: (keyof Values)[] =
      step === 0
        ? ['invitationCode']
        : user
          ? ['name', 'phone']
          : ['name', 'email', 'phone', 'password']
    if (await trigger(fields)) {
      setServerError(null)
      setStep((current) => current + 1)
    }
  }

  const persistInvitation = async () => {
    if (!(await trigger('invitationCode'))) return false
    setServerError(null)
    try {
      await saveCoachInvitationDraft(getValues('invitationCode'))
      return true
    } catch {
      setServerError('Nu am putut păstra invitația. Încearcă din nou.')
      return false
    }
  }

  const refreshCompletedProfile = async (expectedUserId?: string) => {
    setRefreshing(true)
    setServerError(null)
    try {
      const confirmed = await refresh()
      if (confirmed?.role === 'COACH' && (!expectedUserId || confirmed.id === expectedUserId)) {
        navigate(returnUrl || roleHome('COACH'), { replace: true })
      } else {
        setServerError(
          'Contul de antrenor a fost activat, dar profilul nu s-a încărcat. Reîncearcă încărcarea.',
        )
      }
    } catch {
      setServerError(
        'Contul de antrenor a fost activat, dar profilul nu s-a încărcat. Reîncearcă încărcarea.',
      )
    } finally {
      setRefreshing(false)
    }
  }

  const onSubmit = async (values: Values) => {
    setServerError(null)
    const details = {
      invitationCode: values.invitationCode,
      name: values.name,
      phone: values.phone || undefined,
      bio: values.bio || undefined,
      sportIds,
    }
    const result = user
      ? await redeemCoachInvitation(details)
      : await registerCoach({ ...details, email: values.email, password: values.password })
    if (result.error) {
      setServerError(result.error.message)
      setStep(0)
      return
    }
    const outcome = { userId: user?.id }
    setCompleted(outcome)
    await clearCoachInvitationDraft().catch(() => undefined)
    await refreshCompletedProfile(outcome.userId)
  }

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draftLoading || isSubmitting) return
    if (step < CONFIRM_STEP) void next()
    else void handleSubmit(onSubmit)()
  }

  if (completed) {
    return (
      <AuthLayout title="Înregistrare antrenor" subtitle="Contul de antrenor a fost activat">
        {serverError && (
          <p className="text-destructive text-sm" role="alert">
            {serverError}
          </p>
        )}
        <Button
          type="button"
          className="mt-4 w-full"
          disabled={refreshing}
          onClick={() => void refreshCompletedProfile(completed.userId)}
        >
          {refreshing ? 'Se încarcă profilul…' : 'Reîncearcă încărcarea profilului'}
        </Button>
      </AuthLayout>
    )
  }

  if (loading || profileError) {
    return (
      <AuthLayout title="Înregistrare antrenor" subtitle="Necesită un cod de invitație">
        <p className="text-muted-foreground text-sm" role={profileError ? 'alert' : 'status'}>
          {profileError || 'Se verifică sesiunea…'}
        </p>
        {profileError && (
          <Button type="button" className="mt-4" onClick={() => void refresh()}>
            Reîncearcă
          </Button>
        )}
      </AuthLayout>
    )
  }

  if (user && user.role !== 'PARENT') return <Navigate to={roleHome(user.role)} replace />

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
        <p
          className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm"
          role="alert"
        >
          {serverError}
        </p>
      )}
      <form onSubmit={onFormSubmit} className="space-y-4" noValidate>
        {step === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="invitationCode">Cod de invitație</Label>
            <Input
              id="invitationCode"
              {...register('invitationCode')}
              aria-invalid={!!errors.invitationCode}
            />
            {errors.invitationCode && (
              <p className="text-destructive text-xs">{errors.invitationCode.message}</p>
            )}
          </div>
        )}

        {step === 1 && (
          <>
            {!user && (
              <div className="space-y-3">
                <GoogleSignInButton
                  returnUrl={coachContinuation(returnUrl)}
                  onBeforeSignIn={persistInvitation}
                  disabled={isSubmitting || draftLoading}
                />
                <p className="text-muted-foreground text-center text-sm">
                  Ai deja cont?{' '}
                  <Link
                    to={withReturnUrl('/login', coachContinuation(returnUrl))}
                    className="text-primary font-semibold"
                    onClick={(event) => {
                      event.preventDefault()
                      void persistInvitation().then((saved) => {
                        if (saved) navigate(withReturnUrl('/login', coachContinuation(returnUrl)))
                      })
                    }}
                  >
                    Autentifică-te
                  </Link>
                </p>
                <p className="text-muted-foreground text-center text-xs">
                  sau creează un cont cu email
                </p>
              </div>
            )}
            {user && (
              <p className="bg-muted rounded-md p-3 text-sm">
                Cont conectat: <span className="font-semibold">{user.email}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nume complet</Label>
              <Input
                id="name"
                autoComplete="name"
                {...register('name')}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            {!user && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon (opțional)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+40..."
                {...register('phone')}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
            </div>
            {!user && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Parolă</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                />
                {errors.password && (
                  <p className="text-destructive text-xs">{errors.password.message}</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bio">Despre tine (opțional)</Label>
              <Input id="bio" {...register('bio')} />
            </div>
            <div className="space-y-1.5">
              <Label>Sporturi</Label>
              {sportsQuery.isPending ? (
                <p className="text-muted-foreground text-sm" role="status">
                  Se încarcă sporturile…
                </p>
              ) : sportsQuery.isError ? (
                <div className="space-y-2">
                  <p className="text-destructive text-sm" role="alert">
                    Nu am putut încărca sporturile.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void sportsQuery.refetch()}
                  >
                    Reîncearcă sporturile
                  </Button>
                </div>
              ) : sports.length ? (
                <SportPicker sports={sports} value={sportIds} onChange={setSportIds} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nu sunt sporturi disponibile momentan.
                </p>
              )}
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
                <span className="text-muted-foreground">Email:</span>{' '}
                {user?.email || getValues('email')}
              </div>
              <div>
                <span className="text-muted-foreground">Sporturi:</span>{' '}
                {sports
                  .filter((sport) => sportIds.includes(sport.id))
                  .map((sport) => sport.name)
                  .join(', ') || '—'}
              </div>
            </div>
            {user && (
              <p className="text-muted-foreground">
                Finalizează pentru a activa rolul de antrenor în acest cont.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setStep((current) => current - 1)}
            >
              Înapoi
            </Button>
          )}
          {step < CONFIRM_STEP ? (
            <Button type="button" className="flex-1" disabled={draftLoading} onClick={next}>
              Continuă
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => void handleSubmit(onSubmit)()}
            >
              {isSubmitting ? 'Se finalizează…' : 'Finalizează'}
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
