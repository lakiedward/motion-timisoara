import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'

import ClubLocationFormPage from './ClubLocationFormPage'
import { createClubLocation, getClubLocationById, getMyClub, updateClubLocation } from '@/api/club'

vi.mock('react-leaflet', () => import('@/test/react-leaflet-stub'))
vi.mock('leaflet', () => ({
  default: { icon: () => ({}) },
}))
vi.mock('@/api/geocoding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/geocoding')>()
  return {
    ...actual,
    searchPlaces: vi.fn(),
    reverseGeocode: vi.fn(),
  }
})
vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocationById: vi.fn(),
  createClubLocation: vi.fn(),
  updateClubLocation: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockedClub = vi.mocked(getMyClub)
const mockedExisting = vi.mocked(getClubLocationById)
const mockedCreate = vi.mocked(createClubLocation)
const mockedUpdate = vi.mocked(updateClubLocation)

function renderForm(ruta = '/club/locations/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/locations/new" element={<ClubLocationFormPage />} />
          <Route path="/club/locations/:id/edit" element={<ClubLocationFormPage />} />
          <Route path="/club/locations" element={<div>Lista locații</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1', name: 'Club Audit Motion' } as never)
  mockedExisting.mockResolvedValue(null)
})

test('create and edit both show search + map and hide lat/lng fields', async () => {
  const { unmount } = renderForm('/club/locations/new')
  expect(await screen.findByRole('heading', { name: 'Locație nouă' })).toBeInTheDocument()
  expect(screen.getByLabelText('Caută locul')).toBeInTheDocument()
  expect(screen.getByTestId('location-map')).toBeInTheDocument()
  expect(screen.queryByLabelText('Latitudine')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Longitudine')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Nume')).toBeInTheDocument()
  expect(screen.getByLabelText('Tip')).toBeInTheDocument()
  expect(screen.getByLabelText('Oraș')).toBeInTheDocument()
  expect(screen.getByLabelText('Adresă')).toBeInTheDocument()
  expect(screen.getByLabelText('Descriere')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Anulează' })).toHaveAttribute('href', '/club/locations')
  expect(screen.getByRole('link', { name: /înapoi/i })).toHaveAttribute('href', '/club/locations')
  unmount()

  mockedExisting.mockResolvedValue({
    id: 'loc-1',
    name: 'Bazin Club',
    type: 'POOL',
    address: 'Strada Veche 1',
    city: 'Timișoara',
    lat: 45.75,
    lng: 21.22,
    description: 'Note',
  } as never)
  renderForm('/club/locations/loc-1/edit')
  expect(await screen.findByRole('heading', { name: 'Editează locație' })).toBeInTheDocument()
  expect(await screen.findByDisplayValue('Bazin Club')).toBeInTheDocument()
  expect(screen.getByLabelText('Caută locul')).toBeInTheDocument()
  expect(screen.getByTestId('location-map')).toBeInTheDocument()
  expect(screen.getByTestId('map-pin')).toBeInTheDocument()
  expect(screen.queryByLabelText('Latitudine')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Longitudine')).not.toBeInTheDocument()
})

test('save without a pin stays on the form and does not write', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(await screen.findByLabelText('Nume'), 'Sala nouă')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(/locul pe hartă/i)
  expect(alert.textContent?.toLowerCase()).not.toMatch(/coordonat|latitud|longitud/)
  expect(mockedCreate).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Locație nouă' })).toBeInTheDocument()
  expect(screen.getByLabelText('Nume')).toHaveValue('Sala nouă')
})

test('choosing a place fills address and city, then save persists lat/lng and returns to the list', async () => {
  const user = userEvent.setup()
  const { searchPlaces } = await import('@/api/geocoding')
  vi.mocked(searchPlaces).mockResolvedValue([
    {
      id: '1',
      label: 'Piața Unirii, Timișoara, România',
      lat: 45.757,
      lng: 21.229,
      address: 'Piața Unirii',
      city: 'Timișoara',
    },
  ])
  mockedCreate.mockResolvedValue(undefined as never)

  renderForm()
  await user.type(await screen.findByLabelText('Nume'), 'Bazin Unirii')
  await user.type(screen.getByLabelText('Caută locul'), 'Unirii')
  await user.click(await screen.findByRole('button', { name: /piața unirii/i }, { timeout: 1500 }))

  expect(screen.getByLabelText('Adresă')).toHaveValue('Piața Unirii')
  expect(screen.getByLabelText('Oraș')).toHaveValue('Timișoara')

  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(mockedCreate).toHaveBeenCalled())
  expect(mockedCreate).toHaveBeenCalledWith(
    'club-1',
    expect.objectContaining({
      name: 'Bazin Unirii',
      address: 'Piața Unirii',
      city: 'Timișoara',
      lat: 45.757,
      lng: 21.229,
    }),
  )
  const { toast } = await import('sonner')
  expect(toast.success).toHaveBeenCalledWith('Locație creată.')
  expect(await screen.findByText('Lista locații')).toBeInTheDocument()
})

test('edit save with an existing pin updates the location and returns to the list', async () => {
  const user = userEvent.setup()
  mockedExisting.mockResolvedValue({
    id: 'loc-1',
    name: 'Bazin Club',
    type: 'POOL',
    address: 'Strada Veche 1',
    city: 'Timișoara',
    lat: 45.75,
    lng: 21.22,
    description: '',
  } as never)
  mockedUpdate.mockResolvedValue(undefined as never)

  renderForm('/club/locations/loc-1/edit')
  await screen.findByDisplayValue('Bazin Club')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  await waitFor(() => expect(mockedUpdate).toHaveBeenCalled())
  expect(mockedUpdate).toHaveBeenCalledWith(
    'loc-1',
    expect.objectContaining({
      name: 'Bazin Club',
      lat: 45.75,
      lng: 21.22,
    }),
  )
  expect(await screen.findByText('Lista locații')).toBeInTheDocument()
})
