import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { ClubActivityForm } from './ClubActivityForm'
import { getClubActivityById } from '@/api/club'

vi.mock('@/api/club', () => ({
  createClubActivity: vi.fn(),
  updateClubActivity: vi.fn(),
  getClubActivityById: vi.fn(),
  getMyClub: vi.fn().mockResolvedValue({ id: 'club-1' }),
  getClubRosterForSelect: vi.fn().mockResolvedValue([]),
  getClubSelectableLocations: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/sports', () => ({ fetchSports: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/bnr-rate', async () => {
  const real = await vi.importActual<typeof import('@/api/bnr-rate')>('@/api/bnr-rate')
  return { ...real, getCursBnr: vi.fn() }
})
vi.mock('@/api/offer-hero', () => ({
  schimbaPozaOferta: vi.fn(),
  renuntaLaOfertaFaraHero: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const SALVATA = {
  id: 'act-1',
  club_id: 'club-1',
  name: 'Activitate salvată',
  sport_id: null,
  location_id: null,
  coach_id: null,
  activity_date: '2027-07-10',
  start_time: '09:00:00',
  end_time: '11:00:00',
  price: 2000,
  capacity: null,
  description: 'Ieșire de probă.',
  currency: 'RON',
  eur_ron_rate_micros: null,
  age_from: null,
  age_to: null,
  hero_photo_storage_path: 'act-1/hero/a.jpg',
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/club/activities/new', element: <ClubActivityForm /> },
      { path: '/club/activities/:id/edit', element: <ClubActivityForm /> },
      { path: '/club/activities', element: <p>Lista activități</p> },
    ],
    { initialEntries: [path] },
  )
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

test('fără modificări, Înapoi duce direct la listă', async () => {
  const user = userEvent.setup()
  renderAt('/club/activities/new')
  await user.click(await screen.findByRole('link', { name: /Înapoi/ }))
  expect(await screen.findByText('Lista activități')).toBeInTheDocument()
  expect(screen.queryByText('Renunți la modificări?')).not.toBeInTheDocument()
})

test('cu modificări nesalvate, Înapoi întreabă; Rămân păstrează formularul', async () => {
  const user = userEvent.setup()
  renderAt('/club/activities/new')
  await user.type(await screen.findByLabelText(/^Nume/), 'Ieșire')
  await user.click(screen.getByRole('link', { name: /Înapoi/ }))
  expect(await screen.findByText('Renunți la modificări?')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Rămân' }))
  await waitFor(() => expect(screen.queryByText('Renunți la modificări?')).not.toBeInTheDocument())
  expect(screen.getByLabelText(/^Nume/)).toHaveValue('Ieșire')
})

test('la editare, fără modificări, Anulează duce direct la listă', async () => {
  const user = userEvent.setup()
  vi.mocked(getClubActivityById).mockResolvedValue(SALVATA as never)
  renderAt('/club/activities/act-1/edit')
  const nume = await screen.findByLabelText(/^Nume/)
  await waitFor(() => expect(nume).toHaveValue('Activitate salvată'))
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  expect(await screen.findByText('Lista activități')).toBeInTheDocument()
})

test('la editare, după o modificare Renunț duce la listă', async () => {
  const user = userEvent.setup()
  vi.mocked(getClubActivityById).mockResolvedValue(SALVATA as never)
  renderAt('/club/activities/act-1/edit')
  const nume = await screen.findByLabelText(/^Nume/)
  await waitFor(() => expect(nume).toHaveValue('Activitate salvată'))
  await user.type(nume, ' nouă')
  await user.click(screen.getByRole('link', { name: 'Anulează' }))
  await user.click(await screen.findByRole('button', { name: 'Renunț' }))
  expect(await screen.findByText('Lista activități')).toBeInTheDocument()
})
