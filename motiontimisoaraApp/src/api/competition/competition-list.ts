import { supabase } from '@/lib/supabase'
import type { Competition, CompetitionOwner } from '@/api/competition/competitions'

export type CompetitionOrganizerKind = 'club' | 'coach'

export type CompetitionListItem = Competition & {
  organizer: { key: string; kind: CompetitionOrganizerKind; name: string }
  prices: number[]
  routesCount: number
  registeredCount: number
}

type Row = Competition & {
  club: { id: string; name: string } | null
  coach: { id: string; name: string } | null
  competition_routes: { id: string }[] | null
  competition_age_categories: { price_bani: number }[] | null
  competition_registrations: { enrollment: { status: string } | null }[] | null
}

const ACTIVE = new Set(['PENDING', 'ACTIVE'])
const UNKNOWN = 'Organizator necunoscut'

export function toCompetitionListItem(row: Row): CompetitionListItem {
  const {
    club,
    coach,
    competition_routes,
    competition_age_categories,
    competition_registrations,
    ...rest
  } = row
  const organizer = row.club_id
    ? { key: `club:${row.club_id}`, kind: 'club' as const, name: club?.name ?? UNKNOWN }
    : { key: `coach:${row.coach_id ?? ''}`, kind: 'coach' as const, name: coach?.name ?? UNKNOWN }
  return {
    ...rest,
    organizer,
    prices: (competition_age_categories ?? []).map((c) => c.price_bani),
    routesCount: (competition_routes ?? []).length,
    registeredCount: (competition_registrations ?? []).filter(
      (r) => r.enrollment && ACTIVE.has(r.enrollment.status),
    ).length,
  }
}

export async function getCompetitionList(owner: CompetitionOwner): Promise<CompetitionListItem[]> {
  let request = supabase
    .from('competitions')
    .select(
      '*, club:clubs(id, name), coach:profiles(id, name), competition_routes(id), competition_age_categories(price_bani), competition_registrations(enrollment:enrollments(status))',
    )
    .order('start_at', { ascending: true, nullsFirst: false })
  if (owner.role === 'CLUB') request = request.eq('club_id', owner.clubId ?? '')
  if (owner.role === 'COACH') request = request.eq('coach_id', owner.coachUserId ?? '')
  const { data, error } = await request
  if (error) throw error
  return ((data ?? []) as unknown as Row[]).map(toCompetitionListItem)
}
