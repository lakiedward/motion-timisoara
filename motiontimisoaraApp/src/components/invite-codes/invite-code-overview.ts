import { inviteCodeStatus, type InviteCodeStatus } from '@/api/admin'
import { fold } from '@/features/admin/courses/course-overview'

export type InviteStatusFilter = InviteCodeStatus | 'all'

export type InviteCodeFields = {
  id: string
  code: string
  current_uses: number
  max_uses: number
  expires_at: string | null
}

export type InviteCodeGroup<T extends InviteCodeFields> = {
  key: InviteCodeStatus
  name: string
  codes: T[]
}

export const INVITE_STATUS_ORDER: InviteCodeStatus[] = ['active', 'used', 'expired']

export const INVITE_STATUS_LABEL: Record<InviteCodeStatus, string> = {
  active: 'Activ',
  used: 'Folosit',
  expired: 'Expirat',
}

const GROUP_NAME: Record<InviteCodeStatus, string> = {
  active: 'Active',
  used: 'Folosite',
  expired: 'Expirate',
}

export function inviteStatusCounts(
  codes: InviteCodeFields[],
  now = Date.now(),
): Record<InviteStatusFilter, number> {
  const counts = { all: codes.length, active: 0, used: 0, expired: 0 }
  for (const code of codes) counts[inviteCodeStatus(code, now)] += 1
  return counts
}

export function filterInviteCodes<T extends InviteCodeFields>(
  codes: T[],
  filters: { query: string; status: InviteStatusFilter },
  now = Date.now(),
): T[] {
  const needle = fold(filters.query.trim())
  return codes.filter(
    (code) =>
      (filters.status === 'all' || inviteCodeStatus(code, now) === filters.status) &&
      (!needle || fold(code.code).includes(needle)),
  )
}

export function groupInviteCodes<T extends InviteCodeFields>(
  codes: T[],
  now = Date.now(),
): InviteCodeGroup<T>[] {
  return INVITE_STATUS_ORDER.map((key) => ({
    key,
    name: GROUP_NAME[key],
    codes: codes.filter((code) => inviteCodeStatus(code, now) === key),
  })).filter((group) => group.codes.length > 0)
}

export function inviteExpiryLabel(
  expiresAt: string | null,
  timezone: string,
  now = Date.now(),
): string {
  if (!expiresAt) return 'Fără expirare'
  const moment = new Date(expiresAt)
  const formatted = new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(moment)
  const verb = moment.getTime() <= now ? 'A expirat pe' : 'Expiră pe'
  return `${verb} ${formatted} (${timezone})`
}
