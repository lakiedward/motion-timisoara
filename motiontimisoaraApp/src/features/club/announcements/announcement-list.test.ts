import { expect, test } from 'vitest'
import type { ClubAnnouncement } from '@/api/club'
import { grupeazaPeLuni, priorityOf } from './announcement-list'

const anunt = (id: string, created_at: string, priority = 'NORMAL') =>
  ({ id, created_at, priority }) as ClubAnnouncement

test('anunțurile se grupează pe luni în ordinea primită, cu luna scrisă cu majusculă', () => {
  const grupe = grupeazaPeLuni([
    anunt('a', '2026-10-19T09:00:00Z'),
    anunt('b', '2026-10-02T09:00:00Z'),
    anunt('c', '2026-09-28T09:00:00Z'),
  ])
  expect(grupe.map((g) => [g.title, g.items.map((a) => a.id)])).toEqual([
    ['Octombrie 2026', ['a', 'b']],
    ['Septembrie 2026', ['c']],
  ])
})

test('luna se socotește în ora României, nu în UTC', () => {
  const [grupa] = grupeazaPeLuni([anunt('a', '2026-09-30T22:30:00Z')])
  expect(grupa.title).toBe('Octombrie 2026')
})

test('o prioritate necunoscută cade pe Normală', () => {
  expect(priorityOf(anunt('a', '2026-10-19T09:00:00Z', 'ALTCEVA')).label).toBe('Normală')
})
