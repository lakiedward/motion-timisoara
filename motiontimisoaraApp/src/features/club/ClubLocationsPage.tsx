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

const TYPE_LABEL: Record<string, string> = { POOL: 'Bazin', TRACK: 'Pistă', GYM: 'Sală', OTHER: 'Alt tip' }

/** „Str. Audit 1, Timișoara”, fără virgulă în aer când lipsește una dintre ele. */
function formatAdresa(l: ClubLocation): string {
  return [l.address, l.city].filter(Boolean).join(', ') || '—'
}

export default function ClubLocationsPage() {
  const qc = useQueryClient()
  // `isError` de pe clubul propriu contează la fel de mult ca cel de pe locații:
  // dacă `getMyClub` pică, `isPending` devine fals, `clubId` rămâne gol, deci
  // interogarea locațiilor stă oprită de `enabled` — iar o interogare oprită are
  // `isLoading` fals ȘI `isError` fals. Fără ramura de mai jos, cascada cădea pe
  // ultima variantă și un club cu locații, pe o rețea picată, era invitat să-și
  // adauge prima locație. Aceeași reparație ca pe pagina de anunțuri.
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

  // Cine e în zbor se ține aici, pe id, NU prin `toggle.variables`: mutația e una
  // singură pentru toată lista, iar `variables` păstrează doar argumentele
  // ULTIMULUI `mutate`. Cu garda pe `variables`, o a doua apăsare pe alt rând muta
  // reperul și redeschidea butonul primului rând cât timp cererea lui era încă în
  // zbor — deci a doua apăsare pe el chiar pleca la server.
  const [seComuta, setSeComuta] = useState<string[]>([])

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setClubLocationActive(id, active),
    onMutate: ({ id }) => setSeComuta((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setSeComuta((l) => l.filter((x) => x !== id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-locations', clubId] }),
    onError: () => toast.error('Nu am putut actualiza locația.'),
  })

  // Cele active înaintea celor inactive, alfabetic în fiecare grup: o sală scoasă
  // din uz nu poate fi folosită, deci n-are de ce să stea între cele utilizabile.
  const randuri = useMemo(
    () =>
      [...locations].sort(
        (a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, 'ro')
      ),
    [locations]
  )

  // Clubul picat e o eroare de încărcare la fel ca locațiile picate, iar butonul
  // de reîncercare trebuie s-o ceară pe cea care chiar a căzut.
  const aEsuatIncarcarea = aEsuatClubul || (isError && !randuri.length)
  const reincearca = () => (aEsuatClubul ? reincarcaClubul() : refetch())

  const cereDezactivarea = (l: ClubLocation) => {
    if (!l.is_active) {
      toggle.mutate({ id: l.id, active: true })
      return
    }
    // Clubul află pe ce cade dezactivarea ÎNAINTE, nu după. Nu blocăm: o sală
    // chiar se poate închide, iar blocarea l-ar lăsa prins.
    const cate = l.courseCount
    const mesaj = cate
      ? `Dezactivezi ${l.name}? Se ține ${plural(cate, 'curs', 'cursuri')} aici, iar locația nu va mai putea fi aleasă pentru cursuri noi.`
      : `Dezactivezi ${l.name}? Nu va mai putea fi aleasă pentru cursuri noi.`
    if (confirm(mesaj)) toggle.mutate({ id: l.id, active: false })
  }

  return (
    <div>
      {/* Sub 640 px „Locație nouă” coboară pe rândul ei — perechea de aici e mai
          lată decât „Cursurile clubului”, unde înghesuiala a fost deja reparată. */}
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
        // Înălțimile urmăresc cardul real, măsurat: 206 px la 768 px, unde linia
        // cu adresa curge pe două rânduri, și 198 px la 1440 px. Fără asta lista
        // sare la fiecare încărcare. Și clubul se așteaptă aici: cât timp se
        // încarcă el, interogarea de locații e oprită, deci `isLoading` e fals și
        // ecranul ar arăta o clipă „Nicio locație încă.”
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-3xl lg:h-48" />
          ))}
        </div>
      ) : aEsuatIncarcarea ? (
        // Fără ramura asta, o încărcare eșuată afișa „Nicio locație încă.”, deci un
        // club cu locații era invitat să-și adauge prima. Garda pe lungime contează
        // la fel de mult: comutarea invalidează lista, iar un refetch picat trecător
        // n-are voie să șteargă de pe ecran locațiile deja încărcate.
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
                <Badge variant="outline">{TYPE_LABEL[l.type] ?? l.type}</Badge>
                {/* Starea nu mai e conturată ca eticheta de tip: altfel „Sală” și
                    „Inactivă” arătau la fel, iar singurul indiciu era cuvântul. */}
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
                  // Doar butonul locației apăsate se blochează, și rămâne blocat cât
                  // timp CHIAR cererea lui e în zbor — lista de id-uri le ține pe
                  // toate, spre deosebire de `toggle.variables`, care păstra doar
                  // ultima apăsare.
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
