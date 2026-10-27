import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { getMyCourses, setCourseActive } from '@/api/coach'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { CoachCourseCard } from './courses/CoachCourseCard'
import { CoachCourseFilterBar } from './courses/CoachCourseFilterBar'
import {
  NO_FILTERS,
  filterCoachCourses,
  hasFilters,
  sportCounts,
  statusCounts,
  type CoachCourseFilters,
} from './courses/coach-course-filters'

export default function CoachCoursesPage() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<CoachCourseFilters>(NO_FILTERS)
  const {
    data: courses = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['my-courses'],
    queryFn: getMyCourses,
    retry: false,
  })
  const visible = filterCoachCourses(courses, filters)

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setCourseActive(id, active),
    onSuccess: (_res, { active }) => {
      void qc.invalidateQueries({ queryKey: ['my-courses'] })
      toast.success(active ? 'Cursul este activ.' : 'Cursul a fost dezactivat.')
    },
    onError: () => toast.error('Nu am putut actualiza cursul.'),
  })

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Cursurile mele</h1>
        <Button asChild className="h-11 min-h-11 w-full md:w-auto">
          <Link to="/coach/courses/new">
            <Plus /> Curs nou
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Se încarcă cursurile" className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : isError && courses.length === 0 ? (
        <StatusView
          state="error"
          title="Nu am putut încărca cursurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={isFetching ? undefined : () => void refetch()}
        />
      ) : courses.length ? (
        <>
          <CoachCourseFilterBar
            filters={filters}
            statusCounts={statusCounts(courses)}
            sports={sportCounts(courses)}
            onChange={setFilters}
          />
          {visible.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {visible.map((c) => (
                <CoachCourseCard
                  key={c.id}
                  course={c}
                  pending={toggle.isPending && toggle.variables?.id === c.id}
                  onToggle={() => toggle.mutate({ id: c.id, active: !c.active })}
                />
              ))}
            </div>
          ) : (
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
          )}
        </>
      ) : (
        <StatusView
          state="empty"
          title="Niciun curs încă."
          text="Cursurile pe care le creezi apar aici."
          action={
            <Button asChild variant="outline" className="mt-3 h-11 min-h-11">
              <Link to="/coach/courses/new">Creează primul curs</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
