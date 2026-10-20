import { useId } from 'react'

import type { AdminUser } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Highlight } from '../courses/CourseParts'
import { asRole, ROLE_LABEL } from './user-overview'

export type ToggleArgs = { id: string; name: string; enabled: boolean }

const ADMIN_LOCK = 'Conturile de administrator nu pot fi dezactivate'

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'highlight'> = {
  ADMIN: 'highlight',
  CLUB: 'default',
  COACH: 'success',
  PARENT: 'secondary',
}

const DATE_FMT = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const TABLE_ACTION = 'h-touch-target min-h-touch-target lg:h-8 lg:min-h-8'
const CARD_ACTION = 'h-touch-target min-h-touch-target'

export function RoleBadge({ role }: { role: string }) {
  const known = asRole(role)
  return (
    <Badge variant={ROLE_VARIANT[role] ?? 'secondary'}>{known ? ROLE_LABEL[known] : role}</Badge>
  )
}

export function StatusBadge({ enabled }: { enabled: boolean }) {
  return <Badge variant={enabled ? 'success' : 'outline'}>{enabled ? 'Activ' : 'Dezactivat'}</Badge>
}

export function ToggleAction({
  user,
  pending,
  onToggle,
  className,
}: {
  user: AdminUser
  pending: boolean
  onToggle: (args: ToggleArgs) => void
  className?: string
}) {
  const reasonId = useId()
  if (user.role === 'ADMIN') {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled="true"
          aria-describedby={reasonId}
          title={ADMIN_LOCK}
          className={cn('cursor-not-allowed opacity-50 hover:bg-transparent', className)}
        >
          Dezactivează
        </Button>
        <span id={reasonId} className="sr-only">
          {ADMIN_LOCK}
        </span>
      </>
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => onToggle({ id: user.id, name: user.name, enabled: !user.enabled })}
    >
      {user.enabled ? 'Dezactivează' : 'Activează'}
    </Button>
  )
}

type RowProps = {
  users: AdminUser[]
  query: string
  pending: boolean
  onToggle: (args: ToggleArgs) => void
  showRole?: boolean
}

export function UserTable({ users, query, pending, onToggle, showRole = true }: RowProps) {
  return (
    <table className="hidden w-full text-sm md:table">
      <thead className="bg-muted/50 text-muted-foreground text-left text-xs uppercase">
        <tr>
          <th scope="col" className="px-4 py-3 font-semibold md:pl-5">
            Nume
          </th>
          <th scope="col" className="px-4 py-3 font-semibold">
            Email
          </th>
          {showRole && (
            <th scope="col" className="px-4 py-3 font-semibold">
              Rol
            </th>
          )}
          <th scope="col" className="px-4 py-3 font-semibold">
            Status
          </th>
          <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
            Înregistrat
          </th>
          <th scope="col" className="px-4 py-3">
            <span className="sr-only">Acțiuni</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-accent border-t transition-colors">
            <td className="px-4 py-3 font-medium md:pl-5">
              <Highlight text={u.name} query={query} />
            </td>
            <td className="text-muted-foreground px-4 py-3 break-all">
              <Highlight text={u.email} query={query} />
            </td>
            {showRole && (
              <td className="px-4 py-3">
                <RoleBadge role={u.role} />
              </td>
            )}
            <td className="px-4 py-3">
              <StatusBadge enabled={u.enabled} />
            </td>
            <td className="text-muted-foreground hidden px-4 py-3 whitespace-nowrap lg:table-cell">
              {DATE_FMT.format(new Date(u.created_at))}
            </td>
            <td className="px-4 py-3 text-right">
              <ToggleAction
                user={u}
                pending={pending}
                onToggle={onToggle}
                className={TABLE_ACTION}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function UserCardList({ users, query, pending, onToggle, showRole = true }: RowProps) {
  return (
    <ul className="list-none md:hidden">
      {users.map((u) => (
        <li key={u.id} className="border-t p-4 first:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium">
              <Highlight text={u.name} query={query} />
            </span>
            {showRole && <RoleBadge role={u.role} />}
          </div>
          <p className="text-muted-foreground mt-1 text-sm break-all">
            <Highlight text={u.email} query={query} />
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <StatusBadge enabled={u.enabled} />
            <ToggleAction user={u} pending={pending} onToggle={onToggle} className={CARD_ACTION} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function LoadingState() {
  const rows = [0, 1, 2, 3, 4]
  return (
    <div aria-hidden="true" data-testid="users-loading">
      <div className="mb-3 flex gap-2 overflow-hidden pb-1 md:pb-0">
        {['w-24', 'w-24', 'w-32'].map((w, i) => (
          <Skeleton key={i} className={cn('h-touch-target shrink-0 rounded-full lg:h-9', w)} />
        ))}
      </div>
      <Skeleton className="mb-3 h-5 w-28" />
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="flex min-h-16 items-center gap-3 px-4 py-3 md:px-5">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="bg-muted/50 hidden h-10 border-t md:block" />
        {rows.map((i) => (
          <div key={i} className="border-t p-4 md:flex md:items-center md:gap-6 md:px-5 md:py-3">
            <Skeleton className="h-6 w-32 md:h-5" />
            <Skeleton className="mt-1 h-5 w-52 md:mt-0" />
            <div className="mt-3 flex items-center justify-between md:mt-0 md:ml-auto">
              <Skeleton className="h-5 w-14 md:hidden" />
              <Skeleton className="h-touch-target w-28 lg:h-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
