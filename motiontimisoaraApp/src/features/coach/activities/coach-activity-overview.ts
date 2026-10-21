import type { CoachActivity } from '@/api/coach'
import { fold } from '@/features/admin/courses/course-overview'
import { countActivities } from '@/features/admin/activities/activity-overview'

export type CoachActivityStatus = 'upcoming' | 'past' | 'inactive' | 'all'

export type CoachActivityFilters = { status: CoachActivityStatus; sport: string; query: string }

export type ActivityMonth = { key: string; title: string; activities: CoachActivity[] }

export const NO_COACH_ACTIVITY_FILTERS: CoachActivityFilters = {
  status: 'upcoming',
  sport: '',
  query: '',
}

export const CLEARED_COACH_ACTIVITY_FILTERS: CoachActivityFilters = {
  ...NO_COACH_ACTIVITY_FILTERS,
  status: 'all',
}

export function isPast(a: CoachActivity, today: string) {
  return a.activity_date < today
}

export function matchesStatus(a: CoachActivity, status: CoachActivityStatus, today: string) {
  if (status === 'upcoming') return a.active && !isPast(a, today)
  if (status === 'past') return a.active && isPast(a, today)
  if (status === 'inactive') return !a.active
  return true
}

export function matchesQuery(a: CoachActivity, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${a.name} ${a.location?.name ?? ''}`).includes(needle)
}

export function filterCoachActivities(
  activities: CoachActivity[],
  { status, sport, query }: CoachActivityFilters,
  today: string,
) {
  const newestFirst = status !== 'upcoming'
  return activities
    .filter(
      (a) =>
        matchesStatus(a, status, today) &&
        (!sport || a.sport_id === sport) &&
        matchesQuery(a, query),
    )
    .sort((x, y) => {
      const order =
        x.activity_date.localeCompare(y.activity_date) || x.start_time.localeCompare(y.start_time)
      return newestFirst ? -order : order
    })
}

export function coachActivityStatusCounts(
  activities: CoachActivity[],
  today: string,
): Record<CoachActivityStatus, number> {
  return {
    upcoming: activities.filter((a) => matchesStatus(a, 'upcoming', today)).length,
    past: activities.filter((a) => matchesStatus(a, 'past', today)).length,
    inactive: activities.filter((a) => matchesStatus(a, 'inactive', today)).length,
    all: activities.length,
  }
}

export function coachActivitySportCounts(activities: CoachActivity[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const a of activities) {
    if (!a.sport_id || !a.sport) continue
    const entry = counts.get(a.sport_id) ?? { id: a.sport_id, name: a.sport.name, count: 0 }
    entry.count += 1
    counts.set(a.sport_id, entry)
  }
  return [...counts.values()].sort((x, y) => x.name.localeCompare(y.name, 'ro'))
}

export function hasCoachActivityFilters(f: CoachActivityFilters) {
  return f.status !== 'all' || !!f.sport || f.query.trim().length > 0
}

const monthFormat = new Intl.DateTimeFormat('ro-RO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('ro-RO') + s.slice(1)

export function groupByMonth(sorted: CoachActivity[]): ActivityMonth[] {
  const months: ActivityMonth[] = []
  for (const a of sorted) {
    const key = a.activity_date.slice(0, 7)
    let month = months.at(-1)
    if (month?.key !== key) {
      month = { key, title: '', activities: [] }
      months.push(month)
    }
    month.activities.push(a)
  }
  return months.map((m) => ({
    ...m,
    title: `${capitalize(monthFormat.format(new Date(`${m.key}-01T00:00:00Z`)))} · ${countActivities(m.activities.length)}`,
  }))
}

const weekdayFormat = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', timeZone: 'UTC' })

export function activityDateLine(a: CoachActivity) {
  const date = new Date(`${a.activity_date}T00:00:00Z`)
  const [y, m, d] = a.activity_date.split('-')
  const time = `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`
  return `${capitalize(weekdayFormat.format(date))}, ${d}.${m}.${y} · ${time}`
}

const tileDay = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', timeZone: 'UTC' })
const tileMonth = new Intl.DateTimeFormat('ro-RO', { month: 'short', timeZone: 'UTC' })

export function activityDateTile(a: CoachActivity) {
  const date = new Date(`${a.activity_date}T00:00:00Z`)
  return { day: tileDay.format(date), month: tileMonth.format(date).replace('.', '') }
}
