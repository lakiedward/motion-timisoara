import { Building2, CalendarDays, Landmark, MapPin, UserRound, Users } from 'lucide-react'

import { courseHeroUrl, type CourseCatalogItem } from '@/api/public'
import { courseSlots, formatCourseSchedule } from '@/lib/course-catalog'
import { formatAgeRange } from '@/lib/age-range/age-range'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { OfferCard, OrganizerLine } from '../components/OfferCard'

export function CourseCatalogCard({ course }: { course: CourseCatalogItem }) {
  const schedule = formatCourseSchedule(courseSlots(course))
  const full = course.spotsRemaining !== null && course.spotsRemaining <= 0
  const organizer = course.club
    ? { icon: Building2, name: course.club.name }
    : course.coach?.name
      ? { icon: UserRound, name: course.coach.name }
      : null
  const ages = formatAgeRange(course.age_from, course.age_to)

  return (
    <OfferCard
      to={`/cursuri/${course.id}`}
      title={course.name}
      imageUrl={courseHeroUrl(course)}
      sportCode={course.sport?.code}
      sportName={course.sport?.name}
      full={full}
      fullLabel="Curs plin"
      meta={[
        {
          key: 'oras',
          icon: MapPin,
          content: `${course.location?.city ?? 'Timișoara'}${ages ? ` · ${ages}` : ''}`,
        },
        {
          key: 'program',
          icon: CalendarDays,
          content: schedule ?? 'Programul se anunță în curând',
        },
        course.location?.name && {
          key: 'loc',
          icon: Landmark,
          content: course.location.name,
        },
        !full &&
          course.spotsRemaining !== null && {
            key: 'locuri',
            icon: Users,
            content: plural(course.spotsRemaining, 'loc rămas', 'locuri rămase'),
          },
        organizer && {
          key: 'organizator',
          icon: organizer.icon,
          content: <OrganizerLine prefix="Organizat de" name={organizer.name} />,
        },
      ]}
      price={formatMoney(course.price_per_session, course.currency)}
      priceSuffix="/ ședință"
    />
  )
}
