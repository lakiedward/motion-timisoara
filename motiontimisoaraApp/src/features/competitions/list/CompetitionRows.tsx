import { Link } from 'react-router-dom'
import { CalendarDays, ExternalLink, MapPin, Medal, Pencil, Route, Tags, Users } from 'lucide-react'

import type { CompetitionListItem } from '@/api/competition/competition-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import {
  competitionPrice,
  competitionStatus,
  competitionWhen,
  groupByStatus,
  registrationsClosed,
} from './competition-list'

const ACTION = 'h-touch-target min-h-touch-target lg:h-9 lg:min-h-9'

function CompetitionBadges({ item }: { item: CompetitionListItem }) {
  const status = competitionStatus(item)
  return (
    <>
      {status === 'ongoing' && <Badge variant="success">În desfășurare</Badge>}
      {status === 'ended' && <Badge variant="outline">Încheiat</Badge>}
      {status === 'upcoming' && registrationsClosed(item) && (
        <Badge variant="outline">Înscrieri închise</Badge>
      )}
    </>
  )
}

function CompetitionStats({ item }: { item: CompetitionListItem }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <li className="inline-flex items-center gap-1">
        <Users aria-hidden="true" className="size-4" />
        {plural(item.registeredCount, 'înscris', 'înscriși')}
      </li>
      <li className="inline-flex items-center gap-1">
        <Route aria-hidden="true" className="size-4" />
        {item.routesCount === 0 ? 'Fără trasee' : plural(item.routesCount, 'traseu', 'trasee')}
      </li>
      <li
        className={cn(
          'inline-flex items-center gap-1',
          item.prices.length === 0 && 'text-highlight-ink',
        )}
      >
        <Tags aria-hidden="true" className="size-4" />
        {item.prices.length === 0
          ? 'Fără categorii'
          : plural(item.prices.length, 'categorie', 'categorii')}
      </li>
    </ul>
  )
}

export function CompetitionRow({
  item,
  baza,
}: {
  key?: string
  item: CompetitionListItem
  baza: string
}) {
  const price = competitionPrice(item)
  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:gap-4',
        competitionStatus(item) === 'ended' && 'bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display min-w-0 font-semibold wrap-anywhere">{item.title}</h3>
            <CompetitionBadges item={item} />
          </div>
          {price && <span className="font-display shrink-0 font-bold tabular-nums">{price}</span>}
        </div>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
            {competitionWhen(item)}
          </span>
          {item.location_text && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{item.location_text}</span>
            </span>
          )}
        </p>
        <CompetitionStats item={item} />
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="outline" className={ACTION}>
          <Link to={`${baza}/${item.id}/edit`} aria-label={`Editează ${item.title}`}>
            <Pencil aria-hidden="true" /> Editează
          </Link>
        </Button>
        <Button asChild variant="outline" className={ACTION}>
          <Link to={`${baza}/${item.id}/results`} aria-label={`Podiumul pentru ${item.title}`}>
            <Medal aria-hidden="true" /> Podium
          </Link>
        </Button>
        <Button asChild variant="outline" className={ACTION}>
          <Link to={`/concursuri/${item.slug}`} aria-label={`Pagina concursului ${item.title}`}>
            <ExternalLink aria-hidden="true" /> Pagina publică
          </Link>
        </Button>
      </div>
    </li>
  )
}

export function CompetitionRows({ items, baza }: { items: CompetitionListItem[]; baza: string }) {
  return (
    <div className="grid gap-8">
      {groupByStatus(items).map((g) => (
        <section key={g.status} aria-label={g.title} className="grid gap-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            {g.title} · {g.items.length}
          </h2>
          <ul className="bg-card divide-y overflow-hidden rounded-xl border">
            {g.items.map((c) => (
              <CompetitionRow key={c.id} item={c} baza={baza} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
