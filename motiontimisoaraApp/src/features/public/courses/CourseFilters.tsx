import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SPORT_GLYPH, SPORT_GLYPH_FALLBACK } from '@/components/sport/sport-icons'

type Option = { value: string; label: string }

const SELECT_CLASS =
  'border-input bg-background hover:border-muted-foreground focus-visible:outline-ring h-touch-target w-full min-w-0 rounded-md border px-3 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 md:text-sm'

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

function activeLabels(filters: CourseCatalogFilters, sportOptions: Option[]) {
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
  sportOptions: Option[]
  locationOptions: Option[]
  loading: boolean
  onChange: (filters: CourseCatalogFilters) => void
}) {
  const [open, setOpen] = useState(false)
  const moreActive = countActiveCourseFilters({ ...filters, sport: '' })
  const set = (key: keyof CourseCatalogFilters) => (value: string) =>
    onChange({ ...filters, [key]: value })
  const labels = activeLabels(filters, sportOptions)

  return (
    <div className="mb-8 space-y-5">
      <div
        role="group"
        aria-label="Sport"
        className="flex flex-wrap gap-2"
      >
        <Button
          type="button"
          className="shrink-0 rounded-full"
          variant={filters.sport ? 'outline' : 'default'}
          aria-pressed={!filters.sport}
          onClick={() => set('sport')('')}
        >
          Toate
        </Button>
        {loading
          ? [0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-touch-target w-28 shrink-0 rounded-full" />
            ))
          : sportOptions.map((sport) => {
              const Glyph = SPORT_GLYPH[sport.value] ?? SPORT_GLYPH_FALLBACK
              const active = filters.sport === sport.value
              return (
                <Button
                  key={sport.value}
                  type="button"
                  className="shrink-0 rounded-full"
                  variant={active ? 'default' : 'outline'}
                  aria-pressed={active}
                  onClick={() => set('sport')(active ? '' : sport.value)}
                >
                  <Glyph aria-hidden="true" />
                  {sport.label}
                </Button>
              )
            })}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full sm:hidden"
        aria-expanded={open}
        aria-controls="course-more-filters"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal aria-hidden="true" />
        {moreActive ? `Zi, buget, locație (${moreActive})` : 'Zi, buget, locație'}
      </Button>

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
        <FilterSelect
          id="course-price-filter"
          label="Buget pe lună"
          value={filters.maxPrice}
          allLabel="Orice buget"
          options={PRICE_OPTIONS}
          onChange={set('maxPrice')}
        />
        <FilterSelect
          id="course-location-filter"
          label="Unde?"
          value={filters.location}
          allLabel="Oriunde în Timișoara"
          options={locationOptions}
          onChange={set('location')}
        />
      </div>

      {labels.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Filtre active:</span>
          {labels.map((label) => (
            <Button
              key={label.key}
              type="button"
              variant="secondary"
              className="rounded-full"
              aria-label={`Scoate filtrul ${label.text}`}
              onClick={() => set(label.key)('')}
            >
              {label.text}
              <X aria-hidden="true" />
            </Button>
          ))}
          <Button type="button" variant="link" onClick={() => onChange(EMPTY_COURSE_FILTERS)}>
            Șterge tot
          </Button>
        </div>
      ) : null}
    </div>
  )
}
