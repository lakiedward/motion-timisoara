import { attendanceEntries, bucharestDate, kindBreakdown } from './attendance-entries'

const curs = (id: string, startsAt: string | null, status = 'PRESENT') => ({
  id,
  child_id: 'c1',
  status,
  note: null,
  occurrence: startsAt ? { starts_at: startsAt, course: { name: 'Înot' } } : null,
})

const tabara = (id: string, arrivedAt: string) => ({
  id,
  child_id: 'c1',
  camp_id: 'k1',
  camp_title: '',
  period_start: '2026-08-10',
  period_end: '2026-08-14',
  arrived_at: arrivedAt,
  departed_at: null,
})

test('unește cursurile și taberele, cele mai recente primele', () => {
  const e = attendanceEntries(
    [curs('a', '2026-08-01T10:00:00Z') as never, curs('b', '2026-08-20T10:00:00Z') as never],
    [tabara('t', '2026-08-10T06:00:00Z')],
    null,
  )
  expect(e.map((x) => x.id)).toEqual(['b', 't', 'a'])
  expect(e[1]).toMatchObject({ kind: 'CAMP', present: true, title: 'Tabără' })
})

test('filtrul de perioadă se aplică după data sosirii la tabără', () => {
  const e = attendanceEntries(
    [curs('a', '2026-07-01T10:00:00Z') as never, curs('fara', null) as never],
    [tabara('t', '2026-08-10T06:00:00Z')],
    new Date('2026-08-01T00:00:00Z'),
  )
  expect(e.map((x) => x.id)).toEqual(['t'])
})

test('rezumatul pe tipuri respectă acordul la număr', () => {
  const e = attendanceEntries(
    [curs('a', '2026-08-01T10:00:00Z') as never],
    [tabara('t', '2026-08-10T06:00:00Z'), tabara('u', '2026-08-11T06:00:00Z')],
    null,
  )
  expect(kindBreakdown(e)).toBe('1 ședință de curs, 2 tabere')
  expect(kindBreakdown([])).toBe('')
})

const activitate = (id: string, status: 'PRESENT' | 'ABSENT', day = '2026-10-18') => ({
  id,
  child_id: 'c1',
  activity_id: 'x1',
  status,
  activity: { name: 'Ștafeta de toamnă', activity_date: day, start_time: '10:00:00' },
})

test('activitățile intră în istoric la ora de start din București', () => {
  const e = attendanceEntries([], [], null, [activitate('v', 'ABSENT')])
  expect(e[0]).toMatchObject({ kind: 'ACTIVITY', present: false, title: 'Ștafeta de toamnă' })
  expect(e[0].date?.toISOString()).toBe('2026-10-18T07:00:00.000Z')
  expect(bucharestDate('2026-12-01', '10:00:00').toISOString()).toBe('2026-12-01T08:00:00.000Z')
})

test('rezumatul numără și activitățile', () => {
  const e = attendanceEntries(
    [curs('a', '2026-08-01T10:00:00Z') as never],
    [tabara('t', '2026-08-10T06:00:00Z')],
    null,
    [activitate('v', 'PRESENT'), activitate('w', 'PRESENT', '2026-10-19')],
  )
  expect(kindBreakdown(e)).toBe('1 ședință de curs, 2 activități, 1 tabără')
})

test('o activitate ascunsă păstrează rândul cu titlu generic', () => {
  const e = attendanceEntries([], [], null, [{ ...activitate('v', 'PRESENT'), activity: null }])
  expect(e[0]).toMatchObject({ title: 'Activitate', date: null })
})
