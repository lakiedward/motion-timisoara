import { useRef, useState } from 'react'
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
import { DashboardGrid, DashboardGroup, DashboardRow } from '@/components/dashboard/DashboardGroups'
import { Button } from '@/components/ui/button'
import { usesNativeNavigation } from '@/layout/native/native-runtime'

const GROUPS: { title: string; keys: AdminStatKey[] }[] = [
  { title: 'Oameni', keys: ['users', 'newUsers7d', 'coaches'] },
  { title: 'Organizatori', keys: ['clubs', 'activeInviteCodes'] },
  { title: 'Oferte', keys: ['courses', 'camps', 'competitions'] },
]

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
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [retrying, setRetrying] = useState(false)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => getAdminStats(),
    retry: false,
  })
  const native = usesNativeNavigation()
  const failedNow = isError || (data ? allStatsFailed(data) : false)
  const totalFailure = retrying && !data ? true : failedNow
  const partialFailed = data && !totalFailure ? failedLabels(data) : []

  async function onRetry() {
    setRetrying(true)
    try {
      const result = await refetch()
      const next = result.data
      const stillFailed = Boolean(result.error) || (next ? allStatsFailed(next) : true)
      if (!stillFailed) headingRef.current?.focus()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-3xl font-extrabold break-words text-foreground outline-none"
        >
          Administrare
        </h1>
        <p className="text-muted-foreground mt-1 break-words">
          Privire de ansamblu asupra platformei.
        </p>
        {native ? (
          <Link
            to="/admin/profile"
            className="text-primary mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <UserRound className="size-4" aria-hidden="true" />
            Profil administrator
          </Link>
        ) : null}
      </div>
      {totalFailure ? (
        <div role="alert" className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca statisticile.</p>
          <Button
            className="mt-4 h-11 min-h-11"
            type="button"
            disabled={retrying}
            onClick={() => void onRetry()}
          >
            {retrying ? 'Se reîncarcă…' : 'Reîncearcă'}
          </Button>
        </div>
      ) : (
        <>
          {partialFailed.length > 0 ? (
            <div role="alert" className="rounded-xl border border-dashed px-6 py-4">
              <p className="text-foreground font-medium">
                Nu am putut încărca: {partialFailed.join(', ')}.
              </p>
              <Button
                className="mt-3 h-11 min-h-11"
                type="button"
                disabled={retrying}
                onClick={() => void onRetry()}
              >
                {retrying ? 'Se reîncarcă…' : 'Reîncearcă'}
              </Button>
            </div>
          ) : null}
          <DashboardGrid>
            {GROUPS.map((group) => (
              <DashboardGroup key={group.title} title={group.title}>
                {group.keys.map((key) => {
                  const stat = STATS.find((s) => s.key === key)!
                  const cell = data?.[key]
                  const { display, aria } = statText({ ...stat, cell, loading: isLoading })
                  return (
                    <DashboardRow
                      key={key}
                      to={stat.to}
                      testId={stat.testId}
                      icon={stat.icon}
                      label={stat.label}
                      hint={stat.hint}
                      ariaLabel={aria}
                      loading={isLoading}
                      value={display}
                      error={cell?.error ?? undefined}
                    />
                  )
                })}
              </DashboardGroup>
            ))}
          </DashboardGrid>
        </>
      )}
    </div>
  )
}

function statText({
  cell,
  label,
  hint,
  loading,
}: {
  cell: AdminStatCell | undefined
  label: string
  hint?: string
  loading: boolean
}) {
  const failed = Boolean(cell?.error)
  const display = failed ? '—' : formatAdminCount(cell?.value ?? 0, cell?.capped)
  const aria = loading
    ? `${label}, se încarcă`
    : failed
      ? `${label}, indisponibil`
      : hint
        ? `${label}, ${display}, ${hint}`
        : `${label}, ${display}`
  return { display, aria }
}
