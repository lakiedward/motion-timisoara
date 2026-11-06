import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CompetitionRegistrationPage from './CompetitionRegistrationPage'
import { getConcursPublic } from '@/api/competition/competitions'

vi.mock('@/api/competition/competitions', () => ({ getConcursPublic: vi.fn() }))
vi.mock('@/api/competition/competition-offers', () => ({ getCompetitionCategories: vi.fn() }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/competitions/cupa/register']}>
        <Routes>
          <Route
            path="/account/competitions/:slug/register"
            element={<CompetitionRegistrationPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('concursul inexistent are stare proprie cu link spre concursuri', async () => {
  vi.mocked(getConcursPublic).mockResolvedValue(null as never)
  renderPage()
  expect(await screen.findByText('Concursul nu a fost găsit.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Vezi concursurile' })).toBeInTheDocument()
})

test('eroarea de încărcare are reîncercare', async () => {
  vi.mocked(getConcursPublic).mockRejectedValue(new Error('x'))
  renderPage()
  expect(await screen.findByText('Nu am putut încărca înscrierea la concurs.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reîncearcă' })).toBeInTheDocument()
})
