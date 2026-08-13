import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { GoogleSignInButton } from './GoogleSignInButton'
import { useReturnUrl, withReturnUrl } from './return-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUpParent } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const schema = z.object({
  name: z.string().min(3, 'Minim 3 caractere'),
  email: z.string().email('Email invalid'),
  password: z.string().min(6, 'Minim 6 caractere'),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Număr de telefon invalid'),
})
type Values = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
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
    const { data, error } = await signUpParent(v)
    if (error) {
      setServerError(
        error.message.toLowerCase().includes('already')
          ? 'Există deja un cont cu acest email.'
          : error.message
      )
      return
    }
    if (data.session) {
      await refresh()
      navigate(returnUrl || '/account')
    } else {
      setSent(true)
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
            Ți-am trimis un email de confirmare. Deschide linkul din email pentru a-ți activa contul,
            apoi autentifică-te.
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
      footer={
        <>
          Ai deja cont?{' '}
          <Link to={withReturnUrl('/login', returnUrl)} className="text-primary font-semibold">
            Autentifică-te
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleSignInButton label="Înregistrare cu Google" returnUrl={returnUrl} />
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
            <Label htmlFor="name">Nume complet</Label>
            <Input id="name" autoComplete="name" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" type="tel" autoComplete="tel" placeholder="+40..." {...register('phone')} aria-invalid={!!errors.phone} />
            {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Parolă</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se creează…' : 'Creează cont'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
