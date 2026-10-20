import type { ClubCourse } from '@/api/club'
import { fold } from '@/features/admin/courses/course-overview'

export type ClubStatusFilter = 'active' | 'inactive' | 'all'

export type ClubCourseFilters = {
  status: ClubStatusFilter
  sport: string
  coach: string
  query: string
}

export const NO_FILTERS: ClubCourseFilters = { status: 'all', sport: '', coach: '', query: '' }

export function matchesStatus(course: ClubCourse, status: ClubStatusFilter) {
  if (status === 'active') return course.active
  if (status === 'inactive') return !course.active
  return true
}

export function matchesQuery(course: ClubCourse, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(
    `${course.name} ${course.location?.name ?? ''} ${course.coach?.name ?? ''}`,
  ).includes(needle)
}

export function statusCounts(courses: ClubCourse[]): Record<ClubStatusFilter, number> {
  const active = courses.filter((c) => c.active).length
  return { active, inactive: courses.length - active, all: courses.length }
}

function countBy(
  courses: ClubCourse[],
  pick: (c: ClubCourse) => { id: string; name: string } | null,
) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const c of courses) {
    const item = pick(c)
    if (!item) continue
    const entry = counts.get(item.id) ?? { ...item, count: 0 }
    entry.count += 1
    counts.set(item.id, entry)
  }
  return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
}

export const sportCounts = (courses: ClubCourse[]) =>
  countBy(courses, (c) => (c.sport_id && c.sport ? { id: c.sport_id, name: c.sport.name } : null))

export const coachCounts = (courses: ClubCourse[]) =>
  countBy(courses, (c) => (c.coach ? { id: c.coach.id, name: c.coach.name ?? '—' } : null))

export function filterClubCourses(
  courses: ClubCourse[],
  { status, sport, coach, query }: ClubCourseFilters,
) {
  return courses.filter(
    (c) =>
      matchesStatus(c, status) &&
      (!sport || c.sport_id === sport) &&
      (!coach || c.coach?.id === coach) &&
      matchesQuery(c, query),
  )
}

export function hasFilters({ status, sport, coach, query }: ClubCourseFilters) {
  return status !== 'all' || sport !== '' || coach !== '' || query.trim() !== ''
}

export function courseAgeLabel(ageFrom: number | null, ageTo: number | null) {
  if (ageFrom != null && ageTo != null) return `${ageFrom}–${ageTo} ani`
  if (ageFrom != null) return `de la ${ageFrom} ani`
  if (ageTo != null) return `până la ${ageTo} ani`
  return null
}
