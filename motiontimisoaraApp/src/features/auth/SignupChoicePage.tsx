import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Dumbbell, UserRound } from 'lucide-react'

import { AuthLayout } from './AuthLayout'

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
    desc: 'Administrează antrenori, cursuri și încasări.',
  },
]

export default function SignupChoicePage() {
  return (
    <AuthLayout
      title="Creează un cont"
      subtitle="Alege tipul de cont"
      footer={
        <>
          Ai deja cont?{' '}
          <Link to="/login" className="text-primary font-semibold">
            Autentifică-te
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        {CHOICES.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="hover:border-primary/40 hover:bg-accent flex items-center gap-4 rounded-2xl border p-4 transition-colors"
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
