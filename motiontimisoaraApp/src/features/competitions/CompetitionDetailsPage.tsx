import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'

import { getConcursPublic } from '@/api/competition/competitions'
import {
  listCompetitionOffers,
  competitionRouteGpxDownloadUrl,
  competitionRouteGpxUrl,
} from '@/api/competition/competition-offers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompetitionDateTime } from '@/lib/competition-schedule'
import { formatRonOffer } from '@/lib/money'
import { CompetitionRouteMap } from './CompetitionRouteMap'
import { getPublishedCompetitionPodium } from '@/api/competition/competition-podium'
import { getPublicCompetitionCoaches } from '@/api/competition/competition-coaches'
import { listCompetitionRoutePhotos } from '@/api/competition/competition-route-photos'
import { useCompetitionClock } from './useCompetitionClock'
import PhotoGallery from '@/components/PhotoGallery'

export default function CompetitionDetailsPage() {
  const { slug = '' } = useParams()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['concurs-public', slug],
    queryFn: () => getConcursPublic(slug),
    retry: false,
  })
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
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-3xl" />
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

  return (
    <div>
      {data.heroUrl ? (
        <div className="relative h-64 w-full overflow-hidden md:h-96">
          <img src={data.heroUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      ) : (
        <div className="from-primary/20 to-background h-32 w-full bg-gradient-to-b md:h-44" />
      )}

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/concursuri"
          className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi la concursuri
        </Link>
        <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold md:text-4xl">
          {data.title}
        </h1>
        {data.organizator && (
          <p className="text-muted-foreground mt-4 text-sm">
            Organizat de{' '}
            <Link
              to={data.organizator.link}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              {data.organizator.nume}
            </Link>
          </p>
        )}
        <p className="text-muted-foreground mt-6 leading-relaxed whitespace-pre-wrap">
          {data.description}
        </p>

        {data.startAt && data.endAt && data.registrationDeadlineAt && (
          <section
            className="bg-card shadow-card mt-8 rounded-3xl p-5"
            aria-label="Program și locație"
          >
            <h2 className="font-display text-xl font-bold">Program și locație</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Început</dt>
                <dd className="font-medium">{formatCompetitionDateTime(data.startAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Final</dt>
                <dd className="font-medium">{formatCompetitionDateTime(data.endAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ultima înscriere</dt>
                <dd className="font-medium">
                  {formatCompetitionDateTime(data.registrationDeadlineAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Locație</dt>
                <dd className="font-medium">{data.locationText ?? 'În curs de stabilire'}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="mt-8" aria-label="Antrenorii concursului">
          <h2 className="font-display text-xl font-bold">Antrenorii concursului</h2>
          {coaches.isLoading ? (
            <Skeleton className="mt-4 h-20 rounded-2xl" />
          ) : coaches.isError ? (
            <div role="alert" className="mt-4 space-y-2 rounded-2xl border p-4">
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
                  className="bg-card shadow-card flex items-center gap-3 rounded-2xl p-3"
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
              <Skeleton className="h-48 rounded-3xl" />
              <Skeleton className="h-32 rounded-3xl" />
            </div>
          ) : offers.isError ? (
            <div role="alert" className="mt-5 space-y-3 rounded-3xl border p-5">
              <p>Nu am putut încărca traseele și categoriile.</p>
              <Button variant="outline" onClick={() => void offers.refetch()}>
                Reîncearcă
              </Button>
            </div>
          ) : offers.data?.routes.length ? (
            <div className="mt-5 space-y-6">
              {offers.data.routes.map((route) => (
                <article key={route.id} className="bg-card shadow-card rounded-3xl p-5">
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
            <p className="text-muted-foreground mt-5 rounded-3xl border border-dashed p-6 text-sm">
              Traseele vor apărea aici după ce organizatorul le adaugă.
            </p>
          )}
        </section>

        {data.endAt && Date.parse(data.endAt) <= now && (
          <section className="mt-10" aria-label="Rezultate">
            <h2 className="font-display text-2xl font-bold">Rezultate</h2>
            {podium.isLoading ? (
              <Skeleton className="mt-5 h-32 rounded-3xl" />
            ) : podium.isError ? (
              <div role="alert" className="mt-5 space-y-3 rounded-3xl border p-5">
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
                    <div key={category.id} className="bg-card shadow-card rounded-3xl p-5">
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
              <p className="text-muted-foreground mt-5 rounded-3xl border border-dashed p-5 text-sm">
                Podiumul nu a fost publicat încă.
              </p>
            )}
          </section>
        )}

        {data.registrationDeadlineAt && offers.data?.categories.length ? (
          Date.parse(data.registrationDeadlineAt) > now ? (
            <Button asChild className="mt-8 h-11 min-h-11">
              <Link to={`/account/competitions/${data.slug}/register`}>Înscriere la concurs</Link>
            </Button>
          ) : (
            <p className="text-muted-foreground mt-8 text-sm">
              Înscrierile la acest concurs s-au încheiat.
            </p>
          )
        ) : null}
      </div>
    </div>
  )
}
