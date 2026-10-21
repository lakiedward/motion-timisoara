import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getTaberePublice } from '@/api/camps'
import { getActivitatiPublice, getClubCourses } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import { CardActivitate } from '../components/ActivityListCard'
import { CardTabara } from '../components/CampListCard'
import { CourseCatalogCard } from '../courses/CourseCatalogCard'
import { CourseCatalogCardSkeleton } from '../courses/CourseCatalogCardSkeleton'
import {
  filterClubOffer,
  OFFER_KINDS,
  OFFER_LABELS,
  offerTotal,
  SEARCH_THRESHOLD,
  type ClubOffer as Offer,
  type OfferKind,
} from './club-offer'

const SECTION_KEY = 'motion-react:page:/cluburi/:id:section:ce-ofera-clubul'
const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
const CAMP_GRID = 'grid gap-4 sm:grid-cols-2'

function OfferCards({ offer, kind }: { offer: Offer; kind: OfferKind }) {
  if (kind === 'courses')
    return offer.courses.map((course) => (
      <li key={`course-${course.id}`} className="min-w-0">
        <CourseCatalogCard course={course} />
      </li>
    ))
  if (kind === 'camps')
    return offer.camps.map((camp) => (
      <li key={`camp-${camp.id}`} className="min-w-0">
        <CardTabara tabara={camp} />
      </li>
    ))
  return offer.activities.map((activity) => (
    <li key={`activity-${activity.id}`} className="min-w-0">
      <CardActivitate activitate={activity} />
    </li>
  ))
}

export function ClubOffer({ clubId }: { clubId: string }) {
  const [search, setSearch] = useState('')
  const courses = useQuery({
    queryKey: ['club-courses', clubId],
    queryFn: () => getClubCourses(clubId),
  })
  const camps = useQuery({
    queryKey: ['club-camps', clubId],
    queryFn: () => getTaberePublice(new Date(), clubId),
  })
  const activities = useQuery({
    queryKey: ['club-activities', clubId],
    queryFn: () => getActivitatiPublice(new Date(), clubId),
  })
  const queries = [courses, camps, activities]
  const loading = queries.some((q) => q.isPending || (q.isError && q.isFetching))
  const failed = courses.isError || camps.isError || activities.isError

  const offer: Offer = {
    courses: courses.data ?? [],
    camps: camps.data ?? [],
    activities: activities.data ?? [],
  }
  const total = offerTotal(offer)
  const shown = filterClubOffer(offer, search)
  const visibleKinds = OFFER_KINDS.filter((kind) => shown[kind].length > 0)

  let body
  if (loading) {
    body = (
      <ul role="status" aria-label="Se încarcă oferta clubului" className={GRID}>
        {[0, 1, 2].map((i) => (
          <li key={i} className="min-w-0">
            <CourseCatalogCardSkeleton />
          </li>
        ))}
      </ul>
    )
  } else if (failed) {
    body = (
      <StatusView
        state="error"
        title="Nu am putut încărca oferta clubului."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => queries.forEach((q) => q.isError && void q.refetch())}
      />
    )
  } else if (!total) {
    body = (
      <StatusView
        state="empty"
        title="Clubul nu are momentan cursuri, tabere sau activități publicate."
        text="Ofertele noi apar aici când clubul le publică."
        action={
          <Button asChild variant="outline" className="mt-3">
            <Link to="/cursuri">Vezi toate cursurile</Link>
          </Button>
        }
      />
    )
  } else {
    body = (
      <>
        {total > SEARCH_THRESHOLD && (
          <div className="mb-6 max-w-sm space-y-2">
            <Label htmlFor="club-offer-search">Caută în oferta clubului</Label>
            <Input
              id="club-offer-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        )}
        {!visibleKinds.length ? (
          <StatusView
            state="empty"
            title="Nimic nu se potrivește căutării."
            text="Încearcă alt nume sau alt sport."
          />
        ) : (
          <div className="space-y-8">
            {visibleKinds.map((kind) => (
              <section key={kind} aria-labelledby={`club-offer-${kind}`}>
                <h3
                  id={`club-offer-${kind}`}
                  className="font-display mb-3 flex items-baseline gap-2 text-lg font-bold"
                >
                  {OFFER_LABELS[kind]}
                  <span className="text-muted-foreground font-sans text-sm font-normal tabular-nums">
                    {shown[kind].length}
                  </span>
                </h3>
                <ul className={kind === 'camps' ? CAMP_GRID : GRID}>
                  <OfferCards offer={shown} kind={kind} />
                </ul>
              </section>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <section data-section={SECTION_KEY} aria-labelledby="club-offer-title" className="pb-16">
      <h2 id="club-offer-title" className="font-display mb-4 text-xl font-bold">
        Ce oferă clubul
      </h2>
      {body}
    </section>
  )
}
