import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getChildAttendance, getMyChildren } from '@/api/account'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'

const selectCls =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] lg:h-9'

type Perioada = 'toate' | 'luna' | 'trei-luni'

const PERIOADE: { value: Perioada; label: string }[] = [
  { value: 'toate', label: 'Tot istoricul' },
  { value: 'trei-luni', label: 'Ultimele 3 luni' },
  { value: 'luna', label: 'Luna curentă' },
]

/** Momentul de la care o ședință intră în perioada aleasă. Null = fără limită. */
function inceputPerioada(perioada: Perioada): Date | null {
  const acum = new Date()
  if (perioada === 'luna') return new Date(acum.getFullYear(), acum.getMonth(), 1)
  if (perioada === 'trei-luni') return new Date(acum.getFullYear(), acum.getMonth() - 3, acum.getDate())
  return null
}

/** „07.08.2026 · 17:00” — data singură nu deosebește două ședințe din aceeași zi. */
function formatCand(startsAt: string): string {
  const d = new Date(startsAt)
  const data = d.toLocaleDateString('ro-RO')
  const ora = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  return `${data} · ${ora}`
}

export default function AttendancePage() {
  const { data: children = [], isPending: seIncarcaCopiii } = useQuery({
    queryKey: ['children'],
    queryFn: getMyChildren,
  })
  const [selected, setSelected] = useState('')
  const [perioada, setPerioada] = useState<Perioada>('toate')

  // Alegerea se verifică față de lista curentă. Altfel, după ștergerea unui copil
  // din „Copiii mei”, `selected` rămâne un id mort: selectorul arată vizual primul
  // copil, dar cererea pleacă pe cel șters și lista pare goală pentru cine nu trebuie.
  const childId = children.some((c) => c.id === selected) ? selected : (children[0]?.id ?? '')

  const {
    data: records = [],
    isPending: seIncarcaPrezenta,
    isError: aEsuatCitirea,
    refetch,
  } = useQuery({
    queryKey: ['attendance', childId],
    queryFn: () => getChildAttendance(childId),
    enabled: !!childId,
  })

  const randuri = useMemo(() => {
    const de_la = inceputPerioada(perioada)
    return records
      .filter((r) => {
        if (!de_la) return true
        if (!r.occurrence?.starts_at) return false
        return new Date(r.occurrence.starts_at) >= de_la
      })
      .sort(
        (a, b) => +new Date(b.occurrence?.starts_at ?? 0) - +new Date(a.occurrence?.starts_at ?? 0)
      )
  }, [records, perioada])

  const prezente = randuri.filter((r) => r.status === 'PRESENT').length
  const filtrulAscundeTot = randuri.length === 0 && records.length > 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Prezență</h1>
        <div className="flex flex-wrap items-center gap-2">
          {children.length > 1 && (
            <select
              aria-label="Copil"
              value={childId}
              onChange={(e) => setSelected(e.target.value)}
              className={cn(selectCls)}
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Perioadă"
            value={perioada}
            onChange={(e) => setPerioada(e.target.value as Perioada)}
            className={cn(selectCls)}
          >
            {PERIOADE.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {seIncarcaCopiii ? (
        // Fără asta, `children` e [] cât timp cererea zboară, iar părintele care
        // ARE copii vede o clipă îndemnul să adauge unul.
        <Skeleton className="h-40 rounded-3xl" />
      ) : !children.length ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Adaugă un copil pentru a vedea prezența.
        </div>
      ) : aEsuatCitirea ? (
        // O cădere de rețea nu e totuna cu un istoric gol: până acum amândouă
        // arătau „Nicio prezență înregistrată încă.”
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca prezența.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Încearcă din nou
          </Button>
        </div>
      ) : seIncarcaPrezenta ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : (
        <div className="space-y-4">
          <div className="bg-card shadow-card rounded-3xl p-5 text-sm">
            <span className="font-semibold">{prezente}</span>{' '}
            {plural(prezente, 'prezență', 'prezențe', true)} din{' '}
            <span className="font-semibold">{randuri.length}</span>{' '}
            {plural(randuri.length, 'ședință înregistrată', 'ședințe înregistrate', true)}.
            <p className="text-muted-foreground mt-1 text-xs">
              Se numără doar ședințele pontate de antrenor.
            </p>
          </div>

          {randuri.length ? (
            <ul className="space-y-2">
              {randuri.map((r) => (
                <li key={r.id} className="bg-card rounded-2xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {r.occurrence?.course?.name ?? 'Ședință'}
                      {r.occurrence?.starts_at ? ` · ${formatCand(r.occurrence.starts_at)}` : ''}
                    </span>
                    <span
                      className={cn(
                        'font-medium',
                        r.status === 'PRESENT' ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {r.status === 'PRESENT' ? 'Prezent' : 'Absent'}
                    </span>
                  </div>
                  {/* Nota antrenorului era citită din baza de date și aruncată. */}
                  {r.note && <p className="text-muted-foreground mt-1.5 text-xs">{r.note}</p>}
                </li>
              ))}
            </ul>
          ) : filtrulAscundeTot ? (
            <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
              <p>Nicio prezență în perioada aleasă.</p>
              <Button
                variant="outline"
                className="mt-4 h-11 min-h-11"
                type="button"
                onClick={() => setPerioada('toate')}
              >
                Vezi tot istoricul
              </Button>
            </div>
          ) : (
            <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
              Nicio prezență înregistrată încă.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
