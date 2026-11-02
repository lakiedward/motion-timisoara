import { beforeEach, expect, test, vi } from 'vitest'

import {
  ACCOUNT_DELETION_ERROR,
  ACCOUNT_DELETION_PARENT_ONLY,
  deleteMyAccount,
} from './account-deletion'
import { supabase } from '@/lib/supabase'
import { clearPushBeforeSignOut } from './notifications'

const storage = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { signOut: vi.fn() },
    storage: { from: vi.fn(() => storage) },
  },
}))
vi.mock('./notifications', () => ({ clearPushBeforeSignOut: vi.fn() }))

const rpc = vi.mocked(supabase.rpc)
const signOut = vi.mocked(supabase.auth.signOut)

beforeEach(() => {
  rpc.mockReset()
  signOut.mockReset()
  storage.list.mockReset()
  storage.remove.mockReset()
  storage.list.mockResolvedValue({ data: [], error: null })
  vi.mocked(clearPushBeforeSignOut).mockResolvedValue(undefined)
})

test('șterge contul, pozele copiilor și deconectează doar local', async () => {
  rpc.mockResolvedValue({ data: { mode: 'anonymized' }, error: null } as never)
  storage.list.mockResolvedValue({
    data: [
      { id: 'f1', name: 'ana.jpg' },
      { id: null, name: 'dosar' },
    ],
    error: null,
  })
  await expect(deleteMyAccount('u1')).resolves.toBe('anonymized')
  expect(rpc).toHaveBeenCalledWith('delete_my_account')
  expect(storage.list).toHaveBeenCalledWith('u1', { limit: 1000 })
  expect(storage.remove).toHaveBeenCalledWith(['u1/ana.jpg'])
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(clearPushBeforeSignOut).toHaveBeenCalled()
})

test('un cont fără plăți se șterge complet', async () => {
  rpc.mockResolvedValue({ data: { mode: 'deleted' }, error: null } as never)
  await expect(deleteMyAccount('u1')).resolves.toBe('deleted')
  expect(storage.remove).not.toHaveBeenCalled()
})

test('un cont de club sau antrenor primește mesajul despre cerere', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { message: 'x', hint: 'account_deletion_parent_only' },
  } as never)
  await expect(deleteMyAccount('u1')).rejects.toThrow(ACCOUNT_DELETION_PARENT_ONLY)
  expect(signOut).not.toHaveBeenCalled()
})

test('o eroare de rețea nu deconectează și dă mesajul general', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } } as never)
  await expect(deleteMyAccount('u1')).rejects.toThrow(ACCOUNT_DELETION_ERROR)
  expect(signOut).not.toHaveBeenCalled()
})
