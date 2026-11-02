import { CourseListRow } from '@/components/panel-list/CourseListRow'
import { PanelEditAction, PanelToggleAction } from '@/components/panel-list/PanelRowActions'
import type { ClubCourse } from '@/api/club'

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
              <CourseListRow
                key={c.id}
                course={c}
                showCoach
                actions={
                  <>
                    <PanelEditAction to={`/club/courses/${c.id}/edit`} name={c.name} />
                    <PanelToggleAction
                      active={c.active}
                      name={c.name}
                      pending={pendingId === c.id}
                      onToggle={() => onToggle(c)}
                    />
                  </>
                }
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
