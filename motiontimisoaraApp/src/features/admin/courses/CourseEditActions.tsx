import { PageNewLink } from '@/components/page-header/PageHeader'
import { PanelEditAction } from '@/components/panel-list/PanelRowActions'
import type { AdminCourse } from '@/api/admin'

export function NewCourseButton() {
  return <PageNewLink to="/admin/courses/new">Curs nou</PageNewLink>
}

export function EditCourseAction({ course }: { course: AdminCourse }) {
  return <PanelEditAction to={`/admin/courses/${course.id}/edit`} name={course.name} />
}
