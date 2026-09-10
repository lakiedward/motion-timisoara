import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import type { LocationResponse } from '@/api/live-location'
import { Button } from '@/components/ui/button'
import { markerIcon } from '@/lib/map-marker'
import { basemapAttribution, cartoTileUrl } from '@/features/public/map/basemap'
import 'leaflet/dist/leaflet.css'

type Point = NonNullable<LocationResponse['location']>

function CenterPosition({ point }: { point: Point }) {
  const map = useMap()
  useEffect(() => {
    map.setView([point.latitude, point.longitude], map.getZoom())
  }, [map, point.latitude, point.longitude])
  return null
}

export function LiveLocationMap({ point }: { point: Point }) {
  const url = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (!url || failed)
    return (
      <div role="alert" className="bg-muted space-y-3 rounded-xl p-4 text-sm">
        <p>Harta nu este disponibilă momentan. Nu afișăm o poziție pe un fundal incomplet.</p>
        {url && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            Reîncearcă harta
          </Button>
        )}
      </div>
    )
  return (
    <div
      className="relative z-0 h-64 overflow-hidden rounded-xl"
      aria-label="Harta locației antrenorului"
    >
      <MapContainer
        key={attempt}
        center={[point.latitude, point.longitude]}
        zoom={16}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          url={url}
          attribution={basemapAttribution}
          eventHandlers={{ tileerror: () => setFailed(true) }}
        />
        <Marker
          position={[point.latitude, point.longitude]}
          icon={markerIcon}
          title="Poziția antrenorului"
        />
        <CenterPosition point={point} />
      </MapContainer>
    </div>
  )
}
