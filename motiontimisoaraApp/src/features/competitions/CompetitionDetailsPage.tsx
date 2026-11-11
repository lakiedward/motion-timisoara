import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, MapPin } from 'lucide-react'

import { getConcursPublic } from '@/api/competition/competitions'
import { listCompetitionOffers } from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompetitionDay, formatCompetitionTime } from '@/lib/competition-schedule'
import { useCompetitionClock } from './useCompetitionClock'
import { PublicHeroBand } from '@/features/public/PublicHeroBand'
import { InfoBand, InfoTile } from '@/features/public/components/InfoTile'
import { OrganizerCoaches } from '@/features/public/components/OrganizerCoaches'
import { CompetitionEnrollCard } from './registration/CompetitionEnrollCard'
import { DetailBackLink } from '@/features/public/components/DetailBackLink'
import { useDocumentTitle } from '@/lib/page-title'
import { CompetitionCoachesSection } from './detail/CompetitionCoachesSection'
import { CompetitionResultsSection } from './detail/CompetitionResultsSection'
import {
  COMPETITION_ROUTES_ANCHOR,
  CompetitionRoutesSection,
} from './detail/CompetitionRoutesSection'

const HERO_SECTION = 'motion-react:page:/concursuri/:slug:section:toata-pagina'
const SCHEDULE_SECTION = 'manual:section:program-si-locatie:f5d67447-2bfe-4917-9325-e0fd16bbe201'

export default function CompetitionDetailsPage() {
  const { slug = '' } = useParams()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['concurs-public', slug],
    queryFn: () => getConcursPublic(slug),
    retry: false,
  })
  useDocumentTitle(data?.title, 'Concursuri')
  const now = useCompetitionClock(data?.endAt, data?.registrationDeadlineAt)
  const offers = useQuery({
    queryKey: ['competition-offers', data?.id],
    queryFn: () => listCompetitionOffers(data!.id),
    enabled: Boolean(data?.id),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca concursul.</p>
        <Button
          className="mt-4 h-touch-target min-h-touch-target"
          type="button"
          onClick={() => void refetch()}
        >
          Reîncearcă
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Concursul nu a fost găsit.</p>
        <Link
          to="/concursuri"
          className="text-primary mt-4 inline-flex h-touch-target items-center font-semibold"
        >
          ← Înapoi la concursuri
        </Link>
      </div>
    )
  }

  const enrollOpen =
    data.registrationDeadlineAt !== null &&
    Date.parse(data.registrationDeadlineAt) > now &&
    Boolean(offers.data?.categories.length)
  const ended = Boolean(data.endAt && Date.parse(data.endAt) <= now)
  const startDay = data.startAt ? formatCompetitionDay(data.startAt) : null
  const endDay = data.endAt ? formatCompetitionDay(data.endAt) : null
  const hours =
    data.startAt && data.endAt
      ? startDay === endDay
        ? `${formatCompetitionTime(data.startAt)}–${formatCompetitionTime(data.endAt)}`
        : `${formatCompetitionTime(data.startAt)} – ${endDay}, ${formatCompetitionTime(data.endAt)}`
      : null

  return (
    <div>
      <div data-section={HERO_SECTION}>
        <PublicHeroBand
          url={data.heroUrl}
          title={data.title}
          backTo="/concursuri"
          backLabel="Înapoi la concursuri"
        />

        {!data.heroUrl && (
          <div className="mx-auto max-w-6xl px-6 pt-8">
            <DetailBackLink to="/concursuri" label="Înapoi la concursuri" />
            <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
              {data.title}
            </h1>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <div data-section={SCHEDULE_SECTION}>
              <InfoBand>
                <InfoTile
                  icon={<CalendarDays className="size-4" />}
                  label="Data"
                  value={startDay ?? 'În curs de stabilire'}
                />
                {hours && (
                  <InfoTile icon={<Clock className="size-4" />} label="Ore" value={hours} />
                )}
                <InfoTile
                  icon={<MapPin className="size-4" />}
                  label="Loc"
                  value={data.locationText ?? 'În curs de stabilire'}
                />
              </InfoBand>
            </div>

            {data.description && (
              <section
                data-section="manual:section:despre-concurs:c733fd92-c968-4cbd-9755-9c4b11141c87"
                className="bg-card mt-8 rounded-xl border p-5 sm:p-6"
              >
                <h2 className="font-display text-xl font-bold">Despre concurs</h2>
                <p className="text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">
                  {data.description}
                </p>
              </section>
            )}

            <CompetitionCoachesSection competitionId={data.id} />

            <CompetitionRoutesSection
              competitionId={data.id}
              offers={offers}
              enrollSlug={enrollOpen ? data.slug : null}
            />

            {ended && (
              <CompetitionResultsSection
                competitionId={data.id}
                categories={offers.data?.categories ?? []}
                categoriesLoading={offers.isLoading}
              />
            )}

            <OrganizerCoaches
              sectionKey="manual:section:organizat-de:f3632f7e-dcde-4ec3-a32e-b40dc38b03c2"
              organizerTitle="Organizat de"
              organizator={data.organizator}
              antrenori={[]}
              coachesTitle={() => 'Antrenori'}
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CompetitionEnrollCard
              categoriesAnchor={COMPETITION_ROUTES_ANCHOR}
              deadlineAt={data.registrationDeadlineAt}
              prices={offers.data?.categories.map((category) => category.price_bani) ?? []}
              loading={offers.isLoading}
              now={now}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
