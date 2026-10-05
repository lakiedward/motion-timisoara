import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Plus, Search } from 'lucide-react'

import { getAllClubs, type AdminClub } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function dashIfMissing(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

function sortClubsByName(clubs: AdminClub[]) {
  return [...clubs].sort((a, b) => a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' }))
}

const clubGridClass =
  'grid grid-cols-1 items-stretch gap-4 overflow-visible py-1 md:grid-cols-2 lg:grid-cols-4'

const clubCardClass =
  'bg-card shadow-card flex h-full min-h-[7.5rem] min-w-0 items-start gap-3 rounded-3xl p-5'

function LoadingState() {
  return (
    <ul className={clubGridClass} aria-busy="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i} className={clubCardClass}>
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function AdminClubsPage() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [q, setQ] = useState('')
  const [retrying, setRetrying] = useState(false)
  const {
    data: clubs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['admin-clubs'], queryFn: getAllClubs, retry: false })

  const sorted = useMemo(() => sortClubsByName(clubs), [clubs])
  const filtered = useMemo(() => {
    const needle = fold(q.trim())
    if (!needle) return sorted
    return sorted.filter((club) =>
      fold(`${club.name} ${club.city ?? ''} ${club.email ?? ''}`).includes(needle),
    )
  }, [sorted, q])

  async function onRetry() {
    setRetrying(true)
    try {
      const result = await refetch()
      if (!result.error) headingRef.current?.focus()
    } finally {
      setRetrying(false)
    }
  }

  const showError = clubs.length === 0 && (isError || retrying)
  const showSkeleton = isLoading && !showError

  return (
    <div className="min-w-0">
      <div className="mb-4 flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-foreground text-2xl font-bold break-words outline-none"
          >
            Cluburi
          </h1>
          <Button asChild className="h-11 min-h-11 w-fit shrink-0">
            <Link to="/admin/codes">
              <Plus className="size-4" aria-hidden="true" />
              Adaugă club
            </Link>
          </Button>
        </div>
        <div className="relative w-full min-w-0 md:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Caută după nume, oraș sau email"
            aria-label="Caută cluburi după nume, oraș sau email"
            className="h-11 min-h-11 pl-9 lg:h-9 lg:min-h-9"
          />
        </div>
      </div>

      {showSkeleton ? (
        <LoadingState />
      ) : showError ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca cluburile.</p>
          <Button
            className="mt-4 h-11 min-h-11"
            type="button"
            disabled={retrying}
            onClick={() => void onRetry()}
          >
            {retrying ? 'Se reîncarcă…' : 'Reîncearcă'}
          </Button>
        </div>
      ) : clubs.length === 0 ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun club înregistrat.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun club găsit.{' '}
          <button
            type="button"
            onClick={() => setQ('')}
            className="text-primary inline-flex min-h-11 items-center font-semibold lg:min-h-0"
          >
            Șterge căutarea
          </button>
        </div>
      ) : (
        <ul className={clubGridClass}>
          {filtered.map((club) => (
            <li key={club.id} className={clubCardClass}>
              <span className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                <Building2 className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="font-semibold break-words">{dashIfMissing(club.name)}</div>
                <div className="text-muted-foreground text-sm break-words">
                  {dashIfMissing(club.city)}
                </div>
                <div className="text-muted-foreground text-sm break-all">
                  {dashIfMissing(club.email)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
