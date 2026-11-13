import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import type { AdminSession } from '@/api/attendance/admin-sessions'
import { AttendanceContext } from '../attendance-context'
import { AttendanceQueue } from '../attendance-queue'
import { NowSessionCard } from './NowSessionCard'

vi.mock('../WebScannerSheet', () => ({
  WebScannerSheet: ({ open, label }: { open: boolean; label: string }) =>
    open ? <div role="dialog" aria-label={label} /> : null,
}))

const base: AdminSession = {
  id: 'occ-1',
  startsAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  endsAt: new Date(Date.now() + 55 * 60_000).toISOString(),
  courseId: 'c',
  courseName: 'Înot copii',
  locationName: 'Bazinul Olimpia',
  sportId: null,
  sportName: null,
  coachName: null,
  organizerKey: 'c',
  organizerKind: 'coach',
  organizerName: 'Înot copii',
  enrolledCount: 3,
  markedCount: 0,
}

async function renderCard(session: AdminSession, onCatalog = vi.fn()) {
  const queue = new AttendanceQueue(
    'coach',
    { get: async () => null, set: async () => {} },
    vi.fn(),
    vi.fn(),
  )
  await queue.load()
  render(
    <MemoryRouter>
      <AttendanceContext.Provider value={queue}>
        <NowSessionCard session={session} onCatalog={onCatalog} />
      </AttendanceContext.Provider>
    </MemoryRouter>,
  )
  return onCatalog
}

it('opens the web scanner for the current session', async () => {
  await renderCard(base)
  const card = screen.getByRole('region', { name: 'Ședința de acum' })
  expect(card).toHaveTextContent('Înot copii · Bazinul Olimpia')
  await userEvent.click(screen.getByRole('button', { name: /Scanează cod QR/ }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('opens the catalog of the session', async () => {
  const onCatalog = await renderCard(base)
  await userEvent.click(screen.getByRole('button', { name: /Catalogul/ }))
  expect(onCatalog).toHaveBeenCalledOnce()
})

it('keeps scanning closed until the session starts', async () => {
  await renderCard({
    ...base,
    startsAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  })
  expect(screen.getByRole('button', { name: /Scanează cod QR/ })).toBeDisabled()
  expect(screen.getByText(/Scanarea se deschide la/)).toBeInTheDocument()
})

it('renders nothing without a coach attendance queue', () => {
  const { container } = render(
    <MemoryRouter>
      <NowSessionCard session={base} catalogTo="/coach/attendance?sesiune=occ-1" />
    </MemoryRouter>,
  )
  expect(container).toBeEmptyDOMElement()
})
