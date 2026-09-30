import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getCoaches, publicUrl } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

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
          <p className="text-muted-foreground mt-2">Antrenori dedicați sportului și copiilor</p>
        </div>
      </section>

      <section
        data-section="motion-react:page:/antrenori:section:lista-antrenori"
        aria-label="Listă antrenori"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        <div className="mb-7 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="coach-name-search">Caută după nume</Label>
            <Input
              id="coach-name-search"
              type="search"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
              className="h-11 lg:h-9"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="coach-sport-filter">Sport</Label>
            <select
              id="coach-sport-filter"
              value={sportId}
              onChange={(event) => setSportId(event.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-11 w-full min-w-0 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 lg:h-9"
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
            className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-3xl" />
            ))}
          </div>
        ) : coachesQuery.isError ? (
          <div className="space-y-4 rounded-3xl border p-6">
            <p role="alert">Nu am putut încărca antrenorii.</p>
            <Button variant="outline" onClick={() => void coachesQuery.refetch()}>
              Reîncearcă
            </Button>
          </div>
        ) : !coaches.length ? (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Niciun antrenor disponibil momentan.
          </div>
        ) : filteredCoaches.length ? (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCoaches.map((c) => {
              const photo = publicUrl('coach-photos', c.photo_storage_path)
              const name = c.profile?.name ?? 'Antrenor'
              return (
                <Link
                  key={c.id}
                  to={`/antrenori/${c.user_id}`}
                  className="bg-card shadow-card hover:shadow-card-hover focus-visible:ring-ring min-w-0 rounded-3xl p-8 text-center outline-none transition-all duration-300 hover:-translate-y-2 focus-visible:ring-2 wrap-anywhere"
                >
                  <div className="mx-auto mb-4 size-28 overflow-hidden rounded-full border-4 border-muted">
                    {photo ? (
                      <img src={photo} alt={name} className="size-full object-cover" />
                    ) : (
                      <div className="bg-primary text-primary-foreground grid size-full place-items-center text-2xl font-bold">
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
                        <Badge
                          key={s!.id}
                          variant="outline"
                          className="max-w-full whitespace-normal wrap-anywhere"
                        >
                          {s!.name}
                        </Badge>
                      ))}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4 rounded-3xl border border-dashed px-6 py-20 text-center">
            <p role="status" className="text-muted-foreground">
              Niciun antrenor nu corespunde căutării și filtrelor.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setNameSearch('')
                setSportId('')
              }}
            >
              Resetează filtrele
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
