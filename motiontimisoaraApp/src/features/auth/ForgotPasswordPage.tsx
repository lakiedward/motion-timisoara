import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset } from '@/api/auth'

const schema = z.object({ email: z.string().email('Email invalid') })
type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    await requestPasswordReset(v.email, `${window.location.origin}/reset-password`)
    setSent(true) // always show success (privacy)
  }

  return (
    <AuthLayout
      title="Resetează parola"
      subtitle="Îți trimitem un link de resetare pe email"
      footer={
        <Link to="/login" className="text-primary font-semibold">
          Înapoi la autentificare
        </Link>
      }
    >
      {sent ? (
        <p className="bg-primary/10 text-primary rounded-md px-3 py-3 text-sm">
          Dacă există un cont cu acest email, vei primi în scurt timp un link de resetare.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Se trimite…' : 'Trimite link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
