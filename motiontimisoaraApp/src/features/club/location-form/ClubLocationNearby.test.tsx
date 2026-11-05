import { vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'

import { geocoding } from '@/api/geocoding'
import type { LocationRow } from '@/api/public'
import {
  clickSave,
  mapClicks,
  mockedCreare,
  mockedActualizare,
  mockedNearbyLocations,
  nearbySource,
  pickPoint,
  renderForm,
  resetClubLocationMocks,
} from '@/test/club-location-form'

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

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="harta">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => <div data-testid="pin" />,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: (handlers: {
    click: (e: { latlng: { lat: number; lng: number } }) => void
  }) => {
    mapClicks.handler = handlers.click
    return null
  },
}))

beforeEach(resetClubLocationMocks)

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
  expect(screen.getByLabelText(/^Nume/)).toHaveValue(nearbySource.name)
  expect(screen.getByLabelText(/^Tip/)).toHaveAttribute('data-value', nearbySource.type)
  expect(screen.getByLabelText('Adresă')).toHaveValue(nearbySource.address)
  expect(screen.getByLabelText('Oraș')).toHaveAttribute('data-value', nearbySource.city)
  expect(screen.getByLabelText('Descriere')).toHaveValue('')

  await clickSave()
  await waitFor(() =>
    expect(mockedCreare).toHaveBeenCalledWith('club-1', {
      name: nearbySource.name,
      type: nearbySource.type,
      address: nearbySource.address,
      city: nearbySource.city,
      county: 'Timiș',
      description: null,
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
  await clickSave()
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
  await user.type(screen.getByLabelText(/^Nume/), 'Alt loc')
  await pickPoint()
  await user.click(await screen.findByRole('button', { name: 'Creează un loc diferit' }))
  await clickSave()
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
  await clickSave()
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
  await user.type(screen.getByLabelText(/^Nume/), 'Loc creat')
  await pickPoint()
  await clickSave()
  await screen.findByText('Lista de locații')
  await user.click(screen.getByRole('link', { name: 'Adaugă locație' }))
  await pickPoint()
  expect(await screen.findByText('Deja în locațiile clubului')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Editează Loc creat' })).toHaveAttribute(
    'href',
    '/club/locations/created-location/edit',
  )
})
