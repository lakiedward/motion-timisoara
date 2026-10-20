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
    lastSentAt: string | null
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

const panel = (props: Partial<Parameters<typeof CoachLocationPanel>[0]> = {}) => (
  <MemoryRouter>
    <CoachLocationPanel occurrenceId="one" {...times()} {...props} />
  </MemoryRouter>
)
const openSheet = () => userEvent.click(screen.getByRole('button', { name: 'Partajează locația' }))

test('coach must explicitly consent and the checkbox does not carry to another occurrence', async () => {
  const view = render(panel())
  await openSheet()
  expect(screen.getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'Pornește partajarea' }))
  expect(context.start).toHaveBeenCalledWith('one')
  view.rerender(panel({ occurrenceId: 'two' }))
  await openSheet()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Pornește partajarea' })).toBeDisabled()
})

test('without a selected session there is no consent or start control', () => {
  render(panel({ occurrenceId: null, startsAt: undefined, endsAt: undefined }))
  expect(screen.getByText(/Alege o ședință/)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('active sharing shows the expiry and the last sent position', () => {
  const sent = new Date(Date.now() - 5_000).toISOString()
  context.active = {
    occurrenceId: 'one',
    sessionId: 'session',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    lastSentAt: sent,
  }
  render(panel())
  expect(screen.getByRole('status')).toHaveTextContent(
    `ultima poziție ${new Date(sent).toLocaleTimeString('ro-RO')}`,
  )
})

test('stop remains accessible when a different occurrence is selected', async () => {
  context.active = {
    occurrenceId: 'one',
    sessionId: 'session',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    lastSentAt: null,
  }
  render(panel({ occurrenceId: 'two' }))
  expect(screen.getByText(/altă ședință sau tabără/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Oprește partajarea' }))
  expect(context.stop).toHaveBeenCalledOnce()
})

test('admin admitted to attendance has no coach sharing control', () => {
  context.role = 'ADMIN'
  render(panel())
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('capture initialization does not disable the stop control', async () => {
  context.busy = true
  context.active = {
    occurrenceId: 'one',
    sessionId: 'session',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    lastSentAt: null,
  }
  render(panel())
  const stop = screen.getByRole('button', { name: 'Oprește partajarea' })
  expect(stop).toBeEnabled()
  await userEvent.click(stop)
  expect(context.stop).toHaveBeenCalledOnce()
})

test('unresolved cleanup blocks a new consent and start', () => {
  context.needsStopRetry = true
  render(panel())
  expect(screen.getByRole('button', { name: 'Partajează locația' })).toBeDisabled()
})

test('camp entry never starts capture and every explicit start consumes its consent', async () => {
  render(panel({ occurrenceId: 'camp:one:coach', context: 'camp' }))
  expect(context.start).not.toHaveBeenCalled()
  await openSheet()
  expect(screen.getByText(/după 8 ore/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'Pornește partajarea' }))
  expect(context.start).toHaveBeenCalledWith('camp:one:coach')
  await openSheet()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
})

test('camp sharing has no course fifteen-minute grace period', () => {
  render(
    panel({
      occurrenceId: 'camp:one:coach',
      context: 'camp',
      startsAt: new Date(Date.now() - 600_000).toISOString(),
      endsAt: new Date(Date.now() - 1_000).toISOString(),
    }),
  )
  expect(screen.queryByRole('button', { name: 'Partajează locația' })).not.toBeInTheDocument()
  expect(screen.getByText(/numai în perioada taberei/)).toBeInTheDocument()
})
