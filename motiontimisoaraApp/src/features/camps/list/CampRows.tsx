import { Link } from 'react-router-dom'
import { Pencil, Users } from 'lucide-react'

import type { TabaraDinLista } from '@/api/camps-admin'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { campPrice, campStatus, groupByStatus } from './camp-list'
import { CampBadges, CampStats, CampWhenWhere } from './camp-facts'

function CampRow({ camp, baza }: { key?: string; camp: TabaraDinLista; baza: string }) {
  const ended = campStatus(camp) === 'ended'
  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:gap-4',
        ended && 'bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display min-w-0 font-semibold wrap-anywhere">{camp.title}</h3>
            <CampBadges camp={camp} />
          </div>
          <span className="font-display shrink-0 font-bold tabular-nums">{campPrice(camp)}</span>
        </div>
        <CampWhenWhere camp={camp} />
        <CampStats camp={camp} />
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          asChild
          variant="outline"
          className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9"
        >
          <Link to={`${baza}/${camp.id}/edit`} aria-label={`Editează ${camp.title}`}>
            <Pencil aria-hidden="true" /> Editează
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-touch-target min-h-touch-target lg:h-9 lg:min-h-9"
        >
          <Link to={`${baza}/${camp.id}/enrolled`} aria-label={`Înscriși la ${camp.title}`}>
            <Users aria-hidden="true" /> Înscriși
          </Link>
        </Button>
      </div>
    </li>
  )
}

export function CampRows({ camps, baza }: { camps: TabaraDinLista[]; baza: string }) {
  return (
    <div className="grid gap-8">
      {groupByStatus(camps).map((g) => (
        <section key={g.status} aria-label={g.title} className="grid gap-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            {g.title} · {g.items.length}
          </h2>
          <ul className="bg-card divide-y overflow-hidden rounded-xl border">
            {g.items.map((c) => (
              <CampRow key={c.id} camp={c} baza={baza} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
