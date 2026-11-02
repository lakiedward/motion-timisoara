export type EventCatalogFilters = {
  sport: string
  month: string
  maxPrice: string
  location: string
}

export type EventCatalogItem = {
  sportCode?: string | null
  startDate: string | null
  endDate?: string | null
  priceRonBani?: number | null
  location: string | null
}

export type FilterOption = { value: string; label: string }

export const EMPTY_EVENT_FILTERS: EventCatalogFilters = {
  sport: '',
  month: '',
  maxPrice: '',
  location: '',
}

export const ACTIVITY_PRICE_LIMITS = [5_000, 10_000, 20_000, 40_000]

const EVENT_TIME_ZONE = 'Europe/Bucharest'

export function monthKey(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7)
  const instant = new Date(value)
  if (Number.isNaN(+instant)) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return year && month ? `${year}-${month}` : null
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const label = new Date(year ?? 1970, (month ?? 1) - 1, 1).toLocaleDateString('ro-RO', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  let [year, month] = start.split('-').map(Number) as [number, number]
  const [endYear, endMonth] = end.split('-').map(Number) as [number, number]
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    if (months.length > 24) break
  }
  return months
}

export function eventMonths(item: Pick<EventCatalogItem, 'startDate' | 'endDate'>): string[] {
  const start = monthKey(item.startDate)
  if (!start) return []
  const end = monthKey(item.endDate) ?? start
  return end < start ? [start] : monthsBetween(start, end)
}

export function priceInRonBani(
  price: number,
  currency: string,
  eurRonRateMicros: number | null | undefined,
): number | null {
  if (currency === 'RON') return price
  if (currency === 'EUR' && eurRonRateMicros && eurRonRateMicros > 0)
    return Math.round((price * eurRonRateMicros) / 1_000_000)
  return null
}

export function eventMatchesFilters(item: EventCatalogItem, filters: EventCatalogFilters): boolean {
  if (filters.sport && item.sportCode !== filters.sport) return false
  if (filters.location && item.location?.trim() !== filters.location) return false
  if (filters.month && !eventMonths(item).includes(filters.month)) return false
  if (filters.maxPrice) {
    const price = item.priceRonBani ?? null
    if (price === null || price > Number(filters.maxPrice)) return false
  }
  return true
}

export function eventMonthOptions(items: EventCatalogItem[]): FilterOption[] {
  const months = new Set<string>()
  for (const item of items) for (const month of eventMonths(item)) months.add(month)
  return [...months].sort().map((value) => ({ value, label: monthLabel(value) }))
}

export function eventLocationOptions(items: EventCatalogItem[]): FilterOption[] {
  const names = new Set<string>()
  for (const item of items) {
    const name = item.location?.trim()
    if (name) names.add(name)
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b, 'ro'))
    .map((name) => ({ value: name, label: name }))
}

export function countActiveEventFilters(filters: EventCatalogFilters): number {
  return Object.values(filters).filter(Boolean).length
}

export const CAMP_PRICE_LIMITS = [50_000, 100_000, 200_000, 400_000]

export function priceLimitOptions(limits: number[], formatLimit: (bani: number) => string) {
  return limits.map((limit) => ({ value: String(limit), label: `Până la ${formatLimit(limit)}` }))
}
