import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, type LucideIcon } from 'lucide-react'

import { ACTIVITY_RULES_FILE_BUCKET, rulesFileAfisabil } from '@/api/camp-rules-file'
import { activitateSAincheiat, getActivitateDetaliu, type PersoanaActivitate } from '@/api/public'
import CampRulesDisplay from '@/components/camps/CampRulesDisplay'
import { OfferExchangeNote } from '@/components/OfferExchangeNote'
import PhotoGallery from '@/components/PhotoGallery'
import ActivityPlaceMap from '@/features/public/map/ActivityPlaceMap'
import { useAuth } from '@/lib/auth-context'
import { formatOfferPrice } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function ziActivitate(data: string): string {
  const [an, luna, zi] = data.split('-').map(Number)
  return new Date(an, (luna ?? 1) - 1, zi ?? 1).toLocaleDateString('ro-RO')
}

function Fapt({
  icon: Icon,
  eticheta,
  children,
}: {
  icon: LucideIcon
  eticheta: string
  children: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="text-foreground font-medium">{eticheta}</span>
      <span>{children}</span>
    </div>
  )
}

function Portret({ persoana }: { persoana: PersoanaActivitate }) {
  if (persoana.pozaUrl) {
    return <img src={persoana.pozaUrl} alt="" className="size-12 rounded-full object-cover" />
  }
  return (
    <div className="bg-muted flex size-12 items-center justify-center rounded-full text-sm font-semibold">
      {persoana.nume.slice(0, 1)}
    </div>
  )
}

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
        <p className="text-foreground font-medium">Nu am putut încărca activitatea.</p>
        <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
          Reîncearcă
        </Button>
      </div>
    )
  }
  if (!a) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-muted-foreground">Activitatea nu a fost găsită.</p>
        <Link to="/activitati" className="text-primary mt-4 inline-block font-semibold">
          ← Înapoi la activități
        </Link>
      </div>
    )
  }

  const incheiata = activitateSAincheiat(a.activityDate, a.endTime)
  const plina = a.locuriRamase !== null && a.locuriRamase <= 0
  const onEnroll = () => {
    if (!user) navigate(`/login?returnUrl=${encodeURIComponent(`/activitati/${a.id}`)}`)
    else navigate(`/account/checkout?kind=ACTIVITY&id=${a.id}`)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        to="/activitati"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Înapoi la activități
      </Link>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {a.sportName && <Badge>{a.sportName}</Badge>}
      </div>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-foreground md:text-4xl">
        {a.name}
      </h1>

      {a.organizator && (
        <div className="mt-6">
          <h2 className="font-display mb-3 text-lg font-bold">Organizată de</h2>
          <div className="flex items-center gap-3">
            <Portret persoana={a.organizator} />
            <Link
              to={a.organizator.link}
              className="text-primary inline-flex h-11 items-center font-semibold"
            >
              {a.organizator.nume}
            </Link>
          </div>
        </div>
      )}

      {a.antrenori.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display mb-3 text-lg font-bold">
            {a.antrenori.length === 1 ? 'Antrenor' : 'Antrenori'}
          </h2>
          <ul className="flex flex-wrap gap-4">
            {a.antrenori.map((antrenor) => (
              <li key={antrenor.id} className="flex items-center gap-3">
                <Portret persoana={antrenor} />
                <Link
                  to={antrenor.link}
                  className="text-primary inline-flex h-11 items-center font-semibold"
                >
                  {antrenor.nume}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-muted-foreground mt-5 flex flex-col gap-2 text-sm">
        <Fapt icon={CalendarDays} eticheta="Data">
          {ziActivitate(a.activityDate)}
        </Fapt>
        <Fapt icon={Clock} eticheta="Ore">
          {`${a.startTime.slice(0, 5)}–${a.endTime.slice(0, 5)}`}
        </Fapt>
        {a.location && (
          <Fapt icon={MapPin} eticheta="Loc">
            {a.location.name}
          </Fapt>
        )}
        {!incheiata && a.locuriRamase !== null && a.locuriRamase > 0 && (
          <Fapt icon={Users} eticheta="Locuri">
            {plural(a.locuriRamase, 'loc rămas', 'locuri rămase')}
          </Fapt>
        )}
      </div>

      {a.description && (
        <p className="text-muted-foreground mt-6 leading-relaxed">{a.description}</p>
      )}

      {a.galerieUrls.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display mb-3 text-lg font-bold">Din activitate</h2>
          <PhotoGallery urls={a.galerieUrls} alt={a.name} />
        </div>
      )}

      <CampRulesDisplay
        rules={null}
        fisier={rulesFileAfisabil(ACTIVITY_RULES_FILE_BUCKET, a.regulament)}
      />

      {a.location?.lat != null && a.location.lng != null && (
        <ActivityPlaceMap lat={a.location.lat} lng={a.location.lng} name={a.location.name} />
      )}

      <div className="bg-card shadow-card mt-8 flex flex-col items-start gap-4 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-display whitespace-nowrap text-2xl font-extrabold">
            {formatOfferPrice(a.price, a.currency)}
          </div>
          <OfferExchangeNote offer={a} className="text-xs" />
        </div>
        {incheiata ? (
          <p className="text-muted-foreground text-sm font-medium">
            Activitatea s-a încheiat, înscrierile sunt închise.
          </p>
        ) : plina ? (
          <p className="text-muted-foreground text-sm font-medium">Toate locurile sunt ocupate.</p>
        ) : (
          <button
            type="button"
            onClick={onEnroll}
            className="btn-cta btn-cta--primary shrink-0 whitespace-nowrap"
          >
            Înscrie-te
          </button>
        )}
      </div>
    </div>
  )
}
