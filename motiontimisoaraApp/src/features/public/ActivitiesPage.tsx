import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getActivitatiPublice } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { CardActivitate } from './components/ActivityListCard'

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
      <section
        aria-labelledby="activities-page-title"
        data-section="motion-react:page:/activitati:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Evenimente</span>
          <h1
            id="activities-page-title"
            className="font-display text-4xl font-extrabold text-foreground"
          >
            Activități
          </h1>
          <p className="text-muted-foreground mt-2">Evenimente și workshop-uri punctuale.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca activitățile."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă activitățile" className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : activities.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {activities.map((activitate) => (
              <CardActivitate key={activitate.id} activitate={activitate} />
            ))}
          </div>
        ) : (
          <StatusView
            state="empty"
            title="Nicio activitate programată momentan."
            text="Activitățile noi apar aici când un club sau un antrenor le anunță. Până atunci, copilul tău se poate înscrie la un curs sau la o tabără."
            action={
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/cursuri">Vezi cursurile</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/tabere">Vezi taberele</Link>
                </Button>
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
