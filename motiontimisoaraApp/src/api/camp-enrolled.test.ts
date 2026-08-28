import { beforeEach, expect, test, vi } from 'vitest'

import { getInscrisiiTaberei, varstaLa } from './camp-enrolled'

let raspuns: { data: unknown; error: unknown } = { data: [], error: null }
let cereri: string[] = []

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => {
      const proxy: unknown = new Proxy(() => undefined, {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(raspuns))
          }
          return (...args: unknown[]) => {
            cereri.push(`${prop}(${args.map((a) => JSON.stringify(a)).join(',')})`)
            return proxy
          }
        },
      })
      return proxy
    },
  },
}))

beforeEach(() => {
  raspuns = { data: [], error: null }
  cereri = []
})

// Anulatele nu ocupa niciun loc si n-au ce cauta pe lista de plecare. Cele in
// curs de plata TIN un loc, deci trebuie sa se vada — aceeasi socoteala ca
// `camp_spots_remaining`.
test('cere doar înscrierile care țin un loc', async () => {
  await getInscrisiiTaberei('c1')
  expect(cereri).toContain('in("status",["ACTIVE","PENDING"])')
  expect(cereri.join(' ')).not.toContain('CANCELLED')
})

test('un copil fără fișă vizibilă lasă rândul, dar spune de ce', async () => {
  raspuns = {
    data: [{ id: 'e1', status: 'ACTIVE', created_at: '2026-01-01', child_id: 'k1', child: null }],
    error: null,
  }
  const lista = await getInscrisiiTaberei('c1')
  expect(lista).toHaveLength(1)
  expect(lista[0]!.nume).toBe('Copil fără fișă vizibilă')
  expect(lista[0]!.alergii).toBeNull()
})

test('fișa completă ajunge întreagă la pagină', async () => {
  raspuns = {
    data: [
      {
        id: 'e1',
        status: 'PENDING',
        created_at: '2026-01-01',
        child_id: 'k1',
        child: {
          id: 'k1',
          name: 'Ana',
          birth_date: '2016-06-01',
          tshirt_size: '134',
          allergies: 'Arahide',
          emergency_contact_name: 'Mama',
          emergency_phone: '+40700000001',
          secondary_contact_name: null,
          secondary_phone: null,
        },
      },
    ],
    error: null,
  }
  const [c] = await getInscrisiiTaberei('c1')
  expect(c).toMatchObject({
    stare: 'PENDING',
    nume: 'Ana',
    alergii: 'Arahide',
    telefonUrgenta: '+40700000001',
    contactSecundar: null,
  })
})

// Vârsta care conteaza e cea de la plecare, nu cea de azi: un copil care
// implineste 12 ani in tabara nu e de 11 cand se fac grupele.
test('vârsta se socotește la prima zi a taberei', () => {
  expect(varstaLa('2016-06-01', '2026-09-13')).toBe(10)
  // Ziua de nastere cade CHIAR in prima zi: are deja anul implinit.
  expect(varstaLa('2016-09-13', '2026-09-13')).toBe(10)
  // Cu o zi inainte de aniversare, inca nu.
  expect(varstaLa('2016-09-14', '2026-09-13')).toBe(9)
  expect(varstaLa(null, '2026-09-13')).toBeNull()
})
