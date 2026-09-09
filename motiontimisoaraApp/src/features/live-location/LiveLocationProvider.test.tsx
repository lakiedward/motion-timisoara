import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: { current: { id: 'coach', role: 'COACH' } as { id: string; role: string } | null },
  request: vi.fn(),
  makeStop: vi.fn(),
  stop: vi.fn(),
  capture: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: mocks.user.current }) }))
vi.mock('@/lib/platform', () => ({ isNative: () => true }))
vi.mock('@/api/live-location', () => ({
  locationRequest: mocks.request,
  prepareLocationStop: mocks.makeStop,
  LocationError: class extends Error {},
}))
vi.mock('./native-location', () => ({ startLocationCapture: mocks.capture }))
import { LiveLocationProvider } from './LiveLocationProvider'
import { useLiveLocationSharing } from './live-location-context'

function Harness() {
  const sharing = useLiveLocationSharing()
  return (
    <button disabled={sharing.busy} onClick={() => void sharing.start('occurrence')}>
      Start fixture
    </button>
  )
}

describe('global location controls', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.user.current = { id: 'coach', role: 'COACH' }
    mocks.request.mockResolvedValue({
      success: true,
      sessionId: 'session',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    mocks.makeStop.mockResolvedValue(mocks.stop)
    mocks.stop.mockResolvedValue(undefined)
    mocks.cancel.mockResolvedValue(undefined)
    mocks.capture.mockResolvedValue(mocks.cancel)
  })

  it('allows stop while capture permission is pending and waits for late cleanup', async () => {
    let finishCapture!: (cancel: () => Promise<void>) => void
    mocks.capture.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCapture = resolve
        }),
    )
    render(
      <LiveLocationProvider>
        <Harness />
      </LiveLocationProvider>,
    )
    fireEvent.click(screen.getByText('Start fixture'))
    const stop = await screen.findByRole('button', { name: 'Oprește locația' })
    expect(stop).toBeEnabled()
    fireEvent.click(stop)
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce())
    expect(screen.getByText('Se oprește partajarea locației…')).toBeVisible()
    await act(async () => {
      finishCapture(mocks.cancel)
    })
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledOnce())
    expect(screen.queryByLabelText('Partajare locație activă')).not.toBeInTheDocument()
  })

  it('keeps a stop retry visible after logout and blocks the next account until cleanup succeeds', async () => {
    const view = render(
      <LiveLocationProvider>
        <Harness />
      </LiveLocationProvider>,
    )
    fireEvent.click(screen.getByText('Start fixture'))
    await screen.findByRole('button', { name: 'Oprește locația' })
    mocks.stop.mockRejectedValueOnce(new Error('offline'))
    mocks.user.current = { id: 'another-coach', role: 'COACH' }
    view.rerender(
      <LiveLocationProvider>
        <Harness />
      </LiveLocationProvider>,
    )
    const retry = await screen.findByRole('button', { name: 'Reîncearcă oprirea' })
    await waitFor(() => expect(retry).toBeEnabled())
    expect(screen.getByText('Start fixture')).toBeDisabled()
    expect(
      screen.queryByText('Locația ta este partajată pentru ședința curentă.'),
    ).not.toBeInTheDocument()
    fireEvent.click(retry)
    await waitFor(() =>
      expect(screen.queryByLabelText('Oprire locație în așteptare')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Start fixture')).toBeEnabled()
    expect(mocks.stop).toHaveBeenCalledTimes(2)
  })
})
