import { SelectMenu } from '@/components/ui/select-menu'
import type { FilterOption } from '@/lib/event-catalog'

export function FilterMenu({
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
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
      </p>
      <SelectMenu
        id={id}
        aria-labelledby={`${id}-label ${id}`}
        value={value}
        emptyLabel={allLabel}
        options={options}
        onValueChange={onChange}
      />
    </div>
  )
}
