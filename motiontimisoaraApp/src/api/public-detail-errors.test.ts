import { beforeEach, expect, test, vi } from 'vitest'

import { getActivity, getCourse } from './public'

let raspuns: { data: unknown; error: unknown } = { data: null, error: null }

function tabela() {
  const proxy: unknown = new Proxy(() => undefined, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => unknown) => Promise.resolve(resolve(raspuns))
      }
      return () => proxy
    },
  })
  return proxy
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: () => tabela() } }))

beforeEach(() => {
  raspuns = { data: null, error: null }
})

test.each([
  ['getCourse', getCourse],
  ['getActivity', getActivity],
])('%s întoarce null când rândul nu există', async (_nume, citeste) => {
  raspuns = { data: null, error: null }
  await expect(citeste('x')).resolves.toBeNull()
})

test.each([
  ['getCourse', getCourse],
  ['getActivity', getActivity],
])('%s aruncă la orice altă eroare, ca să nu pară că rândul nu există', async (_nume, citeste) => {
  raspuns = { data: null, error: { code: '', message: 'Failed to fetch' } }
  await expect(citeste('x')).rejects.toMatchObject({ message: 'Failed to fetch' })
})

test.each([
  ['getCourse', getCourse],
  ['getActivity', getActivity],
])('%s întoarce rândul găsit', async (_nume, citeste) => {
  raspuns = { data: { id: 'x' }, error: null }
  await expect(citeste('x')).resolves.toEqual({ id: 'x' })
})
