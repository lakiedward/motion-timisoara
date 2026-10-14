import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'

import { getPublicClubs, publicUrl, type ClubListItem } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'

export default function ClubsPage() {
  const clubsQuery = useQuery({ queryKey: ['clubs'], queryFn: getPublicClubs })
  const clubs = clubsQuery.data ?? []
  const listLoading = clubsQuery.isPending || (clubsQuery.isError && clubsQuery.isFetching)

  return (
    <div>
      <section
        data-section="motion-react:page:/cluburi:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Echipă</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Cluburi</h1>
          <p className="text-muted-foreground mt-2">Cluburi sportive partenere din Timișoara.</p>
        </div>
      </section>

      <section
        data-section="motion-react:page:/cluburi:section:lista-cluburi"
        aria-label="Listă cluburi"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        {listLoading ? (
          <div
            role="status"
            aria-label="Se încarcă cluburile"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : clubsQuery.isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca cluburile."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void clubsQuery.refetch()}
          />
        ) : !clubs.length ? (
          <StatusView
            state="empty"
            title="Niciun club disponibil momentan."
            text="Revino curând. Până atunci, poți descoperi cursurile și antrenorii din Timișoara."
            action={
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/cursuri">Vezi cursurile</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/antrenori">Vezi antrenorii</Link>
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <li key={club.id} className="min-w-0">
                <ClubCard club={club} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ClubCard({ club }: { club: ClubListItem }) {
  const logo = publicUrl('club-assets', club.logo_storage_path)
  const sports = club.club_sports.flatMap(({ sport }) => (sport ? [sport] : []))
  return (
    <Link
      to={`/cluburi/${club.id}`}
      className="bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card flex h-full min-w-0 flex-col gap-4 rounded-xl border p-6 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none wrap-anywhere"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-xl border">
          {logo ? (
            <img src={logo} alt="" className="size-full object-cover" />
          ) : (
            <div
              aria-hidden="true"
              className="bg-primary/12 text-primary grid size-full place-items-center text-xl font-bold"
            >
              {club.name.charAt(0).toLocaleUpperCase('ro')}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-foreground text-lg font-bold">{club.name}</h3>
          {club.city && (
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" /> {club.city}
            </div>
          )}
        </div>
      </div>
      {sports.length ? (
        <div className="flex flex-wrap gap-1.5">
          {sports.map((sport) => (
            <Badge
              key={sport.id}
              variant="outline"
              className="max-w-full whitespace-normal wrap-anywhere"
            >
              {sport.name}
            </Badge>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
