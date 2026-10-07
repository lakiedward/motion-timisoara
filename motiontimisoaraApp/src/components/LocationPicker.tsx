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
import { Button } from '@/components/ui/button'
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
  county?: string | null
  resolved: boolean
}

type Props = {
  value: { lat: number; lng: number } | null
  onChange: (punct: PickedPoint) => void
  address: string
  onAddressChange: (address: string) => void
  city?: string
  county?: string
  onResolvingChange?: (resolving: boolean) => void
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

export default function LocationPicker({
  value,
  onChange,
  address,
  onAddressChange,
  city,
  county,
  onResolvingChange,
  invalid,
  errorId,
}: Props) {
  const carto = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  const [cautareAmanata, setCautareAmanata] = useState('')
  const [listaDeschisa, setListaDeschisa] = useState(false)
  const [indexActiv, setIndexActiv] = useState(-1)
  const [seRezolvaPunctul, setSeRezolvaPunctul] = useState(false)
  const [pointError, setPointError] = useState(false)
  const [missingAddress, setMissingAddress] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setCautareAmanata(address), 300)
    return () => window.clearTimeout(t)
  }, [address])

  const {
    data: searchResults = [],
    isFetching,
    isError: searchError,
    refetch: retrySearch,
  } = useQuery({
    queryKey: ['geocode', cautareAmanata, city, county],
    queryFn: ({ signal }) => geocoding.search(cautareAmanata, signal, { city, county }),
    enabled: listaDeschisa && cautareAmanata.trim().length >= 3,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const sugestii = cautareAmanata === address ? searchResults : []

  const numarPunct = useRef(0)
  const anulare = useRef<AbortController | null>(null)

  const incepePunctNou = () => {
    anulare.current?.abort()
    anulare.current = null
    return ++numarPunct.current
  }

  useEffect(
    () => () => {
      anulare.current?.abort()
      onResolvingChange?.(false)
    },
    [onResolvingChange],
  )

  const setResolving = (resolving: boolean) => {
    setSeRezolvaPunctul(resolving)
    onResolvingChange?.(resolving)
  }

  const alegeSugestia = (loc: GeoPlace) => {
    incepePunctNou()
    setResolving(false)
    setPointError(false)
    setMissingAddress(!loc.address)
    setListaDeschisa(false)
    setIndexActiv(-1)
    onChange({
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address,
      city: loc.city,
      county: loc.county,
      resolved: true,
    })
  }

  const punePunctul = async (lat: number, lng: number) => {
    const alMeu = incepePunctNou()
    const ctrl = new AbortController()
    anulare.current = ctrl
    setListaDeschisa(false)
    setPointError(false)
    setMissingAddress(false)
    onChange({ lat, lng, address: null, city: null, county: null, resolved: false })
    setResolving(true)
    try {
      const loc = await geocoding.reverse(lat, lng, ctrl.signal)
      if (alMeu !== numarPunct.current || ctrl.signal.aborted) return
      onChange({
        lat,
        lng,
        address: loc?.address ?? null,
        city: loc?.city ?? null,
        county: loc?.county ?? null,
        resolved: true,
      })
      setMissingAddress(!loc?.address)
    } catch {
      if (alMeu === numarPunct.current && !ctrl.signal.aborted) setPointError(true)
    } finally {
      if (alMeu === numarPunct.current) setResolving(false)
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
      <Label htmlFor="address">Adresă</Label>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id="address"
          type="search"
          autoComplete="off"
          className="h-11 pl-9 lg:h-9"
          placeholder="Strada, numărul sau numele locului"
          value={address}
          onChange={(e) => {
            incepePunctNou()
            setResolving(false)
            setPointError(false)
            setMissingAddress(false)
            onAddressChange(e.target.value)
            setListaDeschisa(true)
            setIndexActiv(-1)
          }}
          onFocus={() => setListaDeschisa(true)}
          onBlur={() => setListaDeschisa(false)}
          onKeyDown={laTasta}
          role="combobox"
          aria-expanded={listaDeschisa && sugestii.length > 0}
          aria-controls="sugestii-adresa"
          aria-autocomplete="list"
          aria-activedescendant={
            listaDeschisa && indexActiv >= 0 ? `adresa-option-${indexActiv}` : undefined
          }
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
            className="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-md"
            onMouseDown={(e) => e.preventDefault()}
          >
            {sugestii.map((loc, i) => (
              <li key={loc.id}>
                <button
                  type="button"
                  role="option"
                  id={`adresa-option-${i}`}
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
        Caută adresa sau pune punctul pe hartă. Județul, orașul și adresa se completează automat.
      </p>
      {listaDeschisa &&
        cautareAmanata.trim().length >= 3 &&
        !isFetching &&
        sugestii.length === 0 &&
        !searchError && (
          <p role="status" className="text-muted-foreground text-xs">
            Nu am găsit adresa. Poți pune punctul pe hartă.
          </p>
        )}
      {listaDeschisa && searchError && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-xs">Nu am putut căuta adresa.</p>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void retrySearch()}
          >
            Reîncearcă
          </Button>
        </div>
      )}

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
      {pointError && value && (
        <div role="alert" className="space-y-2">
          <p className="text-destructive text-xs">
            Nu am putut afla adresa punctului. Reîncearcă sau completează câmpurile de mai sus.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void punePunctul(value.lat, value.lng)}
          >
            Reîncearcă
          </Button>
        </div>
      )}
      {missingAddress && (
        <p role="status" className="text-muted-foreground text-xs">
          Punctul este ales. Nu am găsit strada; completează adresa mai sus.
        </p>
      )}
    </div>
  )
}
