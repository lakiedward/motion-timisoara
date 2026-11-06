import { getMyCoachClubs, type CoachClub } from '@/api/coach-registration/club-membership'
import { supabase } from '@/lib/supabase'

export const COACH_CLUB_COVER_QUERY_KEY = ['coach-club-cover'] as const

export async function getCoachClubCover(): Promise<CoachClub[]> {
  const [clubs, covering] = await Promise.all([
    getMyCoachClubs(),
    supabase.rpc('my_covering_club_ids'),
  ])
  if (covering.error) {
    throw new Error('Nu am putut verifica abonamentul clubului.', { cause: covering.error })
  }
  const coveringIds = new Set(covering.data ?? [])
  return clubs.filter((club) => coveringIds.has(club.id))
}
