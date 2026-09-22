import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CompetitionDetailsPage from './CompetitionDetailsPage'
import { getConcursPublic, type PublicCompetition } from '@/api/competitions'

vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...real, useParams: () => ({ slug: 'cupa' }) }
})

vi.mock('@/api/competitions', async () => {
  const real = await vi.importActual<typeof import('@/api/competitions')>('@/api/competitions')
  return { ...real, getConcursPublic: vi.fn() }
})

const mocked = vi.mocked(getConcursPublic)

const CONCURS: PublicCompetition = {
  id: 'k1',
  slug: 'cupa',
  title: 'Cupa Timișoara',
  description: 'Linie unu.\nLinie doi.',
  heroUrl: 'https://public/hero.jpg',
  organizator: { fel: 'club', nume: 'Club Audit', link: '/cluburi/c1' },
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CompetitionDetailsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
})

test('pagina arată titlul, descrierea, organizatorul și poza', async () => {
  mocked.mockResolvedValue(CONCURS)
  deseneaza()
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Cupa Timișoara' })).toBeInTheDocument(),
  )
  expect(screen.getByText(/Linie unu/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Club Audit' })).toHaveAttribute('href', '/cluburi/c1')
  expect(document.querySelector('img[src="https://public/hero.jpg"]')).toBeInTheDocument()
})

test('un slug necunoscut nu arată o eroare de rețea', async () => {
  mocked.mockResolvedValue(null)
  deseneaza()
  await waitFor(() => expect(screen.getByText('Concursul nu a fost găsit.')).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('eroarea de încărcare se poate reîncerca', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce(CONCURS)
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Cupa Timișoara' })).toBeInTheDocument(),
  )
})
