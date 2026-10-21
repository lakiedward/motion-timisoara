import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'

import type { ActivitateDinLista } from '@/api/public'
import { formatOfferPrice } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'

function ziActivitate(data: string): string {
  const [an, luna, zi] = data.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, zi ?? 1).toLocaleDateString('ro-RO')
}

export function CardActivitate({ activitate }: { activitate: ActivitateDinLista }) {
  const plina = activitate.locuriRamase !== null && activitate.locuriRamase <= 0
  const [photoFailed, setPhotoFailed] = useState(false)

  return (
    <Link
      to={`/activitati/${activitate.id}`}
      className="group bg-card shadow-card hover:shadow-card-hover hover:border-primary/40 flex h-full flex-col overflow-hidden rounded-xl border transition-[box-shadow,border-color] duration-300 motion-reduce:transition-none"
    >
      <div className="relative h-32 shrink-0 overflow-hidden">
        {activitate.heroUrl && !photoFailed ? (
          <img
            src={activitate.heroUrl}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <SportIllustration code={activitate.sportCode} />
        )}
        {activitate.sportName && (
          <Badge className="absolute top-4 left-4">{activitate.sportName}</Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col space-y-2 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-foreground">{activitate.name}</h3>
          {plina && <Badge variant="destructive">Locuri epuizate</Badge>}
        </div>
        <div className="text-muted-foreground space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0" /> {ziActivitate(activitate.activityDate)}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 shrink-0" />{' '}
            {`${activitate.startTime.slice(0, 5)}–${activitate.endTime.slice(0, 5)}`}
          </div>
          {activitate.locationName && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" /> {activitate.locationName}
            </div>
          )}
          {!plina && activitate.locuriRamase !== null && (
            <div className="flex items-center gap-1.5">
              <Users className="size-4 shrink-0" />
              {plural(activitate.locuriRamase, 'loc rămas', 'locuri rămase')}
            </div>
          )}
        </div>
        {activitate.organizator && (
          <p className="text-muted-foreground text-sm">
            Organizată de{' '}
            <span className="text-foreground font-medium">{activitate.organizator}</span>
          </p>
        )}
        <div className="font-display mt-auto pt-1 text-lg font-bold">
          {formatOfferPrice(activitate.price, activitate.currency)}
        </div>
      </div>
    </Link>
  )
}
