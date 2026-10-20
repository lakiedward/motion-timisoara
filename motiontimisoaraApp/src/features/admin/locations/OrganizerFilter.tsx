import { Label } from '@/components/ui/label'
import { FILTER_SELECT_CLASS } from '@/features/public/courses/CourseFilters'
import type { LocationOrganizer } from './location-overview'

const GROUP_LABEL = { club: 'Cluburi', coach: 'Antrenori', shared: 'Fără organizator' }

export function OrganizerFilter({
  value,
  options,
  onChange,
}: {
  value: string
  options: (LocationOrganizer & { count: number })[]
  onChange: (key: string) => void
}) {
  const kinds = (['club', 'coach', 'shared'] as const).filter((k) =>
    options.some((o) => o.kind === k),
  )
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="admin-location-organizer" className="shrink-0">
        Organizator
      </Label>
      <select
        id="admin-location-organizer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FILTER_SELECT_CLASS}
      >
        <option value="">Toți organizatorii</option>
        {kinds.map((k) => (
          <optgroup key={k} label={GROUP_LABEL[k]}>
            {options
              .filter((o) => o.kind === k)
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name} ({o.count})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
