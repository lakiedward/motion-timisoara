import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { markerIcon } from '@/lib/map-marker'
import {
  basemapAttribution,
  cartoTileUrl,
  openStreetMapAttribution,
  openStreetMapTileUrl,
} from './basemap'

export default function ClubLocationMap({
  lat,
  lng,
  label,
}: {
  lat: number
  lng: number
  label: string
}) {
  const carto = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  return (
    <div
      role="img"
      aria-label={`Hartă cu sediul clubului: ${label}`}
      className="h-48 w-full overflow-hidden rounded-2xl border"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        dragging={false}
        className="size-full"
      >
        <TileLayer
          url={carto ?? openStreetMapTileUrl}
          attribution={carto ? basemapAttribution : openStreetMapAttribution}
        />
        <Marker position={[lat, lng]} icon={markerIcon} keyboard={false} />
      </MapContainer>
    </div>
  )
}
