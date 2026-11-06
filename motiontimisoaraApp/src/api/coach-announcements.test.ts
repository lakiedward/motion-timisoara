import { beforeEach, expect, test, vi } from 'vitest'

import {
  createCourseAnnouncement,
  deleteCourseAnnouncement,
  getCoachAnnouncements,
  setCourseAnnouncementPinned,
} from './coach-announcements'

let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let jurnal: { tabela: string; metoda: string; arg: unknown }[] = []
let sesiune: { user: { id: string } } | null = { user: { id: 'u-1' } }

function lant(tabela: string) {
  let verb = 'select'
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspunsuri[tabela] ?? { data: [], error: null }))
      }
      return (arg: unknown) => {
        if (prop === 'insert' || prop === 'update' || prop === 'delete') verb = prop
        jurnal.push({ tabela, metoda: prop === 'select' ? `select(${verb})` : prop, arg })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => lant(t),
    auth: { getSession: async () => ({ data: { session: sesiune } }) },
  },
}))

beforeEach(() => {
  raspunsuri = {}
  jurnal = []
  sesiune = { user: { id: 'u-1' } }
})

test('fără cursuri nu face nicio cerere', async () => {
  await expect(getCoachAnnouncements([])).resolves.toEqual([])
  expect(jurnal).toEqual([])
})

test('îmbină anunțurile antrenorului și ale clubului, cele mai noi primele', async () => {
  raspunsuri.course_announcements = {
    data: [
      {
        id: 'a1',
        course_id: 'c1',
        content: 'Antrenor',
        pinned: true,
        created_at: '2026-11-01T10:00:00Z',
      },
    ],
    error: null,
  }
  raspunsuri.club_announcements = {
    data: [
      {
        id: 'b1',
        audience_id: 'c1',
        title: 'Club',
        content: 'Din club',
        priority: 'HIGH',
        created_at: '2026-11-02T10:00:00Z',
        club: { name: 'Club Motion' },
      },
      {
        id: 'b2',
        audience_id: null,
        title: 'Fără curs',
        content: 'Ignorat',
        priority: null,
        created_at: '2026-11-03T10:00:00Z',
        club: null,
      },
    ],
    error: null,
  }
  const rezultat = await getCoachAnnouncements(['c1'])
  expect(rezultat.map((a) => a.id)).toEqual(['b1', 'a1'])
  expect(rezultat[0]).toMatchObject({
    source: 'club',
    courseId: 'c1',
    title: 'Club',
    pinned: false,
    priority: 'HIGH',
    clubName: 'Club Motion',
  })
  expect(rezultat[1]).toMatchObject({ source: 'coach', title: null, pinned: true, clubName: null })
})

test('un anunț de club fără clubul citit are numele null', async () => {
  raspunsuri.club_announcements = {
    data: [
      {
        id: 'b1',
        audience_id: 'c1',
        title: null,
        content: 'x',
        priority: null,
        created_at: '2026-11-02T10:00:00Z',
        club: null,
      },
    ],
    error: null,
  }
  const [anunt] = await getCoachAnnouncements(['c1'])
  expect(anunt.clubName).toBeNull()
})

test.each(['course_announcements', 'club_announcements'])(
  'eroarea la citirea din %s se aruncă, nu devine listă goală',
  async (tabela) => {
    raspunsuri[tabela] = { data: null, error: new Error('offline') }
    await expect(getCoachAnnouncements(['c1'])).rejects.toThrow('offline')
  },
)

test('createCourseAnnouncement trimite autorul din sesiune și întoarce id-ul', async () => {
  raspunsuri.course_announcements = { data: { id: 'nou' }, error: null }
  await expect(
    createCourseAnnouncement({ courseId: 'c1', content: 'Salut', pinned: true }),
  ).resolves.toEqual({ id: 'nou' })
  expect(jurnal.find((j) => j.metoda === 'insert')?.arg).toEqual({
    course_id: 'c1',
    author_user_id: 'u-1',
    content: 'Salut',
    pinned: true,
  })
})

test('createCourseAnnouncement fără sesiune aruncă și nu scrie', async () => {
  sesiune = null
  await expect(
    createCourseAnnouncement({ courseId: 'c1', content: 'Salut', pinned: false }),
  ).rejects.toThrow('Not authenticated')
  expect(jurnal).toEqual([])
})

test('createCourseAnnouncement aruncă eroarea bazei', async () => {
  raspunsuri.course_announcements = { data: null, error: new Error('RLS') }
  await expect(
    createCourseAnnouncement({ courseId: 'c1', content: 'Salut', pinned: false }),
  ).rejects.toThrow('RLS')
})

test('fixarea și ștergerea citesc rândul scris, ca o scriere refuzată să nu pară reușită', async () => {
  raspunsuri.course_announcements = { data: { id: 'a1' }, error: null }
  await setCourseAnnouncementPinned('a1', true)
  await deleteCourseAnnouncement('a1')
  const metode = jurnal.map((j) => j.metoda)
  expect(metode).toEqual([
    'update',
    'eq',
    'select(update)',
    'single',
    'delete',
    'eq',
    'select(delete)',
    'single',
  ])
})

test.each([
  ['setCourseAnnouncementPinned', () => setCourseAnnouncementPinned('a1', true)],
  ['deleteCourseAnnouncement', () => deleteCourseAnnouncement('a1')],
])('%s aruncă când scrierea e refuzată', async (_nume, scrie) => {
  raspunsuri.course_announcements = {
    data: null,
    error: { code: 'PGRST116', message: 'zero rânduri' },
  }
  await expect(scrie()).rejects.toMatchObject({ code: 'PGRST116' })
})
