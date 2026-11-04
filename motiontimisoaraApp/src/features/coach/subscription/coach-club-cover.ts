import { getMyCoachClubs, type CoachClub } from '@/api/coach-registration/club-membership'
import { supabase } from '@/lib/supabase'

export const COACH_CLUB_COVER_QUERY_KEY = ['coach-club-cover'] as const

const NO_COACH = null as unknown as string

export async function getCoachClubCover(): Promise<CoachClub[]> {
  const clubs = await getMyCoachClubs()
  const checks = await Promise.all(
    clubs.map(async (club) => {
      const { data, error } = await supabase.rpc('subscriber_has_access', {
        p_club_id: club.id,
        p_coach_user_id: NO_COACH,
      })
      if (error) throw new Error('Nu am putut verifica abonamentul clubului.', { cause: error })
      return data === true ? club : null
    }),
  )
  return checks.filter((club): club is CoachClub => club !== null)
}
