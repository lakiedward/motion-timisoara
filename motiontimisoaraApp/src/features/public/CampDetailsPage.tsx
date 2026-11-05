import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { getTabaraDetaliu, sAIncheiat } from '@/api/camps'
import { descriptionParagraphs } from '@/lib/course-detail'
import { useAuth } from '@/lib/auth-context'
import { PhotoMosaic } from '@/components/photo-gallery/PhotoMosaic'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CampPricingCard from './camp-pricing/CampPricingCard'
import ActivityPlaceMap from '@/features/public/map/ActivityPlaceMap'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import CampRequirementsDisplay from '@/components/camps/CampRequirementsDisplay'
import { PublicHeroBand } from './PublicHeroBand'
import { CampInfoBand } from './camp-detail/CampInfoBand'
import { OrganizerCoaches } from './components/OrganizerCoaches'
import { DetailBackLink } from '@/features/public/components/DetailBackLink'
import { useDocumentTitle } from '@/lib/page-title'

export default function CampDetailsPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['camp-detail', slug],
    queryFn: () => getTabaraDetaliu(slug),
    retry: false,
  })
  useDocumentTitle(data?.tabara.title, 'Tabere')

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center" role="alert">
        <p className="text-foreground font-medium">Nu am putut încărca tabăra.</p>
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Tabăra nu a fost găsită.</p>
        <Link
          to="/tabere"
          className="text-primary mt-4 inline-flex h-11 items-center font-semibold"
        >
          ← Înapoi la tabere
        </Link>
      </div>
    )
  }

  const { tabara, necesar, organizator, antrenori, heroUrl, galerie, locuriRamase } = data
  const incheiata = sAIncheiat(tabara.period_end)
  const plina = locuriRamase !== null && locuriRamase <= 0

  const onEnroll = () => {
    if (!user) {
      navigate(`/login?returnUrl=${encodeURIComponent(`/tabere/${tabara.slug}`)}`)
      return
    }
    navigate(`/account/checkout?kind=CAMP&slug=${tabara.slug}`)
  }

  const pricing = <CampPricingCard data={data} ended={incheiata} full={plina} onEnroll={onEnroll} />

  return (
    <div>
      <PublicHeroBand
        url={heroUrl}
        title={tabara.title}
        backTo="/tabere"
        backLabel="Înapoi la tabere"
      />

      {!heroUrl && (
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <DetailBackLink to="/tabere" label="Înapoi la tabere" />
          <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            {tabara.title}
          </h1>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            <CampInfoBand data={data} ended={incheiata} />

            {tabara.description && (
              <section className="bg-card mt-8 rounded-xl border p-5 sm:p-6">
                <h2 className="font-display text-xl font-bold">Despre tabără</h2>
                <div className="text-muted-foreground mt-3 space-y-3 leading-relaxed">
                  {descriptionParagraphs(tabara.description).map((part, index) => (
                    <p key={index}>{part}</p>
                  ))}
                </div>
              </section>
            )}

            <CampRulesDisplay rules={tabara.rules} fisier={data.regulamentFisier} />

            <CampRequirementsDisplay necesar={necesar} />

            <PhotoMosaic
              photos={galerie}
              alt={tabara.title}
              title="O zi la tabără"
              subtitle="Cum arată o zi în tabără, de dimineață până seara."
              sectionKey="camp-gallery"
            />

            {data.location?.lat != null && data.location.lng != null && (
              <ActivityPlaceMap
                lat={data.location.lat}
                lng={data.location.lng}
                name={data.location.name}
                address={data.location.address}
              />
            )}

            <OrganizerCoaches
              sectionKey="motion-react:page:/tabere/:slug:section:organizator-si-antrenori"
              organizator={organizator}
              antrenori={antrenori}
              coachesTitle={(n) =>
                n === 1 ? 'Antrenorul care însoțește' : 'Antrenorii care însoțesc'
              }
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">{pricing}</aside>
        </div>
      </div>
    </div>
  )
}
