import { parsePushPayload } from './payload'
import {
  EMPTY_PUSH_STATE,
  PUSH_DISABLE_ERROR,
  PUSH_ERROR,
  type PushBinding,
  type PushPermission,
  type PushSession,
  type PushSnapshot,
  type PushStoredState,
} from './types'

interface PushDependencies {
  session(userId: string): Promise<PushSession>
  preferences(session: PushSession): Promise<{ enabled: boolean }>
  setEnabled(session: PushSession, enabled: boolean): Promise<unknown>
  register(
    session: PushSession,
    device: { bindingId: string; installationId: string; token: string },
  ): Promise<void>
  revoke(session: PushSession, bindingId: string): Promise<void>
  configure(input: {
    bindingId: string
  }): Promise<{ bindingId: string; installationId: string; token: string }>
  clear(): Promise<void>
  permission(): Promise<PushPermission>
  requestPermission(): Promise<PushPermission>
  read(): Promise<PushStoredState>
  write(state: PushStoredState): Promise<void>
  uuid(): string
}

export function createPushCoordinator(deps: PushDependencies) {
  let snapshot: PushSnapshot = {
    status: 'loading',
    busy: false,
    error: null,
    pendingDisable: false,
  }
  let version = 0
  let session: PushSession | null = null
  let binding: PushBinding | null = null
  let configuring: { session: PushSession; bindingId: string; version: number } | null = null
  let registeredToken: string | null = null
  let userId: string | null = null
  let queue = Promise.resolve()
  let restoring: { userId: string; version: number; promise: Promise<void> } | null = null
  const listeners = new Set<() => void>()
  const consumed = new Set<string>()

  function publish(next: Partial<PushSnapshot>) {
    snapshot = { ...snapshot, ...next }
    listeners.forEach((listener) => listener())
  }

  function serialize(work: () => Promise<void>) {
    const next = queue.then(work)
    queue = next.catch(() => undefined)
    return next
  }

  function current(expected: number) {
    return expected === version
  }

  function assertCurrent(expected: number) {
    if (!current(expected)) throw new Error('Push operation superseded')
  }

  async function storeBinding(next: PushBinding | null, expected: number) {
    const stored = await deps.read()
    assertCurrent(expected)
    await deps.write({ ...stored, binding: next })
    assertCurrent(expected)
    binding = next
  }

  async function configure(active: PushSession, bindingId: string, expected: number) {
    configuring = { session: active, bindingId, version: expected }
    const device = await deps.configure({ bindingId })
    assertCurrent(expected)
    if (device.bindingId !== bindingId || !device.token || !device.installationId)
      throw new Error('Push registration mismatch')
    await deps.register(active, device)
    assertCurrent(expected)
    registeredToken = device.token
    await storeBinding({ userId: active.userId, sessionId: active.sessionId, bindingId }, expected)
    configuring = null
    publish({ status: 'enabled', busy: false, error: null, pendingDisable: false })
  }

  async function fail(expected: number, disable = false) {
    if (configuring?.version === expected) {
      const target = configuring
      configuring = null
      void deps.revoke(target.session, target.bindingId).catch(() => undefined)
      const stored = await deps.read().catch(() => EMPTY_PUSH_STATE)
      if (current(expected) && stored.binding?.bindingId === target.bindingId)
        await deps.write({ ...stored, binding: null }).catch(() => undefined)
    }
    let cleared = true
    await deps.clear().catch(() => {
      cleared = false
    })
    if (!current(expected)) return
    binding = null
    publish({
      status: 'error',
      busy: false,
      error: disable
        ? cleared
          ? PUSH_DISABLE_ERROR
          : 'Nu am putut opri notificările pe acest telefon. Reîncearcă dezactivarea.'
        : PUSH_ERROR,
      pendingDisable: disable,
    })
  }

  function restore(nextUserId: string) {
    if (restoring?.userId === nextUserId && restoring.version === version) return restoring.promise
    const expected = ++version
    userId = nextUserId
    session = null
    binding = null
    registeredToken = null
    publish({ status: 'loading', busy: false, error: null })
    const promise = serialize(async () => {
      try {
        assertCurrent(expected)
        const active = await deps.session(nextUserId)
        assertCurrent(expected)
        session = active
        const stored = await deps.read()
        assertCurrent(expected)
        if (stored.pendingDisableUserId === nextUserId) {
          await deps.clear()
          assertCurrent(expected)
          await deps.setEnabled(active, false)
          assertCurrent(expected)
          await deps.write({ ...EMPTY_PUSH_STATE })
          assertCurrent(expected)
          publish({ status: 'disabled', busy: false, error: null, pendingDisable: false })
          return
        }
        const sameSession =
          stored.binding?.userId === active.userId && stored.binding.sessionId === active.sessionId
        if (!sameSession) {
          await deps.clear()
          assertCurrent(expected)
          await storeBinding(null, expected)
        }
        const preference = await deps.preferences(active)
        assertCurrent(expected)
        const permission = await deps.permission()
        assertCurrent(expected)
        if (!preference.enabled || permission !== 'granted' || !sameSession || !stored.binding) {
          await deps.clear()
          assertCurrent(expected)
          await storeBinding(null, expected)
          publish({
            status: permission === 'denied' ? 'denied' : 'disabled',
            busy: false,
            error: null,
            pendingDisable: false,
          })
          return
        }
        await configure(active, stored.binding.bindingId, expected)
      } catch {
        const stored = await deps.read().catch(() => EMPTY_PUSH_STATE)
        await fail(expected, stored.pendingDisableUserId === nextUserId)
      }
    })
    restoring = { userId: nextUserId, version: expected, promise }
    void promise.finally(() => {
      if (restoring?.promise === promise) restoring = null
    })
    return promise
  }

  function enable(nextUserId: string) {
    const expected = ++version
    userId = nextUserId
    binding = null
    publish({ busy: true, error: null })
    return serialize(async () => {
      try {
        assertCurrent(expected)
        const active = await deps.session(nextUserId)
        assertCurrent(expected)
        session = active
        const permission = await deps.requestPermission()
        assertCurrent(expected)
        if (permission !== 'granted') {
          await deps.clear()
          assertCurrent(expected)
          await storeBinding(null, expected)
          publish({ status: 'denied', busy: false, error: null, pendingDisable: false })
          return
        }
        await deps.setEnabled(active, true)
        assertCurrent(expected)
        const stored = await deps.read()
        assertCurrent(expected)
        await deps.write({ ...stored, binding: null, pendingDisableUserId: null })
        assertCurrent(expected)
        await configure(active, deps.uuid(), expected)
      } catch {
        await fail(expected)
      }
    })
  }

  function disable(nextUserId: string) {
    const expected = ++version
    userId = nextUserId
    revokeBindings()
    binding = null
    publish({ status: 'disabled', busy: true, error: null, pendingDisable: true })
    const savingIntent = deps.write({ binding: null, pendingDisableUserId: nextUserId })
    const clearing = deps.clear()
    void savingIntent.catch(() => undefined)
    void clearing.catch(() => undefined)
    return serialize(async () => {
      try {
        assertCurrent(expected)
        await savingIntent
        assertCurrent(expected)
        await clearing
        assertCurrent(expected)
        const active = await deps.session(nextUserId)
        assertCurrent(expected)
        session = active
        await deps.setEnabled(active, false)
        assertCurrent(expected)
        await deps.write({ ...EMPTY_PUSH_STATE })
        assertCurrent(expected)
        publish({ status: 'disabled', busy: false, error: null, pendingDisable: false })
      } catch {
        await fail(expected, true)
      }
    })
  }

  async function clearForSignOut() {
    ++version
    revokeBindings()
    userId = null
    session = null
    binding = null
    consumed.clear()
    publish({ status: 'disabled', busy: false, error: null, pendingDisable: false })
    const clearing = deps.clear()
    void serialize(async () => {
      const stored = await deps.read()
      await deps.write({ ...stored, binding: null })
    }).catch(() => undefined)
    await clearing
  }

  function revokeBindings() {
    const targets = new Map<string, PushSession>()
    if (session && binding) targets.set(binding.bindingId, session)
    if (configuring) targets.set(configuring.bindingId, configuring.session)
    configuring = null
    for (const [bindingId, active] of targets)
      void deps.revoke(active, bindingId).catch(() => undefined)
  }

  async function pauseForAuthentication() {
    const previousUserId = userId
    ++version
    userId = null
    session = null
    binding = null
    publish({ status: 'loading', busy: false, error: null, pendingDisable: false })
    await deps.clear()
    return async () => {
      if (previousUserId) await restore(previousUserId)
      else publish({ status: 'disabled', busy: false })
    }
  }

  async function refreshToken(token: string) {
    const expected = version
    const previousBinding = binding
    if (!previousBinding || snapshot.status !== 'enabled' || token === registeredToken) return
    await serialize(async () => {
      try {
        if (
          !current(expected) ||
          binding?.bindingId !== previousBinding.bindingId ||
          token === registeredToken
        )
          return
        const active = await deps.session(previousBinding.userId)
        assertCurrent(expected)
        if (active.sessionId !== previousBinding.sessionId) {
          await clearForSignOut()
          return
        }
        const preference = await deps.preferences(active)
        assertCurrent(expected)
        if (!preference.enabled) {
          await deps.clear()
          assertCurrent(expected)
          await storeBinding(null, expected)
          publish({ status: 'disabled', error: null, busy: false })
          return
        }
        const device = await deps.configure({ bindingId: previousBinding.bindingId })
        assertCurrent(expected)
        if (token !== device.token) return
        await deps.register(active, device)
        assertCurrent(expected)
        registeredToken = device.token
        session = active
      } catch {
        await fail(expected)
      }
    })
  }

  function authorizedPayload(value: unknown) {
    const payload = parsePushPayload(value)
    if (!payload || !binding || !session || snapshot.status !== 'enabled') return null
    return payload.bindingId === binding.bindingId &&
      binding.userId === session.userId &&
      binding.sessionId === session.sessionId
      ? payload
      : null
  }

  function consume(value: unknown) {
    const payload = authorizedPayload(value)
    if (!payload) return null
    const key = `${payload.bindingId}:${payload.eventId}`
    if (consumed.has(key)) return null
    consumed.add(key)
    if (consumed.size > 100) consumed.delete(consumed.values().next().value!)
    return payload
  }

  function authChanged(nextUserId: string | null, sessionId: string | null) {
    if ((userId && userId !== nextUserId) || (session && session.sessionId !== sessionId))
      void clearForSignOut().catch(() => undefined)
  }

  return {
    restore,
    enable,
    disable,
    clearForSignOut,
    pauseForAuthentication,
    refreshToken,
    consume,
    authorizedPayload,
    authChanged,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
