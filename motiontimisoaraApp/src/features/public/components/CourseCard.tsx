import { MapPin } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import { courseHeroUrl, type CourseListItem } from '@/api/public'
import { OfferCard } from './OfferCard'

export function CourseCard({ course }: { course: CourseListItem }) {
  const ages =
    course.age_from != null && course.age_to != null
      ? ` · ${course.age_from}–${course.age_to} ani`
      : ''

  return (
    <OfferCard
      to={`/cursuri/${course.id}`}
      title={course.name}
      imageUrl={courseHeroUrl(course)}
      sportCode={course.sport?.code}
      sportName={course.sport?.name}
      headingLevel="h3"
      meta={[
        {
          key: 'oras',
          icon: MapPin,
          content: `${course.location?.city ?? 'Timișoara'}${ages}`,
        },
      ]}
      price={formatMoney(course.price, course.currency)}
      priceSuffix="/ lună"
    />
  )
}
