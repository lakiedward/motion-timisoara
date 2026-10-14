import { OfferExchangeNote } from '@/components/OfferExchangeNote'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { courseHeroUrl, getCourse, getCourseSpotsRemaining } from '@/api/public'
import { getCourseRatingSummary, getMyCourseRating, submitCourseRating } from '@/api/ratings'
import { formatLevel } from '@/lib/level'
import { formatMoney } from '@/lib/money'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/StarRating'
import { CourseDetailsInfo } from '@/features/public/courses/CourseDetailsInfo'
import { CourseHero } from '@/features/public/courses/CourseHero'

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
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )
  }
  if (!course) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center px-6 py-20 text-center">
        <div className="from-primary/15 to-sky/10 w-full rounded-3xl border bg-gradient-to-br p-10 shadow-sm">
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

  const onEnroll = () => {
    if (isFull) return
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
            <div className="bg-card shadow-card overflow-hidden rounded-3xl border">
              <div className="h-1.5" style={{ background: 'var(--gradient-primary)' }} />
              <div className="flex flex-col items-center p-6 text-center">
                <div className="font-display text-3xl font-extrabold">
                  {formatMoney(course.price, course.currency)}
                  <span className="text-muted-foreground text-base font-normal"> / lună</span>
                </div>
                <OfferExchangeNote offer={course} />
                {course.price_per_session > 0 && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {formatMoney(course.price_per_session, course.currency)} / ședință
                  </p>
                )}
                <button
                  type="button"
                  onClick={onEnroll}
                  disabled={isFull}
                  className={cn(
                    'btn-cta btn-cta--primary mt-5 w-full',
                    isFull && 'pointer-events-none opacity-50',
                  )}
                >
                  {isFull ? 'Locuri epuizate' : 'Înscrie-te'}
                </button>
                {isFull ? (
                  <p className="text-destructive mt-3 text-center text-xs font-medium">
                    Locuri epuizate
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-3 text-center text-xs">
                    Plată online sau cash, gestionată din contul tău.
                  </p>
                )}

                {rating && rating.count > 0 && (
                  <div className="mt-5 flex w-full flex-col items-center gap-2 border-t pt-4">
                    <StarRating value={rating.avg} size={18} />
                    <span className="text-muted-foreground text-sm">
                      {rating.avg.toFixed(1)} · {rating.count}{' '}
                      {rating.count === 1 ? 'evaluare' : 'evaluări'}
                    </span>
                  </div>
                )}
                {user?.role === 'PARENT' && (
                  <div className="mt-4 w-full border-t pt-4">
                    <p className="text-muted-foreground mb-1.5 text-sm font-medium">Nota ta</p>
                    <div className="flex justify-center">
                      <StarRating value={myRating ?? 0} onChange={(r) => rate.mutate(r)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

