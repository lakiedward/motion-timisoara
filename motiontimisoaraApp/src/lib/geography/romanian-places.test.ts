import { expect, test } from 'vitest'
import {
  citiesForCounty,
  cityForCounty,
  countyForCity,
  normalizeCounty,
  romanianCounties,
} from './romanian-places'

test('catalogue includes all county units and localities within their own county', () => {
  expect(romanianCounties).toHaveLength(42)
  expect(citiesForCounty('Timiș')).toContain('Timișoara')
  expect(citiesForCounty('Timiș')).toContain('Dumbrăvița')
  expect(citiesForCounty('Arad')).toContain('Arad')
  expect(citiesForCounty('Arad')).not.toContain('Timișoara')
  expect(citiesForCounty('București')).toEqual(['București'])
})

test('county inference accepts provider spelling and avoids ambiguous localities', () => {
  expect(normalizeCounty('Judeţul Timiş')).toBe('Timiș')
  expect(cityForCounty('Timisoara', 'Timiș')).toBe('Timișoara')
  expect(countyForCity('Timișoara')).toBe('Timiș')
  expect(countyForCity('Arad')).toBe('Arad')
  expect(countyForCity('Dumbrăvița')).toBeNull()
})

test('an unmatched existing locality remains selectable without duplication', () => {
  expect(citiesForCounty('Timiș', 'Loc vechi')[0]).toBe('Loc vechi')
  expect(citiesForCounty('Timiș', 'Timișoara').filter((city) => city === 'Timișoara')).toHaveLength(
    1,
  )
})
