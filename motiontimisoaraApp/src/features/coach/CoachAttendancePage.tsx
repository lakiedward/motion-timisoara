import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { childAge } from '@/api/account'
import {
  getCoachSessions,
  getSessionRoster,
  markAttendance,
  markManyPresent,
  PAST_VISIBLE_DAYS,
  SESSION_GROUP_LIMIT,
  type CoachSession,
  type RosterEntry,
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

function isRetroactive(startsAt: string) {
  return Date.now() - new Date(startsAt).getTime() > PAST_VISIBLE_DAYS * 24 * 60 * 60 * 1000
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
  // Pe telefon pontarea are ecranul ei: lista de ședințe se strânge până la „Înapoi”.
  const [markingOnPhone, setMarkingOnPhone] = useState(false)

  const upcoming = groups?.upcoming ?? []
  const past = groups?.past ?? []
  const total = upcoming.length + past.length

  const recentCount = groups?.pastRecentCount ?? 0
  const foldPast = !showOlder && (upcoming.length > 0 || recentCount > 0)
  const visiblePast = foldPast ? past.slice(0, recentCount) : past
  const olderCount = past.length - visiblePast.length

  const ordered = [...upcoming, ...visiblePast]
  const sel = ordered.find((s) => s.id === selectedId) ?? ordered[0] ?? null

  const {
    data: roster = [],
    isLoading: rosterLoading,
    isError: rosterError,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: ['roster', sel?.id],
    queryFn: () => getSessionRoster(sel!.course!.id, sel!.id),
    enabled: !!sel?.course,
    retry: false,
  })

  const marked = roster.filter((r) => r.status !== null).length
  const unmarked = roster.filter((r) => r.status === null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['roster', sel?.id] })
    // Marcajul „Pontată” de pe cardul de ședință se ia din aceeași sursă.
    qc.invalidateQueries({ queryKey: ['coach-sessions'] })
  }

  const mark = useMutation({
    mutationFn: ({ childId, status }: { childId: string; status: RosterEntry['status']; childName: string }) =>
      markAttendance(sel!.id, childId, status),
    onSuccess: invalidate,
    // La o grupă de 20 de copii, „nu am putut salva” fără nume nu ajută pe nimeni.
    onError: (_e, v) => toast.error(`Nu am putut salva prezența pentru ${v.childName}.`),
  })

  const markAll = useMutation({
    mutationFn: () => markManyPresent(sel!.id, unmarked.map((r) => r.child_id)),
    onSuccess: invalidate,
    onError: () => toast.error('Nu am putut marca toți copiii prezenți.'),
  })

  const busy = mark.isPending || markAll.isPending

  /** Contorul și acțiunea în masă, aceleași pe toate ecranele. */
  const catalogActions = roster.length ? (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">
        {marked} din {roster.length} pontați
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11 min-h-11 lg:h-9 lg:min-h-9"
        disabled={busy || !unmarked.length}
        onClick={() => markAll.mutate()}
      >
        Toți prezenți
      </Button>
    </div>
  ) : null

  const rosterPanel = !sel ? null : rosterLoading ? (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 rounded-3xl lg:h-16" />
      ))}
    </div>
  ) : rosterError ? (
    <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
      <p className="text-foreground font-medium">Nu am putut încărca lista de copii.</p>
      <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetchRoster()}>
        Reîncearcă
      </Button>
    </div>
  ) : roster.length ? (
    <ul className="space-y-2">
      {roster.map((r) => (
        <li
          key={r.child_id}
          className="bg-card shadow-card flex flex-col gap-3 rounded-3xl border p-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="min-w-0">
            <div className="line-clamp-1 font-medium lg:line-clamp-2">{r.child_name}</div>
            <div className="text-muted-foreground text-sm">{childAge(r.child_birth_date)} ani</div>
          </div>
          <div className="flex gap-3 lg:shrink-0">
            {(['PRESENT', 'ABSENT'] as const).map((status) => {
              const active = r.status === status
              return (
                <Button
                  key={status}
                  size="sm"
                  variant={active ? (status === 'PRESENT' ? 'default' : 'destructive') : 'outline'}
                  aria-pressed={active}
                  disabled={busy}
                  className="h-11 min-h-11 flex-1 lg:h-9 lg:min-h-9 lg:flex-none"
                  // A doua apăsare pe butonul activ șterge pontarea: altfel o atingere
                  // greșită lângă bazin rămâne înregistrată pentru totdeauna.
                  onClick={() =>
                    mark.mutate({
                      childId: r.child_id,
                      childName: r.child_name,
                      status: active ? null : status,
                    })
                  }
                >
                  {status === 'PRESENT' ? 'Prezent' : 'Absent'}
                </Button>
              )
            })}
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <div className="text-muted-foreground bg-card rounded-3xl border border-dashed px-6 py-16 text-center">
      Niciun copil înscris la acest curs încă. Înscrierile le fac părinții din contul lor — lista se
      completează singură pe măsură ce se înscriu.
    </div>
  )

  function sessionCard(s: CoachSession) {
    const active = sel?.id === s.id
    return (
      <li key={s.id} className={cn(markingOnPhone && !active && 'hidden md:block')}>
        <button
          onClick={() => {
            setSelectedId(s.id)
            setMarkingOnPhone(true)
          }}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'shadow-card w-full rounded-3xl border-2 p-4 text-left text-sm outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            active ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 min-w-0 font-semibold">{s.course?.name}</span>
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
        {/* Pe telefon catalogul se deschide sub ședința aleasă, singura rămasă pe ecran. */}
        {active && markingOnPhone && (
          <div className="mt-3 space-y-3 md:hidden">
            {sel && isRetroactive(sel.starts_at) && (
              <Badge variant="outline">Pontare retroactivă</Badge>
            )}
            {catalogActions}
            {rosterPanel}
          </div>
        )}
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
          <div className="min-w-0 space-y-2 md:-mx-1.5 md:max-h-[70vh] md:overflow-y-auto md:px-1.5">
            {markingOnPhone && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 min-h-11 -ml-2 md:hidden"
                onClick={() => setMarkingOnPhone(false)}
              >
                <ArrowLeft /> Înapoi la ședințe
              </Button>
            )}

            <h2
              className={cn(
                'text-muted-foreground text-sm font-semibold',
                markingOnPhone && 'hidden md:block'
              )}
            >
              Ședințe ({upcoming.length + visiblePast.length})
            </h2>

            {upcoming.length > 0 && (
              <section className="space-y-2">
                <h3
                  className={cn(
                    'text-muted-foreground pt-1 text-xs font-semibold uppercase',
                    markingOnPhone && 'hidden md:block'
                  )}
                >
                  Următoarele
                </h3>
                <ul className="space-y-2">{upcoming.map(sessionCard)}</ul>
              </section>
            )}

            {past.length > 0 && (
              <section className="space-y-2">
                <h3
                  className={cn(
                    'text-muted-foreground pt-3 text-xs font-semibold uppercase',
                    markingOnPhone && 'hidden md:block'
                  )}
                >
                  Trecute
                </h3>
                <ul className="space-y-2">{visiblePast.map(sessionCard)}</ul>
                {!showOlder && olderCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('h-11 min-h-11 w-full', markingOnPhone && 'hidden md:flex')}
                    onClick={() => setShowOlder(true)}
                  >
                    Vezi mai mult ({olderCount})
                  </Button>
                )}
              </section>
            )}

            {groups?.truncated && (
              <p
                className={cn(
                  'text-muted-foreground pt-2 text-xs',
                  markingOnPhone && 'hidden md:block'
                )}
              >
                Se afișează primele {SESSION_GROUP_LIMIT} de ședințe din fiecare grup. Ai mai multe
                ședințe decât atât.
              </p>
            )}
          </div>

          {/* Catalog — pe telefon trăiește sub ședința aleasă, nu aici */}
          <div className="hidden min-w-0 md:flex md:max-h-[70vh] md:flex-col md:gap-2 md:overflow-hidden">
            <div className="space-y-2">
              <h2 className="text-muted-foreground text-sm font-semibold">
                {sel ? `Prezență · ${sel.course?.name} · ${formatWhen(sel.starts_at)}` : ''}
                {sel && isRetroactive(sel.starts_at) && (
                  <Badge variant="outline" className="ml-2">
                    Pontare retroactivă
                  </Badge>
                )}
              </h2>
              {catalogActions}
            </div>
            <div className="-mx-1.5 overflow-y-auto px-1.5">{rosterPanel}</div>
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
