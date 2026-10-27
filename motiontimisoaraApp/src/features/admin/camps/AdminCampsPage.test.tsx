import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { getToateTaberele, type TabaraAdmin } from '@/api/camps-admin'
import AdminCampsPage from './AdminCampsPage'

vi.mock('@/api/camps-admin', async () => {
  const real = await vi.importActual<typeof import('@/api/camps-admin')>('@/api/camps-admin')
  return { ...real, getToateTaberele: vi.fn() }
})

const tabara = (id: string, p: Partial<TabaraAdmin> = {}) =>
  ({
    id,
    title: `Tabăra ${id}`,
    slug: id,
    location_text: null,
    period_start: '2099-07-10',
    period_end: '2099-07-17',
    capacity: 20,
    price: 50000,
    currency: 'RON',
    pricing_mode: 'single',
    club_id: 'c1',
    coach_id: null,
    club: { name: 'Clubul Delfinii' },
    coach: null,
    locuriOcupate: 0,
    categorii: 0,
    preturiPeVarsta: [],
    antrenoriAcceptati: 0,
    antrenoriInAsteptare: 0,
    ...p,
  }) as TabaraAdmin

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminCampsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getToateTaberele).mockReset()
})

test('taberele se grupează pe club și antrenor, cu primul card din fiecare deschis', async () => {
  vi.mocked(getToateTaberele).mockResolvedValue([
    tabara('vara'),
    tabara('munte', { club_id: 'c2', club: { name: 'Clubul Vulturii' } }),
    tabara('schi', { club_id: null, coach_id: 'u1', club: null, coach: { name: 'Ana Ionescu' } }),
  ])
  deseneaza()
  const cluburi = await screen.findByRole('region', { name: 'Cluburi' })
  expect(within(cluburi).getByRole('button', { name: /Clubul Delfinii/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(within(cluburi).getByRole('button', { name: /Clubul Vulturii/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  const antrenori = screen.getByRole('region', { name: 'Antrenori independenți' })
  expect(within(antrenori).getByRole('heading', { name: 'Tabăra schi' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Tabăra vara' })).toHaveAttribute(
    'href',
    '/admin/camps/vara/edit',
  )
})

test('căutarea după organizator lasă doar taberele lui și deschide grupul', async () => {
  const user = userEvent.setup()
  vi.mocked(getToateTaberele).mockResolvedValue([
    tabara('vara'),
    tabara('munte', { club_id: 'c2', club: { name: 'Clubul Vulturii' } }),
  ])
  deseneaza()
  await screen.findByRole('region', { name: 'Cluburi' })
  await user.type(screen.getByRole('searchbox'), 'vulturii')
  expect(screen.getByRole('heading', { name: 'Tabăra munte' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Tabăra vara' })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1 din 2 tabere')
})

test('un filtru fără rezultate oferă ștergerea filtrelor', async () => {
  const user = userEvent.setup()
  vi.mocked(getToateTaberele).mockResolvedValue([tabara('vara')])
  deseneaza()
  await screen.findByRole('region', { name: 'Cluburi' })
  await user.click(screen.getByRole('button', { name: /^Încheiate/ }))
  expect(screen.getByText('Nicio tabără pentru filtrele alese.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Șterge filtrele' }))
  expect(screen.getByRole('heading', { name: 'Tabăra vara' })).toBeInTheDocument()
})

test('fără tabere se vede mesajul gol cu legătura de creare', async () => {
  vi.mocked(getToateTaberele).mockResolvedValue([])
  deseneaza()
  expect(await screen.findByText('Nicio tabără încă.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Creează prima tabără/ })).toHaveAttribute(
    'href',
    '/admin/camps/new',
  )
})

test('o încărcare căzută arată eroarea cu reîncercare', async () => {
  vi.mocked(getToateTaberele).mockRejectedValue(new Error('network'))
  deseneaza()
  expect(await screen.findByText('Nu am putut încărca taberele.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})
