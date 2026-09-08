export function cartoTileUrl(key: string | undefined): string | null {
  const value = key?.trim()
  return value
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(value)}`
    : null
}

export const basemapAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
