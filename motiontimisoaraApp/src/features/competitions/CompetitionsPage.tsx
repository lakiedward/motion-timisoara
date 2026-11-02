import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

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
import { formatCompetitionDateTime } from '@/lib/competition-schedule'

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
      <section
        aria-labelledby="competitions-page-title"
        data-section="motion-react:page:/concursuri:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Întreceri</span>
          <h1
            id="competitions-page-title"
            className="font-display text-foreground text-4xl font-extrabold lg:text-5xl"
          >
            Concursuri
          </h1>
          <p className="text-muted-foreground mt-2">Concursuri sportive pentru copii și adulți.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca concursurile."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă concursurile" className="grid gap-7 md:grid-cols-2">
            {[0, 1].map((i) => (
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
                <div className="grid gap-7 md:grid-cols-2">
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
    <article className="bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card relative flex h-full flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none">
      {concurs.heroUrl && (
        <img src={concurs.heroUrl} alt="" loading="lazy" className="h-44 w-full object-cover" />
      )}
      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-foreground text-xl font-bold">
          <Link
            to={`/concursuri/${concurs.slug}`}
            className="rounded-md after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {concurs.title}
          </Link>
        </h2>
        <p className="text-muted-foreground mt-3 line-clamp-3 text-sm">{concurs.description}</p>
        {concurs.startAt && (
          <p className="text-muted-foreground mt-3 text-sm">
            {formatCompetitionDateTime(concurs.startAt)}
            {concurs.locationText ? ` · ${concurs.locationText}` : ''}
          </p>
        )}
        {concurs.organizator && (
          <p className="text-muted-foreground mt-4 text-sm">
            Organizat de{' '}
            <span className="text-foreground font-medium">{concurs.organizator.nume}</span>
          </p>
        )}
      </div>
    </article>
  )
}
