import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, getClubCourses, setClubCourseActive } from '@/api/club'
import { formatRon } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrentLocationSessions } from '@/features/live-location/CurrentLocationSessions'

export default function ClubCoursesPage() {
  const qc = useQueryClient()
  const {
    data: club,
    isLoading: clubLoading,
    isError: clubError,
    refetch: refetchClub,
  } = useQuery({ queryKey: ['my-club'], queryFn: getMyClub })
  const clubId = club?.id ?? ''
  const {
    data: courses = [],
    isLoading: coursesLoading,
    isError: coursesError,
    refetch,
  } = useQuery({
    queryKey: ['club-courses', clubId],
    queryFn: () => getClubCourses(clubId),
    enabled: !!clubId,
    retry: false,
  })
  const isLoading = clubLoading || coursesLoading
  const isError = clubError || coursesError
  const retryCourses = () => {
    if (clubError) void refetchClub()
    if (clubId && coursesError) void refetch()
  }
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setClubCourseActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['club-courses', clubId] }),
    onError: (e: unknown) =>
      toast.error(
        (e as { code?: string })?.code === '42501'
          ? 'Nu poți modifica acest curs: antrenorul lui nu face parte din club.'
          : 'Nu am putut actualiza cursul.',
      ),
  })

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Cursurile clubului</h1>
        <Button asChild>
          <Link to="/club/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      <CurrentLocationSessions
        courseIds={courses.map((course) => course.id)}
        courseNames={Object.fromEntries(courses.map((course) => [course.id, course.name]))}
        courseSource={{ isLoading, isError: isError && !courses.length, retry: retryCourses }}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-3xl lg:h-48" />
          ))}
        </div>
      ) : isError && !courses.length ? (
        <div role="alert" className="rounded-3xl border border-dashed py-16 text-center">
          <p className="text-foreground font-medium">Nu am putut încărca cursurile.</p>
          <Button className="mt-4 h-11 min-h-11" type="button" onClick={retryCourses}>
            Reîncearcă
          </Button>
        </div>
      ) : courses.length ? (
        <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="bg-card shadow-card rounded-3xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{c.name}</h3>

                  <div className="text-muted-foreground text-sm">{c.location?.name ?? '—'}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.sport && <Badge>{c.sport.name}</Badge>}
                    <Badge variant={c.active ? 'success' : 'outline'}>
                      {c.active ? 'Activ' : 'Inactiv'}
                    </Badge>
                  </div>
                </div>
                <span className="font-display font-bold">{formatRon(c.price)}</span>
              </div>

              <div className="text-muted-foreground mt-2 text-sm">
                {c.coach?.name ?? '—'}
                {c.age_from != null && ` · ${c.age_from}–${c.age_to} ani`}
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/club/courses/${c.id}/edit`}>
                    <Pencil /> Editează
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                >
                  {c.active ? 'Dezactivează' : 'Activează'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-3xl border border-dashed py-16 text-center">
          Niciun curs încă.{' '}
          <Link to="/club/courses/new" className="text-primary font-semibold">
            Creează primul curs
          </Link>
        </div>
      )}
    </div>
  )
}
