import { vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

import ClubLocationFormPage from './ClubLocationFormPage'
import { createClubLocation, getClubLocationById, getMyClub, updateClubLocation } from '@/api/club'
import { geocoding } from '@/api/geocoding'
import { getLocations, type LocationRow } from '@/api/public'

vi.mock('@/api/club', () => ({
  getMyClub: vi.fn(),
  getClubLocationById: vi.fn(),
  createClubLocation: vi.fn(),
  updateClubLocation: vi.fn(),
}))

vi.mock('@/api/geocoding', () => ({
  geocoding: { search: vi.fn(), reverse: vi.fn() },
}))

vi.mock('@/api/public', () => ({ getLocations: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
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
const mockedNearbyLocations = vi.mocked(getLocations)

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

function renderForm(
  ruta = '/club/locations/loc-1/edit',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route
            path="/club/locations"
            element={
              <div>
                <p>Lista de locații</p>
                <Link to="/club/locations/new">Adaugă locație</Link>
              </div>
            }
          />
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
  mockedNearbyLocations.mockReset().mockResolvedValue([])
  vi.mocked(geocoding.reverse).mockReset().mockResolvedValue(null)
})
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
test('fără punct pe hartă salvarea e oprită și nu ajunge la server', async () => {
  const user = userEvent.setup()
  renderForm('/club/locations/new')
  await screen.findByLabelText('Nume')
  await user.type(screen.getByLabelText('Nume'), 'Sala Nouă')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  expect(await screen.findByText('Pune punctul pe hartă')).toBeInTheDocument()
  expect(mockedCreare).not.toHaveBeenCalled()
})
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
      expect.objectContaining({
        lat: 45.7603,
        lng: 21.2422,
        address: 'Bulevardul Take Ionescu 46C',
      }),
    ),
  )
})
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
  await act(async () => {
    apasaPeHarta?.({ latlng: { lat: 45.7, lng: 21.2 } })
  })
  await act(async () => {
    apasaPeHarta?.({ latlng: { lat: 45.8, lng: 21.3 } })
  })
  await waitFor(() => expect(screen.getByLabelText('Adresă')).toHaveValue('Strada Nouă 2'))
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

async function user_salveaza() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
}
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

const nearbySource = {
  ...locatie,
  id: 'source-location',
  name: 'Sala existentă',
  type: 'GYM',
  address: 'Strada sursei 2',
  lat: 45.7502,
  lng: 21.220012345,
  description: 'Detalii ale locului',
  capacity: null,
  is_active: true,
  club_id: 'other-club',
  created_by_user_id: 'other-owner',
  fts: null,
} satisfies LocationRow

async function pickPoint(lat = 45.75, lng = 21.22) {
  await act(async () => {
    apasaPeHarta?.({ latlng: { lat, lng } })
  })
}

test('nearby lookup starts after placing a creation pin and never runs on edit', async () => {
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  await pickPoint()
  expect(mockedNearbyLocations).not.toHaveBeenCalled()
  expect(screen.queryByText('Locații existente în apropiere')).not.toBeInTheDocument()
})

test('copying another club location fills exact source data and saves for the current club', async () => {
  const user = userEvent.setup()
  mockedNearbyLocations.mockResolvedValue([nearbySource])
  renderForm('/club/locations/new')
  expect(mockedNearbyLocations).not.toHaveBeenCalled()
  await pickPoint()
  const useSource = await screen.findByRole('button', { name: 'Folosește locul Sala existentă' })
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  useSource.focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled())
  expect(screen.getByLabelText('Nume')).toHaveValue(nearbySource.name)
  expect(screen.getByLabelText('Tip')).toHaveValue(nearbySource.type)
  expect(screen.getByLabelText('Adresă')).toHaveValue(nearbySource.address)
  expect(screen.getByLabelText('Oraș')).toHaveValue(nearbySource.city)
  expect(screen.getByLabelText('Descriere')).toHaveValue(nearbySource.description)

  await user_salveaza()
  await waitFor(() =>
    expect(mockedCreare).toHaveBeenCalledWith('club-1', {
      name: nearbySource.name,
      type: nearbySource.type,
      address: nearbySource.address,
      city: nearbySource.city,
      description: nearbySource.description,
      lat: nearbySource.lat,
      lng: nearbySource.lng,
    }),
  )
  expect(mockedActualizare).not.toHaveBeenCalled()
  expect(await screen.findByText('Lista de locații')).toBeInTheDocument()
})

test('platform locations can be selected with the same own-copy behavior', async () => {
  const user = userEvent.setup()
  mockedNearbyLocations.mockResolvedValue([{ ...nearbySource, club_id: null }])
  renderForm('/club/locations/new')
  await pickPoint()
  await user.click(await screen.findByRole('button', { name: 'Folosește locul Sala existentă' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled())
  await user_salveaza()
  await waitFor(() => expect(mockedCreare).toHaveBeenCalledWith('club-1', expect.any(Object)))
})

test('an own-club location offers editing instead of another copy', async () => {
  mockedNearbyLocations.mockResolvedValue([{ ...nearbySource, club_id: 'club-1' }])
  renderForm('/club/locations/new')
  await pickPoint()
  expect(await screen.findByText('Deja în locațiile clubului')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Sala existentă' })).toHaveAttribute(
    'href',
    '/club/locations/source-location/edit',
  )
  expect(
    screen.queryByRole('button', { name: 'Folosește locul Sala existentă' }),
  ).not.toBeInTheDocument()
  expect(mockedCreare).not.toHaveBeenCalled()
})

test('explicit new-place choice preserves the authored form and current pin', async () => {
  const user = userEvent.setup()
  mockedNearbyLocations.mockResolvedValue([nearbySource])
  renderForm('/club/locations/new')
  await user.type(screen.getByLabelText('Nume'), 'Alt loc')
  await pickPoint()
  await user.click(await screen.findByRole('button', { name: 'Creează un loc diferit' }))
  await user_salveaza()
  await waitFor(() =>
    expect(mockedCreare).toHaveBeenCalledWith(
      'club-1',
      expect.objectContaining({ name: 'Alt loc', lat: 45.75, lng: 21.22 }),
    ),
  )
})

test('a pending lookup disables saving and an empty successful lookup allows creation', async () => {
  let finishLookup: (locations: LocationRow[]) => void = () => undefined
  mockedNearbyLocations.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishLookup = resolve
      }),
  )
  renderForm('/club/locations/new')
  await pickPoint()
  expect(await screen.findByText('Caut locații existente în apropiere…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  await act(async () => finishLookup([]))
  expect(await screen.findByText(/Nu există locații active/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})

test('a failed lookup is not empty and retry recovers creation', async () => {
  const user = userEvent.setup()
  mockedNearbyLocations.mockRejectedValueOnce(new Error('network'))
  renderForm('/club/locations/new')
  await pickPoint()
  expect(
    await screen.findByText('Nu am putut verifica locațiile din apropiere.'),
  ).toBeInTheDocument()
  expect(screen.queryByText(/Nu există locații active/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  expect(await screen.findByText(/Nu există locații active/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})

test('an older lookup resolving last cannot replace results for the current pin', async () => {
  let finishOldLookup: (locations: LocationRow[]) => void = () => undefined
  mockedNearbyLocations
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOldLookup = resolve
        }),
    )
    .mockResolvedValue([
      { ...nearbySource, id: 'new-source', name: 'Loc nou', lat: 45.8, lng: 21.3 },
    ])
  renderForm('/club/locations/new')
  await pickPoint()
  await screen.findByText('Caut locații existente în apropiere…')
  await pickPoint(45.8, 21.3)
  await screen.findByRole('button', { name: 'Folosește locul Loc nou' })
  await act(async () => finishOldLookup([nearbySource]))
  expect(screen.getByRole('button', { name: 'Folosește locul Loc nou' })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Folosește locul Sala existentă' }),
  ).not.toBeInTheDocument()
})

test('choosing a source cancels reverse lookup and rejects its delayed result', async () => {
  const user = userEvent.setup()
  let finishReverse: () => void = () => undefined
  let reverseSignal: AbortSignal | undefined
  vi.mocked(geocoding.reverse).mockImplementationOnce((_lat, _lng, signal) => {
    reverseSignal = signal
    return new Promise((resolve) => {
      finishReverse = () =>
        resolve({
          id: 'old-point',
          label: 'Punct vechi',
          detail: '',
          address: 'Adresă veche',
          city: 'Oraș vechi',
          lat: 45.75,
          lng: 21.22,
        })
    })
  })
  mockedNearbyLocations.mockResolvedValue([nearbySource])
  renderForm('/club/locations/new')
  await pickPoint()
  await user.click(await screen.findByRole('button', { name: 'Folosește locul Sala existentă' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled())
  expect(reverseSignal?.aborted).toBe(true)
  await act(async () => finishReverse())
  expect(screen.getByLabelText('Adresă')).toHaveValue(nearbySource.address)
  await user_salveaza()
  await waitFor(() =>
    expect(mockedCreare).toHaveBeenCalledWith(
      'club-1',
      expect.objectContaining({ lat: nearbySource.lat, lng: nearbySource.lng }),
    ),
  )
})

test.each(['source', 'new'])(
  'returning to the original pin does not revive the %s choice',
  async (choice) => {
    const user = userEvent.setup()
    mockedNearbyLocations.mockResolvedValue([nearbySource])
    renderForm('/club/locations/new')
    await pickPoint()
    await user.click(
      await screen.findByRole('button', {
        name: choice === 'source' ? 'Folosește locul Sala existentă' : 'Creează un loc diferit',
      }),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled())
    const originalPoint = choice === 'source' ? nearbySource : { lat: 45.75, lng: 21.22 }
    await pickPoint(45.7501, 21.22)
    await screen.findByRole('button', { name: 'Folosește locul Sala existentă' })
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
    await pickPoint(originalPoint.lat, originalPoint.lng)
    const useSource = await screen.findByRole('button', { name: 'Folosește locul Sala existentă' })
    expect(useSource).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Creează un loc diferit' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
    expect(mockedCreare).not.toHaveBeenCalled()
  },
)

test('a delayed reverse result for the same pin preserves the explicit new-place choice', async () => {
  const user = userEvent.setup()
  let finishReverse: () => void = () => undefined
  vi.mocked(geocoding.reverse).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishReverse = () =>
          resolve({
            id: 'same-point',
            label: 'Același punct',
            detail: '',
            address: 'Adresa punctului',
            city: 'Timișoara',
            lat: 45.75,
            lng: 21.22,
          })
      }),
  )
  mockedNearbyLocations.mockResolvedValue([nearbySource])
  renderForm('/club/locations/new')
  await pickPoint()
  await user.click(await screen.findByRole('button', { name: 'Creează un loc diferit' }))
  await act(async () => finishReverse())
  expect(screen.getByLabelText('Adresă')).toHaveValue('Adresa punctului')
  expect(screen.getByRole('button', { name: 'Creează un loc diferit' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})

test('a background lookup blocks saving even when cached results are empty', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(['club-nearby-locations', 'club-1', 45.75, 21.22], [])
  let finishLookup: (locations: LocationRow[]) => void = () => undefined
  mockedNearbyLocations.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishLookup = resolve
      }),
  )
  renderForm('/club/locations/new', queryClient)
  await pickPoint()
  expect(await screen.findByText('Caut locații existente în apropiere…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  await act(async () => finishLookup([]))
  expect(await screen.findByText(/Nu există locații active/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()
})

test('returning to create at the saved point finds the new own-club location', async () => {
  const user = userEvent.setup()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  })
  mockedNearbyLocations.mockResolvedValueOnce([]).mockResolvedValue([
    {
      ...nearbySource,
      id: 'created-location',
      name: 'Loc creat',
      club_id: 'club-1',
      lat: 45.75,
      lng: 21.22,
    },
  ])
  renderForm('/club/locations/new', queryClient)
  await user.type(screen.getByLabelText('Nume'), 'Loc creat')
  await pickPoint()
  await user_salveaza()
  await screen.findByText('Lista de locații')
  await user.click(screen.getByRole('link', { name: 'Adaugă locație' }))
  await pickPoint()
  expect(await screen.findByText('Deja în locațiile clubului')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Loc creat' })).toHaveAttribute(
    'href',
    '/club/locations/created-location/edit',
  )
})
