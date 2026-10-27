import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { courseHeroUrl, getCourse, getCourseSpotsRemaining } from '@/api/public'
import { getCourseRatingSummary, getMyCourseRating, submitCourseRating } from '@/api/ratings'
import { formatLevel } from '@/lib/level'
import { useAuth } from '@/lib/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseDetailsInfo } from '@/features/public/courses/CourseDetailsInfo'
import { CourseHero } from '@/features/public/courses/CourseHero'
import { CourseEnrollCard } from '@/features/public/courses/CourseEnrollCard'

export default function CourseDetailsPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),
  })
  const { data: spotsRemaining } = useQuery({
    queryKey: ['course-spots', id],
    queryFn: () => getCourseSpotsRemaining(id),
    enabled: !!id,
  })
  const { data: rating } = useQuery({
    queryKey: ['course-rating', id],
    queryFn: () => getCourseRatingSummary(id),
  })
  const { data: myRating } = useQuery({
    queryKey: ['my-course-rating', id, user?.id],
    queryFn: () => getMyCourseRating(id),
    enabled: !!user,
  })
  const rate = useMutation({
    mutationFn: (r: number) => submitCourseRating(id, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-rating', id] })
      qc.invalidateQueries({ queryKey: ['my-course-rating', id] })
      toast.success('Mulțumim pentru evaluare!')
    },
    onError: () => toast.error('Nu am putut salva evaluarea.'),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-12">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (!course) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
        <div className="from-primary/15 to-sky/10 w-full rounded-xl border bg-gradient-to-br p-10">
          <p className="font-display text-foreground text-2xl font-extrabold">
            Cursul nu a fost găsit.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Linkul poate fi greșit sau cursul nu mai este disponibil. Poți alege alt curs din listă.
          </p>
          <Link
            to="/cursuri"
            className="btn-cta btn-cta--primary mt-8 inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="size-4" /> Înapoi la cursuri
          </Link>
        </div>
      </div>
    )
  }

  const levelLabel = formatLevel(course.level)
  const capacity = course.capacity
  const remaining = capacity == null ? null : (spotsRemaining ?? capacity)
  const isFull = remaining != null && remaining <= 0
  const canEnroll = !user || user.role === 'PARENT'

  const onEnroll = () => {
    if (isFull || !canEnroll) return
    if (!user) {
      navigate(`/login?returnUrl=${encodeURIComponent(`/cursuri/${course.id}`)}`)
      return
    }
    navigate(`/account/checkout?kind=COURSE&id=${course.id}`)
  }

  return (
    <div>
      <CourseHero
        name={course.name}
        photoUrl={courseHeroUrl(course)}
        sport={course.sport}
        levelLabel={levelLabel}
      />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <CourseDetailsInfo course={course} remaining={remaining} />

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CourseEnrollCard
              course={course}
              isFull={isFull}
              canEnroll={canEnroll}
              onEnroll={onEnroll}
              rating={rating}
              showMyRating={user?.role === 'PARENT'}
              myRating={myRating ?? 0}
              onRate={(r) => rate.mutate(r)}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

