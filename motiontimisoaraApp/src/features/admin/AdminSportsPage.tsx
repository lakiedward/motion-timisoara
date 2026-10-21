import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { fetchSports, type Sport } from '@/api/sports'
import {
  clearSportDefaultPhoto,
  createSport,
  deleteSport,
  normalizeSportCode,
  setSportDefaultPhoto,
  sportErrorMessage,
  sportNameError,
  type SportPhotoResult,
} from '@/api/sports/admin-sports'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import { plural } from '@/lib/plural'
import { CourseFilterBar, type FilterOption } from './courses/CourseFilterBar'
import { SportGroupCard } from './sports/SportGroupCard'
import { SportRow } from './sports/SportRow'
import {
  NO_SPORT_FILTERS,
  filterSports,
  groupSports,
  hasSportFilters,
  photoCounts,
  type PhotoFilter,
} from './sports/sport-overview'

const TOUCH = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

const PHOTO_OPTIONS: FilterOption<PhotoFilter>[] = [
  { value: 'all', label: 'Toate' },
  { value: 'without', label: 'Fără poză standard' },
  { value: 'with', label: 'Cu poză standard' },
]

const countSports = (n: number) => plural(n, 'sport', 'sporturi')

export default function AdminSportsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [filters, setFilters] = useState(NO_SPORT_FILTERS)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [toDelete, setToDelete] = useState<Sport | null>(null)
  const pending = useRef(false)
  const {
    data: sports = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({ queryKey: ['sports'], queryFn: fetchSports })

  const visible = useMemo(() => filterSports(sports, filters), [sports, filters])
  const groups = useMemo(() => groupSports(visible), [visible])
  const counts = useMemo(() => photoCounts(sports), [sports])
  const query = filters.query
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }))

  const settle = () => {
    pending.current = false
  }
  const fail = (error: unknown, fallback: string) => {
    const message = sportErrorMessage(error, fallback)
    setFeedback(message)
    toast.error(message)
  }
  const refreshPhotos = () => {
    qc.invalidateQueries({ queryKey: ['sports'] })
    qc.invalidateQueries({ queryKey: ['courses'] })
    qc.invalidateQueries({ queryKey: ['course'] })
  }
  const photoSaved = (result: SportPhotoResult, message: string) => {
    refreshPhotos()
    setFeedback(result.warning)
    if (result.warning) toast.warning(result.warning)
    else toast.success(message)
  }

  const add = useMutation({
    mutationFn: (value: string) => createSport(normalizeSportCode(value), value.trim()),
    onSuccess: () => {
      setName('')
      qc.invalidateQueries({ queryKey: ['sports'] })
      toast.success('Sport adăugat.')
    },
    onError: (error) => fail(error, 'Nu am putut adăuga sportul. Încearcă din nou.'),
    onSettled: settle,
  })
  const del = useMutation({
    mutationFn: (id: string) => deleteSport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sports'] })
      toast.success('Sport șters.')
    },
    onError: (error) =>
      fail(error, 'Nu am putut șterge sportul. Verifică conexiunea și încearcă din nou.'),
    onSettled: () => {
      settle()
      setToDelete(null)
    },
  })
  const setPhoto = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => setSportDefaultPhoto(id, file),
    onSuccess: (result) => photoSaved(result, 'Poză standard salvată pentru acest tip de curs.'),
    onError: (error) => {
      refreshPhotos()
      fail(error, 'Nu am putut încărca poza. Încearcă din nou.')
    },
    onSettled: settle,
  })
  const clearPhoto = useMutation({
    mutationFn: (id: string) => clearSportDefaultPhoto(id),
    onSuccess: (result) => photoSaved(result, 'Poză standard scoasă.'),
    onError: (error) => {
      refreshPhotos()
      fail(error, 'Nu am putut confirma scoaterea pozei. Reîncarcă lista înainte de a reîncerca.')
    },
    onSettled: settle,
  })
  const busy = add.isPending || del.isPending || setPhoto.isPending || clearPhoto.isPending
  const begin = () => {
    if (pending.current) return false
    pending.current = true
    setFeedback(null)
    return true
  }

  const renderRow = (sport: Sport) => (
    <SportRow
      key={sport.id}
      sport={sport}
      query={query}
      busy={busy}
      state={{
        changing: setPhoto.isPending && setPhoto.variables?.id === sport.id,
        clearing: clearPhoto.isPending && clearPhoto.variables === sport.id,
        deleting: del.isPending && del.variables === sport.id,
      }}
      onPickPhoto={(file) => {
        if (begin()) setPhoto.mutate({ id: sport.id, file })
      }}
      onClearPhoto={() => {
        if (begin()) clearPhoto.mutate(sport.id)
      }}
      onDelete={() => {
        if (!pending.current) setToDelete(sport)
      }}
    />
  )

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-foreground mr-auto text-2xl font-bold">Sporturi</h1>
        {sports.length > 0 && (
          <div className="relative order-last w-full md:order-none md:w-80">
            <Search
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Caută după nume sau cod"
              aria-label="Caută sporturi după nume sau cod"
              className={`${TOUCH} pl-9`}
            />
          </div>
        )}
      </div>
      <p className="text-muted-foreground mb-4 max-w-2xl text-sm">
        Poza standard pe tip de curs apare pe toate cursurile acelui sport când antrenorul nu a
        încărcat o fotografie proprie.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const invalid = sportNameError(name)
          setNameError(invalid)
          if (!invalid && begin()) add.mutate(name)
        }}
        className="bg-card mb-4 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-end md:p-5"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="sport-name">Nume sport nou</Label>
          <Input
            id="sport-name"
            className={TOUCH}
            value={name}
            disabled={busy}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'sport-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value)
              setNameError(null)
            }}
            placeholder="ex. Tenis"
          />
          {nameError && (
            <p id="sport-name-error" role="alert" className="text-destructive text-sm">
              {nameError}
            </p>
          )}
        </div>
        <Button className={TOUCH} type="submit" disabled={busy}>
          <Plus aria-hidden="true" />
          {add.isPending ? 'Se adaugă…' : 'Adaugă'}
        </Button>
      </form>
      {feedback && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {feedback}
        </p>
      )}

      {isLoading ? (
        <StatusView state="loading" title="Se încarcă sporturile" rowHeight={64} />
      ) : isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca sporturile."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      ) : sports.length === 0 ? (
        <StatusView
          state="empty"
          title="Nu există sporturi adăugate."
          text="Adaugă primul sport din formularul de mai sus."
        />
      ) : (
        <>
          <CourseFilterBar
            status={filters.photo}
            sport=""
            statusCounts={counts}
            sports={[]}
            statusOptions={PHOTO_OPTIONS}
            onStatus={(photo) => set({ photo })}
            onSport={() => {}}
          />
          <p role="status" className="text-muted-foreground mb-3 text-sm">
            {visible.length > 0 &&
              (hasSportFilters(filters)
                ? `${visible.length} din ${countSports(sports.length)}`
                : `${countSports(sports.length)}, ${counts.with} cu poză standard`)}
          </p>
          {visible.length === 0 ? (
            <StatusView
              state="empty"
              title="Niciun sport găsit."
              text="Schimbă căutarea sau filtrele."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="h-touch-target min-h-touch-target mt-3"
                  onClick={() => setFilters(NO_SPORT_FILTERS)}
                >
                  Șterge filtrele
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {groups.map((g) => (
                <SportGroupCard
                  key={g.key}
                  group={g}
                  open={toggled[g.key] ?? true}
                  onOpenChange={(open) => setToggled((t) => ({ ...t, [g.key]: open }))}
                >
                  {g.sports.map(renderRow)}
                </SportGroupCard>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Ștergi sportul ${toDelete?.name ?? ''}?`}
        description="Sportul dispare din listă. Un sport folosit de cursuri, activități, antrenori sau cluburi nu poate fi șters."
        confirmLabel={del.isPending ? 'Se șterge…' : 'Șterge sportul'}
        destructive
        pending={del.isPending}
        onConfirm={() => {
          if (toDelete && begin()) del.mutate(toDelete.id)
        }}
      />
    </div>
  )
}
