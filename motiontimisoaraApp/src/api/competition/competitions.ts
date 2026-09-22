import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { slugDinTitlu } from '@/api/camps-admin'
import type { CompetitionSchedule } from '@/lib/competition-schedule'
import { getCompetitionRoutes } from '@/api/competition/competition-offers'

export type Competition = Tables<'competitions'> & {
  start_at: string | null
  end_at: string | null
  registration_deadline_at: string | null
  location_id: string | null
  location_text: string | null
  allow_cash: boolean
}

export type CompetitionRole = 'CLUB' | 'COACH' | 'ADMIN'

export interface CompetitionOwner {
  role: CompetitionRole
  clubId: string | null
  coachUserId: string | null
}

export interface CompetitionInput extends CompetitionSchedule {
  title: string
  description: string
  location_id: string | null
  location_text: string
  allow_cash: boolean
}

export interface CompetitionOrganizer {
  fel: 'club' | 'antrenor'
  nume: string
  link: string
}

export interface PublicCompetition {
  id: string
  slug: string
  title: string
  description: string
  heroUrl: string | null
  organizator: CompetitionOrganizer | null
  startAt: string | null
  endAt: string | null
  registrationDeadlineAt: string | null
  locationText: string | null
  allowCash: boolean
}

const TITLU_FARA_SLUG = 'Titlul trebuie să conțină litere sau cifre.'

export function coloaneProprietar(owner: CompetitionOwner): {
  club_id: string | null
  coach_id: string | null
} {
  if (owner.role === 'CLUB') return { club_id: owner.clubId, coach_id: null }
  if (owner.role === 'COACH') return { club_id: null, coach_id: owner.coachUserId }
  return { club_id: null, coach_id: null }
}

export function slugConcurs(titlu: string, bazaOcupata: boolean, id: string): string {
  const baza = slugDinTitlu(titlu)
  if (!baza) return ''
  if (!bazaOcupata) return baza
  const sufix = id.replace(/-/g, '').slice(0, 8)
  const taiat = baza.slice(0, 60 - sufix.length - 1).replace(/-+$/, '')
  return `${taiat || 'concurs'}-${sufix}`
}

export function organizatorDinLegaturi(
  club: { id: string; name: string } | null,
  coach: { id: string; name: string } | null,
): CompetitionOrganizer | null {
  if (club) return { fel: 'club', nume: club.name, link: `/cluburi/${club.id}` }
  if (coach) return { fel: 'antrenor', nume: coach.name, link: `/antrenori/${coach.id}` }
  return null
}

export function urlHeroConcurs(cale: string | null): string | null {
  if (!cale) return null
  return supabase.storage.from('competition-photos').getPublicUrl(cale).data.publicUrl
}

type Legaturi = {
  club: { id: string; name: string } | null
  coach: { id: string; name: string } | null
}

function prezinta(rand: Competition & Partial<Legaturi>): PublicCompetition {
  return {
    id: rand.id,
    slug: rand.slug,
    title: rand.title,
    description: rand.description,
    heroUrl: urlHeroConcurs(rand.hero_photo_storage_path),
    organizator: organizatorDinLegaturi(rand.club ?? null, rand.coach ?? null),
    startAt: rand.start_at,
    endAt: rand.end_at,
    registrationDeadlineAt: rand.registration_deadline_at,
    locationText: rand.location_text,
    allowCash: rand.allow_cash,
  }
}

export async function getConcursuriPublice(): Promise<PublicCompetition[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select('*, club:clubs(id, name), coach:profiles(id, name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as Array<Competition & Legaturi>).map(prezinta)
}

export async function getConcursPublic(slug: string): Promise<PublicCompetition | null> {
  const { data, error } = await supabase
    .from('competitions')
    .select('*, club:clubs(id, name), coach:profiles(id, name)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return prezinta(data as unknown as Competition & Legaturi)
}

export async function getConcursurileMele(owner: CompetitionOwner): Promise<Competition[]> {
  let cerere = supabase.from('competitions').select('*').order('created_at', { ascending: false })
  if (owner.role === 'CLUB') cerere = cerere.eq('club_id', owner.clubId ?? '')
  if (owner.role === 'COACH') cerere = cerere.eq('coach_id', owner.coachUserId ?? '')
  const { data, error } = await cerere
  if (error) throw error
  return (data ?? []) as Competition[]
}

export async function getConcurs(id: string): Promise<Competition | null> {
  const { data, error } = await supabase.from('competitions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Competition | null
}

async function slugPentru(titlu: string, id: string): Promise<string> {
  const baza = slugDinTitlu(titlu)
  if (!baza) throw new Error(TITLU_FARA_SLUG)
  const { data, error } = await supabase
    .from('competitions')
    .select('id')
    .eq('slug', baza)
    .maybeSingle()
  if (error) throw error
  const slug = slugConcurs(titlu, !!data, id)
  if (!slug) throw new Error(TITLU_FARA_SLUG)
  return slug
}

export async function createConcurs(
  input: CompetitionInput,
  owner: CompetitionOwner,
): Promise<Competition> {
  const id = crypto.randomUUID()
  const slug = await slugPentru(input.title, id)
  const proprietar = coloaneProprietar(owner)
  if (owner.role === 'CLUB' && !proprietar.club_id) throw new Error('Clubul nu este disponibil.')
  if (owner.role === 'COACH' && !proprietar.coach_id) {
    throw new Error('Antrenorul nu este disponibil.')
  }
  const { data, error } = await supabase
    .from('competitions')
    .insert({
      id,
      title: input.title.trim(),
      description: input.description.trim(),
      slug,
      club_id: proprietar.club_id,
      coach_id: proprietar.coach_id,
      start_at: input.start_at,
      end_at: input.end_at,
      registration_deadline_at: input.registration_deadline_at,
      location_id: input.location_id,
      location_text: input.location_text.trim(),
      allow_cash: input.allow_cash,
    } as TablesInsert<'competitions'>)
    .select()
    .single()
  if (error) throw error
  return data as Competition
}

export async function updateConcurs(id: string, input: CompetitionInput): Promise<void> {
  const { error } = await supabase
    .from('competitions')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      start_at: input.start_at,
      end_at: input.end_at,
      registration_deadline_at: input.registration_deadline_at,
      location_id: input.location_id,
      location_text: input.location_text.trim(),
      allow_cash: input.allow_cash,
    } as TablesUpdate<'competitions'>)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
}

export async function stergeConcurs(id: string): Promise<void> {
  const routes = await getCompetitionRoutes(id)
  if (routes.length > 0) {
    throw new Error('Șterge mai întâi categoriile și traseele concursului.')
  }
  const { data, error: citire } = await supabase
    .from('competitions')
    .select('hero_photo_storage_path')
    .eq('id', id)
    .single()
  if (citire) throw citire

  const cale = data?.hero_photo_storage_path
  if (cale) {
    const { error: fisier } = await supabase.storage.from('competition-photos').remove([cale])
    if (fisier) throw fisier
  }

  const { error } = await supabase.from('competitions').delete().eq('id', id).select().single()
  if (error) throw error
}
