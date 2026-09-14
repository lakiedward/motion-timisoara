import { z } from 'zod'

import { supabase } from '@/lib/supabase'

const announcementSource = z.enum(['coach', 'club'])
const timestamp = z.string().datetime({ offset: true })
const announcementIdentity = z.object({
  pinned: z.boolean(),
  publishedAt: timestamp,
  source: announcementSource,
  id: z.string().uuid(),
})
const announcementCursor = announcementIdentity.extend({
  orderVersion: z.string().regex(/^[a-f0-9]{32}$/),
})
const announcementRow = announcementIdentity.extend({
  content: z.string(),
  title: z.string().nullable(),
  authorName: z.string(),
  courseId: z.string().uuid().nullable(),
  courseName: z.string().nullable(),
  audienceKind: z.enum(['CLUB', 'COURSE', 'ACTIVITY', 'CAMP']),
  audienceName: z.string(),
})
const feedPage = z.object({
  items: z.array(announcementRow),
  asOf: timestamp,
  previousSeenAt: timestamp.nullable(),
  nextCursor: announcementCursor.nullable(),
})
const announcementCourse = z.object({ id: z.string().uuid(), name: z.string() })

export type AnnouncementRow = z.infer<typeof announcementRow>
export type AnnouncementCursor = z.infer<typeof announcementCursor>
export type FeedPage = z.infer<typeof feedPage>

export async function getParentAnnouncementFeed({
  courseId,
  cursor,
  asOf,
}: {
  courseId?: string | null
  cursor?: AnnouncementCursor | null
  asOf?: string
} = {}): Promise<FeedPage> {
  if (cursor && !asOf) throw new Error('Cursorul necesită începutul vizitei.')
  const { data, error } = await supabase.rpc('get_parent_announcement_feed', {
    ...(courseId ? { p_course_id: courseId } : {}),
    ...(asOf ? { p_as_of: asOf } : {}),
    ...(cursor
      ? {
          p_before_pinned: cursor.pinned,
          p_before_published_at: cursor.publishedAt,
          p_before_source: cursor.source,
          p_before_id: cursor.id,
          p_order_version: cursor.orderVersion,
        }
      : {}),
    p_page_size: 20,
  })
  if (error) throw error
  return feedPage.parse(data)
}

export async function getParentAnnouncementCourses(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.rpc('get_parent_announcement_courses')
  if (error) throw error
  return z.array(announcementCourse).parse(data)
}

export async function markParentAnnouncementsSeen(
  asOf: string,
  expectedUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc('mark_parent_announcements_seen', {
    p_as_of: asOf,
    p_expected_user_id: expectedUserId,
  })
  if (error) throw error
}
