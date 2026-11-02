import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  CreditCard,
  GraduationCap,
  MapPin,
  Plus,
  Tent,
  Trophy,
  Users,
} from 'lucide-react'

import {
  getClubActivities,
  getClubCoaches,
  getClubCourses,
  getClubLocations,
  getMyClub,
} from '@/api/club'
import { getTaberelemele } from '@/api/camps-admin'
import { getConcursurileMele } from '@/api/competition/competitions'
import { DashboardGrid, DashboardGroup, DashboardRow } from '@/components/dashboard/DashboardGroups'
import { countRowProps } from '@/components/dashboard/dashboard-count'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { useAuth } from '@/lib/auth-context'
import { CashPaymentsNotice } from '@/features/payments/CashPaymentsNotice'

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
  const activitiesQuery = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => getClubActivities(clubId!),
    enabled: !!clubId,
  })
  const campsQuery = useQuery({
    queryKey: ['taberele-mele', clubId, null],
    queryFn: () => getTaberelemele({ clubId: clubId!, coachUserId: null }),
    enabled: !!clubId,
  })
  const competitionsQuery = useQuery({
    queryKey: ['concursurile-mele', 'CLUB', clubId, null],
    queryFn: () => getConcursurileMele({ role: 'CLUB', clubId: clubId!, coachUserId: null }),
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
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
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
  const subtitle = [club.name, club.city].filter(Boolean).join(' · ')
  const base = '/club'

  return (
    <div className="min-w-0 space-y-8">
      <div className="min-w-0">
        <h1 className="font-display text-foreground text-3xl font-extrabold break-words">
          Salut{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1 break-words">{subtitle || 'Panoul clubului'}</p>
      </div>

      <CashPaymentsNotice to="/club/payments" />

      <DashboardGrid>
        <DashboardGroup title="Oferta clubului">
          <DashboardRow
            to={`${base}/courses`}
            testId="club-stat-cursuri"
            icon={GraduationCap}
            label="Cursuri"
            {...countRowProps(coursesQuery, 'Cursuri', 'Adaugă primul curs', 'Cursurile clubului')}
          />
          <DashboardRow
            to={`${base}/activities`}
            testId="club-stat-activitati"
            icon={CalendarDays}
            label="Activități"
            {...countRowProps(
              activitiesQuery,
              'Activități',
              'Adaugă prima activitate',
              'Evenimente de o zi',
            )}
          />
          <DashboardRow
            to={`${base}/camps`}
            testId="club-stat-tabere"
            icon={Tent}
            label="Tabere"
            {...countRowProps(campsQuery, 'Tabere', 'Adaugă prima tabără', 'Taberele clubului')}
          />
          <DashboardRow
            to={`${base}/competitions`}
            testId="club-stat-concursuri"
            icon={Trophy}
            label="Concursuri"
            {...countRowProps(
              competitionsQuery,
              'Concursuri',
              'Adaugă primul concurs',
              'Concursurile clubului',
            )}
          />
        </DashboardGroup>

        <DashboardGroup title="Organizare">
          <DashboardRow
            to={`${base}/coaches`}
            testId="club-stat-antrenori"
            icon={Users}
            label="Antrenori"
            {...countRowProps(
              coachesQuery,
              'Antrenori',
              'Invită primul antrenor',
              'Echipa clubului',
            )}
          />
          <DashboardRow
            to={`${base}/locations`}
            testId="club-stat-locatii"
            icon={MapPin}
            label="Locații"
            {...countRowProps(
              locationsQuery,
              'Locații',
              'Adaugă prima locație',
              'Unde se țin cursurile',
            )}
          />
          <DashboardRow
            to={`${base}/stripe`}
            testId="club-stat-stripe"
            icon={CreditCard}
            label="Plăți cu cardul"
            ariaLabel={`Plăți cu cardul, ${stripeDone ? 'Configurat' : 'Neconfigurat'}`}
            hint={
              stripeDone
                ? 'Configurat · părinții pot plăti cu cardul'
                : 'Neconfigurat · configurează plățile cu cardul'
            }
          />
        </DashboardGroup>

        <DashboardGroup title="Adaugă">
          <DashboardRow
            to={`${base}/courses/new`}
            testId="club-new-curs"
            icon={Plus}
            label="Curs nou"
          />
          <DashboardRow
            to={`${base}/activities/new`}
            testId="club-new-activitate"
            icon={Plus}
            label="Activitate nouă"
          />
          <DashboardRow
            to={`${base}/camps/new`}
            testId="club-new-tabara"
            icon={Plus}
            label="Tabără nouă"
          />
          <DashboardRow
            to={`${base}/competitions/new`}
            testId="club-new-concurs"
            icon={Plus}
            label="Concurs nou"
          />
        </DashboardGroup>
      </DashboardGrid>
    </div>
  )
}
