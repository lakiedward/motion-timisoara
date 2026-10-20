import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import {
  getAllActivitiesAdmin,
  setActivityActiveAdmin,
  type AdminActivity,
} from '@/api/activities/admin-activities'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { plural } from '@/lib/plural'
import { CourseFilterBar, type FilterOption } from './courses/CourseFilterBar'
import { ActivityOrganizerCard } from './activities/ActivityOrganizerCard'
import {
  NO_ACTIVITY_FILTERS,
  activitySportCounts,
  activityStatusCounts,
  countActivities,
  filterActivities,
  groupActivitiesByOrganizer,
  hasActivityFilters,
  todayInBucharest,
  type ActivityGroup,
  type ActivityStatus,
} from './activities/activity-overview'

const STATUS_OPTIONS: FilterOption<ActivityStatus>[] = [
  { value: 'upcoming', label: 'Viitoare' },
  { value: 'past', label: 'Încheiate' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

const SECTION_LABEL = { club: 'Cluburi', coach: 'Antrenori independenți' } as const

export default function AdminActivitiesPage() {
  const qc = useQueryClient()
  const today = todayInBucharest()
  const [filters, setFilters] = useState(NO_ACTIVITY_FILTERS)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [toDeactivate, setToDeactivate] = useState<AdminActivity | null>(null)

  const {
    data: activities = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-activities'], queryFn: getAllActivitiesAdmin, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean; name: string }) =>
      setActivityActiveAdmin(id, active),
    onMutate: ({ id }) => setPendingIds((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setPendingIds((l) => l.filter((x) => x !== id)),
    onSuccess: (_d, { active, name }) => {
      setToDeactivate(null)
      qc.invalidateQueries({ queryKey: ['admin-activities'] })
      toast.success(active ? `${name} e din nou activă.` : `${name} a fost dezactivată.`)
    },
    onError: () => toast.error('Nu am putut actualiza activitatea.'),
  })

  const { query, status } = filters
  const searching = query.trim().length > 0
  const upcomingFirst = status === 'upcoming'
  const counts = useMemo(() => activityStatusCounts(activities, today), [activities, today])
  const sports = useMemo(
    () =>
      activitySportCounts(filterActivities(activities, { status, sport: '', query: '' }, today)),
    [activities, status, today],
  )
  const visible = useMemo(
    () => filterActivities(activities, filters, today),
    [activities, filters, today],
  )
  const elsewhere = useMemo(
    () =>
      searching
        ? filterActivities(activities, { ...filters, status: 'all' }, today).length - visible.length
        : 0,
    [activities, filters, searching, visible.length, today],
  )
  const groups = useMemo(
    () => groupActivitiesByOrganizer(activities, visible, today, upcomingFirst),
    [activities, visible, today, upcomingFirst],
  )
  const firstOfKind = new Set(
    (['club', 'coach'] as const).map((k) => groups.find((g) => g.kind === k)?.key),
  )

  const toggleKey = (g: ActivityGroup) => `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: ActivityGroup) =>
    toggled[toggleKey(g)] ?? (searching || firstOfKind.has(g.key))
  const onToggleActivity = (a: AdminActivity) =>
    a.active && a.enrolled > 0
      ? setToDeactivate(a)
      : toggle.mutate({ id: a.id, active: !a.active, name: a.name })
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }))
  const clear = () => setFilters({ ...NO_ACTIVITY_FILTERS, status: 'all' })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">
          Activități
          {activities.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({activities.length})
            </span>
          )}
        </h1>
        <div className="relative order-last w-full md:order-none md:w-80">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Caută activitate, antrenor sau club"
            aria-label="Caută activități după nume, antrenor, club sau locație"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
        <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
          <Link to="/admin/activities/new">
            <Plus aria-hidden="true" /> Activitate nouă
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <ClubLocationListSkeleton />
      ) : isError && activities.length === 0 ? (
        <StatusView
          state="error"
          title="Nu am putut încărca activitățile."
          onRetry={() => refetch()}
        />
      ) : activities.length === 0 ? (
        <StatusView
          state="empty"
          title="Nicio activitate încă."
          text="Creează ateliere, ture sau evenimente de o zi pentru cluburi și antrenori."
          action={
            <Button asChild variant="outline" className="mt-3 h-touch-target min-h-touch-target">
              <Link to="/admin/activities/new">Creează prima activitate</Link>
            </Button>
          }
        />
      ) : (
        <>
          <CourseFilterBar
            status={status}
            sport={filters.sport}
            statusCounts={counts}
            sports={sports}
            statusOptions={STATUS_OPTIONS}
            selectId="admin-activity-sport"
            onStatus={(s) => set({ status: s })}
            onSport={(sport) => set({ sport })}
          />
          <p role="status" className="text-muted-foreground text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countActivities(activities.length)}`
                : `${countActivities(visible.length)} la ${plural(groups.length, 'organizator', 'organizatori')}`)}
            {elsewhere > 0 && (
              <>
                {visible.length > 0 && ' · '}
                <button
                  type="button"
                  onClick={() => set({ status: 'all' })}
                  className="text-primary inline-flex min-h-touch-target items-center font-semibold lg:min-h-0"
                >
                  {elsewhere === 1 ? 'Încă 1 rezultat' : `Încă ${elsewhere} rezultate`} în alte
                  filtre
                </button>
              </>
            )}
          </p>

          {visible.length === 0 ? (
            <StatusView
              state="empty"
              title="Nicio activitate pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasActivityFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-touch-target min-h-touch-target"
                    onClick={clear}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            (['club', 'coach'] as const).map((kind) => {
              const ofKind = groups.filter((g) => g.kind === kind)
              if (!ofKind.length) return null
              return (
                <section key={kind} aria-label={SECTION_LABEL[kind]}>
                  <h2 className="text-muted-foreground mt-6 mb-2 text-xs font-semibold tracking-wider uppercase">
                    {SECTION_LABEL[kind]} · {ofKind.length}
                  </h2>
                  <div className="grid gap-3">
                    {ofKind.map((g) => (
                      <ActivityOrganizerCard
                        key={g.key}
                        group={g}
                        query={query}
                        today={today}
                        open={isOpen(g)}
                        expanded={expanded.has(g.key)}
                        pendingIds={pendingIds}
                        onToggleActivity={onToggleActivity}
                        onOpenChange={(open) => setToggled((t) => ({ ...t, [toggleKey(g)]: open }))}
                        onExpand={() => setExpanded((e) => new Set(e).add(g.key))}
                      />
                    ))}
                  </div>
                </section>
              )
            })
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
        pending={toggle.isPending && toggle.variables?.id === toDeactivate?.id}
        onConfirm={() =>
          toDeactivate &&
          toggle.mutate({ id: toDeactivate.id, active: false, name: toDeactivate.name })
        }
      />
    </div>
  )
}
