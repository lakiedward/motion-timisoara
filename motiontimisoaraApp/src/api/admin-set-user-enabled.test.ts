import { beforeEach, expect, test, vi } from 'vitest'

import { setUserEnabled } from './admin'
import { EnrollmentRequestError } from './checkout'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() }, from: vi.fn() },
}))

const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  invoke.mockReset()
  vi.mocked(supabase.from).mockReset()
})

test('dezactivarea trece prin funcția care blochează și în Auth, nu scrie direct profilul', async () => {
  invoke.mockResolvedValue({ data: { userId: 'u-1', enabled: false }, error: null })
  await expect(setUserEnabled('u-1', false)).resolves.toEqual({ userId: 'u-1', enabled: false })
  expect(invoke).toHaveBeenCalledWith('admin-set-user-enabled', {
    body: { userId: 'u-1', enabled: false },
  })
  expect(supabase.from).not.toHaveBeenCalled()
})

test('refuzul funcției ajunge în pagină cu motivul primit', async () => {
  invoke.mockResolvedValue({
    data: { error: 'Contul a fost șters și rămâne blocat.' },
    error: { message: 'Edge Function returned a non-2xx status code' },
  } as never)
  const promise = setUserEnabled('u-1', true)
  await expect(promise).rejects.toBeInstanceOf(EnrollmentRequestError)
  await expect(promise).rejects.toThrow('Contul a fost șters și rămâne blocat.')
})
