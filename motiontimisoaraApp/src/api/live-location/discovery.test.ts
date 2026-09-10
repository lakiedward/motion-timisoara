import { beforeEach, expect, test, vi } from 'vitest'
import {
  getActiveLocationSessions,
  getCampParticipants,
  recordCampParticipation,
} from './discovery'
import { LocationError } from './transport'

const mocks = vi.hoisted(() => ({ token: vi.fn(), send: vi.fn() }))
vi.mock('./transport', async (original) => ({
  ...(await original<typeof import('./transport')>()),
  locationAccessToken: mocks.token,
  sendLocationPayload: mocks.send,
}))

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const location = {
  sessionId: id,
  campId: id,
  occurrenceId: null,
  coachId: id,
  coachName: 'Antrenor',
  title: 'Tabără',
  expiresAt: '2026-09-11T00:00:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.token.mockResolvedValue('session-token')
})

test('discovery retains only metadata and rejects ambiguous camp/course targets', async () => {
  mocks.send.mockResolvedValue({ success: true, sessions: [{ ...location, latitude: 45 }] })
  expect(await getActiveLocationSessions('parent')).toEqual([location])
  mocks.send.mockResolvedValue({ success: true, sessions: [{ ...location, occurrenceId: id }] })
  await expect(getActiveLocationSessions('parent')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
  mocks.send.mockResolvedValue({ success: true })
  await expect(getActiveLocationSessions('parent')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})

test('an account change while discovery is pending discards the response', async () => {
  mocks.send.mockResolvedValue({ success: true, sessions: [location] })
  mocks.token
    .mockResolvedValueOnce('old-token')
    .mockRejectedValueOnce(new LocationError('UNAUTHORIZED', 'Account changed'))
  await expect(getActiveLocationSessions('old-parent')).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  })
})

test('attendance sends only the selected enrollment and distinguishes malformed results from empty', async () => {
  mocks.send.mockResolvedValue({ success: true })
  await recordCampParticipation('arrive', id, id, 'coach')
  expect(mocks.send).toHaveBeenCalledWith(
    { action: 'arrive', campId: id, enrollmentId: id },
    'session-token',
  )
  await expect(getCampParticipants(id, 'coach')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  const data = {
    participants: [],
    startsAt: '2026-09-10T00:00:00Z',
    endsAt: '2026-09-12T00:00:00Z',
    canShare: false,
  }
  mocks.send.mockResolvedValue({ success: true, ...data })
  expect(await getCampParticipants(id, 'club')).toEqual(data)
})
