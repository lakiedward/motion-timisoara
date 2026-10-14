import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getCoaches, publicUrl, type CoachListItem } from '@/api/public'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'

export default function CoachesPage() {
  const [nameSearch, setNameSearch] = useState('')
  const [sportId, setSportId] = useState('')
  const coachesQuery = useQuery({ queryKey: ['coaches'], queryFn: getCoaches })
  const coaches = coachesQuery.data ?? []
  const sports = [
    ...new Map(
      coaches.flatMap((coach) =>
        coach.coach_sports.flatMap(({ sport }) => (sport ? [[sport.id, sport] as const] : [])),
      ),
    ).values(),
  ].sort((first, second) => first.name.localeCompare(second.name, 'ro'))
  const search = nameSearch.trim().toLocaleLowerCase('ro')
  const filteredCoaches = coaches.filter(
    (coach) =>
      (coach.profile?.name ?? 'Antrenor').toLocaleLowerCase('ro').includes(search) &&
      (!sportId || coach.coach_sports.some(({ sport }) => sport?.id === sportId)),
  )
  const listLoading = coachesQuery.isPending || (coachesQuery.isError && coachesQuery.isFetching)

  return (
    <div>
      <section
        data-section="motion-react:page:/antrenori:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Echipă</span>
          <h1 className="font-display text-4xl font-extrabold text-foreground">Antrenori</h1>
          <p className="text-foreground/80 dark:text-muted-foreground mt-2">
            Antrenori dedicați sportului și copiilor
          </p>
        </div>
      </section>

      <section
        data-section="motion-react:page:/antrenori:section:lista-antrenori"
        aria-label="Listă antrenori"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="coach-name-search">Caută după nume</Label>
            <Input
              id="coach-name-search"
              type="search"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="coach-sport-filter">Sport</Label>
            <select
              id="coach-sport-filter"
              value={sportId}
              onChange={(event) => setSportId(event.target.value)}
              className="border-input bg-background hover:border-muted-foreground focus-visible:outline-ring h-touch-target w-full min-w-0 rounded-md border px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm"
            >
              <option value="">Toate sporturile</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {listLoading ? (
          <div
            role="status"
            aria-label="Se încarcă antrenorii"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl sm:h-56" />
            ))}
          </div>
        ) : coachesQuery.isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca antrenorii."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void coachesQuery.refetch()}
          />
        ) : !coaches.length ? (
          <StatusView
            state="empty"
            title="Niciun antrenor disponibil momentan."
            text="Revino curând. Până atunci, poți descoperi cursurile și cluburile din Timișoara."
            action={
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/cursuri">Vezi cursurile</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/cluburi">Vezi cluburile</Link>
                </Button>
              </div>
            }
          />
        ) : filteredCoaches.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCoaches.map((coach) => (
              <li key={coach.id} className="min-w-0">
                <CoachCard coach={coach} />
              </li>
            ))}
          </ul>
        ) : (
          <StatusView
            state="empty"
            title="Niciun antrenor nu corespunde căutării și filtrelor."
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('ro'))
    .join('')
}

function CoachCard({ coach }: { coach: CoachListItem }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const photo = publicUrl('coach-photos', coach.photo_storage_path)
  const name = coach.profile?.name ?? 'Antrenor'
  const sports = coach.coach_sports.flatMap(({ sport }) => (sport ? [sport] : []))
  return (
    <Link
      to={`/antrenori/${coach.user_id}`}
      className="bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card flex h-full min-w-0 items-center gap-4 rounded-xl border p-5 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none wrap-anywhere sm:flex-col sm:gap-0 sm:p-6 sm:text-center"
    >
      <Avatar className="size-16 sm:mb-4 sm:size-24">
        {photo && !photoFailed ? (
          <img
            src={photo}
            alt={name}
            onError={() => setPhotoFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <AvatarFallback aria-hidden="true" className="text-xl sm:text-3xl">
            {initials(name)}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="min-w-0">
        <h3 className="font-display text-foreground text-lg font-bold">{name}</h3>
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
