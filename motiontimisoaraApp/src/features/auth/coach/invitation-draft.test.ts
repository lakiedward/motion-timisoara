import { Preferences } from '@capacitor/preferences'
import { isNative } from '@/lib/platform'
import {
  clearCoachInvitationDraft,
  COACH_DRAFT_LIFETIME_MS,
  readCoachInvitationDraft,
  saveCoachInvitationDraft,
} from './invitation-draft'

const nativeStorage = new Map<string, string>()
vi.mock('@/lib/platform', () => ({ isNative: vi.fn() }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: nativeStorage.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      nativeStorage.set(key, value)
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      nativeStorage.delete(key)
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  sessionStorage.clear()
  nativeStorage.clear()
  vi.mocked(isNative).mockReturnValue(false)
})
afterEach(() => vi.useRealTimers())

test.each([false, true])(
  'stores only the bounded invitation and timestamp on native=%s',
  async (native) => {
    vi.mocked(isNative).mockReturnValue(native)
    await saveCoachInvitationDraft('  VALID-INVITE  ')
    expect(await readCoachInvitationDraft()).toBe('VALID-INVITE')
    const stored = native
      ? [...nativeStorage.values()][0]
      : sessionStorage.getItem(sessionStorage.key(0)!)
    expect(JSON.parse(stored!)).toEqual({ invitationCode: 'VALID-INVITE', createdAt: Date.now() })
    expect(Preferences.set).toHaveBeenCalledTimes(native ? 1 : 0)
    await clearCoachInvitationDraft()
    expect(await readCoachInvitationDraft()).toBeNull()
  },
)

test.each([false, true])(
  'expires and removes the draft exactly at its TTL on native=%s',
  async (native) => {
    vi.mocked(isNative).mockReturnValue(native)
    await saveCoachInvitationDraft('VALID-INVITE')
    vi.setSystemTime(Date.now() + COACH_DRAFT_LIFETIME_MS)
    expect(await readCoachInvitationDraft()).toBeNull()
    expect(native ? nativeStorage.size : sessionStorage.length).toBe(0)
  },
)

test('a future timestamp cannot extend a draft after the clock moves backwards', async () => {
  await saveCoachInvitationDraft('VALID-INVITE')
  vi.setSystemTime(Date.now() - 1)
  expect(await readCoachInvitationDraft()).toBeNull()
  expect(sessionStorage.length).toBe(0)
})

test.each(['{', 'null', '[]', '{"invitationCode":42,"createdAt":1}'])(
  'removes malformed persisted draft %s',
  async (value) => {
    sessionStorage.setItem('motion-coach-invitation-draft', value)
    expect(await readCoachInvitationDraft()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  },
)

test.each(['tiny', 'a'.repeat(129)])('never persists an invalid invitation', async (code) => {
  await expect(saveCoachInvitationDraft(code)).rejects.toThrow('Invalid invitation draft')
  expect(sessionStorage.length).toBe(0)
})
