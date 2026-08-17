import { Link, Navigate } from 'react-router-dom'
import { Building2, ChevronRight, Dumbbell, UserRound } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { useReturnUrl, withReturnUrl } from './return-url'
import { roleHome } from '@/api/auth'
import { useAuth } from '@/lib/auth-context'

const CHOICES = [
  {
    to: '/register',
    icon: UserRound,
    title: 'Părinte',
    desc: 'Înscrie-ți copiii la cursuri, tabere și activități.',
  },
  {
    to: '/register-coach',
    icon: Dumbbell,
    title: 'Antrenor',
    desc: 'Gestionează cursuri și prezență. Necesită cod de invitație.',
  },
  {
    to: '/register-club',
    icon: Building2,
    title: 'Club',
    desc: 'Administrează antrenori, cursuri și încasări. Clubul rămâne inactiv până la aprobarea administratorului.',
  },
]

export default function SignupChoicePage() {
  const { user, loading } = useAuth()
  const returnUrl = useReturnUrl()

  // Someone already signed in has nothing to choose here; send them to their own
  // dashboard rather than showing "create an account".
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }
  if (user) return <Navigate to={returnUrl || roleHome(user.role)} replace />

  return (
    <AuthLayout
      title="Creează un cont"
      subtitle="Alege tipul de cont"
      footer={
        <>
          Ai deja cont?{' '}
          <Link to={withReturnUrl('/login', returnUrl)} className="text-primary font-semibold">
            Autentifică-te
          </Link>
        </>
      }
    >
      {/* auto-rows-fr keeps the three cards the same height even when one
          description wraps onto an extra line, which it does on narrow phones. */}
      <div className="grid auto-rows-fr gap-3">
        {CHOICES.map((c) => (
          <Link
            key={c.to}
            to={withReturnUrl(c.to, returnUrl)}
            className="hover:border-primary/40 hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 flex h-full items-center gap-4 rounded-2xl border p-4 outline-none transition-colors focus-visible:ring-[3px]"
          >
            <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
              <c.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">{c.title}</span>
              <span className="text-muted-foreground block text-sm">{c.desc}</span>
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Link>
        ))}
      </div>
    </AuthLayout>
  )
}
