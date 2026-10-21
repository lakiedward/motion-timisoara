import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyLocations, setLocationActive } from '@/api/coach'
import type { ClubLocation } from '@/api/club'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusView } from '@/components/ui/status-view'
import { ClubLocationFilterBar } from '@/features/club/locations/ClubLocationFilterBar'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { ClubLocationRow } from '@/features/club/locations/ClubLocationRow'
import {
  NO_FILTERS,
  filterLocations,
  grupeazaDupaStare,
  hasFilters,
  statusCounts,
  type LocationFilters,
} from '@/features/club/locations/location-list'
import { locationWriteErrorMessage } from '@/lib/geography/shared-location-guard'
import { plural } from '@/lib/plural'

export default function CoachLocationsPage() {
  const qc = useQueryClient()
  const {
    data: locations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['my-locations'], queryFn: getMyLocations, retry: false })
  const [seComuta, setSeComuta] = useState<string[]>([])
  const [deDezactivat, setDeDezactivat] = useState<ClubLocation | null>(null)
  const [filtre, setFiltre] = useState<LocationFilters>(NO_FILTERS)

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean; name: string }) =>
      setLocationActive(id, active),
    onMutate: ({ id }) => setSeComuta((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setSeComuta((l) => l.filter((x) => x !== id)),
    onSuccess: (_d, { active, name }) => {
      setDeDezactivat(null)
      qc.invalidateQueries({ queryKey: ['my-locations'] })
      toast.success(active ? `${name} e din nou activă.` : `${name} a fost dezactivată.`)
    },
    onError: (e) => toast.error(locationWriteErrorMessage(e, 'Nu am putut actualiza locația.')),
  })
  const { active, inactive } = grupeazaDupaStare(filterLocations(locations, filtre))
  const total = locations.length

  const comuta = (l: ClubLocation) =>
    l.is_active ? setDeDezactivat(l) : toggle.mutate({ id: l.id, active: true, name: l.name })

  const grup = (titlu: string, randuri: ClubLocation[]) =>
    randuri.length ? (
      <section aria-label={titlu} className="grid gap-3">
        <h2 className="text-muted-foreground text-sm font-semibold">
          {titlu} · {randuri.length}
        </h2>
        <ul className="bg-card divide-y overflow-hidden rounded-xl border">
          {randuri.map((l) => (
            <ClubLocationRow
              key={l.id}
              locatie={l}
              seComuta={seComuta.includes(l.id)}
              onToggle={() => comuta(l)}
              editTo={`/coach/locations/${l.id}/edit`}
            />
          ))}
        </ul>
      </section>
    ) : null

  const cate = deDezactivat?.courseCount ?? 0

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-foreground text-2xl font-bold">
          Locațiile mele
          {!!total && (
            <span className="text-muted-foreground ml-2 text-base font-normal">({total})</span>
          )}
        </h1>
        <Button asChild className="h-11 lg:h-9">
          <Link to="/coach/locations/new">
            <Plus aria-hidden="true" /> Locație nouă
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <ClubLocationListSkeleton />
      ) : isError && !total ? (
        <StatusView state="error" title="Nu am putut încărca locațiile." onRetry={() => refetch()} />
      ) : total ? (
        <>
          <ClubLocationFilterBar
            filters={filtre}
            statusCounts={statusCounts(locations)}
            onChange={setFiltre}
          />
          {active.length + inactive.length ? (
            <div className="grid gap-8">
              {grup('Active', active)}
              {grup('Inactive', inactive)}
            </div>
          ) : (
            <StatusView
              state="empty"
              title="Nicio locație pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasFilters(filtre) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-11 min-h-11"
                    onClick={() => setFiltre(NO_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          )}
        </>
      ) : (
        <StatusView
          state="empty"
          title="Nicio locație încă."
          text="Adaugă bazinele, sălile sau terenurile unde îți ții cursurile și activitățile."
          action={
            <Button asChild variant="outline" className="mt-3">
              <Link to="/coach/locations/new">Adaugă prima locație</Link>
            </Button>
          }
        />
      )}

      <ConfirmDialog
        open={!!deDezactivat}
        onOpenChange={(open) => !open && setDeDezactivat(null)}
        title={`Dezactivezi „${deDezactivat?.name ?? ''}”?`}
        description={
          cate
            ? `Aici ${cate === 1 ? 'se ține' : 'se țin'} ${plural(cate, 'curs', 'cursuri')}. Cursurile nu se opresc, dar locația nu mai apare pe hartă și nu mai poate fi aleasă pentru cursuri noi.`
            : 'Locația nu mai apare pe hartă și nu mai poate fi aleasă pentru cursuri noi. O poți reactiva oricând.'
        }
        confirmLabel="Dezactivează"
        destructive
        pending={toggle.isPending && toggle.variables?.id === deDezactivat?.id}
        onConfirm={() =>
          deDezactivat &&
          toggle.mutate({ id: deDezactivat.id, active: false, name: deDezactivat.name })
        }
      />
    </div>
  )
}
