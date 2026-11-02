import { useState } from 'react'

import {
  COURSE_DAY_OPTIONS,
  COURSE_PRICE_LIMITS,
  EMPTY_COURSE_FILTERS,
  countActiveCourseFilters,
  type CourseCatalogFilters,
} from '@/lib/course-catalog'
import { formatRon } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ActiveFilterChips } from '@/components/catalog-filters/ActiveFilterChips'
import type { FilterOption } from '@/lib/event-catalog'
import { FilterMenu } from '@/components/catalog-filters/FilterMenu'
import { MoreFiltersToggle } from '@/components/catalog-filters/MoreFiltersToggle'
import { SportPills } from '@/components/catalog-filters/SportPills'

const PRICE_OPTIONS = COURSE_PRICE_LIMITS.map((limit) => ({
  value: String(limit),
  label: `Până la ${formatRon(limit).replace(',00', '')} / lună`,
}))

const SHORT_DAYS: Record<string, string> = {
  '1': 'Lu',
  '2': 'Ma',
  '3': 'Mi',
  '4': 'Jo',
  '5': 'Vi',
  '6': 'Sâ',
  '7': 'Du',
}

function activeLabels(filters: CourseCatalogFilters, sportOptions: FilterOption[]) {
  const labels: { key: keyof CourseCatalogFilters; text: string }[] = []
  if (filters.sport)
    labels.push({
      key: 'sport',
      text: sportOptions.find((sport) => sport.value === filters.sport)?.label ?? filters.sport,
    })
  if (filters.day)
    labels.push({
      key: 'day',
      text: COURSE_DAY_OPTIONS.find((day) => day.value === filters.day)?.label ?? filters.day,
    })
  if (filters.maxPrice)
    labels.push({
      key: 'maxPrice',
      text: PRICE_OPTIONS.find((price) => price.value === filters.maxPrice)?.label ?? '',
    })
  if (filters.location) labels.push({ key: 'location', text: filters.location })
  return labels
}

export function CourseFilters({
  filters,
  sportOptions,
  locationOptions,
  loading,
  onChange,
}: {
  filters: CourseCatalogFilters
  sportOptions: FilterOption[]
  locationOptions: FilterOption[]
  loading: boolean
  onChange: (filters: CourseCatalogFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const set = (key: keyof CourseCatalogFilters) => (value: string) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="mb-8 space-y-5">
      <SportPills
        value={filters.sport}
        options={sportOptions}
        loading={loading}
        onChange={set('sport')}
      />

      <MoreFiltersToggle
        label="Zi, buget, locație"
        activeCount={countActiveCourseFilters({ ...filters, sport: '' })}
        open={open}
        controls="course-more-filters"
        onToggle={() => setOpen((value) => !value)}
      />

      <div
        id="course-more-filters"
        className={cn(
          'gap-4 sm:grid sm:grid-cols-2 sm:items-end lg:grid-cols-[auto_1fr_1fr]',
          open ? 'grid' : 'hidden',
        )}
      >
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <p id="course-day-label" className="text-sm font-medium">
            Ziua
          </p>
          <div role="group" aria-labelledby="course-day-label" className="flex flex-wrap gap-1.5">
            {COURSE_DAY_OPTIONS.map((day) => {
              const active = filters.day === day.value
              return (
                <Button
                  key={day.value}
                  type="button"
                  size="icon"
                  variant={active ? 'default' : 'outline'}
                  aria-pressed={active}
                  aria-label={day.label}
                  onClick={() => set('day')(active ? '' : day.value)}
                >
                  {SHORT_DAYS[day.value]}
                </Button>
              )
            })}
          </div>
        </div>
        <FilterMenu
          id="course-price-filter"
          label="Buget pe lună"
          value={filters.maxPrice}
          allLabel="Orice buget"
          options={PRICE_OPTIONS}
          onChange={set('maxPrice')}
        />
        <FilterMenu
          id="course-location-filter"
          label="Unde?"
          value={filters.location}
          allLabel="Oriunde în Timișoara"
          options={locationOptions}
          onChange={set('location')}
        />
      </div>

      <ActiveFilterChips
        labels={activeLabels(filters, sportOptions)}
        onRemove={(key) => set(key)('')}
        onClear={() => onChange(EMPTY_COURSE_FILTERS)}
      />
    </div>
  )
}
