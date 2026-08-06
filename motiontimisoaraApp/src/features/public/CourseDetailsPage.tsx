import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, MapPin, Users } from 'lucide-react'
import { toast } from 'sonner'

import { getCourse, publicUrl } from '@/api/public'
import { getCourseRatingSummary, getMyCourseRating, submitCourseRating } from '@/api/ratings'
import { formatRon } from '@/lib/money'
import { useAuth } from '@/lib/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import { StarRating } from '@/components/StarRating'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK, SPORT_ICON } from './sport-icons'

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
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Cursul nu a fost găsit.</p>
        <Link to="/cursuri" className="text-primary mt-4 inline-block font-semibold">
          ← Înapoi la cursuri
        </Link>
      </div>
    )
  }

  const hero = [...(course.course_photos ?? [])].sort((a, b) => a.display_order - b.display_order)[0]
  const img = publicUrl('course-photos', hero?.storage_path ?? null)
  const icon = SPORT_ICON[course.sport?.code ?? ''] ?? '🎽'
  const sportColor = SPORT_COLOR[course.sport?.code ?? ''] ?? SPORT_COLOR_FALLBACK
  const sessions = [...(course.occurrences ?? [])].sort(
    (a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)
  )

  const onEnroll = () => {
    if (!user) {
      navigate(`/login?returnUrl=${encodeURIComponent(`/cursuri/${course.id}`)}`)
    } else {
      toast.info('Înscrierea va fi disponibilă în curând (checkout — Faza 5).')
    }
  }

  return (
    <div>
      {/* HERO — full-bleed photo (or sport-tinted fallback) with title/badges overlaid */}
      <section className="relative h-[46vh] min-h-[320px] overflow-hidden md:h-[52vh]">
        {img ? (
          <img src={img} alt={course.name} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-8xl opacity-90"
            style={{ background: `linear-gradient(135deg, ${sportColor} 0%, #0f172a 140%)` }}
          >
            {icon}
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
            <div className="flex flex-wrap items-center gap-2">
              {course.sport && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: sportColor }}
                >
                  {course.sport.name}
                </span>
              )}
              {course.level && (
                <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                  {course.level}
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
          <div className="bg-card shadow-card divide-border flex flex-wrap divide-x overflow-hidden rounded-2xl border">
            {course.age_from != null && (
              <InfoTile icon={<Users className="size-4" />} label="Vârstă" value={`${course.age_from}–${course.age_to} ani`} />
            )}
            <InfoTile icon={<MapPin className="size-4" />} label="Locație" value={course.location?.name ?? '—'} />
            {course.capacity != null && (
              <InfoTile icon={<Users className="size-4" />} label="Capacitate" value={`${course.capacity} locuri`} />
            )}
          </div>

          {course.description && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold">Despre curs</h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">{course.description}</p>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold">Program</h2>
              <ul className="mt-3 space-y-2">
                {sessions.slice(0, 8).map((s) => {
                  const d = new Date(s.starts_at)
                  return (
                    <li key={s.id} className="bg-card flex items-center gap-3 rounded-2xl border p-3 text-sm">
                      <CalendarDays className="text-primary size-4" />
                      <span className="font-medium">{WEEKDAYS[d.getDay()]}</span>
                      <span className="text-muted-foreground">
                        {d.toLocaleDateString('ro-RO')} ·{' '}
                        {d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {course.coach && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold">Antrenor</h2>
              <Link
                to={`/antrenori/${course.coach.id}`}
                className="bg-card hover:bg-accent mt-3 flex items-center gap-3 rounded-2xl border p-4 transition-colors"
              >
                <span className="bg-primary grid size-12 place-items-center rounded-full font-bold text-white">
                  {course.coach.name.charAt(0)}
                </span>
                <span className="font-semibold">{course.coach.name}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Booking sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="bg-card shadow-card overflow-hidden rounded-3xl border">
            <div className="h-1.5" style={{ background: 'var(--gradient-primary)' }} />
            <div className="p-6">
            <div className="font-display text-3xl font-extrabold">
              {formatRon(course.price)}
              <span className="text-muted-foreground text-base font-normal"> / lună</span>
            </div>
            {course.price_per_session > 0 && (
              <p className="text-muted-foreground mt-1 text-sm">
                {formatRon(course.price_per_session)} / ședință
              </p>
            )}
            <button onClick={onEnroll} className="btn-cta btn-cta--primary mt-5 w-full">
              Înscrie-te
            </button>
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Plată online sau cash, gestionată din contul tău.
            </p>

            {rating && rating.count > 0 && (
              <div className="mt-5 flex items-center gap-2 border-t pt-4">
                <StarRating value={rating.avg} size={18} />
                <span className="text-muted-foreground text-sm">
                  {rating.avg.toFixed(1)} · {rating.count}{' '}
                  {rating.count === 1 ? 'evaluare' : 'evaluări'}
                </span>
              </div>
            )}
            {user?.role === 'PARENT' && (
              <div className="mt-4 border-t pt-4">
                <p className="text-muted-foreground mb-1.5 text-sm font-medium">Nota ta</p>
                <StarRating value={myRating ?? 0} onChange={(r) => rate.mutate(r)} />
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

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-1 min-w-[9rem] items-center gap-2.5 p-4">
      <span className="text-primary">{icon}</span>
      <div>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="text-sm font-bold text-foreground">{value}</div>
      </div>
    </div>
  )
}
