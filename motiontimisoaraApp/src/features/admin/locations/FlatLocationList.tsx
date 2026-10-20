import type { AdminLocation } from '@/api/locations/admin-locations'
import { ClubLocationRow } from '@/features/club/locations/ClubLocationRow'
import { Highlight } from '@/features/admin/courses/CourseParts'
import { ORGANIZER_ICON } from './organizer-icon'
import { organizerOf } from './location-overview'

function OrganizerLine({ location, query }: { location: AdminLocation; query: string }) {
  const o = organizerOf(location)
  const Icon = ORGANIZER_ICON[o.kind]
  return (
    <p className="text-foreground mt-1 flex items-center gap-1.5 text-sm font-medium">
      <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      <span className="sr-only">Organizator: </span>
      <Highlight text={o.name} query={query} />
    </p>
  )
}

export function FlatLocationList({
  locations,
  query,
  pendingIds,
  onToggleLocation,
}: {
  locations: AdminLocation[]
  query: string
  pendingIds: string[]
  onToggleLocation: (l: AdminLocation) => void
}) {
  const sorted = [...locations].sort((a, b) => a.name.localeCompare(b.name, 'ro'))
  const group = (title: string, rows: AdminLocation[]) =>
    rows.length ? (
      <section aria-label={title} className="grid gap-3">
        <h2 className="text-muted-foreground text-sm font-semibold">
          {title} · {rows.length}
        </h2>
        <ul className="bg-card divide-y overflow-hidden rounded-xl border">
          {rows.map((l) => (
            <ClubLocationRow
              key={l.id}
              locatie={l}
              seComuta={pendingIds.includes(l.id)}
              onToggle={() => onToggleLocation(l)}
              editTo={`/admin/locations/${l.id}/edit`}
              organizer={<OrganizerLine location={l} query={query} />}
            />
          ))}
        </ul>
      </section>
    ) : null
  return (
    <div className="mt-3 grid gap-8">
      {group(
        'Active',
        sorted.filter((l) => l.is_active),
      )}
      {group(
        'Inactive',
        sorted.filter((l) => !l.is_active),
      )}
    </div>
  )
}
