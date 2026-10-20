import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

import type { AdminCourse } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fold } from './course-overview'

export type ToggleArgs = { id: string; name: string; active: boolean }
export type RenderCourseActions = (course: AdminCourse, layout: 'table' | 'card') => ReactNode

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? 'success' : 'outline'}>{active ? 'Activ' : 'Inactiv'}</Badge>
}

export function ToggleAction({
  course,
  pending,
  onToggle,
  className,
}: {
  course: AdminCourse
  pending: boolean
  onToggle: (args: ToggleArgs) => void
  className?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => onToggle({ id: course.id, name: course.name, active: !course.active })}
    >
      {course.active ? 'Dezactivează' : 'Activează'}
    </Button>
  )
}

export function EnrollmentMeter({ course }: { course: AdminCourse }) {
  const enrolled = course.enrollments.active
  const capacity = course.capacity && course.capacity > 0 ? course.capacity : null
  const fill = capacity ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
  return (
    <span className="inline-flex items-center gap-2 text-sm tabular-nums">
      <span>{capacity ? `${enrolled}/${capacity}` : enrolled}</span>
      {capacity && (
        <span
          aria-hidden="true"
          className="bg-secondary block h-1.5 w-14 overflow-hidden rounded-full"
        >
          <span className="bg-primary block h-full rounded-full" style={{ width: `${fill}%` }} />
        </span>
      )}
      <span className="sr-only">{capacity ? `înscriși din ${capacity} locuri` : 'înscriși'}</span>
    </span>
  )
}

export function AttentionNote({ reason }: { reason: string | null }) {
  if (!reason) return null
  return (
    <span className="text-highlight-ink mt-0.5 flex items-center gap-1 text-xs font-semibold">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      {reason}
    </span>
  )
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = fold(query.trim())
  if (!needle) return <>{text}</>
  const start = fold(text).indexOf(needle)
  if (start < 0) return <>{text}</>
  const end = start + needle.length
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-highlight/30 text-foreground rounded-sm">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}
