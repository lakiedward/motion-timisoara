import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getCoachSessions,
  getSessionRoster,
  markAttendance,
  SESSION_GROUP_LIMIT,
  type CoachSession,
} from '@/api/coach'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

function formatWhen(startsAt: string) {
  const d = new Date(startsAt)
  const date = d.toLocaleDateString('ro-RO')
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  return `${WEEKDAYS[d.getDay()]} ${date} · ${time}`
}

export default function CoachAttendancePage() {
  const qc = useQueryClient()
  const {
    data: groups,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['coach-sessions'],
    queryFn: getCoachSessions,
    retry: false,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showOlder, setShowOlder] = useState(false)

  const upcoming = groups?.upcoming ?? []
  const past = groups?.past ?? []
  const total = upcoming.length + past.length

  const olderCount = past.length - (groups?.pastRecentCount ?? 0)
  const visiblePast = showOlder ? past : past.slice(0, groups?.pastRecentCount ?? 0)

  // Fără selecție proprie, pagina se deschide pe ședința cea mai apropiată de acum:
  // `upcoming` e crescător, deci primul element e ori cea de azi, ori următoarea;
  // dacă antrenorul n-are ședințe viitoare, cade pe cea mai recentă trecută.
  const ordered = [...upcoming, ...past]
  const sel = ordered.find((s) => s.id === selectedId) ?? ordered[0] ?? null

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', sel?.id],
    queryFn: () => getSessionRoster(sel!.course!.id, sel!.id),
    enabled: !!sel?.course,
  })

  const mark = useMutation({
    mutationFn: ({ childId, status }: { childId: string; status: 'PRESENT' | 'ABSENT' }) =>
      markAttendance(sel!.id, childId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', sel?.id] })
      // Marcajul „Pontată” de pe card se ia din aceeași sursă, deci trebuie reîmprospătat.
      qc.invalidateQueries({ queryKey: ['coach-sessions'] })
    },
    onError: () => toast.error('Nu am putut salva prezența.'),
  })

  const rosterPanel = !sel ? null : rosterLoading ? (
    <Skeleton className="h-40 rounded-3xl" />
  ) : roster.length ? (
    <ul className="space-y-2">
      {roster.map((r) => (
        <li
          key={r.child_id}
          className="bg-card flex items-center justify-between rounded-2xl border p-3"
        >
          <span className="font-medium">{r.child_name}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={r.status === 'PRESENT' ? 'default' : 'outline'}
              disabled={mark.isPending}
              onClick={() => mark.mutate({ childId: r.child_id, status: 'PRESENT' })}
            >
              Prezent
            </Button>
            <Button
              size="sm"
              variant={r.status === 'ABSENT' ? 'destructive' : 'outline'}
              disabled={mark.isPending}
              onClick={() => mark.mutate({ childId: r.child_id, status: 'ABSENT' })}
            >
              Absent
            </Button>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <div className="text-muted-foreground bg-card rounded-3xl border border-dashed py-16 text-center">
      Niciun copil înscris la acest curs încă.
    </div>
  )

  function sessionCard(s: CoachSession) {
    const active = sel?.id === s.id
    return (
      <li key={s.id}>
        <button
          onClick={() => setSelectedId(s.id)}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'shadow-card w-full rounded-3xl border-2 p-4 text-left text-sm outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 font-semibold">{s.course?.name}</span>
            <Badge variant={s.attendance_recorded ? 'success' : 'outline'}>
              {s.attendance_recorded ? 'Pontată' : 'Nepontată'}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-1">{formatWhen(s.starts_at)}</div>
          <div className="text-muted-foreground mt-0.5">
            {s.course?.location?.name ?? '—'} · {s.enrolled_count}{' '}
            {s.enrolled_count === 1 ? 'copil' : 'copii'}
          </div>
        </button>
        {/* Pe telefon catalogul se deschide chiar sub ședința apăsată. */}
        {active && <div className="mt-2 md:hidden">{rosterPanel}</div>}
      </li>
    )
  }

  return (
    <div>
      <h1 className="font-display text-foreground mb-6 text-2xl font-bold">Prezență</h1>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
          <Skeleton className="hidden h-40 rounded-3xl md:block" />
        </div>
      ) : isError && !total ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca ședințele.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : total ? (
        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          {/* Ședințe */}
          {/* `overflow-y` forțează și `overflow-x`, deci lista are nevoie de padding
              lateral ca să nu taie inelul de focus; marginea negativă o readuce la
              aceeași aliniere cu titlul de deasupra. */}
          <div className="space-y-2 md:-mx-1.5 md:max-h-[70vh] md:overflow-y-auto md:px-1.5">
            <h2 className="text-muted-foreground text-sm font-semibold">
              Ședințe ({upcoming.length + visiblePast.length})
            </h2>

            {upcoming.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-muted-foreground pt-1 text-xs font-semibold uppercase">
                  Următoarele
                </h3>
                <ul className="space-y-2">{upcoming.map(sessionCard)}</ul>
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-muted-foreground pt-3 text-xs font-semibold uppercase">
                  Trecute
                </h3>
                <ul className="space-y-2">{visiblePast.map(sessionCard)}</ul>
                {!showOlder && olderCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 w-full"
                    onClick={() => setShowOlder(true)}
                  >
                    Vezi mai mult ({olderCount})
                  </Button>
                )}
              </section>
            )}

            {groups?.truncated && (
              <p className="text-muted-foreground pt-2 text-xs">
                Se afișează primele {SESSION_GROUP_LIMIT} de ședințe din fiecare grup. Ai mai multe
                ședințe decât atât.
              </p>
            )}
          </div>

          {/* Catalog */}
          <div className="hidden md:block">
            <h2 className="text-muted-foreground mb-2 text-sm font-semibold">
              {sel ? `Prezență · ${sel.course?.name}` : 'Alege o ședință'}
            </h2>
            {sel ? (
              rosterPanel
            ) : (
              <div className="text-muted-foreground bg-card rounded-3xl border border-dashed py-16 text-center">
                Selectează o ședință din listă.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">
            Nicio ședință programată. Adaugă ședințe la cursurile tale.
          </p>
          <Button asChild className="mt-4 h-11 min-h-11">
            <Link to="/coach/courses">Mergi la Cursurile mele</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
