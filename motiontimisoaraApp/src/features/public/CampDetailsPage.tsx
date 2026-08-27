import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, MapPin, Wallet } from 'lucide-react'

import { formatZi, getTabaraDetaliu, sAIncheiat, sumaCategoriilor } from '@/api/camps'
import { formatRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { useAuth } from '@/lib/auth-context'
import PhotoGallery from '@/components/PhotoGallery'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'


export default function CampDetailsPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
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

  // „Nu am putut încărca” și „nu există” erau același ecran, deci o rețea picată
  // arăta ca o adresă greșită. Sunt două situații cu ieșiri diferite: una cere
  // reîncercare, cealaltă întoarcerea la listă.
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

  const { tabara, organizator, categorii, antrenori, heroUrl, galerieUrls, locuriRamase } = data
  const incheiata = sAIncheiat(tabara.period_end)
  const plina = locuriRamase !== null && locuriRamase <= 0
  const sePoateInscrie = !incheiata && !plina
  const suma = sumaCategoriilor(categorii)

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
        // Fără poză, un fond în locul ei: mai bine o bandă colorată decât un titlu
        // suspendat pe alb, care arată ca o pagină neterminată.
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
          {tabara.location_text && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {tabara.location_text}
            </span>
          )}
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

        {/* Cine organizează și cine merge sunt lucruri diferite: unul răspunde de
            tabără, ceilalți pleacă cu copiii. Părintele are nevoie de amândouă. */}
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
              {/* Un părinte vrea să știe dacă în spate stă un club sau un antrenor
                  pe cont propriu — sunt două feluri de răspundere. */}
              <Badge variant="outline">
                {organizator.fel === 'club' ? 'Club' : 'Antrenor'}
              </Badge>
            </div>
          </div>
        )}

        {antrenori.length > 0 && (
          <div className="mt-8">
            {/* Părintele își trimite copilul o săptămână — trebuie să știe cu cine. */}
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

        <div className="bg-card shadow-card mt-8 rounded-3xl border p-6">
          {categorii.length > 0 && (
            <>
              <h2 className="font-display mb-1 text-lg font-bold">Ce include prețul</h2>
              <p className="text-muted-foreground mb-4 text-sm">
                Plătești o singură dată {formatRon(tabara.price)}. Mai jos scrie pe ce se duc banii.
              </p>
              <ul className="divide-border divide-y">
                {categorii.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      {c.description && (
                        <p className="text-muted-foreground mt-0.5 text-sm">{c.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 font-semibold">{formatRon(c.amount)}</div>
                  </li>
                ))}
              </ul>
              {/* Totalul afișat e mereu `camps.price`, adică suma care chiar se
                  plătește. Dacă desfășurarea nu se potrivește cu el, o spunem în
                  loc s-o ascundem — altfel pagina ar minți despre bani. */}
              {suma !== Number(tabara.price) && (
                <p className="text-muted-foreground mt-3 text-xs">
                  Desfășurarea de mai sus însumează {formatRon(suma)}; suma de plată rămâne{' '}
                  {formatRon(tabara.price)}.
                </p>
              )}
            </>
          )}

          <div
            className={`flex flex-wrap items-center justify-between gap-4 ${categorii.length > 0 ? 'border-border mt-4 border-t pt-4' : ''}`}
          >
            <div>
              <div className="font-display text-2xl font-extrabold">
                {formatRon(tabara.price)}
              </div>
              {!tabara.allow_cash && sePoateInscrie && (
                // Refuzul venea abia din create-enrollment, după ce părintele
                // alesese cash la checkout și completase tot.
                <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                  <Wallet className="size-3.5" /> Doar plată cu cardul.
                </p>
              )}
            </div>

            {sePoateInscrie ? (
              <Button className="h-11 min-h-11 px-6" onClick={onEnroll}>
                Înscrie-te
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm font-medium">
                {incheiata
                  ? 'Tabăra s-a încheiat, înscrierile sunt închise.'
                  : 'Toate locurile sunt ocupate.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
