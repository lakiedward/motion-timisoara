import { countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import { geocodingRequest } from './geocoding/request'
import { reverseFallback } from './geocoding/fallback'
import { createReverseCache } from './geocoding/cache'

const TIMISOARA = { lat: 45.7489, lng: 21.2087 }
const BASE_URL = 'https://photon.komoot.io'
const LANG = 'default'
const reverseCache = createReverseCache()

export type GeoPlace = {
  id: string
  label: string
  detail: string
  address: string | null
  city: string | null
  county?: string | null
  lat: number
  lng: number
}

export type GeoSearchContext = { lat: number; lng: number }

type PhotonProperties = {
  osm_id?: number
  osm_type?: string
  name?: string
  street?: string
  housenumber?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
  countrycode?: string
  type?: string
}

type PhotonFeature = {
  properties?: PhotonProperties
  geometry?: { coordinates?: [number, number] }
}

function toPlace(feature: PhotonFeature, index: number): GeoPlace | null {
  const p = feature.properties ?? {}
  const lng = feature.geometry?.coordinates?.[0]
  const lat = feature.geometry?.coordinates?.[1]
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  )
    return null
  const city = p.city ?? p.town ?? p.village ?? (p.type === 'city' ? p.name : null) ?? null
  const county =
    p.countrycode && p.countrycode.toUpperCase() !== 'RO'
      ? (p.state ?? p.county ?? null)
      : (normalizeCounty(p.state) ?? normalizeCounty(p.county) ?? countyForCity(city))
  const streetName = p.street ?? p.name ?? null
  const street =
    streetName && streetName !== city && streetName !== p.state && streetName !== p.county
      ? streetName
      : null
  const address = [street, p.housenumber].filter(Boolean).join(' ') || null
  const label = p.name ?? address ?? city ?? 'Punct pe hartă'
  const detail = [address === label ? null : address, city, county, p.postcode, p.country]
    .filter(Boolean)
    .join(', ')
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? ''}-${index}`,
    label,
    detail,
    address,
    city,
    county,
    lat,
    lng,
  }
}

async function fetchFeatures(
  url: string,
  signal?: AbortSignal,
  timeoutMs = 5000,
): Promise<GeoPlace[]> {
  const json = await geocodingRequest<{ features?: PhotonFeature[] }>(url, timeoutMs, signal)
  return (json.features ?? []).map(toPlace).filter((place): place is GeoPlace => place !== null)
}

function uniquePlaces(places: GeoPlace[]): GeoPlace[] {
  const seen = new Set<string>()
  return places.filter((place) => {
    const key = `${place.label}|${place.city ?? ''}|${place.county ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const geocoding = {
  async search(
    query: string,
    signal?: AbortSignal,
    context: GeoSearchContext = TIMISOARA,
  ): Promise<GeoPlace[]> {
    if (query.trim().length < 3) return []
    const q = query.trim()
    const params = `&limit=10&lang=${LANG}&lat=${context.lat}&lon=${context.lng}`
    const places = await fetchFeatures(
      `${BASE_URL}/api?q=${encodeURIComponent(q)}${params}`,
      signal,
    )
    return uniquePlaces(places).slice(0, 5)
  },

  async reverse(lat: number, lng: number, signal?: AbortSignal): Promise<GeoPlace | null> {
    signal?.throwIfAborted()
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new Error('Invalid coordinates')
    }
    const cached = reverseCache.get(lat, lng)
    if (cached) return cached
    const base = `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=${LANG}`
    let partial: GeoPlace | null = null
    try {
      partial = (await fetchFeatures(base, signal, 1500))[0] ?? null
      if (partial?.address && partial.city && partial.county) {
        reverseCache.set(lat, lng, partial)
        return partial
      }
    } catch {
      signal?.throwIfAborted()
    }
    try {
      const place = (await reverseFallback(lat, lng, signal)) ?? partial
      signal?.throwIfAborted()
      if (place) reverseCache.set(lat, lng, place)
      return place
    } catch (error) {
      signal?.throwIfAborted()
      if (partial) return partial
      throw error
    }
  },
}
