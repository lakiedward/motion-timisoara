import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CalendarDays, MapPin, Users } from 'lucide-react'

import { getTaberePublice, formatZi, type TabaraDinLista } from '@/api/camps'
import { formatRon } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function CampsPage() {
  const {
    data: tabere = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['tabere-publice'], queryFn: () => getTaberePublice() })

  return (
    <div>
      <section className="from-primary/8 to-background border-b bg-gradient-to-b">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Vacanțe active</span>
          {/* Eticheta de mai sus e adevărată abia de când lista arată doar
              taberele netrecute: până acum promitea „active" deasupra uneia
              încheiate cu o săptămână în urmă. */}
          <h1 className="font-display text-foreground text-4xl font-extrabold lg:text-5xl">Tabere</h1>
          <p className="text-muted-foreground mt-2">Tabere sportive pentru copii.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
          // Distinct de starea goală: „nicio tabără programată" e o afirmație
          // despre lume, nu o scuză pentru o rețea picată.
          <div className="rounded-3xl border border-dashed py-20 text-center" role="alert">
            <p className="text-foreground font-medium">Nu am putut încărca taberele.</p>
            <Button className="mt-4 h-11 min-h-11" type="button" onClick={() => void refetch()}>
              Reîncearcă
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid gap-7 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : tabere.length ? (
          <div className="grid gap-7 md:grid-cols-2">
            {tabere.map((t) => (
              <CardTabara key={t.id} tabara={t} />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-3xl border border-dashed py-20 text-center">
            Nicio tabără programată momentan.
          </div>
        )}
      </div>
    </div>
  )
}

function CardTabara({ tabara }: { tabara: TabaraDinLista }) {
  const plina = tabara.locuriRamase !== null && tabara.locuriRamase <= 0

  return (
    <Link
      to={`/tabere/${tabara.slug}`}
      className="bg-card shadow-card hover:shadow-card-hover flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1"
    >
      {tabara.heroUrl && (
        <img
          src={tabara.heroUrl}
          alt=""
          loading="lazy"
          className="h-44 w-full object-cover"
        />
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-foreground text-xl font-bold">{tabara.title}</h3>
          {plina && <Badge variant="destructive">Locuri epuizate</Badge>}
        </div>

        <div className="text-muted-foreground mt-3 space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0" />
            {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
          </div>
          {tabara.location_text && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" /> {tabara.location_text}
            </div>
          )}
          {/* Locurile rămase se vedeau abia pe pagina de detaliu, deși
              capacitatea e impusă la înscriere: părintele afla că e plină după
              ce intra degeaba. */}
          {!plina && tabara.locuriRamase !== null && (
            <div className="flex items-center gap-1.5">
              <Users className="size-4 shrink-0" />
              {plural(tabara.locuriRamase, 'loc rămas', 'locuri rămase')}
            </div>
          )}
          {tabara.allow_cash && (
            <div className="flex items-center gap-1.5">
              <Banknote className="size-4 shrink-0" /> Se poate plăti și cash
            </div>
          )}
        </div>

        {tabara.organizator && (
          <p className="text-muted-foreground mt-3 text-sm">
            Organizată de <span className="text-foreground font-medium">{tabara.organizator.nume}</span>
          </p>
        )}

        {/* `mt-auto` ține prețul pe aceeași linie la toate cardurile, oricât de
            diferite sunt textele de deasupra. */}
        <div className="font-display mt-auto pt-4 text-lg font-bold">{formatRon(tabara.price)}</div>
      </div>
    </Link>
  )
}
