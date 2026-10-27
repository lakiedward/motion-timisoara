import { beforeEach, expect, test, vi } from 'vitest'

import { clearMyCoachPhoto, setMyCoachPhoto } from './coach-photo'

const state = vi.hoisted(() => ({
  current: null as string | null,
  updated: [] as unknown[],
  inserted: [] as unknown[],
  uploaded: [] as string[],
  removed: [] as string[][],
  updateRows: [{ id: 'cp1' }] as unknown[],
  updateError: null as unknown,
}))

vi.mock('@/lib/media', () => ({
  esteImagine: (f: File) => f.type.startsWith('image/'),
  micsoreazaPoza: async () => new Blob(['small']),
}))

vi.mock('@/lib/supabase', () => {
  const table = () => {
    let mode = 'select'
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () =>
        mode === 'update'
          ? { select: async () => ({ data: state.updateRows, error: state.updateError }) }
          : chain,
      maybeSingle: async () => ({ data: { photo_storage_path: state.current }, error: null }),
      update: (v: unknown) => {
        mode = 'update'
        state.updated.push(v)
        return chain
      },
      insert: async (v: unknown) => {
        state.inserted.push(v)
        return { error: null }
      },
    }
    return chain
  }
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      from: table,
      storage: {
        from: () => ({
          upload: async (path: string) => {
            state.uploaded.push(path)
            return { error: null }
          },
          remove: async (paths: string[]) => {
            state.removed.push(paths)
            return { error: null }
          },
        }),
      },
    },
  }
})

const image = () => new File(['x'], 'poza.png', { type: 'image/png' })

beforeEach(() => {
  state.current = null
  state.updated = []
  state.inserted = []
  state.uploaded = []
  state.removed = []
  state.updateRows = [{ id: 'cp1' }]
  state.updateError = null
})

test('uploads under the coach folder and removes the previous photo', async () => {
  state.current = 'u1/old.jpg'
  const path = await setMyCoachPhoto(image())
  expect(path).toMatch(/^u1\/[\w-]+\.jpg$/)
  expect(state.uploaded).toEqual([path])
  expect(state.updated).toEqual([{ photo_storage_path: path }])
  expect(state.removed).toEqual([['u1/old.jpg']])
})

test('creates the coach profile row when it does not exist yet', async () => {
  state.updateRows = []
  const path = await setMyCoachPhoto(image())
  expect(state.inserted).toEqual([{ user_id: 'u1', photo_storage_path: path }])
})

test('a failed save deletes the uploaded file and keeps the old photo', async () => {
  state.current = 'u1/old.jpg'
  state.updateError = new Error('rls')
  await expect(setMyCoachPhoto(image())).rejects.toThrow('rls')
  expect(state.removed).toEqual([[state.uploaded[0]]])
})

test('rejects files that are not images', async () => {
  await expect(
    setMyCoachPhoto(new File(['x'], 'a.pdf', { type: 'application/pdf' })),
  ).rejects.toThrow()
  expect(state.uploaded).toEqual([])
})

test('clearing empties the column and removes the file', async () => {
  state.current = 'u1/old.jpg'
  await clearMyCoachPhoto()
  expect(state.updated).toEqual([{ photo_storage_path: null }])
  expect(state.removed).toEqual([['u1/old.jpg']])
})
