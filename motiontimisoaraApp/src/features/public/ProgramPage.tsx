import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { getCourseCatalog } from '@/api/public'
import {
  COURSE_PAGE_SIZE,
  EMPTY_COURSE_FILTERS,
  courseLocationOptions,
  courseMatchesFilters,
  courseSportOptions,
  type CourseCatalogFilters,
} from '@/lib/course-catalog'
import { plural } from '@/lib/plural'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { CourseCatalogCard } from './courses/CourseCatalogCard'
import { CourseCatalogCardSkeleton } from './courses/CourseCatalogCardSkeleton'
import { CourseFilters } from './courses/CourseFilters'

export default function ProgramPage() {
  const [params, setParams] = useSearchParams()
  const [otherFilters, setOtherFilters] = useState<CourseCatalogFilters>(EMPTY_COURSE_FILTERS)
  const filters: CourseCatalogFilters = { ...otherFilters, sport: params.get('sport') ?? '' }
  const [visible, setVisible] = useState(COURSE_PAGE_SIZE)
  const coursesQuery = useQuery({ queryKey: ['course-catalog'], queryFn: getCourseCatalog })
  const courses = coursesQuery.data ?? []
  const filtered = courses.filter((course) => courseMatchesFilters(course, filters))
  const sportOptions = courseSportOptions(courses)
  const listLoading = coursesQuery.isPending || (coursesQuery.isError && coursesQuery.isFetching)

  const applyFilters = (next: CourseCatalogFilters) => {
    setOtherFilters({ ...next, sport: '' })
    if (next.sport !== filters.sport)
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (next.sport) updated.set('sport', next.sport)
          else updated.delete('sport')
          return updated
        },
        { replace: true },
      )
    setVisible(COURSE_PAGE_SIZE)
  }

  return (
    <div>
      <section
        aria-labelledby="courses-page-title"
        data-section="motion-react:page:/cursuri:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Programe</span>
          <h1
            id="courses-page-title"
            className="font-display text-foreground text-4xl font-extrabold lg:text-5xl"
          >
            Cursuri
          </h1>
          <p className="text-muted-foreground mt-2">Găsește cursul potrivit pentru copilul tău.</p>
        </div>
      </section>

      <section aria-label="Listă cursuri" className="mx-auto max-w-7xl px-6 py-10">
        <CourseFilters
          filters={filters}
          sportOptions={sportOptions}
          locationOptions={courseLocationOptions(courses)}
          loading={coursesQuery.isPending}
          onChange={applyFilters}
        />

        {listLoading ? (
          <div role="status" aria-label="Se încarcă cursurile">
            <Skeleton className="mb-4 h-5 w-32" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="min-w-0">
                  <CourseCatalogCardSkeleton />
                </li>
              ))}
            </ul>
          </div>
        ) : coursesQuery.isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca cursurile."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void coursesQuery.refetch()}
          />
        ) : !courses.length ? (
          <StatusView
            state="empty"
            title="Niciun curs disponibil momentan."
            text="Cursurile noi apar aici când un club sau un antrenor le publică."
          />
        ) : filtered.length ? (
          <>
            <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
              {plural(filtered.length, 'curs găsit', 'cursuri găsite')}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice(0, visible).map((course) => (
                <li key={course.id} className="min-w-0">
                  <CourseCatalogCard course={course} />
                </li>
              ))}
            </ul>
            {filtered.length > visible && (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisible((count) => count + COURSE_PAGE_SIZE)}
                >
                  Încarcă mai multe
                </Button>
              </div>
            )}
          </>
        ) : (
          <StatusView
            state="empty"
            title="Niciun curs nu corespunde filtrelor."
            text="Încearcă altă zi, alt preț sau altă locație."
            action={
              <div className="mt-3 flex flex-col items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyFilters(EMPTY_COURSE_FILTERS)}
                >
                  Resetează filtrele
                </Button>
                {sportOptions.length ? (
                  <div className="flex flex-wrap items-center justify-center gap-x-1">
                    <span className="text-muted-foreground text-sm">Au cursuri acum:</span>
                    {sportOptions.map((sport) => (
                      <Button
                        key={sport.value}
                        type="button"
                        variant="link"
                        onClick={() => applyFilters({ ...EMPTY_COURSE_FILTERS, sport: sport.value })}
                      >
                        {sport.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          />
        )}
      </section>
    </div>
  )
}
