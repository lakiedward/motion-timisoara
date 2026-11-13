import type { AdminSession } from '@/api/attendance/admin-sessions'
import { currentSession } from './current-session'

const at = (iso: string) => Date.parse(iso)

function session(id: string, startsAt: string, endsAt: string): AdminSession {
  return {
    id,
    startsAt,
    endsAt,
    courseId: 'c',
    courseName: 'Înot',
    locationName: null,
    sportId: null,
    sportName: null,
    coachName: null,
    organizerKey: 'c',
    organizerKind: 'coach',
    organizerName: 'Înot',
    enrolledCount: 1,
    markedCount: 0,
  }
}

const morning = session('a', '2026-11-13T08:00:00Z', '2026-11-13T09:00:00Z')
const noon = session('b', '2026-11-13T10:00:00Z', '2026-11-13T11:00:00Z')

describe('currentSession', () => {
  it('returns nothing more than 15 minutes before the start', () => {
    expect(currentSession([morning], at('2026-11-13T07:44:00Z'))).toBeNull()
  })

  it('returns the session from 15 minutes before the start until the end', () => {
    expect(currentSession([morning], at('2026-11-13T07:45:00Z'))?.id).toBe('a')
    expect(currentSession([morning], at('2026-11-13T08:59:00Z'))?.id).toBe('a')
  })

  it('returns nothing once the session has ended', () => {
    expect(currentSession([morning, noon], at('2026-11-13T09:00:00Z'))).toBeNull()
  })

  it('prefers the earliest of overlapping sessions', () => {
    const overlap = session('c', '2026-11-13T08:30:00Z', '2026-11-13T09:30:00Z')
    expect(currentSession([overlap, morning], at('2026-11-13T08:40:00Z'))?.id).toBe('a')
  })
})
