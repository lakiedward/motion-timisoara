import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import type { CampLocation as CampLocationData } from '@/api/camps'

export default function CampLocation({
  location,
  details,
}: {
  location: CampLocationData | null
  details: string | null
}) {
  if (!location && !details) return null
  const hasCoordinates = location?.lat != null && location.lng != null

  return (
    <div className="flex items-start gap-1.5">
      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {location &&
          (hasCoordinates ? (
            <Link
              to={`/harta?location=${encodeURIComponent(location.id)}`}
              className="text-primary relative z-10 inline-flex min-h-11 items-center rounded-md font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`${location.name} — vezi pe hartă`}
            >
              {location.name}
            </Link>
          ) : (
            <span className="text-foreground block font-medium">{location.name}</span>
          ))}
        {details && details !== location?.name && <span className="block">{details}</span>}
      </div>
    </div>
  )
}
