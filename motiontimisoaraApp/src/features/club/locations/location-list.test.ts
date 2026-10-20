import {
  NO_FILTERS,
  filterLocations,
  formatAdresa,
  grupeazaDupaStare,
  hasFilters,
  statusCounts,
} from './location-list'
import type { ClubLocation } from '@/api/club'

const loc = (name: string, is_active: boolean) => ({ id: name, name, is_active }) as ClubLocation

test('adresa fără oraș nu lasă virgulă sau liniuță', () => {
  expect(formatAdresa({ address: 'Str. Audit 1', city: null })).toBe('Str. Audit 1')
  expect(formatAdresa({ address: 'Str. Audit 1', city: 'Timișoara' })).toBe(
    'Str. Audit 1, Timișoara',
  )
  expect(formatAdresa({ address: null, city: null })).toBe('—')
})

test('grupează activele separat de inactive, alfabetic în fiecare grup', () => {
  const { active, inactive } = grupeazaDupaStare([
    loc('Zebra', true),
    loc('Ăla', false),
    loc('Alfa', true),
    loc('Beta', false),
  ])
  expect(active.map((l) => l.name)).toEqual(['Alfa', 'Zebra'])
  expect(inactive.map((l) => l.name)).toEqual(['Ăla', 'Beta'])
})

const cu = (name: string, is_active: boolean, address: string | null, city: string | null) =>
  ({ id: name, name, is_active, address, city }) as ClubLocation

const lista = [
  cu('Bazin Olimpic', true, 'Str. Ștefan cel Mare 1', 'Timișoara'),
  cu('Sală Polivalentă', false, 'Bd. Liviu Rebreanu 2', 'Timișoara'),
  cu('Teren Giroc', true, null, 'Giroc'),
]

test('căutarea ignoră diacriticele și caută și în adresă și oraș', () => {
  expect(filterLocations(lista, { ...NO_FILTERS, query: 'sala' }).map((l) => l.name)).toEqual([
    'Sală Polivalentă',
  ])
  expect(filterLocations(lista, { ...NO_FILTERS, query: 'stefan' }).map((l) => l.name)).toEqual([
    'Bazin Olimpic',
  ])
  expect(filterLocations(lista, { ...NO_FILTERS, query: 'giroc' })).toHaveLength(1)
})

test('filtrul de stare se combină cu căutarea', () => {
  expect(filterLocations(lista, { status: 'active', query: '' })).toHaveLength(2)
  expect(filterLocations(lista, { status: 'inactive', query: 'bazin' })).toHaveLength(0)
  expect(statusCounts(lista)).toEqual({ active: 2, inactive: 1, all: 3 })
})

test('o căutare goală nu contează drept filtru', () => {
  expect(hasFilters({ ...NO_FILTERS, query: '  ' })).toBe(false)
  expect(hasFilters({ ...NO_FILTERS, status: 'inactive' })).toBe(true)
})
