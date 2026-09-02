import { beforeEach, expect, test, vi } from 'vitest'

import * as account from './account'
import * as admin from './admin'
import * as club from './club'
import * as coach from './coach'

/**
 * PostgREST răspunde 204 No Content la un UPDATE sau DELETE și atunci când RLS a
 * filtrat toate rândurile, deci fără `.select().single()` un refuz („nu aveam
 * voie”) sau un id inexistent arăta pe ecran exact ca o reușită. Fiecare scriere
 * de mai jos trebuie să ceară rândul înapoi și să arunce când nu-l primește.
 */

/** Ce întoarce serverul la următoarea interogare, indiferent de tabel. */
let raspuns: { data: unknown; error: unknown } = { data: null, error: null }
/** Metodele înlănțuite pe builder, ca să vedem că rândul a fost cerut înapoi. */
let lant: string[] = []

/** Exact ce dă PostgREST pentru `.single()` peste zero rânduri. */
const ZERO_RANDURI = {
  data: null,
  error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
}

function builder() {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(raspuns))
      }
      return () => {
        lant.push(prop)
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => builder(),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }) },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  },
}))

beforeEach(() => {
  raspuns = { data: { id: 'x' }, error: null }
  lant = []
})

const poza = () => new File(['x'], 'poza.jpg', { type: 'image/jpeg' })

const scrieri: [string, () => Promise<unknown>][] = [
  ['club.updateClub', () => club.updateClub('c1', {} as Parameters<typeof club.updateClub>[1])],
  ['club.removeClubCoach', () => club.removeClubCoach('c1', 'cp1')],
  ['club.deleteClubCode', () => club.deleteClubCode('k1')],
  [
    'club.updateClubCourse',
    () => club.updateClubCourse('x', { price_per_session: 100 } as Parameters<typeof club.updateClubCourse>[1]),
  ],
  ['club.setClubCourseActive', () => club.setClubCourseActive('x', false)],
  ['coach.setCourseActive', () => coach.setCourseActive('x', false)],
  ['coach.setActivityActive', () => coach.setActivityActive('x', false)],
  ['coach.setLocationActive', () => coach.setLocationActive('x', false)],
  ['coach.updateMyCoachProfile', () => coach.updateMyCoachProfile({ name: 'A', phone: null, bio: null })],
  ['admin.setUserEnabled', () => admin.setUserEnabled('u', false)],
  ['admin.updateSport', () => admin.updateSport('s', 'COD', 'Nume')],
  ['admin.setSportDefaultPhoto', () => admin.setSportDefaultPhoto('s', poza())],
  ['admin.clearSportDefaultPhoto', () => admin.clearSportDefaultPhoto('s', null)],
  ['admin.deleteSport', () => admin.deleteSport('s')],
  ['admin.deleteInviteCode', () => admin.deleteInviteCode('k')],
  ['admin.setCourseActiveAdmin', () => admin.setCourseActiveAdmin('x', false)],
  ['account.deleteChild', () => account.deleteChild('ch')],
]

test.each(scrieri)('%s aruncă atunci când nu a atins niciun rând', async (_nume, scrie) => {
  raspuns = ZERO_RANDURI
  await expect(scrie()).rejects.toMatchObject({ code: 'PGRST116' })
})

test.each(scrieri)('%s cere rândul înapoi, nu se mulțumește cu 204', async (_nume, scrie) => {
  await scrie()
  expect(lant).toContain('select')
  expect(lant).toContain('single')
})

test.each(scrieri)('%s trece când rândul chiar a fost atins', async (_nume, scrie) => {
  await expect(scrie()).resolves.not.toThrow()
})

// Regresie separată: `deleteChild` întorcea răspunsul brut în loc să arunce, deci
// `onError` din pagină nu se declanșa niciodată — nici pentru o eroare reală.
test('account.deleteChild aruncă și pentru o eroare obișnuită a bazei', async () => {
  raspuns = { data: null, error: { code: '42501', message: 'permission denied' } }
  await expect(account.deleteChild('ch')).rejects.toMatchObject({ code: '42501' })
})
