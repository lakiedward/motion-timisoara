import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, CalendarDays, Clock, MapPin, Users } from 'lucide-react'

import { getActivitatiPublice, type ActivitateDinLista } from '@/api/public'
import { formatOfferPrice } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function ziActivitate(data: string): string {
  const [an, luna, zi] = data.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, zi ?? 1).toLocaleDateString('ro-RO')
}

export default function ActivitiesPage() {
  const {
    data: activities = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['activitati-publice'],
    queryFn: () => getActivitatiPublice(),
  })

  return (
    <div>
      <section className="from-primary/8 to-page border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Evenimente</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Activități</h1>
          <p className="text-muted-foreground mt-2">Evenimente și workshop-uri punctuale.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          <div className="rounded-3xl border border-dashed py-20 text-center" role="alert">
            <p className="text-foreground font-medium">Nu am putut încărca activitățile.</p>
            <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
              Reîncearcă
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-7 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : activities.length ? (
          <div className="grid gap-7 md:grid-cols-3">
            {activities.map((activitate) => (
              <CardActivitate key={activitate.id} activitate={activitate} />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Nicio activitate programată momentan.
          </div>
        )}
      </div>
    </div>
  )
}

function CardActivitate({ activitate }: { activitate: ActivitateDinLista }) {
  const plina = activitate.locuriRamase !== null && activitate.locuriRamase <= 0

  return (
    <Link
      to={`/activitati/${activitate.id}`}
      className="group bg-card shadow-card hover:shadow-card-hover focus-visible:ring-ring/50 flex h-full flex-col overflow-hidden rounded-3xl outline-none transition-all duration-300 hover:-translate-y-2 focus-visible:ring-[3px]"
    >
      <div className="relative h-32 shrink-0 overflow-hidden">
        {activitate.heroUrl ? (
          <img src={activitate.heroUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="from-primary/15 to-highlight/15 text-primary flex size-full items-center justify-center bg-gradient-to-br">
            <Activity className="size-12" aria-hidden />
          </div>
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
