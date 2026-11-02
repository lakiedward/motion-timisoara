import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, CalendarDays, Clock, MapPin, UserRound } from 'lucide-react'

import { getConcursuriPublice, type PublicCompetition } from '@/api/competition/competitions'
import {
  EMPTY_EVENT_FILTERS,
  eventLocationOptions,
  eventMatchesFilters,
  eventMonthOptions,
  type EventCatalogItem,
} from '@/lib/event-catalog'
import { plural } from '@/lib/plural'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
import { EventFilters } from '@/components/catalog-filters/EventFilters'
import { FilteredEmptyState } from '@/components/catalog-filters/FilteredEmptyState'
import { formatCompetitionDay, formatCompetitionTime } from '@/lib/competition-schedule'
import { OFFER_GRID, OfferCard, OrganizerLine } from '@/features/public/components/OfferCard'
import { PublicPageHeader } from '@/features/public/components/PublicPageHeader'

function competitionItem(concurs: PublicCompetition): EventCatalogItem {
  return { startDate: concurs.startAt, endDate: concurs.endAt, location: concurs.locationText }
}

export default function CompetitionsPage() {
  const [filters, setFilters] = useState(EMPTY_EVENT_FILTERS)
  const {
    data: concursuri = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['concursuri-publice'], queryFn: getConcursuriPublice })
  const items = concursuri.map(competitionItem)
  const filtered = concursuri.filter((_, index) => eventMatchesFilters(items[index]!, filters))

  return (
    <div>
      <PublicPageHeader
        id="competitions-page-title"
        section="motion-react:page:/concursuri:section:toata-pagina"
        eyebrow="Întreceri"
        title="Concursuri"
        text="Concursuri sportive pentru copii și adulți."
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca concursurile."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă concursurile" className={OFFER_GRID}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : concursuri.length ? (
          <>
            <EventFilters
              idPrefix="competition"
              filters={filters}
              monthOptions={eventMonthOptions(items)}
              locationOptions={eventLocationOptions(items)}
              loading={false}
              onChange={setFilters}
            />
            {filtered.length ? (
              <>
                <p className="text-muted-foreground mb-4 text-sm" aria-live="polite">
                  {plural(filtered.length, 'concurs găsit', 'concursuri găsite')}
                </p>
                <div className={OFFER_GRID}>
                  {filtered.map((concurs) => (
                    <CardConcurs key={concurs.id} concurs={concurs} />
                  ))}
                </div>
              </>
            ) : (
              <FilteredEmptyState
                title="Niciun concurs nu corespunde filtrelor."
                onReset={() => setFilters(EMPTY_EVENT_FILTERS)}
              />
            )}
          </>
        ) : (
          <StatusView
            state="empty"
            title="Niciun concurs publicat momentan."
            text="Concursurile noi apar aici când un club sau un antrenor le publică."
          />
        )}
      </div>
    </div>
  )
}

function CardConcurs({ concurs }: { concurs: PublicCompetition }) {
  return (
    <OfferCard
      to={`/concursuri/${concurs.slug}`}
      title={concurs.title}
      imageUrl={concurs.heroUrl}
      meta={[
        concurs.startAt && {
          key: 'data',
          icon: CalendarDays,
          content: formatCompetitionDay(concurs.startAt),
        },
        concurs.startAt && {
          key: 'ora',
          icon: Clock,
          content: formatCompetitionTime(concurs.startAt),
        },
        concurs.locationText && {
          key: 'loc',
          icon: MapPin,
          content: concurs.locationText,
        },
        concurs.organizator && {
          key: 'organizator',
          icon: concurs.organizator.fel === 'antrenor' ? UserRound : Building2,
          content: <OrganizerLine prefix="Organizat de" name={concurs.organizator.nume} />,
        },
      ]}
    />
  )
}
