import type { GeoPlace } from '../geocoding'

export function createReverseCache() {
  const entries = new Map<string, { place: GeoPlace; expires: number }>()
  const key = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`
  return {
    get(lat: number, lng: number) {
      const id = key(lat, lng)
      const entry = entries.get(id)
      if (!entry) return null
      if (entry.expires <= Date.now()) {
        entries.delete(id)
        return null
      }
      return { ...entry.place, lat, lng }
    },
    set(lat: number, lng: number, place: GeoPlace) {
      if (!place.address || !place.city || !place.county) return
      const id = key(lat, lng)
      entries.delete(id)
      entries.set(id, { place: { ...place }, expires: Date.now() + 15 * 60 * 1000 })
      if (entries.size > 128) entries.delete(entries.keys().next().value!)
    },
  }
}
