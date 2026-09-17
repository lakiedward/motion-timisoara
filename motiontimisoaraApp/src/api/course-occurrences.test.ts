import { beforeEach, expect, test, vi } from 'vitest'

import { regenerateCourseOccurrences } from './course-occurrences'

type OccurrenceRow = { id: string; starts_at: string }

let future: OccurrenceRow[] = []
let attendance: { occurrence_id: string }[] = []
let inserted: unknown[] = []
let deletedIds: string[] = []
let attendanceError: { message: string } | null = null

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'course_occurrences') {
        return {
          select: () => ({
            eq: () => ({
              gt: () => Promise.resolve({ data: future, error: null }),
            }),
          }),
          insert: (rows: unknown[]) => {
            inserted = rows
            return Promise.resolve({ error: null })
          },
          delete: () => ({
            in: (_column: string, ids: string[]) => {
              deletedIds = ids
              return Promise.resolve({ error: null })
            },
          }),
        }
      }
      return {
        select: () => ({
          in: () => Promise.resolve({ data: attendance, error: attendanceError }),
        }),
      }
    },
  },
}))

const RULE = JSON.stringify({
  daySchedules: { '1': { start: '18:00', end: '19:00' } },
})

beforeEach(() => {
  future = []
  attendance = []
  inserted = []
  deletedIds = []
  attendanceError = null
})

test('inserts generated future slots when the course has none', async () => {
  const count = await regenerateCourseOccurrences(
    'course-1',
    RULE,
    new Date('2026-09-17T09:00:00.000Z'),
  )
  expect(count).toBe(8)
  expect(inserted).toHaveLength(8)
  expect(deletedIds).toEqual([])
  expect(inserted[0]).toMatchObject({
    course_id: 'course-1',
    starts_at: '2026-09-21T15:00:00.000Z',
    ends_at: '2026-09-21T16:00:00.000Z',
  })
})

test('keeps attended future sessions and only removes obsolete unattended ones', async () => {
  future = [
    { id: 'keep', starts_at: '2026-09-22T15:00:00.000Z' },
    { id: 'drop', starts_at: '2026-09-24T15:00:00.000Z' },
    { id: 'same', starts_at: '2026-09-21T15:00:00.000Z' },
  ]
  attendance = [{ occurrence_id: 'keep' }]

  await regenerateCourseOccurrences('course-1', RULE, new Date('2026-09-17T09:00:00.000Z'))

  expect(deletedIds).toEqual(['drop'])
  expect(
    inserted.some((row) => (row as { starts_at: string }).starts_at === '2026-09-21T15:00:00.000Z'),
  ).toBe(false)
  expect(
    inserted.some((row) => (row as { starts_at: string }).starts_at === '2026-09-22T15:00:00.000Z'),
  ).toBe(false)
  expect(
    inserted.some((row) => (row as { starts_at: string }).starts_at === '2026-09-28T15:00:00.000Z'),
  ).toBe(true)
})

test('does not delete when attendance cannot be read', async () => {
  future = [{ id: 'maybe', starts_at: '2026-09-24T15:00:00.000Z' }]
  attendanceError = { message: 'permission denied' }
  await expect(
    regenerateCourseOccurrences('course-1', RULE, new Date('2026-09-17T09:00:00.000Z')),
  ).rejects.toMatchObject({ message: 'permission denied' })
  expect(deletedIds).toEqual([])
})
