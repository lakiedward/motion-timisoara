import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleAlert, MailCheck } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { AuthFields } from './AuthFields'
import { GoogleSignInButton } from './GoogleSignInButton'
import { useReturnUrl, welcomeChildPath, withReturnUrl } from './return-url'
import { signupErrorMessage } from './signup-error'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { roleHome, signUpParent } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'
import { isNative } from '@/lib/platform'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  email: z.string().email('Email invalid'),
  password: z.string().min(6, 'Minim 6 caractere'),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid'),
})
type Values = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { user, loading, refresh } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const returnUrl = useReturnUrl()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const result = await signUpParent(v).then(
      (r) => r,
      (thrown: unknown) => ({ data: { session: null }, error: thrown }),
    )
    if (result.error) {
      setServerError(signupErrorMessage(result.error))
      return
    }
    const { data } = result
    if (data.session) {
      await refresh()
      navigate(welcomeChildPath(returnUrl))
    } else {
      setSent(true)
    }
  }

  if (!isSubmitting && !sent) {
    if (user) return <Navigate to={returnUrl || roleHome(user.role)} replace />
    if (loading) {
      return (
        <div role="status" aria-label="Se încarcă" className="grid min-h-dvh place-items-center">
          <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      )
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Verifică-ți emailul">
        <div className="space-y-4 text-sm">
          <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
            <MailCheck className="size-6" />
          </span>
          <p className="text-muted-foreground">
            Ți-am trimis un email de confirmare. Deschide linkul din email pentru a-ți activa
            contul, apoi autentifică-te.
            {isNative() &&
              ' Deschide emailul pe acest telefon în următoarele 5 minute. Linkul funcționează în aplicația din care ai creat contul.'}
          </p>
          <Button asChild className="w-full">
            <Link to={withReturnUrl('/login', returnUrl)}>Mergi la autentificare</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Creează cont de părinte"
      subtitle="Înscrie-ți copiii la cursuri în câteva minute"
      nativeLandscapeFields
      footer={
        <>
          Ai deja cont?{' '}
          <Link
            to={withReturnUrl('/login', returnUrl)}
            className="text-primary min-h-touch-target inline-flex items-center font-semibold"
          >
            Autentifică-te
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleSignInButton
          label="Înregistrare cu Google"
          returnUrl={returnUrl}
          disabled={isSubmitting}
        />
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
          <AuthFields columns={4}>
            <Field
              id="name"
              label="Nume complet"
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
              label="Telefon"
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
          </AuthFields>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se creează…' : 'Creează cont'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
