import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type L from 'leaflet'
import { Button } from '@/components/ui/button'
import type { ActivityListItem, CourseListItem } from '@/api/public'
import type { Loc } from '@/lib/locuri'
import { markerIcon } from '@/lib/map-marker'
import FocusLocation from './FocusLocation'
import LocationPopup from './LocationPopup'
import { basemapAttribution, cartoTileUrl } from './basemap'

export default function LocationMap({
  locations,
  courses,
  activities,
  focusId,
}: {
  locations: Loc[]
  courses: CourseListItem[]
  activities: ActivityListItem[]
  focusId: string | null
}) {
  const tileUrl = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'error'>(
    tileUrl ? 'loading' : 'error',
  )
  const [attempt, setAttempt] = useState(0)
  const markers = useRef(new Map<string, L.Marker>())
  const tileEvents = useMemo(
    () => ({
      tileerror: () => setTileStatus('error'),
      load: () => setTileStatus((current) => (current === 'error' ? current : 'ready')),
    }),
    [],
  )

  useEffect(() => {
    if (tileStatus !== 'loading') return
    const timeout = window.setTimeout(() => setTileStatus('error'), 15_000)
    return () => window.clearTimeout(timeout)
  }, [tileStatus, attempt])

  function retryTiles() {
    if (!tileUrl) {
      window.location.reload()
      return
    }
    setTileStatus('loading')
    setAttempt((current) => current + 1)
  }

  return (
    <>
      {tileStatus === 'loading' && (
        <p role="status" className="text-muted-foreground px-6 py-3 text-sm">
          Se încarcă fundalul hărții…
        </p>
      )}
      {tileStatus === 'error' && (
        <div
          role="alert"
          className="bg-muted flex flex-wrap items-center justify-between gap-3 px-6 py-3"
        >
          <p className="text-foreground text-sm">
            Fundalul hărții nu este disponibil. Locațiile pot fi consultate în continuare.
          </p>
          <Button variant="outline" className="min-h-11" onClick={retryTiles}>
            {tileUrl ? 'Reîncearcă harta' : 'Reîncarcă pagina'}
          </Button>
        </div>
      )}
      <div className="mt-public-map isolate h-[70vh] w-full">
        <MapContainer center={[45.756, 21.229]} zoom={12} scrollWheelZoom className="size-full">
          {tileUrl && (
            <TileLayer
              key={attempt}
              url={tileUrl}
              attribution={basemapAttribution}
              maxZoom={20}
              subdomains="abcd"
              eventHandlers={tileEvents}
            />
          )}
          <FocusLocation locationId={focusId} locations={locations} markers={markers} />
          {locations.map((location) => {
            const ids = new Set(location.randuri.map((row) => row.id))
            return (
              <Marker
                key={location.cheie}
                position={[location.lat, location.lng]}
                icon={markerIcon}
                alt={location.nume}
                title={location.nume}
                ref={(marker) => {
                  if (marker) markers.current.set(location.cheie, marker)
                  else markers.current.delete(location.cheie)
                }}
              >
                <Popup
                  className="mt-popup"
                  minWidth={264}
                  maxWidth={280}
                  autoPanPaddingTopLeft={[64, 16]}
                  autoPanPaddingBottomRight={[16, 16]}
                >
                  <LocationPopup
                    location={location}
                    courses={courses.filter(
                      (course) => course.location_id && ids.has(course.location_id),
                    )}
                    activities={activities.filter(
                      (activity) => activity.location_id && ids.has(activity.location_id),
                    )}
                  />
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </>
  )
}
