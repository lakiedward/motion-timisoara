import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, getClubLocations, setClubLocationActive, type ClubLocation } from '@/api/club'
import { plural } from '@/lib/plural'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusView } from '@/components/ui/status-view'
import { ClubLocationRow } from './locations/ClubLocationRow'
import { grupeazaDupaStare } from './locations/location-list'

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
  const [deDezactivat, setDeDezactivat] = useState<ClubLocation | null>(null)

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean; name: string }) =>
      setClubLocationActive(id, active),
    onMutate: ({ id }) => setSeComuta((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setSeComuta((l) => l.filter((x) => x !== id)),
    onSuccess: (_d, { active, name }) => {
      setDeDezactivat(null)
      qc.invalidateQueries({ queryKey: ['club-locations', clubId] })
      toast.success(active ? `${name} e din nou activă.` : `${name} a fost dezactivată.`)
    },
    onError: () => toast.error('Nu am putut actualiza locația.'),
  })
  const { active, inactive } = grupeazaDupaStare(locations)
  const total = locations.length
  const faraClub = !seIncarcaClubul && !aEsuatClubul && !club
  const aEsuatIncarcarea = aEsuatClubul || (isError && !total)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())

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
          Locațiile clubului
          {!!total && (
            <span className="text-muted-foreground ml-2 text-base font-normal">({total})</span>
          )}
        </h1>
        <Button asChild className="h-11 lg:h-9">
          <Link to="/club/locations/new">
            <Plus aria-hidden="true" /> Locație nouă
          </Link>
        </Button>
      </div>

      {seIncarcaClubul || isLoading ? (
        <StatusView state="loading" title="Se încarcă locațiile" rows={6} rowHeight={72} />
      ) : aEsuatIncarcarea ? (
        <StatusView state="error" title="Nu am putut încărca locațiile." onRetry={reincearca} />
      ) : faraClub ? (
        <StatusView
          state="empty"
          title="Contul nu are un club asociat."
          text="Locațiile se adaugă după ce clubul e creat."
        />
      ) : total ? (
        <div className="grid gap-8">
          {grup('Active', active)}
          {grup('Inactive', inactive)}
        </div>
      ) : (
        <StatusView
          state="empty"
          title="Nicio locație încă."
          text="Adaugă bazinele, sălile sau terenurile unde se țin cursurile clubului."
          action={
            <Button asChild variant="outline" className="mt-3">
              <Link to="/club/locations/new">Adaugă prima locație</Link>
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
