import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'

import { FilterMenu } from '@/components/catalog-filters/FilterMenu'
import { SearchField } from '@/components/catalog-filters/SearchField'
import { plural } from '@/lib/plural'
import { getPublicClubs, publicUrl, type ClubListItem } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { PublicPageHeader } from './components/PublicPageHeader'

export default function ClubsPage() {
  const clubsQuery = useQuery({ queryKey: ['clubs'], queryFn: getPublicClubs })
  const clubs = clubsQuery.data ?? []
  const [nameSearch, setNameSearch] = useState('')
  const [sportId, setSportId] = useState('')
  const sports = [
    ...new Map(
      clubs.flatMap((club) =>
        club.club_sports.flatMap(({ sport }) => (sport ? [[sport.id, sport] as const] : [])),
      ),
    ).values(),
  ].sort((first, second) => first.name.localeCompare(second.name, 'ro'))
  const search = nameSearch.trim().toLocaleLowerCase('ro')
  const filteredClubs = clubs.filter(
    (club) =>
      club.name.toLocaleLowerCase('ro').includes(search) &&
      (!sportId || club.club_sports.some(({ sport }) => sport?.id === sportId)),
  )
  const listLoading = clubsQuery.isPending || (clubsQuery.isError && clubsQuery.isFetching)

  return (
    <div>
      <PublicPageHeader
        id="clubs-page-title"
        section="motion-react:page:/cluburi:section:toata-pagina"
        eyebrow="Echipă"
        title="Cluburi"
        text="Cluburi sportive partenere din Timișoara."
      />

      <section
        data-section="motion-react:page:/cluburi:section:lista-cluburi"
        aria-label="Listă cluburi"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <SearchField
            id="club-name-search"
            label="Caută după nume"
            placeholder="Numele clubului"
            value={nameSearch}
            onChange={setNameSearch}
          />
          <FilterMenu
            id="club-sport-filter"
            label="Sport"
            value={sportId}
            allLabel="Toate sporturile"
            options={sports.map((sport) => ({ value: sport.id, label: sport.name }))}
            onChange={setSportId}
          />
        </div>
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
        ) : filteredClubs.length ? (
          <>
            <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
              {plural(filteredClubs.length, 'club găsit', 'cluburi găsite')}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClubs.map((club) => (
                <li key={club.id} className="min-w-0">
                  <ClubCard club={club} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <StatusView
            state="empty"
            title="Niciun club nu corespunde căutării și filtrelor."
            text="Încearcă alt nume sau alt sport."
            action={
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setNameSearch('')
                  setSportId('')
                }}
              >
                Resetează filtrele
              </Button>
            }
          />
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
      className="bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card flex h-full min-w-0 items-center gap-4 rounded-xl border p-5 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none wrap-anywhere sm:flex-col sm:gap-0 sm:p-6 sm:text-center"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-xl border sm:mb-4 sm:size-24">
        {logo ? (
          <img src={logo} alt="" className="size-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="bg-primary/12 text-primary grid size-full place-items-center text-xl font-bold sm:text-3xl"
          >
            {club.name.charAt(0).toLocaleUpperCase('ro')}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h3 className="font-display text-foreground text-lg font-bold">{club.name}</h3>
        {club.city && (
          <div className="text-muted-foreground flex items-center gap-1 text-sm sm:justify-center">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" /> {club.city}
          </div>
        )}
        {sports.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5 sm:justify-center">
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
      </div>
    </Link>
  )
}
