import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { getChildAttendance, getChildrenAttendance, getMyChildren } from '@/api/account'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import { inceputPerioada, type Perioada } from '@/lib/perioada'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { AttendanceMonths } from '@/features/account/attendance/AttendanceMonths'
import { LiveLocationBanner } from '@/features/live-location/parent/LiveLocationBanner'

const selectCls =
  'border-input bg-background hover:border-muted-foreground focus-visible:outline-ring h-touch-target w-full min-w-0 rounded-md border px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm'

const PONTAJ_VIITOR = 'Apare aici după ce antrenorul pontează prima ședință.'

const TOTI = 'toti'

const PERIOADE: { value: Perioada; label: string }[] = [
  { value: 'toate', label: 'Tot istoricul' },
  { value: 'trei-luni', label: 'Ultimele 3 luni' },
  { value: 'luna', label: 'Luna curentă' },
]

export default function AttendancePage() {
  const { data: children = [], isPending: seIncarcaCopiii } = useQuery({
    queryKey: ['children'],
    queryFn: getMyChildren,
  })
  const [selected, setSelected] = useState<string>(TOTI)
  const [perioada, setPerioada] = useState<Perioada>('toate')
  const alegereValida = selected === TOTI || children.some((c) => c.id === selected)
  const ales = alegereValida ? selected : TOTI
  const totiCopiii = ales === TOTI
  const idsCopii = useMemo(() => children.map((c) => c.id), [children])

  const {
    data: records = [],
    isPending: seIncarcaPrezenta,
    isError: aEsuatCitirea,
    refetch,
  } = useQuery({
    queryKey: ['attendance', totiCopiii ? idsCopii : ales],
    queryFn: () => (totiCopiii ? getChildrenAttendance(idsCopii) : getChildAttendance(ales)),
    enabled: totiCopiii ? idsCopii.length > 0 : !!ales,
  })

  const numeDupaId = useMemo(() => new Map(children.map((c) => [c.id, c.name])), [children])

  const randuri = useMemo(() => {
    const de_la = inceputPerioada(perioada)
    return records
      .filter((r) => {
        if (!de_la) return true
        if (!r.occurrence?.starts_at) return false
        return new Date(r.occurrence.starts_at) >= de_la
      })
      .sort(
        (a, b) => +new Date(b.occurrence?.starts_at ?? 0) - +new Date(a.occurrence?.starts_at ?? 0),
      )
  }, [records, perioada])

  const prezente = randuri.filter((r) => r.status === 'PRESENT').length
  const filtrulAscundeTot = randuri.length === 0 && records.length > 0

  const numeAles = numeDupaId.get(ales) ?? 'Copilul ales'

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Prezență</h1>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          {children.length > 1 && (
            <div className="min-w-0 space-y-1.5 sm:w-48">
              <Label htmlFor="filtru-copil">Copil</Label>
              <select
                id="filtru-copil"
                value={ales}
                onChange={(e) => setSelected(e.target.value)}
                className={selectCls}
              >
                <option value={TOTI}>Toți copiii</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div
            className={cn('min-w-0 space-y-1.5 sm:w-44', children.length > 1 ? '' : 'col-span-2')}
          >
            <Label htmlFor="filtru-perioada">Perioadă</Label>
            <select
              id="filtru-perioada"
              value={perioada}
              onChange={(e) => setPerioada(e.target.value as Perioada)}
              className={selectCls}
            >
              {PERIOADE.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <LiveLocationBanner always />
      </div>
      {seIncarcaCopiii ? (
        <StatusView state="loading" title="Se încarcă prezența" rowHeight={64} />
      ) : !children.length ? (
        <StatusView
          state="empty"
          title="Niciun copil adăugat încă."
          text="Adaugă un copil pentru a vedea prezența."
          action={
            <Button asChild className="mt-3">
              <Link to="/account/child/new">Adaugă copil</Link>
            </Button>
          }
        />
      ) : aEsuatCitirea ? (
        <StatusView
          state="error"
          title="Nu am putut încărca prezența."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => refetch()}
        />
      ) : seIncarcaPrezenta ? (
        <StatusView state="loading" title="Se încarcă prezența" rowHeight={64} />
      ) : (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border px-6 py-4 text-sm">
            <span className="font-semibold">{prezente}</span>{' '}
            {plural(prezente, 'prezență', 'prezențe', true)} din{' '}
            <span className="font-semibold">{randuri.length}</span>{' '}
            {plural(randuri.length, 'ședință înregistrată', 'ședințe înregistrate', true)}.
            <p className="text-muted-foreground mt-1 text-xs">
              Se numără doar ședințele pontate de antrenor.
            </p>
          </div>

          {randuri.length ? (
            <AttendanceMonths
              randuri={randuri}
              numeDupaId={numeDupaId}
              cuNume={totiCopiii && children.length > 1}
            />
          ) : filtrulAscundeTot ? (
            <StatusView
              state="empty"
              title="Nicio prezență în perioada aleasă."
              text="Ședințele pontate mai devreme apar în tot istoricul."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setPerioada('toate')}
                >
                  Vezi tot istoricul
                </Button>
              }
            />
          ) : !totiCopiii ? (
            <StatusView
              state="empty"
              title={`${numeAles} nu are nicio prezență înregistrată.`}
              text={PONTAJ_VIITOR}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setSelected(TOTI)}
                >
                  Vezi toți copiii
                </Button>
              }
            />
          ) : (
            <StatusView
              state="empty"
              title="Nicio prezență înregistrată încă."
              text={PONTAJ_VIITOR}
            />
          )}
        </div>
      )}
    </div>
  )
}
