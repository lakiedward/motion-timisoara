import { beforeEach, expect, test, vi } from 'vitest'

import { cautaAntrenori, getInvitatiileMele, invitaAntrenor } from './camp-coaches'

let raspunsuri: Record<string, { data: unknown; error: unknown }> = {}
let cereri: Record<string, string[]> = {}
let inserate: unknown[] = []

function lant(tabela: string) {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve(raspunsuri[tabela] ?? { data: [], error: null }))
      }
      return (...args: unknown[]) => {
        ;(cereri[tabela] ??= []).push(`${prop}(${args.map((a) => JSON.stringify(a)).join(',')})`)
        if (prop === 'insert') inserate.push(args[0])
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => lant(t),
    storage: {
      from: () => ({ getPublicUrl: (c: string) => ({ data: { publicUrl: `https://public/${c}` } }) }),
    },
  },
}))

beforeEach(() => {
  raspunsuri = {}
  cereri = {}
  inserate = []
})

// Politica de INSERT cere `invited`. Trimițând `status` din client, o versiune
// viitoare ar putea încerca `accepted` — refuzat, corect, dar cu un mesaj de
// neînțeles. Valoarea implicită a coloanei e singura care o pune.
test('invitația nu trimite deloc starea', async () => {
  raspunsuri.camp_coaches = { data: {}, error: null }
  await invitaAntrenor('c1', 'cp1')
  expect(inserate[0]).toEqual({ camp_id: 'c1', coach_profile_id: 'cp1' })
})

test('sub două litere nu se caută nimic', async () => {
  expect(await cautaAntrenori('a', [])).toEqual([])
  expect(await cautaAntrenori('  ', [])).toEqual([])
  expect(cereri.coach_profiles).toBeUndefined()
})

test('cine e deja invitat nu mai apare în rezultate', async () => {
  raspunsuri.coach_profiles = {
    data: [
      { id: 'cp1', photo_storage_path: null, profile: { name: 'Ana Antrenor' } },
      { id: 'cp2', photo_storage_path: 'p.jpg', profile: { name: 'Ana Popescu' } },
    ],
    error: null,
  }
  const gasiti = await cautaAntrenori('Ana', ['cp1'])
  expect(gasiti.map((g) => g.coachProfileId)).toEqual(['cp2'])
  expect(gasiti[0]!.pozaUrl).toBe('https://public/p.jpg')
})

test('un antrenor fără nume primește un nume de rezervă, nu gol', async () => {
  raspunsuri.coach_profiles = {
    data: [{ id: 'cp1', photo_storage_path: null, profile: null }],
    error: null,
  }
  const gasiti = await cautaAntrenori('Ana', [])
  expect(gasiti[0]!.nume).toBe('Antrenor')
})

test('fără profil de antrenor nu există invitații, și nu se mai întreabă', async () => {
  raspunsuri.coach_profiles = { data: null, error: null }
  expect(await getInvitatiileMele('u1')).toEqual([])
  expect(cereri.camp_coaches).toBeUndefined()
})

// O invitație a cărei tabără a fost ștearsă între timp: rândul cade în cascadă,
// dar dacă apare într-un răspuns vechi din cache nu trebuie randat gol.
test('o invitație fără tabără e lăsată deoparte, nu randată goală', async () => {
  raspunsuri.coach_profiles = { data: { id: 'cp1' }, error: null }
  raspunsuri.camp_coaches = {
    data: [
      { camp_id: 'c1', status: 'invited', camp: null },
      {
        camp_id: 'c2',
        status: 'accepted',
        camp: {
          title: 'Tabără',
          slug: 't',
          period_start: '2026-01-01',
          period_end: '2026-01-05',
          location_text: null,
        },
      },
    ],
    error: null,
  }
  const inv = await getInvitatiileMele('u1')
  expect(inv.map((i) => i.campId)).toEqual(['c2'])
})
