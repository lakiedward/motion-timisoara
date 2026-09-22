import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { CompetitionRouteMap } from './CompetitionRouteMap'

const map = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  setView: vi.fn(),
  fail: () => {},
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="route-map">{children}</div>
  ),
  TileLayer: ({ eventHandlers }: { eventHandlers: { tileerror: () => void } }) => {
    map.fail = eventHandlers.tileerror
    return null
  },
  Polyline: ({ positions }: { positions: number[][] }) => (
    <span data-testid="route-line">{positions.map((point) => point.join(',')).join(';')}</span>
  ),
  CircleMarker: ({ center }: { center: number[] }) => <span>{center.join(',')}</span>,
  useMap: () => ({ fitBounds: map.fitBounds, setView: map.setView }),
}))

const gpx =
  '<gpx><trk><trkseg><trkpt lat="45" lon="21"/><trkpt lat="46" lon="22"/></trkseg></trk></gpx>'

function renderRoute(gpxUrl: string | null, downloadUrl?: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CompetitionRouteMap routeLabel="Copii 8-10 ani" gpxUrl={gpxUrl} downloadUrl={downloadUrl} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  map.fitBounds.mockClear()
  map.setView.mockClear()
})

test('renders route geometry, fits the map, and offers the GPX download', async () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-only')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(gpx, { status: 200 })))
  renderRoute('https://example.test/route.gpx', 'https://example.test/route.gpx?download=true')
  expect(screen.getByRole('link', { name: /Descarcă GPX/ })).toHaveAttribute(
    'href',
    'https://example.test/route.gpx?download=true',
  )
  expect(await screen.findByTestId('route-line')).toHaveTextContent('45,21;46,22')
  expect(map.fitBounds).toHaveBeenCalledWith(
    [
      [45, 21],
      [46, 22],
    ],
    { padding: [16, 16], maxZoom: 15 },
  )
  expect(screen.getByRole('region', { name: 'Harta traseului Copii 8-10 ani' })).toBeVisible()
})

test('separates missing, fetch error, and basemap failure states', async () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-only')
  const empty = renderRoute(null)
  expect(screen.getByRole('status')).toHaveTextContent('Nu există fișier GPX')
  empty.unmount()

  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockResolvedValueOnce(new Response(gpx, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  renderRoute('https://example.test/route.gpx')
  expect(await screen.findByRole('alert')).toHaveTextContent('Nu am putut afișa traseul GPX')
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă traseul' }))
  expect(await screen.findByTestId('route-line')).toBeVisible()
  act(() => map.fail())
  expect(screen.getByRole('alert')).toHaveTextContent('Fundalul hărții nu este disponibil')
  fireEvent.click(screen.getByRole('button', { name: 'Reîncearcă harta' }))
  expect(screen.getByTestId('route-line')).toBeVisible()
})
