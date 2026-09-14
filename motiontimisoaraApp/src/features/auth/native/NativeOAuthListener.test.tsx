import { StrictMode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NativeOAuthListener } from './NativeOAuthListener'
import { GOOGLE_ERROR } from '@/api/auth-native/coordinator'
import { EMAIL_CALLBACK, type EmailResult } from '@/api/auth-native/email-coordinator'

type Result = { returnUrl?: string } | { error: string }
type UrlListener = (event: { url: string }) => void
type ResultListener = (result: Result) => void

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  restore: vi.fn(),
  receive: vi.fn(),
  subscribe: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  emailRestore: vi.fn(),
  emailReceive: vi.fn(),
  emailResults: new Set<(result: EmailResult) => void>(),
  urls: new Set<UrlListener>(),
  results: new Set<ResultListener>(),
  removals: [] as Array<ReturnType<typeof vi.fn>>,
  unsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
}))

vi.mock('@capacitor/app', () => ({
  App: { addListener: mocks.addListener, getLaunchUrl: mocks.getLaunchUrl },
}))
vi.mock('@/lib/platform', () => ({ isNative: mocks.native }))
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: mocks.success } }))
vi.mock('@/api/auth-native/email', () => ({
  nativeEmail: { restore: mocks.emailRestore, receive: mocks.emailReceive },
  onNativeEmailResult: (listener: (result: EmailResult) => void) => {
    mocks.emailResults.add(listener)
    return () => {
      mocks.emailResults.delete(listener)
    }
  },
}))
vi.mock('@/api/auth-native/google', () => ({
  nativeGoogle: { restore: mocks.restore, receive: mocks.receive },
  onNativeGoogleResult: mocks.subscribe,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

function mount(strict = false) {
  const content = (
    <MemoryRouter initialEntries={['/login']}>
      <NativeOAuthListener />
      <Location />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{content}</StrictMode> : content)
}

async function settle() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.urls.clear()
  mocks.results.clear()
  mocks.emailResults.clear()
  mocks.emailRestore.mockResolvedValue(undefined)
  mocks.emailReceive.mockResolvedValue(false)
  mocks.removals.length = 0
  mocks.unsubscribes.length = 0
  mocks.native.mockReturnValue(true)
  mocks.getLaunchUrl.mockResolvedValue(undefined)
  mocks.restore.mockResolvedValue(undefined)
  mocks.receive.mockResolvedValue(false)
  mocks.addListener.mockImplementation(async (name: string, listener: UrlListener) => {
    expect(name).toBe('appUrlOpen')
    mocks.urls.add(listener)
    const remove = vi.fn(async () => {
      mocks.urls.delete(listener)
    })
    mocks.removals.push(remove)
    return { remove }
  })
  mocks.subscribe.mockImplementation((listener: ResultListener) => {
    mocks.results.add(listener)
    const unsubscribe = vi.fn(() => {
      mocks.results.delete(listener)
    })
    mocks.unsubscribes.push(unsubscribe)
    return unsubscribe
  })
})

afterEach(() => {
  cleanup()
})

describe('native OAuth listener lifecycle', () => {
  it.each(['recovery', 'signup'] as const)(
    'routes verified email %s to its fixed destination',
    async (kind) => {
      mount()
      await settle()
      await act(async () => {
        mocks.emailResults.forEach((listener) => listener({ kind }))
      })
      expect(screen.getByTestId('location')).toHaveTextContent(
        kind === 'recovery' ? '/reset-password' : '/login',
      )
    },
  )

  it('shows an invalid route for rejected or repeated email links', async () => {
    mount()
    await settle()
    await act(async () => {
      mocks.emailResults.forEach((listener) => listener({ error: 'Invalid link' }))
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/reset-password?invalid=1')
    expect(mocks.error).toHaveBeenCalledWith('Invalid link')
  })

  it('handles a cold email URL through the email coordinator only', async () => {
    mocks.getLaunchUrl.mockResolvedValue({ url: EMAIL_CALLBACK + '?nonce=n&code=c' })
    mount()
    await settle()
    expect(mocks.emailReceive).toHaveBeenCalledExactlyOnceWith(EMAIL_CALLBACK + '?nonce=n&code=c')
    expect(mocks.receive).not.toHaveBeenCalled()
  })

  it('deduplicates the initial OS event and launch URL, while allowing a later replay to be rejected', async () => {
    const launch = deferred<{ url: string }>()
    mocks.getLaunchUrl.mockReturnValue(launch.promise)
    mount()
    await waitFor(() => expect(mocks.getLaunchUrl).toHaveBeenCalledOnce())
    const url = EMAIL_CALLBACK + '?nonce=n&code=c'
    await act(async () => {
      mocks.urls.forEach((listener) => listener({ url }))
      launch.resolve({ url })
    })
    expect(mocks.emailReceive).toHaveBeenCalledOnce()
    await act(async () => {
      mocks.urls.forEach((listener) => listener({ url }))
    })
    expect(mocks.emailReceive).toHaveBeenCalledTimes(2)
  })
  it('subscribes before restoring state and reading the cold-start URL', async () => {
    const ready = deferred<{ remove: () => Promise<void> }>()
    const remove = vi.fn(async () => undefined)
    mocks.addListener.mockReturnValue(ready.promise)
    mocks.getLaunchUrl.mockResolvedValue({
      url: 'com.motiontimisoara.app://auth/callback?code=cold',
    })
    mount()
    expect(mocks.subscribe).toHaveBeenCalledOnce()
    expect(mocks.addListener).toHaveBeenCalledWith('appUrlOpen', expect.any(Function))
    expect(mocks.restore).not.toHaveBeenCalled()
    expect(mocks.getLaunchUrl).not.toHaveBeenCalled()
    await act(async () => {
      ready.resolve({ remove })
    })
    expect(mocks.restore).toHaveBeenCalledOnce()
    expect(mocks.getLaunchUrl).toHaveBeenCalledOnce()
    expect(mocks.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.addListener.mock.invocationCallOrder[0],
    )
    expect(mocks.restore.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getLaunchUrl.mock.invocationCallOrder[0],
    )
    expect(mocks.receive).toHaveBeenCalledExactlyOnceWith(
      'com.motiontimisoara.app://auth/callback?code=cold',
    )
  })

  it('forwards foreground URL events to the coordinator', async () => {
    mount()
    await settle()
    await act(async () => {
      mocks.urls.forEach((listener) =>
        listener({ url: 'com.motiontimisoara.app://auth/callback?code=warm' }),
      )
    })
    expect(mocks.receive).toHaveBeenCalledExactlyOnceWith(
      'com.motiontimisoara.app://auth/callback?code=warm',
    )
  })

  it('keeps exactly one active listener under StrictMode and removes all listeners on unmount', async () => {
    const view = mount(true)
    await settle()
    expect(mocks.urls.size).toBe(1)
    expect(mocks.results.size).toBe(1)
    expect(mocks.addListener).toHaveBeenCalledTimes(2)
    expect(mocks.removals[0]).toHaveBeenCalledOnce()
    expect(mocks.unsubscribes[0]).toHaveBeenCalledOnce()
    view.unmount()
    await settle()
    expect(mocks.urls.size).toBe(0)
    expect(mocks.results.size).toBe(0)
    mocks.removals.forEach((remove) => expect(remove).toHaveBeenCalledOnce())
    mocks.unsubscribes.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalledOnce())
  })

  it('removes a listener whose registration completes after unmount without reading the launch URL', async () => {
    const ready = deferred<{ remove: () => Promise<void> }>()
    const remove = vi.fn(async () => undefined)
    mocks.addListener.mockReturnValue(ready.promise)
    const view = mount()
    view.unmount()
    await act(async () => {
      ready.resolve({ remove })
    })
    expect(remove).toHaveBeenCalledOnce()
    expect(mocks.restore).not.toHaveBeenCalled()
    expect(mocks.getLaunchUrl).not.toHaveBeenCalled()
    expect(mocks.receive).not.toHaveBeenCalled()
  })

  it('does not consume a cold callback returned after unmount', async () => {
    const launch = deferred<{ url: string }>()
    mocks.getLaunchUrl.mockReturnValue(launch.promise)
    const view = mount()
    await waitFor(() => expect(mocks.getLaunchUrl).toHaveBeenCalledOnce())
    view.unmount()
    await act(async () => {
      launch.resolve({ url: 'com.motiontimisoara.app://auth/callback?code=late' })
    })
    expect(mocks.receive).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('does not consume callbacks when restoration finishes after unmount', async () => {
    const restoring = deferred<void>()
    mocks.restore.mockReturnValue(restoring.promise)
    mocks.getLaunchUrl.mockResolvedValue({
      url: 'com.motiontimisoara.app://auth/callback?code=late',
    })
    const view = mount()
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce())
    view.unmount()
    await act(async () => {
      restoring.resolve()
    })
    expect(mocks.receive).not.toHaveBeenCalled()
    expect(mocks.results.size).toBe(0)
  })

  it('navigates successful authentication to the profile callback with its local destination', async () => {
    mount()
    await settle()
    await act(async () => {
      Array.from(mocks.results).forEach((listener) =>
        listener({ returnUrl: '/account/checkout?course=42' }),
      )
    })
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/auth/callback?returnUrl=%2Faccount%2Fcheckout%3Fcourse%3D42',
    )
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('navigates successful authentication without a return URL to the profile callback', async () => {
    mount()
    await settle()
    await act(async () => {
      Array.from(mocks.results).forEach((listener) => listener({}))
    })
    expect(screen.getByTestId('location')).toHaveTextContent('/auth/callback')
    expect(screen.getByTestId('location')).not.toHaveTextContent('returnUrl')
  })

  it('reports coordinator failure without navigating away from login', async () => {
    mount()
    await settle()
    await act(async () => {
      mocks.results.forEach((listener) => listener({ error: GOOGLE_ERROR }))
    })
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(GOOGLE_ERROR)
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('reports a rejected callback processor with a safe error', async () => {
    mocks.receive.mockRejectedValue(new Error('private callback details'))
    mount()
    await settle()
    await act(async () => {
      mocks.urls.forEach((listener) => listener({ url: 'com.motiontimisoara.app://auth/callback' }))
    })
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(GOOGLE_ERROR)
  })

  it('does not publish a late callback error after unmount', async () => {
    let reject!: (error: Error) => void
    mocks.receive.mockReturnValue(
      new Promise<boolean>((_resolve, fail) => {
        reject = fail
      }),
    )
    const view = mount()
    await settle()
    await act(async () => {
      mocks.urls.forEach((listener) => listener({ url: 'com.motiontimisoara.app://auth/callback' }))
    })
    view.unmount()
    await act(async () => {
      reject(new Error('late callback failure'))
    })
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('reports initialization failure without attempting a callback', async () => {
    mocks.restore.mockRejectedValue(new Error('private storage details'))
    mount()
    await settle()
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(GOOGLE_ERROR)
    expect(mocks.getLaunchUrl).not.toHaveBeenCalled()
    expect(mocks.receive).not.toHaveBeenCalled()
  })

  it('handles rejected listener registration once and safely cleans up the rejected registration', async () => {
    mocks.addListener.mockRejectedValue(new Error('native registration failed'))
    const view = mount()
    await settle()
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(GOOGLE_ERROR)
    expect(mocks.restore).not.toHaveBeenCalled()
    view.unmount()
    await settle()
    expect(mocks.results.size).toBe(0)
    expect(mocks.error).toHaveBeenCalledOnce()
  })

  it('contains native listener removal failures during cleanup', async () => {
    const remove = vi.fn().mockRejectedValue(new Error('native listener already removed'))
    mocks.addListener.mockResolvedValue({ remove })
    const view = mount()
    await settle()
    view.unmount()
    await settle()
    expect(remove).toHaveBeenCalledOnce()
    expect(mocks.results.size).toBe(0)
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('does not install native listeners or touch native state on web', async () => {
    mocks.native.mockReturnValue(false)
    mount()
    await settle()
    expect(mocks.addListener).not.toHaveBeenCalled()
    expect(mocks.subscribe).not.toHaveBeenCalled()
    expect(mocks.restore).not.toHaveBeenCalled()
    expect(mocks.getLaunchUrl).not.toHaveBeenCalled()
  })
})
