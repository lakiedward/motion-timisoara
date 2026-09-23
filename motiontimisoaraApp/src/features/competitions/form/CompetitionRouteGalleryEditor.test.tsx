import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

import { CompetitionRouteGalleryEditor } from './CompetitionRouteGalleryEditor'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  add: vi.fn(),
  delete: vi.fn(),
  move: vi.fn(),
}))

vi.mock('@/api/competition/competition-route-photos', () => ({
  MAX_COMPETITION_ROUTE_PHOTOS: 12,
  listCompetitionRoutePhotos: api.list,
  addCompetitionRoutePhotos: api.add,
  deleteCompetitionRoutePhoto: api.delete,
  moveCompetitionRoutePhoto: api.move,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const routeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CompetitionRouteGalleryEditor
        competitionId={competitionId}
        routeId={routeId}
        routeName="Via Maior"
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue([
    { id: 'p1', route_id: routeId, url: 'https://example.test/via-maior.jpg', display_order: 0 },
    { id: 'p2', route_id: 'other-route', url: 'https://example.test/other.jpg', display_order: 0 },
  ])
  api.add.mockResolvedValue({ added: 1, rejected: [] })
})

test('arată numai pozele traseului ales și încarcă în acel traseu', async () => {
  const user = userEvent.setup()
  renderEditor()
  const gallery = await screen.findByRole('region', { name: 'Galeria traseului Via Maior' })
  await waitFor(() => expect(gallery.querySelectorAll('img')).toHaveLength(1))
  expect(gallery.querySelector('img')).toHaveAttribute('src', 'https://example.test/via-maior.jpg')

  const file = new File(['imagine'], 'traseu.jpg', { type: 'image/jpeg' })
  const input = gallery.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, file)
  await waitFor(() => expect(api.add).toHaveBeenCalledWith(competitionId, routeId, [file], 1))
})
