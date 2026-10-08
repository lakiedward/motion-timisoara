import { afterEach, expect, test, vi } from 'vitest'
import { geocodingRequest } from './request'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('a stalled request is aborted at its deadline even when fetch ignores cancellation', async () => {
  vi.useFakeTimers()
  let outgoing: AbortSignal | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, init) => {
      outgoing = init.signal
      return new Promise(() => undefined)
    }),
  )
  const result = expect(geocodingRequest('/reverse', 3000)).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(3000)
  await result
  expect(outgoing?.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

test('the deadline includes a stalled response body', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: () => new Promise(() => undefined) })),
  )
  const result = expect(geocodingRequest('/reverse', 5000)).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(5000)
  await result
  expect(vi.getTimerCount()).toBe(0)
})

test('successful responses clear the deadline and preserve HTTP errors', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: 'address' }) })
      .mockResolvedValueOnce({ ok: false, status: 503 }),
  )
  expect(await geocodingRequest('/reverse', 5000)).toEqual({ value: 'address' })
  await expect(geocodingRequest('/reverse', 5000)).rejects.toThrow('Geocoding 503')
  expect(vi.getTimerCount()).toBe(0)
})
