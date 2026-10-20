import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleOff, Pencil, Power } from 'lucide-react'
import type { ClubLocation } from '@/api/club'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { locationTypeLabel } from '@/lib/geography/location-types'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { formatAdresa } from './location-list'

type Props = {
  locatie: ClubLocation
  seComuta: boolean
  onToggle: () => void
  editTo?: string
  organizer?: ReactNode
}

export function ClubLocationRow({ locatie: l, seComuta, onToggle, editTo, organizer }: Props) {
  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5',
        !l.is_active && 'bg-muted/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-display min-w-0 text-base font-bold wrap-anywhere">{l.name}</h3>
          <Badge variant="secondary">{locationTypeLabel(l.type)}</Badge>
          {l.is_active ? (
            <Badge variant="success">Activă</Badge>
          ) : (
            <Badge variant="outline">
              <CircleOff aria-hidden="true" /> Inactivă
            </Badge>
          )}
        </div>
        {organizer}
        <p className="text-muted-foreground mt-1 text-sm wrap-anywhere">
          <span>{formatAdresa(l)}</span>
          <span aria-hidden="true"> · </span>
          <span>
            {l.courseCount ? `${plural(l.courseCount, 'curs', 'cursuri')} aici` : 'niciun curs'}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild variant="outline" className="h-11 lg:h-9">
          <Link to={editTo ?? `/club/locations/${l.id}/edit`} aria-label={`Editează ${l.name}`}>
            <Pencil aria-hidden="true" /> Editează
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 lg:h-9"
          disabled={seComuta}
          aria-label={`${l.is_active ? 'Dezactivează' : 'Activează'} ${l.name}`}
          onClick={onToggle}
        >
          <Power aria-hidden="true" />
          {l.is_active ? 'Dezactivează' : 'Activează'}
        </Button>
      </div>
    </li>
  )
}
