import { beforeEach, expect, test, vi } from 'vitest'

import { getClubLocationById, getClubSelectableLocations, updateClubLocation } from './club'

let raspuns: Record<string, { data: unknown; error: unknown }> = {}

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
  supabase: { from: (table: string) => builder(table) },
}))

const loc = (id: string, name: string, is_active: boolean) => ({
  id,
  name,
  city: 'Timișoara',
  is_active,
})

beforeEach(() => {
  raspuns = {}
  filtre = []
})

test('clubul primește locațiile proprii și pe cele comune ale platformei', async () => {
  raspuns = {
    locations: {
      data: [loc('proprie', 'Sala Clubului', true), loc('comuna', 'Bazin Olimpic Timișoara', true)],
      error: null,
    },
  }
  const rezultat = await getClubSelectableLocations('club-1')
  expect(rezultat.map((l) => l.id)).toEqual(['proprie', 'comuna'])
  expect(filtre.some((f) => f.includes('club_id.eq.club-1') && f.includes('club_id.is.null'))).toBe(
    true,
  )
})

test('sălile dezactivate nu apar la o alegere nouă', async () => {
  raspuns = {
    locations: {
      data: [loc('activa', 'Sala Activă', true), loc('inactiva', 'Sala Închisă', false)],
      error: null,
    },
  }
  const rezultat = await getClubSelectableLocations('club-1')
  expect(rezultat.map((l) => l.id)).toEqual(['activa'])
})
test('locația deja salvată pe curs rămâne în listă chiar dezactivată', async () => {
  raspuns = {
    locations: {
      data: [loc('activa', 'Sala Activă', true), loc('inactiva', 'Sala Închisă', false)],
      error: null,
    },
  }
  const rezultat = await getClubSelectableLocations('club-1', 'inactiva')
  expect(rezultat.map((l) => l.id)).toEqual(['activa', 'inactiva'])
})

test('nu întoarce câmpul is_active mai departe în interfață', async () => {
  raspuns = { locations: { data: [loc('activa', 'Sala Activă', true)], error: null } }
  const rezultat = await getClubSelectableLocations('club-1')
  expect(Object.keys(rezultat[0]).sort()).toEqual(['city', 'id', 'name'])
})
test('citirea unei locatii de editat cere si clubul, nu doar id-ul', async () => {
  raspuns = { locations: { data: loc('proprie', 'Sala Clubului', true), error: null } }
  await getClubLocationById('proprie', 'club-1')
  expect(filtre.some((f) => f === 'eq(club_id,club-1)')).toBe(true)
  expect(filtre.some((f) => f === 'eq(id,proprie)')).toBe(true)
})

test('un id care nu e al clubului intoarce nimic, nu randul altui club', async () => {
  raspuns = { locations: { data: null, error: null } }
  expect(await getClubLocationById('a-altui-club', 'club-1')).toBeNull()
})
test('o salvare care nu atinge niciun rand esueaza, nu se preface ca a mers', async () => {
  raspuns = {
    locations: {
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    },
  }
  await expect(
    updateClubLocation('a-altui-club', {
      name: 'Sala',
      type: 'GYM',
      address: null,
      city: null,
      lat: 45.75,
      lng: 21.22,
      county: 'Timiș',
    }),
  ).rejects.toBeTruthy()
  expect(filtre).toContain('select()')
  expect(filtre).toContain('single()')
})
