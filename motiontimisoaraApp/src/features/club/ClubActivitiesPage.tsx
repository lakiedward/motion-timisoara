import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getClubActivities, getMyClub, setClubActivityActive } from '@/api/club'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClubActivityForm } from './activity-form/ClubActivityForm'

function dataActivitate(zi: string) {
  const [an, luna, ziua] = zi.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, ziua ?? 1).toLocaleDateString('ro-RO')
}

function Lista() {
  const qc = useQueryClient()
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
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Activitățile clubului</h1>
        <Button asChild>
          <Link to="/club/activities/new">
            <Plus /> Activitate nouă
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
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
        <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-card rounded-xl border p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{activity.name}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {dataActivitate(activity.activity_date)}
                    {activity.location?.name ? ` · ${activity.location.name}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activity.sport && <Badge>{activity.sport.name}</Badge>}
                    <Badge variant={activity.active ? 'success' : 'outline'}>
                      {activity.active ? 'Activă' : 'Inactivă'}
                    </Badge>
                  </div>
                </div>
                <span className="font-display font-bold">
                  {formatMoney(activity.price, activity.currency)}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-sm">{activity.coach?.name ?? '—'}</p>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/club/activities/${activity.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: activity.id, active: !activity.active })}
                >
                  {activity.active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center">
          Nicio activitate încă.{' '}
          <Link to="/club/activities/new" className="text-primary font-semibold">
            Creează prima activitate
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ClubActivitiesPage() {
  const { pathname } = useLocation()
  if (pathname.endsWith('/new') || pathname.endsWith('/edit')) return <ClubActivityForm />
  return <Lista />
}
