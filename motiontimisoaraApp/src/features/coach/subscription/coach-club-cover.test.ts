import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCoachClubCover } from './coach-club-cover'
import { getMyCoachClubs } from '@/api/coach-registration/club-membership'
import { supabase } from '@/lib/supabase'

vi.mock('@/api/coach-registration/club-membership', () => ({ getMyCoachClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

const rpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  rpc.mockReset()
  vi.mocked(getMyCoachClubs).mockResolvedValue([
    { id: 'club-a', name: 'Club A' },
    { id: 'club-b', name: 'Club B' },
  ])
})

describe('getCoachClubCover', () => {
  it('keeps only the clubs the server reports as covering the coach', async () => {
    rpc.mockResolvedValue({ data: ['club-b', 'club-x'], error: null } as never)
    await expect(getCoachClubCover()).resolves.toEqual([{ id: 'club-b', name: 'Club B' }])
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('my_covering_club_ids')
  })

  it('returns no clubs when none covers the coach', async () => {
    rpc.mockResolvedValue({ data: [], error: null } as never)
    await expect(getCoachClubCover()).resolves.toEqual([])
  })

  it('fails when the access check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } } as never)
    await expect(getCoachClubCover()).rejects.toThrow('Nu am putut verifica abonamentul clubului.')
  })
})
