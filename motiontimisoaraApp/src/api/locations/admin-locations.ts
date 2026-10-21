import { supabase } from '@/lib/supabase'
import type { ClubLocation, ClubLocationFormInput } from '@/api/club'
import type { Tables } from '@/lib/database.types'

export type AdminLocation = ClubLocation & {
  club: Pick<Tables<'clubs'>, 'id' | 'name'> | null
  creator: Pick<Tables<'profiles'>, 'id' | 'name'> | null
  usedBy: string[]
}

export type LocationOwner = { kind: 'club'; id: string } | { kind: 'coach'; id: string }

type Row = Tables<'locations'> & {
  club: AdminLocation['club']
  creator: AdminLocation['creator']
  courses?: {
    club_id: string | null
    coach_id: string
    club: { name: string } | null
    coach: { name: string } | null
  }[]
}

function toAdminLocation({ courses = [], ...loc }: Row): AdminLocation {
  const usedBy = new Set<string>()
  for (const c of courses) {
    if (c.club_id && c.club_id === loc.club_id) continue
    if (!c.club_id && !loc.club_id && c.coach_id === loc.created_by_user_id) continue
    const name = (c.club?.name ?? c.coach?.name)?.trim()
    if (name) usedBy.add(name)
  }
  return {
    ...loc,
    courseCount: courses.length,
    usedBy: [...usedBy].sort((a, b) => a.localeCompare(b, 'ro')),
  }
}

const ADMIN_LOCATION_SELECT =
  '*, club:clubs(id,name), creator:profiles!locations_created_by_user_id_fkey(id,name), courses(club_id, coach_id, club:clubs(name), coach:profiles(name))'

export async function getAllLocationsAdmin(): Promise<AdminLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select(ADMIN_LOCATION_SELECT)
    .order('name')
    .order('id')
  if (error) throw error
  return ((data ?? []) as unknown as Row[]).map(toAdminLocation)
}

export async function createAdminLocation(owner: LocationOwner, input: ClubLocationFormInput) {
  const ownerColumns =
    owner.kind === 'club'
      ? { club_id: owner.id, created_by_user_id: null }
      : { club_id: null, created_by_user_id: owner.id }
  const { error } = await supabase
    .from('locations')
    .insert({ ...input, ...ownerColumns, is_active: true })
  if (error) throw error
}

export async function getLocationAdmin(id: string): Promise<AdminLocation | null> {
  const { data, error } = await supabase
    .from('locations')
    .select(ADMIN_LOCATION_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error?.code === '22P02') return null
  if (error) throw error
  if (!data) return null
  return toAdminLocation(data as unknown as Row)
}
