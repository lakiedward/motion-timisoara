import { Link } from 'react-router-dom'

import { AuthLayout } from './AuthLayout'

/** Temporary placeholder for the coach/club signup wizards (built once their Edge Functions are deployed). */
export default function SignupComingSoon({ kind }: { kind: 'coach' | 'club' }) {
  const label = kind === 'coach' ? 'antrenor' : 'club'
  return (
    <AuthLayout
      title={`Înregistrare ${label}`}
      subtitle="Disponibilă în curând"
      footer={
        <Link to="/signup" className="text-primary font-semibold">
          Înapoi
        </Link>
      }
    >
      <p className="bg-muted text-muted-foreground rounded-2xl px-4 py-6 text-sm">
        Înregistrarea de {label} se finalizează în pasul următor al dezvoltării. Între timp, poți crea
        un cont de părinte sau te poți autentifica.
      </p>
    </AuthLayout>
  )
}
