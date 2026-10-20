import type { AdminLocation } from '@/api/locations/admin-locations'
import { fold } from '@/features/admin/courses/course-overview'
import { plural } from '@/lib/plural'

export type OrganizerKind = 'club' | 'coach' | 'shared'
export type LocationStatus = 'active' | 'inactive' | 'all'

export type LocationOrganizer = { key: string; kind: OrganizerKind; name: string }

export type LocationGroup = LocationOrganizer & {
  locations: AdminLocation[]
  activeCount: number
  totalCount: number
  courseCount: number
}

export type AdminLocationFilters = { status: LocationStatus; query: string }

export const NO_LOCATION_FILTERS: AdminLocationFilters = {
  status: 'active',
  query: '',
}

export const SHARED_KEY = 'shared'

const KIND_ORDER: Record<OrganizerKind, number> = { club: 0, coach: 1, shared: 2 }

export function organizerOf(l: AdminLocation): LocationOrganizer {
  if (l.club_id) return { key: `club:${l.club_id}`, kind: 'club', name: l.club?.name ?? '—' }
  if (l.created_by_user_id)
    return { key: `coach:${l.created_by_user_id}`, kind: 'coach', name: l.creator?.name ?? '—' }
  return { key: SHARED_KEY, kind: 'shared', name: 'Locații comune' }
}

function matchesStatus(l: AdminLocation, status: LocationStatus) {
  return status === 'all' || l.is_active === (status === 'active')
}

function matchesQuery(l: AdminLocation, query: string) {
  const needle = fold(query.trim())
  if (!needle) return true
  return fold(
    `${l.name} ${l.address ?? ''} ${l.city ?? ''} ${organizerOf(l).name} ${l.usedBy.join(' ')}`,
  ).includes(needle)
}

export function filterLocations(locations: AdminLocation[], f: AdminLocationFilters) {
  return locations.filter((l) => matchesStatus(l, f.status) && matchesQuery(l, f.query))
}

export function hasLocationFilters(f: AdminLocationFilters) {
  return f.status !== 'all' || f.query.trim() !== ''
}

export function locationStatusCounts(locations: AdminLocation[]): Record<LocationStatus, number> {
  const active = locations.filter((l) => l.is_active).length
  return { active, inactive: locations.length - active, all: locations.length }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ro')

export function groupByOrganizer(all: AdminLocation[], visible: AdminLocation[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>()
  for (const l of all) {
    const o = organizerOf(l)
    const g = groups.get(o.key) ?? {
      ...o,
      locations: [],
      activeCount: 0,
      totalCount: 0,
      courseCount: 0,
    }
    g.totalCount += 1
    if (l.is_active) g.activeCount += 1
    g.courseCount += l.courseCount
    groups.set(o.key, g)
  }
  for (const l of visible) groups.get(organizerOf(l).key)?.locations.push(l)
  return [...groups.values()]
    .filter((g) => g.locations.length > 0)
    .map((g) => ({ ...g, locations: [...g.locations].sort(byName) }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byName(a, b))
}

export const countLocations = (n: number) => plural(n, 'locație', 'locații')
