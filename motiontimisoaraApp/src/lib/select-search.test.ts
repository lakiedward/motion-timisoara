import { describe, expect, it } from 'vitest'

import { filterBySearch, matchesSearch } from './select-search'

describe('select search', () => {
  it('ignores Romanian diacritics and case', () => {
    expect(matchesSearch('Timiș', 'timis')).toBe(true)
    expect(matchesSearch('Bistrița-Năsăud', 'BISTRITA-nas')).toBe(true)
    expect(matchesSearch('Ștei', 'stei')).toBe(true)
  })

  it('keeps every item for an empty or blank query', () => {
    const items = [{ label: 'Arad' }, { label: 'Alba' }]
    expect(filterBySearch(items, '')).toBe(items)
    expect(filterBySearch(items, '   ')).toBe(items)
  })

  it('keeps only matching items in their original order', () => {
    const items = [{ label: 'Timișoara' }, { label: 'Arad' }, { label: 'Dumbrăvița' }]
    expect(filterBySearch(items, 'ta').map((item) => item.label)).toEqual(['Dumbrăvița'])
    expect(filterBySearch(items, 'ar').map((item) => item.label)).toEqual(['Timișoara', 'Arad'])
  })
})
