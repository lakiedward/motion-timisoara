import { afterEach, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import LocationPicker from '@/components/LocationPicker'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
    <div data-testid="basemap" data-url={url} data-attribution={attribution} />
  ),
  Marker: () => null,
  useMap: () => ({ invalidateSize: vi.fn(), setView: vi.fn(), getZoom: () => 13 }),
  useMapEvents: () => null,
}))

afterEach(() => vi.unstubAllEnvs())

function renderPicker() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LocationPicker value={null} onChange={vi.fn()} />
    </QueryClientProvider>,
  )
}

test('location picker authenticates CARTO tiles using the configured basemap key', () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'synthetic/key')
  renderPicker()
  expect(screen.getByTestId('basemap')).toHaveAttribute(
    'data-url',
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=synthetic%2Fkey',
  )
  expect(screen.getByTestId('basemap').getAttribute('data-attribution')).toContain('CARTO')
})

test('location picker uses attributed OpenStreetMap tiles when CARTO is unconfigured', () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', '')
  renderPicker()
  expect(screen.getByTestId('basemap')).toHaveAttribute(
    'data-url',
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  )
  expect(screen.getByTestId('basemap').getAttribute('data-attribution')).toContain(
    'OpenStreetMap contributors',
  )
})
