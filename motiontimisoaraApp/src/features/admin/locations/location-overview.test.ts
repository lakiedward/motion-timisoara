import { expect, test } from 'vitest'

import type { AdminLocation } from '@/api/locations/admin-locations'
import {
  NO_LOCATION_FILTERS,
  countLocations,
  filterLocations,
  groupByOrganizer,
  hasLocationFilters,
  locationStatusCounts,
  organizerOf,
  organizerOptions,
} from './location-overview'

function loc(p: Partial<AdminLocation> & { id: string; name: string }): AdminLocation {
  return {
    address: 'Str. Paris 3',
    city: 'Timișoara',
    county: 'Timiș',
    capacity: null,
    description: null,
    fts: null,
    lat: 45.75,
    lng: 21.22,
    type: 'POOL',
    is_active: true,
    club_id: null,
    created_by_user_id: null,
    club: null,
    creator: null,
    courseCount: 0,
    ...p,
  }
}

const delfin = { id: 'c1', name: 'Clubul Delfinul' }
const ana = { id: 'u1', name: 'Ana Rusu' }
const all = [
  loc({ id: '1', name: 'Bazin Neptun', club_id: 'c1', club: delfin, courseCount: 2 }),
  loc({ id: '2', name: 'Arena', club_id: 'c1', club: delfin, is_active: false }),
  loc({ id: '3', name: 'Parcul Rozelor', created_by_user_id: 'u1', creator: ana, courseCount: 1 }),
  loc({ id: '4', name: 'Sala Polivalentă', address: 'Bd. Take Ionescu 10' }),
]

test('organizerOf names club, coach and shared owners', () => {
  expect(organizerOf(all[0])).toEqual({ key: 'club:c1', kind: 'club', name: 'Clubul Delfinul' })
  expect(organizerOf(all[2])).toEqual({ key: 'coach:u1', kind: 'coach', name: 'Ana Rusu' })
  expect(organizerOf(all[3])).toEqual({ key: 'shared', kind: 'shared', name: 'Locații comune' })
})

test('filters by status, organizer and diacritic-insensitive query over organizer name', () => {
  expect(filterLocations(all, NO_LOCATION_FILTERS).map((l) => l.id)).toEqual(['1', '3', '4'])
  expect(
    filterLocations(all, { status: 'all', organizer: 'club:c1', query: '' }).map((l) => l.id),
  ).toEqual(['1', '2'])
  expect(filterLocations(all, { status: 'all', organizer: '', query: 'delfinul' })).toHaveLength(2)
  expect(filterLocations(all, { status: 'all', organizer: '', query: 'polivalenta' })).toHaveLength(
    1,
  )
  expect(
    filterLocations(all, { status: 'all', organizer: '', query: 'take ionescu' }),
  ).toHaveLength(1)
})

test('groups visible locations by organizer, clubs first, totals from all rows', () => {
  const groups = groupByOrganizer(all, filterLocations(all, NO_LOCATION_FILTERS))
  expect(groups.map((g) => [g.key, g.locations.length, g.activeCount, g.totalCount])).toEqual([
    ['club:c1', 1, 1, 2],
    ['coach:u1', 1, 1, 1],
    ['shared', 1, 1, 1],
  ])
  expect(groups[0].courseCount).toBe(2)
  expect(groupByOrganizer(all, [all[1]]).map((g) => g.key)).toEqual(['club:c1'])
})

test('status counts, organizer options and helpers', () => {
  expect(locationStatusCounts(all)).toEqual({ active: 3, inactive: 1, all: 4 })
  expect(organizerOptions(all).map((o) => [o.key, o.count])).toEqual([
    ['club:c1', 2],
    ['coach:u1', 1],
    ['shared', 1],
  ])
  expect(hasLocationFilters({ status: 'all', organizer: '', query: ' ' })).toBe(false)
  expect(hasLocationFilters(NO_LOCATION_FILTERS)).toBe(true)
  expect(countLocations(1)).toBe('1 locație')
  expect(countLocations(21)).toBe('21 de locații')
})
