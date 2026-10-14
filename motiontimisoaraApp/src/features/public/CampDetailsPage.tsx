import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import { formatZi, getTabaraDetaliu, sAIncheiat } from '@/api/camps'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import PhotoGallery from '@/components/PhotoGallery'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CampPricingCard from './camp-pricing/CampPricingCard'
import CampLocation from '@/components/camps/CampLocation'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import { PublicHeroBand } from './PublicHeroBand'
import { CampOrganizerCoaches } from './camp-detail/CampOrganizerCoaches'

export default function CampDetailsPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['camp-detail', slug],
    queryFn: () => getTabaraDetaliu(slug),
    retry: false,
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

  const { tabara, necesar, organizator, antrenori, heroUrl, galerieUrls, locuriRamase } = data
  const incheiata = sAIncheiat(tabara.period_end)
  const plina = locuriRamase !== null && locuriRamase <= 0

  const onEnroll = () => {
    if (!user) {
      navigate(`/login?returnUrl=${encodeURIComponent(`/tabere/${tabara.slug}`)}`)
      return
    }
    navigate(`/account/checkout?kind=CAMP&slug=${tabara.slug}`)
  }

  return (
    <div>
      <PublicHeroBand
        url={heroUrl}
        title={tabara.title}
        backTo="/tabere"
        backLabel="Înapoi la tabere"
        width="max-w-4xl"
      />

      <div className="mx-auto max-w-4xl px-6 py-8">
        {!heroUrl && (
          <Link
            to="/tabere"
            className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" /> Înapoi la tabere
          </Link>
        )}

        {!heroUrl && (
          <h1 className="font-display text-foreground mt-4 text-3xl font-extrabold md:text-4xl">
            {tabara.title}
          </h1>
        )}

        <div
          className={cn(
            'text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm',
            !heroUrl && 'mt-4',
          )}
        >
          <span className="flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4" />
            {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
            {incheiata && (
              <Badge variant="secondary" className="ml-1">
                Încheiată
              </Badge>
            )}
          </span>
          {!incheiata && plina && <Badge variant="destructive">Locuri epuizate</Badge>}
          <CampLocation location={data.location} details={tabara.location_text} />
          {!incheiata && locuriRamase !== null && locuriRamase > 0 && (
            <span>{plural(locuriRamase, 'loc rămas', 'locuri rămase')}</span>
          )}
        </div>

        {tabara.description && (
          <p className="text-muted-foreground mt-6 leading-relaxed">{tabara.description}</p>
        )}

        <CampRulesDisplay rules={tabara.rules} fisier={data.regulamentFisier} />

        {necesar.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display mb-3 text-lg font-bold">Necesar pentru tabără</h2>
            <div className="space-y-5">
              {necesar.map((categorie) => (
                <section key={categorie.name}>
                  <h3 className="font-medium">{categorie.name}</h3>
                  <ul className="text-muted-foreground mt-2 list-disc space-y-2 pl-5">
                    {categorie.items.map((articol) => (
                      <li key={articol.name}>
                        {articol.name} — {articol.quantity}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}

        {galerieUrls.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display mb-3 text-lg font-bold">Din tabără</h2>
            <PhotoGallery urls={galerieUrls} alt={tabara.title} />
          </div>
        )}

        <CampOrganizerCoaches organizator={organizator} antrenori={antrenori} />

        <CampPricingCard data={data} ended={incheiata} full={plina} onEnroll={onEnroll} />
      </div>
    </div>
  )
}
