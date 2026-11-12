import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LocationPoint } from '@/api/live-location'
import { Button } from '@/components/ui/button'
import { markerIcon } from '@/lib/map-marker'
import { cn } from '@/lib/utils'
import { basemapAttribution, cartoTileUrl } from '@/features/public/map/basemap'
import 'leaflet/dist/leaflet.css'

export type CoachPoint = { key: string; name: string; point: LocationPoint }

function FitPoints({ points }: { points: CoachPoint[] }) {
  const map = useMap()
  const signature = points
    .map((entry) => `${entry.point.latitude},${entry.point.longitude}`)
    .join('|')
  useEffect(() => {
    if (!signature) return
    const coords = signature
      .split('|')
      .map((pair) => pair.split(',').map(Number) as [number, number])
    if (coords.length === 1) map.setView(coords[0], map.getZoom())
    else map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], maxZoom: 16 })
  }, [map, signature])
  return null
}

export function CoachesMap({ points, className }: { points: CoachPoint[]; className?: string }) {
  const url = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (!points.length) return null
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
  const first = points[0].point
  return (
    <div
      className={cn('relative z-0 h-72 overflow-hidden rounded-xl sm:h-96', className)}
      aria-label="Harta locației antrenorului"
    >
      <MapContainer
        key={attempt}
        center={[first.latitude, first.longitude]}
        zoom={16}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          url={url}
          attribution={basemapAttribution}
          eventHandlers={{ tileerror: () => setFailed(true) }}
        />
        {points.map((entry) => (
          <Marker
            key={entry.key}
            position={[entry.point.latitude, entry.point.longitude]}
            icon={markerIcon}
            title="Poziția antrenorului"
          >
            <Tooltip permanent direction="top" offset={[0, -36]}>
              {entry.name}
            </Tooltip>
          </Marker>
        ))}
        <FitPoints points={points} />
      </MapContainer>
    </div>
  )
}
