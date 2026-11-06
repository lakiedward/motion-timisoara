import { Link } from 'react-router-dom'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import {
  competitionRouteGpxDownloadUrl,
  competitionRouteGpxUrl,
  type CompetitionOffers,
} from '@/api/competition/competition-offers'
import { listCompetitionRoutePhotos } from '@/api/competition/competition-route-photos'
import PhotoGallery from '@/components/photo-gallery/PhotoGallery'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRonOffer } from '@/lib/money'
import { CompetitionRouteMap } from '../CompetitionRouteMap'

export const COMPETITION_ROUTES_SECTION =
  'manual:section:trasee-si-categorii:270d30f3-04e5-4dcc-866c-7eabb7eb7c3d'

export function CompetitionRoutesSection({
  competitionId,
  offers,
  enrollSlug,
}: {
  competitionId: string
  offers: UseQueryResult<CompetitionOffers>
  enrollSlug: string | null
}) {
  const routePhotos = useQuery({
    queryKey: ['competition-route-photos', competitionId],
    queryFn: () => listCompetitionRoutePhotos(competitionId),
  })

  return (
    <section
      data-section={COMPETITION_ROUTES_SECTION}
      aria-labelledby="competition-routes-title"
      className="mt-8"
    >
      <h2 id="competition-routes-title" className="font-display mb-3 text-xl font-bold">
        Trasee și categorii
      </h2>
      {offers.isLoading ? (
        <div role="status" aria-label="Se încarcă traseele" className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : offers.isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5">
          <p>Nu am putut încărca traseele și categoriile.</p>
          <Button variant="outline" onClick={() => void offers.refetch()}>
            Reîncearcă
          </Button>
        </div>
      ) : offers.data?.routes.length ? (
        <div className="space-y-6">
          {offers.data.routes.map((route) => {
            const categories = offers.data.categories.filter(
              (category) => category.route_id === route.id,
            )
            const photos = (routePhotos.data ?? []).filter((photo) => photo.route_id === route.id)
            return (
              <article key={route.id} className="bg-card rounded-xl border p-5">
                <h3 className="font-display text-xl font-bold">{route.name}</h3>
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">
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
                        urls={photos.map((photo) => photo.url)}
                        alt={`Galeria traseului ${route.name}`}
                      />
                      {!photos.length && (
                        <p className="text-muted-foreground text-sm">
                          Organizatorul nu a adăugat încă poze pentru acest traseu.
                        </p>
                      )}
                    </div>
                  )}
                </section>
                <ul className="mt-5 space-y-2">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 rounded-xl border p-3 text-sm"
                    >
                      <span className="min-w-0 break-words">
                        <strong>{category.name}</strong> · {category.age_from}–{category.age_to} ani
                      </span>
                      <span className="flex flex-wrap items-center gap-3">
                        <strong>{formatRonOffer(category.price_bani)}</strong>
                        {enrollSlug && (
                          <Link
                            to={`/account/competitions/${enrollSlug}/register?categorie=${category.id}`}
                            aria-label={`Înscrie-te la categoria ${category.name}`}
                            className="btn-cta btn-cta--outline px-5 text-sm"
                          >
                            Înscrie-te
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {!categories.length && (
                  <p className="text-muted-foreground mt-5 text-sm">
                    Nicio categorie adăugată pentru acest traseu.
                  </p>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
          Traseele vor apărea aici după ce organizatorul le adaugă.
        </p>
      )}
    </section>
  )
}
