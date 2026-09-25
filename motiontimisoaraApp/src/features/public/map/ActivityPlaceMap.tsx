import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

import { cartoTileUrl, openStreetMapTileUrl } from '@/features/public/map/basemap'
import { linkHartaLoc } from '@/features/public/map/map-link'
import { platform } from '@/lib/platform'

const ZOOM = 15
const TILE = 256

function proiectie(lat: number, lng: number) {
  const n = 2 ** ZOOM
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

function adresaDalei(x: number, y: number) {
  const carto = cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY)
  if (!carto)
    return openStreetMapTileUrl
      .replace('{z}', String(ZOOM))
      .replace('{x}', String(x))
      .replace('{y}', String(y))
  const s = 'abcd'[Math.abs(x + y) % 4]
  return carto
    .replace('{s}', s)
    .replace('{z}', String(ZOOM))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', '')
}

export default function ActivityPlaceMap({
  lat,
  lng,
  name,
}: {
  lat: number
  lng: number
  name: string
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [size, setSize] = useState({ w: 768, h: TILE })
  const link = linkHartaLoc(lat, lng, name, platform())
  const carto = Boolean(cartoTileUrl(import.meta.env.VITE_CARTO_BASEMAP_API_KEY))

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const masoara = () => {
      if (el.clientWidth > 0) setSize({ w: el.clientWidth, h: el.clientHeight || TILE })
    }
    masoara()
    const obs = new ResizeObserver(masoara)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const world = proiectie(lat, lng)
  const originX = world.x * TILE - size.w / 2
  const originY = world.y * TILE - size.h / 2
  const dale: { x: number; y: number; left: number; top: number }[] = []
  for (let x = Math.floor(originX / TILE); x <= Math.floor((originX + size.w) / TILE); x += 1) {
    for (let y = Math.floor(originY / TILE); y <= Math.floor((originY + size.h) / TILE); y += 1) {
      dale.push({ x, y, left: x * TILE - originX, top: y * TILE - originY })
    }
  }

  return (
    <a
      ref={ref}
      href={link.href}
      target={link.target}
      rel={link.rel}
      aria-label={`Deschide ${name} în hărți`}
      className="focus-visible:ring-ring/50 relative mt-8 block h-64 w-full cursor-pointer overflow-hidden rounded-3xl outline-none focus-visible:ring-[3px]"
    >
      <span className="absolute inset-0" aria-hidden="true">
        {dale.map((dala) => (
          <img
            key={`${dala.x}-${dala.y}`}
            src={adresaDalei(dala.x, dala.y)}
            alt=""
            width={TILE}
            height={TILE}
            className="absolute max-w-none"
            style={{ left: dala.left, top: dala.top }}
          />
        ))}
        <MapPin className="text-primary absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-full" />
      </span>
      <span className="bg-card/90 text-muted-foreground absolute right-2 bottom-2 rounded-md px-2 py-1 text-xs">
        {carto ? '© OpenStreetMap © CARTO' : '© OpenStreetMap'}
      </span>
    </a>
  )
}
