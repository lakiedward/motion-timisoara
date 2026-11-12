import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { ACTIVITY_RULES_FILE_BUCKET, rulesFileAfisabil } from '@/api/camp-rules-file'
import { activitateSAincheiat, getActivitateDetaliu } from '@/api/public'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import { PhotoMosaic } from '@/components/photo-gallery/PhotoMosaic'
import ActivityPlaceMap from '@/features/public/map/ActivityPlaceMap'
import { useAuth } from '@/lib/auth-context'
import { descriptionParagraphs } from '@/lib/course-detail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SportIllustration } from '@/components/sport/SportIllustration'
import { OrganizerCoaches } from './components/OrganizerCoaches'
import { PublicHeroBand } from './PublicHeroBand'
import { ActivityEnrollCard } from './activity-detail/ActivityEnrollCard'
import { ActivityInfoBand } from './activity-detail/ActivityInfoBand'
import { DetailBackLink } from '@/features/public/components/DetailBackLink'
import { useDocumentTitle } from '@/lib/page-title'
import { DetailNotFound } from '@/features/public/components/DetailNotFound'

export default function ActivityDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    data: a,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['activitate-detaliu', id],
    queryFn: () => getActivitateDetaliu(id),
    retry: false,
  })
  useDocumentTitle(a?.name, 'Activități')

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
        <p className="text-foreground font-medium">Nu am putut încărca activitatea.</p>
        <Button className="mt-4 h-touch-target min-h-touch-target" type="button" onClick={() => void refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }
  if (!a) {
    return (
      <DetailNotFound
        title="Activitatea nu a fost găsită."
        text="Linkul poate fi greșit sau activitatea nu mai este disponibilă. Poți alege altă activitate din listă."
        backTo="/activitati"
        backLabel="Înapoi la activități"
      />
    )
  }

  const incheiata = activitateSAincheiat(a.activityDate, a.endTime)
  const plina = a.locuriRamase !== null && a.locuriRamase <= 0
  const onEnroll = () => {
    if (!user) navigate(`/login?returnUrl=${encodeURIComponent(`/activitati/${a.id}`)}`)
    else navigate(`/account/checkout?kind=ACTIVITY&id=${a.id}`)
  }

  return (
    <div>
      <PublicHeroBand
        url={a.bandUrl}
        title={a.name}
        backTo="/activitati"
        backLabel="Înapoi la activități"
        badges={
          a.sport && (
            <Badge className="px-3 py-1 text-sm font-semibold md:text-base">{a.sport.name}</Badge>
          )
        }
      />

      {!a.bandUrl && (
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <DetailBackLink to="/activitati" label="Înapoi la activități" />
          <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            {a.name}
          </h1>
          {!a.photoUrl && (
            <SportIllustration
              code={a.sport?.code}
              name={a.sport?.name}
              className="mt-6 h-44 rounded-xl border md:h-56"
            />
          )}
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <ActivityInfoBand activity={a} />

            {a.description && (
              <section className="bg-card mt-8 rounded-xl border p-5 sm:p-6">
                <h2 className="font-display text-xl font-bold">Despre activitate</h2>
                <div className="text-muted-foreground mt-3 space-y-3 leading-relaxed">
                  {descriptionParagraphs(a.description).map((part, index) => (
                    <p key={index}>{part}</p>
                  ))}
                </div>
              </section>
            )}

            <PhotoMosaic
              photos={a.galerie}
              alt={a.name}
              title="Din activitate"
              subtitle="Momente de la activitate, în poze."
              sectionKey="activity-gallery"
            />

            <CampRulesDisplay
              rules={null}
              fisier={rulesFileAfisabil(ACTIVITY_RULES_FILE_BUCKET, a.regulament)}
            />

            {a.location?.lat != null && a.location.lng != null && (
              <ActivityPlaceMap
                lat={a.location.lat}
                lng={a.location.lng}
                name={a.location.name}
                address={a.location.address}
              />
            )}

            <OrganizerCoaches
              sectionKey="manual:section:organizator-si-antrenori:71654660-6441-4081-9c30-6fbbc6d679f4"
              organizator={a.organizator}
              antrenori={a.antrenori}
              coachesTitle={() => 'Antrenor'}
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <ActivityEnrollCard
              offer={a}
              spotsLeft={a.locuriRamase}
              ended={incheiata}
              full={plina}
              parentAccount={!user || user.role === 'PARENT'}
              onEnroll={onEnroll}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
