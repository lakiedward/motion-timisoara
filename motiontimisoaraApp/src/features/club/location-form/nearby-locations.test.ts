import { expect, test } from 'vitest'

import type { LocationRow } from '@/api/public'
import { findNearbyLocations, locationPointKey } from './nearby-locations'

const point = { lat: 0, lng: 0 }
const latitudeAtMeters = (meters: number) => (meters / 6_371_000) * (180 / Math.PI)

function location(id: string, overrides: Partial<LocationRow> = {}): LocationRow {
  return {
    id,
    name: id,
    type: 'POOL',
    address: null,
    city: null,
    county: null,
    lat: 0,
    lng: 0,
    capacity: null,
    description: null,
    is_active: true,
    club_id: null,
    created_by_user_id: null,
    fts: null,
    ...overrides,
  }
}

test('includes locations at the 50 metre boundary and excludes farther ones', () => {
  const result = findNearbyLocations(
    [
      location('inside', { lat: latitudeAtMeters(49) }),
      location('boundary', { lat: latitudeAtMeters(50) }),
      location('outside', { lat: latitudeAtMeters(51) }),
    ],
    point,
  )
  expect(result.map((candidate) => candidate.id)).toEqual(['inside', 'boundary'])
  expect(result[1].distanceMeters).toBeCloseTo(50, 8)
})

test('orders nearest first and preserves exact source coordinates and ownership', () => {
  const source = location('source', {
    lat: latitudeAtMeters(12.345678),
    lng: 0.00000123456,
    club_id: 'other-club',
    created_by_user_id: 'other-owner',
  })
  const result = findNearbyLocations(
    [location('farther', { lat: latitudeAtMeters(40) }), source],
    point,
  )
  expect(result.map((candidate) => candidate.id)).toEqual(['source', 'farther'])
  expect(result[0]).toMatchObject(source)
  expect(source).not.toHaveProperty('distanceMeters')
})

test('ignores inactive, missing, nonfinite and invalid coordinates', () => {
  const result = findNearbyLocations(
    [
      location('inactive', { is_active: false }),
      location('missing-lat', { lat: null }),
      location('missing-lng', { lng: null }),
      location('nonfinite', { lat: Number.NaN }),
      location('invalid-lat', { lat: 360 }),
      location('invalid-lng', { lng: 360 }),
      location('active'),
    ],
    point,
  )
  expect(result.map((candidate) => candidate.id)).toEqual(['active'])
})

test('longitude distance accounts for latitude', () => {
  const result = findNearbyLocations(
    [location('near', { lat: 60, lng: 0.0008 }), location('far', { lat: 60, lng: 0.001 })],
    { lat: 60, lng: 0 },
  )
  expect(result.map((candidate) => candidate.id)).toEqual(['near'])
})

test('point identity retains precision beyond map grouping decimals', () => {
  expect(locationPointKey({ lat: 45.750001, lng: 21.220001 })).not.toBe(
    locationPointKey({ lat: 45.750002, lng: 21.220002 }),
  )
})
