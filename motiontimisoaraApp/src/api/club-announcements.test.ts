import { beforeEach, expect, test, vi } from 'vitest'

import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  getClubAnnouncements,
  setAnnouncementActive,
} from './club'

/** Ce întoarce fiecare tabel la următoarea interogare. */
let raspuns: Record<string, { data: unknown; error: unknown }> = {}
/** Filtrele cerute serverului, ca să putem verifica ce s-a delegat bazei. */
let filtre: string[] = []

function builder(table: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[table] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        filtre.push(`${prop}(${args.map(String).join(',')})`)
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => builder(table),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'autor-1' } } } }) },
  },
}))

const anunt = (id: string, title: string) => ({
  id,
  title,
  content: 'Conținut',
  priority: 'NORMAL',
  is_active: true,
  created_at: '2026-08-26T09:00:00Z',
})

beforeEach(() => {
  raspuns = {}
  filtre = []
})

test('anunțurile clubului se cer filtrate pe club și în ordine cronologică inversă', async () => {
  raspuns = { club_announcements: { data: [anunt('a', 'Primul')], error: null } }
  const rezultat = await getClubAnnouncements('club-1')
  expect(rezultat).toHaveLength(1)
  expect(filtre).toContain('eq(club_id,club-1)')
  expect(filtre.some((f) => f.startsWith('order(created_at'))).toBe(true)
})

// Regresie: cele trei scrieri de mai jos plecau fără `.select()`, deci PostgREST
// răspundea 204 No Content și când RLS filtrase toate rândurile. Apelantul nu avea
// cum să deosebească „am scris” de „nu aveam voie”, iar ecranul arăta o reușită.
// Fiecare test verifică DOUĂ lucruri: că rândul e cerut înapoi (`select`+`single`,
// altfel zero rânduri nu produce eroare) și că un refuz chiar se propagă.

test('publicarea cere rândul înapoi, ca zero rânduri să fie eroare', async () => {
  raspuns = { club_announcements: { data: anunt('a', 'Publicat'), error: null } }
  await createClubAnnouncement({
    club_id: 'club-1',
    title: 'Publicat',
    content: 'Text',
    priority: 'NORMAL',
    audience_kind: 'CLUB',
    audience_id: null,
  })
  expect(filtre).toContain('select()')
  expect(filtre).toContain('single()')
})

test('o publicare refuzată de bază aruncă, nu se dă drept reușită', async () => {
  raspuns = { club_announcements: { data: null, error: { message: 'RLS' } } }
  await expect(
    createClubAnnouncement({
      club_id: 'club-1',
      title: 'X',
      content: 'Y',
      priority: 'NORMAL',
      audience_kind: 'CLUB',
      audience_id: null,
    }),
  ).rejects.toBeTruthy()
})

test('ascunderea cere rândul înapoi, ca zero rânduri să fie eroare', async () => {
  raspuns = { club_announcements: { data: anunt('a', 'Ascuns'), error: null } }
  await setAnnouncementActive('a', false)
  expect(filtre).toContain('eq(id,a)')
  expect(filtre).toContain('select()')
  expect(filtre).toContain('single()')
})

test('o ascundere refuzată de bază aruncă, nu se dă drept reușită', async () => {
  raspuns = { club_announcements: { data: null, error: { message: 'RLS' } } }
  await expect(setAnnouncementActive('a', false)).rejects.toBeTruthy()
})

test('ștergerea cere rândul înapoi, ca zero rânduri să fie eroare', async () => {
  raspuns = { club_announcements: { data: anunt('a', 'Șters'), error: null } }
  await deleteClubAnnouncement('a')
  expect(filtre).toContain('delete()')
  expect(filtre).toContain('eq(id,a)')
  expect(filtre).toContain('select()')
  expect(filtre).toContain('single()')
})

test('o ștergere refuzată de bază aruncă, nu se dă drept reușită', async () => {
  raspuns = { club_announcements: { data: null, error: { message: 'RLS' } } }
  await expect(deleteClubAnnouncement('a')).rejects.toBeTruthy()
})
