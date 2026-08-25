import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import ClubLocationFormPage from './ClubLocationFormPage'
import { createClubLocation, getClubLocationById, getMyClub, updateClubLocation } from '@/api/club'
import { geocoding } from '@/api/geocoding'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocationById: vi.fn(),
  createClubLocation: vi.fn(),
  updateClubLocation: vi.fn(),
}))

vi.mock('@/api/geocoding', () => ({
  geocoding: { search: vi.fn(), reverse: vi.fn() },
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// Leaflet are nevoie de layout real ca sa deseneze, iar jsdom nu-l face. Harta
// e inlocuita cu un container gol: testele de aici verifica formularul si
// legatura lui cu selectorul, nu desenul hartii.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="harta">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="pin" />,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: () => null,
}))

const mockedClub = vi.mocked(getMyClub)
const mockedLocatie = vi.mocked(getClubLocationById)
const mockedActualizare = vi.mocked(updateClubLocation)
const mockedCreare = vi.mocked(createClubLocation)
const mockedCautare = vi.mocked(geocoding.search)

const locatie = {
  id: 'loc-1',
  name: 'Bazin Audit',
  type: 'POOL',
  address: 'Str. Audit 1',
  city: 'Timișoara',
  lat: 45.75,
  lng: 21.22,
  description: null,
}

function renderForm(ruta = '/club/locations/loc-1/edit') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/club/locations" element={<p>Lista de locații</p>} />
          <Route path="/club/locations/new" element={<ClubLocationFormPage />} />
          <Route path="/club/locations/:id/edit" element={<ClubLocationFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedClub.mockResolvedValue({ id: 'club-1' } as never)
  mockedLocatie.mockResolvedValue(locatie as never)
  mockedActualizare.mockResolvedValue(locatie as never)
  mockedCreare.mockResolvedValue(undefined as never)
  mockedCautare.mockResolvedValue([])
})

// Sursa locului e pinul de pe hartă, nu tastatura: coordonatele se scriu în
// continuare în baza de date, dar clubul nu le mai vede și nu le mai tastează.
test('formularul nu mai are câmpuri de latitudine și longitudine', async () => {
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  expect(screen.queryByLabelText('Latitudine')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Longitudine')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Caută adresa')).toBeInTheDocument()
  expect(screen.getByTestId('harta')).toBeInTheDocument()
})

test('câmpurile păstrate rămân pe ecran, harta se adaugă lângă ele', async () => {
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  for (const eticheta of ['Nume', 'Tip', 'Oraș', 'Adresă', 'Descriere']) {
    expect(screen.getByLabelText(eticheta)).toBeInTheDocument()
  }
  expect(screen.getByRole('heading', { name: 'Editează locație' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Anulează' })).toBeInTheDocument()
})

// Înainte se putea salva cu lat și long goale, iar locația ajungea în baza de
// date fără loc pe hartă — invizibilă pe /harta.
test('fără punct pe hartă salvarea e oprită și nu ajunge la server', async () => {
  const user = userEvent.setup()
  renderForm('/club/locations/new')
  await screen.findByLabelText('Nume')
  await user.type(screen.getByLabelText('Nume'), 'Sala Nouă')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  expect(await screen.findByText('Pune punctul pe hartă')).toBeInTheDocument()
  expect(mockedCreare).not.toHaveBeenCalled()
})

// Alegerea unei sugestii e totuna cu mutarea pinului: umple și Adresă și Oraș,
// nu doar coordonatele.
test('o sugestie aleasă umple adresa, orașul și deblochează salvarea', async () => {
  const user = userEvent.setup()
  mockedCautare.mockResolvedValue([
    {
      id: 'W1-0',
      label: 'Bulevardul Take Ionescu 46C',
      detail: 'Timișoara, 300070',
      address: 'Bulevardul Take Ionescu 46C',
      city: 'Timișoara',
      lat: 45.7603,
      lng: 21.2422,
    },
  ])

  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  await user.type(screen.getByLabelText('Caută adresa'), 'take ionescu')

  const sugestie = await screen.findByRole('option', { name: /Take Ionescu 46C/ })
  await user.click(sugestie)

  expect(screen.getByLabelText('Adresă')).toHaveValue('Bulevardul Take Ionescu 46C')
  expect(screen.getByLabelText('Oraș')).toHaveValue('Timișoara')

  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(mockedActualizare).toHaveBeenCalledWith(
      'loc-1',
      expect.objectContaining({ lat: 45.7603, lng: 21.2422, address: 'Bulevardul Take Ionescu 46C' }),
    ),
  )
})

// Regresie (finding UI #493, sever): cu id-ul unei locații a altui club,
// formularul se precompleta cu datele acelui club și nu spunea nimic, deși baza
// refuza salvarea. Acum cererea e deja filtrată pe club, iar ecranul o spune.
test('un id care nu e al clubului arată „nu a fost găsită”, nu un formular', async () => {
  mockedLocatie.mockResolvedValue(null)
  renderForm()
  expect(await screen.findByText('Locația nu a fost găsită.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Nume')).not.toBeInTheDocument()
})

test('cererea de citire primește clubul curent, nu doar id-ul din adresă', async () => {
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  expect(mockedLocatie).toHaveBeenCalledWith('loc-1', 'club-1')
})
