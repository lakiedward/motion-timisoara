import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { setClubLocationActive } from '@/api/club'
import { getAllLocationsAdmin, type AdminLocation } from '@/api/locations/admin-locations'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { CourseFilterBar, type FilterOption } from './courses/CourseFilterBar'
import { plural } from '@/lib/plural'
import { LocationOrganizerCard } from './locations/LocationOrganizerCard'
import {
  NO_LOCATION_FILTERS,
  countLocations,
  filterLocations,
  groupByOrganizer,
  hasLocationFilters,
  locationStatusCounts,
  type LocationGroup,
  type LocationStatus,
} from './locations/location-overview'

const STATUS_OPTIONS: FilterOption<LocationStatus>[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'Toate' },
]

const SECTION_LABEL = {
  club: 'Cluburi',
  coach: 'Antrenori',
  shared: 'Fără organizator',
} as const

export default function AdminLocationsPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState(NO_LOCATION_FILTERS)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [toDeactivate, setToDeactivate] = useState<AdminLocation | null>(null)

  const {
    data: locations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-locations'], queryFn: getAllLocationsAdmin, retry: false })

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean; name: string }) =>
      setClubLocationActive(id, active),
    onMutate: ({ id }) => setPendingIds((l) => [...l, id]),
    onSettled: (_d, _e, { id }) => setPendingIds((l) => l.filter((x) => x !== id)),
    onSuccess: (_d, { active, name }) => {
      setToDeactivate(null)
      qc.invalidateQueries({ queryKey: ['admin-locations'] })
      toast.success(active ? `${name} e din nou activă.` : `${name} a fost dezactivată.`)
    },
    onError: () => toast.error('Nu am putut actualiza locația.'),
  })

  const query = filters.query
  const searching = query.trim().length > 0
  const counts = useMemo(() => locationStatusCounts(locations), [locations])
  const visible = useMemo(() => filterLocations(locations, filters), [locations, filters])
  const elsewhere = useMemo(
    () =>
      searching
        ? filterLocations(locations, { ...filters, status: 'all' }).length - visible.length
        : 0,
    [locations, filters, searching, visible.length],
  )
  const groups = useMemo(() => groupByOrganizer(locations, visible), [locations, visible])
  const firstOfKind = new Set(
    (['club', 'coach', 'shared'] as const).map((k) => groups.find((g) => g.kind === k)?.key),
  )

  const toggleKey = (g: LocationGroup) => `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: LocationGroup) =>
    toggled[toggleKey(g)] ?? (searching || firstOfKind.has(g.key))
  const onToggleLocation = (l: AdminLocation) =>
    l.is_active ? setToDeactivate(l) : toggle.mutate({ id: l.id, active: true, name: l.name })
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }))
  const clear = () => setFilters({ ...NO_LOCATION_FILTERS, status: 'all' })

  const courses = toDeactivate?.courseCount ?? 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">
          Locații
          {locations.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({locations.length})
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
            placeholder="Caută locație, adresă sau organizator"
            aria-label="Caută locații după nume, adresă sau organizator"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
        <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
          <Link to="/admin/locations/new">
            <Plus aria-hidden="true" /> Locație nouă
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <ClubLocationListSkeleton />
      ) : isError && locations.length === 0 ? (
        <StatusView
          state="error"
          title="Nu am putut încărca locațiile."
          onRetry={() => refetch()}
        />
      ) : locations.length === 0 ? (
        <StatusView
          state="empty"
          title="Nicio locație încă."
          text="Adaugă bazinele, sălile sau terenurile unde se țin cursurile."
          action={
            <Button asChild variant="outline" className="mt-3 h-touch-target min-h-touch-target">
              <Link to="/admin/locations/new">Adaugă prima locație</Link>
            </Button>
          }
        />
      ) : (
        <>
          <CourseFilterBar
            status={filters.status}
            sport=""
            statusCounts={counts}
            sports={[]}
            statusOptions={STATUS_OPTIONS}
            onStatus={(status) => set({ status })}
            onSport={() => {}}
          />
          <p role="status" className="text-muted-foreground text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countLocations(locations.length)}`
                : `${countLocations(visible.length)} la ${plural(groups.length, 'organizator', 'organizatori')}`)}
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
              title="Nicio locație pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasLocationFilters(filters) ? (
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
            (['club', 'coach', 'shared'] as const).map((kind) => {
              const ofKind = groups.filter((g) => g.kind === kind)
              if (!ofKind.length) return null
              return (
                <section key={kind} aria-label={SECTION_LABEL[kind]}>
                  <h2 className="text-muted-foreground mt-6 mb-2 text-xs font-semibold tracking-wider uppercase">
                    {SECTION_LABEL[kind]} · {ofKind.length}
                  </h2>
                  <div className="grid gap-3">
                    {ofKind.map((g) => (
                      <LocationOrganizerCard
                        key={g.key}
                        group={g}
                        query={query}
                        open={isOpen(g)}
                        expanded={expanded.has(g.key)}
                        pendingIds={pendingIds}
                        onToggleLocation={onToggleLocation}
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
        description={
          courses
            ? `Aici ${courses === 1 ? 'se ține' : 'se țin'} ${plural(courses, 'curs', 'cursuri')}. Cursurile nu se opresc, dar locația nu mai apare pe hartă și nu mai poate fi aleasă pentru cursuri noi.`
            : 'Locația nu mai apare pe hartă și nu mai poate fi aleasă pentru cursuri noi. O poți reactiva oricând.'
        }
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
