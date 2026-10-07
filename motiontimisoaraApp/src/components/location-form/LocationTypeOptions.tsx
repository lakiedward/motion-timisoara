import { locationTypeGroups } from '@/lib/geography/location-types'

export default function LocationTypeOptions() {
  return locationTypeGroups.map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </optgroup>
  ))
}
