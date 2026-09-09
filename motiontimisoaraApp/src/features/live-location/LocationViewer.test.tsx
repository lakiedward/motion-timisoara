import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { LocationError, locationRequest, type LocationResponse } from '@/api/live-location'
import { LocationViewer } from './LocationViewer'

const context = vi.hoisted(() => ({
  user: { id: 'parent-1', role: 'PARENT' },
  invalidate: () => {},
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: context.user }) }))
vi.mock('@/api/live-location', async (load) => ({
  ...(await load<typeof import('@/api/live-location')>()),
  locationRequest: vi.fn(),
  subscribeToLocation: vi.fn((_session, callback) => {
    context.invalidate = callback
    return vi.fn()
  }),
}))
vi.mock('./LiveLocationMap', () => ({
  LiveLocationMap: () => <div data-testid="live-map">Poziție verificată</div>,
}))

const request = vi.mocked(locationRequest)
let granted = false
let consentVersion = 7
const status = (): LocationResponse => ({
  success: true,
  sessionId: 'session-1',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  consentGranted: granted,
  consentVersion,
})
const position = (): LocationResponse => ({
  ...status(),
  location: {
    latitude: 45.75,
    longitude: 21.23,
    accuracy: 5,
    capturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
})
function mount(occurrenceId = 'occurrence-1') {
  return render(
    <MemoryRouter>
      <LocationViewer occurrenceId={occurrenceId} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  context.invalidate = () => {}
  context.user = { id: 'parent-1', role: 'PARENT' }
  granted = false
  consentVersion = 7
  request.mockImplementation(async (body) => {
    if (body.action === 'consent') {
      granted = body.consent
      consentVersion++
      return status()
    }
    return body.action === 'read' ? position() : status()
  })
})
afterEach(() => vi.useRealTimers())

test('parent discovers version, explicitly grants consent, then reads coordinates', async () => {
  mount()
  const allow = await screen.findByRole('button', { name: 'Accept și văd locația' })
  expect(request.mock.calls.some(([body]) => body.action === 'read')).toBe(false)
  await userEvent.click(allow)
  await screen.findByTestId('live-map')
  expect(request).toHaveBeenCalledWith(
    {
      action: 'consent',
      occurrenceId: 'occurrence-1',
      sessionId: 'session-1',
      consent: true,
      expectedVersion: 7,
    },
    'parent-1',
  )
})

test('revocation clears the map and ignores a previously pending read', async () => {
  granted = true
  mount()
  await screen.findByTestId('live-map')
  let finishRead: (value: LocationResponse) => void = () => {}
  let pendingReadStarted = false
  request.mockImplementation(async (body) => {
    if (body.action === 'read')
      return new Promise((resolve) => {
        pendingReadStarted = true
        finishRead = resolve
      })
    if (body.action === 'consent') {
      granted = body.consent
      consentVersion++
    }
    return status()
  })
  await act(async () => context.invalidate())
  await waitFor(() => expect(pendingReadStarted).toBe(true))
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retrage acordul' }))
  await screen.findByRole('button', { name: 'Accept și văd locația' })
  await act(async () => finishRead(position()))
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
})

test('CAS conflict refreshes metadata without automatically granting with the newer version', async () => {
  request.mockImplementation(async (body) => {
    if (body.action === 'consent') {
      consentVersion = 8
      throw new LocationError('REQUEST_CONFLICT', 'Acordul a fost modificat. Confirmă din nou.')
    }
    return status()
  })
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Accept și văd locația' }))
  await screen.findByText('Acordul a fost modificat. Confirmă din nou.')
  expect(request.mock.calls.filter(([body]) => body.action === 'consent')).toHaveLength(1)
  expect(request.mock.calls.some(([body]) => body.action === 'read')).toBe(false)
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
})

test('lost QR eligibility hides coordinates but keeps own consent revocation accessible', async () => {
  granted = true
  request.mockImplementation(async (body) => {
    if (body.action === 'read')
      throw new LocationError('NOT_ELIGIBLE', 'Copilul nu mai este prezent.')
    if (body.action === 'consent') {
      granted = body.consent
      consentVersion++
    }
    return status()
  })
  mount()
  await screen.findByText('Copilul nu mai este prezent.')
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retrage acordul' }))
  await screen.findByRole('button', { name: 'Accept și văd locația' })
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'consent', consent: false, expectedVersion: 7 }),
    'parent-1',
  )
})

test('switching identity prevents an old authenticated response from painting a map', async () => {
  granted = true
  let finishRead: (value: LocationResponse) => void = () => {}
  request.mockImplementation(async (body) =>
    body.action === 'read'
      ? new Promise((resolve) => {
          finishRead = resolve
        })
      : status(),
  )
  const view = mount()
  await waitFor(() =>
    expect(request.mock.calls.some(([body]) => body.action === 'read')).toBe(true),
  )
  context.user = { id: 'parent-2', role: 'PARENT' }
  granted = false
  view.rerender(
    <MemoryRouter>
      <LocationViewer occurrenceId="occurrence-1" />
    </MemoryRouter>,
  )
  await screen.findByRole('button', { name: 'Accept și văd locația' })
  await act(async () => finishRead(position()))
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
})

test('hiding the page clears displayed coordinates immediately', async () => {
  granted = true
  mount()
  await screen.findByTestId('live-map')
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
  hidden.mockRestore()
})

test('club sees a read-only map without parent consent controls', async () => {
  context.user = { id: 'club-1', role: 'CLUB' }
  mount()
  await screen.findByTestId('live-map')
  expect(screen.queryByRole('button', { name: 'Retrage acordul' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Accept și văd locația' })).not.toBeInTheDocument()
})

test('routine polling preserves the same map instance while checking the current session', async () => {
  vi.useFakeTimers()
  granted = true
  await act(async () => {
    mount()
  })
  const originalMap = screen.getByTestId('live-map')
  let finishStatus: (value: LocationResponse) => void = () => {}
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishStatus = resolve
      }),
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000)
  })
  expect(screen.getByTestId('live-map')).toBe(originalMap)
  await act(async () => {
    finishStatus(status())
  })
  expect(screen.getByTestId('live-map')).toBe(originalMap)
})

test('a point expires at two minutes even while a routine refresh is still pending', async () => {
  vi.useFakeTimers()
  granted = true
  await act(async () => {
    mount()
  })
  expect(screen.getByTestId('live-map')).toBeInTheDocument()
  request.mockImplementationOnce(() => new Promise(() => {}))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(119_999)
  })
  expect(screen.getByTestId('live-map')).toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
  expect(
    screen.getByText('Ultima poziție este prea veche. Așteptăm o actualizare.'),
  ).toBeInTheDocument()
})

test('an ordinary polling failure immediately clears a previously verified map', async () => {
  vi.useFakeTimers()
  granted = true
  await act(async () => {
    mount()
  })
  expect(screen.getByTestId('live-map')).toBeInTheDocument()
  request.mockRejectedValueOnce(new LocationError('NETWORK', 'Conexiune întreruptă.'))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5_000)
  })
  expect(screen.queryByTestId('live-map')).not.toBeInTheDocument()
  expect(screen.getByText('Conexiune întreruptă.')).toBeInTheDocument()
})
