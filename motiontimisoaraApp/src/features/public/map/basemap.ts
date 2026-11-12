import { useThemePreference } from '@/lib/theme/use-theme'
import type { ResolvedTheme } from '@/lib/theme/theme-preference'

export function cartoTileUrl(
  key: string | undefined,
  theme: ResolvedTheme = 'light',
): string | null {
  const value = key?.trim()
  const style = theme === 'dark' ? 'dark_all' : 'voyager'
  return value
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(value)}`
    : null
}

export function useBasemapTheme(): ResolvedTheme {
  return useThemePreference().resolved
}

export const openStreetMapTileClassName = 'mt-basemap-osm'

export const basemapAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

export const openStreetMapTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const openStreetMapAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
