import { ExternalLink } from 'lucide-react'

import { platform } from '@/lib/platform'
import { linkHartaLoc } from './map-link'
import StaticPlaceMap from './StaticPlaceMap'

export default function ClubLocationMap({
  lat,
  lng,
  label,
  className,
}: {
  lat: number
  lng: number
  label: string
  className?: string
}) {
  const link = linkHartaLoc(lat, lng, label, platform())
  return (
    <div className={className}>
      <div role="img" aria-label={`Hartă cu sediul clubului: ${label}`}>
        <StaticPlaceMap
          lat={lat}
          lng={lng}
          href={link.href}
          target={link.target}
          rel={link.rel}
          className="h-48 rounded-xl"
        />
      </div>
      <a
        href={link.href}
        target={link.target}
        rel={link.rel}
        aria-label={`Deschide sediul clubului în hărți: ${label}`}
        className="group text-primary focus-visible:outline-ring mt-2 inline-flex min-h-touch-target items-center gap-2 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold underline-offset-4 group-hover:underline">
          Deschide în hărți
        </span>
      </a>
    </div>
  )
}
