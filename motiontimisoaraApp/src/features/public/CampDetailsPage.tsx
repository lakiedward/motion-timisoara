import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import { formatZi, getTabaraDetaliu, sAIncheiat } from '@/api/camps'
import { plural } from '@/lib/plural'
import { useAuth } from '@/lib/auth-context'
import PhotoGallery from '@/components/PhotoGallery'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CampPricingCard from './camp-pricing/CampPricingCard'
import CampLocation from '@/components/camps/CampLocation'

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

  const { tabara, organizator, antrenori, heroUrl, galerieUrls, locuriRamase } = data
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
      {heroUrl ? (
        <div className="relative h-64 w-full overflow-hidden md:h-96">
          <img src={heroUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      ) : (
        <div className="from-primary/20 to-background h-32 w-full bg-gradient-to-b md:h-44" />
      )}

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/tabere"
          className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Înapoi la tabere
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-extrabold text-foreground md:text-4xl">
            {tabara.title}
          </h1>
          {incheiata && <Badge variant="secondary">Încheiată</Badge>}
          {!incheiata && plina && <Badge variant="destructive">Locuri epuizate</Badge>}
        </div>

        <div className="text-muted-foreground mt-4 flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
          </span>
          <CampLocation location={data.location} details={tabara.location_text} />
          {!incheiata && locuriRamase !== null && locuriRamase > 0 && (
            <span>{plural(locuriRamase, 'loc rămas', 'locuri rămase')}</span>
          )}
        </div>

        {tabara.description && (
          <p className="text-muted-foreground mt-6 leading-relaxed">{tabara.description}</p>
        )}

        {galerieUrls.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display mb-3 text-lg font-bold">Din tabără</h2>
            <PhotoGallery urls={galerieUrls} alt={tabara.title} />
          </div>
        )}

        {organizator && (
          <div className="mt-8">
            <h2 className="font-display mb-2 text-lg font-bold">Organizată de</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={organizator.link}
                className="text-primary inline-flex h-11 items-center font-semibold"
              >
                {organizator.nume}
              </Link>
              <Badge variant="outline">{organizator.fel === 'club' ? 'Club' : 'Antrenor'}</Badge>
            </div>
          </div>
        )}

        {antrenori.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display mb-3 text-lg font-bold">
              {antrenori.length === 1 ? 'Antrenorul care însoțește' : 'Antrenorii care însoțesc'}
            </h2>
            <ul className="flex flex-wrap gap-4">
              {antrenori.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  {a.pozaUrl ? (
                    <img src={a.pozaUrl} alt="" className="size-12 rounded-full object-cover" />
                  ) : (
                    <div className="bg-muted flex size-12 items-center justify-center rounded-full text-sm font-semibold">
                      {a.nume.slice(0, 1)}
                    </div>
                  )}
                  <span className="font-medium">{a.nume}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <CampPricingCard data={data} ended={incheiata} full={plina} onEnroll={onEnroll} />
      </div>
    </div>
  )
}
