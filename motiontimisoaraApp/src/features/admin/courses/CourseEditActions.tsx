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
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={
        layout === 'table'
          ? 'h-touch-target min-h-touch-target lg:h-8 lg:min-h-8'
          : 'h-touch-target min-h-touch-target'
      }
    >
      <Link to={`/admin/courses/${course.id}/edit`} aria-label={`Editează ${course.name}`}>
        <Pencil /> Editează
      </Link>
    </Button>
  )
}
