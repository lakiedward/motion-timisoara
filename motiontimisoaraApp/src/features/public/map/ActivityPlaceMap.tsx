import { ExternalLink } from 'lucide-react'

import { linkHartaLoc } from '@/features/public/map/map-link'
import { platform } from '@/lib/platform'
import StaticPlaceMap from './StaticPlaceMap'

export default function ActivityPlaceMap({
  lat,
  lng,
  name,
  address,
}: {
  lat: number
  lng: number
  name: string
  address?: string | null
}) {
  const link = linkHartaLoc(lat, lng, name, platform())

  return (
    <section className="mt-8">
      <h2 className="font-display mb-3 text-lg font-bold">Locație</h2>
      <p className="text-foreground font-medium">{name}</p>
      {address?.trim() && <p className="text-muted-foreground text-sm">{address.trim()}</p>}
      <StaticPlaceMap
        lat={lat}
        lng={lng}
        href={link.href}
        target={link.target}
        rel={link.rel}
        className="mt-3"
      />
      <a
        href={link.href}
        target={link.target}
        rel={link.rel}
        aria-label={`Deschide ${name} în hărți`}
        className="group text-primary focus-visible:outline-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold underline-offset-4 group-hover:underline">
          Deschide în hărți
        </span>
      </a>
    </section>
  )
}
