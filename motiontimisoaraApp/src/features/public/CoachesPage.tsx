import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getCoaches, publicUrl } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function CoachesPage() {
  const { data: coaches = [], isLoading } = useQuery({ queryKey: ['coaches'], queryFn: getCoaches })

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Echipă</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Antrenori</h1>
          <p className="text-muted-foreground mt-2">Antrenori dedicați și verificați.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isLoading ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        ) : coaches.length ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => {
              const photo = publicUrl('coach-photos', c.photo_storage_path)
              const name = c.profile?.name ?? 'Antrenor'
              return (
                <Link
                  key={c.id}
                  to={`/antrenori/${c.user_id}`}
                  className="bg-card shadow-card hover:shadow-card-hover rounded-3xl p-8 text-center transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="mx-auto mb-4 size-28 overflow-hidden rounded-full border-4 border-muted">
                    {photo ? (
                      <img src={photo} alt={name} className="size-full object-cover" />
                    ) : (
                      <div className="bg-primary grid size-full place-items-center text-2xl font-bold text-white">
                        {name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">{name}</h3>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {c.coach_sports
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
            Niciun antrenor disponibil momentan.
          </div>
        )}
      </div>
    </div>
  )
}
