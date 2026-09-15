import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Plus, UserRound } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { childAge, getMyChildren, getMyEnrollments } from '@/api/account'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { PushSettingsCard } from '@/features/notifications/PushSettingsCard'

export default function ParentDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: getMyChildren })
  const enrollmentsQuery = useQuery({ queryKey: ['enrollments'], queryFn: getMyEnrollments })
  const children = childrenQuery.data ?? []
  const enrollments = enrollmentsQuery.data ?? []
  const activeCount = enrollments.filter((e) => e.status === 'ACTIVE').length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Salut{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">Gestionează copiii și înscrierile lor.</p>
      </div>

      {user?.needsProfileCompletion && (
        <Card>
          <CardContent className="space-y-3">
            <p className="font-semibold">Completează-ți profilul</p>
            <p className="text-muted-foreground text-sm">
              Adaugă numărul de telefon pentru a finaliza profilul.
            </p>
            <Button asChild>
              <Link to="/auth/callback?returnUrl=%2Faccount">Completează profilul</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<UserRound className="size-5" />}
          value={children.length}
          label="Copii"
          pending={childrenQuery.isPending}
          error={childrenQuery.isError}
          retrying={childrenQuery.isFetching}
          onRetry={() => void childrenQuery.refetch()}
        />
        <Stat
          icon={<CalendarCheck className="size-5" />}
          value={activeCount}
          label="Înscrieri active"
          pending={enrollmentsQuery.isPending}
          error={enrollmentsQuery.isError}
          retrying={enrollmentsQuery.isFetching}
          onRetry={() => void enrollmentsQuery.refetch()}
        />
        <Link
          to="/cursuri"
          className="bg-primary text-primary-foreground flex items-center justify-between rounded-3xl p-6 transition-transform hover:-translate-y-1"
        >
          <span className="font-display font-bold">Caută cursuri</span>
          <Plus className="size-5" />
        </Link>
      </div>

      <PushSettingsCard />

      {childrenQuery.isPending && (
        <div role="status" aria-label="Se încarcă lista copiilor" className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
      )}

      {childrenQuery.isSuccess && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Copiii mei</h2>
            {children.length > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link to="/account/child/new">
                  <Plus /> Adaugă copil
                </Link>
              </Button>
            )}
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
                    <div className="text-muted-foreground text-sm">
                      {childAge(c.birth_date)} ani
                    </div>
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
      )}
    </div>
  )
}

function Stat({
  icon,
  value,
  label,
  pending,
  error,
  retrying,
  onRetry,
}: {
  icon: React.ReactNode
  value: number
  label: string
  pending: boolean
  error: boolean
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <div
      className={cn(
        'bg-card shadow-card flex items-center gap-4 rounded-3xl p-6',
        error && 'sm:flex-col sm:items-start md:flex-row md:items-center',
      )}
      role="group"
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl"
      >
        {icon}
      </span>
      <div className="min-w-0">
        {pending ? (
          <Skeleton role="status" aria-label={`Se încarcă: ${label}`} className="h-8 w-12" />
        ) : (
          !error && <div className="font-display text-2xl font-extrabold">{value}</div>
        )}
        <div className="text-muted-foreground text-sm">{label}</div>
        {error && !pending && (
          <div className="mt-2 space-y-2">
            <p role="alert" className="text-sm">
              Nu am putut încărca datele.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={retrying}
              onClick={onRetry}
              aria-label={`Reîncearcă: ${label}`}
            >
              {retrying ? 'Se reîncearcă…' : 'Reîncearcă'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
