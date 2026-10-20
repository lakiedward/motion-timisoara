import { formatAdresa, grupeazaDupaStare } from './location-list'
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
