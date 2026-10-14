import { OfferExchangeNote } from '@/components/OfferExchangeNote'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { getCourse, getCourseSpotsRemaining, publicUrl } from '@/api/public'
import { getCourseRatingSummary, getMyCourseRating, submitCourseRating } from '@/api/ratings'
import { formatLevel } from '@/lib/level'
import { formatMoney } from '@/lib/money'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/StarRating'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK } from '@/components/sport/sport-icons'
import { SportIllustration } from '@/components/sport/SportIllustration'
import { CourseDetailsInfo } from '@/features/public/courses/CourseDetailsInfo'

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

  const img = publicUrl('course-photos', course.hero_photo_storage_path)
  const sportColor = SPORT_COLOR[course.sport?.code ?? ''] ?? SPORT_COLOR_FALLBACK
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
      {img ? (
        <section className="relative h-[46vh] min-h-[320px] overflow-hidden md:h-[52vh]">
          <img src={img} alt={course.name} className="absolute inset-0 size-full object-cover" />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.25) 48%, transparent 72%)',
            }}
          />

          <Link
            to="/cursuri"
            className="absolute top-6 left-6 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3.5 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/45"
          >
            <ArrowLeft className="size-4" /> Înapoi la cursuri
          </Link>

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-6xl px-6 pb-7">
              <div className="flex flex-wrap items-center gap-2.5">
                {course.sport && (
                  <span
                    className="rounded-full px-4 py-1.5 text-sm font-bold text-white shadow-sm md:text-base"
                    style={{ backgroundColor: sportColor }}
                  >
                    {course.sport.name}
                  </span>
                )}
                {levelLabel && (
                  <span className="rounded-full border-2 border-white/50 bg-black/25 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-sm md:text-base">
                    {levelLabel}
                  </span>
                )}
              </div>
              <h1 className="font-display mt-3 text-4xl font-extrabold text-white md:text-5xl">
                {course.name}
              </h1>
            </div>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <Link
            to="/cursuri"
            className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" /> Înapoi la cursuri
          </Link>
          <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold md:text-4xl">
            {course.name}
          </h1>
          <SportIllustration
            code={course.sport?.code}
            name={course.sport?.name}
            className="mt-6 h-44 rounded-3xl border md:h-56"
          />
        </div>
      )}

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

