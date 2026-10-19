import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Course = { id: string; name: string }
type Props = { courses: Course[]; value: string; onChange: (courseId: string) => void }

const SELECT =
  'border-input bg-background hover:border-muted-foreground focus-visible:outline-ring h-touch-target w-full min-w-0 rounded-md border px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm'

export function CourseSelect({ courses, value, onChange }: Props) {
  return (
    <div className="min-w-0 space-y-1.5 sm:w-56">
      <Label htmlFor="announcement-course">Filtrează după curs</Label>
      <select
        id="announcement-course"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT}
      >
        <option value="">Toate anunțurile</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function CoursePills({ courses, value, onChange }: Props) {
  const options = [{ id: '', name: 'Toate' }, ...courses]
  return (
    <div role="group" aria-label="Filtrează după curs" className="flex flex-wrap gap-2">
      {options.map((course) => (
        <Button
          key={course.id || 'all'}
          type="button"
          className="shrink-0 rounded-full"
          variant={value === course.id ? 'default' : 'outline'}
          aria-pressed={value === course.id}
          onClick={() => onChange(course.id)}
        >
          {course.name}
        </Button>
      ))}
    </div>
  )
}
