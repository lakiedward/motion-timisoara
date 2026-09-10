import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { CoachLocationPanel } from './CoachLocationPanel'

const context = vi.hoisted(() => ({
  role: 'COACH',
  busy: false,
  stopping: false,
  needsStopRetry: false,
  active: null as null | {
    occurrenceId: string
    sessionId: string
    expiresAt: string
    lastSentAt: null
  },
  start: vi.fn(),
  stop: vi.fn(),
}))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: { id: 'coach-1', role: context.role } }),
}))
vi.mock('./live-location-context', () => ({
  useLiveLocationSharing: () => ({
    active: context.active,
    busy: context.busy,
    stopping: context.stopping,
    needsStopRetry: context.needsStopRetry,
    error: null,
    start: context.start,
    stop: context.stop,
  }),
}))

const times = () => ({
  startsAt: new Date(Date.now() - 60_000).toISOString(),
  endsAt: new Date(Date.now() + 600_000).toISOString(),
})
beforeEach(() => {
  context.role = 'COACH'
  context.active = null
  context.busy = false
  context.stopping = false
  context.needsStopRetry = false
  vi.clearAllMocks()
})

test('coach must explicitly consent and the checkbox does not carry to another occurrence', async () => {
  const view = render(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="one" {...times()} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'Pornește partajarea' }))
  expect(context.start).toHaveBeenCalledWith('one')
  view.rerender(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="two" {...times()} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled()
})

test('stop remains accessible when a different occurrence is selected', async () => {
  context.active = {
    occurrenceId: 'one',
    sessionId: 'session',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    lastSentAt: null,
  }
  render(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="two" {...times()} />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Oprește partajarea' }))
  expect(context.stop).toHaveBeenCalledOnce()
})

test('admin admitted to attendance has no coach sharing control', () => {
  context.role = 'ADMIN'
  render(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="one" {...times()} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('capture initialization does not disable the stop control', async () => {
  context.busy = true
  context.active = {
    occurrenceId: 'one',
    sessionId: 'session',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    lastSentAt: null,
  }
  render(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="one" {...times()} />
    </MemoryRouter>,
  )
  const stop = screen.getByRole('button', { name: 'Oprește partajarea' })
  expect(stop).toBeEnabled()
  await userEvent.click(stop)
  expect(context.stop).toHaveBeenCalledOnce()
})

test('unresolved cleanup blocks a new consent and start', () => {
  context.needsStopRetry = true
  render(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="one" {...times()} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled()
})

test('camp entry never starts capture and every explicit start consumes its consent', async () => {
  render(
    <MemoryRouter>
      <CoachLocationPanel occurrenceId="camp:one:coach" context="camp" {...times()} />
    </MemoryRouter>,
  )
  expect(context.start).not.toHaveBeenCalled()
  expect(screen.getByText(/după 8 ore/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'Pornește partajarea' }))
  expect(context.start).toHaveBeenCalledWith('camp:one:coach')
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

test('camp sharing has no course fifteen-minute grace period', () => {
  render(
    <MemoryRouter>
      <CoachLocationPanel
        occurrenceId="camp:one:coach"
        context="camp"
        startsAt={new Date(Date.now() - 600_000).toISOString()}
        endsAt={new Date(Date.now() - 1_000).toISOString()}
      />
    </MemoryRouter>,
  )
  expect(screen.getByRole('checkbox')).toBeDisabled()
})
