import { beforeEach, expect, test, vi } from 'vitest'

import { getMyAnnouncements } from './account'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}
/** Ce s-a cerut serverului, pe tabelă — forma cererii contează, nu doar răspunsul. */
let cereri: Record<string, string[]> = {}

function builder(table: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[table] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        ;(cereri[table] ??= []).push(`${prop}(${args.map(String).join(',')})`)
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => builder(table) },
}))

const curs = (id: string, created_at: string, pinned = false) => ({
  id,
  content: 'de la antrenor',
  created_at,
  pinned,
  course: { id: 'curs-1', name: 'Înot începători' },
})

const club = (id: string, created_at: string, title = 'Titlu') => ({
  id,
  title,
  content: 'de la club',
  created_at,
  club: { id: 'club-1', name: 'Club Audit Motion' },
})

beforeEach(() => {
  raspuns = {}
  cereri = {}
})

// Prima clauză a politicii lasă un proprietar de club să-și vadă TOATE anunțurile,
// inclusiv ascunse și programate. Pe pagina de părinte, același om trebuie să vadă
// ce vede un părinte — altfel își verifică un anunț ascuns aici și crede că a plecat.
test('anunțurile de club se cer doar în forma pe care o vede un părinte', async () => {
  await getMyAnnouncements()
  const cerute = cereri.club_announcements ?? []
  expect(cerute).toContain('eq(is_active,true)')
  expect(cerute.some((c) => c.startsWith('or(publish_at.is.null,publish_at.lte.'))).toBe(true)
  expect(cerute.some((c) => c.startsWith('or(expires_at.is.null,expires_at.gt.'))).toBe(true)
})

test('numele clubului se cere odată cu anunțul, nu se ghicește', async () => {
  await getMyAnnouncements()
  expect(cereri.club_announcements ?? []).toContain('select(*, club:clubs(id,name))')
  expect(cereri.course_announcements ?? []).toContain('select(*, course:courses(id,name))')
})

test('lista aduce ambele surse, marcate cu autorul lor', async () => {
  raspuns = {
    course_announcements: { data: [curs('c1', '2026-08-25T09:00:00Z')], error: null },
    club_announcements: { data: [club('k1', '2026-08-26T09:00:00Z')], error: null },
  }
  const randuri = await getMyAnnouncements()
  expect(randuri.map((r) => r.sursa)).toEqual(['club', 'coach'])
  expect(randuri.map((r) => r.autor)).toEqual(['Club Audit Motion', 'Înot începători'])
})

test('cele mai noi apar primele, indiferent din ce tabelă vin', async () => {
  raspuns = {
    course_announcements: {
      data: [curs('vechi', '2026-08-20T09:00:00Z'), curs('nou', '2026-08-27T09:00:00Z')],
      error: null,
    },
    club_announcements: { data: [club('mijloc', '2026-08-24T09:00:00Z')], error: null },
  }
  const randuri = await getMyAnnouncements()
  expect(randuri.map((r) => r.id)).toEqual(['nou', 'mijloc', 'vechi'])
})

// „Fixat" există doar pe anunțurile de curs; nu are voie să se piardă la unire.
test('anunțurile fixate rămân deasupra, chiar dacă sunt mai vechi', async () => {
  raspuns = {
    course_announcements: { data: [curs('fixat', '2026-08-01T09:00:00Z', true)], error: null },
    club_announcements: { data: [club('recent', '2026-08-27T09:00:00Z')], error: null },
  }
  const randuri = await getMyAnnouncements()
  expect(randuri.map((r) => r.id)).toEqual(['fixat', 'recent'])
})

test('anunțurile de curs n-au titlu, cele de club au', async () => {
  raspuns = {
    course_announcements: { data: [curs('c1', '2026-08-25T09:00:00Z')], error: null },
    club_announcements: { data: [club('k1', '2026-08-26T09:00:00Z', 'Ședință')], error: null },
  }
  const randuri = await getMyAnnouncements()
  expect(randuri.find((r) => r.id === 'c1')?.title).toBeNull()
  expect(randuri.find((r) => r.id === 'k1')?.title).toBe('Ședință')
})

test('un eșec pe oricare dintre surse se propagă, nu se înghite pe jumătate', async () => {
  raspuns = {
    course_announcements: { data: [], error: null },
    club_announcements: { data: null, error: { message: 'boom' } },
  }
  await expect(getMyAnnouncements()).rejects.toBeTruthy()
})

test('lipsa clubului sau a cursului nu lasă autorul gol', async () => {
  raspuns = {
    course_announcements: {
      data: [{ id: 'c1', content: 'x', created_at: '2026-08-25T09:00:00Z', pinned: false, course: null }],
      error: null,
    },
    club_announcements: {
      data: [{ id: 'k1', title: 'T', content: 'y', created_at: '2026-08-26T09:00:00Z', club: null }],
      error: null,
    },
  }
  const randuri = await getMyAnnouncements()
  expect(randuri.map((r) => r.autor)).toEqual(['Club', 'Curs'])
})
