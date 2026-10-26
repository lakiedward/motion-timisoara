import { CalendarDays, MapPin, Users } from 'lucide-react'

import { formatZi, type TabaraDetaliu } from '@/api/camps'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { InfoTile } from '@/features/public/components/InfoTile'

export function CampInfoBand({ data, ended }: { data: TabaraDetaliu; ended: boolean }) {
  const { tabara, location, locuriRamase } = data
  const details = tabara.location_text?.trim() || null
  const locationName = location?.name ?? details
  const locationHint =
    location && details && details !== location.name
      ? details
      : location?.address?.trim() || undefined
  const mapLink =
    location && location.lat != null && location.lng != null
      ? `/harta?location=${encodeURIComponent(location.id)}`
      : undefined

  return (
    <div
      className={cn(
        'bg-card divide-border grid divide-x rounded-xl border',
        locationName ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      <InfoTile
        icon={<CalendarDays className="size-4" />}
        label="Perioadă"
        value={`${formatZi(tabara.period_start)} – ${formatZi(tabara.period_end)}`}
        hint={ended ? 'Încheiată' : undefined}
      />
      {locationName && (
        <InfoTile
          icon={<MapPin className="size-4" />}
          label="Locație"
          value={locationName}
          hint={locationHint}
          to={mapLink}
        />
      )}
      <InfoTile
        icon={<Users className="size-4" />}
        label="Locuri"
        value={
          locuriRamase === null
            ? '—'
            : locuriRamase <= 0
              ? 'Locuri epuizate'
              : plural(locuriRamase, 'loc rămas', 'locuri rămase')
        }
        hint={tabara.capacity != null ? `din ${tabara.capacity}` : undefined}
      />
    </div>
  )
}
