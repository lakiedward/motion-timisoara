import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Plus, UserRound } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { childAge, getMyChildren, getMyEnrollments } from '@/api/account'
import { Button } from '@/components/ui/button'

export default function ParentDashboard() {
  const { user } = useAuth()
  const { data: children = [] } = useQuery({ queryKey: ['children'], queryFn: getMyChildren })
  const { data: enrollments = [] } = useQuery({ queryKey: ['enrollments'], queryFn: getMyEnrollments })
  const activeCount = enrollments.filter((e) => e.status === 'ACTIVE').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Salut, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">Gestionează copiii și înscrierile lor.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<UserRound className="size-5" />} value={children.length} label="Copii" />
        <Stat icon={<CalendarCheck className="size-5" />} value={activeCount} label="Înscrieri active" />
        <Link
          to="/cursuri"
          className="bg-primary text-primary-foreground flex items-center justify-between rounded-3xl p-6 transition-transform hover:-translate-y-1"
        >
          <span className="font-display font-bold">Caută cursuri</span>
          <Plus className="size-5" />
        </Link>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Copiii mei</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/account/child/new">
              <Plus /> Adaugă copil
            </Link>
          </Button>
        </div>
        {children.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <Link
                key={c.id}
                to={`/account/child/${c.id}`}
                className="bg-card shadow-card hover:shadow-card-hover flex items-center gap-3 rounded-3xl p-5 transition-all hover:-translate-y-1"
              >
                <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full font-bold">
                  {c.name.charAt(0)}
                </span>
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-muted-foreground text-sm">{childAge(c.birth_date)} ani</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-12 text-center">
            Niciun copil adăugat încă.{' '}
            <Link to="/account/child/new" className="text-primary font-semibold">
              Adaugă primul copil
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-card shadow-card flex items-center gap-4 rounded-3xl p-6">
      <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">{icon}</span>
      <div>
        <div className="font-display text-2xl font-extrabold">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </div>
  )
}
