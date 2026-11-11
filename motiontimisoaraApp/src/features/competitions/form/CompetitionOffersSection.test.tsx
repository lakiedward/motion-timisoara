import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { CompetitionOffers, CompetitionRoute } from '@/api/competition/competition-offers'
import { CompetitionOffersSection } from './CompetitionOffersSection'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  createRoute: vi.fn(),
  updateRoute: vi.fn(),
  deleteRoute: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

vi.mock('@/api/competition/competition-offers', () => ({
  listCompetitionOffers: api.list,
  createCompetitionRoute: api.createRoute,
  updateCompetitionRoute: api.updateRoute,
  deleteCompetitionRoute: api.deleteRoute,
  createCompetitionCategory: api.createCategory,
  updateCompetitionCategory: api.updateCategory,
  deleteCompetitionCategory: api.deleteCategory,
  competitionRouteGpxDownloadUrl: (path: string | null) =>
    path ? `https://example.test/${path}?download=1` : null,
  validateCompetitionCategory: (input: unknown) => input,
  competitionOfferErrorMessage: (error: Error) => error.message,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }))
vi.mock('./CompetitionRouteGalleryEditor', () => ({ CompetitionRouteGalleryEditor: () => null }))

const competitionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const route: CompetitionRoute = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  competition_id: competitionId,
  name: 'Traseu parc',
  description: 'Circuit în jurul parcului',
  gpx_storage_path: `${competitionId}/routes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc.gpx`,
  display_order: 0,
  created_at: '2026-09-22T12:00:00Z',
  updated_at: '2026-09-22T12:00:00Z',
}

let offers: CompetitionOffers

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CompetitionOffersSection competitionId={competitionId} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  offers = { routes: [], categories: [] }
  api.list.mockImplementation(async () => offers)
  api.createRoute.mockImplementation(async () => {
    offers = { ...offers, routes: [route] }
    return route
  })
  api.deleteRoute.mockImplementation(async () => {
    offers = { ...offers, routes: [] }
    return { cleanupFailed: false }
  })
})

test('shows empty states and creates an event without a GPX file', async () => {
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByText(/Nu există trasee sau probe/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Adaugă categorie' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Adaugă traseu sau probă' }))
  await user.type(screen.getByLabelText('Nume traseu sau probă'), route.name)
  await user.type(screen.getByLabelText('Descriere'), route.description)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(api.createRoute).toHaveBeenCalledWith(
      competitionId,
      {
        id: null,
        name: route.name,
        description: route.description,
        file: null,
      },
      null,
    ),
  )
  expect(await screen.findByText('Traseu parc')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Adaugă categorie' })).toBeEnabled()
})

test('passes an optional GPX file when creating a route', async () => {
  const user = userEvent.setup()
  renderSection()
  await user.click(await screen.findByRole('button', { name: 'Adaugă traseu sau probă' }))
  await user.type(screen.getByLabelText('Nume traseu sau probă'), route.name)
  await user.type(screen.getByLabelText('Descriere'), route.description)
  const file = new File(['<gpx/>'], 'traseu.gpx', { type: 'application/gpx+xml' })
  await user.upload(screen.getByLabelText(/Fișier GPX/), file)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() =>
    expect(api.createRoute).toHaveBeenCalledWith(
      competitionId,
      { id: null, name: route.name, description: route.description, file },
      file,
    ),
  )
})

test('allows categories on events without a GPX file', async () => {
  offers = { routes: [{ ...route, gpx_storage_path: null }], categories: [] }
  renderSection()
  expect(await screen.findByText(/Fără GPX · fără hartă/)).toBeVisible()
  expect(screen.queryByText(/Adaugă un traseu sau o probă înainte/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Adaugă categorie' })).toBeEnabled()
})

test('requires a second action before deleting a complete route', async () => {
  offers = { routes: [route], categories: [] }
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByText(route.name)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Șterge' }))
  expect(api.deleteRoute).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Confirmă ștergerea' }))
  await waitFor(() => expect(api.deleteRoute).toHaveBeenCalledWith(competitionId, route.id))
  expect(await screen.findByText(/Nu există trasee/)).toBeVisible()
})
