import { CalendarDays, Clock, MapPin } from 'lucide-react'

import type { ActivitateDetaliu } from '@/api/public'
import { InfoBand, InfoTile } from '@/features/public/components/InfoTile'
import { activityDay, activityHours, activityMapLink } from './activity-facts'

export function ActivityInfoBand({ activity }: { activity: ActivitateDetaliu }) {
  const { location } = activity

  return (
    <InfoBand>
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
    </InfoBand>
  )
}
