import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import { getCourses } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { CourseCard } from '../components/CourseCard'

const MAX_COURSES = 3

export function HomePrograms() {
  const coursesQuery = useQuery({ queryKey: ['courses', 'all'], queryFn: () => getCourses() })
  const courses = (coursesQuery.data ?? []).slice(0, MAX_COURSES)

  return (
    <section aria-labelledby="home-programs-title" className="bg-secondary/60 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow mb-2">Programe</span>
            <h2
              id="home-programs-title"
              className="font-display text-foreground text-3xl font-extrabold md:text-4xl"
            >
              Programe populare
            </h2>
          </div>
          <Link
            to="/cursuri"
            className="text-primary inline-flex min-h-touch-target items-center gap-1 font-semibold hover:underline"
          >
            Toate cursurile <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        {coursesQuery.isPending ? (
          <div role="status" aria-label="Se încarcă programele" className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: MAX_COURSES }, (_, index) => (
              <div key={index} className="bg-card overflow-hidden rounded-xl border">
                <Skeleton className="aspect-video rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : coursesQuery.isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca programele."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void coursesQuery.refetch()}
            className="bg-card border"
          />
        ) : courses.length ? (
          <ul className="grid gap-4 md:grid-cols-3">
            {courses.map((course) => (
              <li key={course.id} className="min-w-0">
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        ) : (
          <StatusView
            state="empty"
            title="Nu există programe active momentan."
            text="Cluburile își publică programele pe rând. Între timp, poți vedea taberele și activitățile."
            className="bg-card"
            action={
              <Button asChild variant="outline" className="mt-3">
                <Link to="/cursuri">Vezi toate cursurile</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}
