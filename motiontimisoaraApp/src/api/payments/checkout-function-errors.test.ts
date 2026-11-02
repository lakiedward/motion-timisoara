import { beforeEach, expect, test, vi } from 'vitest'

import { CHECKOUT_SERVER_UNREACHABLE, validateEnrollment } from '../checkout'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  invoke.mockReset()
})

test('a transport failure reads as a Romanian message, not the raw SDK text', async () => {
  invoke.mockResolvedValueOnce({
    data: null,
    error: { message: 'Failed to send a request to the Edge Function' },
  } as never)

  await expect(validateEnrollment('COURSE', 'c1', ['k1'])).rejects.toThrow(
    CHECKOUT_SERVER_UNREACHABLE,
  )
})

test('a non-2xx response without a body also reads as the Romanian message', async () => {
  invoke.mockResolvedValueOnce({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({}) },
    },
  } as never)

  await expect(validateEnrollment('COURSE', 'c1', ['k1'])).rejects.toThrow(
    CHECKOUT_SERVER_UNREACHABLE,
  )
})

test('the function error text still wins when the server sends one', async () => {
  invoke.mockResolvedValueOnce({
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ error: 'Cursul este plin.', code: 'full' }) },
    },
  } as never)

  await expect(validateEnrollment('COURSE', 'c1', ['k1'])).rejects.toThrow('Cursul este plin.')
})
