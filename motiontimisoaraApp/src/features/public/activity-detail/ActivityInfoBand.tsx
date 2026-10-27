import { CalendarDays, Clock, MapPin } from 'lucide-react'

import type { ActivitateDetaliu } from '@/api/public'
import { cn } from '@/lib/utils'
import { InfoTile } from '@/features/public/components/InfoTile'
import { activityDay, activityHours, activityMapLink } from './activity-facts'

export function ActivityInfoBand({ activity }: { activity: ActivitateDetaliu }) {
  const { location } = activity

  return (
    <div
      className={cn(
        'bg-card divide-border grid divide-x rounded-xl border',
        location ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      <InfoTile
        icon={<CalendarDays className="size-4" />}
        label="Data"
        value={activityDay(activity.activityDate)}
      />
      <InfoTile icon={<Clock className="size-4" />} label="Ore" value={activityHours(activity)} />
      {location && (
        <InfoTile
          icon={<MapPin className="size-4" />}
          label="Loc"
          value={location.name}
          hint={location.address?.trim() || undefined}
          to={activityMapLink(location)}
        />
      )}
    </div>
  )
}
