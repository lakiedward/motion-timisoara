import { CalendarDays, Clock, MapPin, ReceiptText, UserRound, Users } from 'lucide-react'

import type { TabaraDinLista } from '@/api/camps-admin'
import { formatZi } from '@/api/camps'
import { Badge } from '@/components/ui/badge'
import { plural } from '@/lib/plural'
import { campStatus } from './camp-list'

export function CampBadges({ camp }: { camp: TabaraDinLista }) {
  const status = campStatus(camp)
  const full = camp.capacity !== null && camp.locuriOcupate >= camp.capacity
  return (
    <>
      {status === 'ongoing' && <Badge variant="success">În desfășurare</Badge>}
      {status === 'ended' && <Badge variant="outline">Încheiată</Badge>}
      {status !== 'ended' && full && <Badge variant="destructive">Locuri epuizate</Badge>}
    </>
  )
}

export function CampWhenWhere({ camp }: { camp: TabaraDinLista }) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1">
        <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
        {formatZi(camp.period_start)} – {formatZi(camp.period_end)}
      </span>
      {camp.location_text && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{camp.location_text}</span>
        </span>
      )}
    </p>
  )
}

export function CampStats({ camp }: { camp: TabaraDinLista }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <li className="inline-flex items-center gap-1">
        <Users aria-hidden="true" className="size-4" />
        {camp.capacity === null
          ? plural(camp.locuriOcupate, 'înscris', 'înscriși')
          : `${camp.locuriOcupate} din ${plural(camp.capacity, 'loc', 'locuri')}`}
      </li>
      <li className="inline-flex items-center gap-1">
        <ReceiptText aria-hidden="true" className="size-4" />
        {camp.categorii === 0 ? 'Fără categorii' : plural(camp.categorii, 'categorie', 'categorii')}
      </li>
      <li className="inline-flex items-center gap-1">
        <UserRound aria-hidden="true" className="size-4" />
        {plural(camp.antrenoriAcceptati, 'antrenor', 'antrenori')}
      </li>
      {camp.antrenoriInAsteptare > 0 && (
        <li className="text-highlight-ink inline-flex items-center gap-1">
          <Clock aria-hidden="true" className="size-4" />
          {plural(camp.antrenoriInAsteptare, 'invitație în așteptare', 'invitații în așteptare')}
        </li>
      )}
    </ul>
  )
}
