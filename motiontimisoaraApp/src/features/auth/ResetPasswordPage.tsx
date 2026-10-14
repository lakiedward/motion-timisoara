import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldMessage, fieldDescription } from '@/components/ui/field'
import { isPasswordRecoveryReady, updatePassword } from '@/api/auth'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const schema = z
  .object({
    password: z.string().min(1, 'Parola e obligatorie').min(6, 'Minim 6 caractere'),
    confirm: z.string().min(1, 'Confirmarea parolei e obligatorie').min(6, 'Minim 6 caractere'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Parolele nu coincid',
    path: ['confirm'],
  })
type Values = z.infer<typeof schema>

type LinkState = 'checking' | 'ready' | 'invalid'

interface PasswordFieldProps extends Omit<ComponentProps<'input'>, 'type'> {
  id: string
  label: string
  error?: string
}

function PasswordField({ id, label, error, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          className="pr-10"
          aria-invalid={!!error}
          aria-describedby={fieldDescription(id, undefined, error)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((s) => !s)}
          aria-label={visible ? 'Ascunde parola' : 'Arată parola'}
          aria-pressed={visible}
          aria-controls={id}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldMessage id={id} error={error} />
    </div>
  )
}

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p
      className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md px-3 py-2 text-sm"
      role="alert"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const invalidLink = params.has('invalid')
  const { refresh } = useAuth()
  const [linkState, setLinkState] = useState<LinkState>('checking')
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    let active = true
    const check = async () => {
      const ready = !invalidLink && (await isPasswordRecoveryReady().catch(() => false))
      if (active) setLinkState(ready ? 'ready' : 'invalid')
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void check()
    })
    void check()
    const timer = window.setInterval(() => {
      void check()
    }, 15_000)
    return () => {
      active = false
      window.clearInterval(timer)
      subscription.unsubscribe()
    }
  }, [invalidLink])

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const { error } = await updatePassword(v.password).catch(() => ({ error: true }))
    if (error) {
      setServerError('Link-ul de resetare este invalid sau a expirat.')
      return
    }
    await refresh()
    toast.success('Parola a fost schimbată. Autentifică-te cu parola nouă.')
    navigate('/login')
  }

  return (
    <AuthLayout
      title={invalidLink ? 'Link de email invalid' : 'Setează o parolă nouă'}
      footer={
        <Link
          to={invalidLink ? '/forgot-password' : '/login'}
          className="text-primary min-h-touch-target inline-flex items-center font-semibold"
        >
          {invalidLink ? 'Resetează parola' : 'Înapoi la autentificare'}
        </Link>
      }
    >
      {linkState === 'checking' && (
        <p role="status" className="text-muted-foreground text-sm">
          Se verifică linkul de resetare…
        </p>
      )}

      {linkState === 'invalid' && (
        <div className="space-y-4">
          <ErrorBanner>
            {invalidLink
              ? 'Acest link este invalid, a expirat sau a fost deja folosit.'
              : 'Link-ul de resetare este invalid sau a expirat.'}
          </ErrorBanner>
          <Button asChild className="w-full">
            <Link to={invalidLink ? '/login' : '/forgot-password'}>
              {invalidLink ? 'Mergi la autentificare' : 'Solicită un link nou'}
            </Link>
          </Button>
        </div>
      )}

      {linkState === 'ready' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <ErrorBanner>
              {serverError}{' '}
              <Link to="/forgot-password" className="font-semibold underline">
                Solicită unul nou.
              </Link>
            </ErrorBanner>
          )}
          <PasswordField
            id="password"
            label="Parolă nouă"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordField
            id="confirm"
            label="Confirmă parola"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se salvează…' : 'Salvează parola'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
