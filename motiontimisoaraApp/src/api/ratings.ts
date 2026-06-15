import { supabase } from '@/lib/supabase'

export interface RatingSummary {
  avg: number
  count: number
}

function summarize(ratings: number[]): RatingSummary {
  const count = ratings.length
  const avg = count ? ratings.reduce((a, b) => a + b, 0) / count : 0
  return { avg, count }
}

// ---------- Courses ----------

export async function getCourseRatingSummary(courseId: string): Promise<RatingSummary> {
  const { data, error } = await supabase
    .from('course_ratings')
    .select('rating')
    .eq('course_id', courseId)
  if (error) throw error
  return summarize((data ?? []).map((r) => r.rating))
}

export async function getMyCourseRating(courseId: string): Promise<number | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase
    .from('course_ratings')
    .select('rating')
    .eq('course_id', courseId)
    .eq('parent_id', session.user.id)
    .maybeSingle()
  return data?.rating ?? null
}

export async function submitCourseRating(courseId: string, rating: number) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('course_ratings')
    .upsert(
      { course_id: courseId, parent_id: session.user.id, rating },
      { onConflict: 'course_id,parent_id' }
    )
  if (error) throw error
}

// ---------- Coaches ----------

export async function getCoachRatingSummary(coachId: string): Promise<RatingSummary> {
  const { data, error } = await supabase
    .from('coach_ratings')
    .select('rating')
    .eq('coach_id', coachId)
  if (error) throw error
  return summarize((data ?? []).map((r) => r.rating))
}

export async function getMyCoachRating(coachId: string): Promise<number | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase
    .from('coach_ratings')
    .select('rating')
    .eq('coach_id', coachId)
    .eq('parent_id', session.user.id)
    .maybeSingle()
  return data?.rating ?? null
}

export async function submitCoachRating(coachId: string, rating: number) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('coach_ratings')
    .upsert(
      { coach_id: coachId, parent_id: session.user.id, rating },
      { onConflict: 'coach_id,parent_id' }
    )
  if (error) throw error
}
