import type {
  CompetitionListItem,
  CompetitionOrganizerKind,
} from '@/api/competition/competition-list'
import { fold } from '@/features/admin/courses/course-overview'
import { COMPETITION_TIME_ZONE } from '@/lib/competition-schedule'
import { rezumatPretPeVarsta } from '@/lib/money'
import { plural } from '@/lib/plural'

export type CompetitionStatus = 'ongoing' | 'upcoming' | 'ended'
export type CompetitionStatusFilter = CompetitionStatus | 'all'

export type CompetitionFilters = {
  status: CompetitionStatusFilter
  organizer: '' | CompetitionOrganizerKind
  query: string
}

export type CompetitionOrganizerGroup = {
  key: string
  kind: CompetitionOrganizerKind
  name: string
  items: CompetitionListItem[]
  openCount: number
  totalCount: number
  registered: number
}

export const NO_COMPETITION_FILTERS: CompetitionFilters = {
  status: 'all',
  organizer: '',
  query: '',
}

export const STATUS_TITLES: Record<CompetitionStatus, string> = {
  ongoing: 'În desfășurare',
  upcoming: 'Viitoare',
  ended: 'Încheiate',
}

const STATUS_ORDER: CompetitionStatus[] = ['ongoing', 'upcoming', 'ended']

const ORGANIZER_LABEL: Record<CompetitionOrganizerKind, string> = {
  club: 'Club',
  coach: 'Antrenor',
}

export const countCompetitions = (n: number) => plural(n, 'concurs', 'concursuri')

const time = (value: string | null) => (value ? new Date(value).getTime() : null)

export function competitionStatus(
  c: Pick<CompetitionListItem, 'start_at' | 'end_at'>,
  now = new Date(),
): CompetitionStatus {
  const t = now.getTime()
  const end = time(c.end_at)
  const start = time(c.start_at)
  if (end !== null && end < t) return 'ended'
  if (start !== null && start <= t) return 'ongoing'
  return 'upcoming'
}

export function registrationsClosed(
  c: Pick<CompetitionListItem, 'registration_deadline_at'>,
  now = new Date(),
) {
  const deadline = time(c.registration_deadline_at)
  return deadline !== null && deadline < now.getTime()
}

const day = new Intl.DateTimeFormat('ro-RO', {
  timeZone: COMPETITION_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const hour = new Intl.DateTimeFormat('ro-RO', {
  timeZone: COMPETITION_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

export function competitionWhen(c: Pick<CompetitionListItem, 'start_at' | 'end_at'>) {
  if (!c.start_at) return 'Fără dată'
  const start = new Date(c.start_at)
  if (!c.end_at) return `${day.format(start)} · ${hour.format(start)}`
  const end = new Date(c.end_at)
  if (day.format(start) === day.format(end)) {
    return `${day.format(start)} · ${hour.format(start)}–${hour.format(end)}`
  }
  return `${day.format(start)} – ${day.format(end)}`
}

export function competitionPrice(c: Pick<CompetitionListItem, 'prices'>) {
  return c.prices.length ? rezumatPretPeVarsta(c.prices, 'RON') : null
}

function matchesQuery(c: CompetitionListItem, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${c.title} ${c.location_text ?? ''} ${c.organizer.name}`).includes(needle)
}

export function filterCompetitions(
  items: CompetitionListItem[],
  { status, organizer, query }: CompetitionFilters,
  now = new Date(),
) {
  return items.filter(
    (c) =>
      (status === 'all' || competitionStatus(c, now) === status) &&
      (!organizer || c.organizer.kind === organizer) &&
      matchesQuery(c, query),
  )
}

export const hasCompetitionFilters = (f: CompetitionFilters) =>
  f.status !== 'all' || !!f.organizer || f.query.trim() !== ''

export function statusCounts(
  items: CompetitionListItem[],
  now = new Date(),
): Record<CompetitionStatusFilter, number> {
  const counts = { ongoing: 0, upcoming: 0, ended: 0, all: items.length }
  for (const c of items) counts[competitionStatus(c, now)] += 1
  return counts
}

export function organizerCounts(items: CompetitionListItem[]) {
  return (['club', 'coach'] as const)
    .map((id) => ({
      id,
      name: ORGANIZER_LABEL[id],
      count: items.filter((c) => c.organizer.kind === id).length,
    }))
    .filter((o) => o.count > 0)
}

const STATUS_RANK = { ongoing: 0, upcoming: 1, ended: 2 } as const

function byStart(a: CompetitionListItem, b: CompetitionListItem) {
  return (a.start_at ?? '9999').localeCompare(b.start_at ?? '9999')
}

export function competitionOrder(now = new Date()) {
  return (a: CompetitionListItem, b: CompetitionListItem) => {
    const sa = competitionStatus(a, now)
    const sb = competitionStatus(b, now)
    if (sa !== sb) return STATUS_RANK[sa] - STATUS_RANK[sb]
    return sa === 'ended' ? -byStart(a, b) : byStart(a, b)
  }
}

export function groupByStatus(items: CompetitionListItem[], now = new Date()) {
  const order = competitionOrder(now)
  return STATUS_ORDER.map((status) => ({
    status,
    title: STATUS_TITLES[status],
    items: items.filter((c) => competitionStatus(c, now) === status).sort(order),
  })).filter((g) => g.items.length)
}

export function groupByOrganizer(
  all: CompetitionListItem[],
  visible: CompetitionListItem[],
  now = new Date(),
): CompetitionOrganizerGroup[] {
  const visibleIds = new Set(visible.map((c) => c.id))
  const groups = new Map<string, CompetitionOrganizerGroup>()
  for (const c of all) {
    const g = groups.get(c.organizer.key) ?? {
      ...c.organizer,
      items: [],
      openCount: 0,
      totalCount: 0,
      registered: 0,
    }
    g.totalCount += 1
    if (competitionStatus(c, now) !== 'ended') {
      g.openCount += 1
      g.registered += c.registeredCount
    }
    if (visibleIds.has(c.id)) g.items.push(c)
    groups.set(c.organizer.key, g)
  }
  const order = competitionOrder(now)
  for (const g of groups.values()) g.items.sort(order)
  return [...groups.values()]
    .filter((g) => g.items.length > 0)
    .sort((a, b) => b.openCount - a.openCount || a.name.localeCompare(b.name, 'ro'))
}
