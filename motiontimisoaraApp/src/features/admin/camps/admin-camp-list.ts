import type { TabaraAdmin } from '@/api/camps-admin'
import { fold, type OrganizerKind } from '@/features/admin/courses/course-overview'
import { campStatus, type CampStatusFilter } from '@/features/camps/list/camp-list'
import { plural } from '@/lib/plural'

export type AdminCampFilters = {
  status: CampStatusFilter
  organizer: '' | OrganizerKind
  query: string
}

export type CampOrganizerGroup = {
  key: string
  kind: OrganizerKind
  name: string
  camps: TabaraAdmin[]
  openCount: number
  totalCount: number
  enrolled: number
}

export const NO_ADMIN_CAMP_FILTERS: AdminCampFilters = { status: 'all', organizer: '', query: '' }

export const countCamps = (n: number) => plural(n, 'tabără', 'tabere')

const UNKNOWN = 'Organizator necunoscut'

const ORGANIZER_LABEL: Record<OrganizerKind, string> = { club: 'Club', coach: 'Antrenor' }

export function organizerOf(camp: TabaraAdmin): { key: string; kind: OrganizerKind; name: string } {
  if (camp.club_id)
    return { key: `club:${camp.club_id}`, kind: 'club', name: camp.club?.name ?? UNKNOWN }
  return { key: `coach:${camp.coach_id}`, kind: 'coach', name: camp.coach?.name ?? UNKNOWN }
}

export function matchesQuery(camp: TabaraAdmin, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${camp.title} ${camp.location_text ?? ''} ${organizerOf(camp).name}`).includes(
    needle,
  )
}

export function filterAdminCamps(
  camps: TabaraAdmin[],
  { status, organizer, query }: AdminCampFilters,
  today = new Date(),
) {
  return camps.filter(
    (c) =>
      (status === 'all' || campStatus(c, today) === status) &&
      (!organizer || organizerOf(c).kind === organizer) &&
      matchesQuery(c, query),
  )
}

export const hasAdminCampFilters = (f: AdminCampFilters) =>
  f.status !== 'all' || !!f.organizer || f.query.trim() !== ''

export function organizerCounts(camps: TabaraAdmin[]) {
  return (['club', 'coach'] as const)
    .map((id) => ({
      id,
      name: ORGANIZER_LABEL[id],
      count: camps.filter((c) => organizerOf(c).kind === id).length,
    }))
    .filter((o) => o.count > 0)
}

const STATUS_RANK = { ongoing: 0, upcoming: 1, ended: 2 } as const

function campOrder(today: Date) {
  return (a: TabaraAdmin, b: TabaraAdmin) => {
    const sa = campStatus(a, today)
    const sb = campStatus(b, today)
    if (sa !== sb) return STATUS_RANK[sa] - STATUS_RANK[sb]
    const byStart = a.period_start.localeCompare(b.period_start)
    return sa === 'ended' ? -byStart : byStart
  }
}

export function groupCampsByOrganizer(
  all: TabaraAdmin[],
  visible: TabaraAdmin[],
  today = new Date(),
): CampOrganizerGroup[] {
  const visibleIds = new Set(visible.map((c) => c.id))
  const groups = new Map<string, CampOrganizerGroup>()
  for (const camp of all) {
    const org = organizerOf(camp)
    const g = groups.get(org.key) ?? { ...org, camps: [], openCount: 0, totalCount: 0, enrolled: 0 }
    g.totalCount += 1
    if (campStatus(camp, today) !== 'ended') {
      g.openCount += 1
      g.enrolled += camp.locuriOcupate
    }
    if (visibleIds.has(camp.id)) g.camps.push(camp)
    groups.set(org.key, g)
  }
  const order = campOrder(today)
  for (const g of groups.values()) g.camps.sort(order)
  return [...groups.values()]
    .filter((g) => g.camps.length > 0)
    .sort((a, b) => b.openCount - a.openCount || a.name.localeCompare(b.name, 'ro'))
}

export function overviewLine(groups: CampOrganizerGroup[], shown: number) {
  const clubs = groups.filter((g) => g.kind === 'club').length
  const coaches = groups.length - clubs
  const parts = [
    clubs ? plural(clubs, 'club', 'cluburi') : null,
    coaches ? plural(coaches, 'antrenor independent', 'antrenori independenți') : null,
  ].filter(Boolean)
  return `${countCamps(shown)} la ${parts.join(' și ')}`
}
