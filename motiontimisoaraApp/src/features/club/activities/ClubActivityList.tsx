import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getClubActivities, getMyClub, setClubActivityActive, type ClubActivity } from '@/api/club'
import { PageHeader, PageNewLink } from '@/components/page-header/PageHeader'
import { ActivityListRow } from '@/components/panel-list/ActivityListRow'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { todayInBucharest } from '@/features/admin/activities/activity-overview'
import {
  coachActivitySportCounts,
  coachActivityStatusCounts,
  groupByMonth,
  isPast,
} from '@/features/coach/activities/coach-activity-overview'
import { plural } from '@/lib/plural'
import { ClubActivityFilterBar } from './ClubActivityFilterBar'
import {
  CLEARED_CLUB_ACTIVITY_FILTERS,
  NO_CLUB_ACTIVITY_FILTERS,
  clubActivityCoachCounts,
  filterClubActivities,
  hasClubActivityFilters,
} from './club-activity-filters'

type Toggle = { id: string; active: boolean; name: string }

export function ClubActivityList() {
  const qc = useQueryClient()
  const today = todayInBucharest()
  const [filters, setFilters] = useState(NO_CLUB_ACTIVITY_FILTERS)
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [toDeactivate, setToDeactivate] = useState<ClubActivity | null>(null)
  const {
    data: club,
    isLoading: clubLoading,
    isError: clubError,
    isFetching: clubFetching,
    refetch: refetchClub,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const listKey = ['club-activities', clubId]
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    isError: activitiesError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: listKey,
    queryFn: () => getClubActivities(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const isLoading = clubLoading || (!!clubId && activitiesLoading)
  const isError = (clubError || activitiesError) && activities.length === 0
  const retry = () => {
    if (clubError) void refetchClub()
    if (clubId && activitiesError) void refetch()
  }

  const toggle = useMutation({
    mutationFn: ({ id, active }: Toggle) => setClubActivityActive(id, active),
    onMutate: ({ id }) => setPendingIds((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setPendingIds((l) => l.filter((x) => x !== id)),
    onSuccess: (_d, { id, active, name }) => {
      setToDeactivate(null)
      qc.setQueryData<ClubActivity[]>(listKey, (list) =>
        list?.map((a) => (a.id === id ? { ...a, active } : a)),
      )
      void qc.invalidateQueries({ queryKey: listKey })
      toast.success(active ? `${name} e din nou activă.` : `${name} a fost dezactivată.`)
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { code?: string })?.code === '42501'
          ? 'Nu poți modifica această activitate: antrenorul ei nu face parte din club.'
          : 'Nu am putut actualiza activitatea.',
      ),
  })

  const counts = useMemo(() => coachActivityStatusCounts(activities, today), [activities, today])
  const sports = useMemo(() => coachActivitySportCounts(activities), [activities])
  const coaches = useMemo(() => clubActivityCoachCounts(activities), [activities])
  const months = useMemo(
    () => groupByMonth(filterClubActivities(activities, filters, today)),
    [activities, filters, today],
  )

  const onToggle = (a: ClubActivity) =>
    a.active && !isPast(a, today) && a.enrolled > 0
      ? setToDeactivate(a)
      : toggle.mutate({ id: a.id, active: !a.active, name: a.name })

  return (
    <div>
      <PageHeader title="Activitățile clubului" count={activities.length}>
        <PageNewLink to="/club/activities/new">Activitate nouă</PageNewLink>
      </PageHeader>

      {isLoading ? (
        <div role="status" aria-label="Se încarcă activitățile" className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca activitățile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={isFetching || clubFetching ? undefined : retry}
        />
      ) : activities.length === 0 ? (
        <StatusView
          state="empty"
          title="Nicio activitate încă."
          text="O activitate e un eveniment de o zi, cu dată, locație și preț."
          action={
            <Button asChild className="mt-3 h-touch-target min-h-touch-target">
              <Link to="/club/activities/new">
                <Plus aria-hidden="true" /> Creează prima activitate
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <ClubActivityFilterBar
            filters={filters}
            statusCounts={counts}
            sports={sports}
            coaches={coaches}
            onChange={setFilters}
          />
          {months.length === 0 ? (
            <StatusView
              state="empty"
              title="Nicio activitate pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasClubActivityFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={() => setFilters(CLEARED_CLUB_ACTIVITY_FILTERS)}
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
                      editTo={`/club/activities/${a.id}/edit`}
                      past={isPast(a, today)}
                      showCoach
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
