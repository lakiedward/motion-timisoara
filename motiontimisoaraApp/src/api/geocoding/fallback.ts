import { supabase } from '@/lib/supabase'
import { countyForCity, normalizeCounty } from '@/lib/geography/romanian-places'
import type { GeoPlace } from '../geocoding'
import { withGeocodingDeadline } from './request'

export async function reverseFallback(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<GeoPlace | null> {
  return withGeocodingDeadline(
    async (requestSignal) => {
      const { data, error } = await supabase.functions.invoke('location-reverse', {
        body: { lat, lng },
        signal: requestSignal,
      })
      if (error) throw new Error('Address lookup unavailable')
      if (data?.place === null) return null
      const place: unknown = data?.place
      if (!place || typeof place !== 'object') throw new Error('Invalid address response')
      const fields = place as Record<string, unknown>
      for (const field of ['address', 'city', 'county']) {
        if (fields[field] !== null && typeof fields[field] !== 'string') {
          throw new Error('Invalid address response')
        }
      }
      const address = fields.address as string | null
      const city = fields.city as string | null
      const county =
        normalizeCounty(fields.county as string | null) ??
        (fields.county as string | null) ??
        countyForCity(city)
      return {
        id: `reverse-${lat}-${lng}`,
        label: address ?? city ?? 'Punct pe hartă',
        detail: [city, county].filter(Boolean).join(', '),
        address,
        city,
        county,
        lat,
        lng,
      }
    },
    5000,
    signal,
  )
}
