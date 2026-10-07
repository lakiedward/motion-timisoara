import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, getClubLocations, setClubLocationActive, type ClubLocation } from '@/api/club'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { locationTypeLabel } from '@/lib/geography/location-types'

function formatAdresa(l: ClubLocation): string {
  return [l.address, l.city].filter(Boolean).join(', ') || '—'
}

export default function ClubLocationsPage() {
  const qc = useQueryClient()
  const {
    data: club,
    isPending: seIncarcaClubul,
    isError: aEsuatClubul,
    refetch: reincarcaClubul,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: locations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['club-locations', clubId],
    queryFn: () => getClubLocations(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const [seComuta, setSeComuta] = useState<string[]>([])

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setClubLocationActive(id, active),
    onMutate: ({ id }) => setSeComuta((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setSeComuta((l) => l.filter((x) => x !== id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-locations', clubId] }),
    onError: () => toast.error('Nu am putut actualiza locația.'),
  })
  const randuri = useMemo(
    () =>
      [...locations].sort(
        (a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, 'ro'),
      ),
    [locations],
  )
  const aEsuatIncarcarea = aEsuatClubul || (isError && !randuri.length)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())

  const cereDezactivarea = (l: ClubLocation) => {
    if (!l.is_active) {
      toggle.mutate({ id: l.id, active: true })
      return
    }
    const cate = l.courseCount
    const mesaj = cate
      ? `Dezactivezi ${l.name}? Se ține ${plural(cate, 'curs', 'cursuri')} aici, iar locația nu va mai putea fi aleasă pentru cursuri noi.`
      : `Dezactivezi ${l.name}? Nu va mai putea fi aleasă pentru cursuri noi.`
    if (confirm(mesaj)) toggle.mutate({ id: l.id, active: false })
  }

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Locațiile clubului
          {!!randuri.length && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({randuri.length})
            </span>
          )}
        </h1>
        <Button asChild className="h-11 lg:h-9">
          <Link to="/club/locations/new">
            <Plus /> Locație nouă
          </Link>
        </Button>
      </div>

      {seIncarcaClubul || isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-3xl lg:h-48" />
          ))}
        </div>
      ) : aEsuatIncarcarea ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca locațiile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={reincearca}>
            Reîncearcă
          </Button>
        </div>
      ) : randuri.length ? (
        <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
          {randuri.map((l) => (
            <div key={l.id} className="bg-card shadow-card rounded-3xl p-5">
              <h3 className="font-display text-lg font-bold">{l.name}</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline">{locationTypeLabel(l.type)}</Badge>

                <Badge variant={l.is_active ? 'success' : 'secondary'}>
                  {l.is_active ? 'Activă' : 'Inactivă'}
                </Badge>
              </div>
              <div className="text-muted-foreground mt-2 flex items-center gap-1 text-sm">
                <MapPin className="size-4 shrink-0" /> {formatAdresa(l)}
              </div>
              {!!l.courseCount && (
                <div className="text-muted-foreground mt-1 text-sm">
                  {plural(l.courseCount, 'curs', 'cursuri')} aici
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="h-11 lg:h-9">
                  <Link to={`/club/locations/${l.id}/edit`} aria-label={`Editează ${l.name}`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 lg:h-9"
                  disabled={seComuta.includes(l.id)}
                  aria-label={`${l.is_active ? 'Dezactivează' : 'Activează'} ${l.name}`}
                  onClick={() => cereDezactivarea(l)}
                >
                  {l.is_active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          <p>Nicio locație încă.</p>
          <Button asChild variant="outline" className="mt-4 h-11 min-h-11">
            <Link to="/club/locations/new">Adaugă prima locație</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
