import { beforeEach, expect, test, vi } from 'vitest'

import { getClubSelectableLocations } from './club'

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
