import { Check, X } from 'lucide-react'

import type { AttendanceRow } from '@/api/account'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'

interface HistoryProps {
  randuri: AttendanceRow[]
  numeDupaId: Map<string, string>
  cuNume: boolean
}

function prenume(nume: string): string {
  return nume.split(/\s+/)[0] ?? nume
}

function ora(startsAt: string): string {
  return new Date(startsAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function grupeLuni(randuri: AttendanceRow[]) {
  const grupe: { cheie: string; titlu: string; randuri: AttendanceRow[] }[] = []
  for (const r of randuri) {
    const d = r.occurrence?.starts_at ? new Date(r.occurrence.starts_at) : null
    const cheie = d ? `${d.getFullYear()}-${d.getMonth()}` : 'fara-data'
    const titlu = d
      ? d
          .toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
          .replace(/^./, (c) => c.toUpperCase())
      : 'Fără dată'
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
                const cand = r.occurrence?.starts_at
                const d = cand ? new Date(cand) : null
                const prezent = r.status === 'PRESENT'
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    {cand && d && (
                      <span className="sr-only">
                        {d.toLocaleDateString('ro-RO')} · {ora(cand)}
                      </span>
                    )}
                    <div
                      aria-hidden="true"
                      className="bg-secondary grid size-12 shrink-0 place-items-center rounded-lg text-center leading-none"
                    >
                      <span className="font-display text-lg font-extrabold">
                        {d?.getDate() ?? '–'}
                      </span>
                      <span className="text-muted-foreground text-[0.6875rem] uppercase">
                        {d
                          ? d.toLocaleDateString('ro-RO', { weekday: 'short' }).replace('.', '')
                          : ''}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {r.occurrence?.course?.name ?? 'Ședință'}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {cuNume ? `${prenume(numeDupaId.get(r.child_id) ?? 'Copil')} · ` : ''}
                        <span aria-hidden="true">{cand ? ora(cand) : ''}</span>
                      </p>
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
