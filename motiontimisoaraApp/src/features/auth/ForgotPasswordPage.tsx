import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { requestPasswordReset } from '@/api/auth'
import { isNative } from '@/lib/platform'

const schema = z.object({
  email: z.string().min(1, 'Emailul e obligatoriu').email('Email invalid'),
})
type Values = z.infer<typeof schema>

const CONNECTION_ERROR = 'Nu am putut trimite linkul. Verifică conexiunea și încearcă din nou.'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    setServerError(null)
    try {
      const { error } = await requestPasswordReset(
        v.email,
        `${window.location.origin}/reset-password`,
      )
      if (error) {
        setServerError(CONNECTION_ERROR)
        return
      }
      setSent(true)
    } catch {
      setServerError(CONNECTION_ERROR)
    }
  }

  return (
    <AuthLayout
      title="Resetează parola"
      subtitle="Îți trimitem un link de resetare pe email"
      footer={
        <Link
          to="/login"
          className="text-primary min-h-touch-target inline-flex items-center font-semibold"
        >
          Înapoi la autentificare
        </Link>
      }
    >
      {sent ? (
        <p className="bg-primary/10 text-primary rounded-md px-3 py-3 text-sm" role="status">
          Dacă există un cont cu acest email, vei primi în scurt timp un link de resetare.
          {isNative() &&
            ' Deschide emailul pe acest telefon în următoarele 5 minute. Linkul funcționează în aplicația din care l-ai solicitat.'}
        </p>
      ) : (
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
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se trimite…' : 'Trimite link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
