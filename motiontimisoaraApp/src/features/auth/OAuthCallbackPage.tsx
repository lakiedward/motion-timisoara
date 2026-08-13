import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { useReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
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
  const returnUrl = useReturnUrl()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    let active = true
    const finish = (u: AppUser) => {
      if (!active) return
      if (u.needsProfileCompletion) {
        setPending(u)
        reset({ name: u.name, phone: '' })
        setPhase('complete-profile')
      } else {
        navigate(returnUrl || roleHome(u.role), { replace: true })
      }
    }
    // detectSessionInUrl resolves the OAuth hash on web; wait for the session.
    loadAppUser().then((u) => {
      if (u) return finish(u)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'SIGNED_IN') {
          const loaded = await loadAppUser()
          if (loaded) finish(loaded)
        }
      })
      const timer = setTimeout(() => {
        if (active) setPhase('error')
      }, 6000)
      return () => {
        subscription.unsubscribe()
        clearTimeout(timer)
      }
    })
    return () => {
      active = false
    }
  }, [navigate, returnUrl, reset])

  const onSubmit = async (v: Values) => {
    if (!pending) return
    await completeProfile(pending.id, v)
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
          <Link to="/login" className="text-primary font-semibold">
            Înapoi la autentificare
          </Link>
        }
      >
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-3 text-sm">
          Nu am putut finaliza autentificarea. Încearcă din nou.
        </p>
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
          <Input id="phone" type="tel" placeholder="+40..." {...register('phone')} aria-invalid={!!errors.phone} />
          {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Continuă'}
        </Button>
      </form>
    </AuthLayout>
  )
}
