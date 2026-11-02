import { Label } from '@/components/ui/label'

import type { FilterOption } from '@/lib/event-catalog'

export type { FilterOption }

export const FILTER_SELECT_CLASS =
  'border-input bg-background hover:border-muted-foreground focus-visible:outline-ring h-touch-target w-full min-w-0 rounded-md border px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm'

export function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  allLabel: string
  options: FilterOption[]
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FILTER_SELECT_CLASS}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
