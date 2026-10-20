import { Link } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AdminCourse } from '@/api/admin'

export function NewCourseButton() {
  return (
    <Button asChild className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9">
      <Link to="/admin/courses/new">
        <Plus /> Curs nou
      </Link>
    </Button>
  )
}

export function EditCourseAction({
  course,
  layout,
}: {
  course: AdminCourse
  layout: 'table' | 'card'
}) {
  const table = layout === 'table'
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={
        table
          ? 'size-touch-target min-h-touch-target px-0 lg:size-8 lg:min-h-8 xl:w-auto xl:px-3'
          : 'h-touch-target min-h-touch-target'
      }
    >
      <Link
        to={`/admin/courses/${course.id}/edit`}
        aria-label={`Editează ${course.name}`}
        title="Editează"
      >
        <Pencil />
        <span className={table ? 'hidden xl:inline' : undefined}>Editează</span>
      </Link>
    </Button>
  )
}
