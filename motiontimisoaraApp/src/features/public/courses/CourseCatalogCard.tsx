import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CalendarDays, Landmark, MapPin, UserRound, Users } from 'lucide-react'

import { courseHeroUrl, type CourseCatalogItem } from '@/api/public'
import { courseSlots, formatCourseSchedule } from '@/lib/course-catalog'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'

export function CourseCatalogCard({ course }: { course: CourseCatalogItem }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const img = courseHeroUrl(course)
  const schedule = formatCourseSchedule(courseSlots(course))
  const full = course.spotsRemaining !== null && course.spotsRemaining <= 0
  const organizer = course.club
    ? { icon: Building2, name: course.club.name }
    : course.coach?.name
      ? { icon: UserRound, name: course.coach.name }
      : null
  const OrganizerIcon = organizer?.icon ?? UserRound
  const ages =
    course.age_from != null && course.age_to != null
      ? `${course.age_from}–${course.age_to} ani`
      : null

  return (
    <article className="group bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card relative flex h-full cursor-pointer flex-col rounded-xl border transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none">
      <div className="relative aspect-video overflow-hidden rounded-t-xl">
        {img && !photoFailed ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <SportIllustration code={course.sport?.code} />
        )}
        {course.sport && <Badge className="absolute top-3 left-3">{course.sport.name}</Badge>}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">
            <Link
              to={`/cursuri/${course.id}`}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {course.name}
            </Link>
          </h2>
          {full && <Badge variant="destructive">Curs plin</Badge>}
        </div>

        <p className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-sm">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">
            {course.location?.city ?? 'Timișoara'}
            {ages && ` · ${ages}`}
          </span>
        </p>

        <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
          <li className="flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            {schedule ?? 'Programul se anunță în curând'}
          </li>
          {course.location?.name && (
            <li className="flex min-w-0 items-center gap-1.5">
              <Landmark aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{course.location.name}</span>
            </li>
          )}
          {!full && course.spotsRemaining !== null && (
            <li className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4 shrink-0" />
              {plural(course.spotsRemaining, 'loc rămas', 'locuri rămase')}
            </li>
          )}
          {organizer && (
            <li className="flex min-w-0 items-center gap-1.5">
              <OrganizerIcon aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">
                Organizat de{' '}
                <span className="text-foreground font-medium">{organizer.name}</span>
              </span>
            </li>
          )}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <span className="font-display text-foreground text-lg font-bold">
            {formatMoney(course.price, course.currency)}{' '}
            <span className="text-muted-foreground font-sans text-sm font-normal">/ lună</span>
          </span>
          <span
            aria-hidden="true"
            className="text-muted-foreground group-hover:text-primary inline-flex items-center gap-1 text-sm font-semibold transition-colors"
          >
            Detalii <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  )
}
