import { beforeEach, expect, test, vi } from 'vitest'

import { getClubLocationById, getClubSelectableLocations, updateClubLocation } from './club'

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
  // Sălile private ale altor cluburi sunt excluse de server, nu de client.
  expect(filtre.some((f) => f.includes('club_id.eq.club-1') && f.includes('club_id.is.null'))).toBe(true)
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

// Regresie (Bugbot pe PR #31): filtrul de sală activă nu are voie să scoată din
// listă locația deja pusă pe un curs. Altfel editarea unui curs a cărui sală a
// fost dezactivată pierde locația, selectul cade pe „—”, iar salvarea cere o
// locație care era deja pusă — exact eșecul pe care acest set de schimbări îl repara.
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


// Regresie (finding UI #493, sever): politica `locations_select` lasa un
// utilizator CLUB sa citeasca ORICE locatie, inclusiv a altui club. Fara filtrul
// pe `club_id`, formularul de editare se precompleta cu datele altui club, iar
// baza refuza abia salvarea.
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

// Regresie (acelasi finding): PostgREST raspunde 204 No Content si cand RLS a
// filtrat toate randurile, deci un `update` fara `.select().single()` parea
// reusit. Ecranul arata „Locatie actualizata." si se intorcea in lista, desi
// nimic nu se scrisese.
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
      description: null,
    }),
  ).rejects.toBeTruthy()

  // Asertiunea care prinde de fapt regresia: doar `.select().single()` cere
  // PostgREST-ului randul inapoi. Fara ele raspunsul e 204 fara continut, `error`
  // e null si un test care doar verifica aruncarea ar trece si pe codul stricat.
  expect(filtre).toContain('select()')
  expect(filtre).toContain('single()')
})
