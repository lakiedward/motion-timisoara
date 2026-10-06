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
