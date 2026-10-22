import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import type { InvitatieDeRaspuns } from '@/api/camp-coaches'
import CampInvitations from './CampInvitations'

const api = vi.hoisted(() => ({ get: vi.fn(), respond: vi.fn() }))

vi.mock('@/api/camp-coaches', () => ({
  getInvitatiileMele: api.get,
  raspundeInvitatie: api.respond,
}))
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function invitatie(p: Partial<InvitatieDeRaspuns> = {}): InvitatieDeRaspuns {
  return {
    campId: 'camp-1',
    titlu: 'Tabără de munte',
    slug: 'tabara-de-munte',
    perioadaStart: '2099-07-10',
    perioadaEnd: '2099-07-17',
    loc: 'Semenic',
    invitatDe: 'Motion Kids',
    stare: 'invited',
    ...p,
  }
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CampInvitations />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  api.get.mockReset()
  api.respond.mockReset()
})

test('arată doar invitațiile noi la tabere neîncheiate, cu clubul care invită', async () => {
  api.get.mockResolvedValue([
    invitatie(),
    invitatie({ campId: 'camp-2', titlu: 'Tabără de înot', invitatDe: 'Delfinii' }),
    invitatie({ campId: 'camp-3', titlu: 'Tabără acceptată', stare: 'accepted' }),
    invitatie({
      campId: 'camp-4',
      titlu: 'Tabără trecută',
      perioadaStart: '2020-07-01',
      perioadaEnd: '2020-07-05',
    }),
  ])
  deseneaza()
  expect(
    await screen.findByRole('heading', { name: 'Ai 2 invitații noi la tabere' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Tabără de munte' })).toHaveAttribute(
    'href',
    '/tabere/tabara-de-munte',
  )
  expect(screen.getByText('Delfinii')).toBeInTheDocument()
  expect(screen.queryByText('Tabără acceptată')).not.toBeInTheDocument()
  expect(screen.queryByText('Tabără trecută')).not.toBeInTheDocument()
})

test('Accept și Refuz trimit răspunsul pentru tabăra lor', async () => {
  api.get.mockResolvedValue([invitatie()])
  api.respond.mockResolvedValue(undefined)
  deseneaza()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Accept invitația la Tabără de munte' }),
  )
  await waitFor(() => expect(api.respond).toHaveBeenCalledWith('camp-1', true))
  await userEvent.click(screen.getByRole('button', { name: 'Refuz invitația la Tabără de munte' }))
  await waitFor(() => expect(api.respond).toHaveBeenCalledWith('camp-1', false))
})

test('fără invitații noi sau la eroare, panoul nu apare', async () => {
  api.get.mockResolvedValue([invitatie({ stare: 'accepted' })])
  const { container, unmount } = deseneaza()
  await waitFor(() => expect(api.get).toHaveBeenCalled())
  await waitFor(() => expect(container).toBeEmptyDOMElement())
  unmount()

  api.get.mockRejectedValue(new Error('retea'))
  const second = deseneaza()
  await waitFor(() => expect(second.container).toBeEmptyDOMElement())
})
