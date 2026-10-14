import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { getPublicClubs, type ClubListItem } from '@/api/public'
import ClubsPage from '../ClubsPage'

vi.mock('@/api/public', () => ({
  getPublicClubs: vi.fn(),
  publicUrl: (_bucket: string, path: string | null) => path,
}))

const clubsRequest = vi.mocked(getPublicClubs)
const swimming = { id: 'swimming', code: 'SWIMMING', name: 'Înot' }

function club(id: string, name: string, logo: string | null, sports: (typeof swimming)[]) {
  return {
    id,
    name,
    city: 'Timișoara',
    logo_storage_path: logo,
    club_sports: sports.map((sport) => ({ sport })),
  } as ClubListItem
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClubsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  clubsRequest.mockReset()
})

test('the title band and the club cards keep their content and links', async () => {
  clubsRequest.mockResolvedValue([
    club('a', 'Aqua Club', '/aqua.png', [swimming]),
    club('b', 'Bike Club', null, []),
  ])
  renderPage()

  const logoCard = await screen.findByRole('link', { name: /Aqua Club/ })
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cluburi')
  expect(screen.getByText('Echipă')).toBeInTheDocument()
  expect(screen.getByText('Cluburi sportive partenere din Timișoara.')).toBeInTheDocument()
  expect(logoCard).toHaveAttribute('href', '/cluburi/a')
  expect(logoCard.querySelector('img')).toHaveAttribute('alt', '')
  expect(within(logoCard).getByText('Înot')).toBeInTheDocument()
  expect(within(logoCard).getByText('Timișoara')).toBeInTheDocument()

  const initialCard = screen.getByRole('link', { name: /Bike Club/ })
  expect(initialCard).toHaveAttribute('href', '/cluburi/b')
  expect(initialCard.querySelector('img')).toBeNull()
  expect(initialCard.children).toHaveLength(1)
})

test('a failed request shows an error with retry, separate from the empty list', async () => {
  clubsRequest.mockRejectedValue(new Error('offline'))
  renderPage()

  expect(await screen.findByText('Nu am putut încărca cluburile.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Reîncearcă/ })).toBeInTheDocument()
  expect(screen.queryByText('Niciun club disponibil momentan.')).not.toBeInTheDocument()
})

test('an empty list explains the next step and links to courses and coaches', async () => {
  clubsRequest.mockResolvedValue([])
  renderPage()

  expect(await screen.findByText('Niciun club disponibil momentan.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi cursurile' })).toHaveAttribute('href', '/cursuri')
  expect(screen.getByRole('link', { name: 'Vezi antrenorii' })).toHaveAttribute('href', '/antrenori')
})

test('loading announces itself to screen readers', () => {
  clubsRequest.mockReturnValue(new Promise(() => {}))
  renderPage()

  expect(screen.getByRole('status', { name: 'Se încarcă cluburile' })).toBeInTheDocument()
})
