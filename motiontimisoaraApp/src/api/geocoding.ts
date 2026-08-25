/** Nominatim (OpenStreetMap) forward + reverse geocoding, Romania-biased. */

const NOMINATIM = 'https://nominatim.openstreetmap.org'

/** Timișoara metro viewbox: left, top, right, bottom (lon/lat). Biases results, does not exclude the rest of RO. */
const TIMISOARA_VIEWBOX = '20.95,45.83,21.40,45.68'

export type NominatimAddress = {
  house_number?: string
  road?: string
  pedestrian?: string
  footway?: string
  square?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
}

export type NominatimHit = {
  place_id?: number
  osm_id?: number
  osm_type?: string
  display_name: string
  lat: string
  lon: string
  address?: NominatimAddress
}

export type PlaceSuggestion = {
  id: string
  label: string
  lat: number
  lng: number
  address: string
  city: string
}

export type ReversePlace = {
  address: string
  city: string
}

export function placeFromNominatim(hit: NominatimHit): PlaceSuggestion | null {
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const { address, city } = addressFromNominatim(hit)
  return {
    id: String(hit.place_id ?? `${hit.osm_type ?? 'osm'}-${hit.osm_id ?? `${lat},${lng}`}`),
    label: hit.display_name,
    lat,
    lng,
    address,
    city,
  }
}

export function addressFromNominatim(hit: {
  display_name?: string
  address?: NominatimAddress
}): ReversePlace {
  const a = hit.address ?? {}
  const city = a.city || a.town || a.village || a.municipality || ''
  const street = a.road || a.pedestrian || a.footway || a.square
  const line = [street, a.house_number].filter(Boolean).join(' ')
  if (line) return { address: line, city }
  const first =
    (hit.display_name ?? '')
      .split(',')
      .map((s) => s.trim())
      .find(Boolean) ?? ''
  return { address: first === city ? '' : first, city }
}

async function nominatimJson<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(path, `${NOMINATIM}/`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ro',
    },
  })
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`)
  return (await res.json()) as T
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const hits = await nominatimJson<NominatimHit[]>(
    'search',
    {
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      'accept-language': 'ro',
      countrycodes: 'ro',
      viewbox: TIMISOARA_VIEWBOX,
      dedupe: '1',
    },
    signal,
  )
  if (!Array.isArray(hits)) return []
  return hits.map(placeFromNominatim).filter((p): p is PlaceSuggestion => p != null)
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReversePlace | null> {
  const hit = await nominatimJson<NominatimHit & { error?: string }>(
    'reverse',
    {
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'ro',
    },
    signal,
  )
  if (!hit || hit.error || hit.lat == null) return null
  return addressFromNominatim(hit)
}
