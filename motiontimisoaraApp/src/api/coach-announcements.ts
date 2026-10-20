import { supabase } from '@/lib/supabase'

export type CoachAnnouncementSource = 'coach' | 'club'

export type CoachAnnouncement = {
  id: string
  source: CoachAnnouncementSource
  courseId: string
  title: string | null
  content: string
  pinned: boolean
  priority: string | null
  clubName: string | null
  createdAt: string
}

export async function getCoachAnnouncements(courseIds: string[]): Promise<CoachAnnouncement[]> {
  if (!courseIds.length) return []
  const [own, club] = await Promise.all([
    supabase
      .from('course_announcements')
      .select('id, course_id, content, pinned, created_at')
      .in('course_id', courseIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('club_announcements')
      .select('id, audience_id, title, content, priority, created_at, club:clubs(name)')
      .eq('audience_kind', 'COURSE')
      .in('audience_id', courseIds)
      .order('created_at', { ascending: false }),
  ])
  if (own.error) throw own.error
  if (club.error) throw club.error

  const rows: CoachAnnouncement[] = [
    ...(own.data ?? []).map((a) => ({
      id: a.id,
      source: 'coach' as const,
      courseId: a.course_id,
      title: null,
      content: a.content,
      pinned: a.pinned,
      priority: null,
      clubName: null,
      createdAt: a.created_at,
    })),
    ...(club.data ?? []).flatMap((a) =>
      a.audience_id
        ? [
            {
              id: a.id,
              source: 'club' as const,
              courseId: a.audience_id,
              title: a.title,
              content: a.content,
              pinned: false,
              priority: a.priority,
              clubName: (a.club as { name: string } | null)?.name ?? null,
              createdAt: a.created_at,
            },
          ]
        : [],
    ),
  ]
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createCourseAnnouncement(input: {
  courseId: string
  content: string
  pinned: boolean
}): Promise<{ id: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('course_announcements')
    .insert({
      course_id: input.courseId,
      author_user_id: session.user.id,
      content: input.content,
      pinned: input.pinned,
    })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function setCourseAnnouncementPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('course_announcements')
    .update({ pinned })
    .eq('id', id)
    .select('id')
    .single()
  if (error) throw error
}

export async function deleteCourseAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('course_announcements')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  if (error) throw error
}
