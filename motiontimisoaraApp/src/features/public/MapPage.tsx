import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { ChevronRight, MapPin } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './map-popup.css'
import type L from 'leaflet'

import { getActivities, getCourses, getLocations } from '@/api/public'
import type { ActivityListItem, CourseListItem } from '@/api/public'
import { markerIcon } from '@/lib/map-marker'
import { grupeazaInLocuri, loculRandului, type Loc } from '@/lib/locuri'
import { plural } from '@/lib/plural'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK, SPORT_ICON } from './sport-icons'

type LocationContent = { courses: CourseListItem[]; activities: ActivityListItem[] }

const dateFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' })

function activityMeta(a: ActivityListItem): string {
  const date = dateFmt.format(new Date(a.activity_date))
  const time = a.start_time ? a.start_time.slice(0, 5) : ''
  return time ? `${date} · ${time}` : date
}

function courseMeta(c: CourseListItem): string {
  if (c.age_from != null && c.age_to != null) return `${c.age_from}–${c.age_to} ani`
  return c.sport?.name ?? 'Curs'
}

/** A single course/activity row inside a popup — sport chip, title, meta, chevron. */
function PopupRow({
  to,
  sportCode,
  title,
  meta,
}: {
  to: string
  sportCode: string | null | undefined
  title: string
  meta: string
}) {
  const color = SPORT_COLOR[sportCode ?? ''] ?? SPORT_COLOR_FALLBACK
  const emoji = SPORT_ICON[sportCode ?? ''] ?? '🎽'
  return (
    <Link
      to={to}
      className="group/item -mx-1.5 flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-accent"
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[15px]"
        style={{ backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[13px] font-semibold">{title}</span>
        <span className="text-muted-foreground block truncate text-[11px]">{meta}</span>
      </span>
      <ChevronRight className="text-muted-foreground group-hover/item:text-primary size-4 shrink-0 transition-all group-hover/item:translate-x-0.5" />
    </Link>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className="text-highlight text-[10px] font-bold uppercase tracking-[0.12em]">{label}</span>
      <span className="bg-accent text-accent-foreground rounded-full px-1.5 py-px text-[10px] font-bold">
        {count}
      </span>
    </div>
  )
}

/** Fly to `?location=` and open that marker's popup once the marker ref exists. */
function FocusLocation({
  locationId,
  locuri,
  markerRefs,
}: {
  locationId: string | null
  locuri: Loc[]
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>
}) {
  const map = useMap()
  const done = useRef<string | null>(null)

  useEffect(() => {
    if (!locationId) return
    if (done.current === locationId) return
    // Linkurile din restul aplicatiei trimit un ID DE RAND, nu de loc. Markerele
    // sunt acum pe locuri, deci se cauta locul care contine randul — altfel
    // fiecare `/harta?location=<id>` s-ar fi rupt tacut.
    const loc = loculRandului(locuri, locationId)
    if (!loc) return

    let cancelled = false
    let attempts = 0
    const tryFocus = () => {
      if (cancelled) return
      const marker = markerRefs.current.get(loc.cheie)
      if (!marker) {
        if (attempts++ < 60) requestAnimationFrame(tryFocus)
        return
      }
      done.current = locationId
      map.flyTo([loc.lat, loc.lng], 15, { duration: 0.8 })
      window.setTimeout(() => {
        if (!cancelled) marker.openPopup()
      }, 850)
    }
    tryFocus()
    return () => {
      cancelled = true
    }
  }, [locationId, locuri, map, markerRefs])

  return null
}

export default function MapPage() {
  const [params] = useSearchParams()
  const focusId = params.get('location')

  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: getLocations })
  const { data: courses = [] } = useQuery({ queryKey: ['courses'], queryFn: () => getCourses() })
  const { data: activities = [] } = useQuery({ queryKey: ['activities'], queryFn: getActivities })

  const markerRefs = useRef(new Map<string, L.Marker>())

  // Group the active courses and activities by the location they're held at, so
  // each marker's popup can list what happens there.
  const byLocation = useMemo(() => {
    const map = new Map<string, LocationContent>()
    const entry = (id: string) => {
      let e = map.get(id)
      if (!e) {
        e = { courses: [], activities: [] }
        map.set(id, e)
      }
      return e
    }
    for (const c of courses) if (c.location_id) entry(c.location_id).courses.push(c)
    for (const a of activities) if (a.location_id) entry(a.location_id).activities.push(a)
    return map
  }, [courses, activities])

  // Numarul de cursuri pe fiecare RAND departajeaza numele locului cand doua
  // cluburi scriu aceeasi cladire diferit.
  const cursuriPeRand = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of courses) {
      if (c.location_id) m.set(c.location_id, (m.get(c.location_id) ?? 0) + 1)
    }
    return m
  }, [courses])

  const locuri = useMemo(
    () => grupeazaInLocuri(locations, cursuriPeRand),
    [locations, cursuriPeRand],
  )

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <span className="eyebrow mb-3">Locații</span>
          <h1 className="font-display text-foreground text-4xl font-extrabold">Hartă</h1>
          <p className="text-muted-foreground mt-2">Unde ne antrenăm în Timișoara.</p>
        </div>
      </section>
      <div className="h-[70vh] w-full">
        <MapContainer center={[45.756, 21.229]} zoom={12} scrollWheelZoom className="size-full">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <FocusLocation locationId={focusId} locuri={locuri} markerRefs={markerRefs} />
          {locuri.map((loc) => {
            // Continutul locului = tot ce se intampla la oricare din randurile lui.
            const cursuriLoc = loc.randuri.flatMap((r) => byLocation.get(r.id)?.courses ?? [])
            const activitatiLoc = loc.randuri.flatMap((r) => byLocation.get(r.id)?.activities ?? [])
            const hasCourses = cursuriLoc.length > 0
            const hasActivities = activitatiLoc.length > 0
            return (
              <Marker
                key={loc.cheie}
                position={[loc.lat, loc.lng]}
                icon={markerIcon}
                ref={(ref) => {
                  if (ref) markerRefs.current.set(loc.cheie, ref)
                  else markerRefs.current.delete(loc.cheie)
                }}
              >
                <Popup className="mt-popup" minWidth={264} maxWidth={280}>
                  {/* Brand-gradient header: pin chip + location name & address. */}
                  <div className="from-primary to-sky bg-gradient-to-br px-3.5 py-3">
                    <div className="flex items-start gap-2.5 pr-6">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                        <MapPin className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display truncate text-[15px] font-extrabold leading-tight text-white">
                          {loc.nume}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] leading-snug text-white/85">
                          {loc.address ? `${loc.address}, ` : ''}
                          {loc.city}
                        </p>
                        {/* Se scrie doar cand chiar sunt mai multe: un singur club
                            n-are de ce sa se anunte pe harta orasului. */}
                        {loc.cluburi > 1 && (
                          <p className="mt-0.5 text-[11px] leading-snug text-white/85">
                            {plural(loc.cluburi, 'club se antrenează aici', 'cluburi se antrenează aici')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    {hasCourses && (
                      <div>
                        <SectionLabel label="Cursuri" count={cursuriLoc.length} />
                        <div className="space-y-0.5">
                          {cursuriLoc.map((c) => (
                            <PopupRow
                              key={c.id}
                              to={`/cursuri/${c.id}`}
                              sportCode={c.sport?.code}
                              title={c.name}
                              meta={courseMeta(c)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {hasActivities && (
                      <div className={hasCourses ? 'border-border border-t pt-3' : undefined}>
                        <SectionLabel label="Activități" count={activitatiLoc.length} />
                        <div className="space-y-0.5">
                          {activitatiLoc.map((a) => (
                            <PopupRow
                              key={a.id}
                              to={`/activitati/${a.id}`}
                              sportCode={a.sport?.code}
                              title={a.name}
                              meta={activityMeta(a)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasCourses && !hasActivities && (
                      <p className="text-muted-foreground text-[12px] italic">
                        Momentan fără cursuri sau activități la această locație.
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
