import { supabase } from '@/lib/supabase'
import type { ClubLocation, ClubLocationFormInput } from '@/api/club'
import type { Tables } from '@/lib/database.types'

export type AdminLocation = ClubLocation & {
  club: Pick<Tables<'clubs'>, 'id' | 'name'> | null
  creator: Pick<Tables<'profiles'>, 'id' | 'name'> | null
}

export type LocationOwner = { kind: 'club'; id: string } | { kind: 'coach'; id: string }

type Row = Tables<'locations'> & {
  club: AdminLocation['club']
  creator: AdminLocation['creator']
  courses?: { count: number }[]
}

const ADMIN_LOCATION_SELECT =
  '*, club:clubs(id,name), creator:profiles!locations_created_by_user_id_fkey(id,name), courses(count)'

export async function getAllLocationsAdmin(): Promise<AdminLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select(ADMIN_LOCATION_SELECT)
    .order('name')
    .order('id')
  if (error) throw error
  return ((data ?? []) as unknown as Row[]).map(({ courses, ...loc }) => ({
    ...loc,
    courseCount: courses?.[0]?.count ?? 0,
  }))
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
  if (error) throw error
  if (!data) return null
  const { courses, ...loc } = data as unknown as Row
  return { ...loc, courseCount: courses?.[0]?.count ?? 0 }
}
