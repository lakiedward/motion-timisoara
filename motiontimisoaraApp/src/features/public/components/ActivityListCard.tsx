import { CalendarDays, Clock, MapPin, UserRound, Users } from 'lucide-react'

import type { ActivitateDinLista } from '@/api/public'
import { formatOfferPrice } from '@/lib/money'
import { plural } from '@/lib/plural'
import { OfferCard, OrganizerLine } from './OfferCard'

function ziActivitate(data: string): string {
  const [an, luna, zi] = data.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, zi ?? 1).toLocaleDateString('ro-RO')
}

export function CardActivitate({
  activitate,
  headingLevel,
}: {
  activitate: ActivitateDinLista
  headingLevel?: 'h2' | 'h3'
}) {
  const plina = activitate.locuriRamase !== null && activitate.locuriRamase <= 0

  return (
    <OfferCard
      to={`/activitati/${activitate.id}`}
      title={activitate.name}
      imageUrl={activitate.heroUrl}
      sportCode={activitate.sportCode}
      sportName={activitate.sportName}
      full={plina}
      headingLevel={headingLevel}
      meta={[
        {
          key: 'data',
          icon: CalendarDays,
          content: ziActivitate(activitate.activityDate),
        },
        {
          key: 'ore',
          icon: Clock,
          content: `${activitate.startTime.slice(0, 5)}–${activitate.endTime.slice(0, 5)}`,
        },
        activitate.locationName && {
          key: 'loc',
          icon: MapPin,
          content: activitate.locationName,
        },
        !plina &&
          activitate.locuriRamase !== null && {
            key: 'locuri',
            icon: Users,
            content: plural(activitate.locuriRamase, 'loc rămas', 'locuri rămase'),
          },
        activitate.organizator && {
          key: 'organizator',
          icon: UserRound,
          content: <OrganizerLine prefix="Organizată de" name={activitate.organizator} />,
        },
      ]}
      price={formatOfferPrice(activitate.price, activitate.currency)}
    />
  )
}
