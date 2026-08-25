import { useEffect, useId, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Loader2, Search } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './location-map-picker.css'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

import { reverseGeocode, searchPlaces, type PlaceSuggestion } from '@/api/geocoding'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const markerIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

const TIMISOARA: [number, number] = [45.7489, 21.2087]
const ROMANIA_BOUNDS: L.LatLngBoundsExpression = [
  [43.6, 20.2],
  [48.4, 29.9],
]
const SEARCH_DEBOUNCE_MS = 400
const REVERSE_DEBOUNCE_MS = 400

export type MapPin = { lat: number; lng: number }

export type ResolvedPlace = MapPin & {
  address?: string
  city?: string
}

function SyncMapView({ pin, flyNonce }: { pin: MapPin | null; flyNonce: number }) {
  const map = useMap()
  const fitted = useRef(false)
  const lastNonce = useRef(0)
  useEffect(() => {
    const container = map.getContainer()
    const resize = () => map.invalidateSize()
    if (typeof ResizeObserver === 'undefined' || !container) {
      const t = window.setTimeout(resize, 50)
      return () => window.clearTimeout(t)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    const t = window.setTimeout(resize, 50)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [map])
  useEffect(() => {
    if (!pin) return
    const fromSearch = flyNonce !== lastNonce.current
    const firstPin = !fitted.current
    if (!fromSearch && !firstPin) return
    fitted.current = true
    lastNonce.current = flyNonce
    map.flyTo([pin.lat, pin.lng], fromSearch ? 16 : 15, { duration: 0.55 })
  }, [pin, flyNonce, map])
  return null
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function LocationMapPicker({
  pin,
  onPinChange,
  error,
}: {
  pin: MapPin | null
  onPinChange: (place: ResolvedPlace) => void
  error?: string
}) {
  const listId = useId()
  const inputId = useId()
  const errorId = useId()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [flyNonce, setFlyNonce] = useState(0)
  const reverseGen = useRef(0)
  const reverseTimer = useRef<number | null>(null)
  const reverseAbort = useRef<AbortController | null>(null)
  const canSearch = query.trim().length >= 2

  useEffect(() => {
    if (!canSearch) return
    const q = query.trim()
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('loading')
      void searchPlaces(q, ctrl.signal)
        .then((hits) => {
          if (ctrl.signal.aborted) return
          setSuggestions(hits)
          setStatus('done')
          setOpen(true)
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setSuggestions([])
          setStatus('error')
          setOpen(true)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [canSearch, query])

  useEffect(() => {
    return () => {
      if (reverseTimer.current != null) window.clearTimeout(reverseTimer.current)
      reverseAbort.current?.abort()
    }
  }, [])

  const applySuggestion = (place: PlaceSuggestion) => {
    reverseGen.current += 1
    reverseAbort.current?.abort()
    setQuery(place.label)
    setSuggestions([])
    setOpen(false)
    setStatus('idle')
    setFlyNonce((n) => n + 1)
    onPinChange({
      lat: place.lat,
      lng: place.lng,
      address: place.address || undefined,
      city: place.city || undefined,
    })
  }

  const requestReverse = (lat: number, lng: number) => {
    const gen = ++reverseGen.current
    if (reverseTimer.current != null) window.clearTimeout(reverseTimer.current)
    reverseTimer.current = window.setTimeout(() => {
      reverseAbort.current?.abort()
      const ctrl = new AbortController()
      reverseAbort.current = ctrl
      void reverseGeocode(lat, lng, ctrl.signal)
        .then((place) => {
          if (gen !== reverseGen.current) return
          onPinChange({
            lat,
            lng,
            address: place?.address || undefined,
            city: place?.city || undefined,
          })
        })
        .catch(() => {
          /* Pin is already stored; address stays as the user left it. */
        })
    }, REVERSE_DEBOUNCE_MS)
  }

  const onMapPick = (lat: number, lng: number) => {
    setOpen(false)
    onPinChange({ lat, lng })
    requestReverse(lat, lng)
  }

  const showList = open && canSearch && status !== 'idle'
  const listSuggestions = canSearch ? suggestions : []

  return (
    <div className="location-map-picker min-w-0 max-w-full space-y-1.5">
      <Label htmlFor={inputId}>Caută locul</Label>
      <div className="relative min-w-0">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          placeholder="Adresă, loc, oraș…"
          className="pl-9"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (listSuggestions[0]) applySuggestion(listSuggestions[0])
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        {status === 'loading' && canSearch && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="bg-popover text-popover-foreground absolute z-[1100] mt-1 max-h-56 w-full overflow-auto rounded-md border py-1 shadow-md"
          >
            {status === 'error' && (
              <li className="text-muted-foreground px-3 py-2 text-sm">
                Nu am putut căuta locul. Poți pune pinul pe hartă.
              </li>
            )}
            {status === 'done' && listSuggestions.length === 0 && (
              <li className="text-muted-foreground px-3 py-2 text-sm">Niciun loc găsit.</li>
            )}
            {listSuggestions.map((s) => (
              <li key={s.id} role="option">
                <button
                  type="button"
                  className="hover:bg-accent hover:text-accent-foreground w-full truncate px-3 py-2 text-left text-sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-muted-foreground text-xs">Alege o sugestie sau pune pinul pe hartă.</p>

      <div
        data-testid="location-map"
        className="ring-border relative h-64 min-w-0 overflow-hidden rounded-xl ring-1 sm:h-72 lg:h-80"
      >
        <MapContainer
          center={TIMISOARA}
          zoom={12}
          className="size-full"
          scrollWheelZoom
          maxBounds={ROMANIA_BOUNDS}
          maxBoundsViscosity={0.7}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap &copy; CARTO"
          />
          <SyncMapView pin={pin} flyNonce={flyNonce} />
          <MapClickHandler onPick={onMapPick} />
          {pin && (
            <Marker
              position={[pin.lat, pin.lng]}
              draggable
              icon={markerIcon}
              eventHandlers={{
                dragend: (e) => {
                  const pos = (e.target as L.Marker).getLatLng()
                  onMapPick(pos.lat, pos.lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
