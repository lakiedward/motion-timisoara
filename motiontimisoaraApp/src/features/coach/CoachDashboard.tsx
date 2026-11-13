import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CreditCard, GraduationCap, MapPin, Plus, Tent, Trophy } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import {
  getCoachSessions,
  getMyActivities,
  getMyCoachStripeStatus,
  getMyCourses,
  getMyLocations,
} from '@/api/coach'
import { getTaberelemele } from '@/api/camps-admin'
import { getCompetitionList } from '@/api/competition/competition-list'
import { DashboardGrid, DashboardGroup, DashboardRow } from '@/components/dashboard/DashboardGroups'
import { countRowProps } from '@/components/dashboard/dashboard-count'
import { CardPaymentsMonthCard } from '@/features/payments/CardPaymentsMonthCard'
import { CashPaymentsNotice } from '@/features/payments/CashPaymentsNotice'
import { CoachSubscriptionBanner } from '@/features/coach/subscription/CoachSubscriptionBanner'
import { NATIVE_BUILD, subscriptionSalesAllowed } from '@/lib/store-compliance'
import { plural } from '@/lib/plural'
import { NowSessionCard } from './attendance/quick-scan/NowSessionCard'
import { useCurrentSession } from './attendance/quick-scan/current-session'
import { toSessionList } from './attendance/coach-session-list'

export default function CoachDashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const coachUserId = user?.id ?? null
  const coursesQuery = useQuery({ queryKey: ['my-courses'], queryFn: getMyCourses, retry: false })
  const activitiesQuery = useQuery({
    queryKey: ['my-activities'],
    queryFn: getMyActivities,
    retry: false,
  })
  const campsQuery = useQuery({
    queryKey: ['taberele-mele', null, coachUserId],
    queryFn: () => getTaberelemele({ clubId: null, coachUserId }),
    enabled: !!coachUserId,
    retry: false,
  })
  const competitionsQuery = useQuery({
    queryKey: ['concursurile-mele', 'lista', 'COACH', null, coachUserId],
    queryFn: () => getCompetitionList({ role: 'COACH', clubId: null, coachUserId }),
    enabled: !!coachUserId,
    retry: false,
  })
  const locationsQuery = useQuery({
    queryKey: ['my-locations'],
    queryFn: getMyLocations,
    retry: false,
  })
  const stripeQuery = useQuery({
    queryKey: ['my-coach-stripe'],
    queryFn: getMyCoachStripeStatus,
    retry: false,
  })
  const sessionsQuery = useQuery({
    queryKey: ['coach-sessions'],
    queryFn: getCoachSessions,
    retry: false,
  })
  const sessions = useMemo(() => toSessionList(sessionsQuery.data), [sessionsQuery.data])
  const nowSession = useCurrentSession(sessions)
  const stripeComplete = stripeQuery.data?.onboardingComplete ?? false
  const stripeLabel = stripeQuery.isPending
    ? 'se încarcă'
    : stripeQuery.isError
      ? 'Nu am putut verifica statusul'
      : stripeComplete
        ? 'Configurat'
        : 'Neconfigurat'
  const activeCourses = (coursesQuery.data ?? []).filter((c) => c.active).length

  return (
    <div className="min-w-0 space-y-8">
      <div className="min-w-0">
        <h1 className="font-display text-foreground text-3xl font-extrabold break-words">
          Salut{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">Panoul tău de antrenor.</p>
      </div>

      {nowSession && (
        <NowSessionCard
          session={nowSession}
          catalogTo={`/coach/attendance?sesiune=${nowSession.id}`}
        />
      )}

      {!NATIVE_BUILD && subscriptionSalesAllowed() ? <CoachSubscriptionBanner /> : null}

      <CashPaymentsNotice to="/coach/payments" />

      <CardPaymentsMonthCard
        enabled={stripeComplete}
        offersLabel="ofertele tale"
        netLabel="Primești tu"
      />

      <DashboardGrid>
        <DashboardGroup title="Oferta ta">
          <DashboardRow
            to="/coach/courses"
            testId="coach-stat-cursuri"
            icon={GraduationCap}
            label="Cursuri"
            {...countRowProps(
              coursesQuery,
              'Cursuri',
              'Adaugă primul curs',
              plural(activeCourses, 'activ', 'active'),
            )}
          />
          <DashboardRow
            to="/coach/activities"
            testId="coach-stat-activitati"
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
            to="/coach/camps"
            testId="coach-stat-tabere"
            icon={Tent}
            label="Tabere"
            {...countRowProps(campsQuery, 'Tabere', 'Adaugă prima tabără', 'Taberele tale')}
          />
          <DashboardRow
            to="/coach/competitions"
            testId="coach-stat-concursuri"
            icon={Trophy}
            label="Concursuri"
            {...countRowProps(
              competitionsQuery,
              'Concursuri',
              'Adaugă primul concurs',
              'Concursurile tale',
            )}
          />
        </DashboardGroup>

        <DashboardGroup title="Organizare">
          <DashboardRow
            to="/coach/locations"
            testId="coach-stat-locatii"
            icon={MapPin}
            label="Locații"
            {...countRowProps(
              locationsQuery,
              'Locații',
              'Adaugă prima locație',
              'Unde ții antrenamentele',
            )}
          />
          <DashboardRow
            to="/coach/stripe"
            testId="coach-stat-stripe"
            icon={CreditCard}
            label="Plăți cu cardul"
            ariaLabel={`Plăți cu cardul, ${stripeLabel}`}
            loading={stripeQuery.isPending}
            hint={
              stripeQuery.isError
                ? 'Nu am putut verifica statusul'
                : stripeComplete
                  ? 'Configurat · părinții pot plăti cu cardul'
                  : 'Neconfigurat · configurează plățile cu cardul'
            }
          />
        </DashboardGroup>

        <DashboardGroup title="Adaugă">
          <DashboardRow
            to="/coach/courses/new"
            testId="coach-new-curs"
            icon={Plus}
            label="Curs nou"
          />
          <DashboardRow
            to="/coach/activities/new"
            testId="coach-new-activitate"
            icon={Plus}
            label="Activitate nouă"
          />
          <DashboardRow
            to="/coach/camps/new"
            testId="coach-new-tabara"
            icon={Plus}
            label="Tabără nouă"
          />
          <DashboardRow
            to="/coach/competitions/new"
            testId="coach-new-concurs"
            icon={Plus}
            label="Concurs nou"
          />
        </DashboardGroup>
      </DashboardGrid>
    </div>
  )
}
