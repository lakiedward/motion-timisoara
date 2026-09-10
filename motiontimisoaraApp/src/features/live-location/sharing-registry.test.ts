import { describe, expect, it, vi } from 'vitest'
import { SharingRegistry } from './sharing-registry'
import { SharingController } from './sharing-controller'

describe('cleanup across account changes', () => {
  it('retains failed cleanup from a previous account and notifies the current UI until retry succeeds', async () => {
    const remoteStop = vi.fn(async () => undefined)
    const registry = new SharingRegistry(
      () =>
        new SharingController({
          request: async () => ({
            success: true,
            sessionId: 'session',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          }),
          makeStop: async () => remoteStop,
          capture: async () => async () => undefined,
        }),
    )
    const changed = vi.fn()
    registry.subscribe(changed)
    const coach = registry.forActor('coach')
    await coach.start('occurrence')
    const anonymous = registry.forActor(null)
    remoteStop.mockRejectedValueOnce(new Error('offline'))
    await coach.stop()
    expect(registry.pendingExcept(anonymous)).toEqual([coach])
    expect(coach.getSnapshot()).toMatchObject({ active: null, needsStopRetry: true })
    const oldVersion = registry.getSnapshot()
    await registry.pendingExcept(anonymous)[0].stop()
    expect(registry.pendingExcept(anonymous)).toEqual([])
    expect(registry.getSnapshot()).toBeGreaterThan(oldVersion)
    expect(changed).toHaveBeenCalled()
    expect(registry.forActor('coach')).toBe(coach)
  })
})
