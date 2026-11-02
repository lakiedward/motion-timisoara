import { Banknote, Building2, CalendarDays, UserRound, Users } from 'lucide-react'

import { formatZi, type TabaraDinLista } from '@/api/camps'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import CampLocation from '@/components/camps/CampLocation'
import { OfferCard, OrganizerLine } from './OfferCard'

export function CardTabara({
  tabara,
  headingLevel,
}: {
  tabara: TabaraDinLista
  headingLevel?: 'h2' | 'h3'
}) {
  const plina = tabara.locuriRamase !== null && tabara.locuriRamase <= 0
  const byAge = tabara.pricingMode === 'by_age'

  return (
    <OfferCard
      to={`/tabere/${tabara.slug}`}
      title={tabara.title}
      imageUrl={tabara.heroUrl}
      full={plina}
      headingLevel={headingLevel}
      meta={[
        {
          key: 'perioada',
          icon: CalendarDays,
          content: `${formatZi(tabara.period_start)} – ${formatZi(tabara.period_end)}`,
        },
        (tabara.location || tabara.location_text) && {
          key: 'loc',
          content: <CampLocation location={tabara.location} details={tabara.location_text} />,
        },
        !plina &&
          tabara.locuriRamase !== null && {
            key: 'locuri',
            icon: Users,
            content: plural(tabara.locuriRamase, 'loc rămas', 'locuri rămase'),
          },
        tabara.allow_cash && {
          key: 'cash',
          icon: Banknote,
          content: 'Se poate plăti și cash',
        },
        tabara.organizator && {
          key: 'organizator',
          icon: tabara.organizator.fel === 'antrenor' ? UserRound : Building2,
          content: <OrganizerLine prefix="Organizată de" name={tabara.organizator.nume} />,
        },
      ]}
      price={byAge ? 'Preț pe categorii de vârstă' : formatMoney(tabara.price, tabara.currency)}
    />
  )
}
