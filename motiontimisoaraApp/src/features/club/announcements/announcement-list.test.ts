import { expect, test } from 'vitest'
import type { ClubAnnouncement } from '@/api/club'
import { grupeazaPeStare, priorityOf } from './announcement-list'

const anunt = (id: string, created_at: string, priority = 'NORMAL') =>
  ({ id, created_at, priority }) as ClubAnnouncement

const acum = new Date('2026-10-21T10:00:00Z')

test('anunțurile se grupează pe stare, iar programatele în ordinea publicării', () => {
  const grupe = grupeazaPeStare(
    [
      { ...anunt('tarziu', '2026-10-20T09:00:00Z'), publish_at: '2026-11-05T09:00:00Z' },
      anunt('acum', '2026-10-19T09:00:00Z'),
      { ...anunt('curand', '2026-10-18T09:00:00Z'), publish_at: '2026-10-22T09:00:00Z' },
      { ...anunt('vechi', '2026-10-01T09:00:00Z'), expires_at: '2026-10-10T09:00:00Z' },
    ],
    acum,
  )
  expect(grupe.map((g) => [g.title, g.items.map((a) => a.id)])).toEqual([
    ['Programate', ['curand', 'tarziu']],
    ['Vizibile acum', ['acum']],
    ['Expirate', ['vechi']],
  ])
})

test('grupele goale nu apar', () => {
  expect(grupeazaPeStare([anunt('a', '2026-10-19T09:00:00Z')], acum).map((g) => g.title)).toEqual([
    'Vizibile acum',
  ])
})

test('o prioritate necunoscută cade pe Normală', () => {
  expect(priorityOf(anunt('a', '2026-10-19T09:00:00Z', 'ALTCEVA')).label).toBe('Normală')
})
