import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

import { getAllUsers, setUserEnabled } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CourseFilterBar, type FilterOption } from './courses/CourseFilterBar'
import { RoleGroupCard } from './users/RoleGroupCard'
import { LoadingState, type ToggleArgs } from './users/UserParts'
import {
  asRole,
  countUsers,
  filterUsers,
  groupByRole,
  statusCounts,
  type UserRole,
  type UserStatus,
} from './users/user-overview'

const STATUS_OPTIONS: FilterOption<UserStatus>[] = [
  { value: 'all', label: 'Toți' },
  { value: 'active', label: 'Activi' },
  { value: 'disabled', label: 'Dezactivați' },
]

const EMPTY_BY_STATUS: Record<UserStatus, string> = {
  all: 'Niciun utilizator în listă.',
  active: 'Niciun utilizator activ.',
  disabled: 'Niciun cont dezactivat.',
}

const LINK = 'text-primary inline-flex min-h-touch-target items-center font-semibold lg:min-h-0'

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center">
      {children}
    </div>
  )
}

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<UserStatus>('all')
  const [toggled, setToggled] = useState<Partial<Record<UserRole, boolean>>>({})
  const [expanded, setExpanded] = useState<Set<UserRole>>(new Set())
  const role = asRole(params.get('role'))

  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-users'], queryFn: getAllUsers, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: ToggleArgs) => setUserEnabled(id, enabled),
    onSuccess: (_res, { name, enabled }) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`Contul lui ${name} a fost ${enabled ? 'activat' : 'dezactivat'}.`)
    },
    onError: () => toast.error('Nu am putut actualiza utilizatorul.'),
  })

  const searching = q.trim().length > 0
  const counts = useMemo(() => statusCounts(users), [users])
  const visible = useMemo(() => filterUsers(users, { status, query: q }), [users, status, q])
  const groups = useMemo(() => groupByRole(visible), [visible])

  const onToggle = (args: ToggleArgs) => toggle.mutate(args)
  const isOpen = (r: UserRole) => toggled[r] ?? (searching || !role || r === role)

  const rowProps = { query: q, pending: toggle.isPending, onToggle }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">Utilizatori</h1>
        <div className="relative order-last w-full md:order-none md:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume sau email"
            aria-label="Caută utilizatori după nume sau email"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError && users.length === 0 ? (
        <div role="alert" className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca utilizatorii.</p>
          <Button
            className="mt-4 h-touch-target min-h-touch-target"
            type="button"
            onClick={() => refetch()}
          >
            Reîncearcă
          </Button>
        </div>
      ) : users.length === 0 ? (
        <Message>Niciun utilizator înregistrat.</Message>
      ) : (
        <>
          <CourseFilterBar<UserStatus>
            status={status}
            sport=""
            statusCounts={counts}
            sports={[]}
            onStatus={setStatus}
            onSport={() => {}}
            statusOptions={STATUS_OPTIONS}
          />

          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {searching || status !== 'all'
              ? `${visible.length} din ${countUsers(users.length)}`
              : countUsers(users.length)}
          </p>

          {visible.length === 0 ? (
            <Message>
              {searching
                ? 'Niciun utilizator nu se potrivește cu căutarea. '
                : `${EMPTY_BY_STATUS[status]} `}
              {searching ? (
                <button type="button" onClick={() => setQ('')} className={LINK}>
                  Șterge căutarea
                </button>
              ) : (
                <button type="button" onClick={() => setStatus('all')} className={LINK}>
                  Arată toți
                </button>
              )}
            </Message>
          ) : (
            <div className="grid gap-3">
              {groups.map((g) => (
                <RoleGroupCard
                  key={g.role}
                  role={g.role}
                  users={g.users}
                  activeCount={g.activeCount}
                  open={isOpen(g.role)}
                  expanded={expanded.has(g.role)}
                  onOpenChange={(open) => setToggled((t) => ({ ...t, [g.role]: open }))}
                  onExpand={() => setExpanded((e) => new Set(e).add(g.role))}
                  {...rowProps}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
