import type { CoachActivity } from '@/api/coach'
import { fold } from '@/features/admin/courses/course-overview'
import { countActivities } from '@/features/admin/activities/activity-overview'

export type CoachActivityStatus = 'upcoming' | 'past' | 'inactive' | 'all'

export type CoachActivityFilters = { status: CoachActivityStatus; sport: string; query: string }

export type OverviewActivity = Pick<
  CoachActivity,
  'name' | 'active' | 'activity_date' | 'start_time' | 'sport_id'
> & {
  sport: { name: string } | null
  location: { name: string } | null
}

export type ActivityMonth<T extends OverviewActivity = CoachActivity> = {
  key: string
  title: string
  activities: T[]
}

export const NO_COACH_ACTIVITY_FILTERS: CoachActivityFilters = {
  status: 'upcoming',
  sport: '',
  query: '',
}

export const CLEARED_COACH_ACTIVITY_FILTERS: CoachActivityFilters = {
  ...NO_COACH_ACTIVITY_FILTERS,
  status: 'all',
}

export function isPast(a: OverviewActivity, today: string) {
  return a.activity_date < today
}

export function matchesStatus(a: OverviewActivity, status: CoachActivityStatus, today: string) {
  if (status === 'upcoming') return a.active && !isPast(a, today)
  if (status === 'past') return a.active && isPast(a, today)
  if (status === 'inactive') return !a.active
  return true
}

const defaultSearchText = (a: OverviewActivity) => `${a.name} ${a.location?.name ?? ''}`

export function matchesQuery<T extends OverviewActivity>(
  a: T,
  query: string,
  searchText: (a: T) => string = defaultSearchText,
) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(searchText(a)).includes(needle)
}

export function filterCoachActivities<T extends OverviewActivity>(
  activities: T[],
  { status, sport, query }: CoachActivityFilters,
  today: string,
  searchText?: (a: T) => string,
) {
  const newestFirst = status !== 'upcoming'
  return activities
    .filter(
      (a) =>
        matchesStatus(a, status, today) &&
        (!sport || a.sport_id === sport) &&
        matchesQuery(a, query, searchText),
    )
    .sort((x, y) => {
      const order =
        x.activity_date.localeCompare(y.activity_date) || x.start_time.localeCompare(y.start_time)
      return newestFirst ? -order : order
    })
}

export function coachActivityStatusCounts(
  activities: OverviewActivity[],
  today: string,
): Record<CoachActivityStatus, number> {
  return {
    upcoming: activities.filter((a) => matchesStatus(a, 'upcoming', today)).length,
    past: activities.filter((a) => matchesStatus(a, 'past', today)).length,
    inactive: activities.filter((a) => matchesStatus(a, 'inactive', today)).length,
    all: activities.length,
  }
}

export function coachActivitySportCounts(activities: OverviewActivity[]) {
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

export function groupByMonth<T extends OverviewActivity>(sorted: T[]): ActivityMonth<T>[] {
  const months: ActivityMonth<T>[] = []
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

const tileDay = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', timeZone: 'UTC' })
const tileMonth = new Intl.DateTimeFormat('ro-RO', { month: 'short', timeZone: 'UTC' })

export function activityDateTile(a: OverviewActivity) {
  const date = new Date(`${a.activity_date}T00:00:00Z`)
  return { day: tileDay.format(date), month: tileMonth.format(date).replace('.', '') }
}
