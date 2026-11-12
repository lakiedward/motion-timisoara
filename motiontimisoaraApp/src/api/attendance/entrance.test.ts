import { vi } from 'vitest'

import { supabase } from '@/lib/supabase'
import {
  EntranceCodeError,
  entranceCheckin,
  getCoachEntranceCode,
  getEntranceCheckinOptions,
  rotateCoachEntranceCode,
} from './entrance'

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

const rpc = vi.mocked(supabase.rpc)
const TOKEN = '0123456789abcdef0123456789abcdef'

function answer(data: unknown, error: unknown = null) {
  rpc.mockResolvedValueOnce({ data, error } as never)
}

beforeEach(() => rpc.mockReset())

test('codul antrenorului se cere fără id, deci întotdeauna pe al contului conectat', async () => {
  answer({
    success: true,
    coachId: 'k1',
    coachName: 'Ana Pop',
    token: TOKEN,
    rotatedAt: '2026-11-12T09:00:00Z',
  })
  await expect(getCoachEntranceCode()).resolves.toEqual({
    coachId: 'k1',
    coachName: 'Ana Pop',
    token: TOKEN,
    rotatedAt: '2026-11-12T09:00:00Z',
  })
  expect(rpc).toHaveBeenCalledWith('get_coach_entrance_code', {})
})

test('regenerarea întoarce codul nou, iar refuzul serverului devine o eroare cu cod', async () => {
  answer({
    success: true,
    coachId: 'k1',
    coachName: 'Ana Pop',
    token: 'f'.repeat(32),
    rotatedAt: 'x',
  })
  await expect(rotateCoachEntranceCode()).resolves.toMatchObject({ token: 'f'.repeat(32) })
  expect(rpc).toHaveBeenCalledWith('rotate_coach_entrance_code', {})

  answer({ success: false, code: 'FORBIDDEN' })
  const error = await getCoachEntranceCode().catch((e: unknown) => e)
  expect(error).toBeInstanceOf(EntranceCodeError)
  expect((error as EntranceCodeError).code).toBe('FORBIDDEN')
})

test('opțiunile părintelui păstrează ordinea serverului și starea fiecărei ședințe', async () => {
  answer({
    success: true,
    coachName: 'Ana Pop',
    serverTime: '2026-11-12T15:50:00Z',
    options: [
      {
        occurrenceId: 'o1',
        courseId: 'c1',
        courseName: 'Înot',
        startsAt: '2026-11-12T16:00:00Z',
        endsAt: '2026-11-12T17:00:00Z',
        childId: 'ch1',
        childName: 'Maria',
        remainingSessions: 3,
        state: 'AVAILABLE',
      },
      {
        occurrenceId: 'o1',
        courseId: 'c1',
        courseName: 'Înot',
        startsAt: '2026-11-12T16:00:00Z',
        endsAt: '2026-11-12T17:00:00Z',
        childId: 'ch2',
        childName: 'Ion',
        remainingSessions: null,
        state: 'AMBIGUOUS_ENROLLMENT',
      },
    ],
  })
  const result = await getEntranceCheckinOptions(TOKEN)
  expect(rpc).toHaveBeenCalledWith('entrance_checkin_options', { p_token: TOKEN })
  expect(
    result.success && result.options.map((o) => [o.childName, o.state, o.remainingSessions]),
  ).toEqual([
    ['Maria', 'AVAILABLE', 3],
    ['Ion', 'AMBIGUOUS_ENROLLMENT', null],
  ])
})

test('în afara ferestrei, răspunsul poartă ora la care se deschide următoarea ședință', async () => {
  answer({
    success: false,
    code: 'OUTSIDE_WINDOW',
    coachName: 'Ana Pop',
    serverTime: '2026-11-12T10:00:00Z',
    nextOpensAt: '2026-11-12T15:45:00Z',
  })
  await expect(getEntranceCheckinOptions(TOKEN)).resolves.toEqual({
    success: false,
    code: 'OUTSIDE_WINDOW',
    coachName: 'Ana Pop',
    serverTime: '2026-11-12T10:00:00Z',
    nextOpensAt: '2026-11-12T15:45:00Z',
  })
})

test('o eroare de rețea se aruncă, ca ecranul să ofere reîncercarea', async () => {
  answer(null, { message: 'Failed to fetch' })
  await expect(getEntranceCheckinOptions(TOKEN)).rejects.toMatchObject({
    message: 'Failed to fetch',
  })
})

test('marcarea trimite id-ul cererii primit de la ecran și citește rezultatul', async () => {
  answer({
    success: true,
    outcome: 'duplicate',
    occurrenceId: 'o1',
    childId: 'ch1',
    childName: 'Maria',
    courseName: 'Înot',
    startsAt: '2026-11-12T16:00:00Z',
    attendanceStatus: 'PRESENT',
    remainingSessions: 3,
  })
  const result = await entranceCheckin({
    token: TOKEN,
    occurrenceId: 'o1',
    childId: 'ch1',
    requestId: 'r1',
  })
  expect(rpc).toHaveBeenCalledWith('entrance_checkin', {
    p_token: TOKEN,
    p_occurrence_id: 'o1',
    p_child_id: 'ch1',
    p_request_id: 'r1',
  })
  expect(result).toMatchObject({ success: true, outcome: 'duplicate', remainingSessions: 3 })

  answer({ success: false, code: 'MANUAL_OVERRIDE' })
  await expect(
    entranceCheckin({ token: TOKEN, occurrenceId: 'o1', childId: 'ch1', requestId: 'r2' }),
  ).resolves.toEqual({ success: false, code: 'MANUAL_OVERRIDE' })
})
