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
import {
  basemapAttribution,
  cartoTileUrl,
  openStreetMapAttribution,
  openStreetMapTileUrl,
} from '@/features/public/map/basemap'

const CENTRU_IMPLICIT: [number, number] = [45.7489, 21.2087]
const ZOOM_ORAS = 13
const ZOOM_PUNCT = 16

export type PickedPoint = {
  lat: number
  lng: number
  address: string | null
  city: string | null
}

type Props = {
  value: { lat: number; lng: number } | null
  onChange: (punct: PickedPoint) => void
  invalid?: boolean
  errorId?: string
}

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

function AsculaApasarea({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function LocationPicker({ value, onChange, invalid, errorId }: Props) {
  const carto = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const [cautare, setCautare] = useState('')
  const [cautareAmanata, setCautareAmanata] = useState('')
  const [listaDeschisa, setListaDeschisa] = useState(false)
  const [indexActiv, setIndexActiv] = useState(-1)
  const [seRezolvaPunctul, setSeRezolvaPunctul] = useState(false)

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

  const numarPunct = useRef(0)
  const anulare = useRef<AbortController | null>(null)

  const incepePunctNou = () => {
    anulare.current?.abort()
    anulare.current = null
    return ++numarPunct.current
  }

  useEffect(() => () => anulare.current?.abort(), [])

  const alegeSugestia = (loc: GeoPlace) => {
    incepePunctNou()
    setSeRezolvaPunctul(false)
    setCautare(loc.label)
    setListaDeschisa(false)
    setIndexActiv(-1)
    onChange({ lat: loc.lat, lng: loc.lng, address: loc.address, city: loc.city })
  }

  const punePunctul = async (lat: number, lng: number) => {
    const alMeu = incepePunctNou()
    const ctrl = new AbortController()
    anulare.current = ctrl
    onChange({ lat, lng, address: null, city: null })
    setSeRezolvaPunctul(true)
    try {
      const loc = await geocoding.reverse(lat, lng, ctrl.signal)
      if (alMeu !== numarPunct.current) return
      if (loc) onChange({ lat, lng, address: loc.address, city: loc.city })
    } catch {
      return
    } finally {
      if (alMeu === numarPunct.current) setSeRezolvaPunctul(false)
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
            className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-[1100] mt-1 overflow-hidden rounded-md border shadow-md"
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

      <div className="mt-location-picker h-64 w-full overflow-hidden rounded-md border sm:h-80">
        <MapContainer
          center={value ? [value.lat, value.lng] : CENTRU_IMPLICIT}
          zoom={value ? ZOOM_PUNCT : ZOOM_ORAS}
          scrollWheelZoom={false}
          className="size-full"
        >
          <TileLayer
            url={carto ?? openStreetMapTileUrl}
            attribution={carto ? basemapAttribution : openStreetMapAttribution}
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
