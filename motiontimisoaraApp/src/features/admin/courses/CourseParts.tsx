import type { ReactNode } from 'react'
import { CircleAlert, Users } from 'lucide-react'

import type { AdminCourse } from '@/api/admin'
import { fold } from './course-overview'

export type ToggleArgs = { id: string; name: string; active: boolean }
export type RenderCourseActions = (course: AdminCourse) => ReactNode

export function EnrollmentMeter({ course }: { course: AdminCourse }) {
  const enrolled = course.enrollments.active
  const capacity = course.capacity && course.capacity > 0 ? course.capacity : null
  const fill = capacity ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
  return (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums">
      <Users aria-hidden="true" className="size-4 shrink-0" />
      <span>{capacity ? `${enrolled}/${capacity}` : enrolled} înscriși</span>
      {capacity && (
        <span
          aria-hidden="true"
          className="bg-secondary ml-1 block h-1.5 w-14 overflow-hidden rounded-full"
        >
          <span className="bg-primary block h-full rounded-full" style={{ width: `${fill}%` }} />
        </span>
      )}
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
