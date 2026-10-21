import { Link } from 'react-router-dom'
import { CalendarClock, MapPin, Pencil } from 'lucide-react'

import type { CoachActivity } from '@/api/coach'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatOfferPrice } from '@/lib/money'
import { activityDateLine } from './coach-activity-overview'

export function CoachActivityCard({
  activity: a,
  past,
  pending,
  onToggle,
}: {
  key?: string
  activity: CoachActivity
  past: boolean
  pending: boolean
  onToggle: () => void
}) {
  return (
    <Card className="gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold break-words">{a.name}</h3>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{a.location?.name ?? '—'}</span>
          </p>
        </div>
        <span className="font-display shrink-0 font-bold tabular-nums">
          {formatOfferPrice(a.price, a.currency)}
        </span>
      </div>
      <div>
        <div className="flex flex-wrap gap-1.5">
          {a.sport && <Badge>{a.sport.name}</Badge>}
          <Badge variant={a.active ? 'success' : 'outline'}>{a.active ? 'Activ' : 'Inactiv'}</Badge>
          {past && <Badge variant="outline">Încheiată</Badge>}
        </div>
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
          <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
          {activityDateLine(a)}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-touch-target min-h-touch-target">
          <Link to={`/coach/activities/${a.id}/edit`} aria-label={`Editează ${a.name}`}>
            <Pencil aria-hidden="true" /> Editează
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-touch-target min-h-touch-target"
          disabled={pending}
          aria-label={`${a.active ? 'Dezactivează' : 'Activează'} ${a.name}`}
          onClick={onToggle}
        >
          {a.active ? 'Dezactivează' : 'Activează'}
        </Button>
      </div>
    </Card>
  )
}
