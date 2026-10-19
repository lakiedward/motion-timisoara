import { Check, UserRound, X } from 'lucide-react'

import type { AttendanceRow } from '@/api/account'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'

interface HistoryProps {
  randuri: AttendanceRow[]
  numeDupaId: Map<string, string>
  cuNume: boolean
}

const TZ = 'Europe/Bucharest'
const zi = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', timeZone: TZ })
const ziSaptamana = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', timeZone: TZ })
const luna = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: TZ })
const ora = new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const complet = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

function grupeLuni(randuri: AttendanceRow[]) {
  const grupe: { cheie: string; titlu: string; randuri: AttendanceRow[] }[] = []
  for (const r of randuri) {
    const d = r.occurrence?.starts_at ? new Date(r.occurrence.starts_at) : null
    const titlu = d ? capitalize(luna.format(d)) : 'Fără dată'
    const cheie = titlu
    const ultima = grupe[grupe.length - 1]
    if (ultima?.cheie === cheie) ultima.randuri.push(r)
    else grupe.push({ cheie, titlu, randuri: [r] })
  }
  return grupe
}

export function AttendanceMonths({ randuri, numeDupaId, cuNume }: HistoryProps) {
  return (
    <div className="space-y-6">
      {grupeLuni(randuri).map((g) => {
        const prezente = g.randuri.filter((r) => r.status === 'PRESENT').length
        return (
          <section key={g.cheie} aria-label={g.titlu}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{g.titlu}</h2>
              <span className="text-muted-foreground text-sm">
                {prezente} {plural(prezente, 'prezență', 'prezențe', true)} din {g.randuri.length}
              </span>
            </div>
            <ul className="bg-card divide-y overflow-hidden rounded-xl border">
              {g.randuri.map((r) => {
                const d = r.occurrence?.starts_at ? new Date(r.occurrence.starts_at) : null
                const prezent = r.status === 'PRESENT'
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    {d && (
                      <span className="sr-only">
                        {capitalize(complet.format(d).replace(' la ', ', '))}
                      </span>
                    )}
                    <div
                      aria-hidden="true"
                      className="bg-secondary grid size-12 shrink-0 place-items-center rounded-lg text-center leading-none"
                    >
                      <span className="font-display text-lg font-extrabold">
                        {d ? zi.format(d) : '–'}
                      </span>
                      <span className="text-muted-foreground text-[0.6875rem] uppercase">
                        {d ? ziSaptamana.format(d).replace('.', '') : ''}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.occurrence?.course?.name ?? 'Ședință'}</p>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                        {d && <span aria-hidden="true">{ora.format(d)}</span>}
                        {cuNume && (
                          <span className="text-foreground flex items-center gap-1.5 font-medium">
                            <UserRound
                              aria-hidden="true"
                              className="text-muted-foreground size-4 shrink-0"
                            />
                            {numeDupaId.get(r.child_id) ?? 'Copil'}
                          </span>
                        )}
                      </div>
                      {r.note && <p className="text-muted-foreground mt-1 text-xs">{r.note}</p>}
                    </div>
                    <span
                      className={cn(
                        'flex shrink-0 items-center gap-1 text-sm font-semibold',
                        prezent ? 'text-success-ink' : 'text-destructive',
                      )}
                    >
                      {prezent ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : (
                        <X aria-hidden="true" className="size-4" />
                      )}
                      {prezent ? 'Prezent' : 'Absent'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
