import { afterEach, expect, test, vi } from 'vitest'
import { geocodingRequest } from './request'
import { geocoding } from '../geocoding'

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

test('caller cancellation stops the lookup without starting a fallback', async () => {
  vi.useFakeTimers()
  const fetchRequest = vi.fn(() => new Promise(() => undefined))
  vi.stubGlobal('fetch', fetchRequest)
  const controller = new AbortController()
  const result = expect(geocoding.reverse(45.75, 21.23, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
  controller.abort()
  await result
  expect(fetchRequest).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test('a stalled house lookup falls back and resolves an address after three seconds', async () => {
  vi.useFakeTimers()
  const fetchRequest = vi
    .fn()
    .mockImplementationOnce(() => new Promise(() => undefined))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              street: 'Bulevardul Take Ionescu',
              housenumber: '8',
              city: 'Timișoara',
              state: 'Timiș',
            },
            geometry: { coordinates: [21.23, 45.75] },
          },
        ],
      }),
    })
  vi.stubGlobal('fetch', fetchRequest)
  const result = geocoding.reverse(45.75, 21.23)
  await vi.advanceTimersByTimeAsync(3000)
  expect(await result).toMatchObject({
    address: 'Bulevardul Take Ionescu 8',
    city: 'Timișoara',
    county: 'Timiș',
  })
  expect(fetchRequest).toHaveBeenCalledTimes(2)
  expect(fetchRequest.mock.calls[1][0]).not.toContain('layer=house')
  expect(vi.getTimerCount()).toBe(0)
})

test('two stalled endpoints stop after eight seconds instead of leaving the form pending', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => undefined)),
  )
  const result = expect(geocoding.reverse(45.75, 21.23)).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(8000)
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
