import { supabase } from '@/lib/supabase'
import type { CoachClub, CoachListItem, CoachProfileDetail } from './public'

export type CoachClubRole = CoachClub & { isHead: boolean }

export type ClubTeamMember = { isHead: boolean; coach: CoachListItem }

type ClubTeamRow = {
  is_head: boolean
  coach: (CoachListItem & { hidden_from_public: boolean }) | null
}

export function sortClubTeam(members: ClubTeamMember[]): ClubTeamMember[] {
  return [...members].sort(
    (a, b) =>
      Number(b.isHead) - Number(a.isHead) ||
      (a.coach.profile?.name ?? '').localeCompare(b.coach.profile?.name ?? '', 'ro'),
  )
}

export async function getPublicClubTeam(clubId: string): Promise<ClubTeamMember[]> {
  const { data, error } = await supabase
    .from('club_coaches')
    .select(
      'is_head, coach:coach_profiles(id, user_id, bio, avatar_url, photo_storage_path, hidden_from_public, profile:profiles(id,name,avatar_url), coach_sports(sport:sports(id,code,name)))',
    )
    .eq('club_id', clubId)
  if (error) throw error
  const rows = (data ?? []) as unknown as ClubTeamRow[]
  return sortClubTeam(
    rows.flatMap((row) =>
      row.coach && !row.coach.hidden_from_public ? [{ isHead: row.is_head, coach: row.coach }] : [],
    ),
  )
}

export async function getClubHeadCoachId(clubId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('club_coaches')
    .select('coach_profile_id')
    .eq('club_id', clubId)
    .eq('is_head', true)
    .maybeSingle()
  if (error) throw error
  return data?.coach_profile_id ?? null
}

export async function setClubHeadCoach(clubId: string, coachProfileId: string | null) {
  const { error } = await supabase.rpc('set_club_head_coach', {
    p_club_id: clubId,
    p_coach_profile_id: coachProfileId,
  })
  if (error) throw error
}

export function coachClubs(coach: Pick<CoachProfileDetail, 'club_coaches'>): CoachClubRole[] {
  return (coach.club_coaches ?? [])
    .flatMap((m) => (m.club ? [{ ...m.club, isHead: m.is_head === true }] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
}
