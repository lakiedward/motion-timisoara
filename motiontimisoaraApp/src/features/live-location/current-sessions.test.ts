import { buildSessionRows, formatHour, timeRange } from './current-sessions'

const occ = (id: string, course: string, start: string) => ({
  id,
  course_id: course,
  starts_at: start,
  ends_at: '2026-10-20T11:00:00Z',
})

test('hours are Romanian HH:MM without seconds', () => {
  expect(formatHour('2026-10-20T10:02:41Z')).toBe('13:02')
  expect(timeRange('2026-10-20T10:02:00Z', '2026-10-20T11:00:00Z')).toBe('13:02–14:00')
})

test('rows put sharing sessions first, then the most recent start', () => {
  const rows = buildSessionRows(
    [occ('o1', 'c1', '2026-10-20T10:30:00Z'), occ('o2', 'c2', '2026-10-20T10:00:00Z')],
    [
      { id: 'c1', name: 'Înot', coachName: 'Andrei' },
      { id: 'c2', name: 'Atletism', coachName: 'Maria' },
    ],
    [
      {
        sessionId: 's',
        campId: null,
        occurrenceId: 'o2',
        coachId: 'k',
        coachName: 'Maria Ionescu',
        title: 'Atletism',
        expiresAt: '2026-10-20T11:15:00Z',
      },
    ],
    Date.parse('2026-10-20T10:40:00Z'),
  )
  expect(rows.map((r) => [r.occurrence.id, r.sharing, r.coachName])).toEqual([
    ['o2', true, 'Maria Ionescu'],
    ['o1', false, 'Andrei'],
  ])
})

test('an expired sharing session no longer counts as sharing', () => {
  const rows = buildSessionRows(
    [occ('o1', 'c1', '2026-10-20T10:30:00Z')],
    [{ id: 'c1', name: 'Înot', coachName: null }],
    [
      {
        sessionId: 's',
        campId: null,
        occurrenceId: 'o1',
        coachId: 'k',
        coachName: 'A',
        title: 'Înot',
        expiresAt: '2026-10-20T10:35:00Z',
      },
    ],
    Date.parse('2026-10-20T10:40:00Z'),
  )
  expect(rows[0].sharing).toBe(false)
  expect(rows[0].coachName).toBeNull()
})
