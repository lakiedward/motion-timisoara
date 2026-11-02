import { SelectMenu } from '@/components/ui/select-menu'
import { Label } from '@/components/ui/label'

type Course = { id: string; name: string }
type Props = { courses: Course[]; value: string; onChange: (courseId: string) => void }

export function CourseSelect({ courses, value, onChange }: Props) {
  return (
    <div className="min-w-0 space-y-1.5 sm:w-56">
      <Label id="announcement-course-label">Filtrează după curs</Label>
      <SelectMenu
        id="announcement-course"
        aria-labelledby="announcement-course-label announcement-course"
        value={value}
        onValueChange={onChange}
        emptyLabel="Toate anunțurile"
        options={courses.map((course) => ({ value: course.id, label: course.name }))}
      />
    </div>
  )
}
