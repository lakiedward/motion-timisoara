import { useState } from 'react'

import {
  EMPTY_EVENT_FILTERS,
  countActiveEventFilters,
  type EventCatalogFilters,
  type FilterOption,
} from '@/lib/event-catalog'
import { cn } from '@/lib/utils'
import { ActiveFilterChips, type ActiveFilterLabel } from './ActiveFilterChips'
import { FilterMenu } from './FilterMenu'
import { MoreFiltersToggle } from './MoreFiltersToggle'
import { SportPills } from './SportPills'

type Key = keyof EventCatalogFilters

function optionLabel(options: FilterOption[] | undefined, value: string) {
  return options?.find((option) => option.value === value)?.label ?? value
}

export function EventFilters({
  idPrefix,
  filters,
  sportOptions,
  monthOptions,
  priceOptions,
  locationOptions,
  loading,
  onChange,
}: {
  idPrefix: string
  filters: EventCatalogFilters
  sportOptions?: FilterOption[]
  monthOptions: FilterOption[]
  priceOptions?: FilterOption[]
  locationOptions: FilterOption[]
  loading: boolean
  onChange: (filters: EventCatalogFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const set = (key: Key) => (value: string) => onChange({ ...filters, [key]: value })
  const moreId = `${idPrefix}-more-filters`
  const labels: ActiveFilterLabel<Key>[] = []
  if (filters.sport) labels.push({ key: 'sport', text: optionLabel(sportOptions, filters.sport) })
  if (filters.month) labels.push({ key: 'month', text: optionLabel(monthOptions, filters.month) })
  if (filters.maxPrice)
    labels.push({ key: 'maxPrice', text: optionLabel(priceOptions, filters.maxPrice) })
  if (filters.location) labels.push({ key: 'location', text: filters.location })
  const toggleLabel = priceOptions ? 'Lună, buget, locație' : 'Lună, locație'

  return (
    <div className="mb-8 space-y-5">
      {sportOptions ? (
        <SportPills
          value={filters.sport}
          options={sportOptions}
          loading={loading}
          onChange={set('sport')}
        />
      ) : null}

      <MoreFiltersToggle
        label={toggleLabel}
        activeCount={countActiveEventFilters({ ...filters, sport: '' })}
        open={open}
        controls={moreId}
        onToggle={() => setOpen((value) => !value)}
      />

      <div
        id={moreId}
        className={cn(
          'gap-4 sm:grid sm:items-end',
          priceOptions ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
          open ? 'grid' : 'hidden',
        )}
      >
        <FilterMenu
          id={`${idPrefix}-month-filter`}
          label="Când?"
          value={filters.month}
          allLabel="Oricând"
          options={monthOptions}
          onChange={set('month')}
        />
        {priceOptions ? (
          <FilterMenu
            id={`${idPrefix}-price-filter`}
            label="Buget"
            value={filters.maxPrice}
            allLabel="Orice buget"
            options={priceOptions}
            onChange={set('maxPrice')}
          />
        ) : null}
        <FilterMenu
          id={`${idPrefix}-location-filter`}
          label="Unde?"
          value={filters.location}
          allLabel="Oriunde"
          options={locationOptions}
          onChange={set('location')}
        />
      </div>

      <ActiveFilterChips
        labels={labels}
        onRemove={(key) => set(key)('')}
        onClear={() => onChange(EMPTY_EVENT_FILTERS)}
      />
    </div>
  )
}
