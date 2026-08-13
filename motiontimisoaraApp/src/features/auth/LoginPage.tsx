import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { GoogleSignInButton } from './GoogleSignInButton'
import { useReturnUrl, withReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loadAppUser, roleHome, signInWithPassword } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  email: z.string().email('Email invalid'),
  password: z.string().min(6, 'Minim 6 caractere'),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const returnUrl = useReturnUrl()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const { error } = await signInWithPassword(v.email, v.password)
    if (error) {
      setServerError('Email sau parola sunt greșite.')
      return
    }
    await refresh()
    if (returnUrl) {
      navigate(returnUrl)
      return
    }
    const u = await loadAppUser()
    navigate(u ? roleHome(u.role) : '/account')
  }

  return (
    <AuthLayout
      title="Bine ai revenit"
      subtitle="Autentifică-te în contul tău"
      footer={
        <>
          Nu ai cont?{' '}
          <Link to={withReturnUrl('/signup', returnUrl)} className="text-primary font-semibold">
            Înregistrează-te
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleSignInButton returnUrl={returnUrl} />
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" /> sau <span className="bg-border h-px flex-1" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {serverError}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Parolă</Label>
              <Link to="/forgot-password" className="text-primary text-xs">
                Ai uitat parola?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se conectează…' : 'Autentificare'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
