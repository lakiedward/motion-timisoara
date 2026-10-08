import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createReverseCache } from './cache'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }))

const address = { address: 'Strada Vasile Goldiș 8', city: 'Timișoara', county: 'Timiș' }

beforeEach(() => {
  vi.resetModules()
  invoke.mockReset().mockResolvedValue({ data: { place: address }, error: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('a stalled Photon request resolves through the independent service after 1.5 seconds', async () => {
  const { geocoding } = await import('../geocoding')
  vi.useFakeTimers()
  let requestSignal: AbortSignal | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((_url, init) => {
      requestSignal = init.signal
      return new Promise(() => undefined)
    }),
  )
  const result = geocoding.reverse(45.7569, 21.2354)
  await vi.advanceTimersByTimeAsync(1500)
  expect(await result).toMatchObject({ ...address, lat: 45.7569, lng: 21.2354 })
  expect(requestSignal?.aborted).toBe(true)
  expect(invoke).toHaveBeenCalledWith(
    'location-reverse',
    expect.objectContaining({
      body: { lat: 45.7569, lng: 21.2354 },
    }),
  )
  expect(vi.getTimerCount()).toBe(0)
})

test('both stalled services stop after 6.5 seconds including a stalled invoke/auth', async () => {
  const { geocoding } = await import('../geocoding')
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => undefined)),
  )
  invoke.mockImplementation(() => new Promise(() => undefined))
  const result = expect(geocoding.reverse(45.75, 21.23)).rejects.toThrow('timed out')
  await vi.advanceTimersByTimeAsync(6500)
  await result
  expect(invoke.mock.calls[0][1].signal.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

test('cancellation during Photon does not start fallback', async () => {
  const { geocoding } = await import('../geocoding')
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => undefined)),
  )
  const controller = new AbortController()
  const result = expect(geocoding.reverse(45.75, 21.23, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
  controller.abort()
  await result
  expect(invoke).not.toHaveBeenCalled()
})

test('cancellation during fallback aborts its request and ignores late data', async () => {
  const { geocoding } = await import('../geocoding')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 503 })),
  )
  let started: () => void = () => undefined
  const called = new Promise<void>((resolve) => {
    started = resolve
  })
  invoke.mockImplementation(() => {
    started()
    return new Promise(() => undefined)
  })
  const controller = new AbortController()
  const result = expect(geocoding.reverse(45.75, 21.23, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
  await called
  controller.abort()
  await result
  expect(invoke.mock.calls[0][1].signal.aborted).toBe(true)
})

test('a sparse Photon result is completed by fallback and malformed fallback data is rejected', async () => {
  const { geocoding } = await import('../geocoding')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ features: [] }) })),
  )
  expect(await geocoding.reverse(45.75, 21.23)).toMatchObject(address)
  invoke.mockResolvedValue({ data: { place: { ...address, address: 12 } }, error: null })
  await expect(geocoding.reverse(45.76, 21.24)).rejects.toThrow('Invalid address response')
})

test('a repeated point reuses the successful address while a new point makes a new request', async () => {
  const { geocoding } = await import('../geocoding')
  const fetcher = vi.fn(async () => ({ ok: false, status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  await geocoding.reverse(45.75, 21.23)
  const cached = await geocoding.reverse(45.7500001, 21.2300001)
  expect(cached).toMatchObject({ ...address, lat: 45.7500001, lng: 21.2300001 })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(invoke).toHaveBeenCalledTimes(1)
  await geocoding.reverse(45.76, 21.24)
  expect(invoke).toHaveBeenCalledTimes(2)
})

test.each(['Zell am See', 'Radstadt'])(
  'independent fallback preserves the Austrian region for %s',
  async (city) => {
    const { geocoding } = await import('../geocoding')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    )
    invoke.mockResolvedValue({
      data: { place: { address: 'Stadtplatz 1', city, county: 'Salzburg' } },
      error: null,
    })
    expect(await geocoding.reverse(47.38, 13.46)).toMatchObject({
      address: 'Stadtplatz 1',
      city,
      county: 'Salzburg',
    })
  },
)

test('cache expires, has a capacity limit and never caches incomplete addresses', () => {
  vi.useFakeTimers()
  const cache = createReverseCache()
  const place = { ...address, id: 'place', label: address.address, detail: '', lat: 45, lng: 21 }
  cache.set(45, 21, { ...place, address: null })
  expect(cache.get(45, 21)).toBeNull()
  cache.set(45, 21, place)
  vi.advanceTimersByTime(15 * 60 * 1000)
  expect(cache.get(45, 21)).toBeNull()
  for (let i = 0; i < 129; i++) cache.set(45, 21 + i / 1000, place)
  expect(cache.get(45, 21)).toBeNull()
  expect(cache.get(45, 21.128)).not.toBeNull()
})

test('invalid coordinates and pre-cancelled cached lookups never call a service', async () => {
  const { geocoding } = await import('../geocoding')
  await expect(geocoding.reverse(NaN, 21)).rejects.toThrow('Invalid coordinates')
  const controller = new AbortController()
  controller.abort()
  await expect(geocoding.reverse(45, 21, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  })
  expect(invoke).not.toHaveBeenCalled()
})
