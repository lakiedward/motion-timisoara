import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, MapPin } from 'lucide-react'

import { getCamps } from '@/api/public'
import { formatRon } from '@/lib/money'
import { Skeleton } from '@/components/ui/skeleton'

export default function CampsPage() {
  const { data: camps = [], isLoading } = useQuery({ queryKey: ['camps'], queryFn: getCamps })

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Vacanțe active</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Tabere</h1>
          <p className="text-muted-foreground mt-2">Tabere sportive pentru copii.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading ? (
          <div className="grid gap-7 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-40 rounded-3xl" />
            ))}
          </div>
        ) : camps.length ? (
          <div className="grid gap-7 md:grid-cols-2">
            {camps.map((c) => (
              <Link
                key={c.id}
                to={`/tabere/${c.slug}`}
                className="bg-card shadow-card hover:shadow-card-hover rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1"
              >
                <h3 className="font-display text-xl font-bold text-foreground">{c.title}</h3>
                <div className="text-muted-foreground mt-3 space-y-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    {new Date(c.period_start).toLocaleDateString('ro-RO')} –{' '}
                    {new Date(c.period_end).toLocaleDateString('ro-RO')}
                  </div>
                  {c.location_text && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {c.location_text}
                    </div>
                  )}
                </div>
                <div className="font-display mt-4 text-lg font-bold">{formatRon(c.price)}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Nicio tabără programată momentan.
          </div>
        )}
      </div>
    </div>
  )
}
