import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CalendarDays, Users } from 'lucide-react'

import { getTaberePublice, formatZi, type TabaraDinLista } from '@/api/camps'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CampLocation from '@/components/camps/CampLocation'

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
          <h1 className="font-display text-foreground text-4xl font-extrabold lg:text-5xl">
            Tabere
          </h1>
          <p className="text-muted-foreground mt-2">Tabere sportive pentru copii.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {isError ? (
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
    <article className="bg-card shadow-card hover:shadow-card-hover relative flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1">
      {tabara.heroUrl && (
        <img src={tabara.heroUrl} alt="" loading="lazy" className="h-44 w-full object-cover" />
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-foreground text-xl font-bold">
            <Link
              to={`/tabere/${tabara.slug}`}
              className="rounded-md after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {tabara.title}
            </Link>
          </h3>
          {plina && <Badge variant="destructive">Locuri epuizate</Badge>}
        </div>

        <div className="text-muted-foreground mt-3 space-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0" />
            {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
          </div>
          <CampLocation location={tabara.location} details={tabara.location_text} />
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
            Organizată de{' '}
            <span className="text-foreground font-medium">{tabara.organizator.nume}</span>
          </p>
        )}

        <div className="font-display mt-auto pt-4 text-lg font-bold">
          {tabara.pricingMode === 'by_age'
            ? 'Preț pe categorii de vârstă'
            : formatMoney(tabara.price, tabara.currency)}
        </div>
      </div>
    </article>
  )
}
