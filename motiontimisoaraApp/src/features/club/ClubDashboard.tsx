import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  GraduationCap,
  MapPin,
  Users,
  XCircle,
} from 'lucide-react'

import { getClubCoaches, getClubCourses, getClubLocations, getMyClub } from '@/api/club'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

const statCardClass = cn(
  'bg-card group flex h-full min-h-[11.5rem] cursor-pointer flex-col rounded-xl border p-6 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
  'hover:border-foreground/20 hover:shadow-card',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
)

interface Tile {
  to: string
  testId: string
  icon: typeof Users
  label: string
  ariaLabel?: string
  value: ReactNode
  hint: ReactNode
}

function countValue(query: UseQueryResult<unknown[]>, label: string) {
  if (query.isPending) {
    return <Skeleton role="status" aria-label={`Se încarcă: ${label}`} className="h-8 w-12" />
  }
  if (query.isError) return '—'
  return query.data.length
}

function countHint(query: UseQueryResult<unknown[]>, empty: string, filled: string) {
  if (query.isError) {
    return (
      <span className="flex items-center gap-1.5">
        <CircleAlert aria-hidden="true" className="size-4" /> Nu am putut număra
      </span>
    )
  }
  if (query.isPending) return null
  return query.data.length === 0 ? empty : filled
}

export default function ClubDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const clubQuery = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    retry: false,
  })
  const club = clubQuery.data
  const clubId = club?.id
  const coachesQuery = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: () => getClubCoaches(clubId!),
    enabled: !!clubId,
  })
  const coursesQuery = useQuery({
    queryKey: ['club-courses', clubId],
    queryFn: () => getClubCourses(clubId!),
    enabled: !!clubId,
  })
  const locationsQuery = useQuery({
    queryKey: ['club-locations', clubId],
    queryFn: () => getClubLocations(clubId!),
    enabled: !!clubId,
  })

  if (clubQuery.isPending) {
    return (
      <div className="space-y-8" data-testid="club-stats-skeleton">
        <Skeleton className="h-16 max-w-md rounded-xl" />
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-h-[11.5rem] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (clubQuery.isError) {
    return (
      <StatusView
        state="error"
        title="Nu am putut încărca clubul."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => void clubQuery.refetch()}
        className="bg-card border"
      />
    )
  }

  if (!club) {
    return (
      <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center">
        Niciun club asociat contului.
      </div>
    )
  }

  const stripeDone = club.stripe_onboarding_complete
  const stripeLabel = stripeDone ? 'Configurat' : 'Neconfigurat'
  const subtitle = [club.name, club.city].filter(Boolean).join(' · ')

  const tiles: Tile[] = [
    {
      to: '/club/coaches',
      testId: 'club-stat-antrenori',
      icon: Users,
      label: 'Antrenori',
      value: countValue(coachesQuery, 'Antrenori'),
      hint: countHint(coachesQuery, 'Invită primul antrenor', 'Echipa clubului'),
    },
    {
      to: '/club/courses',
      testId: 'club-stat-cursuri',
      icon: GraduationCap,
      label: 'Cursuri',
      value: countValue(coursesQuery, 'Cursuri'),
      hint: countHint(coursesQuery, 'Adaugă primul curs', 'Gestionează cursurile'),
    },
    {
      to: '/club/locations',
      testId: 'club-stat-locatii',
      icon: MapPin,
      label: 'Locații',
      value: countValue(locationsQuery, 'Locații'),
      hint: countHint(locationsQuery, 'Adaugă prima locație', 'Unde se țin cursurile'),
    },
    {
      to: '/club/stripe',
      testId: 'club-stat-stripe',
      icon: CreditCard,
      label: 'Stripe',
      ariaLabel: `Stripe, ${stripeLabel}`,
      value: (
        <span className="flex items-center gap-2">
          {stripeDone ? (
            <CheckCircle2 aria-hidden="true" className="text-success-ink size-5" />
          ) : (
            <XCircle aria-hidden="true" className="text-muted-foreground size-5" />
          )}
          {stripeLabel}
        </span>
      ),
      hint: stripeDone ? 'Părinții pot plăti cu cardul' : 'Configurează plățile cu cardul',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold break-words text-foreground">
          Salut{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1 break-words">{subtitle || 'Panoul clubului'}</p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.testId} {...tile} />
        ))}
      </div>
    </div>
  )
}

function TileIcon({ icon: Icon }: { icon: typeof Users }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-xl"
    >
      <Icon className="size-5" />
    </span>
  )
}

function StatTile({ to, testId, icon, label, ariaLabel, value, hint }: Tile) {
  const isStatus = testId === 'club-stat-stripe'
  return (
    <Link to={to} data-testid={testId} aria-label={ariaLabel} className={statCardClass}>
      <div className="flex items-start justify-between">
        <TileIcon icon={icon} />
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-primary size-5 transition-colors"
        />
      </div>
      <div
        className={cn(
          'font-display mt-4 flex h-9 items-center',
          isStatus ? 'text-muted-foreground text-lg font-bold' : 'text-3xl font-extrabold',
        )}
      >
        {isStatus ? <span className="text-foreground">{label}</span> : value}
      </div>
      <div className="text-muted-foreground text-sm">{isStatus ? value : label}</div>
      {hint ? <div className="text-muted-foreground mt-auto pt-3 text-xs">{hint}</div> : null}
    </Link>
  )
}
