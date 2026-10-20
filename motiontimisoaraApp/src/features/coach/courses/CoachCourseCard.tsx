import { Link } from 'react-router-dom'
import { MapPin, Pencil } from 'lucide-react'

import type { CoachCourse } from '@/api/coach'
import { formatMoney } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function courseListAgeLabel(ageFrom: number | null, ageTo: number | null) {
  if (ageFrom != null && ageTo != null) return `${ageFrom}–${ageTo} ani`
  if (ageFrom != null) return `de la ${ageFrom} ani`
  if (ageTo != null) return `până la ${ageTo} ani`
  return null
}

export function CoachCourseCard({
  course,
  pending,
  onToggle,
}: {
  course: CoachCourse
  pending: boolean
  onToggle: () => void
}) {
  const ageLabel = courseListAgeLabel(course.age_from, course.age_to)
  const locationName = course.location?.name ?? '—'
  return (
    <Card className="gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold break-words">{course.name}</h3>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{locationName}</span>
          </p>
        </div>
        <span className="font-display shrink-0 font-bold tabular-nums">
          {formatMoney(course.price, course.currency)}
        </span>
      </div>
      <div>
        <div className="flex flex-wrap gap-1.5">
          {course.sport && <Badge>{course.sport.name}</Badge>}
          <Badge variant={course.active ? 'success' : 'outline'}>
            {course.active ? 'Activ' : 'Inactiv'}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {locationName}
          {ageLabel != null && ` · ${ageLabel}`}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11 min-h-11">
          <Link to={`/coach/courses/${course.id}/edit`}>
            <Pencil /> Editează
          </Link>
        </Button>
        <Button variant="outline" className="h-11 min-h-11" disabled={pending} onClick={onToggle}>
          {course.active ? 'Dezactivează' : 'Activează'}
        </Button>
      </div>
    </Card>
  )
}
