import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { stergeFisiereleAnuntului } from '@/api/attachments'
import {
  getAllAnnouncementsAdmin,
  type AdminAnnouncement,
} from '@/api/announcements/admin-announcements'
import { deleteClubAnnouncement, setAnnouncementActive } from '@/api/club'
import { deleteCourseAnnouncement, setCourseAnnouncementPinned } from '@/api/coach-announcements'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { StatusView } from '@/components/ui/status-view'
import { CourseFilterBar, type FilterOption } from '@/features/admin/courses/CourseFilterBar'
import { ClubLocationListSkeleton } from '@/features/club/locations/ClubLocationListSkeleton'
import { plural } from '@/lib/plural'
import { AdminAnnouncementItem } from './AdminAnnouncementItem'
import { AnnouncementOrganizerCard } from './AnnouncementOrganizerCard'
import {
  NO_ANNOUNCEMENT_FILTERS,
  announcementLabel,
  announcementStatusCounts,
  countAnnouncements,
  filterAnnouncements,
  groupAnnouncementsByMonth,
  groupAnnouncementsByOrganizer,
  hasAnnouncementFilters,
  sourceCounts,
  type AnnouncementGroup,
  type AnnouncementStatus,
} from './announcement-overview'

const STATUS_OPTIONS: FilterOption<AnnouncementStatus>[] = [
  { value: 'visible', label: 'Vizibile' },
  { value: 'hidden', label: 'Ascunse' },
  { value: 'pinned', label: 'Fixate' },
  { value: 'all', label: 'Toate' },
]

const SECTION_LABEL = { club: 'Cluburi', coach: 'Antrenori independenți' } as const
const PAGE = 15

async function toggleAnnouncement(a: AdminAnnouncement) {
  if (a.source === 'club') await setAnnouncementActive(a.id, !a.visible)
  else await setCourseAnnouncementPinned(a.id, !a.pinned)
}

async function deleteAnnouncement(a: AdminAnnouncement) {
  await stergeFisiereleAnuntului(a.id, a.source)
  if (a.source === 'club') await deleteClubAnnouncement(a.id)
  else await deleteCourseAnnouncement(a.id)
}

function toggledMessage(a: AdminAnnouncement) {
  if (a.source === 'club')
    return a.visible ? 'Anunț ascuns de părinți.' : 'Anunțul se vede din nou la părinți.'
  return a.pinned ? 'Anunț desprins.' : 'Anunț fixat sus.'
}

export default function AdminAnnouncementsPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const feed = params.get('varianta') === 'b'
  const [filters, setFilters] = useState(NO_ANNOUNCEMENT_FILTERS)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [toDelete, setToDelete] = useState<AdminAnnouncement | null>(null)

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: getAllAnnouncementsAdmin,
    retry: false,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-announcements'] })
  const toggle = useMutation({
    mutationFn: toggleAnnouncement,
    onMutate: (a) => setPendingIds((l) => [...l, a.id]),
    onSettled: (_d, _e, a) => setPendingIds((l) => l.filter((x) => x !== a.id)),
    onSuccess: (_d, a) => {
      refresh()
      toast.success(toggledMessage(a))
    },
    onError: () => toast.error('Nu am putut schimba anunțul.'),
  })
  const del = useMutation({
    mutationFn: deleteAnnouncement,
    onMutate: (a) => setPendingIds((l) => [...l, a.id]),
    onSettled: (_d, _e, a) => setPendingIds((l) => l.filter((x) => x !== a.id)),
    onSuccess: () => {
      setToDelete(null)
      refresh()
      toast.success('Anunț șters.')
    },
    onError: () => toast.error('Nu am putut șterge anunțul.'),
  })

  const { query, status } = filters
  const searching = query.trim().length > 0
  const counts = useMemo(() => announcementStatusCounts(items), [items])
  const sources = useMemo(
    () => sourceCounts(filterAnnouncements(items, { status, source: '', query: '' })),
    [items, status],
  )
  const visible = useMemo(() => filterAnnouncements(items, filters), [items, filters])
  const elsewhere = searching
    ? filterAnnouncements(items, { ...filters, status: 'all' }).length - visible.length
    : 0
  const groups = useMemo(() => groupAnnouncementsByOrganizer(items, visible), [items, visible])
  const firstOfKind = new Set(
    (['club', 'coach'] as const).map((k) => groups.find((g) => g.kind === k)?.key),
  )

  const toggleKey = (g: AnnouncementGroup) => `${searching ? `q:${query.trim()}:` : ''}${g.key}`
  const isOpen = (g: AnnouncementGroup) =>
    toggled[toggleKey(g)] ?? (searching || firstOfKind.has(g.key))
  const set = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setLimit(PAGE)
  }
  const clear = () => set({ ...NO_ANNOUNCEMENT_FILTERS, status: 'all' })
  const shown = visible.slice(0, limit)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">
          Anunțuri
          {items.length > 0 && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({items.length})
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
            placeholder="Caută în anunțuri, club sau curs"
            aria-label="Caută anunțuri după text, organizator sau curs"
            className="h-touch-target min-h-touch-target pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
        <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
          <Link to="/admin/announcements/new">
            <Plus aria-hidden="true" /> Anunț nou
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <ClubLocationListSkeleton />
      ) : isError && items.length === 0 ? (
        <StatusView
          state="error"
          title="Nu am putut încărca anunțurile."
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <StatusView
          state="empty"
          title="Niciun anunț încă."
          text="Anunțurile cluburilor și ale antrenorilor apar aici."
          action={
            <Button asChild variant="outline" className="mt-3 h-touch-target min-h-touch-target">
              <Link to="/admin/announcements/new">Scrie primul anunț</Link>
            </Button>
          }
        />
      ) : (
        <>
          <CourseFilterBar
            status={status}
            sport={filters.source}
            statusCounts={counts}
            sports={sources}
            statusOptions={STATUS_OPTIONS}
            selectId="admin-announcement-source"
            sportLabel="Trimis de"
            allSportsLabel="Toți expeditorii"
            onStatus={(s) => set({ status: s })}
            onSport={(source) => set({ source: source as typeof filters.source })}
          />
          <p role="status" className="text-muted-foreground text-sm">
            {visible.length > 0 &&
              (searching
                ? `${visible.length} din ${countAnnouncements(items.length)}`
                : feed
                  ? countAnnouncements(visible.length)
                  : `${countAnnouncements(visible.length)} la ${plural(groups.length, 'organizator', 'organizatori')}`)}
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
              title="Niciun anunț pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasAnnouncementFilters(filters) ? (
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
          ) : feed ? (
            <div className="mt-4 max-w-3xl space-y-6">
              {groupAnnouncementsByMonth(shown).map((g) => (
                <section key={g.key} aria-label={g.title}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-base font-semibold">{g.title}</h2>
                    <span className="text-muted-foreground text-sm">
                      {countAnnouncements(g.items.length)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {g.items.map((a) => (
                      <AdminAnnouncementItem
                        key={`${a.source}-${a.id}`}
                        announcement={a}
                        query={query}
                        layout="card"
                        pending={pendingIds.includes(a.id)}
                        onToggle={() => toggle.mutate(a)}
                        onDelete={() => setToDelete(a)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {visible.length > shown.length && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-muted-foreground text-sm">
                    Vezi {shown.length} din {visible.length}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-touch-target min-h-touch-target"
                    onClick={() => setLimit((n) => n + PAGE)}
                  >
                    Arată încă {Math.min(PAGE, visible.length - shown.length)}
                  </Button>
                </div>
              )}
            </div>
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
                      <AnnouncementOrganizerCard
                        key={g.key}
                        group={g}
                        query={query}
                        open={isOpen(g)}
                        expanded={expanded.has(g.key)}
                        pendingIds={pendingIds}
                        onToggleItem={(a) => toggle.mutate(a)}
                        onDeleteItem={setToDelete}
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
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete ? `Ștergi anunțul „${announcementLabel(toDelete)}”?` : ''}
        description="Anunțul dispare definitiv, inclusiv pentru părinți, împreună cu pozele și filmarea lui. Acțiunea este ireversibilă."
        confirmLabel="Șterge"
        destructive
        pending={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete)}
      />
    </div>
  )
}
