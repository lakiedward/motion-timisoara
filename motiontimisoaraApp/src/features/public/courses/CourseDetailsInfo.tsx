import { CalendarDays, MapPin, Users } from 'lucide-react'

import { COURSE_RULES_FILE_BUCKET, rulesFileAfisabil } from '@/api/camp-rules-file'
import { galeriePublica } from '@/api/photo-gallery'
import type { CourseDetail } from '@/api/public'
import { formatAgeRange } from '@/lib/age-range/age-range'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import {
  descriptionParagraphs,
  formatWeeklyProgram,
  upcomingSessions,
  weeklyProgram,
} from '@/lib/course-detail'
import { InfoBand, InfoTile } from '@/features/public/components/InfoTile'
import { OrganizerCoaches, type OrganizerCard } from '@/features/public/components/OrganizerCoaches'
import ActivityPlaceMap from '@/features/public/map/ActivityPlaceMap'
import { PhotoMosaic } from '@/components/photo-gallery/PhotoMosaic'

export function CourseDetailsInfo({
  course,
  remaining,
}: {
  course: CourseDetail
  remaining: number | null
}) {
  const sessions = upcomingSessions(course.occurrences)
  const weekly = sessions.length ? formatWeeklyProgram(weeklyProgram(course)) : null
  const coach = course.coach
    ? {
        id: course.coach.id,
        nume: course.coach.name,
        pozaUrl: course.coach.avatar_url,
        link: `/antrenori/${course.coach.id}`,
      }
    : null
  const organizer: OrganizerCard | null = course.club
    ? { fel: 'club', nume: course.club.name, link: `/cluburi/${course.club.id}` }
    : coach
      ? { fel: 'antrenor', nume: coach.nume, link: coach.link, pozaUrl: coach.pozaUrl }
      : null
  const coaches = course.club && coach ? [coach] : []
  const ages = formatAgeRange(course.age_from, course.age_to) ?? '—'

  return (
    <div>
      <InfoBand>
        <InfoTile icon={<Users className="size-4" />} label="Vârstă" value={ages} />
        <InfoTile
          icon={<MapPin className="size-4" />}
          label="Locație"
          value={course.location?.name ?? '—'}
          hint={course.location?.address?.trim() || undefined}
          to={course.location_id ? `/harta?location=${course.location_id}` : undefined}
        />
        <InfoTile
          icon={<Users className="size-4" />}
          label="Capacitate"
          value={course.capacity != null ? `${remaining ?? '—'} locuri rămase` : '—'}
          hint={course.capacity != null ? `din ${course.capacity}` : undefined}
        />
      </InfoBand>

      <PhotoMosaic
        photos={galeriePublica(
          'course-photos',
          course.course_photos,
          course.hero_photo_storage_path,
        )}
        alt={course.name}
        title="O zi la curs"
        subtitle="Ce face copilul tău la antrenament, pas cu pas."
        sectionKey="course-gallery"
      />

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

      {course.location?.lat != null && course.location.lng != null && (
        <ActivityPlaceMap
          lat={course.location.lat}
          lng={course.location.lng}
          name={course.location.name}
          address={course.location.address}
        />
      )}

      <OrganizerCoaches
        sectionKey="course-organizer"
        organizerTitle="Organizat de"
        organizator={organizer}
        antrenori={coaches}
        coachesTitle={() => 'Antrenor'}
      />
    </div>
  )
}
