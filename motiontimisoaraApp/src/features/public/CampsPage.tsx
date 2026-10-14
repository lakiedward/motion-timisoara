import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Building2, CalendarDays, Check, UserRound, Users } from 'lucide-react'

import { getTaberePublice, formatZi, type TabaraDinLista } from '@/api/camps'
import { formatMoney } from '@/lib/money'
import { plural } from '@/lib/plural'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusView } from '@/components/ui/status-view'
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
      <section
        aria-labelledby="camps-page-title"
        data-section="motion-react:page:/tabere:section:toata-pagina"
        className="from-primary/8 to-transparent border-b bg-gradient-to-b"
      >
        <div className="mx-auto max-w-7xl px-6 py-14">
          <span className="eyebrow mb-3">Vacanțe active</span>
          <h1
            id="camps-page-title"
            className="font-display text-foreground text-4xl font-extrabold lg:text-5xl"
          >
            Tabere
          </h1>
          <p className="text-muted-foreground mt-2">Tabere sportive pentru copii.</p>
        </div>
      </section>

      <div
        data-section="motion-react:page:/tabere:section:lista-tabere"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        {isError ? (
          <StatusView
            state="error"
            title="Nu am putut încărca taberele."
            text="Verifică conexiunea și încearcă din nou."
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <div role="status" aria-label="Se încarcă taberele" className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : tabere.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tabere.map((t) => (
              <li key={t.id}>
                <CardTabara tabara={t} />
              </li>
            ))}
          </ul>
        ) : (
          <StatusView
            state="empty"
            title="Nicio tabără programată momentan."
            text="Taberele noi apar aici când un club sau un antrenor le anunță."
          />
        )}
      </div>
    </div>
  )
}

function CardTabara({ tabara }: { tabara: TabaraDinLista }) {
  const plina = tabara.locuriRamase !== null && tabara.locuriRamase <= 0
  const OrganizatorIcon = tabara.organizator?.fel === 'antrenor' ? UserRound : Building2

  return (
    <article className="bg-card text-card-foreground hover:border-foreground/20 hover:shadow-card relative flex h-full flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none">
      {tabara.heroUrl && (
        <img src={tabara.heroUrl} alt="" loading="lazy" className="h-44 w-full object-cover" />
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">
            <Link
              to={`/tabere/${tabara.slug}`}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {tabara.title}
            </Link>
          </h2>
          {plina ? (
            <Badge variant="destructive">Locuri epuizate</Badge>
          ) : (
            <Badge variant="success">
              <Check aria-hidden="true" />
              Înscrieri deschise
            </Badge>
          )}
        </div>

        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          {formatZi(tabara.period_start)} – {formatZi(tabara.period_end)}
        </p>

        <p className="mt-3 text-base font-bold">
          {tabara.pricingMode === 'by_age'
            ? 'Preț pe categorii de vârstă'
            : formatMoney(tabara.price, tabara.currency)}
        </p>

        <ul className="text-muted-foreground mt-3 space-y-1 text-sm">
          {(tabara.location || tabara.location_text) && (
            <li>
              <CampLocation location={tabara.location} details={tabara.location_text} />
            </li>
          )}
          {!plina && tabara.locuriRamase !== null && (
            <li className="flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-4 shrink-0" />
              {plural(tabara.locuriRamase, 'loc rămas', 'locuri rămase')}
            </li>
          )}
          {tabara.allow_cash && (
            <li className="flex items-center gap-1.5">
              <Banknote aria-hidden="true" className="size-4 shrink-0" />
              Se poate plăti și cash
            </li>
          )}
          {tabara.organizator && (
            <li className="flex items-center gap-1.5">
              <OrganizatorIcon aria-hidden="true" className="size-4 shrink-0" />
              <span>
                Organizată de{' '}
                <span className="text-foreground font-medium">{tabara.organizator.nume}</span>
              </span>
            </li>
          )}
        </ul>
      </div>
    </article>
  )
}
