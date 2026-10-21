import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getTaberePublice } from '@/api/camps'
import { getActivitatiPublice, getCoachCourses } from '@/api/public'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusView } from '@/components/ui/status-view'
import { CardActivitate } from '../components/ActivityListCard'
import { CardTabara } from '../components/CampListCard'
import {
  filterClubOffer,
  OFFER_KINDS,
  OFFER_LABELS,
  offerTotal,
  SEARCH_THRESHOLD,
  type ClubOffer as Offer,
  type OfferKind,
} from '../club-detail/club-offer'
import { CourseCatalogCard } from '../courses/CourseCatalogCard'
import { CourseCatalogCardSkeleton } from '../courses/CourseCatalogCardSkeleton'

const SECTION_KEY = 'motion-react:page:/antrenori/:id:section:cursuri-predate'
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

function KindGroup({ offer, kind }: { offer: Offer; kind: OfferKind }) {
  return (
    <section aria-labelledby={`coach-offer-${kind}`}>
      <h3
        id={`coach-offer-${kind}`}
        className="font-display mb-3 flex items-baseline gap-2 text-lg font-bold"
      >
        {OFFER_LABELS[kind]}
        <span className="text-muted-foreground font-sans text-sm font-normal tabular-nums">
          {offer[kind].length}
        </span>
      </h3>
      <ul className={kind === 'camps' ? CAMP_GRID : GRID}>
        <OfferCards offer={offer} kind={kind} />
      </ul>
    </section>
  )
}

function GroupedOffer({ offer }: { offer: Offer }) {
  const [search, setSearch] = useState('')
  const shown = filterClubOffer(offer, search)
  const visibleKinds = OFFER_KINDS.filter((kind) => shown[kind].length > 0)
  return (
    <>
      {offerTotal(offer) > SEARCH_THRESHOLD && (
        <div className="mb-6 max-w-sm space-y-2">
          <Label htmlFor="coach-offer-search">Caută la acest antrenor</Label>
          <Input
            id="coach-offer-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      )}
      {visibleKinds.length ? (
        <div className="space-y-8">
          {visibleKinds.map((kind) => (
            <KindGroup key={kind} offer={shown} kind={kind} />
          ))}
        </div>
      ) : (
        <StatusView
          state="empty"
          title="Nimic nu se potrivește căutării."
          text="Încearcă alt nume sau alt sport."
        />
      )}
    </>
  )
}

export function CoachOffer({
  coachId,
  coachProfileId,
}: {
  coachId: string
  coachProfileId: string
}) {
  const courses = useQuery({
    queryKey: ['coach-courses', coachId],
    queryFn: () => getCoachCourses(coachId),
  })
  const camps = useQuery({
    queryKey: ['coach-camps', coachId, coachProfileId],
    queryFn: () =>
      getTaberePublice(new Date(), undefined, { userId: coachId, profileId: coachProfileId }),
  })
  const activities = useQuery({
    queryKey: ['coach-activities', coachId],
    queryFn: () => getActivitatiPublice(new Date(), undefined, coachId),
  })
  const queries = [courses, camps, activities]
  const loading = queries.some((q) => q.isPending || (q.isError && q.isFetching))
  const failed = courses.isError || camps.isError || activities.isError

  const offer: Offer = {
    courses: courses.data ?? [],
    camps: camps.data ?? [],
    activities: activities.data ?? [],
  }

  let body
  if (loading) {
    body = (
      <ul role="status" aria-label="Se încarcă oferta antrenorului" className={GRID}>
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
        title="Nu am putut încărca oferta antrenorului."
        text="Verifică conexiunea și încearcă din nou."
        onRetry={() => queries.forEach((q) => q.isError && void q.refetch())}
      />
    )
  } else if (!offerTotal(offer)) {
    body = (
      <StatusView
        state="empty"
        title="Momentan nu are cursuri, tabere sau activități publicate."
        text="Ofertele noi apar aici când antrenorul le publică."
        action={
          <Button asChild variant="outline" className="mt-3">
            <Link to="/cursuri">Vezi toate cursurile</Link>
          </Button>
        }
      />
    )
  } else {
    body = <GroupedOffer offer={offer} />
  }

  return (
    <section data-section={SECTION_KEY} aria-labelledby="coach-offer-title" className="mt-10">
      <h2 id="coach-offer-title" className="font-display mb-4 text-xl font-bold">
        Cursuri, tabere și activități
      </h2>
      {body}
    </section>
  )
}
