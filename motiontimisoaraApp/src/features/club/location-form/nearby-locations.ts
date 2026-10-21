import type { LocationRow } from '@/api/public'

export const NEARBY_LOCATION_RADIUS_METERS = 50

export type LocationPoint = { lat: number; lng: number }
export type NearbyLocation = LocationRow & LocationPoint & { distanceMeters: number }
export type LocationChoice = { pointKey: string; sourceId: string | null }

const EARTH_RADIUS_METERS = 6_371_000
const radians = (degrees: number) => (degrees * Math.PI) / 180

function distanceMeters(a: LocationPoint, b: LocationPoint): number {
  const latitudeDelta = radians(b.lat - a.lat)
  const longitudeDelta = radians(b.lng - a.lng)
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, arc)))
}

export function isOwnLocation(
  location: Pick<LocationRow, 'club_id' | 'created_by_user_id'>,
  ownerId: string,
): boolean {
  if (!ownerId) return false
  return (
    location.club_id === ownerId || (!location.club_id && location.created_by_user_id === ownerId)
  )
}

export const NEARBY_OWNER_COPY = {
  club: {
    ownLabel: 'Deja în locațiile clubului',
    editBasePath: '/club/locations',
    choiceNote:
      'La salvare, clubul va avea propria locație în acest punct. Poți ajusta detaliile din formular.',
  },
  coach: {
    ownLabel: 'Deja în locațiile tale',
    editBasePath: '/coach/locations',
    choiceNote:
      'La salvare, vei avea propria locație în acest punct. Poți ajusta detaliile din formular.',
  },
  admin: {
    ownLabel: 'Deja în locațiile organizatorului',
    editBasePath: '/admin/locations',
    choiceNote:
      'La salvare, organizatorul va avea propria locație în acest punct. Poți ajusta detaliile din formular.',
  },
} as const

export function locationPointKey(point: LocationPoint): string {
  return `${point.lat},${point.lng}`
}

export function findNearbyLocations(
  locations: LocationRow[],
  point: LocationPoint,
): NearbyLocation[] {
  return locations
    .filter(
      (location): location is LocationRow & LocationPoint =>
        location.is_active &&
        location.lat !== null &&
        location.lng !== null &&
        Number.isFinite(location.lat) &&
        Number.isFinite(location.lng) &&
        Math.abs(location.lat) <= 90 &&
        Math.abs(location.lng) <= 180,
    )
    .map((location) => ({ ...location, distanceMeters: distanceMeters(point, location) }))
    .filter((location) => location.distanceMeters <= NEARBY_LOCATION_RADIUS_METERS)
    .sort(
      (a, b) =>
        a.distanceMeters - b.distanceMeters ||
        a.name.localeCompare(b.name, 'ro') ||
        a.id.localeCompare(b.id),
    )
}
