import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarRange } from 'lucide-react'

import { incarcaRegulamentActivitate, stergeRegulamentActivitate } from '@/api/camp-rules-file'
import { getClubActivities, getClubActivityById, getMyClub } from '@/api/club'
import { OfferRulesFieldset } from '@/components/RulesFileField'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { campRulesFileFromRow } from '@/lib/camp-rules'

function dataActivitate(zi: string) {
  const [an, luna, ziua] = zi.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, ziua ?? 1).toLocaleDateString('ro-RO')
}

function Lista() {
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

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Activitățile clubului</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Antrenorul creează activitatea. Clubul poate atașa un singur fișier cu regulamentul.
      </p>
      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="mt-6 rounded-3xl border border-dashed py-16 text-center">
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
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {activities.map((activity) => (
            <li key={activity.id} className="bg-card shadow-card rounded-3xl border p-5">
              <p className="font-display text-lg font-bold">{activity.name}</p>
              <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                <CalendarRange className="size-4" aria-hidden="true" />
                {dataActivitate(activity.activity_date)}
                {activity.sport?.name ? ` · ${activity.sport.name}` : ''}
              </p>
              <Link
                to={`/club/activities/${activity.id}`}
                className="text-primary mt-4 inline-flex min-h-11 items-center font-semibold"
              >
                Fișierul regulamentului
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted-foreground mt-6 rounded-3xl border border-dashed py-16 text-center">
          Nicio activitate a clubului.
        </div>
      )}
    </div>
  )
}

function Detaliu({ id }: { id: string }) {
  const { data: club } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const {
    data: activity,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['club-activity', id],
    queryFn: () => getClubActivityById(id),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl rounded-3xl border border-dashed py-16 text-center"
      >
        <p className="text-foreground font-medium">Nu am putut încărca activitatea.</p>
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }

  if (!activity || (club && activity.club_id !== club.id)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link
          to="/club/activities"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi
        </Link>
        <p className="text-muted-foreground mt-6">Activitatea nu aparține clubului.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/club/activities"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi
      </Link>
      <h1 className="font-display mt-4 text-2xl font-bold">{activity.name}</h1>
      <p className="text-muted-foreground mt-1 text-sm">{dataActivitate(activity.activity_date)}</p>
      <div className="mt-6">
        <OfferRulesFieldset
          entityId={activity.id}
          saved={campRulesFileFromRow(activity)}
          localFile={null}
          onLocalFile={() => undefined}
          upload={incarcaRegulamentActivitate}
          remove={stergeRegulamentActivitate}
          queryKey={['club-activity', id]}
          intro="Fișierul apare pe pagina publică a activității. Părinții îl pot deschide; nu trebuie să îl accepte la înscriere."
        />
      </div>
      <Link
        to={`/activitati/${activity.id}`}
        className="text-primary mt-4 inline-flex min-h-11 items-center font-semibold"
      >
        Vezi pagina publică
      </Link>
    </div>
  )
}

export default function ClubActivitiesPage() {
  const { id } = useParams()
  if (id) return <Detaliu id={id} />
  return <Lista />
}
