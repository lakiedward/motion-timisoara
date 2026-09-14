import { beforeEach, expect, test, vi } from 'vitest'
import {
  createClubAnnouncement,
  deleteClubAnnouncement,
  getClubAnnouncements,
  getClubAudiences,
  setAnnouncementActive,
} from './club'
let raspuns: Record<
  string,
  {
    data: unknown
    error: unknown
  }
> = {}
let filtre: string[] = []
let argumente: Record<string, unknown[]> = {}
function builder(table: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspuns[table] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        filtre.push(`${prop}(${args.map(String).join(',')})`)
        argumente[prop] = args
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
  argumente = {}
})
test('ținta chiar ajunge în ce se trimite la server', async () => {
  raspuns = { club_announcements: { data: anunt('a', 'Tintit'), error: null } }
  await createClubAnnouncement({
    club_id: 'club-1',
    title: 'Tintit',
    content: 'Text',
    priority: 'NORMAL',
    audience_kind: 'COURSE',
    audience_id: 'curs-1',
  })
  expect(argumente.insert?.[0]).toMatchObject({
    club_id: 'club-1',
    audience_kind: 'COURSE',
    audience_id: 'curs-1',
  })
})
test('„tot clubul” trimite ținta goală, cum cere constrângerea din bază', async () => {
  raspuns = { club_announcements: { data: anunt('a', 'General'), error: null } }
  await createClubAnnouncement({
    club_id: 'club-1',
    title: 'General',
    content: 'Text',
    priority: 'NORMAL',
    audience_kind: 'CLUB',
    audience_id: null,
  })
  expect(argumente.insert?.[0]).toMatchObject({ audience_kind: 'CLUB', audience_id: null })
})
test('țintele se cer delimitate pe clubul propriu, nu se bazează pe RLS', async () => {
  raspuns = {
    courses: { data: [{ id: 'c1', name: 'Înot', active: true }], error: null },
    activities: { data: [{ id: 'a1', name: 'Cros', active: false }], error: null },
    camps: {
      data: [
        { id: 't1', title: 'Tabără de vară', period_end: '2026-09-14' },
        { id: 't2', title: 'Tabără încheiată', period_end: '2026-09-13' },
      ],
      error: null,
    },
  }
  const tinte = await getClubAudiences('club-1', new Date('2026-09-14T12:00:00'))
  expect(filtre.filter((f) => f === 'eq(club_id,club-1)')).toHaveLength(3)
  expect(tinte).toEqual([
    { kind: 'COURSE', id: 'c1', name: 'Înot', active: true },
    { kind: 'ACTIVITY', id: 'a1', name: 'Cros', active: false },
    { kind: 'CAMP', id: 't1', name: 'Tabără de vară', active: true },
    { kind: 'CAMP', id: 't2', name: 'Tabără încheiată', active: false },
  ])
})
test('o cădere pe cursuri sau pe activități se propagă, nu întoarce o listă pe jumătate', async () => {
  raspuns = {
    courses: { data: [{ id: 'c1', name: 'Înot', active: true }], error: null },
    activities: { data: null, error: { message: 'boom' } },
  }
  await expect(getClubAudiences('club-1')).rejects.toBeTruthy()
})
test('anunțurile clubului se cer filtrate pe club și în ordine cronologică inversă', async () => {
  raspuns = { club_announcements: { data: [anunt('a', 'Primul')], error: null } }
  const rezultat = await getClubAnnouncements('club-1')
  expect(rezultat).toHaveLength(1)
  expect(filtre).toContain('eq(club_id,club-1)')
  expect(filtre.some((f) => f.startsWith('order(created_at'))).toBe(true)
})
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
