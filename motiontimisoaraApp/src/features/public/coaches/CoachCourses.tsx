import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getCoachCourses } from '@/api/public'
import { Button } from '@/components/ui/button'
import { StatusView } from '@/components/ui/status-view'
import { CourseCatalogCard } from '../courses/CourseCatalogCard'
import { CourseCatalogCardSkeleton } from '../courses/CourseCatalogCardSkeleton'

const SECTION_KEY = 'motion-react:page:/antrenori/:id:section:cursuri-predate'
const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

export function CoachCourses({ coachId }: { coachId: string }) {
  const coursesQuery = useQuery({
    queryKey: ['coach-courses', coachId],
    queryFn: () => getCoachCourses(coachId),
  })
  const courses = coursesQuery.data ?? []
  const loading = coursesQuery.isPending || (coursesQuery.isError && coursesQuery.isFetching)

  return (
    <section data-section={SECTION_KEY} aria-labelledby="coach-courses-title" className="mt-10">
      <h2 id="coach-courses-title" className="font-display mb-4 text-xl font-bold">
        Cursuri predate
      </h2>
      {loading ? (
        <ul role="status" aria-label="Se încarcă cursurile" className={GRID}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="min-w-0">
              <CourseCatalogCardSkeleton />
            </li>
          ))}
        </ul>
      ) : coursesQuery.isError ? (
        <StatusView
          state="error"
          title="Nu am putut încărca cursurile."
          text="Verifică conexiunea și încearcă din nou."
          onRetry={() => void coursesQuery.refetch()}
        />
      ) : courses.length ? (
        <ul className={GRID}>
          {courses.map((course) => (
            <li key={course.id} className="min-w-0">
              <CourseCatalogCard course={course} />
            </li>
          ))}
        </ul>
      ) : (
        <StatusView
          state="empty"
          title="Momentan nu are cursuri active."
          text="Cursurile noi apar aici când antrenorul le publică."
          action={
            <Button asChild variant="outline" className="mt-3">
              <Link to="/cursuri">Vezi toate cursurile</Link>
            </Button>
          }
        />
      )}
    </section>
  )
}
