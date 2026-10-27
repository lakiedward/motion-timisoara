import type { ClubAnnouncement, ClubAudience } from '@/api/club'
import { fold } from '@/features/admin/courses/course-overview'
import { ETICHETA_TINTA } from './announcement-list'
import { scheduleState } from './announcement-schedule'

export type ClubAnnouncementStatus = 'all' | 'live' | 'scheduled' | 'expired' | 'hidden'

export type ClubAnnouncementFilters = {
  query: string
  status: ClubAnnouncementStatus
  target: string
}

export const NO_FILTERS: ClubAnnouncementFilters = { query: '', status: 'all', target: '' }

export const WHOLE_CLUB_TARGET = 'CLUB'

export const hasFilters = (f: ClubAnnouncementFilters) =>
  f.query.trim() !== '' || f.status !== 'all' || f.target !== ''

export const targetKey = (a: Pick<ClubAnnouncement, 'audience_kind' | 'audience_id'>) =>
  a.audience_kind === 'CLUB' ? WHOLE_CLUB_TARGET : `${a.audience_kind}:${a.audience_id}`

export function matchesStatus(
  a: ClubAnnouncement,
  status: ClubAnnouncementStatus,
  now = new Date(),
) {
  if (status === 'all') return true
  if (status === 'hidden') return !a.is_active
  return a.is_active && scheduleState(a, now) === status
}

export function filterClubAnnouncements(
  items: ClubAnnouncement[],
  filters: ClubAnnouncementFilters,
  targetName: (a: ClubAnnouncement) => string,
  now = new Date(),
) {
  const needle = fold(filters.query.trim())
  return items.filter(
    (a) =>
      matchesStatus(a, filters.status, now) &&
      (!filters.target || targetKey(a) === filters.target) &&
      (!needle || fold(`${a.title} ${a.content} ${targetName(a)}`).includes(needle)),
  )
}

export function statusCounts(
  items: ClubAnnouncement[],
  now = new Date(),
): Record<ClubAnnouncementStatus, number> {
  const count = (s: ClubAnnouncementStatus) => items.filter((a) => matchesStatus(a, s, now)).length
  return {
    all: items.length,
    live: count('live'),
    scheduled: count('scheduled'),
    expired: count('expired'),
    hidden: count('hidden'),
  }
}

export function targetCounts(items: ClubAnnouncement[], audiences: ClubAudience[]) {
  const options = [
    { id: WHOLE_CLUB_TARGET, name: 'Tot clubul' },
    ...audiences.map((t) => ({
      id: `${t.kind}:${t.id}`,
      name: `${ETICHETA_TINTA[t.kind]}: ${t.name}`,
    })),
  ]
  return options
    .map((o) => ({ ...o, count: items.filter((a) => targetKey(a) === o.id).length }))
    .filter((o) => o.count > 0)
}
