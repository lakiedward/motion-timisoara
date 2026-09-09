import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type L from 'leaflet'
import { Button } from '@/components/ui/button'
import type { ActivityListItem, CourseListItem } from '@/api/public'
import type { TabaraDinLista } from '@/api/camps'
import { Tent } from 'lucide-react'
import type { Loc } from '@/lib/locuri'
import { campMarkerIcon, markerIcon } from '@/lib/map-marker'
import FocusLocation from './FocusLocation'
import LocationPopup from './LocationPopup'
import { basemapAttribution, cartoTileUrl } from './basemap'

export default function LocationMap({
  locations,
  courses,
  activities,
  camps,
  focusId,
}: {
  locations: Loc[]
  courses: CourseListItem[]
  activities: ActivityListItem[]
  camps: TabaraDinLista[]
  focusId: string | null
}) {
  const tileUrl = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'error'>(
    tileUrl ? 'loading' : 'error',
  )
  const [attempt, setAttempt] = useState(0)
  const [onlyCamps, setOnlyCamps] = useState(false)
  const places = useMemo(
    () =>
      locations.map((location) => {
        const ids = new Set(location.randuri.map((row) => row.id))
        return {
          location,
          courses: courses.filter((course) => course.location_id && ids.has(course.location_id)),
          activities: activities.filter(
            (activity) => activity.location_id && ids.has(activity.location_id),
          ),
          camps: camps.filter(
            (camp) => camp.location && camp.location_id && ids.has(camp.location_id),
          ),
        }
      }),
    [locations, courses, activities, camps],
  )
  const visiblePlaces = useMemo(
    () => places.filter((place) => !onlyCamps || place.camps.length > 0),
    [places, onlyCamps],
  )
  const visibleLocations = useMemo(
    () => visiblePlaces.map((place) => place.location),
    [visiblePlaces],
  )
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
      <div className="flex flex-col lg:flex-row">
        <aside
          aria-label="Filtre hartă"
          className="border-border space-y-3 border-b p-6 lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0"
        >
          <p className="font-display text-foreground font-bold">Pe hartă</p>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            <Button
              className="min-h-11"
              variant={onlyCamps ? 'outline' : 'default'}
              aria-pressed={!onlyCamps}
              onClick={() => setOnlyCamps(false)}
            >
              Toate locațiile
            </Button>
            <Button
              className="min-h-11"
              variant={onlyCamps ? 'default' : 'outline'}
              aria-pressed={onlyCamps}
              onClick={() => setOnlyCamps(true)}
            >
              <Tent aria-hidden="true" className="size-4" />
              Tabere
            </Button>
          </div>
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <Tent
              aria-hidden="true"
              className="bg-highlight text-highlight-foreground size-6 shrink-0 rounded-md p-1"
            />
            Cortul marchează locurile cu tabere active.
          </p>
          {onlyCamps && visiblePlaces.length === 0 && (
            <p role="status" className="text-muted-foreground text-sm">
              Momentan nu există tabere cu locație pe hartă.
            </p>
          )}
        </aside>
        <div className="mt-public-map isolate h-[70vh] w-full min-w-0 lg:flex-1">
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
            <FocusLocation locationId={focusId} locations={visibleLocations} markers={markers} />
            {visiblePlaces.map(
              ({
                location,
                courses: placeCourses,
                activities: placeActivities,
                camps: placeCamps,
              }) => {
                return (
                  <Marker
                    key={location.cheie}
                    position={[location.lat, location.lng]}
                    icon={placeCamps.length ? campMarkerIcon : markerIcon}
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
                        courses={placeCourses}
                        activities={placeActivities}
                        camps={placeCamps}
                      />
                    </Popup>
                  </Marker>
                )
              },
            )}
          </MapContainer>
        </div>
      </div>
    </>
  )
}
