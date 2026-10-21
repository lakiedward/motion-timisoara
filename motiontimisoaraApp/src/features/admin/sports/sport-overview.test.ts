import { expect, test } from 'vitest'

import type { Sport } from '@/api/sports'
import { filterSports, groupSports, hasSportFilters, photoCounts } from './sport-overview'

const sports: Sport[] = [
  { id: 'a', name: 'Alergare', code: 'alergare', default_photo_storage_path: 'a/x.jpg' },
  { id: 'b', name: 'Înot', code: 'inot', default_photo_storage_path: null },
  { id: 'c', name: 'Șah', code: 'sah', default_photo_storage_path: null },
]

test('search folds diacritics and matches name or code', () => {
  expect(filterSports(sports, { photo: 'all', query: 'ÎNO' }).map((s) => s.id)).toEqual(['b'])
  expect(filterSports(sports, { photo: 'all', query: 'sah' }).map((s) => s.id)).toEqual(['c'])
})

test('photo filter and counts split sports by default photo', () => {
  expect(photoCounts(sports)).toEqual({ all: 3, with: 1, without: 2 })
  expect(filterSports(sports, { photo: 'with', query: '' }).map((s) => s.id)).toEqual(['a'])
  expect(filterSports(sports, { photo: 'without', query: '' }).map((s) => s.id)).toEqual(['b', 'c'])
})

test('groups put sports without photo first and skip empty groups', () => {
  expect(groupSports(sports).map((g) => [g.key, g.sports.length])).toEqual([
    ['without', 2],
    ['with', 1],
  ])
  expect(groupSports(sports.slice(0, 1)).map((g) => g.key)).toEqual(['with'])
})

test('filters are active only with a photo filter or non-blank query', () => {
  expect(hasSportFilters({ photo: 'all', query: '  ' })).toBe(false)
  expect(hasSportFilters({ photo: 'with', query: '' })).toBe(true)
})
