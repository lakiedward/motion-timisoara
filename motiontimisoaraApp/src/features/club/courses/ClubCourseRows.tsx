import { Link } from 'react-router-dom'
import { MapPin, Pencil } from 'lucide-react'

import type { ClubCourse } from '@/api/club'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { courseAgeLabel } from './club-course-filters'

function CourseRow({
  course,
  pending,
  onToggle,
}: {
  key?: string
  course: ClubCourse
  pending: boolean
  onToggle: () => void
}) {
  const ageLabel = courseAgeLabel(course.age_from, course.age_to)
  return (
    <li className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-semibold break-words">{course.name}</h3>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{course.location?.name ?? '—'}</span>
            </p>
          </div>
          <span className="font-display shrink-0 font-bold tabular-nums">
            {formatMoney(course.price, course.currency)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {course.sport && <Badge>{course.sport.name}</Badge>}
          <Badge variant={course.active ? 'success' : 'outline'}>
            {course.active ? 'Activ' : 'Inactiv'}
          </Badge>
          <span className="text-muted-foreground ml-1 text-sm">
            {course.coach?.name ?? '—'}
            {ageLabel != null && ` · ${ageLabel}`}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11 min-h-11">
          <Link to={`/club/courses/${course.id}/edit`}>
            <Pencil /> Editează
          </Link>
        </Button>
        <Button variant="outline" className="h-11 min-h-11" disabled={pending} onClick={onToggle}>
          {course.active ? 'Dezactivează' : 'Activează'}
        </Button>
      </div>
    </li>
  )
}

export function ClubCourseRows({
  courses,
  pendingId,
  onToggle,
}: {
  courses: ClubCourse[]
  pendingId: string | null
  onToggle: (course: ClubCourse) => void
}) {
  const groups = [
    { title: 'Active', items: courses.filter((c) => c.active) },
    { title: 'Inactive', items: courses.filter((c) => !c.active) },
  ].filter((g) => g.items.length)
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="grid gap-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            {group.title} · {group.items.length}
          </h2>
          <ul className="bg-card divide-y overflow-hidden rounded-xl border">
            {group.items.map((c) => (
              <CourseRow
                key={c.id}
                course={c}
                pending={pendingId === c.id}
                onToggle={() => onToggle(c)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
