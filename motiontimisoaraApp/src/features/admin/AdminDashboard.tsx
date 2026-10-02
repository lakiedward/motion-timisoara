import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  GraduationCap,
  Tent,
  Ticket,
  Trophy,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

import {
  formatAdminCount,
  getAdminStats,
  type AdminStatCell,
  type AdminStatKey,
  type AdminStats,
} from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usesNativeNavigation } from '@/layout/native/native-runtime'
import { cn } from '@/lib/utils'

const statCardClass = cn(
  'bg-card shadow-card flex h-full min-h-[11.5rem] min-w-0 cursor-pointer flex-col rounded-3xl p-6 transition-all outline-none',
  'hover:-translate-y-1 hover:shadow-card-hover [&:hover]:-translate-y-1 [&:hover]:shadow-card-hover',
  'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
)

const STATS: {
  key: AdminStatKey
  label: string
  hint?: string
  icon: LucideIcon
  to: string
  testId: string
}[] = [
  {
    key: 'users',
    label: 'Utilizatori',
    icon: Users,
    to: '/admin/users',
    testId: 'admin-stat-utilizatori',
  },
  {
    key: 'coaches',
    label: 'Antrenori',
    icon: UserRound,
    to: '/admin/users?role=COACH',
    testId: 'admin-stat-antrenori',
  },
  {
    key: 'clubs',
    label: 'Cluburi',
    icon: Building2,
    to: '/admin/clubs',
    testId: 'admin-stat-cluburi',
  },
  {
    key: 'courses',
    label: 'Cursuri',
    icon: GraduationCap,
    to: '/admin/courses',
    testId: 'admin-stat-cursuri',
  },
  { key: 'camps', label: 'Tabere', icon: Tent, to: '/admin/camps', testId: 'admin-stat-tabere' },
  {
    key: 'competitions',
    label: 'Concursuri',
    icon: Trophy,
    to: '/admin/competitions',
    testId: 'admin-stat-concursuri',
  },
  {
    key: 'newUsers7d',
    label: 'Utilizatori noi (7 zile)',
    icon: UserPlus,
    to: '/admin/users',
    testId: 'admin-stat-utilizatori-noi',
  },
  {
    key: 'activeInviteCodes',
    label: 'Coduri invitație',
    hint: 'Active și neexpirate',
    icon: Ticket,
    to: '/admin/codes',
    testId: 'admin-stat-coduri',
  },
]

function failedLabels(data: AdminStats) {
  return STATS.filter((stat) => data[stat.key].error).map((stat) => stat.label)
}

function allStatsFailed(data: AdminStats) {
  return STATS.every((stat) => data[stat.key].error && data[stat.key].value === null)
}

export default function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => getAdminStats(),
    retry: false,
  })
  const native = usesNativeNavigation()
  const totalFailure = isError || (data ? allStatsFailed(data) : false)
  const partialFailed = data && !totalFailure ? failedLabels(data) : []

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold break-words text-foreground">
          Administrare
        </h1>
        <p className="text-muted-foreground mt-1 break-words">
          Privire de ansamblu asupra platformei.
        </p>
        {native ? (
          <Link
            to="/admin/profile"
            className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          >
            <UserRound className="size-4" aria-hidden="true" />
            Profil
          </Link>
        ) : null}
      </div>
      {totalFailure ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca statisticile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : (
        <>
          {partialFailed.length > 0 ? (
            <div role="alert" className="rounded-3xl border border-dashed px-6 py-4">
              <p className="text-foreground font-medium">
                Nu am putut încărca: {partialFailed.join(', ')}.
              </p>
              <Button className="mt-3 h-11 min-h-11" type="button" onClick={() => void refetch()}>
                Reîncearcă
              </Button>
            </div>
          ) : null}
          <div className="grid grid-cols-1 items-stretch gap-4 overflow-visible py-1 md:grid-cols-2 xl:grid-cols-4">
            {STATS.map((stat) => (
              <StatCard
                key={stat.key}
                to={stat.to}
                testId={stat.testId}
                icon={stat.icon}
                label={stat.label}
                hint={stat.hint}
                cell={data?.[stat.key]}
                loading={isLoading}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  to,
  testId,
  icon: Icon,
  cell,
  label,
  hint,
  loading,
}: {
  to: string
  testId: string
  icon: LucideIcon
  cell: AdminStatCell | undefined
  label: string
  hint?: string
  loading: boolean
}) {
  const failed = Boolean(cell?.error)
  const shown = cell?.value ?? 0
  const display = failed ? '—' : formatAdminCount(shown, cell?.capped)
  const aria = loading
    ? `${label}, se încarcă`
    : failed
      ? `${label}, indisponibil`
      : hint
        ? `${label}, ${display}, ${hint}`
        : `${label}, ${display}`
  return (
    <Link
      to={to}
      data-testid={testId}
      className={statCardClass}
      aria-label={aria}
      aria-busy={loading || undefined}
    >
      <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div className="font-display mt-4 flex h-9 items-center text-3xl font-extrabold">
        {loading ? <Skeleton className="h-9 w-16" role="status" aria-label="Se încarcă" /> : display}
      </div>
      <div className="text-muted-foreground mt-1 text-sm break-words">{label}</div>
      {hint ? <div className="text-muted-foreground mt-0.5 text-xs break-words">{hint}</div> : null}
      {failed && cell?.error ? (
        <p className="text-destructive mt-2 text-xs break-words">{cell.error}</p>
      ) : null}
    </Link>
  )
}
