import type { AdminUser } from '@/api/admin'

export type UserStatus = 'all' | 'active' | 'disabled'
export type UserRole = 'PARENT' | 'COACH' | 'CLUB' | 'ADMIN'

export const ROLE_ORDER: UserRole[] = ['PARENT', 'COACH', 'CLUB', 'ADMIN']

export const ROLE_LABEL: Record<UserRole, string> = {
  PARENT: 'Părinte',
  COACH: 'Antrenor',
  CLUB: 'Club',
  ADMIN: 'Administrator',
}

export const ROLE_PLURAL: Record<UserRole, string> = {
  PARENT: 'Părinți',
  COACH: 'Antrenori',
  CLUB: 'Cluburi',
  ADMIN: 'Administratori',
}

export function asRole(raw: string | null | undefined): UserRole | null {
  const value = raw?.trim().toUpperCase()
  return value && (ROLE_ORDER as string[]).includes(value) ? (value as UserRole) : null
}

export function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function countUsers(n: number) {
  if (n === 1) return '1 utilizator'
  const rest = n % 100
  return `${n}${n > 0 && (rest === 0 || rest > 19) ? ' de' : ''} utilizatori`
}

export function matchesStatus(u: AdminUser, status: UserStatus) {
  if (status === 'active') return u.enabled
  if (status === 'disabled') return !u.enabled
  return true
}

export function filterUsers(
  users: AdminUser[],
  { status, query }: { status: UserStatus; query: string },
) {
  const needle = fold(query.trim())
  return users.filter(
    (u) => matchesStatus(u, status) && (!needle || fold(`${u.name} ${u.email}`).includes(needle)),
  )
}

export function statusCounts(users: AdminUser[]): Record<UserStatus, number> {
  const active = users.filter((u) => u.enabled).length
  return { all: users.length, active, disabled: users.length - active }
}

export function groupByRole(users: AdminUser[]) {
  return ROLE_ORDER.map((role) => {
    const list = users.filter((u) => u.role === role)
    return { role, users: list, activeCount: list.filter((u) => u.enabled).length }
  }).filter((g) => g.users.length > 0)
}
