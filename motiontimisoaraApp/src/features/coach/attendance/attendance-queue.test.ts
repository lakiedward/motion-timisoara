import { describe, expect, it, vi } from 'vitest'
import { AttendanceError } from '@/api/attendance'
import { AttendanceQueue } from './attendance-queue'

const occurrenceId = '00000000-0000-4000-8000-000000000001'
const token = 'a'.repeat(32)
const result = { success: true as const, outcome: 'recorded' as const, childName: 'Copil Test' }

function fixture(initial: string | null = null) {
  let value = initial
  const storage = {
    get: vi.fn(async () => value),
    set: vi.fn(async (next: string) => {
      value = next
    }),
  }
  const send = vi.fn().mockResolvedValue(result)
  const confirmed = vi.fn()
  const queue = new AttendanceQueue('coach-a', storage, send, confirmed)
  return { queue, storage, send, confirmed, value: () => value }
}

async function idle(queue: AttendanceQueue) {
  await vi.waitFor(() => expect(queue.getSnapshot().syncing).toBe(false))
}

describe('persistent attendance queue', () => {
  it('persists before submission and deduplicates concurrent captures', async () => {
    const f = fixture()
    await Promise.all([
      f.queue.enqueue(occurrenceId, 'Înot · 8 septembrie', token),
      f.queue.enqueue(occurrenceId, 'Înot · 8 septembrie', token),
    ])
    expect(f.send).not.toHaveBeenCalled()
    expect(JSON.parse(f.value()!).entries).toHaveLength(1)
    f.queue.activate()
    await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1))
    await idle(f.queue)
    expect(f.storage.set.mock.invocationCallOrder[0]).toBeLessThan(
      f.send.mock.invocationCallOrder[0],
    )
    expect(f.confirmed).toHaveBeenCalledWith(occurrenceId)
    expect(f.value()).not.toContain(token)
  })

  it('restarts offline work with the same operation ID after a lost response', async () => {
    const f = fixture()
    f.send.mockRejectedValue(new AttendanceError('Offline', true))
    await f.queue.enqueue(occurrenceId, 'Înot', token)
    f.queue.activate()
    await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1))
    await idle(f.queue)
    const original = f.send.mock.calls[0][0]
    f.queue.deactivate()
    const restored = fixture(f.value())
    restored.queue.activate()
    await vi.waitFor(() => expect(restored.send).toHaveBeenCalledTimes(1))
    expect(restored.send).toHaveBeenCalledWith(original, 'coach-a')
    await idle(restored.queue)
    expect(restored.queue.getSnapshot().entries[0].state).toBe('confirmed')
  })

  it('retains definitive rejections without automatically resubmitting them', async () => {
    const f = fixture()
    f.send.mockRejectedValue(new AttendanceError('Nu este înscris', false, 'NOT_ENROLLED'))
    await f.queue.enqueue(occurrenceId, 'Înot', token)
    f.queue.activate()
    await vi.waitFor(() => expect(f.queue.getSnapshot().entries[0].state).toBe('rejected'))
    await f.queue.retry()
    expect(f.send).toHaveBeenCalledTimes(1)
    const restored = fixture(f.value())
    await restored.queue.load()
    expect(restored.queue.getSnapshot().entries[0].message).toBe('Nu este înscris')
  })

  it('replaces a rejected scan only on explicit rescan and submits a new request', async () => {
    const f = fixture()
    f.send.mockRejectedValueOnce(new AttendanceError('Nu este înscris', false, 'NOT_ENROLLED'))
    await f.queue.enqueue(occurrenceId, 'Înot', token)
    f.queue.activate()
    await vi.waitFor(() => expect(f.queue.getSnapshot().entries[0].state).toBe('rejected'))
    await idle(f.queue)
    const rejectedId = f.send.mock.calls[0][0].requestId
    await Promise.all([
      f.queue.enqueue(occurrenceId, 'Înot', token),
      f.queue.enqueue(occurrenceId, 'Înot', token),
    ])
    await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(2))
    await idle(f.queue)
    expect(f.send.mock.calls[1][0].requestId).not.toBe(rejectedId)
    expect(f.queue.getSnapshot().entries).toHaveLength(1)
    expect(f.queue.getSnapshot().entries[0].state).toBe('confirmed')
  })

  it('stops at an account change and preserves the remaining account-scoped work', async () => {
    const f = fixture()
    let resolve!: (value: typeof result) => void
    f.send.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    await f.queue.enqueue(occurrenceId, 'Înot', token)
    await f.queue.enqueue(occurrenceId, 'Înot', 'b'.repeat(32))
    f.queue.activate()
    await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1))
    f.queue.deactivate()
    resolve(result)
    await idle(f.queue)
    expect(f.send).toHaveBeenCalledTimes(1)
    expect(f.send.mock.calls[0][1]).toBe('coach-a')
    expect(f.queue.getSnapshot().entries[1].state).toBe('pending')
  })

  it('never replaces unreadable saved scans or transmits an unpersisted capture', async () => {
    const broken = fixture('{bad json')
    await expect(broken.queue.enqueue(occurrenceId, 'Înot', token)).rejects.toThrow()
    expect(broken.storage.set).not.toHaveBeenCalled()
    expect(broken.send).not.toHaveBeenCalled()
    const f = fixture()
    f.storage.set.mockRejectedValueOnce(new Error('Disk full'))
    await expect(f.queue.enqueue(occurrenceId, 'Înot', token)).rejects.toThrow('Disk full')
    f.queue.activate()
    await idle(f.queue)
    expect(f.send).not.toHaveBeenCalled()
  })

  it('retries the same request if confirmation cannot be saved locally', async () => {
    const f = fixture()
    await f.queue.enqueue(occurrenceId, 'Înot', token)
    f.storage.set.mockRejectedValueOnce(new Error('Disk full'))
    f.queue.activate()
    await vi.waitFor(() => expect(f.send).toHaveBeenCalledTimes(1))
    await idle(f.queue)
    expect(f.queue.getSnapshot().entries[0].state).toBe('pending')
    await f.queue.retry()
    expect(f.send.mock.calls[0]).toEqual(f.send.mock.calls[1])
  })
})
