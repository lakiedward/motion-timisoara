import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type L from 'leaflet'
import { Button } from '@/components/ui/button'
import type { ActivityListItem, CourseListItem } from '@/api/public'
import type { TabaraDinLista } from '@/api/camps'
import { CalendarRange, GraduationCap, MapPin, Tent } from 'lucide-react'
import type { Loc } from '@/lib/locuri'
import { getOfferMarkerIcon } from '@/lib/map-marker'
import FocusLocation from './FocusLocation'
import LocationPopup from './LocationPopup'
import { basemapAttribution, cartoTileUrl } from './basemap'

const offerFilters = [
  { value: 'all', label: 'Toate', icon: MapPin },
  { value: 'courses', label: 'Cursuri', icon: GraduationCap },
  { value: 'activities', label: 'Activități', icon: CalendarRange },
  { value: 'camps', label: 'Tabere', icon: Tent },
] as const

const emptyOffers = {
  courses: 'Momentan nu există cursuri cu locație pe hartă.',
  activities: 'Momentan nu există activități cu locație pe hartă.',
  camps: 'Momentan nu există tabere cu locație pe hartă.',
}

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
  const [offerType, setOfferType] = useState<(typeof offerFilters)[number]['value']>('all')
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
    () => places.filter((place) => offerType === 'all' || place[offerType].length > 0),
    [places, offerType],
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
            {offerFilters.map((filter) => (
              <Button
                key={filter.value}
                className="min-h-11"
                variant={offerType === filter.value ? 'default' : 'outline'}
                aria-pressed={offerType === filter.value}
                onClick={() => setOfferType(filter.value)}
              >
                <filter.icon aria-hidden="true" className="size-4" />
                {filter.label}
              </Button>
            ))}
          </div>
          <ul
            aria-label="Legenda hărții"
            className="text-muted-foreground flex flex-wrap gap-3 text-sm lg:flex-col"
          >
            {offerFilters
              .filter((filter) => filter.value !== 'all')
              .map((filter) => (
                <li key={filter.value} className="flex items-center gap-2">
                  <filter.icon
                    aria-hidden="true"
                    className={`size-6 shrink-0 rounded-md p-1 ${filter.value === 'camps' ? 'bg-highlight text-highlight-foreground' : 'bg-primary text-primary-foreground'}`}
                  />
                  {filter.label}
                </li>
              ))}
          </ul>
          {offerType !== 'all' && visiblePlaces.length === 0 && (
            <p role="status" className="text-muted-foreground text-sm">
              {emptyOffers[offerType]}
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
                    icon={getOfferMarkerIcon({
                      courses: placeCourses.length > 0,
                      activities: placeActivities.length > 0,
                      camps: placeCamps.length > 0,
                    })}
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
