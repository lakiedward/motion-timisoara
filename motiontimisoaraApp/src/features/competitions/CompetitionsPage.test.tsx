import { vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import CompetitionsPage from './CompetitionsPage'
import { getConcursuriPublice, type PublicCompetition } from '@/api/competitions'

vi.mock('@/api/competitions', async () => {
  const real = await vi.importActual<typeof import('@/api/competitions')>('@/api/competitions')
  return { ...real, getConcursuriPublice: vi.fn() }
})

const mocked = vi.mocked(getConcursuriPublice)

const CONCURS: PublicCompetition = {
  id: 'k1',
  slug: 'cupa',
  title: 'Cupa Timișoara',
  description: 'O întrecere scurtă pentru copii.',
  heroUrl: 'https://public/hero.jpg',
  organizator: { fel: 'club', nume: 'Club Audit', link: '/cluburi/c1' },
}

function deseneaza() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CompetitionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mocked.mockReset()
})

test('o listă care nu se încarcă spune asta, nu că nu există concursuri', async () => {
  mocked.mockRejectedValue(new Error('retea'))
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(screen.getByText('Nu am putut încărca concursurile.')).toBeInTheDocument()
  expect(screen.queryByText(/Niciun concurs publicat/)).not.toBeInTheDocument()
})

test('din eroare se poate reîncerca', async () => {
  const user = userEvent.setup()
  mocked.mockRejectedValueOnce(new Error('retea')).mockResolvedValueOnce([CONCURS])
  deseneaza()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: 'Reîncearcă' }))
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Cupa Timișoara' })).toHaveAttribute(
      'href',
      '/concursuri/cupa',
    ),
  )
  expect(screen.getByText('Club Audit')).toBeInTheDocument()
  expect(document.querySelector('img[src="https://public/hero.jpg"]')).toBeInTheDocument()
})

test('fără concursuri, mesajul e altul decât cel de eroare', async () => {
  mocked.mockResolvedValue([])
  deseneaza()
  await waitFor(() => expect(screen.getByText(/Niciun concurs publicat/)).toBeInTheDocument())
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
