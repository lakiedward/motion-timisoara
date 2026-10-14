import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'

import {
  COURSE_DAY_OPTIONS,
  COURSE_PRICE_LIMITS,
  countActiveCourseFilters,
  type CourseCatalogFilters,
} from '@/lib/course-catalog'
import { formatRon } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type Option = { value: string; label: string }

const SELECT_CLASS =
  'border-input bg-background hover:border-muted-foreground focus-visible:outline-ring h-touch-target w-full min-w-0 rounded-md border px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm'

const PRICE_OPTIONS = COURSE_PRICE_LIMITS.map((limit) => ({
  value: String(limit),
  label: `Până la ${formatRon(limit).replace(',00', '')} / lună`,
}))

function FilterSelect({
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
  options: Option[]
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
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

export function CourseFilters({
  filters,
  sportOptions,
  locationOptions,
  onChange,
}: {
  filters: CourseCatalogFilters
  sportOptions: Option[]
  locationOptions: Option[]
  onChange: (filters: CourseCatalogFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const active = countActiveCourseFilters(filters)
  const set = (key: keyof CourseCatalogFilters) => (value: string) =>
    onChange({ ...filters, [key]: value })

  return (
    <div className="mb-8">
      <Button
        type="button"
        variant="outline"
        className="w-full sm:hidden"
        aria-expanded={open}
        aria-controls="course-filters"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal aria-hidden="true" />
        {active ? `Filtre (${active})` : 'Filtre'}
      </Button>
      <div
        id="course-filters"
        className={cn(
          'mt-4 gap-4 sm:mt-0 sm:grid sm:grid-cols-2 lg:grid-cols-4',
          open ? 'grid' : 'hidden',
        )}
      >
        <FilterSelect
          id="course-sport-filter"
          label="Sport"
          value={filters.sport}
          allLabel="Toate sporturile"
          options={sportOptions}
          onChange={set('sport')}
        />
        <FilterSelect
          id="course-day-filter"
          label="Ziua"
          value={filters.day}
          allLabel="Orice zi"
          options={COURSE_DAY_OPTIONS}
          onChange={set('day')}
        />
        <FilterSelect
          id="course-price-filter"
          label="Preț"
          value={filters.maxPrice}
          allLabel="Orice preț"
          options={PRICE_OPTIONS}
          onChange={set('maxPrice')}
        />
        <FilterSelect
          id="course-location-filter"
          label="Locație"
          value={filters.location}
          allLabel="Toate locațiile"
          options={locationOptions}
          onChange={set('location')}
        />
      </div>
    </div>
  )
}
