import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getTaberePublice, type TabaraDinLista } from '@/api/camps'
import {
  CAMP_PRICE_LIMITS,
  EMPTY_EVENT_FILTERS,
  eventLocationOptions,
  eventMatchesFilters,
  eventMonthOptions,
  priceInRonBani,
  priceLimitOptions,
  type EventCatalogItem,
} from '@/lib/event-catalog'
import { formatRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { EventFilters } from '@/components/catalog-filters/EventFilters'
import { FilteredEmptyState } from '@/components/catalog-filters/FilteredEmptyState'
import { CardTabara } from './components/CampListCard'
import { PublicPageHeader } from './components/PublicPageHeader'
import { OFFER_GRID } from './components/OfferCard'

const PRICE_OPTIONS = priceLimitOptions(CAMP_PRICE_LIMITS, (bani) =>
  formatRon(bani).replace(',00', ''),
)

function campItem(tabara: TabaraDinLista): EventCatalogItem {
  return {
    startDate: tabara.period_start,
    endDate: tabara.period_end,
    location: tabara.location?.name ?? tabara.location_text,
    priceRonBani:
      tabara.pricingMode === 'by_age'
        ? null
        : priceInRonBani(tabara.price, tabara.currency, tabara.eurRonRateMicros),
  }
}

export default function CampsPage() {
  const [filters, setFilters] = useState(EMPTY_EVENT_FILTERS)
  const {
    data: tabere = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['tabere-publice'], queryFn: () => getTaberePublice() })
  const items = tabere.map(campItem)
  const filtered = tabere.filter((_, index) => eventMatchesFilters(items[index]!, filters))

  return (
    <div>
      <PublicPageHeader
        id="camps-page-title"
        section="motion-react:page:/tabere:section:toata-pagina"
        eyebrow="Vacanțe active"
        title="Tabere"
        text="Tabere sportive pentru copii."
      />

      <div
        data-section="motion-react:page:/tabere:section:lista-tabere"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca taberele."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă taberele" className={OFFER_GRID}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : tabere.length ? (
          <>
            <EventFilters
              idPrefix="camp"
              filters={filters}
              monthOptions={eventMonthOptions(items)}
              priceOptions={PRICE_OPTIONS}
              locationOptions={eventLocationOptions(items)}
              loading={false}
              onChange={setFilters}
            />
            {filtered.length ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
                  {plural(filtered.length, 'tabără găsită', 'tabere găsite')}
                </p>
                <ul className={OFFER_GRID}>
                  {filtered.map((t) => (
                    <li key={t.id}>
                      <CardTabara tabara={t} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <FilteredEmptyState
                title="Nicio tabără nu corespunde filtrelor."
                onReset={() => setFilters(EMPTY_EVENT_FILTERS)}
              />
            )}
          </>
        ) : (
          <StatusView
            state="empty"
            title="Nicio tabără programată momentan."
            text="Taberele noi apar aici când un club sau un antrenor le anunță."
          />
        )}
      </div>
    </div>
  )
}
