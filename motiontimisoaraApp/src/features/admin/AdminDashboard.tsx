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

import { getAdminStats, type AdminStats } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const statCardClass = cn(
  'bg-card shadow-card flex h-full min-h-[11.5rem] min-w-0 cursor-pointer flex-col rounded-3xl p-6 transition-all',
  'hover:-translate-y-1 hover:shadow-card-hover [&:hover]:-translate-y-1 [&:hover]:shadow-card-hover',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary',
)

const STATS: {
  key: keyof AdminStats
  label: string
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
    label: 'Utilizatori noi în ultimele 7 zile',
    icon: UserPlus,
    to: '/admin/users',
    testId: 'admin-stat-utilizatori-noi',
  },
  {
    key: 'activeInviteCodes',
    label: 'Coduri de invitație active',
    icon: Ticket,
    to: '/admin/codes',
    testId: 'admin-stat-coduri',
  },
]

export default function AdminDashboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => getAdminStats(),
    retry: false,
  })

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold break-words text-foreground">
          Administrare
        </h1>
        <p className="text-muted-foreground mt-1 break-words">
          Privire de ansamblu asupra platformei.
        </p>
      </div>
      {isError ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca statisticile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 overflow-visible py-1 md:grid-cols-2 xl:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard
              key={stat.key}
              to={stat.to}
              testId={stat.testId}
              icon={stat.icon}
              label={stat.label}
              value={data?.[stat.key]}
              loading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  to,
  testId,
  icon: Icon,
  value,
  label,
  loading,
}: {
  to: string
  testId: string
  icon: LucideIcon
  value: number | undefined
  label: string
  loading: boolean
}) {
  const shown = value ?? 0
  return (
    <Link
      to={to}
      data-testid={testId}
      className={statCardClass}
      aria-label={loading ? label : `${label}, ${shown}`}
    >
      <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div className="font-display mt-4 flex h-9 items-center text-3xl font-extrabold">
        {loading ? <Skeleton className="h-9 w-16" /> : shown}
      </div>
      <div className="text-muted-foreground mt-1 text-sm break-words">{label}</div>
    </Link>
  )
}
