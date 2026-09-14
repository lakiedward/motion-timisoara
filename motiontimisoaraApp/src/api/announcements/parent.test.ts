import { beforeEach, expect, test, vi } from 'vitest'

import {
  getParentAnnouncementCourses,
  getParentAnnouncementFeed,
  markParentAnnouncementsSeen,
  type AnnouncementRow,
  type FeedPage,
} from './parent'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))

const asOf = '2026-09-14T12:00:00.123456+00:00'
const courseId = '10000000-0000-4000-8000-000000000001'
const orderVersion = '0123456789abcdef0123456789abcdef'
const row: AnnouncementRow = {
  id: '20000000-0000-4000-8000-000000000001',
  source: 'coach',
  content: 'Antrenamentul începe la 18:00.',
  title: null,
  pinned: false,
  publishedAt: '2026-09-14T11:00:00+00:00',
  authorName: 'Antrenor Audit',
  courseId,
  courseName: 'Înot',
  audienceKind: 'COURSE',
  audienceName: 'Înot',
}
const page: FeedPage = { items: [row], asOf, previousSeenAt: null, nextCursor: null }

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ data: page, error: null })
})

test('loads a bounded server feed and preserves server timestamp precision', async () => {
  expect(await getParentAnnouncementFeed()).toEqual(page)
  expect(rpc).toHaveBeenCalledExactlyOnceWith('get_parent_announcement_feed', { p_page_size: 20 })
})

test('passes the course and complete cursor without rounding its timestamp', async () => {
  const cursor = { id: row.id, source: row.source, publishedAt: asOf, pinned: false, orderVersion }
  await getParentAnnouncementFeed({ courseId, asOf, cursor })
  expect(rpc).toHaveBeenCalledWith('get_parent_announcement_feed', {
    p_course_id: courseId,
    p_as_of: asOf,
    p_before_pinned: false,
    p_before_published_at: asOf,
    p_before_source: 'coach',
    p_before_id: row.id,
    p_page_size: 20,
    p_order_version: orderVersion,
  })
})

test('rejects a cursor without the original snapshot before requesting the database', async () => {
  await expect(getParentAnnouncementFeed({ cursor: { ...row, orderVersion } })).rejects.toThrow(
    'începutul vizitei',
  )
  expect(rpc).not.toHaveBeenCalled()
})

test('preserves an empty page and baseline instead of inventing announcements', async () => {
  const empty = { ...page, items: [], previousSeenAt: '2026-09-13T11:00:00Z' }
  rpc.mockResolvedValue({ data: empty, error: null })
  expect(await getParentAnnouncementFeed()).toEqual(empty)
})

test('preserves an ordering conflict so the UI can restart with the same visit', async () => {
  const error = { code: 'PT409', message: 'Announcement ordering changed; reload the list' }
  rpc.mockResolvedValueOnce({ data: null, error })
  await expect(
    getParentAnnouncementFeed({ asOf, cursor: { ...row, orderVersion } }),
  ).rejects.toEqual(error)
  await expect(getParentAnnouncementFeed({ asOf })).resolves.toEqual(page)
  expect(rpc).toHaveBeenLastCalledWith('get_parent_announcement_feed', {
    p_as_of: asOf,
    p_page_size: 20,
  })
})

test('requires a valid ordering version in every returned next cursor', async () => {
  rpc.mockResolvedValue({ data: { ...page, nextCursor: row }, error: null })
  await expect(getParentAnnouncementFeed()).rejects.toThrow()
  rpc.mockResolvedValue({ data: { ...page, nextCursor: { ...row, orderVersion } }, error: null })
  expect((await getParentAnnouncementFeed()).nextCursor?.orderVersion).toBe(orderVersion)
})

test('rejects malformed response timestamps and source identities', async () => {
  rpc.mockResolvedValue({ data: { ...page, items: [{ ...row, source: 'private' }] }, error: null })
  await expect(getParentAnnouncementFeed()).rejects.toThrow()
  rpc.mockResolvedValue({ data: { ...page, asOf: 'tomorrow' }, error: null })
  await expect(getParentAnnouncementFeed()).rejects.toThrow()
})

test('does not expose unexpected personal fields from a response', async () => {
  rpc.mockResolvedValue({
    data: { ...page, items: [{ ...row, email: 'fixture@example.test' }] },
    error: null,
  })
  expect((await getParentAnnouncementFeed()).items[0]).not.toHaveProperty('email')
})

test('loads course filter choices separately from feed pagination', async () => {
  rpc.mockResolvedValue({ data: [{ id: courseId, name: 'Înot' }], error: null })
  expect(await getParentAnnouncementCourses()).toEqual([{ id: courseId, name: 'Înot' }])
  expect(rpc).toHaveBeenCalledWith('get_parent_announcement_courses')
})

test('marks only the accepted server snapshot and leaves monotonicity to the database', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  await expect(markParentAnnouncementsSeen(asOf, courseId)).resolves.toBeUndefined()
  expect(rpc).toHaveBeenCalledWith('mark_parent_announcements_seen', {
    p_as_of: asOf,
    p_expected_user_id: courseId,
  })
})

test.each(['feed', 'courses', 'visit'] as const)(
  'propagates %s errors for explicit retry',
  async (operation) => {
    const error = { message: 'Connection interrupted', code: '503' }
    rpc.mockResolvedValue({ data: null, error })
    const pending =
      operation === 'feed'
        ? getParentAnnouncementFeed()
        : operation === 'courses'
          ? getParentAnnouncementCourses()
          : markParentAnnouncementsSeen(asOf, courseId)
    await expect(pending).rejects.toEqual(error)
  },
)
