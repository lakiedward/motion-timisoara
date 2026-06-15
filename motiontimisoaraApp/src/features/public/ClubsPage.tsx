import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'

import { getPublicClubs, publicUrl } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function ClubsPage() {
  const { data: clubs = [], isLoading } = useQuery({ queryKey: ['clubs'], queryFn: getPublicClubs })

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Echipă</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Cluburi</h1>
          <p className="text-muted-foreground mt-2">Cluburi sportive partenere din Timișoara.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-3xl" />
            ))}
          </div>
        ) : clubs.length ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => {
              const logo = publicUrl('club-assets', club.logo_storage_path)
              return (
                <Link
                  key={club.id}
                  to={`/cluburi/${club.id}`}
                  className="bg-card shadow-card hover:shadow-card-hover flex flex-col rounded-3xl p-6 transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-16 shrink-0 overflow-hidden rounded-2xl border">
                      {logo ? (
                        <img src={logo} alt={club.name} className="size-full object-cover" />
                      ) : (
                        <div className="bg-primary/10 text-primary grid size-full place-items-center text-xl font-bold">
                          {club.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-foreground">{club.name}</h3>
                      {club.city && (
                        <div className="text-muted-foreground flex items-center gap-1 text-sm">
                          <MapPin className="size-3.5" /> {club.city}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {club.club_sports
                      ?.map((cs) => cs.sport)
                      .filter(Boolean)
                      .map((s) => (
                        <Badge key={s!.id} variant="outline">
                          {s!.name}
                        </Badge>
                      ))}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Niciun club disponibil momentan.
          </div>
        )}
      </div>
    </div>
  )
}
