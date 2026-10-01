import { StrictMode, useRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { revealNativeInput } from './native-focus'
import { useNativeKeyboardViewport } from './useNativeKeyboardViewport'

vi.mock('./native-focus', () => ({ revealNativeInput: vi.fn() }))

const frames = new Map<number, FrameRequestCallback>()
let frameId = 0
let resize: ResizeObserverCallback
const disconnect = vi.fn()
const viewport = new EventTarget()

function Harness() {
  const contentRef = useRef<HTMLElement>(null)
  const open = useNativeKeyboardViewport(contentRef)
  return (
    <>
      <main ref={contentRef}>
        <input aria-label="Email" />
      </main>
      <nav hidden={open}>Tabs</nav>
    </>
  )
}

function keyboardEvent(name: string, keyboardHeight?: number) {
  act(() => window.dispatchEvent(Object.assign(new Event(name), { keyboardHeight })))
}

function flushFrames() {
  act(() => {
    for (const [id, callback] of [...frames]) {
      frames.delete(id)
      callback(0)
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  frames.clear()
  frameId = 0
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  vi.stubGlobal('visualViewport', viewport)
})

afterEach(() => vi.unstubAllGlobals())

test('real native event properties release tabs until keyboardDidHide', () => {
  render(<Harness />)
  keyboardEvent('keyboardWillShow', 447)
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  flushFrames()
  expect(revealNativeInput).toHaveBeenLastCalledWith(screen.getByRole('main'), true)
  keyboardEvent('keyboardWillHide')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  keyboardEvent('keyboardDidHide')
  expect(screen.getByRole('navigation')).toBeVisible()
  flushFrames()
  expect(revealNativeInput).toHaveBeenLastCalledWith(screen.getByRole('main'), false)
})

test('zero-height keyboard events keep tabs available', () => {
  render(<Harness />)
  keyboardEvent('keyboardDidShow', 0)
  expect(screen.getByRole('navigation')).toBeVisible()
})

test('focus, native show and actual viewport changes coalesce into one settled reveal', () => {
  render(<Harness />)
  act(() => screen.getByLabelText('Email').focus())
  keyboardEvent('keyboardDidShow', 447)
  act(() => {
    window.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('resize'))
    resize([], {} as ResizeObserver)
  })
  expect(frames.size).toBe(1)
  flushFrames()
  expect(revealNativeInput).toHaveBeenCalledOnce()
})

test('validation text inserted without a main-height change schedules reveal', async () => {
  render(<Harness />)
  keyboardEvent('keyboardDidShow', 447)
  flushFrames()
  vi.mocked(revealNativeInput).mockClear()
  await act(async () => {
    const error = document.createElement('p')
    error.textContent = 'Email invalid'
    screen.getByRole('main').append(error)
  })
  flushFrames()
  expect(revealNativeInput).toHaveBeenCalledOnce()
})

test('StrictMode unmount cancels pending frames and removes all event sources', () => {
  const view = render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  )
  keyboardEvent('keyboardDidShow', 447)
  expect(frames.size).toBe(1)
  view.unmount()
  expect(frames.size).toBe(0)
  expect(disconnect).toHaveBeenCalledTimes(2)
  keyboardEvent('keyboardDidShow', 447)
  window.dispatchEvent(new Event('resize'))
  viewport.dispatchEvent(new Event('scroll'))
  document.dispatchEvent(new Event('focusin'))
  expect(frames.size).toBe(0)
  expect(revealNativeInput).not.toHaveBeenCalled()
})
