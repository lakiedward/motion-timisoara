import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyClub, getClubCourses, setClubCourseActive } from '@/api/club'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { CurrentLocationSessions } from '@/features/live-location/CurrentLocationSessions'
import { ClubCourseFilterBar } from './courses/ClubCourseFilterBar'
import { ClubCourseListSkeleton } from './courses/ClubCourseListSkeleton'
import { ClubCourseRows } from './courses/ClubCourseRows'
import {
  NO_FILTERS,
  coachCounts,
  filterClubCourses,
  hasFilters,
  sportCounts,
  statusCounts,
  type ClubCourseFilters,
} from './courses/club-course-filters'

export default function ClubCoursesPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<ClubCourseFilters>(NO_FILTERS)
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
    isFetching,
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
  const visible = filterClubCourses(courses, filters)
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
  const pendingId = toggle.isPending ? (toggle.variables?.id ?? null) : null

  return (
    <div>
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Cursurile clubului</h1>
        <Button asChild className="h-11 min-h-11">
          <Link to="/club/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      <CurrentLocationSessions
        courses={courses.map((c) => ({ id: c.id, name: c.name, coachName: c.coach?.name ?? null }))}
        courseSource={{ isLoading, isError: isError && !courses.length, retry: retryCourses }}
      />
      {isLoading ? (
        <ClubCourseListSkeleton />
      ) : isError && !courses.length ? (
        <StatusView
          state="error"
          title="Nu am putut încărca cursurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={isFetching ? undefined : retryCourses}
        />
      ) : courses.length ? (
        <>
          <ClubCourseFilterBar
            filters={filters}
            statusCounts={statusCounts(courses)}
            sports={sportCounts(courses)}
            coaches={coachCounts(courses)}
            onChange={setFilters}
          />
          {!visible.length ? (
            <StatusView
              state="empty"
              title="Niciun curs pentru filtrele alese."
              text="Schimbă căutarea sau filtrele."
              action={
                hasFilters(filters) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 h-11 min-h-11"
                    onClick={() => setFilters(NO_FILTERS)}
                  >
                    Șterge filtrele
                  </Button>
                ) : null
              }
            />
          ) : (
            <ClubCourseRows
              courses={visible}
              pendingId={pendingId}
              onToggle={(c) => toggle.mutate({ id: c.id, active: !c.active })}
            />
          )}
        </>
      ) : (
        <div className="text-muted-foreground rounded-xl border border-dashed border-input py-16 text-center">
          Niciun curs încă.{' '}
          <Link to="/club/courses/new" className="text-primary font-semibold">
            Creează primul curs
          </Link>
        </div>
      )}
    </div>
  )
}
