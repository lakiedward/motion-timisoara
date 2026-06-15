import { useQuery } from '@tanstack/react-query'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

import { getLocations } from '@/api/public'

// Fix Leaflet's default marker asset paths under a bundler.
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

export default function MapPage() {
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: getLocations })
  const withCoords = locations.filter((l) => l.lat != null && l.lng != null)

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <span className="eyebrow mb-3">Locații</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Hartă</h1>
          <p className="text-muted-foreground mt-2">Unde ne antrenăm în Timișoara.</p>
        </div>
      </section>
      <div className="h-[70vh] w-full">
        <MapContainer
          center={[45.756, 21.229]}
          zoom={12}
          scrollWheelZoom
          className="size-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {withCoords.map((l) => (
            <Marker key={l.id} position={[l.lat as number, l.lng as number]}>
              <Popup>
                <strong>{l.name}</strong>
                <br />
                {l.address ? `${l.address}, ` : ''}
                {l.city}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
