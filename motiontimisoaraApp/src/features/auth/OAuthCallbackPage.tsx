import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { useReturnUrl, withReturnUrl } from './return-url'
import { isCoachContinuation } from './coach/continuation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { completeProfile, loadAppUser, roleHome, type AppUser } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

type Phase = 'loading' | 'complete-profile' | 'error'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid'),
})
type Values = z.infer<typeof schema>

export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [phase, setPhase] = useState<Phase>('loading')
  const [pending, setPending] = useState<AppUser | null>(null)
  const [attempt, setAttempt] = useState(0)
  const returnUrl = useReturnUrl()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    let active = true
    const finish = async (u: AppUser) => {
      if (!active) return
      if (isCoachContinuation(returnUrl)) {
        const confirmed = await refresh()
        if (!active) return
        if (!confirmed || confirmed.id !== u.id) setPhase('error')
        else navigate(returnUrl!, { replace: true })
      } else if (u.needsProfileCompletion) {
        setPending(u)
        reset({ name: u.name, phone: '' })
        setPhase('complete-profile')
      } else {
        navigate(returnUrl || roleHome(u.role), { replace: true })
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = Date.now() + 6000
    const checkSession = async () => {
      try {
        const user = await loadAppUser()
        if (!active) return
        if (user) return await finish(user)
        if (Date.now() >= deadline) setPhase('error')
        else
          timer = setTimeout(() => {
            void checkSession()
          }, 250)
      } catch {
        if (active) setPhase('error')
      }
    }
    void checkSession()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [navigate, returnUrl, reset, refresh, attempt])

  const onSubmit = async (v: Values) => {
    if (!pending) return
    const { error } = await completeProfile(pending.id, v)
    if (error) {
      toast.error('Nu am putut salva profilul. Încearcă din nou.')
      return
    }
    await refresh()
    navigate(returnUrl || roleHome(pending.role), { replace: true })
  }

  if (phase === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <AuthLayout
        title="Autentificare eșuată"
        footer={
          <Link to={withReturnUrl('/login', returnUrl)} className="text-primary font-semibold">
            Înapoi la autentificare
          </Link>
        }
      >
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-3 text-sm">
          Nu am putut finaliza autentificarea. Încearcă din nou.
        </p>
        <Button
          type="button"
          className="mt-4 w-full"
          onClick={() => {
            setPhase('loading')
            setAttempt((current) => current + 1)
          }}
        >
          Reîncearcă
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Completează-ți profilul" subtitle="Mai avem nevoie de câteva detalii">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nume complet</Label>
          <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+40..."
            {...register('phone')}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Continuă'}
        </Button>
      </form>
    </AuthLayout>
  )
}
