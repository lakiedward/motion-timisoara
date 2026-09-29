import { beforeEach, expect, test, vi } from 'vitest'

import { cursulAreInscrieri } from './coach'

type Apel = { method: string; args: unknown[] }
let apeluri: Apel[] = []
let rezultat: { count: number | null; error: { message: string } | null }

function lant() {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_tinta, prop) {
      if (prop === 'then') {
        return (resolve: (valoare: unknown) => unknown, reject: (motiv: unknown) => unknown) =>
          Promise.resolve(rezultat).then(resolve, reject)
      }
      return (...args: unknown[]) => {
        apeluri.push({ method: String(prop), args })
        return proxy
      }
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      apeluri.push({ method: 'from', args: [table] })
      return lant()
    },
  },
}))

beforeEach(() => {
  apeluri = []
  rezultat = { count: 0, error: null }
})

test('numără înscrierile active și în așteptare ale cursului', async () => {
  rezultat = { count: 2, error: null }
  await expect(cursulAreInscrieri('curs-1')).resolves.toBe(true)
  expect(apeluri).toEqual([
    { method: 'from', args: ['enrollments'] },
    { method: 'select', args: ['id', { count: 'exact', head: true }] },
    { method: 'eq', args: ['kind', 'COURSE'] },
    { method: 'eq', args: ['entity_id', 'curs-1'] },
    { method: 'in', args: ['status', ['ACTIVE', 'PENDING']] },
  ])
})

test('zero înscrieri înseamnă că prețul rămâne deschis', async () => {
  rezultat = { count: 0, error: null }
  await expect(cursulAreInscrieri('curs-1')).resolves.toBe(false)
})

test('eroarea de citire ajunge la formular', async () => {
  rezultat = { count: null, error: { message: 'refuzat' } }
  await expect(cursulAreInscrieri('curs-1')).rejects.toEqual({ message: 'refuzat' })
})
