import type { AdminActivity } from '@/api/activities/admin-activities'
import { fold } from '@/features/admin/courses/course-overview'
import { plural } from '@/lib/plural'

export type ActivityStatus = 'upcoming' | 'past' | 'inactive' | 'all'
export type ActivityOrganizerKind = 'club' | 'coach'

export type ActivityFilters = { status: ActivityStatus; sport: string; query: string }

export type ActivityGroup = {
  key: string
  kind: ActivityOrganizerKind
  name: string
  activities: AdminActivity[]
  upcomingCount: number
  totalCount: number
  enrolled: number
}

export const NO_ACTIVITY_FILTERS: ActivityFilters = { status: 'upcoming', sport: '', query: '' }

const TZ = 'Europe/Bucharest'

export function todayInBucharest(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now)
}

export const countActivities = (n: number) => plural(n, 'activitate', 'activități')

export function organizerOf(a: AdminActivity): {
  key: string
  kind: ActivityOrganizerKind
  name: string
} {
  if (a.club_id)
    return { key: `club:${a.club_id}`, kind: 'club', name: a.club?.name?.trim() || '—' }
  return { key: `coach:${a.coach_id}`, kind: 'coach', name: a.coach?.name?.trim() || '—' }
}

export function matchesStatus(a: AdminActivity, status: ActivityStatus, today: string) {
  if (status === 'upcoming') return a.active && a.activity_date >= today
  if (status === 'past') return a.active && a.activity_date < today
  if (status === 'inactive') return !a.active
  return true
}

export function matchesQuery(a: AdminActivity, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(
    [a.name, a.coach?.name, a.club?.name, a.location?.name, a.sport?.name]
      .filter(Boolean)
      .join(' '),
  ).includes(needle)
}

export function filterActivities(
  activities: AdminActivity[],
  { status, sport, query }: ActivityFilters,
  today: string,
) {
  return activities.filter(
    (a) =>
      matchesStatus(a, status, today) && (!sport || a.sport_id === sport) && matchesQuery(a, query),
  )
}

export function hasActivityFilters(f: ActivityFilters) {
  return f.status !== 'all' || !!f.sport || f.query.trim().length > 0
}

export function activityStatusCounts(
  activities: AdminActivity[],
  today: string,
): Record<ActivityStatus, number> {
  return {
    upcoming: activities.filter((a) => matchesStatus(a, 'upcoming', today)).length,
    past: activities.filter((a) => matchesStatus(a, 'past', today)).length,
    inactive: activities.filter((a) => matchesStatus(a, 'inactive', today)).length,
    all: activities.length,
  }
}

export function activitySportCounts(activities: AdminActivity[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const a of activities) {
    if (!a.sport_id || !a.sport) continue
    const entry = counts.get(a.sport_id) ?? { id: a.sport_id, name: a.sport.name, count: 0 }
    entry.count += 1
    counts.set(a.sport_id, entry)
  }
  return [...counts.values()].sort((x, y) => x.name.localeCompare(y.name, 'ro'))
}

export function byDate(a: AdminActivity, b: AdminActivity, upcomingFirst: boolean) {
  const order =
    a.activity_date.localeCompare(b.activity_date) || a.start_time.localeCompare(b.start_time)
  return upcomingFirst ? order : -order
}

export function groupActivitiesByOrganizer(
  all: AdminActivity[],
  visible: AdminActivity[],
  today: string,
  upcomingFirst: boolean,
): ActivityGroup[] {
  const totals = new Map<string, { upcoming: number; total: number }>()
  for (const a of all) {
    const { key } = organizerOf(a)
    const t = totals.get(key) ?? { upcoming: 0, total: 0 }
    t.total += 1
    if (matchesStatus(a, 'upcoming', today)) t.upcoming += 1
    totals.set(key, t)
  }
  const groups = new Map<string, ActivityGroup>()
  for (const a of visible) {
    const o = organizerOf(a)
    const g = groups.get(o.key) ?? {
      ...o,
      activities: [],
      upcomingCount: totals.get(o.key)?.upcoming ?? 0,
      totalCount: totals.get(o.key)?.total ?? 0,
      enrolled: 0,
    }
    g.activities.push(a)
    g.enrolled += a.enrolled
    groups.set(o.key, g)
  }
  for (const g of groups.values()) g.activities.sort((x, y) => byDate(x, y, upcomingFirst))
  return [...groups.values()].sort(
    (x, y) =>
      (x.kind === y.kind ? 0 : x.kind === 'club' ? -1 : 1) || x.name.localeCompare(y.name, 'ro'),
  )
}

const dayFormat = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export function activityWhen(a: AdminActivity) {
  const day = dayFormat.format(new Date(`${a.activity_date}T00:00:00Z`))
  return `${day} · ${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`
}
