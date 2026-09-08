import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import type { ActivityListItem, CourseListItem } from '@/api/public'
import type { Loc } from '@/lib/locuri'
import { plural } from '@/lib/plural'
import { SPORT_COLOR, SPORT_COLOR_FALLBACK, SPORT_ICON } from '../sport-icons'

const dateFmt = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' })

function PopupRow({
  to,
  sportCode,
  title,
  meta,
}: {
  to: string
  sportCode: string | null | undefined
  title: string
  meta: string
}) {
  const color = SPORT_COLOR[sportCode ?? ''] ?? SPORT_COLOR_FALLBACK
  return (
    <Link
      to={to}
      className="group/item -mx-1.5 flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 py-2 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        {SPORT_ICON[sportCode ?? ''] ?? <MapPin className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block break-words text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground block text-xs">{meta}</span>
      </span>
      <ChevronRight className="text-muted-foreground group-hover/item:text-primary size-4 shrink-0" />
    </Link>
  )
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-xs font-bold">
      <span className="text-foreground uppercase tracking-wide">{label}</span>
      <span className="bg-accent text-accent-foreground rounded-full px-1.5 py-px">{count}</span>
    </div>
  )
}

export default function LocationPopup({
  location,
  courses,
  activities,
}: {
  location: Loc
  courses: CourseListItem[]
  activities: ActivityListItem[]
}) {
  return (
    <>
      <div className="bg-primary px-3.5 py-3">
        <div className="flex items-start gap-2.5 pr-11">
          <span className="bg-primary-foreground/20 text-primary-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
            <MapPin className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-primary-foreground break-words text-base font-extrabold leading-tight">
              {location.nume}
            </p>
            <p className="text-primary-foreground mt-1 break-words text-xs leading-snug">
              {location.address ? `${location.address}, ` : ''}
              {location.city}
            </p>
            {location.cluburi > 1 && (
              <p className="text-primary-foreground mt-1 text-xs">
                {plural(location.cluburi, 'club se antrenează aici', 'cluburi se antrenează aici')}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-3 p-3">
        {courses.length > 0 && (
          <div>
            <SectionLabel label="Cursuri" count={courses.length} />
            <div className="space-y-0.5">
              {courses.map((course) => (
                <PopupRow
                  key={course.id}
                  to={`/cursuri/${course.id}`}
                  sportCode={course.sport?.code}
                  title={course.name}
                  meta={
                    course.age_from != null && course.age_to != null
                      ? `${course.age_from}–${course.age_to} ani`
                      : (course.sport?.name ?? 'Curs')
                  }
                />
              ))}
            </div>
          </div>
        )}
        {activities.length > 0 && (
          <div className={courses.length ? 'border-border border-t pt-3' : undefined}>
            <SectionLabel label="Activități" count={activities.length} />
            <div className="space-y-0.5">
              {activities.map((activity) => (
                <PopupRow
                  key={activity.id}
                  to={`/activitati/${activity.id}`}
                  sportCode={activity.sport?.code}
                  title={activity.name}
                  meta={[
                    dateFmt.format(new Date(activity.activity_date)),
                    activity.start_time?.slice(0, 5),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </div>
          </div>
        )}
        {!courses.length && !activities.length && (
          <p className="text-muted-foreground text-sm">
            Momentan fără cursuri sau activități la această locație.
          </p>
        )}
      </div>
    </>
  )
}
