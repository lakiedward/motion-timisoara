import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, MapPin } from 'lucide-react'

import { getConcursPublic } from '@/api/competition/competitions'
import {
  listCompetitionOffers,
  competitionRouteGpxDownloadUrl,
  competitionRouteGpxUrl,
} from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompetitionDay, formatCompetitionTime } from '@/lib/competition-schedule'
import { formatRonOffer } from '@/lib/money'
import { CompetitionRouteMap } from './CompetitionRouteMap'
import { getPublishedCompetitionPodium } from '@/api/competition/competition-podium'
import { getPublicCompetitionCoaches } from '@/api/competition/competition-coaches'
import { listCompetitionRoutePhotos } from '@/api/competition/competition-route-photos'
import { useCompetitionClock } from './useCompetitionClock'
import PhotoGallery from '@/components/photo-gallery/PhotoGallery'
import { PublicHeroBand } from '@/features/public/PublicHeroBand'
import { InfoBand, InfoTile } from '@/features/public/components/InfoTile'
import { OrganizerCoaches } from '@/features/public/components/OrganizerCoaches'
import { CompetitionEnrollCard } from './registration/CompetitionEnrollCard'
import { DetailBackLink } from '@/features/public/components/DetailBackLink'
import { useDocumentTitle } from '@/lib/page-title'

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
  const podium = useQuery({
    queryKey: ['competition-podium-public', data?.id],
    queryFn: () => getPublishedCompetitionPodium(data!.id),
    enabled: Boolean(data?.id && data.endAt && Date.parse(data.endAt) <= now),
  })
  const coaches = useQuery({
    queryKey: ['competition-public-coaches', data?.id],
    queryFn: () => getPublicCompetitionCoaches(data!.id),
    enabled: Boolean(data?.id),
  })
  const routePhotos = useQuery({
    queryKey: ['competition-route-photos', data?.id],
    queryFn: () => listCompetitionRoutePhotos(data!.id),
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
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
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
          className="text-primary mt-4 inline-flex h-11 items-center font-semibold"
        >
          ← Înapoi la concursuri
        </Link>
      </div>
    )
  }

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

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <InfoBand>
              <InfoTile
                icon={<CalendarDays className="size-4" />}
                label="Data"
                value={startDay ?? 'În curs de stabilire'}
              />
              {hours && <InfoTile icon={<Clock className="size-4" />} label="Ore" value={hours} />}
              <InfoTile
                icon={<MapPin className="size-4" />}
                label="Loc"
                value={data.locationText ?? 'În curs de stabilire'}
              />
            </InfoBand>

            {data.description && (
              <section className="bg-card mt-8 rounded-xl border p-5 sm:p-6">
                <h2 className="font-display text-xl font-bold">Despre concurs</h2>
                <p className="text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">
                  {data.description}
                </p>
              </section>
            )}

        <section className="mt-8" aria-label="Antrenorii concursului">
          <h2 className="font-display text-xl font-bold">Antrenorii concursului</h2>
          {coaches.isLoading ? (
            <Skeleton className="mt-4 h-20 rounded-xl" />
          ) : coaches.isError ? (
            <div role="alert" className="mt-4 space-y-2 rounded-xl border p-4">
              <p>Nu am putut încărca antrenorii.</p>
              <Button variant="outline" onClick={() => void coaches.refetch()}>
                Reîncearcă
              </Button>
            </div>
          ) : coaches.data?.length ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {coaches.data.map((coach) => (
                <li
                  key={coach.coachProfileId}
                  className="bg-card flex items-center gap-3 rounded-xl border p-3"
                >
                  {coach.photoUrl ? (
                    <img
                      src={coach.photoUrl}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="bg-muted grid size-10 place-items-center rounded-full font-semibold">
                      {coach.name.charAt(0)}
                    </span>
                  )}
                  <span className="font-medium">{coach.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">
              Nu există încă antrenori confirmați pentru acest concurs.
            </p>
          )}
        </section>

        <section className="mt-10" aria-label="Trasee și categorii">
          <h2 className="font-display text-2xl font-bold">Trasee și categorii</h2>
          {offers.isLoading ? (
            <div className="mt-5 space-y-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : offers.isError ? (
            <div role="alert" className="mt-5 space-y-3 rounded-xl border p-5">
              <p>Nu am putut încărca traseele și categoriile.</p>
              <Button variant="outline" onClick={() => void offers.refetch()}>
                Reîncearcă
              </Button>
            </div>
          ) : offers.data?.routes.length ? (
            <div className="mt-5 space-y-6">
              {offers.data.routes.map((route) => (
                <article key={route.id} className="bg-card rounded-xl border p-5">
                  <h3 className="font-display text-xl font-bold">{route.name}</h3>
                  <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
                    {route.description}
                  </p>
                  <div className="mt-4">
                    <CompetitionRouteMap
                      routeLabel={route.name}
                      gpxUrl={competitionRouteGpxUrl(route.gpx_storage_path)}
                      downloadUrl={competitionRouteGpxDownloadUrl(route.gpx_storage_path)}
                    />
                  </div>
                  <section className="mt-5" aria-label={`Galeria traseului ${route.name}`}>
                    <h4 className="font-display text-lg font-semibold">Galerie foto</h4>
                    {routePhotos.isLoading ? (
                      <Skeleton className="mt-3 h-32 w-full rounded-xl" />
                    ) : routePhotos.isError ? (
                      <div role="alert" className="mt-3 space-y-2 text-sm">
                        <p>Nu am putut încărca pozele traseului.</p>
                        <Button variant="outline" onClick={() => void routePhotos.refetch()}>
                          Reîncearcă
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <PhotoGallery
                          urls={(routePhotos.data ?? [])
                            .filter((photo) => photo.route_id === route.id)
                            .map((photo) => photo.url)}
                          alt={`Galeria traseului ${route.name}`}
                        />
                        {!routePhotos.data?.some((photo) => photo.route_id === route.id) && (
                          <p className="text-muted-foreground text-sm">
                            Organizatorul nu a adăugat încă poze pentru acest traseu.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                  <div className="mt-5 space-y-2">
                    {offers.data.categories
                      .filter((category) => category.route_id === route.id)
                      .map((category) => (
                        <p
                          key={category.id}
                          className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm"
                        >
                          <span>
                            <strong>{category.name}</strong> · {category.age_from}–{category.age_to}{' '}
                            ani
                          </span>
                          <strong>{formatRonOffer(category.price_bani)}</strong>
                        </p>
                      ))}
                    {!offers.data.categories.some((category) => category.route_id === route.id) && (
                      <p className="text-muted-foreground text-sm">
                        Nicio categorie adăugată pentru acest traseu.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-5 rounded-xl border border-dashed p-6 text-sm">
              Traseele vor apărea aici după ce organizatorul le adaugă.
            </p>
          )}
        </section>

        {data.endAt && Date.parse(data.endAt) <= now && (
          <section className="mt-10" aria-label="Rezultate">
            <h2 className="font-display text-2xl font-bold">Rezultate</h2>
            {podium.isLoading ? (
              <Skeleton className="mt-5 h-32 rounded-xl" />
            ) : podium.isError ? (
              <div role="alert" className="mt-5 space-y-3 rounded-xl border p-5">
                <p>Nu am putut încărca rezultatele.</p>
                <Button variant="outline" onClick={() => void podium.refetch()}>
                  Reîncearcă
                </Button>
              </div>
            ) : podium.data?.length ? (
              <div className="mt-5 space-y-4">
                {(offers.data?.categories ?? [])
                  .filter((category) =>
                    podium.data?.some((result) => result.category_id === category.id),
                  )
                  .map((category) => (
                    <div key={category.id} className="bg-card rounded-xl border p-5">
                      <h3 className="font-display text-lg font-bold">{category.name}</h3>
                      <ol className="mt-3 space-y-2">
                        {podium.data
                          ?.filter((result) => result.category_id === category.id)
                          .sort((a, b) => a.place - b.place)
                          .map((result) => (
                            <li
                              key={result.place}
                              className="flex justify-between gap-3 rounded-xl border p-3 text-sm"
                            >
                              <span>Locul {result.place}</span>
                              <strong>{result.participant_name}</strong>
                            </li>
                          ))}
                      </ol>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-5 rounded-xl border border-dashed p-5 text-sm">
                Podiumul nu a fost publicat încă.
              </p>
            )}
          </section>
        )}

            <OrganizerCoaches
              sectionKey="competition-organizer"
              organizerTitle="Organizat de"
              organizator={data.organizator}
              antrenori={[]}
              coachesTitle={() => 'Antrenori'}
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CompetitionEnrollCard
              slug={data.slug}
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
