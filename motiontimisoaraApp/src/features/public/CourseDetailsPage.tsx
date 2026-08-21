import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, MapPin, Users } from 'lucide-react'
import { toast } from 'sonner'

import { courseHeroUrl, getCourse, getCourseSpotsRemaining } from '@/api/public'
import { getCourseRatingSummary, getMyCourseRating, submitCourseRating } from '@/api/ratings'
import { formatLevel } from '@/lib/level'
import { formatRon } from '@/lib/money'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/StarRating'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK } from './sport-icons'

const WEEKDAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

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
          <p className="font-display text-foreground text-2xl font-extrabold">Cursul nu a fost găsit.</p>
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

  const img = courseHeroUrl(course)
  const sportColor = SPORT_COLOR[course.sport?.code ?? ''] ?? SPORT_COLOR_FALLBACK
  const levelLabel = formatLevel(course.level)
  const sessions = [...(course.occurrences ?? [])].sort(
    (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)
  )
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
      {/* HERO — photo or gradient + sport name (no emoji) */}
      <section className="relative h-[46vh] min-h-[320px] overflow-hidden md:h-[52vh]">
        {img ? (
          <img src={img} alt={course.name} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${sportColor} 0%, #0f172a 140%)` }}
          >
            <span className="font-display px-6 text-center text-4xl font-extrabold tracking-tight text-white/90 md:text-5xl">
              {course.sport?.name ?? 'Curs'}
            </span>
          </div>
        )}
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

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {/* Info strip — always one row (including mobile) */}
            <div className="bg-card shadow-card divide-border grid grid-cols-3 divide-x overflow-hidden rounded-2xl border">
              {course.age_from != null ? (
                <InfoTile
                  icon={<Users className="size-3.5 sm:size-4" />}
                  label="Vârstă"
                  value={`${course.age_from}–${course.age_to} ani`}
                />
              ) : (
                <InfoTile icon={<Users className="size-3.5 sm:size-4" />} label="Vârstă" value="—" />
              )}
              <InfoTile
                icon={<MapPin className="size-3.5 sm:size-4" />}
                label="Locație"
                value={course.location?.name ?? '—'}
                to={
                  course.location_id
                    ? `/harta?location=${course.location_id}`
                    : undefined
                }
              />
              {capacity != null ? (
                <InfoTile
                  icon={<Users className="size-3.5 sm:size-4" />}
                  label="Capacitate"
                  value={`${remaining ?? '—'} locuri rămase`}
                  hint={`din ${capacity}`}
                />
              ) : (
                <InfoTile icon={<Users className="size-3.5 sm:size-4" />} label="Capacitate" value="—" />
              )}
            </div>

            {course.description && (
              <section className="from-primary/[0.04] to-background mt-8 rounded-3xl border bg-gradient-to-br p-5 sm:p-6">
                <h2 className="font-display text-xl font-bold">Despre curs</h2>
                <p className="text-muted-foreground mt-3 leading-relaxed">{course.description}</p>
              </section>
            )}

            {sessions.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-bold">Program</h2>
                <ul className="mt-4 space-y-3">
                  {sessions.slice(0, 8).map((s) => {
                    const d = new Date(s.starts_at)
                    return (
                      <li
                        key={s.id}
                        className="from-card to-primary/[0.03] flex items-center gap-3 rounded-2xl border bg-gradient-to-r p-3.5 shadow-sm"
                      >
                        <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                          <CalendarDays className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold">{WEEKDAYS[d.getDay()]}</div>
                          <div className="text-muted-foreground text-sm">
                            {d.toLocaleDateString('ro-RO')} ·{' '}
                            {d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {course.coach && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-bold">Antrenor</h2>
                <Link
                  to={`/antrenori/${course.coach.id}`}
                  className="from-card hover:border-primary/30 mt-4 flex items-center gap-4 rounded-3xl border bg-gradient-to-r to-sky/5 p-4 shadow-sm transition-colors"
                >
                  {course.coach.avatar_url ? (
                    <img
                      src={course.coach.avatar_url}
                      alt=""
                      className="size-14 rounded-full object-cover ring-2 ring-white"
                    />
                  ) : (
                    <span className="from-primary to-sky grid size-14 place-items-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-sm">
                      {course.coach.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold">{course.coach.name}</span>
                    <span className="text-muted-foreground text-sm">Vezi profilul antrenorului</span>
                  </span>
                </Link>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-card shadow-card overflow-hidden rounded-3xl border">
              <div className="h-1.5" style={{ background: 'var(--gradient-primary)' }} />
              <div className="flex flex-col items-center p-6 text-center">
                <div className="font-display text-3xl font-extrabold">
                  {formatRon(course.price)}
                  <span className="text-muted-foreground text-base font-normal"> / lună</span>
                </div>
                {course.price_per_session > 0 && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {formatRon(course.price_per_session)} / ședință
                  </p>
                )}
                <button
                  type="button"
                  onClick={onEnroll}
                  disabled={isFull}
                  className={cn(
                    'btn-cta btn-cta--primary mt-5 w-full',
                    isFull && 'pointer-events-none opacity-50'
                  )}
                >
                  {isFull ? 'Locuri epuizate' : 'Înscrie-te'}
                </button>
                {isFull ? (
                  <p className="text-destructive mt-3 text-center text-xs font-medium">Locuri epuizate</p>
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

function InfoTile({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  to?: string
}) {
  const body = (
    <>
      <span className="text-primary shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-muted-foreground text-[10px] leading-tight sm:text-xs">{label}</div>
        {to ? (
          <span className="text-primary block text-[11px] leading-snug font-bold break-words hyphens-auto underline-offset-2 group-hover:underline sm:text-sm">
            {value}
          </span>
        ) : (
          <div className="text-[11px] leading-snug font-bold break-words text-foreground sm:text-sm">
            {value}
          </div>
        )}
        {hint && (
          <div className="text-muted-foreground text-[10px] leading-snug sm:text-xs">{hint}</div>
        )}
      </div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="group flex min-w-0 flex-1 items-start gap-1.5 p-2 sm:items-center sm:gap-2.5 sm:p-4"
      >
        {body}
      </Link>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-start gap-1.5 p-2 sm:items-center sm:gap-2.5 sm:p-4">
      {body}
    </div>
  )
}
