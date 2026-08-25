import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MapPin, Search } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './location-picker.css'
import type L from 'leaflet'

import { geocoding, type GeoPlace } from '@/api/geocoding'
import { markerIcon } from '@/lib/map-marker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Centrul hartii cand locatia inca nu are punct: Timisoara. */
const CENTRU_IMPLICIT: [number, number] = [45.7489, 21.2087]
const ZOOM_ORAS = 13
const ZOOM_PUNCT = 16

export type PickedPoint = {
  lat: number
  lng: number
  /** Adresa aflata pentru punct; null cand furnizorul nu stie strada. */
  address: string | null
  /** Orasul aflat pentru punct; null cand furnizorul nu il stie. */
  city: string | null
}

type Props = {
  /** Punctul curent, sau null cat timp locatia nu are unul. */
  value: { lat: number; lng: number } | null
  onChange: (punct: PickedPoint) => void
  /** Marcheaza campul de cautare ca invalid si il leaga de mesajul de eroare. */
  invalid?: boolean
  errorId?: string
}

/**
 * Muta harta pe punctul curent si ii recalculeaza dimensiunea dupa montare.
 * `center` de pe MapContainer se aplica o singura data, la initializare, deci
 * saritura dupa alegerea unei sugestii se face de aici. `invalidateSize` acopera
 * cazul in care harta s-a montat inainte ca layout-ul sa-i dea inaltimea finala,
 * situatie in care Leaflet deseneaza doar o parte din placi.
 */
function UrmarestePunctul({ point }: { point: { lat: number; lng: number } | null }) {
  const map = useMap()
  const anterior = useRef<string | null>(null)

  useEffect(() => {
    map.invalidateSize()
  }, [map])

  useEffect(() => {
    if (!point) return
    const cheie = `${point.lat},${point.lng}`
    if (anterior.current === cheie) return
    anterior.current = cheie
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), ZOOM_PUNCT))
  }, [map, point])

  return null
}

/** Apasarea pe harta pune punctul acolo. */
function AsculaApasarea({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function LocationPicker({ value, onChange, invalid, errorId }: Props) {
  const [cautare, setCautare] = useState('')
  const [cautareAmanata, setCautareAmanata] = useState('')
  const [listaDeschisa, setListaDeschisa] = useState(false)
  const [indexActiv, setIndexActiv] = useState(-1)
  const [seRezolvaPunctul, setSeRezolvaPunctul] = useState(false)

  // Cererile pleaca la 300 ms dupa ultima tasta, nu la fiecare litera: politica
  // Photon cere sa fim „fair", iar react-query tine raspunsul in cache o zi, deci
  // stergerea catorva litere nu mai intreaba serverul inca o data.
  useEffect(() => {
    const t = window.setTimeout(() => setCautareAmanata(cautare), 300)
    return () => window.clearTimeout(t)
  }, [cautare])

  const { data: sugestii = [], isFetching } = useQuery({
    queryKey: ['geocode', cautareAmanata],
    queryFn: ({ signal }) => geocoding.search(cautareAmanata, signal),
    enabled: cautareAmanata.trim().length >= 3,
    staleTime: 24 * 60 * 60 * 1000,
  })

  const alegeSugestia = (loc: GeoPlace) => {
    setCautare(loc.label)
    setListaDeschisa(false)
    setIndexActiv(-1)
    onChange({ lat: loc.lat, lng: loc.lng, address: loc.address, city: loc.city })
  }

  /**
   * Punctul mutat cu mana pe harta: coordonatele sunt sigure imediat, adresa se
   * afla dupa. Daca reverse geocoding-ul nu gaseste nimic, adresa si orasul
   * raman ce erau — a le sterge ar arunca textul scris de utilizator pentru un
   * loc pe care oricum nu stim sa-l numim.
   */
  const punePunctul = async (lat: number, lng: number) => {
    onChange({ lat, lng, address: null, city: null })
    setSeRezolvaPunctul(true)
    try {
      const loc = await geocoding.reverse(lat, lng)
      if (loc) onChange({ lat, lng, address: loc.address, city: loc.city })
    } catch {
      // Fara adresa, dar cu punctul pus: destul cat sa se poata salva.
    } finally {
      setSeRezolvaPunctul(false)
    }
  }

  const laTasta = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listaDeschisa || sugestii.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndexActiv((i) => (i + 1) % sugestii.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndexActiv((i) => (i <= 0 ? sugestii.length - 1 : i - 1))
    } else if (e.key === 'Enter' && indexActiv >= 0) {
      e.preventDefault()
      alegeSugestia(sugestii[indexActiv])
    } else if (e.key === 'Escape') {
      setListaDeschisa(false)
      setIndexActiv(-1)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="cautare-adresa">Caută adresa</Label>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id="cautare-adresa"
          type="search"
          autoComplete="off"
          className="h-11 pl-9 lg:h-9"
          placeholder="Strada, numărul sau numele locului"
          value={cautare}
          onChange={(e) => {
            setCautare(e.target.value)
            setListaDeschisa(true)
            setIndexActiv(-1)
          }}
          onFocus={() => setListaDeschisa(true)}
          onBlur={() => setListaDeschisa(false)}
          onKeyDown={laTasta}
          role="combobox"
          aria-expanded={listaDeschisa && sugestii.length > 0}
          aria-controls="sugestii-adresa"
          aria-invalid={invalid}
          aria-describedby={errorId}
        />
        {isFetching && (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        )}

        {listaDeschisa && sugestii.length > 0 && (
          <ul
            id="sugestii-adresa"
            role="listbox"
            // Peste harta: panourile Leaflet urca pana la z-index 700, iar
            // controalele pana la 1000.
            className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-[1100] mt-1 overflow-hidden rounded-md border shadow-md"
            // Blur-ul campului s-ar declansa inaintea click-ului si ar inchide
            // lista exact cand utilizatorul apasa pe ea.
            onMouseDown={(e) => e.preventDefault()}
          >
            {sugestii.map((loc, i) => (
              <li key={loc.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === indexActiv}
                  onClick={() => alegeSugestia(loc)}
                  onMouseEnter={() => setIndexActiv(i)}
                  className={`flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${
                    i === indexActiv ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <MapPin className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{loc.label}</span>
                    {loc.detail && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {loc.detail}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Alege din listă sau apasă pe hartă. Pinul poate fi tras pentru ajustare fină.
      </p>

      {/* `mt-location-picker` e cârligul pentru location-picker.css, care crește
          butoanele de zoom ale Leaflet la 44px pe atingere. */}
      <div className="mt-location-picker h-64 w-full overflow-hidden rounded-md border sm:h-80">
        <MapContainer
          center={value ? [value.lat, value.lng] : CENTRU_IMPLICIT}
          zoom={value ? ZOOM_PUNCT : ZOOM_ORAS}
          scrollWheelZoom={false}
          className="size-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap &copy; CARTO"
          />
          <UrmarestePunctul point={value} />
          <AsculaApasarea onPick={punePunctul} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = (e.target as L.Marker).getLatLng()
                  punePunctul(p.lat, p.lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {seRezolvaPunctul && <p className="text-muted-foreground text-xs">Caut adresa punctului…</p>}
    </div>
  )
}
