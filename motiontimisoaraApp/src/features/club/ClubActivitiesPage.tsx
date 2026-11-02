import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getClubActivities, getMyClub, setClubActivityActive } from '@/api/club'
import { PageHeader, PageNewLink } from '@/components/page-header/PageHeader'
import { ActivityListRow } from '@/components/panel-list/ActivityListRow'
import { todayInBucharest } from '@/features/admin/activities/activity-overview'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { ClubActivityForm } from './activity-form/ClubActivityForm'

function Lista() {
  const qc = useQueryClient()
  const today = todayInBucharest()
  const {
    data: club,
    isLoading: clubLoading,
    isError: clubError,
    refetch: refetchClub,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: activities = [],
    isLoading: activitiesLoading,
    isError: activitiesError,
    refetch,
  } = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => getClubActivities(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const isLoading = clubLoading || (!!clubId && activitiesLoading)
  const isError = clubError || activitiesError
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setClubActivityActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-activities', clubId] }),
    onError: (e: unknown) =>
      toast.error(
        (e as { code?: string })?.code === '42501'
          ? 'Nu poți modifica această activitate: antrenorul ei nu face parte din club.'
          : 'Nu am putut actualiza activitatea.',
      ),
  })

  return (
    <div>
      <PageHeader title="Activitățile clubului" count={activities.length}>
        <PageNewLink to="/club/activities/new">Activitate nouă</PageNewLink>
      </PageHeader>
      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca activitățile.</p>
          <Button
            className="mt-4 h-11 min-h-11"
            type="button"
            onClick={() => {
              if (clubError) void refetchClub()
              if (clubId) void refetch()
            }}
          >
            Reîncearcă
          </Button>
        </div>
      ) : activities.length ? (
        <ul className="bg-card divide-y overflow-hidden rounded-xl border">
          {activities.map((activity) => (
            <ActivityListRow
              key={activity.id}
              activity={activity}
              editTo={`/club/activities/${activity.id}/edit`}
              past={activity.activity_date < today}
              showCoach
              pending={toggle.isPending && toggle.variables?.id === activity.id}
              onToggle={() => toggle.mutate({ id: activity.id, active: !activity.active })}
            />
          ))}
        </ul>
      ) : (
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
      )}
    </div>
  )
}

export default function ClubActivitiesPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/new') || pathname.endsWith('/edit')) return <ClubActivityForm />
  return <Lista />
}
