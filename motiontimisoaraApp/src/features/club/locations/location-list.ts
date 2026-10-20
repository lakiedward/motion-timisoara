import type { ClubLocation } from '@/api/club'
import { fold } from '@/features/admin/courses/course-overview'

export type LocationStatusFilter = 'active' | 'inactive' | 'all'

export type LocationFilters = { status: LocationStatusFilter; query: string }

export const NO_FILTERS: LocationFilters = { status: 'all', query: '' }

export function formatAdresa(l: Pick<ClubLocation, 'address' | 'city'>): string {
  return [l.address, l.city].filter(Boolean).join(', ') || '—'
}

export function grupeazaDupaStare(locations: ClubLocation[]) {
  const ordonate = [...locations].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  return {
    active: ordonate.filter((l) => l.is_active),
    inactive: ordonate.filter((l) => !l.is_active),
  }
}

export function statusCounts(locations: ClubLocation[]): Record<LocationStatusFilter, number> {
  const active = locations.filter((l) => l.is_active).length
  return { active, inactive: locations.length - active, all: locations.length }
}

export function filterLocations(locations: ClubLocation[], { status, query }: LocationFilters) {
  const needle = fold(query.trim())
  return locations.filter(
    (l) =>
      (status === 'all' || l.is_active === (status === 'active')) &&
      (!needle || fold(`${l.name} ${l.address ?? ''} ${l.city ?? ''}`).includes(needle)),
  )
}

export function hasFilters({ status, query }: LocationFilters) {
  return status !== 'all' || query.trim() !== ''
}
