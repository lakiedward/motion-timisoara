import { countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import { geocodingRequest } from './geocoding/request'

const TIMISOARA = { lat: 45.7489, lng: 21.2087 }
const BASE_URL = 'https://photon.komoot.io'
const LANG = 'default'

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

export type GeoSearchContext = { city?: string; county?: string }

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
  const city = p.city ?? p.town ?? p.village ?? null
  const county = normalizeCounty(p.state) ?? normalizeCounty(p.county) ?? countyForCity(city)
  const streetName = p.street ?? p.name ?? null
  const street =
    streetName && streetName !== city && streetName !== p.state && streetName !== p.county
      ? streetName
      : null
  const address = [street, p.housenumber].filter(Boolean).join(' ') || null
  const label = p.name ?? address ?? city ?? 'Punct pe hartă'
  const detail = [address === label ? null : address, city, county, p.postcode]
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
    context: GeoSearchContext = {},
  ): Promise<GeoPlace[]> {
    if (query.trim().length < 3) return []
    const q = [query.trim(), context.city, context.county].filter(Boolean).join(', ')
    const url = `${BASE_URL}/api?q=${encodeURIComponent(q)}&limit=10&lang=${LANG}&countrycode=RO&lat=${TIMISOARA.lat}&lon=${TIMISOARA.lng}`
    return uniquePlaces(await fetchFeatures(url, signal)).slice(0, 5)
  },

  async reverse(lat: number, lng: number, signal?: AbortSignal): Promise<GeoPlace | null> {
    const base = `${BASE_URL}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=${LANG}`
    try {
      const houses = await fetchFeatures(`${base}&layer=house&radius=1`, signal, 3000)
      if (houses.length > 0) return houses[0]
    } catch {
      signal?.throwIfAborted()
    }
    return (await fetchFeatures(base, signal))[0] ?? null
  },
}
