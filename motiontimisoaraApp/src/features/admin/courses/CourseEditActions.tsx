import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'

import { PageNewLink } from '@/components/page-header/PageHeader'
import { Button } from '@/components/ui/button'
import type { AdminCourse } from '@/api/admin'

export function NewCourseButton() {
  return <PageNewLink to="/admin/courses/new">Curs nou</PageNewLink>
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
