import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, GraduationCap, MapPin, Users, XCircle } from 'lucide-react'

import { getClubCoaches, getClubCourses, getClubLocations, getMyClub } from '@/api/club'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

const statCardClass = cn(
  'bg-card shadow-card flex h-full min-h-[11.5rem] cursor-pointer flex-col rounded-3xl p-6 transition-all',
  'hover:-translate-y-1 hover:shadow-card-hover [&:hover]:-translate-y-1 [&:hover]:shadow-card-hover',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-primary',
)

export default function ClubDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const {
    data: club,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['my-club'],
    queryFn: getMyClub,
    retry: false,
  })
  const clubId = club?.id
  const { data: coaches = [] } = useQuery({
    queryKey: ['club-coaches', clubId],
    queryFn: () => getClubCoaches(clubId!),
    enabled: !!clubId,
  })
  const { data: courses = [] } = useQuery({
    queryKey: ['club-courses', clubId],
    queryFn: () => getClubCourses(clubId!),
    enabled: !!clubId,
  })
  const { data: locations = [] } = useQuery({
    queryKey: ['club-locations', clubId],
    queryFn: () => getClubLocations(clubId!),
    enabled: !!clubId,
  })

  if (isLoading) {
    return (
      <div className="space-y-8" data-testid="club-stats-skeleton">
        <Skeleton className="h-16 max-w-md rounded-3xl" />
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-h-[11.5rem] rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <p role="alert" className="bg-card text-muted-foreground shadow-card rounded-3xl p-6">
        Nu am putut încărca clubul.
      </p>
    )
  }

  if (!club) {
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
        Niciun club asociat contului.
      </div>
    )
  }

  const stripeLabel = club.stripe_onboarding_complete ? 'Configurat' : 'Neconfigurat'
  const subtitle = [club.name, club.city].filter(Boolean).join(' · ')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Salut{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">{subtitle || 'Panoul clubului'}</p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatLink
          to="/club/coaches"
          testId="club-stat-antrenori"
          icon={Users}
          value={coaches.length}
          label="Antrenori"
        />
        <StatLink
          to="/club/courses"
          testId="club-stat-cursuri"
          icon={GraduationCap}
          value={courses.length}
          label="Cursuri"
        />
        <StatLink
          to="/club/locations"
          testId="club-stat-locatii"
          icon={MapPin}
          value={locations.length}
          label="Locații"
        />
        <Link
          to="/club/stripe"
          data-testid="club-stat-stripe"
          className={statCardClass}
          aria-label={`Stripe, ${stripeLabel}`}
        >
          <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
            <CreditCard className="size-5" />
          </span>
          <div className="font-display mt-4 text-lg font-bold">Stripe</div>
          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            {club.stripe_onboarding_complete ? (
              <>
                <CheckCircle2 className="text-success size-5" /> Configurat
              </>
            ) : (
              <>
                <XCircle className="text-muted-foreground size-5" /> Neconfigurat
              </>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}

function StatLink({
  to,
  testId,
  icon: Icon,
  value,
  label,
}: {
  to: string
  testId: string
  icon: typeof Users
  value: number
  label: string
}) {
  return (
    <Link to={to} data-testid={testId} className={statCardClass}>
      <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div className="font-display mt-4 text-3xl font-extrabold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </Link>
  )
}
