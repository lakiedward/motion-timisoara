import type { CoachCourse } from '@/api/coach'
import { fold } from '@/features/admin/courses/course-overview'

export type CoachStatusFilter = 'active' | 'inactive' | 'all'

export type CoachCourseFilters = { status: CoachStatusFilter; sport: string; query: string }

export const NO_FILTERS: CoachCourseFilters = { status: 'all', sport: '', query: '' }

export function matchesStatus(course: CoachCourse, status: CoachStatusFilter) {
  if (status === 'active') return course.active
  if (status === 'inactive') return !course.active
  return true
}

export function matchesQuery(course: CoachCourse, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${course.name} ${course.location?.name ?? ''}`).includes(needle)
}

export function statusCounts(courses: CoachCourse[]): Record<CoachStatusFilter, number> {
  const active = courses.filter((c) => c.active).length
  return { active, inactive: courses.length - active, all: courses.length }
}

export function sportCounts(courses: CoachCourse[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const c of courses) {
    if (!c.sport_id || !c.sport) continue
    const entry = counts.get(c.sport_id) ?? { id: c.sport_id, name: c.sport.name, count: 0 }
    entry.count += 1
    counts.set(c.sport_id, entry)
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
}

export function filterCoachCourses(
  courses: CoachCourse[],
  { status, sport, query }: CoachCourseFilters,
) {
  return courses.filter(
    (c) =>
      matchesStatus(c, status) && (!sport || c.sport_id === sport) && matchesQuery(c, query),
  )
}

export function hasFilters({ status, sport, query }: CoachCourseFilters) {
  return status !== 'all' || sport !== '' || query.trim() !== ''
}
