import { Building2, ChevronDown, Shield, UserRound, Users } from 'lucide-react'

import type { AdminUser } from '@/api/admin'
import { cn } from '@/lib/utils'
import { UserCardList, UserTable, type ToggleArgs } from './UserParts'
import { countUsers, ROLE_PLURAL, type UserRole } from './user-overview'

export const GROUP_PREVIEW = 5

const ROLE_ICON = { PARENT: Users, COACH: UserRound, CLUB: Building2, ADMIN: Shield }

export function RoleGroupCard({
  role,
  users,
  activeCount,
  open,
  expanded,
  query,
  pending,
  onToggle,
  onOpenChange,
  onExpand,
}: {
  role: UserRole
  users: AdminUser[]
  activeCount: number
  open: boolean
  expanded: boolean
  query: string
  pending: boolean
  onToggle: (args: ToggleArgs) => void
  onOpenChange: (open: boolean) => void
  onExpand: () => void
}) {
  const Icon = ROLE_ICON[role]
  const searching = query.trim().length > 0
  const shown = expanded || searching ? users : users.slice(0, GROUP_PREVIEW)
  const hidden = users.length - shown.length
  const panelId = `rol-${role.toLowerCase()}`
  const disabled = users.length - activeCount

  return (
    <section className="bg-card overflow-hidden rounded-xl border" aria-label={ROLE_PLURAL[role]}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="hover:bg-accent flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors md:px-5"
        >
          <span className="bg-accent text-primary grid size-10 shrink-0 place-items-center rounded-full">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display text-foreground block font-semibold">
              {ROLE_PLURAL[role]}
            </span>
            <span className="text-muted-foreground flex flex-wrap gap-x-4 text-sm">
              <span>
                <strong className="text-foreground tabular-nums">{activeCount}</strong> activi din{' '}
                {users.length}
              </span>
              {disabled > 0 && (
                <span>
                  <strong className="text-foreground tabular-nums">{disabled}</strong>{' '}
                  {disabled === 1 ? 'dezactivat' : 'dezactivați'}
                </span>
              )}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground size-5 shrink-0 transition-transform',
              !open && '-rotate-90',
            )}
          />
        </button>
      </h3>

      {open && (
        <div id={panelId} className="border-t">
          <UserTable users={shown} query={query} pending={pending} onToggle={onToggle} />
          <UserCardList users={shown} query={query} pending={pending} onToggle={onToggle} />
          {hidden > 0 && (
            <div className="border-t px-4 py-2 md:pl-5">
              <button
                type="button"
                onClick={onExpand}
                className="text-primary inline-flex min-h-touch-target items-center text-sm font-semibold lg:min-h-8"
              >
                Arată toți cei {countUsers(users.length)}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
