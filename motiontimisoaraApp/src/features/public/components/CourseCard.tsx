import { Link } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'

import { formatRon } from '@/lib/money'
import { publicUrl, type CourseListItem } from '@/api/public'
import { Badge } from '@/components/ui/badge'
import { SPORT_ICON } from '../sport-icons'

export function CourseCard({ course }: { course: CourseListItem }) {
  const hero = [...(course.course_photos ?? [])].sort((a, b) => a.display_order - b.display_order)[0]
  const img = publicUrl('course-photos', hero?.storage_path ?? null)
  const icon = SPORT_ICON[course.sport?.code ?? ''] ?? '🎽'

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
          <div className="from-primary/15 to-highlight/15 text-primary flex size-full items-center justify-center bg-gradient-to-br text-5xl">
            {icon}
          </div>
        )}
        {course.sport && (
          <Badge className="absolute top-4 left-4">{course.sport.name}</Badge>
        )}
      </div>
      <div className="space-y-3 px-6 pb-6">
        <h3 className="font-display text-xl font-bold text-foreground">{course.name}</h3>
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-4" />
          {course.location?.city ?? 'Timișoara'}
          {course.age_from != null && course.age_to != null && ` · ${course.age_from}–${course.age_to} ani`}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-display text-lg font-bold">
            {formatRon(course.price)} <span className="text-muted-foreground text-sm font-normal">/ lună</span>
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
