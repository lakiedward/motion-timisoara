import { supabase } from '@/lib/supabase'

export interface HomeStats {
  clubs: number
  coaches: number
  sports: number
  courses: number
}

async function countRows(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function getHomeStats(): Promise<HomeStats> {
  const [clubs, coaches, sports, courses] = await Promise.all([
    countRows(supabase.from('clubs').select('id', { count: 'exact', head: true })),
    countRows(supabase.from('coach_profiles').select('id', { count: 'exact', head: true })),
    countRows(supabase.from('sports').select('id', { count: 'exact', head: true })),
    countRows(
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('active', true),
    ),
  ])
  return { clubs, coaches, sports, courses }
}

export interface HomeTestimonial {
  id: string
  quote: string
  author: string
  createdAt: string
}

interface RatingWithAuthor {
  id: string
  comment: string | null
  created_at: string
  parent: { name: string | null } | null
}

export function shortName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Părinte'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toLocaleUpperCase('ro')}.`
}

export function toTestimonials(rows: RatingWithAuthor[], limit = 3): HomeTestimonial[] {
  return rows
    .filter((row) => row.comment && row.comment.trim())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      quote: (row.comment ?? '').trim(),
      author: shortName(row.parent?.name),
      createdAt: row.created_at,
    }))
}

export async function getHomeTestimonials(): Promise<HomeTestimonial[]> {
  const select = 'id, comment, created_at, parent:profiles(name)'
  const [courseRatings, coachRatings] = await Promise.all([
    supabase
      .from('course_ratings')
      .select(select)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('coach_ratings')
      .select(select)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ])
  if (courseRatings.error) throw courseRatings.error
  if (coachRatings.error) throw coachRatings.error
  return toTestimonials([
    ...((courseRatings.data ?? []) as unknown as RatingWithAuthor[]),
    ...((coachRatings.data ?? []) as unknown as RatingWithAuthor[]),
  ])
}
