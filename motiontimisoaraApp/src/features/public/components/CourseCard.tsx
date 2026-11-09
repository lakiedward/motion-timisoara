import { MapPin } from 'lucide-react'

import { formatMoney } from '@/lib/money'
import { formatAgeRange } from '@/lib/age-range/age-range'
import { courseHeroUrl, type CourseListItem } from '@/api/public'
import { OfferCard } from './OfferCard'

export function CourseCard({ course }: { course: CourseListItem }) {
  const ageRange = formatAgeRange(course.age_from, course.age_to)
  const ages = ageRange ? ` · ${ageRange}` : ''

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
      price={formatMoney(course.price_per_session, course.currency)}
      priceSuffix="/ ședință"
    />
  )
}
