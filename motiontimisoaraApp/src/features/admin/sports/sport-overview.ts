import type { Sport } from '@/api/sports'
import { fold } from '@/features/admin/courses/course-overview'

export type PhotoFilter = 'all' | 'without' | 'with'

export type SportFilters = { photo: PhotoFilter; query: string }

export const NO_SPORT_FILTERS: SportFilters = { photo: 'all', query: '' }

export type SportGroup = { key: Exclude<PhotoFilter, 'all'>; name: string; sports: Sport[] }

export const hasPhoto = (sport: Sport) => !!sport.default_photo_storage_path

export function matchesSportQuery(sport: Sport, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(`${sport.name} ${sport.code}`).includes(needle)
}

export function filterSports(sports: Sport[], filters: SportFilters) {
  return sports.filter(
    (s) =>
      (filters.photo === 'all' || (filters.photo === 'with') === hasPhoto(s)) &&
      matchesSportQuery(s, filters.query),
  )
}

export function photoCounts(sports: Sport[]): Record<PhotoFilter, number> {
  const withPhoto = sports.filter(hasPhoto).length
  return { all: sports.length, with: withPhoto, without: sports.length - withPhoto }
}

export function groupSports(sports: Sport[]): SportGroup[] {
  const groups: SportGroup[] = [
    { key: 'without', name: 'Fără poză standard', sports: sports.filter((s) => !hasPhoto(s)) },
    { key: 'with', name: 'Cu poză standard', sports: sports.filter(hasPhoto) },
  ]
  return groups.filter((g) => g.sports.length > 0)
}

export function hasSportFilters(filters: SportFilters) {
  return filters.photo !== 'all' || !!filters.query.trim()
}
