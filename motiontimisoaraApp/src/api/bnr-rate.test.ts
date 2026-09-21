import { beforeEach, expect, test, vi } from 'vitest'

import { CURS_BNR_EROARE, formatBnrDate, getCursBnr } from './bnr-rate'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  invoke.mockReset()
})

test('un răspuns BNR valid păstrează data și milionimile', async () => {
  invoke.mockResolvedValue({ data: { date: '2026-09-19', eur_ron_millionths: 5073100 }, error: null })
  await expect(getCursBnr()).resolves.toEqual({ date: '2026-09-19', eur_ron_millionths: 5073100 })
  expect(formatBnrDate('2026-09-19')).toBe('19.09.2026')
})

test('un răspuns gol sau o eroare de rețea nu inventează un curs', async () => {
  invoke.mockResolvedValue({ data: { date: '2026-09-19', eur_ron_millionths: 0 }, error: null })
  await expect(getCursBnr()).rejects.toThrow(CURS_BNR_EROARE)
  invoke.mockResolvedValue({ data: null, error: { message: 'failed' } })
  await expect(getCursBnr()).rejects.toThrow(CURS_BNR_EROARE)
})
