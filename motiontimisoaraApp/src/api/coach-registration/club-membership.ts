import { supabase } from '@/lib/supabase'
import { coachInvitationErrorMessage } from './index'

export interface CoachClub {
  id: string
  name: string
}

export type JoinClubResult =
  | { clubId: string; clubName: string; alreadyMember: boolean; error?: never }
  | { error: { message: string } }

const JOIN_ERROR = 'Nu am putut adăuga clubul. Încearcă din nou.'
const NOT_A_COACH = 'Doar un cont de antrenor se poate alătura unui club cu acest cod.'

export async function getMyCoachClubs(): Promise<CoachClub[]> {
  const { data: coachProfileId, error: coachError } = await supabase.rpc('get_my_coach_profile_id')
  if (coachError) throw coachError
  if (!coachProfileId) return []
  const { data, error } = await supabase
    .from('club_coaches')
    .select('club_id, clubs(id, name)')
    .eq('coach_profile_id', coachProfileId)
  if (error) throw error
  return (data ?? [])
    .flatMap((row) => (row.clubs ? [{ id: row.clubs.id, name: row.clubs.name }] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
}

export async function joinClubByInvitation(code: string): Promise<JoinClubResult> {
  try {
    const { data, error } = await supabase.rpc('join_club_by_invitation', { p_code: code.trim() })
    if (error) {
      const message =
        error.message === 'ROLE_NOT_ELIGIBLE'
          ? NOT_A_COACH
          : coachInvitationErrorMessage(error.message)
      return { error: { message: message ?? JOIN_ERROR } }
    }
    const result = data as Record<string, unknown> | null
    if (
      typeof result?.clubId !== 'string' ||
      typeof result.clubName !== 'string' ||
      typeof result.alreadyMember !== 'boolean'
    )
      return { error: { message: JOIN_ERROR } }
    return { clubId: result.clubId, clubName: result.clubName, alreadyMember: result.alreadyMember }
  } catch {
    return { error: { message: JOIN_ERROR } }
  }
}
