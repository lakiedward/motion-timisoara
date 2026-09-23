import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type CompetitionPodiumResult = {
  id: string
  competition_id: string
  category_id: string
  registration_id: string
  place: number
  updated_at: string
  updated_by: string | null
  created_at: string
}

export type CompetitionPodiumPublication = {
  id: string
  competition_id: string
  category_id: string
  published_at: string
  published_by: string | null
}

export type CompetitionPodiumCandidate = {
  registration_id: string
  participant_name: string
  age_at_registration: number
}

export type PublishedCompetitionPodium = {
  category_id: string
  place: number
  participant_name: string
  published_at: string
  updated_at: string
}

type LocalTable<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type PodiumDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      competition_podium_results: LocalTable<
        CompetitionPodiumResult,
        Pick<
          CompetitionPodiumResult,
          'competition_id' | 'category_id' | 'registration_id' | 'place'
        >,
        Partial<Pick<CompetitionPodiumResult, 'registration_id' | 'place'>>
      >
      competition_podium_publications: LocalTable<
        CompetitionPodiumPublication,
        Pick<CompetitionPodiumPublication, 'competition_id' | 'category_id'>,
        never
      >
    }
    Functions: Database['public']['Functions'] & {
      get_competition_podium_candidates: {
        Args: { p_competition_id: string; p_category_id: string }
        Returns: CompetitionPodiumCandidate[]
      }
      get_published_competition_podium: {
        Args: { p_competition_id: string }
        Returns: PublishedCompetitionPodium[]
      }
    }
  }
}

const podiumDb = supabase as SupabaseClient<PodiumDatabase>

export async function getCompetitionPodiumManagement(competitionId: string): Promise<{
  results: CompetitionPodiumResult[]
  publications: CompetitionPodiumPublication[]
}> {
  const [results, publications] = await Promise.all([
    podiumDb.from('competition_podium_results').select('*').eq('competition_id', competitionId),
    podiumDb
      .from('competition_podium_publications')
      .select('*')
      .eq('competition_id', competitionId),
  ])
  if (results.error) throw results.error
  if (publications.error) throw publications.error
  return { results: results.data ?? [], publications: publications.data ?? [] }
}

export async function getCompetitionPodiumCandidates(
  competitionId: string,
  categoryId: string,
): Promise<CompetitionPodiumCandidate[]> {
  const { data, error } = await podiumDb.rpc('get_competition_podium_candidates', {
    p_competition_id: competitionId,
    p_category_id: categoryId,
  })
  if (error) throw error
  return data ?? []
}

export async function getPublishedCompetitionPodium(
  competitionId: string,
): Promise<PublishedCompetitionPodium[]> {
  const { data, error } = await podiumDb.rpc('get_published_competition_podium', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return data ?? []
}

export async function saveCompetitionPodiumPlace(input: {
  competitionId: string
  categoryId: string
  place: number
  registrationId: string | null
  currentId: string | null
}): Promise<void> {
  if (!Number.isInteger(input.place) || input.place < 1 || input.place > 3) {
    throw new Error('Locul în podium trebuie să fie între 1 și 3.')
  }
  if (!input.registrationId) {
    if (!input.currentId) return
    const { error } = await podiumDb
      .from('competition_podium_results')
      .delete()
      .eq('id', input.currentId)
      .eq('competition_id', input.competitionId)
      .eq('category_id', input.categoryId)
      .select()
      .single()
    if (error) throw error
    return
  }
  const result = input.currentId
    ? await podiumDb
        .from('competition_podium_results')
        .update({ registration_id: input.registrationId })
        .eq('id', input.currentId)
        .eq('competition_id', input.competitionId)
        .eq('category_id', input.categoryId)
        .select()
        .single()
    : await podiumDb
        .from('competition_podium_results')
        .insert({
          competition_id: input.competitionId,
          category_id: input.categoryId,
          registration_id: input.registrationId,
          place: input.place,
        })
        .select()
        .single()
  if (result.error) throw result.error
}

export async function publishCompetitionPodiumCategory(
  competitionId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await podiumDb
    .from('competition_podium_publications')
    .insert({ competition_id: competitionId, category_id: categoryId })
    .select()
    .single()
  if (error) throw error
}
