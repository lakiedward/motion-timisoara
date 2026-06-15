import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AuthLayout } from './AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/api/auth'

const schema = z
  .object({
    password: z.string().min(6, 'Minim 6 caractere'),
    confirm: z.string().min(6, 'Minim 6 caractere'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Parolele nu coincid',
    path: ['confirm'],
  })
type Values = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: Values) => {
    setServerError(null)
    const { error } = await updatePassword(v.password)
    if (error) {
      setServerError('Link-ul de resetare este invalid sau a expirat. Solicită unul nou.')
      return
    }
    navigate('/login')
  }

  return (
    <AuthLayout
      title="Setează o parolă nouă"
      footer={
        <Link to="/login" className="text-primary font-semibold">
          Înapoi la autentificare
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {serverError}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="password">Parolă nouă</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmă parola</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            {...register('confirm')}
            aria-invalid={!!errors.confirm}
          />
          {errors.confirm && <p className="text-destructive text-xs">{errors.confirm.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Se salvează…' : 'Salvează parola'}
        </Button>
      </form>
    </AuthLayout>
  )
}
