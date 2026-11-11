import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AttendanceScanner } from './AttendanceScanner'
import { AttendanceContext } from './attendance-context'
import { AttendanceQueue } from './attendance-queue'
import { classifyCameraError } from './web-camera'

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  clear: vi.fn(),
  nativeScan: vi.fn(),
  toastError: vi.fn(),
  onText: null as null | ((text: string) => void),
  scanning: false,
}))
vi.mock('@/lib/platform', () => ({ isNative: () => false }))
vi.mock('./native-scanner', () => ({ scanAttendanceCode: mocks.nativeScan }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: vi.fn() } }))
vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class {
    get isScanning() {
      return mocks.scanning
    }
    start(...args: unknown[]) {
      mocks.onText = args[2] as (text: string) => void
      return mocks.start(...args)
    }
    stop() {
      mocks.scanning = false
      return mocks.stop()
    }
    clear() {
      mocks.clear()
    }
  },
}))

const occurrenceId = '00000000-0000-4000-8000-000000000001'
let saved: string | null = null
const send = vi.fn()

async function renderScanner() {
  const queue = new AttendanceQueue(
    'coach',
    {
      get: async () => saved,
      set: async (value) => {
        saved = value
      },
    },
    send,
    vi.fn(),
  )
  await queue.load()
  render(
    <AttendanceContext.Provider value={queue}>
      <AttendanceScanner occurrenceId={occurrenceId} label="Înot · 11 noiembrie" />
    </AttendanceContext.Provider>,
  )
  return queue
}

beforeEach(() => {
  vi.clearAllMocks()
  saved = null
  mocks.onText = null
  mocks.scanning = false
  mocks.start.mockImplementation(async () => {
    mocks.scanning = true
    return null
  })
  mocks.stop.mockResolvedValue(undefined)
  send.mockReturnValue(new Promise(() => undefined))
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  })
})
afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
})

it('opens the browser camera in a sheet with the session label and queues a valid code', async () => {
  await renderScanner()
  const user = userEvent.setup()
  expect(screen.getByText(/codurile sunt păstrate în acest browser/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Scanează cod QR' }))
  const dialog = await screen.findByRole('dialog', { name: 'Înot · 11 noiembrie' })
  expect(dialog).toHaveTextContent('Încadrează codul QR al copilului')
  await waitFor(() => expect(mocks.start).toHaveBeenCalled())
  expect(mocks.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' })
  expect(mocks.nativeScan).not.toHaveBeenCalled()
  mocks.onText?.(`MT1:${'b'.repeat(32)}`)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(mocks.stop).toHaveBeenCalled()
  await waitFor(() => expect(saved).toContain('b'.repeat(32)))
  expect(JSON.parse(saved ?? '{}').entries[0]).toMatchObject({ occurrenceId, state: 'pending' })
})

it('rejects a foreign QR without queueing anything', async () => {
  await renderScanner()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Scanează cod QR' }))
  await waitFor(() => expect(mocks.start).toHaveBeenCalled())
  mocks.onText?.('https://example.test/child')
  await waitFor(() =>
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Acesta nu este un cod QR Motion valid. Cere codul copilului.',
    ),
  )
  expect(saved).toBeNull()
  expect(send).not.toHaveBeenCalled()
})

it.each(['Escape', 'Anulează'])('closing with %s stops the camera', async (how) => {
  await renderScanner()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Scanează cod QR' }))
  await waitFor(() => expect(mocks.scanning).toBe(true))
  if (how === 'Escape') await user.keyboard('{Escape}')
  else await user.click(screen.getByRole('button', { name: 'Anulează' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(mocks.stop).toHaveBeenCalled()
  expect(mocks.clear).toHaveBeenCalled()
  expect(mocks.scanning).toBe(false)
  expect(screen.getByRole('button', { name: 'Scanează cod QR' })).toBeEnabled()
  expect(saved).toBeNull()
})

it('a denied permission explains the fix, retries and leaves the manual catalogue', async () => {
  mocks.start.mockRejectedValueOnce(
    'Error getting userMedia, error = NotAllowedError: Permission denied',
  )
  await renderScanner()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Scanează cod QR' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Camera nu are permisiune')
  expect(alert).toHaveTextContent('setările browserului')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2))
  await user.click(screen.getByRole('button', { name: 'Anulează' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(saved).toBeNull()
})

it('a browser without camera support never starts the reader', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
  await renderScanner()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Scanează cod QR' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Browserul nu permite camera')
  expect(screen.queryByRole('button', { name: 'Reîncearcă' })).not.toBeInTheDocument()
  expect(mocks.start).not.toHaveBeenCalled()
})

it('classifies browser camera errors', () => {
  expect(classifyCameraError(new DOMException('x', 'NotAllowedError'))).toBe('permission')
  expect(classifyCameraError('error = NotFoundError: Requested device not found')).toBe('no-camera')
  expect(classifyCameraError(new DOMException('x', 'NotReadableError'))).toBe('busy')
  expect(classifyCameraError(new Error('boom'))).toBe('unknown')
})
