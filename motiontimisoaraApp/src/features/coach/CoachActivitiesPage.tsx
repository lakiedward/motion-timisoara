import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { getMyActivities, setActivityActive, type CoachActivity } from '@/api/coach'
import { PageHeader, PageNewLink } from '@/components/page-header/PageHeader'
import { ActivityListRow } from '@/components/panel-list/ActivityListRow'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { todayInBucharest } from '@/features/admin/activities/activity-overview'
import { plural } from '@/lib/plural'
import { CoachActivityFilterBar } from './activities/CoachActivityFilterBar'
import {
  CLEARED_COACH_ACTIVITY_FILTERS,
  NO_COACH_ACTIVITY_FILTERS,
  coachActivitySportCounts,
  coachActivityStatusCounts,
  filterCoachActivities,
  groupByMonth,
  hasCoachActivityFilters,
  isPast,
} from './activities/coach-activity-overview'

type Toggle = { id: string; active: boolean; name: string }

export default function CoachActivitiesPage() {
  const qc = useQueryClient()
  const today = todayInBucharest()
  const [filters, setFilters] = useState(NO_COACH_ACTIVITY_FILTERS)
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [toDeactivate, setToDeactivate] = useState<CoachActivity | null>(null)
  const {
    data: activities = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['my-activities'], queryFn: getMyActivities, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, active }: Toggle) => setActivityActive(id, active),
    onMutate: ({ id }) => setPendingIds((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setPendingIds((l) => l.filter((x) => x !== id)),
    onSuccess: (_d, { id, active, name }) => {
      setToDeactivate(null)
      qc.setQueryData<CoachActivity[]>(['my-activities'], (list) =>
        list?.map((a) => (a.id === id ? { ...a, active } : a)),
      )
      void qc.invalidateQueries({ queryKey: ['my-activities'] })
      toast.success(active ? `${name} e din nou activă.` : `${name} a fost dezactivată.`)
    },
    onError: () => toast.error('Nu am putut actualiza activitatea.'),
  })

  const counts = useMemo(() => coachActivityStatusCounts(activities, today), [activities, today])
  const sports = useMemo(() => coachActivitySportCounts(activities), [activities])
  const months = useMemo(
    () => groupByMonth(filterCoachActivities(activities, filters, today)),
    [activities, filters, today],
  )

  const onToggle = (a: CoachActivity) =>
    a.active && !isPast(a, today) && a.enrolled > 0
      ? setToDeactivate(a)
      : toggle.mutate({ id: a.id, active: !a.active, name: a.name })

  return (
    <div>
      <PageHeader title="Activitățile mele" count={activities.length}>
        <PageNewLink to="/coach/activities/new">Activitate nouă</PageNewLink>
      </PageHeader>

      {isLoading ? (
        <div role="status" aria-label="Se încarcă activitățile" className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError && activities.length === 0 ? (
        <StatusView
          state="error"
          title="Nu am putut încărca activitățile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={isFetching ? undefined : () => void refetch()}
        />
      ) : activities.length === 0 ? (
        <StatusView
          state="empty"
          title="Nicio activitate încă."
          text="Activitățile pe care le creezi apar aici."
          action={
            <Button asChild variant="outline" className="mt-3 h-touch-target min-h-touch-target">
              <Link to="/coach/activities/new">Creează prima activitate</Link>
            </Button>
          }
        />
      ) : (
        <>
          <CoachActivityFilterBar
            filters={filters}
            statusCounts={counts}
            sports={sports}
            onChange={setFilters}
          />
          {months.length === 0 ? (
            <StatusView
              state="empty"
              title="Nicio activitate pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasCoachActivityFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={() => setFilters(CLEARED_COACH_ACTIVITY_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            months.map((m, i) => (
              <section key={m.key} aria-label={m.title} className={i ? 'mt-6' : undefined}>
                <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  {m.title}
                </h2>
                <ul className="bg-card divide-y overflow-hidden rounded-xl border">
                  {m.activities.map((a) => (
                    <ActivityListRow
                      key={a.id}
                      activity={a}
                      editTo={`/coach/activities/${a.id}/edit`}
                      past={isPast(a, today)}
                      query={filters.query}
                      pending={pendingIds.includes(a.id)}
                      onToggle={() => onToggle(a)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(open) => !open && setToDeactivate(null)}
        title={`Dezactivezi „${toDeactivate?.name ?? ''}”?`}
        description={`Are ${plural(toDeactivate?.enrolled ?? 0, 'înscriere activă', 'înscrieri active')}. Înscrierile rămân, dar activitatea nu mai apare public și nu mai primește înscrieri noi.`}
        confirmLabel="Dezactivează"
        destructive
        pending={!!toDeactivate && pendingIds.includes(toDeactivate.id)}
        onConfirm={() =>
          toDeactivate &&
          toggle.mutate({ id: toDeactivate.id, active: false, name: toDeactivate.name })
        }
      />
    </div>
  )
}
