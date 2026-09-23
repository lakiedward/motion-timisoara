import type { SupabaseClient } from '@supabase/supabase-js'
import { cautaAntrenori } from '@/api/camp-coaches'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type CompetitionInvitationStatus = 'invited' | 'accepted' | 'declined'

type CompetitionCoachRow = {
  id: string
  competition_id: string
  coach_profile_id: string
  status: CompetitionInvitationStatus
  invited_at: string
  responded_at: string | null
}

export type CompetitionCoach = {
  coachProfileId: string
  name: string
  photoUrl: string | null
  status: CompetitionInvitationStatus
  respondedAt: string | null
}

export type CompetitionCoachSearchResult = Pick<
  CompetitionCoach,
  'coachProfileId' | 'name' | 'photoUrl'
>

export type CompetitionInvitation = {
  competitionId: string
  title: string
  slug: string
  startAt: string | null
  endAt: string | null
  locationText: string | null
  status: CompetitionInvitationStatus
}

type CoachesDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      competition_coaches: {
        Row: CompetitionCoachRow
        Insert: Pick<CompetitionCoachRow, 'competition_id' | 'coach_profile_id'>
        Update: never
        Relationships: []
      }
    }
    Functions: Database['public']['Functions'] & {
      respond_to_competition_invitation: {
        Args: { p_competition_id: string; p_accept: boolean }
        Returns: CompetitionCoachRow
      }
    }
  }
}

const coachesDb = supabase as SupabaseClient<CoachesDatabase>

function coachPhotoUrl(path: string | null): string | null {
  return path ? supabase.storage.from('coach-photos').getPublicUrl(path).data.publicUrl : null
}

async function listCompetitionCoaches(
  competitionId: string,
  acceptedOnly: boolean,
): Promise<CompetitionCoach[]> {
  let query = coachesDb
    .from('competition_coaches')
    .select('coach_profile_id,status,responded_at')
    .eq('competition_id', competitionId)
    .order('invited_at')
  if (acceptedOnly) query = query.eq('status', 'accepted')
  const { data, error } = await query
  if (error) throw error
  if (!data?.length) return []

  const { data: profiles, error: profilesError } = await supabase
    .from('coach_profiles')
    .select('id,photo_storage_path,profile:profiles(name)')
    .in(
      'id',
      data.map((row) => row.coach_profile_id),
    )
  if (profilesError) throw profilesError

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        name: (profile.profile as { name: string } | null)?.name ?? 'Antrenor',
        photoUrl: coachPhotoUrl(profile.photo_storage_path),
      },
    ]),
  )

  return data.map((row) => ({
    coachProfileId: row.coach_profile_id,
    name: profileById.get(row.coach_profile_id)?.name ?? 'Antrenor',
    photoUrl: profileById.get(row.coach_profile_id)?.photoUrl ?? null,
    status: row.status,
    respondedAt: row.responded_at,
  }))
}

export function getCompetitionCoaches(competitionId: string): Promise<CompetitionCoach[]> {
  return listCompetitionCoaches(competitionId, false)
}

export function getPublicCompetitionCoaches(competitionId: string): Promise<CompetitionCoach[]> {
  return listCompetitionCoaches(competitionId, true)
}

export async function searchCompetitionCoaches(
  search: string,
  excludedIds: string[],
): Promise<CompetitionCoachSearchResult[]> {
  const results = await cautaAntrenori(search, excludedIds)
  return results.map((coach) => ({
    coachProfileId: coach.coachProfileId,
    name: coach.nume,
    photoUrl: coach.pozaUrl,
  }))
}

export async function inviteCompetitionCoach(
  competitionId: string,
  coachProfileId: string,
): Promise<void> {
  const { error } = await coachesDb
    .from('competition_coaches')
    .insert({ competition_id: competitionId, coach_profile_id: coachProfileId })
    .select()
    .single()
  if (error) throw error
}

export async function removeCompetitionCoach(
  competitionId: string,
  coachProfileId: string,
): Promise<void> {
  const { error } = await coachesDb
    .from('competition_coaches')
    .delete()
    .eq('competition_id', competitionId)
    .eq('coach_profile_id', coachProfileId)
    .select()
    .single()
  if (error) throw error
}

export async function getMyCompetitionInvitations(
  userId: string,
): Promise<CompetitionInvitation[]> {
  const { data: profile, error: profileError } = await supabase
    .from('coach_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (profileError) throw profileError
  if (!profile) return []

  const { data: invitations, error } = await coachesDb
    .from('competition_coaches')
    .select('competition_id,status')
    .eq('coach_profile_id', profile.id)
    .order('invited_at', { ascending: false })
  if (error) throw error
  if (!invitations?.length) return []

  const { data: competitions, error: competitionError } = await supabase
    .from('competitions')
    .select('id,title,slug,start_at,end_at,location_text')
    .in(
      'id',
      invitations.map((invitation) => invitation.competition_id),
    )
  if (competitionError) throw competitionError

  const competitionById = new Map(
    (
      (competitions ?? []) as unknown as Array<{
        id: string
        title: string
        slug: string
        start_at: string | null
        end_at: string | null
        location_text: string | null
      }>
    ).map((competition) => [competition.id, competition]),
  )

  return invitations.flatMap((invitation) => {
    const competition = competitionById.get(invitation.competition_id)
    if (!competition) return []
    return [
      {
        competitionId: invitation.competition_id,
        title: competition.title,
        slug: competition.slug,
        startAt: competition.start_at,
        endAt: competition.end_at,
        locationText: competition.location_text,
        status: invitation.status,
      },
    ]
  })
}

export async function respondToCompetitionInvitation(
  competitionId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await coachesDb.rpc('respond_to_competition_invitation', {
    p_competition_id: competitionId,
    p_accept: accept,
  })
  if (error) throw error
}
