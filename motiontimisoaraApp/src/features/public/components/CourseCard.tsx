import { Link } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import { courseHeroUrl, type CourseListItem } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { SportIllustration } from '@/components/sport/SportIllustration'

export function CourseCard({ course }: { course: CourseListItem }) {
  const img = courseHeroUrl(course)

  return (
    <article className="group bg-card shadow-card hover:shadow-card-hover overflow-hidden rounded-3xl pt-0 transition-all duration-300 hover:-translate-y-2">
      <div className="relative aspect-video overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={course.name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <SportIllustration code={course.sport?.code} />
        )}
        {course.sport && <Badge className="absolute top-4 left-4">{course.sport.name}</Badge>}
      </div>
      <div className="space-y-3 px-6 pb-6">
        <h3 className="font-display text-xl font-bold text-foreground">{course.name}</h3>
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-4" />
          {course.location?.city ?? 'Timișoara'}
          {course.age_from != null &&
            course.age_to != null &&
            ` · ${course.age_from}–${course.age_to} ani`}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-display text-lg font-bold">
            {formatMoney(course.price, course.currency)}{' '}
            <span className="text-muted-foreground text-sm font-normal">/ lună</span>
          </span>
          <Link
            to={`/cursuri/${course.id}`}
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-sm font-semibold transition-colors"
          >
            Detalii <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
