import type {
  AdminAnnouncement,
  AdminAnnouncementSource,
  AdminOrganizerKind,
} from '@/api/announcements/admin-announcements'
import { fold } from '@/features/admin/courses/course-overview'
import { plural } from '@/lib/plural'

export type AnnouncementStatus = 'visible' | 'hidden' | 'pinned' | 'all'

export type AnnouncementFilters = {
  status: AnnouncementStatus
  source: '' | AdminAnnouncementSource
  query: string
}

export type AnnouncementGroup = {
  key: string
  kind: AdminOrganizerKind
  name: string
  items: AdminAnnouncement[]
  visibleCount: number
  totalCount: number
}

export const NO_ANNOUNCEMENT_FILTERS: AnnouncementFilters = {
  status: 'visible',
  source: '',
  query: '',
}

export const announcementLabel = (a: AdminAnnouncement) => a.title ?? a.audience

export const countAnnouncements = (n: number) => plural(n, 'anunț', 'anunțuri')

export const SOURCE_LABEL: Record<AdminAnnouncementSource, string> = {
  club: 'Club',
  coach: 'Antrenor',
}

export function matchesStatus(a: AdminAnnouncement, status: AnnouncementStatus) {
  if (status === 'visible') return a.visible
  if (status === 'hidden') return !a.visible
  if (status === 'pinned') return a.pinned
  return true
}

export function matchesQuery(a: AdminAnnouncement, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(
    [a.title, a.content, a.organizerName, a.audience, a.coachName].filter(Boolean).join(' '),
  ).includes(needle)
}

export function filterAnnouncements(items: AdminAnnouncement[], f: AnnouncementFilters) {
  return items.filter(
    (a) =>
      matchesStatus(a, f.status) &&
      (!f.source || a.source === f.source) &&
      matchesQuery(a, f.query),
  )
}

export const hasAnnouncementFilters = (f: AnnouncementFilters) =>
  f.status !== 'all' || !!f.source || f.query.trim().length > 0

export function announcementStatusCounts(
  items: AdminAnnouncement[],
): Record<AnnouncementStatus, number> {
  return {
    visible: items.filter((a) => a.visible).length,
    hidden: items.filter((a) => !a.visible).length,
    pinned: items.filter((a) => a.pinned).length,
    all: items.length,
  }
}

export function sourceCounts(items: AdminAnnouncement[]) {
  return (['club', 'coach'] as const)
    .map((id) => ({
      id,
      name: SOURCE_LABEL[id],
      count: items.filter((a) => a.source === id).length,
    }))
    .filter((s) => s.count > 0)
}

const newestFirst = (x: AdminAnnouncement, y: AdminAnnouncement) =>
  Number(y.pinned) - Number(x.pinned) || y.createdAt.localeCompare(x.createdAt)

export function groupAnnouncementsByOrganizer(
  all: AdminAnnouncement[],
  visible: AdminAnnouncement[],
): AnnouncementGroup[] {
  const totals = new Map<string, { visible: number; total: number }>()
  for (const a of all) {
    const t = totals.get(a.organizerKey) ?? { visible: 0, total: 0 }
    t.total += 1
    if (a.visible) t.visible += 1
    totals.set(a.organizerKey, t)
  }
  const groups = new Map<string, AnnouncementGroup>()
  for (const a of visible) {
    const g = groups.get(a.organizerKey) ?? {
      key: a.organizerKey,
      kind: a.organizerKind,
      name: a.organizerName,
      items: [],
      visibleCount: totals.get(a.organizerKey)?.visible ?? 0,
      totalCount: totals.get(a.organizerKey)?.total ?? 0,
    }
    g.items.push(a)
    groups.set(a.organizerKey, g)
  }
  for (const g of groups.values()) g.items.sort(newestFirst)
  return [...groups.values()].sort(
    (x, y) =>
      (x.kind === y.kind ? 0 : x.kind === 'club' ? -1 : 1) || x.name.localeCompare(y.name, 'ro'),
  )
}

const monthFormat = new Intl.DateTimeFormat('ro-RO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Bucharest',
})

export function groupAnnouncementsByMonth(items: AdminAnnouncement[]) {
  const groups: { key: string; title: string; items: AdminAnnouncement[] }[] = []
  for (const a of [...items].sort((x, y) => y.createdAt.localeCompare(x.createdAt))) {
    const raw = monthFormat.format(new Date(a.createdAt))
    const title = raw.charAt(0).toLocaleUpperCase('ro-RO') + raw.slice(1)
    const group = groups.find((g) => g.key === title)
    if (group) group.items.push(a)
    else groups.push({ key: title, title, items: [a] })
  }
  return groups
}
