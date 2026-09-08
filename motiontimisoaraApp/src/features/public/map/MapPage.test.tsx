import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { useImperativeHandle, type ReactNode, type Ref } from 'react'
import { vi } from 'vitest'
import MapPage from '../MapPage'
import { getActivities, getCourses, getLocations, type LocationRow } from '@/api/public'
import { cartoTileUrl } from './basemap'

const map = vi.hoisted(() => ({
  setView: vi.fn(),
  getContainer: vi.fn(() => document.createElement('div')),
  on: vi.fn(),
  off: vi.fn(),
  openPopup: vi.fn(),
  closePopup: vi.fn(),
  getElement: vi.fn(() => document.createElement('button')),
  isPopupOpen: vi.fn(() => false),
  getPopup: vi.fn(() => ({ update: vi.fn() })),
}))

vi.mock('@/api/public', () => ({
  getActivities: vi.fn(),
  getCourses: vi.fn(),
  getLocations: vi.fn(),
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: function TestMarker({
    children,
    alt,
    ref,
  }: {
    children: ReactNode
    alt: string
    ref: Ref<unknown>
  }) {
    useImperativeHandle(ref, () => map)
    return <div aria-label={alt}>{children}</div>
  },
  TileLayer: ({
    eventHandlers,
  }: {
    eventHandlers: { tileerror: () => void; load: () => void }
  }) => (
    <div>
      <button onClick={eventHandlers.tileerror}>Simulate tile error</button>
      <button onClick={eventHandlers.load}>Simulate tiles finished</button>
    </div>
  ),
  useMap: () => map,
}))

const place: LocationRow = {
  id: 'place-1',
  name: 'Bazin Test',
  type: 'POOL',
  city: 'Timișoara',
  lat: 45.75,
  lng: 21.23,
  address: 'Adresa Test',
  club_id: 'club-1',
  description: null,
  created_by_user_id: null,
  capacity: null,
  fts: null,
  is_active: true,
}

function renderMap(route = '/harta') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <MapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', 'test-key')
  vi.mocked(getLocations).mockResolvedValue([place])
  vi.mocked(getCourses).mockResolvedValue([])
  vi.mocked(getActivities).mockResolvedValue([])
})

afterEach(() => vi.unstubAllEnvs())

test('shows pending data before resolving into real locations', async () => {
  let finish!: (locations: LocationRow[]) => void
  vi.mocked(getLocations).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  renderMap()
  expect(screen.getByText('Se încarcă locațiile și ofertele…')).toBeInTheDocument()
  expect(
    screen.queryByText('Momentan nu există locații disponibile pe hartă.'),
  ).not.toBeInTheDocument()
  await act(async () => finish([place]))
  expect(await screen.findByText('Bazin Test')).toBeInTheDocument()
})

test.each([getLocations, getCourses, getActivities])(
  'does not turn a rejected query into empty locations or offers',
  async (query) => {
    vi.mocked(query).mockRejectedValueOnce(new Error('Unavailable'))
    renderMap()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nu am putut încărca locațiile și ofertele lor.',
    )
    expect(
      screen.queryByText('Momentan fără cursuri sau activități la această locație.'),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă' }))
    expect(await screen.findByText('Bazin Test')).toBeInTheDocument()
  },
)

test.each([{ locations: [] }, { locations: [{ ...place, lat: null, lng: null }] }])(
  'shows an explicit empty state when no location can be plotted',
  async ({ locations }) => {
    vi.mocked(getLocations).mockResolvedValue(locations)
    renderMap()
    expect(
      await screen.findByText('Momentan nu există locații disponibile pe hartă.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  },
)

test('groups shared places and preserves offer links and grouped-row deep links', async () => {
  vi.mocked(getLocations).mockResolvedValue([place, { ...place, id: 'place-2', club_id: 'club-2' }])
  vi.mocked(getCourses).mockResolvedValue([
    {
      id: 'course-1',
      name: 'Înot Test',
      location_id: 'place-2',
      age_from: 6,
      age_to: 10,
      sport: null,
    },
  ] as Awaited<ReturnType<typeof getCourses>>)
  vi.mocked(getActivities).mockResolvedValue([
    {
      id: 'activity-1',
      name: 'Activitate Test',
      location_id: 'place-1',
      activity_date: '2026-10-01',
      start_time: '09:00',
      sport: null,
    },
  ] as Awaited<ReturnType<typeof getActivities>>)
  renderMap('/harta?location=place-2')
  expect(await screen.findAllByText('Bazin Test')).toHaveLength(1)
  expect(screen.getByText('2 cluburi se antrenează aici')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^Înot Test/ })).toHaveAttribute(
    'href',
    '/cursuri/course-1',
  )
  expect(screen.getByRole('link', { name: /Activitate Test/ })).toHaveAttribute(
    'href',
    '/activitati/activity-1',
  )
  await waitFor(() => expect(map.openPopup).toHaveBeenCalled())
  expect(map.setView).toHaveBeenCalledWith([45.75, 21.23], 15, { animate: false })
})

test('missing basemap configuration preserves locations without requesting unauthenticated tiles', async () => {
  vi.stubEnv('VITE_CARTO_BASEMAP_API_KEY', '')
  renderMap()
  expect(await screen.findByText('Bazin Test')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Fundalul hărții nu este disponibil.')
  expect(screen.getByRole('button', { name: 'Reîncarcă pagina' })).toBeInTheDocument()
  expect(screen.queryByText('Simulate tiles finished')).not.toBeInTheDocument()
})

test('waits for the popup binding before opening a deep-linked location', async () => {
  map.getPopup.mockReturnValueOnce(undefined as never)
  renderMap('/harta?location=place-1')
  await waitFor(() => expect(map.openPopup).toHaveBeenCalledOnce())
  expect(map.getPopup.mock.calls.length).toBeGreaterThanOrEqual(2)
})

test('retries a failed query without waiting for or restarting a slow sibling query', async () => {
  let finishCourses!: (courses: Awaited<ReturnType<typeof getCourses>>) => void
  vi.mocked(getCourses).mockReturnValue(
    new Promise((resolve) => {
      finishCourses = resolve
    }),
  )
  vi.mocked(getLocations).mockRejectedValueOnce(new Error('Locations unavailable'))
  renderMap()
  const retry = await screen.findByRole('button', { name: 'Reîncearcă' })
  expect(retry).toBeEnabled()
  await userEvent.click(retry)
  await waitFor(() => expect(getLocations).toHaveBeenCalledTimes(2))
  expect(getCourses).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Se încarcă locațiile și ofertele…')).toBeInTheDocument()
  await act(async () => finishCourses([]))
  expect(await screen.findByText('Bazin Test')).toBeInTheDocument()
})

test('Escape closes an open popup from its content and restores marker focus', async () => {
  const markerElement = document.createElement('button')
  const focus = vi.spyOn(markerElement, 'focus')
  map.getElement.mockReturnValueOnce(markerElement)
  map.isPopupOpen.mockReturnValueOnce(true)
  renderMap()
  await screen.findByText('Bazin Test')
  const container = map.getContainer.mock.results.at(-1)!.value
  fireEvent.keyDown(container, { key: 'Escape' })
  expect(map.closePopup).toHaveBeenCalledOnce()
  expect(focus).toHaveBeenCalledOnce()
})

test('a tile error survives completion of other tiles and clears only after a successful retry', async () => {
  renderMap()
  await screen.findByText('Bazin Test')
  await userEvent.click(screen.getByText('Simulate tile error'))
  await userEvent.click(screen.getByText('Simulate tiles finished'))
  expect(screen.getByRole('alert')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reîncearcă harta' }))
  await userEvent.click(screen.getByText('Simulate tiles finished'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Se încarcă fundalul hărții…')).not.toBeInTheDocument()
})

test('tile URLs require a nonempty key and encode it as a single query value', () => {
  expect(cartoTileUrl(undefined)).toBeNull()
  expect(cartoTileUrl('  ')).toBeNull()
  expect(cartoTileUrl(' test&key=other ')).toMatch(/\?key=test%26key%3Dother$/)
})
