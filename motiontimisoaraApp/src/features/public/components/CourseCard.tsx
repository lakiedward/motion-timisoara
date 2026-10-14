import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import { courseHeroUrl, type CourseListItem } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'

export function CourseCard({ course }: { course: CourseListItem }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const img = courseHeroUrl(course)

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
        <h3 className="font-display text-foreground text-lg font-semibold tracking-tight">
          <Link
            to={`/cursuri/${course.id}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {course.name}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-sm">
          <MapPin aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">
            {course.location?.city ?? 'Timișoara'}
            {course.age_from != null &&
              course.age_to != null &&
              ` · ${course.age_from}–${course.age_to} ani`}
          </span>
        </p>
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
