import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPushCoordinator } from './coordinator'
import {
  EMPTY_PUSH_STATE,
  PUSH_DISABLE_ERROR,
  type PushSession,
  type PushStoredState,
} from './types'

const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'
const sessionId = '33333333-3333-4333-8333-333333333333'
const bindingId = '44444444-4444-4444-8444-444444444444'
const installationId = '55555555-5555-4555-8555-555555555555'
const active: PushSession = { userId: userA, sessionId, accessToken: 'session-a' }
const message = {
  eventId: '66666666-6666-4666-8666-666666666666',
  bindingId,
  entityId: userA,
  kind: 'attendance',
  path: '/account/attendance',
  title: 'Prezență înregistrată',
  body: 'Verifică prezența în cont.',
  expiresAt: String(Date.now() + 60_000),
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function fixture() {
  let stored: PushStoredState = structuredClone(EMPTY_PUSH_STATE)
  const deps = {
    session: vi.fn(async () => active),
    preferences: vi.fn(async () => ({ enabled: false })),
    setEnabled: vi.fn(async (): Promise<void> => undefined),
    register: vi.fn(async (): Promise<void> => undefined),
    revoke: vi.fn(async () => undefined),
    configure: vi.fn(async ({ bindingId: id }: { bindingId: string }) => ({
      bindingId: id,
      installationId,
      token: 'token-1',
    })),
    clear: vi.fn(async () => undefined),
    permission: vi.fn(async () => 'granted' as const),
    requestPermission: vi.fn(async () => 'granted' as 'granted' | 'denied'),
    read: vi.fn(async () => structuredClone(stored)),
    write: vi.fn(async (next: PushStoredState) => {
      stored = structuredClone(next)
    }),
    uuid: () => bindingId,
  }
  const coordinator = createPushCoordinator(deps)
  return {
    deps,
    coordinator,
    saved: () => stored,
    seed: (next: PushStoredState) => {
      stored = next
    },
  }
}

let f: ReturnType<typeof fixture>
beforeEach(() => {
  f = fixture()
})

describe('consent and restoration', () => {
  it('never asks permission or registers on first login even if global preference is enabled', async () => {
    f.deps.preferences.mockResolvedValue({ enabled: true })
    await f.coordinator.restore(userA)
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
    expect(f.deps.requestPermission).not.toHaveBeenCalled()
    expect(f.deps.configure).not.toHaveBeenCalled()
  })

  it('registers only after explicit permission and successful preference persistence', async () => {
    await f.coordinator.enable(userA)
    expect(f.deps.setEnabled).toHaveBeenCalledWith(active, true)
    expect(f.deps.register).toHaveBeenCalledWith(active, {
      bindingId,
      installationId,
      token: 'token-1',
    })
    expect(f.saved().binding).toEqual({ userId: userA, sessionId, bindingId })
    expect(f.coordinator.getSnapshot().status).toBe('enabled')
  })

  it('does not persist consent or register when Android permission is denied', async () => {
    f.deps.requestPermission.mockResolvedValue('denied')
    await f.coordinator.enable(userA)
    expect(f.coordinator.getSnapshot().status).toBe('denied')
    expect(f.deps.setEnabled).not.toHaveBeenCalled()
    expect(f.deps.register).not.toHaveBeenCalled()
  })

  it('restores only the same saved user and auth session, without asking permission', async () => {
    f.seed({ binding: { userId: userA, sessionId, bindingId }, pendingDisableUserId: null })
    f.deps.preferences.mockResolvedValue({ enabled: true })
    await f.coordinator.restore(userA)
    expect(f.coordinator.getSnapshot().status).toBe('enabled')
    expect(f.deps.requestPermission).not.toHaveBeenCalled()
  })

  it('rejects a saved binding from another account or an older session', async () => {
    f.seed({ binding: { userId: userA, sessionId: userB, bindingId }, pendingDisableUserId: null })
    f.deps.preferences.mockResolvedValue({ enabled: true })
    await f.coordinator.restore(userA)
    expect(f.saved().binding).toBeNull()
    expect(f.deps.configure).not.toHaveBeenCalled()
  })

  it('coalesces repeated restoration during StrictMode mounting', async () => {
    const pending = deferred<{ enabled: boolean }>()
    f.deps.preferences.mockReturnValue(pending.promise)
    const one = f.coordinator.restore(userA)
    const two = f.coordinator.restore(userA)
    expect(two).toBe(one)
    pending.resolve({ enabled: false })
    await Promise.all([one, two])
    expect(f.deps.session).toHaveBeenCalledTimes(1)
  })
})

describe('opt-out and account isolation', () => {
  it('does not overwrite a newer opt-out marker with an old failed-configure storage snapshot', async () => {
    const pending = deferred<PushStoredState>()
    f.deps.read.mockResolvedValueOnce({ ...EMPTY_PUSH_STATE }).mockReturnValueOnce(pending.promise)
    f.deps.configure.mockRejectedValueOnce(new Error('configuration failed'))
    const enabling = f.coordinator.enable(userA)
    await vi.waitFor(() => expect(f.deps.read).toHaveBeenCalledTimes(2))
    f.deps.setEnabled.mockRejectedValue(new Error('offline'))
    const disabling = f.coordinator.disable(userA)
    pending.resolve({
      binding: { userId: userA, sessionId, bindingId },
      pendingDisableUserId: null,
    })
    await Promise.all([enabling, disabling])
    expect(f.saved()).toEqual({ binding: null, pendingDisableUserId: userA })
  })

  it('revokes a configuring binding before its registration request has completed on logout', async () => {
    const pending = deferred<void>()
    f.deps.register.mockReturnValueOnce(pending.promise)
    const enabling = f.coordinator.enable(userA)
    await vi.waitFor(() => expect(f.deps.register).toHaveBeenCalled())
    await f.coordinator.clearForSignOut()
    expect(f.deps.revoke).toHaveBeenCalledWith(active, bindingId)
    pending.resolve()
    await enabling
    expect(f.saved().binding).toBeNull()
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
  })

  it('revokes an in-flight binding immediately when opt-out supersedes registration', async () => {
    const pending = deferred<void>()
    f.deps.register.mockReturnValueOnce(pending.promise)
    const enabling = f.coordinator.enable(userA)
    await vi.waitFor(() => expect(f.deps.register).toHaveBeenCalled())
    const disabling = f.coordinator.disable(userA)
    expect(f.deps.revoke).toHaveBeenCalledWith(active, bindingId)
    pending.resolve()
    await Promise.all([enabling, disabling])
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
  })

  it('persists opt-out even when native token cleanup rejects', async () => {
    await f.coordinator.enable(userA)
    f.deps.clear.mockRejectedValue(new Error('TOKEN_DELETE_FAILED'))
    await f.coordinator.disable(userA)
    expect(f.saved()).toEqual({ binding: null, pendingDisableUserId: userA })
    expect(f.coordinator.getSnapshot().pendingDisable).toBe(true)
    expect(f.coordinator.getSnapshot().error).toContain('Nu am putut opri')
    expect(f.deps.setEnabled).toHaveBeenCalledTimes(1)
  })

  it('persists opt-out before waiting for an unrelated in-flight network request', async () => {
    await f.coordinator.enable(userA)
    const pending = deferred<{ enabled: boolean }>()
    f.deps.preferences.mockReturnValue(pending.promise)
    const refreshing = f.coordinator.refreshToken('new-token')
    await vi.waitFor(() => expect(f.deps.preferences).toHaveBeenCalled())
    const disabling = f.coordinator.disable(userA)
    expect(f.saved()).toEqual({ binding: null, pendingDisableUserId: userA })
    pending.resolve({ enabled: true })
    await Promise.all([refreshing, disabling])
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
  })

  it('restores the previous session after an unsuccessful authentication attempt', async () => {
    await f.coordinator.enable(userA)
    f.deps.preferences.mockResolvedValue({ enabled: true })
    const resume = await f.coordinator.pauseForAuthentication()
    expect(f.coordinator.consume(message)).toBeNull()
    expect(f.saved().binding?.userId).toBe(userA)
    await resume()
    expect(f.coordinator.getSnapshot().status).toBe('enabled')
    expect(f.coordinator.consume(message)?.path).toBe('/account/attendance')
    expect(f.deps.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('clears native notifications immediately and retains an honest retry state while offline', async () => {
    await f.coordinator.enable(userA)
    f.deps.setEnabled.mockRejectedValue(new Error('offline'))
    const disabling = f.coordinator.disable(userA)
    expect(f.deps.clear).toHaveBeenCalled()
    expect(f.coordinator.consume(message)).toBeNull()
    await disabling
    expect(f.coordinator.getSnapshot()).toMatchObject({
      status: 'error',
      error: PUSH_DISABLE_ERROR,
      pendingDisable: true,
    })
    expect(f.saved()).toEqual({ binding: null, pendingDisableUserId: userA })
  })

  it('retries a persisted disable before any registration after app restart', async () => {
    f.seed({ binding: null, pendingDisableUserId: userA })
    await f.coordinator.restore(userA)
    expect(f.deps.setEnabled).toHaveBeenCalledWith(active, false)
    expect(f.deps.configure).not.toHaveBeenCalled()
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
  })

  it('does not allow an in-flight activation to reactivate after a rapid disable', async () => {
    const pending = deferred<void>()
    f.deps.setEnabled.mockImplementationOnce(() => pending.promise)
    const enabling = f.coordinator.enable(userA)
    await vi.waitFor(() => expect(f.deps.setEnabled).toHaveBeenCalledWith(active, true))
    const disabling = f.coordinator.disable(userA)
    pending.resolve()
    await Promise.all([enabling, disabling])
    expect(f.deps.configure).not.toHaveBeenCalled()
    expect(f.deps.setEnabled).toHaveBeenLastCalledWith(active, false)
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
  })

  it('clears before sign-out without waiting for a stalled network operation', async () => {
    const pending = deferred<void>()
    f.deps.setEnabled.mockImplementationOnce(() => pending.promise)
    const enabling = f.coordinator.enable(userA)
    await vi.waitFor(() => expect(f.deps.setEnabled).toHaveBeenCalled())
    await f.coordinator.clearForSignOut()
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
    pending.resolve()
    await enabling
    expect(f.deps.configure).not.toHaveBeenCalled()
  })

  it('does not preserve a stale configure result after a session switch', async () => {
    const pending = deferred<{ bindingId: string; installationId: string; token: string }>()
    f.deps.configure.mockReturnValueOnce(pending.promise)
    const enabling = f.coordinator.enable(userA)
    await vi.waitFor(() => expect(f.deps.configure).toHaveBeenCalled())
    f.coordinator.authChanged(userB, userB)
    pending.resolve({ bindingId, installationId, token: 'old-token' })
    await enabling
    expect(f.deps.register).not.toHaveBeenCalled()
    expect(f.coordinator.consume(message)).toBeNull()
  })

  it('ignores delayed token refresh after opt-out and never re-enables from registration events', async () => {
    await f.coordinator.enable(userA)
    await f.coordinator.disable(userA)
    f.deps.register.mockClear()
    f.deps.setEnabled.mockClear()
    await f.coordinator.refreshToken('later-token')
    expect(f.deps.register).not.toHaveBeenCalled()
    expect(f.deps.setEnabled).not.toHaveBeenCalled()
  })

  it('clears a binding when refreshed preferences show a global opt-out', async () => {
    await f.coordinator.enable(userA)
    await f.coordinator.refreshToken('later-token')
    expect(f.saved().binding).toBeNull()
    expect(f.coordinator.getSnapshot().status).toBe('disabled')
  })

  it('does not process the same registration token repeatedly', async () => {
    await f.coordinator.enable(userA)
    f.deps.register.mockClear()
    await f.coordinator.refreshToken('token-1')
    expect(f.deps.register).not.toHaveBeenCalled()
  })
})

it('routes a matching notification once across cold and warm duplicate events', async () => {
  expect(f.coordinator.consume(message)).toBeNull()
  await f.coordinator.enable(userA)
  expect(f.coordinator.consume({ ...message, bindingId: userB })).toBeNull()
  expect(f.coordinator.consume(message)?.path).toBe('/account/attendance')
  expect(f.coordinator.consume(message)).toBeNull()
  await f.coordinator.clearForSignOut()
  expect(f.coordinator.consume({ ...message, eventId: userB })).toBeNull()
})
