import { beforeEach, expect, test, vi } from 'vitest'

import { submitContactForm } from './public'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

const invoke = vi.mocked(supabase.functions.invoke)
const MESAJ = { name: 'Ana', email: 'ana@example.com', message: 'Salut, am o întrebare.' }

beforeEach(() => {
  invoke.mockReset()
})

test('un răspuns 2xx de la contact-form se consideră trimis', async () => {
  invoke.mockResolvedValue({ data: { success: true }, error: null })
  await expect(submitContactForm(MESAJ)).resolves.toBeUndefined()
  expect(invoke).toHaveBeenCalledWith('contact-form', { body: MESAJ })
})

test('o eroare de la contact-form ajunge la formular, nu e înghițită', async () => {
  const eroare = new Error('Edge Function returned a non-2xx status code')
  invoke.mockResolvedValue({ data: null, error: eroare })
  await expect(submitContactForm(MESAJ)).rejects.toBe(eroare)
})
