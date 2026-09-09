import { act, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { LiveLocationMap } from './LiveLocationMap'

const map = vi.hoisted(() => ({ setView: vi.fn(), fail: () => {} }))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: ({ eventHandlers }: { eventHandlers: { tileerror: () => void } }) => {
    map.fail = eventHandlers.tileerror
    return null
  },
  Marker: ({ position }: { position: number[] }) => <span>{position.join(',')}</span>,
  useMap: () => ({ setView: map.setView, getZoom: () => 16 }),
}))
const point = {
  latitude: 45.75,
  longitude: 21.23,
  accuracy: 5,
  capturedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
afterEach(() => vi.unstubAllEnvs())

test('the existing basemap receives the latest point and recenters its marker', () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-only')
  render(<LiveLocationMap point={point} />)
  expect(screen.getByText('45.75,21.23')).toBeInTheDocument()
  expect(map.setView).toHaveBeenCalledWith([45.75, 21.23], 16)
  act(() => map.fail())
  expect(screen.queryByText('45.75,21.23')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Harta nu este disponibilă')
})

test('missing basemap configuration produces an explicit error instead of an empty map', () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', '')
  render(<LiveLocationMap point={point} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Harta nu este disponibilă')
})
