import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getCoachSessions, getSessionRoster, markAttendance, type CoachSession } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']

export default function CoachAttendancePage() {
  const qc = useQueryClient()
  const { data: sessions = [], isLoading } = useQuery({ queryKey: ['coach-sessions'], queryFn: getCoachSessions })
  const [sel, setSel] = useState<CoachSession | null>(null)

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', sel?.id],
    queryFn: () => getSessionRoster(sel!.course!.id, sel!.id),
    enabled: !!sel?.course,
  })

  const mark = useMutation({
    mutationFn: ({ childId, status }: { childId: string; status: 'PRESENT' | 'ABSENT' }) =>
      markAttendance(sel!.id, childId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', sel?.id] }),
    onError: () => toast.error('Nu am putut salva prezența.'),
  })

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold text-foreground">Prezență</h1>

      {isLoading ? (
        <Skeleton className="h-40 rounded-3xl" />
      ) : sessions.length ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Sessions */}
          <div className="space-y-2">
            <h2 className="text-muted-foreground text-sm font-semibold">Ședințe</h2>
            <ul className="space-y-2">
              {sessions.map((s) => {
                const d = new Date(s.starts_at)
                const active = sel?.id === s.id
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSel(s)}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left text-sm transition-colors',
                        active ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent'
                      )}
                    >
                      <div className="font-semibold">{s.course?.name}</div>
                      <div className="text-muted-foreground">
                        {WEEKDAYS[d.getDay()]} {d.toLocaleDateString('ro-RO')} ·{' '}
                        {d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Roster */}
          <div>
            <h2 className="text-muted-foreground mb-2 text-sm font-semibold">
              {sel ? `Prezență · ${sel.course?.name}` : 'Alege o ședință'}
            </h2>
            {!sel ? (
              <div className="text-muted-foreground bg-card rounded-3xl border border-dashed py-16 text-center">
                Selectează o ședință din stânga.
              </div>
            ) : rosterLoading ? (
              <Skeleton className="h-40 rounded-3xl" />
            ) : roster.length ? (
              <ul className="space-y-2">
                {roster.map((r) => (
                  <li key={r.child_id} className="bg-card flex items-center justify-between rounded-2xl border p-3">
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
            )}
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Nicio ședință programată. Adaugă ședințe la cursurile tale.
        </div>
      )}
    </div>
  )
}
