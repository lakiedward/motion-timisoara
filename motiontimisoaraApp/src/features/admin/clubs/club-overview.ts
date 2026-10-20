import type { AdminClub, AdminCourse } from '@/api/admin'
import { fold } from '@/features/admin/courses/course-overview'

export type ClubSummary = AdminClub & { activeCourses: number; totalCourses: number }

export type ClubFilters = { city: string; query: string }

export const NO_CLUB_FILTERS: ClubFilters = { city: '', query: '' }

export const NO_CITY = '—'

export function cityKey(club: Pick<AdminClub, 'city'>) {
  const city = club.city?.trim()
  return city ? fold(city) : NO_CITY
}

export function summarizeClubs(clubs: AdminClub[], courses: AdminCourse[]): ClubSummary[] {
  const byClub = new Map<string, { active: number; total: number }>()
  for (const c of courses) {
    if (!c.club_id) continue
    const n = byClub.get(c.club_id) ?? { active: 0, total: 0 }
    n.total += 1
    if (c.active) n.active += 1
    byClub.set(c.club_id, n)
  }
  return [...clubs]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' }))
    .map((club) => {
      const n = byClub.get(club.id)
      return { ...club, activeCourses: n?.active ?? 0, totalCourses: n?.total ?? 0 }
    })
}

export function matchesClubQuery(club: AdminClub, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${club.name} ${club.city ?? ''} ${club.email ?? ''}`).includes(needle)
}

export function filterClubs(clubs: ClubSummary[], filters: ClubFilters) {
  return clubs.filter(
    (c) => (!filters.city || cityKey(c) === filters.city) && matchesClubQuery(c, filters.query),
  )
}

export function clubCityCounts(clubs: ClubSummary[]) {
  const counts = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const c of clubs) {
    const key = cityKey(c)
    const entry = counts.get(key) ?? { count: 0, spellings: new Map<string, number>() }
    entry.count += 1
    const spelling = c.city?.trim() || 'Fără oraș'
    entry.spellings.set(spelling, (entry.spellings.get(spelling) ?? 0) + 1)
    counts.set(key, entry)
  }
  return [...counts.entries()]
    .map(([id, { count, spellings }]) => ({
      id,
      name: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count,
    }))
    .sort((a, b) =>
      a.id === NO_CITY ? 1 : b.id === NO_CITY ? -1 : a.name.localeCompare(b.name, 'ro'),
    )
}

export function hasClubFilters(filters: ClubFilters) {
  return !!filters.city || !!filters.query.trim()
}

export type ClubGroup = {
  key: string
  name: string
  clubs: ClubSummary[]
}

const ACTIVITY_GROUPS = [
  { key: 'active', name: 'Cu cursuri active' },
  { key: 'inactive', name: 'Doar cursuri inactive' },
  { key: 'none', name: 'Fără cursuri' },
] as const

function activityKey(club: ClubSummary) {
  if (club.activeCourses > 0) return 'active'
  return club.totalCourses > 0 ? 'inactive' : 'none'
}

export function groupClubs(clubs: ClubSummary[]): ClubGroup[] {
  return ACTIVITY_GROUPS.map((g) => ({
    key: g.key,
    name: g.name,
    clubs: clubs.filter((c) => activityKey(c) === g.key),
  })).filter((g) => g.clubs.length > 0)
}
