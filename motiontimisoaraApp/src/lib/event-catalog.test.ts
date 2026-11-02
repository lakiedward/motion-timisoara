import { describe, expect, it } from 'vitest'

import {
  EMPTY_EVENT_FILTERS,
  eventLocationOptions,
  eventMatchesFilters,
  eventMonthOptions,
  eventMonths,
  monthKey,
  priceInRonBani,
} from './event-catalog'

const camp = {
  startDate: '2026-12-28',
  endDate: '2027-01-03',
  location: ' Bazin Olimpia ',
  priceRonBani: 75_000,
}

describe('event catalog filters', () => {
  it('reads month keys from civil dates and instants in Bucharest time', () => {
    expect(monthKey('2026-11-30')).toBe('2026-11')
    expect(monthKey('2026-11-30T22:30:00Z')).toBe('2026-12')
    expect(monthKey(null)).toBeNull()
    expect(monthKey('nu e dată')).toBeNull()
  })

  it('lists every month a multi-day event spans, across the year boundary', () => {
    expect(eventMonths(camp)).toEqual(['2026-12', '2027-01'])
    expect(eventMonths({ startDate: '2026-11-05' })).toEqual(['2026-11'])
    expect(eventMonths({ startDate: null })).toEqual([])
  })

  it('matches month, location, sport and budget together', () => {
    expect(eventMatchesFilters(camp, EMPTY_EVENT_FILTERS)).toBe(true)
    expect(eventMatchesFilters(camp, { ...EMPTY_EVENT_FILTERS, month: '2027-01' })).toBe(true)
    expect(eventMatchesFilters(camp, { ...EMPTY_EVENT_FILTERS, month: '2027-02' })).toBe(false)
    expect(eventMatchesFilters(camp, { ...EMPTY_EVENT_FILTERS, location: 'Bazin Olimpia' })).toBe(
      true,
    )
    expect(eventMatchesFilters(camp, { ...EMPTY_EVENT_FILTERS, sport: 'inot' })).toBe(false)
    expect(eventMatchesFilters(camp, { ...EMPTY_EVENT_FILTERS, maxPrice: '50000' })).toBe(false)
    expect(eventMatchesFilters(camp, { ...EMPTY_EVENT_FILTERS, maxPrice: '100000' })).toBe(true)
  })

  it('excludes items without a known price only when a budget is chosen', () => {
    const unknown = { ...camp, priceRonBani: null }
    expect(eventMatchesFilters(unknown, EMPTY_EVENT_FILTERS)).toBe(true)
    expect(eventMatchesFilters(unknown, { ...EMPTY_EVENT_FILTERS, maxPrice: '100000' })).toBe(false)
  })

  it('converts EUR prices with the stored rate', () => {
    expect(priceInRonBani(10_000, 'RON', null)).toBe(10_000)
    expect(priceInRonBani(10_000, 'EUR', 5_000_000)).toBe(50_000)
    expect(priceInRonBani(10_000, 'EUR', null)).toBeNull()
  })

  it('builds sorted, de-duplicated month and location options', () => {
    const items = [camp, { startDate: '2026-11-10', location: 'Arena' }, { startDate: null, location: '' }]
    expect(eventMonthOptions(items).map((option) => option.value)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ])
    expect(eventMonthOptions(items)[0]?.label).toMatch(/^Noiembrie 2026$/)
    expect(eventLocationOptions(items)).toEqual([
      { value: 'Arena', label: 'Arena' },
      { value: 'Bazin Olimpia', label: 'Bazin Olimpia' },
    ])
  })
})
