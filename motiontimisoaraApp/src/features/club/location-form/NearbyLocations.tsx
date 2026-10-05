import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LocationChoice, NearbyLocation } from './nearby-locations'

type Props = {
  locations: NearbyLocation[]
  clubId: string
  isPending: boolean
  isError: boolean
  isFetching: boolean
  choice: LocationChoice | null
  onRetry: () => void
  onChoose: (location: NearbyLocation) => void
  onCreateNew: () => void
}

export default function NearbyLocations({
  locations,
  clubId,
  isPending,
  isError,
  isFetching,
  choice,
  onRetry,
  onChoose,
  onCreateNew,
}: Props) {
  if (isPending) {
    return (
      <div role="status" aria-live="polite" className="space-y-2 rounded-md border p-4">
        <p className="text-muted-foreground text-sm">Caut locații existente în apropiere…</p>
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="space-y-3 rounded-md border p-4">
        <p className="text-sm">Nu am putut verifica locațiile din apropiere.</p>
        <Button type="button" variant="outline" disabled={isFetching} onClick={onRetry}>
          {isFetching ? 'Se verifică…' : 'Reîncearcă'}
        </Button>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Nu există locații active în raza de 50 m. Poți crea locația nouă.
      </p>
    )
  }

  return (
    <section aria-labelledby="nearby-locations-title" className="space-y-3 rounded-md border p-4">
      <div className="space-y-1">
        <h2 id="nearby-locations-title" className="font-medium">
          Locații existente în apropiere
        </h2>
        <p className="text-muted-foreground text-sm">
          Locul poate fi deja în platformă. Alege o locație din apropiere sau creează un loc
          diferit.
        </p>
      </div>
      <ul className="space-y-3">
        {locations.map((location) => (
          <li key={location.id} className="space-y-2 rounded-md border p-3">
            <div className="flex gap-2">
              <MapPin aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="break-words text-sm font-medium">{location.name}</p>
                <p className="text-muted-foreground break-words text-xs">
                  {[location.address, location.city].filter(Boolean).join(', ')}
                  {(location.address || location.city) && ' · '}
                  {Math.round(location.distanceMeters)} m
                </p>
              </div>
            </div>
            {location.club_id === clubId ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">Deja în locațiile clubului</p>
                <Button type="button" variant="outline" size="sm" className="min-h-11" asChild>
                  <Link
                    to={`/club/locations/${location.id}/edit`}
                    aria-label={`Editează ${location.name}`}
                  >
                    Editează locația
                  </Link>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant={choice?.sourceId === location.id ? 'secondary' : 'outline'}
                size="sm"
                className="min-h-11"
                aria-label={`Folosește locul ${location.name}`}
                aria-pressed={choice?.sourceId === location.id}
                onClick={() => onChoose(location)}
              >
                {choice?.sourceId === location.id ? 'Loc ales' : 'Folosește locul'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {choice?.sourceId && (
        <p role="status" className="text-muted-foreground text-sm">
          La salvare, clubul va avea propria locație în acest punct. Poți ajusta detaliile din
          formular.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        aria-pressed={choice?.sourceId === null}
        onClick={onCreateNew}
      >
        Creează un loc diferit
      </Button>
      {choice && choice.sourceId === null && (
        <p role="status" className="text-muted-foreground text-sm">
          Ai ales să creezi o locație nouă la punctul pus pe hartă.
        </p>
      )}
    </section>
  )
}
