import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCoachClubCover } from './coach-club-cover'
import { getMyCoachClubs } from '@/api/coach-registration/club-membership'
import { supabase } from '@/lib/supabase'

vi.mock('@/api/coach-registration/club-membership', () => ({ getMyCoachClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

const rpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  vi.mocked(getMyCoachClubs).mockResolvedValue([
    { id: 'club-a', name: 'Club A' },
    { id: 'club-b', name: 'Club B' },
  ])
})

describe('getCoachClubCover', () => {
  it('keeps only the clubs whose subscription gives access', async () => {
    rpc.mockImplementation(((_name: string, args: { p_club_id: string }) =>
      Promise.resolve({ data: args.p_club_id === 'club-b', error: null })) as never)
    await expect(getCoachClubCover()).resolves.toEqual([{ id: 'club-b', name: 'Club B' }])
    expect(rpc).toHaveBeenCalledWith('subscriber_has_access', {
      p_club_id: 'club-a',
      p_coach_user_id: null,
    })
  })

  it('fails when the access check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } } as never)
    await expect(getCoachClubCover()).rejects.toThrow('Nu am putut verifica abonamentul clubului.')
  })
})
