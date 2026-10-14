import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { AuthFields } from './AuthFields'
import { GoogleSignInButton } from './GoogleSignInButton'
import { loginErrorMessage } from './login-error'
import { useReturnUrl, withReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { loadAppUser, roleHome, signInWithPassword } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  email: z.string().min(1, 'Emailul e obligatoriu').email('Email invalid'),
  password: z.string().min(1, 'Parola e obligatorie').min(6, 'Minim 6 caractere'),
})
type Values = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, refresh } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const returnUrl = useReturnUrl()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const error = await signInWithPassword(v.email, v.password).then(
      (result) => result.error,
      (thrown: unknown) => thrown,
    )
    if (error) {
      setServerError(loginErrorMessage(error))
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

  if (!isSubmitting) {
    if (user) return <Navigate to={returnUrl || roleHome(user.role)} replace />
    if (loading) {
      return (
        <div role="status" aria-label="Se încarcă" className="grid min-h-dvh place-items-center">
          <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )
    }
  }

  return (
    <AuthLayout
      title="Bine ai revenit"
      subtitle="Autentifică-te în contul tău"
      nativeLandscapeFields
      footer={
        <>
          Nu ai cont?{' '}
          <Link
            to={withReturnUrl('/signup', returnUrl)}
            className="text-primary min-h-touch-target inline-flex items-center font-semibold"
          >
            Înregistrează-te
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleSignInButton returnUrl={returnUrl} disabled={isSubmitting} />
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span className="bg-border h-px flex-1" /> sau <span className="bg-border h-px flex-1" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <p
              className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md px-3 py-2 text-sm"
              role="alert"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {serverError}
            </p>
          )}
          <AuthFields columns={2}>
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="space-y-1">
              <Field
                id="password"
                label="Parolă"
                type="password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-primary min-h-touch-target inline-flex items-center text-sm font-medium"
                >
                  Ai uitat parola?
                </Link>
              </div>
            </div>
          </AuthFields>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se conectează…' : 'Autentificare'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
