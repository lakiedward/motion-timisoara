import { vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { geocoding } from '@/api/geocoding'
import {
  clickSave,
  mapClicks,
  mockedActualizare,
  mockedCautare,
  mockedCreare,
  mockedLocatie,
  locatie,
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

test('formularul nu mai are câmpuri de latitudine și longitudine', async () => {
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  expect(screen.queryByLabelText('Latitudine')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Longitudine')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Adresă')).toBeInTheDocument()
  expect(screen.getByTestId('harta')).toBeInTheDocument()
})

test('câmpurile păstrate rămân pe ecran, harta se adaugă lângă ele', async () => {
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  for (const eticheta of [/^Nume/, /^Tip/, 'Județ / regiune', 'Oraș', 'Adresă', 'Descriere']) {
    expect(screen.getByLabelText(eticheta)).toBeInTheDocument()
  }
  expect(screen.getByRole('heading', { name: 'Editează locația' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvează' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Anulează' })).toBeInTheDocument()
})
test('fără punct pe hartă salvarea e oprită și nu ajunge la server', async () => {
  const user = userEvent.setup()
  renderForm('/club/locations/new')
  await screen.findByLabelText(/^Nume/)
  await user.type(screen.getByLabelText(/^Nume/), 'Sala Nouă')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))

  const mesaj = await screen.findByText('Pune punctul pe hartă')
  const adresa = screen.getByLabelText('Adresă')
  expect(adresa).toHaveAttribute('aria-describedby', mesaj.id)
  expect(adresa.parentElement?.nextElementSibling).toBe(mesaj)
  expect(mockedCreare).not.toHaveBeenCalled()
})
test('descrierea scrisă de club ajunge la salvare', async () => {
  const user = userEvent.setup()
  renderForm()
  await screen.findByDisplayValue('Bazin Audit')
  await user.type(screen.getByLabelText('Descriere'), 'Intrarea din spate')
  await clickSave()
  await waitFor(() =>
    expect(mockedActualizare).toHaveBeenCalledWith(
      'loc-1',
      expect.objectContaining({ description: 'Intrarea din spate' }),
    ),
  )
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
  await user.type(screen.getByLabelText('Adresă'), 'take ionescu')

  const sugestie = await screen.findByRole(
    'option',
    { name: /Take Ionescu 46C/ },
    { timeout: 5000 },
  )
  await user.click(sugestie)

  expect(screen.getByLabelText('Adresă')).toHaveValue('Bulevardul Take Ionescu 46C')
  expect(screen.getByLabelText('Oraș')).toHaveAttribute('data-value', 'Timișoara')

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
  expect(screen.queryByLabelText(/^Nume/)).not.toBeInTheDocument()
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
    mapClicks.handler?.({ latlng: { lat: 45.7, lng: 21.2 } })
  })
  await act(async () => {
    mapClicks.handler?.({ latlng: { lat: 45.8, lng: 21.3 } })
  })
  await waitFor(() => expect(screen.getByLabelText('Adresă')).toHaveValue('Strada Nouă 2'))
  await act(async () => {
    terminaPrimul?.()
  })
  expect(screen.getByLabelText('Adresă')).toHaveValue('Strada Nouă 2')

  await clickSave()
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
    mapClicks.handler?.({ latlng: { lat: 45.7, lng: 21.2 } })
  })

  await user.type(screen.getByLabelText('Adresă'), 'take ionescu')
  await user.click(await screen.findByRole('option', { name: /Take Ionescu 46C/ }))
  expect(screen.getByLabelText('Adresă')).toHaveValue('Bulevardul Take Ionescu 46C')

  await act(async () => {
    terminaVechiul?.()
  })
  expect(screen.getByLabelText('Adresă')).toHaveValue('Bulevardul Take Ionescu 46C')
})

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

