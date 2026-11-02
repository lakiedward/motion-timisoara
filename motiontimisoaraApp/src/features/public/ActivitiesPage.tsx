import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getActivitatiPublice, type ActivitateDinLista } from '@/api/public'
import {
  ACTIVITY_PRICE_LIMITS,
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { EventFilters } from '@/components/catalog-filters/EventFilters'
import { FilteredEmptyState } from '@/components/catalog-filters/FilteredEmptyState'
import { CardActivitate } from './components/ActivityListCard'
import { PublicPageHeader } from './components/PublicPageHeader'
import { OFFER_GRID } from './components/OfferCard'

const PRICE_OPTIONS = priceLimitOptions(ACTIVITY_PRICE_LIMITS, (bani) =>
  formatRon(bani).replace(',00', ''),
)

function activityItem(activitate: ActivitateDinLista): EventCatalogItem {
  return {
    sportCode: activitate.sportCode,
    startDate: activitate.activityDate,
    location: activitate.locationName,
    priceRonBani: priceInRonBani(
      activitate.price,
      activitate.currency,
      activitate.eurRonRateMicros,
    ),
  }
}

function sportOptions(activities: ActivitateDinLista[]) {
  const sports = new Map<string, string>()
  for (const activitate of activities)
    if (activitate.sportCode && activitate.sportName)
      sports.set(activitate.sportCode, activitate.sportName)
  return [...sports.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ro'))
}

export default function ActivitiesPage() {
  const [filters, setFilters] = useState(EMPTY_EVENT_FILTERS)
  const {
    data: activities = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['activitati-publice'],
    queryFn: () => getActivitatiPublice(),
  })
  const items = activities.map(activityItem)
  const filtered = activities.filter((_, index) => eventMatchesFilters(items[index]!, filters))

  return (
    <div>
      <PublicPageHeader
        id="activities-page-title"
        section="motion-react:page:/activitati:section:toata-pagina"
        eyebrow="Evenimente"
        title="Activități"
        text="Evenimente și workshop-uri punctuale."
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca activitățile."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă activitățile" className={OFFER_GRID}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : activities.length ? (
          <>
            <EventFilters
              idPrefix="activity"
              filters={filters}
              sportOptions={sportOptions(activities)}
              monthOptions={eventMonthOptions(items)}
              priceOptions={PRICE_OPTIONS}
              locationOptions={eventLocationOptions(items)}
              loading={false}
              onChange={setFilters}
            />
            {filtered.length ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
                  {plural(filtered.length, 'activitate găsită', 'activități găsite')}
                </p>
                <div className={OFFER_GRID}>
                  {filtered.map((activitate) => (
                    <CardActivitate key={activitate.id} activitate={activitate} />
                  ))}
                </div>
              </>
            ) : (
              <FilteredEmptyState
                title="Nicio activitate nu corespunde filtrelor."
                onReset={() => setFilters(EMPTY_EVENT_FILTERS)}
              />
            )}
          </>
        ) : (
          <StatusView
            state="empty"
            title="Nicio activitate programată momentan."
            text="Activitățile noi apar aici când un club sau un antrenor le anunță. Până atunci, copilul tău se poate înscrie la un curs sau la o tabără."
            action={
              <div className="mt-3 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/cursuri">Vezi cursurile</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/tabere">Vezi taberele</Link>
                </Button>
              </div>
            }
          />
        )}
      </div>
    </div>
  )
}
