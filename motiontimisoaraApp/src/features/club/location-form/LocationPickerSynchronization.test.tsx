import { useState, type ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import LocationPicker, { type PickedPoint } from '@/components/LocationPicker'
import { geocoding, type GeoPlace } from '@/api/geocoding'

vi.mock('@/api/geocoding', () => ({ geocoding: { search: vi.fn(), reverse: vi.fn() } }))

let clickMap: (event: { latlng: { lat: number; lng: number } }) => void
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: (events: { click: typeof clickMap }) => {
    clickMap = events.click
  },
}))

const place: GeoPlace = {
  id: 'new-place',
  label: 'Sala Sporturilor',
  detail: 'Arad',
  address: 'Strada Sportului 2',
  city: 'Arad',
  county: 'Arad',
  lat: 46.17,
  lng: 21.32,
}

function Picker() {
  const [address, setAddress] = useState('Adresa veche')
  const [point, setPoint] = useState<PickedPoint | null>(null)
  return (
    <>
      <LocationPicker
        value={point}
        address={address}
        city="Arad"
        county="Arad"
        onAddressChange={setAddress}
        onChange={(next) => {
          setPoint(next)
          if (next.resolved) setAddress(next.address ?? '')
        }}
      />
      <output aria-label="Loc ales">
        {point ? `${point.lat},${point.lng}|${point.city}|${point.county}` : ''}
      </output>
    </>
  )
}

function renderPicker() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Picker />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(geocoding.search).mockReset().mockResolvedValue([])
  vi.mocked(geocoding.reverse).mockReset().mockResolvedValue(place)
})

test('map lookup fills the only address field while preserving the actual clicked coordinates', async () => {
  renderPicker()
  await act(async () => clickMap({ latlng: { lat: 46.170123, lng: 21.321234 } }))
  expect(screen.getAllByRole('combobox', { name: 'Adresă' })).toHaveLength(1)
  expect(screen.queryByLabelText('Caută adresa')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Adresă')).toHaveValue(place.address)
  expect(screen.getByLabelText('Loc ales')).toHaveTextContent('46.170123,21.321234|Arad|Arad')
})

test('a streetless point clears the old address and explains manual completion', async () => {
  vi.mocked(geocoding.reverse).mockResolvedValue({ ...place, address: null })
  renderPicker()
  await act(async () => clickMap({ latlng: { lat: 46.17, lng: 21.32 } }))
  expect(screen.getByLabelText('Adresă')).toHaveValue('')
  expect(screen.getByText(/Punctul este ales. Nu am găsit strada/)).toBeInTheDocument()
})

test('manual address editing cancels a pending reverse response', async () => {
  let resolveLookup: (place: GeoPlace) => void = () => undefined
  let signal: AbortSignal | undefined
  vi.mocked(geocoding.reverse).mockImplementationOnce((_lat, _lng, incomingSignal) => {
    signal = incomingSignal
    return new Promise((resolve) => {
      resolveLookup = resolve
    })
  })
  const user = userEvent.setup()
  renderPicker()
  await act(async () => clickMap({ latlng: { lat: 46.17, lng: 21.32 } }))
  await user.clear(screen.getByLabelText('Adresă'))
  await user.type(screen.getByLabelText('Adresă'), 'Adresa mea')
  await act(async () => resolveLookup(place))
  expect(signal?.aborted).toBe(true)
  expect(screen.getByLabelText('Adresă')).toHaveValue('Adresa mea')
})

test('reverse failure offers retry and recovers the same point', async () => {
  const user = userEvent.setup()
  vi.mocked(geocoding.reverse).mockRejectedValueOnce(new Error('offline'))
  renderPicker()
  await act(async () => clickMap({ latlng: { lat: 46.17, lng: 21.32 } }))
  expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut afla adresa punctului')
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() => expect(screen.getByLabelText('Adresă')).toHaveValue(place.address))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('keyboard suggestion selection uses one address and sends city/county context', async () => {
  const user = userEvent.setup()
  vi.mocked(geocoding.search).mockResolvedValue([place])
  renderPicker()
  await user.clear(screen.getByLabelText('Adresă'))
  await user.type(screen.getByLabelText('Adresă'), 'Sportului')
  await screen.findByRole('option', { name: /Sala Sporturilor/ })
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByLabelText('Adresă')).toHaveValue(place.address)
  expect(screen.getByLabelText('Loc ales')).toHaveTextContent('46.17,21.32|Arad|Arad')
  expect(geocoding.search).toHaveBeenLastCalledWith('Sportului', expect.any(AbortSignal), {
    city: 'Arad',
    county: 'Arad',
  })
})
