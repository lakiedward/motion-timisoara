import { vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
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
// legatura lui cu selectorul, nu desenul hartii. `useMapEvents` retine handlerul
// de apasare, ca testele sa poata simula o apasare pe harta fara Leaflet.
let apasaPeHarta: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="harta">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="pin" />,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: (handlers: { click: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    apasaPeHarta = handlers.click
    return null
  },
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
  apasaPeHarta = null
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

// Regresie (Bugbot pe PR #35, severitate mare): reverse geocoding-ul pornit la o
// apasare pe harta se termina asincron. Cel pornit primul se poate intoarce
// ULTIMUL si, scriind coordonatele pe care le-a capturat, impingea formularul
// inapoi la punctul vechi — deci clubul salva alt loc decat cel ales ultima oara.
test('un reverse intors tarziu nu mai suprascrie un punct ales dupa el', async () => {
  const mockedReverse = vi.mocked(geocoding.reverse)
  let terminaPrimul: (() => void) | null = null
  mockedReverse
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminaPrimul = () =>
            resolve({
              id: 'vechi',
              label: 'Locul vechi',
              detail: '',
              address: 'Strada Veche 1',
              city: 'Timișoara',
              lat: 45.7,
              lng: 21.2,
            })
        }),
    )
    .mockImplementationOnce(async () => ({
      id: 'nou',
      label: 'Locul nou',
      detail: '',
      address: 'Strada Nouă 2',
      city: 'Timișoara',
      lat: 45.8,
      lng: 21.3,
    }))

  renderForm()
  await screen.findByDisplayValue('Bazin Audit')

  // Prima apasare: reverse-ul ramane atarnat. A doua apasare se rezolva imediat.
  await act(async () => {
    apasaPeHarta?.({ latlng: { lat: 45.7, lng: 21.2 } })
  })
  await act(async () => {
    apasaPeHarta?.({ latlng: { lat: 45.8, lng: 21.3 } })
  })
  await waitFor(() => expect(screen.getByLabelText('Adresă')).toHaveValue('Strada Nouă 2'))

  // Abia acum se intoarce cel vechi. Nu are voie sa schimbe nimic.
  await act(async () => {
    terminaPrimul?.()
  })
  expect(screen.getByLabelText('Adresă')).toHaveValue('Strada Nouă 2')

  await user_salveaza()
  await waitFor(() =>
    expect(mockedActualizare).toHaveBeenCalledWith(
      'loc-1',
      expect.objectContaining({ lat: 45.8, lng: 21.3, address: 'Strada Nouă 2' }),
    ),
  )
})

// Aceeasi cursa, dar incheiata prin alegerea unei sugestii: sugestia vine cu
// adresa ei, iar reverse-ul pornit inainte trebuie sa devina irelevant.
test('un reverse intors tarziu nu mai suprascrie o sugestie aleasa dupa el', async () => {
  const user = userEvent.setup()
  const mockedReverse = vi.mocked(geocoding.reverse)
  let terminaVechiul: (() => void) | null = null
  mockedReverse.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        terminaVechiul = () =>
          resolve({
            id: 'vechi',
            label: 'Locul vechi',
            detail: '',
            address: 'Strada Veche 1',
            city: 'Timișoara',
            lat: 45.7,
            lng: 21.2,
          })
      }),
  )
  mockedCautare.mockResolvedValue([
    {
      id: 'W1-0',
      label: 'Bulevardul Take Ionescu 46C',
      detail: 'Timișoara',
      address: 'Bulevardul Take Ionescu 46C',
      city: 'Timișoara',
      lat: 45.7603,
      lng: 21.2422,
    },
  ])

  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  await act(async () => {
    apasaPeHarta?.({ latlng: { lat: 45.7, lng: 21.2 } })
  })

  await user.type(screen.getByLabelText('Caută adresa'), 'take ionescu')
  await user.click(await screen.findByRole('option', { name: /Take Ionescu 46C/ }))
  expect(screen.getByLabelText('Adresă')).toHaveValue('Bulevardul Take Ionescu 46C')

  await act(async () => {
    terminaVechiul?.()
  })
  expect(screen.getByLabelText('Adresă')).toHaveValue('Bulevardul Take Ionescu 46C')
})

/** Apasa Salvează si asteapta trimiterea. */
async function user_salveaza() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
}

// „Nu am găsit-o” și „n-am putut s-o citesc” sunt lucruri diferite. De când
// citirea aruncă în loc să întoarcă null, o cădere de rețea ar fi ajuns pe
// ramura de not-found și i-ar fi spus clubului că locația nu există.
test('o citire căzută arată eroare cu Reîncearcă, nu „nu a fost găsită”', async () => {
  mockedLocatie.mockRejectedValue(new Error('network'))
  renderForm()
  expect(await screen.findByText('Nu am putut încărca locația.')).toBeInTheDocument()
  expect(screen.queryByText('Locația nu a fost găsită.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})

test('Reîncearcă cere din nou locația și, dacă merge, arată formularul', async () => {
  const user = userEvent.setup()
  mockedLocatie.mockRejectedValueOnce(new Error('network')).mockResolvedValue(locatie as never)
  renderForm()
  await user.click(await screen.findByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByDisplayValue('Bazin Audit')).toBeInTheDocument()
})
