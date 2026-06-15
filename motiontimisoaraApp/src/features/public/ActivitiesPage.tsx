import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, MapPin } from 'lucide-react'

import { getActivities } from '@/api/public'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SPORT_ICON } from './sport-icons'

export default function ActivitiesPage() {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: getActivities,
  })

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Evenimente</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Activități</h1>
          <p className="text-muted-foreground mt-2">Evenimente și workshop-uri punctuale.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading ? (
          <div className="grid gap-7 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : activities.length ? (
          <div className="grid gap-7 md:grid-cols-3">
            {activities.map((a) => {
              const icon = SPORT_ICON[a.sport?.code ?? ''] ?? '🎯'
              const date = new Date(a.activity_date)
              return (
                <Link
                  key={a.id}
                  to={`/activitati/${a.id}`}
                  className="group bg-card shadow-card hover:shadow-card-hover overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="from-primary/15 to-highlight/15 text-primary flex h-32 items-center justify-center bg-gradient-to-br text-5xl">
                    {icon}
                  </div>
                  <div className="space-y-2 p-6">
                    {a.sport && <Badge>{a.sport.name}</Badge>}
                    <h3 className="font-display text-lg font-bold text-foreground">{a.name}</h3>
                    <div className="text-muted-foreground space-y-1 text-sm">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-4" /> {date.toLocaleDateString('ro-RO')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-4" /> {a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}
                      </div>
                      {a.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-4" /> {a.location.name}
                        </div>
                      )}
                    </div>
                    <div className="font-display pt-1 text-lg font-bold">{formatRon(a.price)}</div>
                  </div>
                </Link>
              )
            })}
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
