import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CalendarDays, MapPin, Users } from 'lucide-react'

import { COURSE_RULES_FILE_BUCKET, rulesFileAfisabil } from '@/api/camp-rules-file'
import type { CourseDetail } from '@/api/public'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import {
  descriptionParagraphs,
  formatWeeklyProgram,
  upcomingSessions,
  weeklyProgram,
} from '@/lib/course-detail'

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function CourseDetailsInfo({
  course,
  remaining,
}: {
  course: CourseDetail
  remaining: number | null
}) {
  const sessions = upcomingSessions(course.occurrences)
  const weekly = sessions.length ? formatWeeklyProgram(weeklyProgram(course)) : null
  const ages =
    course.age_from != null && course.age_to != null
      ? `${course.age_from}–${course.age_to} ani`
      : '—'

  return (
    <div>
      <div className="bg-card divide-border grid grid-cols-3 divide-x rounded-xl border">
        <InfoTile icon={<Users className="size-4" />} label="Vârstă" value={ages} />
        <InfoTile
          icon={<MapPin className="size-4" />}
          label="Locație"
          value={course.location?.name ?? '—'}
          to={course.location_id ? `/harta?location=${course.location_id}` : undefined}
        />
        <InfoTile
          icon={<Users className="size-4" />}
          label="Capacitate"
          value={course.capacity != null ? `${remaining ?? '—'} locuri rămase` : '—'}
          hint={course.capacity != null ? `din ${course.capacity}` : undefined}
        />
      </div>

      {course.club && (
        <p className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-1.5 text-sm">
          <Building2 aria-hidden="true" className="text-primary size-4 shrink-0" />
          Organizat de
          <Link
            to={`/cluburi/${course.club.id}`}
            className={`text-primary inline-flex min-h-touch-target items-center rounded-sm font-semibold underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            {course.club.name}
          </Link>
        </p>
      )}

      {course.description && (
        <section className="bg-card mt-8 rounded-xl border p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold">Despre curs</h2>
          <div className="text-muted-foreground mt-3 space-y-3 leading-relaxed">
            {descriptionParagraphs(course.description).map((part, index) => (
              <p key={index}>{part}</p>
            ))}
          </div>
        </section>
      )}

      <CampRulesDisplay rules={null} fisier={rulesFileAfisabil(COURSE_RULES_FILE_BUCKET, course)} />

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Program</h2>
        <div className="bg-card mt-4 rounded-xl border">
          {weekly && (
            <p className="border-b px-4 py-3 text-sm sm:px-5">
              <span className="text-muted-foreground">În fiecare săptămână: </span>
              <span className="text-foreground font-semibold">{weekly}</span>
            </p>
          )}
          {sessions.length > 0 ? (
            <ul className="divide-border divide-y">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
                    <CalendarDays aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold">{session.weekday}</div>
                    <div className="text-muted-foreground text-sm">
                      {session.date} · {session.time}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground flex items-center gap-3 px-4 py-4 text-sm sm:px-5">
              <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
                <CalendarDays aria-hidden="true" className="size-4" />
              </span>
              Programul se anunță în curând
            </p>
          )}
        </div>
      </section>

      {course.coach && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">Antrenor</h2>
          <Link
            to={`/antrenori/${course.coach.id}`}
            className={`bg-card shadow-card hover:shadow-card-hover hover:border-foreground/20 mt-4 flex items-center gap-4 rounded-xl border p-4 transition-[box-shadow,border-color] duration-200 motion-reduce:transition-none ${FOCUS_RING}`}
          >
            {course.coach.avatar_url ? (
              <img
                src={course.coach.avatar_url}
                alt=""
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <span className="from-primary to-sky grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br text-lg font-bold text-white">
                {course.coach.name.charAt(0)}
              </span>
            )}
            <span className="min-w-0">
              <span className="text-foreground block font-semibold">{course.coach.name}</span>
              <span className="text-muted-foreground text-sm">Vezi profilul antrenorului</span>
            </span>
          </Link>
        </section>
      )}
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  hint,
  to,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  to?: string
}) {
  const body = (
    <>
      <span aria-hidden="true" className="text-primary shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs leading-tight">{label}</div>
        <div
          className={
            to
              ? 'text-primary text-sm leading-snug font-bold break-words underline-offset-2 group-hover:underline'
              : 'text-foreground text-sm leading-snug font-bold break-words'
          }
        >
          {value}
        </div>
        {hint && <div className="text-muted-foreground text-xs leading-snug">{hint}</div>}
      </div>
    </>
  )
  const layout = 'flex min-w-0 flex-1 flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-2.5 sm:p-4'

  if (to) {
    return (
      <Link to={to} className={`group focus-visible:rounded-lg ${layout} ${FOCUS_RING}`}>
        {body}
      </Link>
    )
  }

  return <div className={layout}>{body}</div>
}
